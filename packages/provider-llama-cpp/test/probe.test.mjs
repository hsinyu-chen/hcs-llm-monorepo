import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LlamaCppProvider } from '../dist/index.js';

const BASE_URL = 'http://llama.test:8080';

const PROPS = {
    model_alias: 'gemma-4-31b',
    model_path: '/models/gemma-4-31b-Q4_K_M.gguf',
    n_ctx: 32768,
    default_generation_settings: {
        n_ctx: 32768,
        params: { temperature: 1, top_p: 0.95, top_k: 64, min_p: 0.05, repeat_penalty: 1.1, n_predict: -1 }
    },
    chat_template: '{{ messages }}',
    chat_template_caps: { supports_tools: true, supports_tool_calls: true, supports_parallel_tool_calls: true }
};

let originalFetch;
let fetchedUrls = [];
let respond;

beforeEach(() => {
    fetchedUrls = [];
    respond = () => Response.json(PROPS);
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const url = String(input);
        fetchedUrls.push(url);
        if (url.endsWith('/props')) return respond();
        throw new Error(`Unexpected fetch: ${url}`);
    };
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    LlamaCppProvider.invalidatePropsCache();
});

function probe(config = {}, opts) {
    return new LlamaCppProvider().probe({ baseUrl: BASE_URL, ...config }, opts);
}

describe('LlamaCppProvider probe', () => {
    it('reports the model, context size, sampling defaults and tool support from /props', async () => {
        assert.deepEqual(await probe(), {
            ok: true,
            models: [{ id: 'gemma-4-31b', contextSize: 32768 }],
            sampling: { temperature: 1, topP: 0.95, topK: 64, minP: 0.05, repeatPenalty: 1.1 },
            supportsNativeToolCalls: true,
            supportsParallelToolCalls: true
        });
        assert.deepEqual(fetchedUrls, [`${BASE_URL}/props`]);
    });

    it('requests /props at the server root for a base URL ending in /v1', async () => {
        await probe({ baseUrl: `${BASE_URL}/v1/` });
        assert.deepEqual(fetchedUrls, [`${BASE_URL}/props`]);
    });

    it('names the model by alias, then model file, then the configured id, then local-model', async () => {
        const idFor = async (props, modelId) => {
            respond = () => Response.json({ default_generation_settings: {}, ...props });
            return (await probe({ modelId })).models[0].id;
        };
        assert.equal(await idFor({ model_alias: 'alias', model_path: 'C:\\models\\file.gguf' }, 'configured'), 'alias');
        assert.equal(await idFor({ model_path: 'C:\\models\\file.gguf' }, 'configured'), 'file.gguf');
        assert.equal(await idFor({}, 'configured'), 'configured');
        assert.equal(await idFor({}, '  '), 'local-model');
    });

    it('reads the context size from the generation settings and omits what the server does not report', async () => {
        respond = () => Response.json({ default_generation_settings: { params: { n_ctx: 8192, temperature: 0 } } });
        const result = await probe({ modelId: 'm' });
        assert.deepEqual(result.models, [{ id: 'm', contextSize: 8192 }]);
        assert.deepEqual(result.sampling, { temperature: 0 });

        respond = () => Response.json({ default_generation_settings: {} });
        const bare = await probe({ modelId: 'm' });
        assert.deepEqual(bare.models, [{ id: 'm' }]);
        assert.equal('sampling' in bare, false);
    });

    it('detects native tool support from the chat template when the server has no chat_template_caps', async () => {
        respond = () => Response.json({ default_generation_settings: {}, chat_template: '... <tool_call> ...' });
        const result = await probe();
        assert.equal(result.supportsNativeToolCalls, true);
        assert.equal(result.supportsParallelToolCalls, false);

        respond = () => Response.json({ default_generation_settings: {}, chat_template: 'plain' });
        assert.equal((await probe()).supportsNativeToolCalls, false);
    });

    it('agrees with probeNativeToolSupport and probeParallelToolSupport', async () => {
        const provider = new LlamaCppProvider();
        const config = { baseUrl: BASE_URL };
        const result = await provider.probe(config);
        assert.equal(await provider.probeNativeToolSupport(config), result.supportsNativeToolCalls);
        assert.equal(await provider.probeParallelToolSupport(config), result.supportsParallelToolCalls);
    });

    it('fetches /props on every call, neither reading nor filling the props cache', async () => {
        const provider = new LlamaCppProvider();
        const config = { baseUrl: BASE_URL };
        await provider.probe(config);
        await provider.getAvailableModels(config);
        await provider.probe(config);
        await provider.getAvailableModels(config);
        assert.equal(fetchedUrls.length, 3);
    });

    it('reports not-this-server with the start of the body for JSON without default_generation_settings', async () => {
        respond = () => Response.json({ data: [] });
        assert.deepEqual(await probe(), { ok: false, reason: 'not-this-server', message: '{"data":[]}' });
    });

    it('reports not-this-server for a JSON array or null', async () => {
        respond = () => Response.json([{ default_generation_settings: {} }]);
        assert.equal((await probe()).reason, 'not-this-server');

        respond = () => new Response('null');
        assert.deepEqual(await probe(), { ok: false, reason: 'not-this-server', message: 'null' });
    });

    it('omits non-numeric sampling values', async () => {
        respond = () => Response.json({
            default_generation_settings: { params: { temperature: '0.7', top_p: null, top_k: 40, min_p: true } }
        });
        assert.deepEqual((await probe({ modelId: 'm' })).sampling, { topK: 40 });
    });

    it('reports not-this-server for a body that is not JSON', async () => {
        respond = () => new Response('<html>router</html>');
        assert.deepEqual(await probe(), { ok: false, reason: 'not-this-server', message: '<html>router</html>' });
    });

    it('reports unauthorized for 401', async () => {
        respond = () => new Response('{"error":{"message":"Invalid API Key"}}', { status: 401 });
        assert.deepEqual(await probe(), {
            ok: false, reason: 'unauthorized', status: 401, message: '{"error":{"message":"Invalid API Key"}}'
        });
    });

    it('reports http with the status and the start of the body for other errors', async () => {
        respond = () => new Response('File Not Found', { status: 404 });
        assert.deepEqual(await probe(), { ok: false, reason: 'http', status: 404, message: 'File Not Found' });
    });

    it('reports unreachable when the request fails', async () => {
        globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
        assert.deepEqual(await probe(), { ok: false, reason: 'unreachable', message: 'fetch failed' });
    });

    it('throws the signal reason when the caller aborts', async () => {
        const reason = new Error('cancelled');
        await assert.rejects(probe({}, { signal: AbortSignal.abort(reason) }), err => err === reason);
    });
});
