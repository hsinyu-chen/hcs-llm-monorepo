import {
    LLMProvider,
    LLMProviderCapabilities,
    LLMProviderConfig,
    LLMContent,
    LLMGenerateConfig,
    LLMStreamChunk,
    LLMModelDefinition
} from '@hcs/llm-core';

export class OpenAIProvider implements LLMProvider {
    readonly providerName = 'openai';
    settingsComponentId = 'openai-settings';

    private extractConfig(config: LLMProviderConfig) {
        const cleanStr = (val: any) => (typeof val === 'string' && val.trim() === '') ? undefined : val;
        const settings = config.additionalSettings || {};

        return {
            baseUrl: config.baseUrl ? config.baseUrl.replace(/\/$/, '') : 'https://api.openai.com/v1',
            apiKey: config.apiKey || '',
            modelId: cleanStr(config.modelId) || 'gpt-4o',
            temperature: cleanStr(config.temperature) as number | undefined,
            frequencyPenalty: cleanStr(config.frequency_penalty) as number | undefined,
            presencePenalty: cleanStr(config.presence_penalty) as number | undefined,
            maxOutputTokens: cleanStr(config.maxOutputTokens) as number | undefined,
            inputPrice: cleanStr(config.inputPrice) as number | undefined,
            cacheInputPrice: cleanStr(config.cacheInputPrice) as number | undefined,
            outputPrice: cleanStr(config.outputPrice) as number | undefined,
            useChatTemplateKwargs: (settings['useChatTemplateKwargs'] === undefined ? false : settings['useChatTemplateKwargs']) as boolean,
            enableThinking: (settings['enableThinking'] === undefined ? false : settings['enableThinking']) as boolean,
            reasoningEffort: (settings['reasoningEffort'] === undefined ? 'low' : settings['reasoningEffort']) as string
        };
    }

    isConfigured(config: LLMProviderConfig): boolean {
        return !!(config.apiKey && config.apiKey.trim()) && !!(config.baseUrl && config.baseUrl.trim());
    }

    getCapabilities(): LLMProviderCapabilities {
        return {
            supportsContextCaching: false,
            supportsThinking: false,
            supportsStructuredOutput: true,
            isLocalProvider: false,
            supportsSpeedMetrics: false
        };
    }

    getAvailableModels(config: LLMProviderConfig): LLMModelDefinition[] | Promise<LLMModelDefinition[]> {
        const c = this.extractConfig(config);
        const id = c.modelId;
        return [
            {
                id: id,
                name: `OpenAI: ${id}`,
                getRates: () => ({
                    input: c.inputPrice ?? 0,
                    cached: c.cacheInputPrice ?? 0,
                    output: c.outputPrice ?? 0
                })
            }
        ];
    }

    getDefaultModelId(): string {
        return 'gpt-4o';
    }

    async *generateContentStream(
        providerConfig: LLMProviderConfig,
        contents: LLMContent[],
        systemInstruction: string,
        config: LLMGenerateConfig
    ): AsyncGenerator<LLMStreamChunk> {
        const c = this.extractConfig(providerConfig);
        const baseUrl = c.baseUrl;
        const apiKey = c.apiKey;

        const messages = [
            { role: 'system', content: systemInstruction },
            ...contents.map(con => ({
                role: con.role === 'model' ? 'assistant' : con.role,
                content: con.parts.map(p => p.text || '').join('\n')
            }))
        ];

        const requestBody: Record<string, unknown> = {
            model: c.modelId,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            ...(c.temperature != null ? { temperature: c.temperature } : {}),
            ...(c.frequencyPenalty != null ? { frequency_penalty: c.frequencyPenalty } : {}),
            ...(c.presencePenalty != null ? { presence_penalty: c.presencePenalty } : {}),
            ...(c.maxOutputTokens != null ? { max_tokens: c.maxOutputTokens } : {}),
            ...(config.responseSchema ? {
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'structured_output',
                        strict: true,
                        schema: this.prepareSchema(config.responseSchema)
                    }
                },
            } : {}),
            ...(c.useChatTemplateKwargs ? {
                extra_body: {
                    chat_template_kwargs: {
                        enable_thinking: c.enableThinking,
                        reasoning_effort: c.reasoningEffort
                    }
                }
            } : {})
        };

        try {
            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody),
                signal: config.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
            }

            if (!response.body) throw new Error('No response body from server.');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]') continue;
                        if (!trimmed.startsWith('data: ')) continue;

                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const delta = data.choices?.[0]?.delta;

                            if (delta?.content) {
                                yield { text: delta.content };
                            }

                            if (delta?.reasoning_content) {
                                yield { text: delta.reasoning_content, thought: true };
                            }

                            if (data.usage) {
                                const usage = data.usage;
                                yield {
                                    usageMetadata: {
                                        prompt: usage.prompt_tokens || 0,
                                        candidates: usage.completion_tokens || 0,
                                        cached: usage.prompt_tokens_details?.cached_tokens || 0
                                    }
                                };
                            }
                        } catch {}
                    }
                }
            } finally {
                reader.releaseLock();
            }
        } catch (error) {
            console.error('OpenAI generation failed:', error);
            throw error;
        }
    }

    async countTokens(providerConfig: LLMProviderConfig, _modelId: string, contents: LLMContent[]): Promise<number> {
        const text = contents.flatMap(c => c.parts).map(p => p.text || '').join('\n');
        return Math.ceil(text.length / 4);
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
