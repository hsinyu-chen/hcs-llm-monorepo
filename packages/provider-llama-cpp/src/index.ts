import {
    LLMProvider,
    LLMProviderCapabilities,
    LLMProviderConfig,
    LLMContent,
    LLMGenerateConfig,
    LLMStreamChunk,
    LLMModelDefinition
} from '@hcs/llm-core';

export class LlamaCppProvider implements LLMProvider {
    readonly providerName = 'llama.cpp';
    settingsComponentId = 'llama-settings';

    private extractConfig(config: LLMProviderConfig) {
        const cleanStr = (val: any) => (typeof val === 'string' && val.trim() === '') ? undefined : val;
        const settings = config.additionalSettings || {};

        return {
            baseUrl: config.baseUrl ? config.baseUrl.replace(/\/$/, '') : 'http://localhost:8080',
            modelId: cleanStr(config.modelId) || 'local-model',
            temperature: cleanStr(config.temperature) as number | undefined,
            frequencyPenalty: cleanStr(config.frequency_penalty) as number | undefined,
            presencePenalty: cleanStr(config.presence_penalty) as number | undefined,
            inputPrice: cleanStr(config.inputPrice) as number | undefined,
            cacheInputPrice: cleanStr(config.cacheInputPrice) as number | undefined,
            outputPrice: cleanStr(config.outputPrice) as number | undefined,
            topP: cleanStr(settings['topP']) as number | undefined,
            topK: cleanStr(settings['topK']) as number | undefined,
            minP: cleanStr(settings['minP']) as number | undefined,
            repetitionPenalty: cleanStr(settings['repetitionPenalty']) as number | undefined,
            enableThinking: (settings['enableThinking'] === undefined ? false : settings['enableThinking']) as boolean,
            reasoningEffort: (settings['reasoningEffort'] === undefined ? 'low' : settings['reasoningEffort']) as string
        };
    }

    isConfigured(config: LLMProviderConfig): boolean {
        return !!(config.baseUrl && config.baseUrl.trim());
    }

    getCapabilities(): LLMProviderCapabilities {
        return {
            supportsContextCaching: true,
            supportsThinking: true,
            supportsStructuredOutput: true,
            isLocalProvider: true,
            supportsSpeedMetrics: true
        };
    }

    async getAvailableModels(config: LLMProviderConfig): Promise<LLMModelDefinition[]> {
        const c = this.extractConfig(config);
        let modelId = c.modelId;

        // Auto-fetch if default
        if (modelId === 'local-model' || !modelId) {
            const alias = await this.fetchModelAlias(c.baseUrl);
            if (alias) modelId = alias;
        }

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

    private async fetchModelAlias(baseUrl: string): Promise<string | null> {
        try {
            const response = await fetch(`${baseUrl}/props`);
            if (response.ok) {
                const data = await response.json();
                if (data.model_alias) return data.model_alias;
                if (data.model_path) {
                    return data.model_path.split(/[/\\]/).pop() || data.model_path;
                }
            }
        } catch {}
        return null;
    }

    getDefaultModelId(): string {
        return 'local-model';
    }

    async *generateContentStream(
        providerConfig: LLMProviderConfig,
        contents: LLMContent[],
        systemInstruction: string,
        config: LLMGenerateConfig
    ): AsyncGenerator<LLMStreamChunk> {
        const c = this.extractConfig(providerConfig);
        const baseUrl = c.baseUrl;
        let modelId = c.modelId;

        if (modelId === 'local-model' || !modelId) {
            const alias = await this.fetchModelAlias(baseUrl);
            if (alias) modelId = alias;
        }

        const messages: any[] = [
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
        } catch {}

        const reasoningBudgetMap: Record<string, number> = { low: 512, medium: 2048, high: 8192 };
        const thinkingEnabled = c.enableThinking;
        const reasoningBudget = thinkingEnabled ? (reasoningBudgetMap[c.reasoningEffort] ?? 2048) : 0;

        const requestBody: Record<string, unknown> = {
            model: modelId,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            return_progress: true,
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

            if (!response.ok) throw new Error(`llama.cpp OAI error (${response.status})`);
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (value) buffer += decoder.decode(value, { stream: true });
                    if (done && buffer.trim()) buffer += '\n';

                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const delta = data.choices?.[0]?.delta;
                            if (delta?.content) yield { text: delta.content };
                            if (delta?.reasoning_content) yield { text: delta.reasoning_content, thought: true };

                            if (data.usage || data.timings || data.prompt_progress) {
                                const usage = data.usage;
                                const timings = data.timings;
                                const progress = data.prompt_progress;
                                yield {
                                    usageMetadata: {
                                        prompt: (timings?.prompt_n ?? usage?.prompt_tokens ?? progress?.total) || 0,
                                        candidates: (timings?.predicted_n ?? usage?.completion_tokens) || 0,
                                        cached: (timings?.cache_n ?? usage?.prompt_tokens_details?.cached_tokens ?? progress?.cache) || 0,
                                        promptSpeed: timings?.prompt_per_second ?? (progress?.time_ms ? (progress.processed / (progress.time_ms / 1000)) : undefined),
                                        completionSpeed: timings?.predicted_per_second,
                                        promptProgress: progress && progress.total > 0 ? (progress.processed / progress.total) : undefined,
                                        promptTotal: progress?.total,
                                        promptProcessed: progress?.processed,
                                        promptCache: progress?.cache
                                    }
                                };
                            }
                        } catch {}
                    }
                    if (done) break;
                }
            } finally { reader.releaseLock(); }
        } catch (error) { throw error; }
    }

    async countTokens(providerConfig: LLMProviderConfig, _modelId: string, contents: LLMContent[]): Promise<number> {
        const baseUrl = this.extractConfig(providerConfig).baseUrl;
        const text = contents.flatMap(c => c.parts).map(p => p.text || '').join('\n');
        if (!text) return 0;
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
        } catch {}
        return Math.ceil(text.length / 3.5);
    }

    private prepareSchema(schema: any): any {
        if (!schema || typeof schema !== 'object') return schema;
        const result = JSON.parse(JSON.stringify(schema)); 
        const process = (obj: any) => {
            if (obj.type === 'object' && obj.properties) {
                obj.additionalProperties = false;
                obj.required = Object.keys(obj.properties);
                for (const key in obj.properties) process(obj.properties[key]);
            } else if (obj.type === 'array' && obj.items) {
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
