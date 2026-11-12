import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LlamaCppProvider } from '../dist/index.js';

const SSE = [
    'data: {"choices":[{"index":0,"delta":{"content":"Hi"}}]}',
    'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
    'data: [DONE]',
    ''
].join('\n\n');

let originalFetch;
let fetchedUrls = [];

beforeEach(() => {
    fetchedUrls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const url = String(input);
        fetchedUrls.push(url);
        if (url.endsWith('/chat/completions')) {
            return new Response(SSE, { headers: { 'Content-Type': 'text/event-stream' } });
        }
        if (url.endsWith('/props')) return Response.json({ model_alias: 'props-model' });
        if (url.endsWith('/tokenize')) return Response.json({ tokens: [1, 2, 3] });
        if (url.includes('/slots')) return Response.json({});
        throw new Error(`Unexpected fetch: ${url}`);
    };
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    LlamaCppProvider.invalidatePropsCache();
});

async function propsUrlFor(baseUrl) {
    await new LlamaCppProvider().getAvailableModels({ baseUrl });
    return fetchedUrls.find(u => u.endsWith('/props'));
}

describe('LlamaCppProvider base URL', () => {
    for (const [input, expected] of [
        ['http://llama.test:8080', 'http://llama.test:8080/props'],
        ['http://llama.test:8080/', 'http://llama.test:8080/props'],
        ['  http://llama.test:8080/v1  ', 'http://llama.test:8080/props'],
        ['http://llama.test:8080/v1/', 'http://llama.test:8080/props'],
        ['http://llama.test:8080/V1/', 'http://llama.test:8080/props'],
        ['http://llama.test:8080/api/v1', 'http://llama.test:8080/api/props'],
        ['   ', 'http://localhost:8080/props'],
        ['', 'http://localhost:8080/props'],
        [undefined, 'http://localhost:8080/props']
    ]) {
        it(`resolves ${JSON.stringify(input)} to the server root`, async () => {
            assert.equal(await propsUrlFor(input), expected);
        });
    }

    it('posts chat completions under /v1 of the normalized root', async () => {
        const provider = new LlamaCppProvider();
        const contents = [{ role: 'user', parts: [{ text: 'Hello' }] }];
        for await (const _ of provider.generateContentStream({ baseUrl: 'http://llama.test/v1/', modelId: 'm' }, contents, '', {})) { /* drain */ }
        assert.deepEqual(fetchedUrls, ['http://llama.test/v1/chat/completions']);
    });

    it('shares one /props cache entry across spellings of the same server', async () => {
        const provider = new LlamaCppProvider();
        await provider.getAvailableModels({ baseUrl: 'http://llama.test:8080' });
        await provider.getAvailableModels({ baseUrl: 'http://llama.test:8080/' });
        await provider.getAvailableModels({ baseUrl: ' http://llama.test:8080/V1 ' });
        assert.equal(fetchedUrls.filter(u => u.endsWith('/props')).length, 1);
    });

    it('invalidates the cache entry for any spelling of the server', async () => {
        const provider = new LlamaCppProvider();
        await provider.getAvailableModels({ baseUrl: 'http://llama.test:8080' });
        LlamaCppProvider.invalidatePropsCache('http://llama.test:8080/v1/');
        await provider.getAvailableModels({ baseUrl: 'http://llama.test:8080' });
        assert.equal(fetchedUrls.filter(u => u.endsWith('/props')).length, 2);
    });
});
