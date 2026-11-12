import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIProvider } from '../dist/index.js';

const BASE_URL = 'http://openai.test/v1';

const SSE = [
    'data: {"choices":[{"index":0,"delta":{"content":"Hi"}}]}',
    'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}',
    'data: [DONE]',
    ''
].join('\n\n');

let originalFetch;
let chatRequests = [];

beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.endsWith('/chat/completions')) {
            chatRequests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
            return new Response(SSE, { headers: { 'Content-Type': 'text/event-stream' } });
        }
        throw new Error(`Unexpected fetch: ${url}`);
    };
});

afterEach(() => {
    globalThis.fetch = originalFetch;
});

async function generate(additionalSettings = {}, generateConfig = {}, configOverrides = {}) {
    chatRequests = [];
    const provider = new OpenAIProvider();
    const providerConfig = { baseUrl: BASE_URL, apiKey: 'test-key', modelId: 'test-model', additionalSettings, ...configOverrides };
    const contents = [{ role: 'user', parts: [{ text: 'Hello' }] }];
    const chunks = [];
    for await (const chunk of provider.generateContentStream(providerConfig, contents, '', generateConfig)) {
        chunks.push(chunk);
    }
    assert.equal(chatRequests.length, 1);
    return { request: chatRequests[0], body: chatRequests[0].body, chunks };
}

describe('OpenAIProvider request body', () => {
    it('posts to the chat completions endpoint with the API key', async () => {
        const { request } = await generate();
        assert.equal(request.url, `${BASE_URL}/chat/completions`);
        assert.equal(request.headers['Authorization'], 'Bearer test-key');
    });

    it('sends the model, streaming options and sampling settings', async () => {
        const { body } = await generate({}, {}, {
            temperature: 1, frequency_penalty: 0.1, presence_penalty: 0.2, maxOutputTokens: 256
        });
        assert.equal(body.model, 'test-model');
        assert.equal(body.stream, true);
        assert.deepEqual(body.stream_options, { include_usage: true });
        assert.equal(body.temperature, 1);
        assert.equal(body.frequency_penalty, 0.1);
        assert.equal(body.presence_penalty, 0.2);
        assert.equal(body.max_tokens, 256);
        assert.deepEqual(body.messages, [{ role: 'user', content: 'Hello' }]);
    });

    it('omits sampling settings that are not set', async () => {
        const { body } = await generate();
        for (const key of ['temperature', 'frequency_penalty', 'presence_penalty', 'max_tokens']) {
            assert.equal(key in body, false, key);
        }
    });

    it('sends chat_template_kwargs under extra_body when useChatTemplateKwargs is on', async () => {
        const { body } = await generate({ useChatTemplateKwargs: true, enableThinking: true, reasoningEffort: 'high' });
        assert.deepEqual(body.extra_body, {
            chat_template_kwargs: { enable_thinking: true, reasoning_effort: 'high' }
        });
    });

    it('sends no chat_template_kwargs when useChatTemplateKwargs is off', async () => {
        const { body } = await generate({ enableThinking: true });
        assert.equal('chat_template_kwargs' in body, false);
        assert.equal('extra_body' in body, false);
    });

    it('sends a json_schema response_format for a response schema', async () => {
        const schema = { type: 'object', properties: { a: { type: 'string', description: 'x' } } };
        const { body } = await generate({}, { responseSchema: schema });
        assert.deepEqual(body.response_format, {
            type: 'json_schema',
            json_schema: {
                name: 'structured_output',
                strict: true,
                schema: { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false, required: ['a'] }
            }
        });
    });

    it('yields the streamed text and usage', async () => {
        const { chunks } = await generate();
        assert.deepEqual(chunks.filter(c => c.text !== undefined), [{ text: 'Hi' }]);
        assert.deepEqual(chunks.find(c => c.usageMetadata)?.usageMetadata, { prompt: 3, candidates: 1, cached: 0 });
    });
});
