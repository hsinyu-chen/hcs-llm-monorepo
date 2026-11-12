import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from '../dist/index.js';

const BASE_URL = 'http://openai.test/v1';

let originalFetch;
let requests = [];
let respond;

beforeEach(() => {
    requests = [];
    respond = () => Response.json({ object: 'list', data: [{ id: 'model-b' }, { id: 'model-a' }] });
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        requests.push({ url, headers: init.headers });
        if (url.endsWith('/models')) return respond();
        throw new Error(`Unexpected fetch: ${url}`);
    };
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

function probe(config = {}, opts) {
    return new OpenAIProvider().probe({ baseUrl: BASE_URL, apiKey: 'test-key', ...config }, opts);
}

describe('OpenAIProvider probe', () => {
    it('lists the model ids in server order, without sampling or tool support', async () => {
        assert.deepEqual(await probe(), { ok: true, models: [{ id: 'model-b' }, { id: 'model-a' }] });
    });

    it('requests ${baseUrl}/models', async () => {
        await probe();
        assert.deepEqual(requests.map(r => r.url), [`${BASE_URL}/models`]);
    });

    it('requests /models under the base URL as given, with the API key', async () => {
        await probe({ baseUrl: '  http://openai.test/  ' });
        assert.deepEqual(requests, [{ url: 'http://openai.test/models', headers: { Authorization: 'Bearer test-key' } }]);
    });

    it('sends no Authorization header when the API key is blank', async () => {
        await probe({ apiKey: '  ' });
        assert.deepEqual(requests[0].headers, {});
    });

    it('skips entries without a string id and accepts an empty list', async () => {
        respond = () => Response.json({ data: [{ id: 'kept' }, { name: 'no-id' }, { id: 7 }, null] });
        assert.deepEqual(await probe(), { ok: true, models: [{ id: 'kept' }] });

        respond = () => Response.json({ data: [] });
        assert.deepEqual(await probe(), { ok: true, models: [] });
    });

    it('reports not-this-server with the start of the body for JSON without a data array', async () => {
        respond = () => Response.json({ default_generation_settings: {} });
        assert.deepEqual(await probe(), {
            ok: false, reason: 'not-this-server', message: '{"default_generation_settings":{}}'
        });

        respond = () => Response.json([{ id: 'x' }]);
        assert.equal((await probe()).reason, 'not-this-server');
    });

    it('reports not-this-server for a body that is not JSON', async () => {
        respond = () => new Response('<html>router</html>');
        assert.deepEqual(await probe(), { ok: false, reason: 'not-this-server', message: '<html>router</html>' });
    });

    it('reports unauthorized for 401', async () => {
        respond = () => new Response('{"error":{"message":"Incorrect API key"}}', { status: 401 });
        assert.deepEqual(await probe(), {
            ok: false, reason: 'unauthorized', status: 401, message: '{"error":{"message":"Incorrect API key"}}'
        });
    });

    it('reports http with the status and the start of the body for other errors', async () => {
        respond = () => new Response('404 page not found', { status: 404 });
        assert.deepEqual(await probe(), { ok: false, reason: 'http', status: 404, message: '404 page not found' });
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
