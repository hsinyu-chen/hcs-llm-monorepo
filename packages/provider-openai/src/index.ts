import {
    LLMProvider,
    LLMProviderCapabilities,
    LLMProviderConfig,
    LLMContent,
    LLMFunctionCall,
    LLMGenerateConfig,
    LLMStreamChunk,
    LLMModelDefinition
} from '@hcs/llm-core';

interface OpenAIToolCallAccumulator {
    id: string;
    name: string;
    argsBuffer: string;
}

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

    getCapabilities(config?: LLMProviderConfig): LLMProviderCapabilities {
        // OpenAI provider also fronts OpenRouter / Together / self-hosted
        // proxies, where tool-call support varies. Read the per-profile
        // override; default to true since the major modern endpoints
        // (api.openai.com, OpenRouter, Together) all support tools.
        const flag = config?.additionalSettings?.['supportsNativeToolCalls'];
        const supportsNativeToolCalls = typeof flag === 'boolean' ? flag : true;
        // Parallel tool calls follow the same default — modern OpenAI models
        // and major proxies support them; users can pin No on legacy
        // endpoints via additionalSettings.supportsParallelToolCalls.
        const parallelFlag = config?.additionalSettings?.['supportsParallelToolCalls'];
        const supportsParallelToolCalls = typeof parallelFlag === 'boolean'
            ? parallelFlag
            : supportsNativeToolCalls;
        return {
            supportsContextCaching: false,
            supportsThinking: false,
            supportsStructuredOutput: true,
            isLocalProvider: false,
            supportsSpeedMetrics: false,
            supportsNativeToolCalls,
            supportsParallelToolCalls
        };
    }

    /**
     * Convert LLMContent[] to OpenAI chat-completions messages, expanding
     * function-call/response parts into native `tool_calls` (assistant) and
     * `role:'tool'` messages. A single LLMContent that mixes text and tool
     * calls is split into multiple OpenAI messages preserving original order.
     */
    private toOpenAIMessages(systemInstruction: string, contents: LLMContent[]): any[] {
        const messages: any[] = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }

        for (const con of contents) {
            const role = con.role === 'model' ? 'assistant' : con.role;

            if (role === 'user') {
                // User messages may carry functionResponse parts (tool results).
                // Each functionResponse becomes its own role:'tool' message.
                const textParts: string[] = [];
                for (const p of con.parts) {
                    if (p.functionResponse) {
                        messages.push({
                            role: 'tool',
                            tool_call_id: p.functionResponse.id || p.functionResponse.name,
                            content: typeof p.functionResponse.response === 'string'
                                ? p.functionResponse.response
                                : JSON.stringify(p.functionResponse.response)
                        });
                    } else if (p.text) {
                        textParts.push(p.text);
                    }
                }
                if (textParts.length > 0) {
                    messages.push({ role: 'user', content: textParts.join('\n') });
                }
                continue;
            }

            // assistant: may carry text + functionCall parts together.
            const textParts: string[] = [];
            const toolCalls: any[] = [];
            for (const p of con.parts) {
                if (p.thought) continue; // OpenAI has no analogue for thought parts.
                if (p.functionCall) {
                    toolCalls.push({
                        id: p.functionCall.id || `call_${toolCalls.length}_${p.functionCall.name}`,
                        type: 'function',
                        function: {
                            name: p.functionCall.name,
                            arguments: JSON.stringify(p.functionCall.args ?? {})
                        }
                    });
                } else if (p.text) {
                    textParts.push(p.text);
                }
            }
            const msg: any = { role: 'assistant' };
            if (textParts.length > 0) msg.content = textParts.join('\n');
            else if (toolCalls.length > 0) msg.content = null;
            if (toolCalls.length > 0) msg.tool_calls = toolCalls;
            messages.push(msg);
        }

        return messages;
    }

    getAvailableModels(config: LLMProviderConfig): LLMModelDefinition[] | Promise<LLMModelDefinition[]> {
        const c = this.extractConfig(config);
        const rates = () => ({
            input: c.inputPrice ?? 0,
            cached: c.cacheInputPrice ?? 0,
            output: c.outputPrice ?? 0
        });

        // Known public OpenAI context sizes. Pricing is intentionally left to
        // user-entered values because the OpenAI provider is used for any
        // OpenAI-compatible endpoint (OpenRouter, Together, local proxies, …)
        // where the rate card differs from the upstream.
        const presets: LLMModelDefinition[] = [
            { id: 'gpt-4o',        name: 'GPT-4o',        contextSize: 128_000, getRates: rates },
            { id: 'gpt-4o-mini',   name: 'GPT-4o mini',   contextSize: 128_000, getRates: rates },
            { id: 'gpt-4-turbo',   name: 'GPT-4 Turbo',   contextSize: 128_000, getRates: rates },
            { id: 'gpt-4',         name: 'GPT-4',         contextSize: 8_192,   getRates: rates },
            { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', contextSize: 16_385,  getRates: rates },
            { id: 'o1',            name: 'o1',            contextSize: 200_000, getRates: rates },
            { id: 'o1-mini',       name: 'o1 mini',       contextSize: 128_000, getRates: rates },
            { id: 'o3-mini',       name: 'o3 mini',       contextSize: 200_000, getRates: rates }
        ];

        // Surface the user-typed custom model id if it doesn't match a preset
        // so the cost / model-lookup pipeline resolves it.
        if (c.modelId && !presets.find(p => p.id === c.modelId)) {
            presets.push({
                id: c.modelId,
                name: `Custom: ${c.modelId}`,
                getRates: rates
            });
        }

        return presets;
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

        const messages = this.toOpenAIMessages(systemInstruction, contents);

        const tools = config.tools && config.tools.length > 0
            ? config.tools.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters
                }
            }))
            : undefined;

        const requestBody: Record<string, unknown> = {
            model: c.modelId,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            ...(c.temperature != null ? { temperature: c.temperature } : {}),
            ...(c.frequencyPenalty != null ? { frequency_penalty: c.frequencyPenalty } : {}),
            ...(c.presencePenalty != null ? { presence_penalty: c.presencePenalty } : {}),
            ...(c.maxOutputTokens != null ? { max_tokens: c.maxOutputTokens } : {}),
            ...(tools ? { tools } : {}),
            ...(config.toolConfig ? { tool_choice: config.toolConfig } : {}),
            ...(config.responseSchema && !tools ? {
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
            const toolCallAcc: Record<number, OpenAIToolCallAccumulator> = {};

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
                            const finishReason = data.choices?.[0]?.finish_reason;

                            if (delta?.content) {
                                yield { text: delta.content };
                            }

                            if (delta?.reasoning_content) {
                                yield { text: delta.reasoning_content, thought: true };
                            }

                            if (Array.isArray(delta?.tool_calls)) {
                                for (const tc of delta.tool_calls) {
                                    const idx = tc.index ?? 0;
                                    const acc = toolCallAcc[idx] ??= { id: '', name: '', argsBuffer: '' };
                                    if (tc.id) acc.id = tc.id;
                                    if (tc.function?.name) acc.name = tc.function.name;
                                    if (tc.function?.arguments) acc.argsBuffer += tc.function.arguments;
                                }
                            }

                            if (finishReason === 'tool_calls' || (finishReason && Object.keys(toolCallAcc).length > 0)) {
                                for (const acc of Object.values(toolCallAcc)) {
                                    yield { functionCall: this.finalizeToolCall(acc) };
                                }
                                for (const k of Object.keys(toolCallAcc)) delete toolCallAcc[k as unknown as number];
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

                // Flush any remaining tool_calls if the stream ended without a finish_reason event.
                for (const acc of Object.values(toolCallAcc)) {
                    yield { functionCall: this.finalizeToolCall(acc) };
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

    private finalizeToolCall(acc: OpenAIToolCallAccumulator): LLMFunctionCall {
        let parsed: Record<string, unknown> = {};
        if (acc.argsBuffer) {
            try { parsed = JSON.parse(acc.argsBuffer); }
            catch { parsed = { _raw: acc.argsBuffer }; }
        }
        return { id: acc.id || undefined, name: acc.name, args: parsed };
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
