import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LLAMA_DEFAULT_REASONING_EFFORT, LLAMA_REASONING_BUDGETS, LlamaCppProvider, resolveLlamaReasoningEffort } from '../dist/index.js';

const BASE_URL = 'http://llama.test';

const SSE = [
    'data: {"choices":[{"index":0,"delta":{"content":"Hi"}}]}',
    'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1}}',
    'data: [DONE]',
    ''
].join('\n\n');

let originalFetch;
let chatBodies = [];

beforeEach(() => {
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.endsWith('/chat/completions')) {
            chatBodies.push(JSON.parse(init.body));
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

async function generate(additionalSettings = {}, generateConfig = {}, configOverrides = {}) {
    chatBodies = [];
    const provider = new LlamaCppProvider();
    const providerConfig = { baseUrl: BASE_URL, modelId: 'test-model', additionalSettings, ...configOverrides };
    const contents = [{ role: 'user', parts: [{ text: 'Hello' }] }];
    const chunks = [];
    for await (const chunk of provider.generateContentStream(providerConfig, contents, '', generateConfig)) {
        chunks.push(chunk);
    }
    assert.equal(chatBodies.length, 1);
    return { body: chatBodies[0], chunks };
}

describe('LlamaCppProvider request body', () => {
    it('sends the model, streaming options and sampling settings', async () => {
        const { body } = await generate(
            { topP: 0.95, topK: 64, minP: 0.05 },
            {},
            { temperature: 1, frequency_penalty: 0.1, presence_penalty: 0.2 }
        );
        assert.equal(body.model, 'test-model');
        assert.equal(body.stream, true);
        assert.deepEqual(body.stream_options, { include_usage: true });
        assert.equal(body.cache_prompt, true);
        assert.equal(body.temperature, 1);
        assert.equal(body.frequency_penalty, 0.1);
        assert.equal(body.presence_penalty, 0.2);
        assert.equal(body.top_p, 0.95);
        assert.equal(body.top_k, 64);
        assert.equal(body.min_p, 0.05);
        assert.deepEqual(body.messages, [{ role: 'user', content: 'Hello' }]);
    });

    it('omits sampling settings that are not set', async () => {
        const { body } = await generate();
        for (const key of ['temperature', 'frequency_penalty', 'presence_penalty', 'top_p', 'top_k', 'min_p']) {
            assert.equal(key in body, false, key);
        }
    });

    it('sends the repetition penalty setting as repeat_penalty', async () => {
        const { body } = await generate({ repetitionPenalty: 1.1 });
        assert.equal(body.repeat_penalty, 1.1);
        assert.equal('repetition_penalty' in body, false);
    });

    it('omits repeat_penalty when the repetition penalty is not set', async () => {
        const { body } = await generate();
        assert.equal('repeat_penalty' in body, false);
    });

    it('sends enable_thinking in chat_template_kwargs', async () => {
        assert.deepEqual((await generate({ enableThinking: true })).body.chat_template_kwargs, { enable_thinking: true });
        assert.deepEqual((await generate()).body.chat_template_kwargs, { enable_thinking: false });
    });

    it('sends reasoning_budget_tokens for each reasoning effort when thinking is on', async () => {
        const expected = { low: 512, medium: 2048, high: 8192, unknown: 2048, toString: 2048 };
        for (const [reasoningEffort, budget] of Object.entries(expected)) {
            const { body } = await generate({ enableThinking: true, reasoningEffort });
            assert.equal(body.reasoning_budget_tokens, budget, reasoningEffort);
            assert.equal('reasoning_budget' in body, false, reasoningEffort);
        }
    });

    it('exports the budget table and the medium default', () => {
        assert.deepEqual(LLAMA_REASONING_BUDGETS, { low: 512, medium: 2048, high: 8192 });
        assert.equal(LLAMA_DEFAULT_REASONING_EFFORT, 'medium');
    });

    it('resolves each tier to itself and any other value to the default', () => {
        for (const effort of ['low', 'medium', 'high']) {
            assert.equal(resolveLlamaReasoningEffort(effort), effort);
        }
        for (const value of [undefined, null, '', 'minimal', 'toString', 2048]) {
            assert.equal(resolveLlamaReasoningEffort(value), LLAMA_DEFAULT_REASONING_EFFORT, String(value));
        }
    });

    it('defaults reasoning_budget_tokens to the medium effort when thinking is on', async () => {
        const { body } = await generate({ enableThinking: true });
        assert.equal(body.reasoning_budget_tokens, 2048);
    });

    it('sends no reasoning budget when thinking is off', async () => {
        for (const settings of [{}, { enableThinking: false, reasoningEffort: 'high' }]) {
            const { body } = await generate(settings);
            for (const key of ['reasoning_budget_tokens', 'thinking_budget_tokens', 'reasoning_budget']) {
                assert.equal(key in body, false, key);
            }
        }
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
        const usage = chunks.find(c => c.usageMetadata)?.usageMetadata;
        assert.equal(usage.prompt, 3);
        assert.equal(usage.candidates, 1);
    });
});
