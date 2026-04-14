"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlamaCppProvider = void 0;
class LlamaCppProvider {
    providerName = 'llama.cpp';
    settingsComponentId = 'llama-settings';
    extractConfig(config) {
        const cleanStr = (val) => (typeof val === 'string' && val.trim() === '') ? undefined : val;
        const settings = config.additionalSettings || {};
        return {
            baseUrl: config.baseUrl ? config.baseUrl.replace(/\/$/, '') : 'http://localhost:8080',
            modelId: cleanStr(config.modelId) || 'local-model',
            temperature: cleanStr(config.temperature),
            frequencyPenalty: cleanStr(config.frequency_penalty),
            presencePenalty: cleanStr(config.presence_penalty),
            inputPrice: cleanStr(config.inputPrice),
            cacheInputPrice: cleanStr(config.cacheInputPrice),
            outputPrice: cleanStr(config.outputPrice),
            topP: cleanStr(settings['topP']),
            topK: cleanStr(settings['topK']),
            minP: cleanStr(settings['minP']),
            repetitionPenalty: cleanStr(settings['repetitionPenalty']),
            enableThinking: (settings['enableThinking'] === undefined ? false : settings['enableThinking']),
            reasoningEffort: (settings['reasoningEffort'] === undefined ? 'low' : settings['reasoningEffort'])
        };
    }
    isConfigured(config) {
        return !!(config.baseUrl && config.baseUrl.trim());
    }
    getCapabilities() {
        return {
            supportsContextCaching: true,
            supportsThinking: true,
            supportsStructuredOutput: true,
            isLocalProvider: true,
            supportsSpeedMetrics: true
        };
    }
    getAvailableModels(config) {
        const c = this.extractConfig(config);
        const modelId = c.modelId;
        return [
            {
                id: modelId,
                name: `Local Model (${modelId})`,
                getRates: () => ({
                    input: c.inputPrice ?? 0,
                    output: c.outputPrice ?? 0,
                    cached: c.cacheInputPrice ?? 0,
                    cacheStorage: 0
                })
            }
        ];
    }
    getDefaultModelId() {
        return 'local-model';
    }
    async *generateContentStream(providerConfig, contents, systemInstruction, config) {
        const c = this.extractConfig(providerConfig);
        const baseUrl = c.baseUrl;
        const messages = [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            ...contents.map(con => ({
                role: con.role === 'model' ? 'assistant' : con.role,
                content: con.parts.map(p => p.text || '').join('\n')
            }))
        ];
        let n_keep = -1;
        try {
            if (systemInstruction) {
                n_keep = await this.countTokens(providerConfig, c.modelId, [
                    { role: 'system', parts: [{ text: systemInstruction }] }
                ]);
            }
        }
        catch { }
        const reasoningBudgetMap = { low: 512, medium: 2048, high: 8192 };
        const thinkingEnabled = c.enableThinking;
        const reasoningBudget = thinkingEnabled ? (reasoningBudgetMap[c.reasoningEffort] ?? 2048) : 0;
        const requestBody = {
            model: c.modelId,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            cache_prompt: true,
            n_keep: n_keep,
            ...(c.temperature != null ? { temperature: c.temperature } : {}),
            ...(c.frequencyPenalty != null ? { frequency_penalty: c.frequencyPenalty } : {}),
            ...(c.presencePenalty != null ? { presence_penalty: c.presencePenalty } : {}),
            ...(c.topP != null ? { top_p: c.topP } : {}),
            ...(c.topK != null ? { top_k: c.topK } : {}),
            ...(c.minP != null ? { min_p: c.minP } : {}),
            ...(c.repetitionPenalty != null ? { repetition_penalty: c.repetitionPenalty } : {}),
            ...(config.responseSchema ? {
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'structured_output',
                        strict: true,
                        schema: this.prepareSchema(config.responseSchema)
                    }
                }
            } : {}),
            chat_template_kwargs: { enable_thinking: thinkingEnabled },
            reasoning_budget: reasoningBudget
        };
        try {
            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: config.signal
            });
            if (!response.ok)
                throw new Error(`llama.cpp OAI error (${response.status})`);
            if (!response.body)
                throw new Error('No response body');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (value)
                        buffer += decoder.decode(value, { stream: true });
                    if (done && buffer.trim())
                        buffer += '\n';
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: '))
                            continue;
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const delta = data.choices?.[0]?.delta;
                            if (delta?.content)
                                yield { text: delta.content };
                            if (delta?.reasoning_content)
                                yield { text: delta.reasoning_content, thought: true };
                            if (data.usage || data.timings) {
                                const usage = data.usage;
                                const timings = data.timings;
                                yield {
                                    usageMetadata: {
                                        prompt: (timings?.prompt_n ?? usage?.prompt_tokens) || 0,
                                        candidates: (timings?.predicted_n ?? usage?.completion_tokens) || 0,
                                        cached: (timings?.cache_n ?? usage?.prompt_tokens_details?.cached_tokens) || 0,
                                        promptSpeed: timings?.prompt_per_second,
                                        completionSpeed: timings?.predicted_per_second
                                    }
                                };
                            }
                        }
                        catch { }
                    }
                    if (done)
                        break;
                }
            }
            finally {
                reader.releaseLock();
            }
        }
        catch (error) {
            throw error;
        }
    }
    async countTokens(providerConfig, _modelId, contents) {
        const baseUrl = this.extractConfig(providerConfig).baseUrl;
        const text = contents.flatMap(c => c.parts).map(p => p.text || '').join('\n');
        if (!text)
            return 0;
        try {
            const response = await fetch(`${baseUrl}/tokenize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text })
            });
            if (response.ok) {
                const data = await response.json();
                return Array.isArray(data.tokens) ? data.tokens.length : 0;
            }
        }
        catch { }
        return Math.ceil(text.length / 3.5);
    }
    prepareSchema(schema) {
        if (!schema || typeof schema !== 'object')
            return schema;
        const result = JSON.parse(JSON.stringify(schema));
        const process = (obj) => {
            if (obj.type === 'object' && obj.properties) {
                obj.additionalProperties = false;
                obj.required = Object.keys(obj.properties);
                for (const key in obj.properties)
                    process(obj.properties[key]);
            }
            else if (obj.type === 'array' && obj.items) {
                process(obj.items);
            }
            delete obj.title;
            delete obj.description;
            delete obj.default;
            delete obj.$schema;
        };
        process(result);
        return result;
    }
}
exports.LlamaCppProvider = LlamaCppProvider;
//# sourceMappingURL=index.js.map