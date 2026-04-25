import { 
    GoogleGenAI, 
    ThinkingLevel, 
    Content, 
    Part, 
    CachedContent, 
    CreateCachedContentParameters, 
    CreateCachedContentConfig, 
    GenerateContentParameters, 
    GenerateContentConfig, 
    Tool, 
    HarmCategory, 
    HarmBlockThreshold, 
    Schema 
} from '@google/genai';
import {
    LLMProvider,
    LLMProviderCapabilities,
    LLMProviderConfig,
    LLMContent,
    LLMPart,
    LLMFunctionDeclaration,
    LLMGenerateConfig,
    LLMStreamChunk,
    LLMModelDefinition,
    LLMCacheInfo
} from '@hcs/llm-core';

interface ExtendedThinkingConfig {
    includeThoughts?: boolean;
    thinkingLevel?: ThinkingLevel;
    thinkingBudget?: number;
}

export const DEFAULT_GEMINI_MODEL_ID = 'gemini-3-flash-preview';

export class GeminiProvider implements LLMProvider {
    readonly providerName = 'gemini';
    settingsComponentId = 'gemini-settings';

    private readonly defaultTools: Tool[] = [];

    private toGeminiContent(content: LLMContent): Content {
        return {
            role: content.role === 'system' ? 'user' : content.role,
            parts: content.parts.map(p => this.toGeminiPart(p))
        };
    }

    private toGeminiPart(part: LLMPart): Part {
        const result: Part = {};
        if (part.text !== undefined) result.text = part.text;
        if (part.functionCall) {
            result.functionCall = {
                name: part.functionCall.name,
                args: part.functionCall.args
            };
        }
        if (part.functionResponse) {
            result.functionResponse = {
                name: part.functionResponse.name,
                response: part.functionResponse.response
            };
        }
        return result;
    }

    getCapabilities(_config?: LLMProviderConfig): LLMProviderCapabilities {
        // All Gemini models support native function calling — no per-config branch.
        return {
            supportsContextCaching: true,
            supportsThinking: true,
            supportsStructuredOutput: true,
            isLocalProvider: false,
            supportsSpeedMetrics: false,
            cacheBakesContent: true,
            supportsNativeToolCalls: true,
            supportsParallelToolCalls: true
        };
    }

    private buildToolsParam(tools: LLMFunctionDeclaration[] | undefined): Tool[] {
        if (!tools || tools.length === 0) return this.defaultTools;
        return [{
            functionDeclarations: tools.map(t => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters as Schema
            }))
        }];
    }

    getAvailableModels(config: LLMProviderConfig): LLMModelDefinition[] | Promise<LLMModelDefinition[]> {
        return [
            {
                id: 'gemini-3.1-pro-preview',
                name: 'Gemini 3.1 Pro Preview',
                contextSize: 1_048_576,
                supportsThinking: true,
                allowedThinkingLevels: ['low', 'high'],
                getRates: (prompt = 0) => {
                    const isLong = prompt > 200000;
                    return {
                        input: isLong ? 4.00 : 2.00,
                        output: isLong ? 18.00 : 12.00,
                        cached: isLong ? 0.40 : 0.20,
                        cacheStorage: 4.50
                    };
                }
            },
            {
                id: 'gemini-3-pro-preview',
                name: 'Gemini 3 Pro Preview',
                contextSize: 1_048_576,
                supportsThinking: true,
                allowedThinkingLevels: ['low', 'high'],
                getRates: (prompt = 0) => {
                    const isLong = prompt > 200000;
                    return {
                        input: isLong ? 4.00 : 2.00,
                        output: isLong ? 18.00 : 12.00,
                        cached: isLong ? 0.40 : 0.20,
                        cacheStorage: 4.50
                    };
                }
            },
            {
                id: 'gemini-3-flash-preview',
                name: 'Gemini 3 Flash Preview',
                contextSize: 1_048_576,
                supportsThinking: true,
                allowedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
                getRates: () => ({
                    input: 0.50,
                    output: 3.00,
                    cached: 0.05,
                    cacheStorage: 1.00
                })
            },
            {
                id: 'gemini-3.1-flash-lite-preview',
                name: 'Gemini 3.1 Flash Lite Preview',
                contextSize: 1_048_576,
                supportsThinking: true,
                allowedThinkingLevels: ['minimal', 'low', 'medium', 'high'],
                getRates: () => ({
                    input: 0.25,
                    output: 1.50,
                    cached: 0.025,
                    cacheStorage: 1.00
                })
            },
            {
                id: 'gemini-2.5-flash-lite',
                name: 'Gemini 2.5 Flash-Lite',
                contextSize: 1_048_576,
                supportsThinking: true,
                thinkingBudgetLevelMapping: {
                    minimal: 1024,
                    low: 4096,
                    medium: 12288,
                    high: 24576
                },
                getRates: () => ({
                    input: 0.10,
                    output: 0.40,
                    cached: 0.01,
                    cacheStorage: 1.00
                })
            },
            {
                id: 'gemini-2.5-flash',
                name: 'Gemini 2.5 Flash',
                contextSize: 1_048_576,
                supportsThinking: true,
                thinkingBudgetLevelMapping: {
                    minimal: 1024,
                    low: 4096,
                    medium: 12288,
                    high: 24576
                },
                getRates: () => ({
                    input: 0.30,
                    output: 2.50,
                    cached: 0.03,
                    cacheStorage: 1.00
                })
            }
        ];
    }

    getDefaultModelId(): string {
        return DEFAULT_GEMINI_MODEL_ID;
    }

    private getClient(config: LLMProviderConfig): GoogleGenAI {
        if (!config.apiKey) throw new Error('Gemini API key is required');
        return new GoogleGenAI({ apiKey: config.apiKey });
    }

    private getModelId(config: LLMProviderConfig): string {
        return config.modelId || DEFAULT_GEMINI_MODEL_ID;
    }

    isConfigured(config: LLMProviderConfig): boolean {
        return !!(config.apiKey && config.apiKey.trim());
    }

    async *generateContentStream(
        config: LLMProviderConfig,
        contents: LLMContent[],
        systemInstruction: string,
        genConfig: LLMGenerateConfig
    ): AsyncGenerator<LLMStreamChunk> {
        const geminiContents = contents.map(c => this.toGeminiContent(c));
        const stream = await this.sendMessageStream(config, geminiContents, systemInstruction, genConfig);

        for await (const chunk of stream) {
            if (genConfig.signal?.aborted) return;

            const candidate = chunk.candidates?.[0];
            const finishReason = candidate?.finishReason;

            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    const extPart = part as Part & { thought?: boolean; thoughtSignature?: string };
                    const fc = extPart.functionCall;
                    yield {
                        text: extPart.text,
                        thought: extPart.thought,
                        thoughtSignature: extPart.thoughtSignature,
                        functionCall: fc ? {
                            name: fc.name ?? '',
                            args: (fc.args ?? {}) as Record<string, unknown>
                        } : undefined,
                        finishReason,
                        usageMetadata: chunk.usageMetadata ? {
                            prompt: chunk.usageMetadata.promptTokenCount || 0,
                            candidates: chunk.usageMetadata.candidatesTokenCount || 0,
                            cached: chunk.usageMetadata.cachedContentTokenCount || 0
                        } : undefined
                    };
                }
            } else if (finishReason) {
                yield {
                    finishReason,
                    usageMetadata: chunk.usageMetadata ? {
                        prompt: chunk.usageMetadata.promptTokenCount || 0,
                        candidates: chunk.usageMetadata.candidatesTokenCount || 0,
                        cached: chunk.usageMetadata.cachedContentTokenCount || 0
                    } : undefined
                };
            }
        }
    }

    getPreview(contents: LLMContent[]): LLMContent[] {
        return contents.map(content => ({
            ...content,
            parts: content.parts.map(part => {
                const newPart = { ...part };
                delete newPart.thoughtSignature;
                return newPart;
            })
        }));
    }

    async sendMessageStream(
        providerConfig: LLMProviderConfig,
        contents: Content[],
        systemInstruction: string,
        config: LLMGenerateConfig = {}
    ) {
        const client = this.getClient(providerConfig);
        const lastModelId = this.getModelId(providerConfig);
        const cachedContentName = config.cachedContentName;
        const responseSchema = config.responseSchema as Schema;

        const currentModel = (await this.getAvailableModels(providerConfig)).find(m => m.id === lastModelId);
        const modelSupportsThinking = currentModel?.supportsThinking ?? false;

        let currentThinkingLevel: ThinkingLevel = ThinkingLevel.MINIMAL;
        const confLevel = providerConfig.additionalSettings?.['thinkingLevel'];
        if (confLevel) currentThinkingLevel = this.mapThinkingLevel(confLevel as string);

        const modelVersionMatch = lastModelId.match(/gemini-(\d+\.?\d*)/);
        const version = modelVersionMatch ? parseFloat(modelVersionMatch[1]) : 3.0;
        const isLegacyModel = version < 2.5;

        const generationConfig: GenerateContentConfig = {
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE }
            ]
        };

        const maxOutputTokens = config.maxOutputTokens || providerConfig.maxOutputTokens;
        const temperature = config.temperature !== undefined ? config.temperature : providerConfig.temperature;
        const topP = providerConfig.additionalSettings?.['topP'];
        const topK = providerConfig.additionalSettings?.['topK'];
        const presencePenalty = config.presence_penalty !== undefined ? config.presence_penalty : providerConfig.presence_penalty;
        const frequencyPenalty = config.frequency_penalty !== undefined ? config.frequency_penalty : providerConfig.frequency_penalty;

        if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
        if (temperature !== undefined) generationConfig.temperature = temperature as number;
        if (topP !== undefined) generationConfig.topP = topP as number;
        if (topK !== undefined) generationConfig.topK = topK as number;
        if (presencePenalty !== undefined) generationConfig.presencePenalty = presencePenalty as number;

        if (frequencyPenalty !== undefined) {
            generationConfig.frequencyPenalty = frequencyPenalty as number;
        } else if (isLegacyModel) {
            generationConfig.frequencyPenalty = 0.2;
        }

        if (modelSupportsThinking) {
            generationConfig.thinkingConfig = { includeThoughts: true };
            if (currentModel?.thinkingBudgetLevelMapping) {
                const budget = currentModel.thinkingBudgetLevelMapping[currentThinkingLevel];
                if (budget !== undefined) {
                    (generationConfig.thinkingConfig as ExtendedThinkingConfig).thinkingBudget = budget;
                }
            } else {
                generationConfig.thinkingConfig.thinkingLevel = currentThinkingLevel;
            }
        }

        if (systemInstruction && !cachedContentName) {
            generationConfig.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        if (cachedContentName) {
            generationConfig.cachedContent = cachedContentName;
        } else {
            generationConfig.tools = this.buildToolsParam(config.tools);
        }

        if (responseSchema) generationConfig.responseMimeType = "application/json";
        if (config.responseMimeType && !responseSchema) generationConfig.responseMimeType = config.responseMimeType;
        if (responseSchema) generationConfig.responseSchema = responseSchema;
        if (config.toolConfig && !cachedContentName) generationConfig.toolConfig = config.toolConfig;

        const request: GenerateContentParameters = {
            model: lastModelId,
            contents: contents,
            config: generationConfig
        };

        return await client.models.generateContentStream(request);
    }

    async countTokens(config: LLMProviderConfig, model: string, contents: LLMContent[]): Promise<number> {
        let client;
        try { client = this.getClient(config); } catch { return 0; }
        const geminiContents = contents.map(c => this.toGeminiContent(c));
        try {
            const response = await client.models.countTokens({ model, contents: geminiContents });
            return response.totalTokens || 0;
        } catch (e) {
            console.warn('Failed to count tokens:', e);
            return 0;
        }
    }

    async createCache(config: LLMProviderConfig, modelId: string, systemInstruction: string, contents: LLMContent[], ttlSeconds: number): Promise<LLMCacheInfo | null> {
        let client;
        try { client = this.getClient(config); } catch { return null; }
        const geminiContents = contents.map(c => this.toGeminiContent(c));
        try {
            const params: CreateCachedContentParameters = {
                model: modelId,
                config: {
                    contents: geminiContents,
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    tools: this.defaultTools,
                    ttl: ttlSeconds + ' s'
                }
            };
            const cache = await client.caches.create(params);
            return {
                name: cache.name || '',
                displayName: cache.displayName || undefined,
                model: cache.model || '',
                createTime: cache.createTime ? new Date(cache.createTime).getTime() : undefined,
                expireTime: cache.expireTime ? new Date(cache.expireTime).getTime() : undefined,
                usageMetadata: cache.usageMetadata ? { totalTokenCount: cache.usageMetadata.totalTokenCount || 0 } : undefined
            };
        } catch (e) {
            console.warn('Cache creation failed:', e);
            return null;
        }
    }

    async getCache(config: LLMProviderConfig, name: string): Promise<LLMCacheInfo | null> {
        let client;
        try { client = this.getClient(config); } catch { return null; }
        try {
            const cache = await client.caches.get({ name });
            return {
                name: cache.name || '',
                displayName: cache.displayName || undefined,
                model: cache.model || '',
                createTime: cache.createTime ? new Date(cache.createTime).getTime() : undefined,
                expireTime: cache.expireTime ? new Date(cache.expireTime).getTime() : undefined,
                usageMetadata: cache.usageMetadata ? { totalTokenCount: cache.usageMetadata.totalTokenCount || 0 } : undefined
            };
        } catch (e) { return null; }
    }

    async updateCacheTTL(config: LLMProviderConfig, name: string, ttlSeconds: number): Promise<LLMCacheInfo | null> {
        let client;
        try { client = this.getClient(config); } catch { return null; }
        try {
            const cache = await client.caches.update({ name, config: { ttl: ttlSeconds + ' s' } });
            return {
                name: cache.name || '',
                displayName: cache.displayName || undefined,
                model: cache.model || '',
                createTime: cache.createTime ? new Date(cache.createTime).getTime() : undefined,
                expireTime: cache.expireTime ? new Date(cache.expireTime).getTime() : undefined,
                usageMetadata: cache.usageMetadata ? { totalTokenCount: cache.usageMetadata.totalTokenCount || 0 } : undefined
            };
        } catch (e) { return null; }
    }

    async deleteCache(config: LLMProviderConfig, name: string): Promise<void> {
        let client;
        try { client = this.getClient(config); } catch { return; }
        try { await client.caches.delete({ name }); } catch (e) {}
    }

    async deleteAllCaches(config: LLMProviderConfig): Promise<number> {
        let client;
        try { client = this.getClient(config); } catch { return 0; }
        let count = 0;
        try {
            const list = await client.caches.list();
            for await (const cache of list) {
                if (cache.name) {
                    try {
                        await client.caches.delete({ name: cache.name });
                        count++;
                    } catch (e) {}
                }
            }
        } catch (e) {}
        return count;
    }

    private mapThinkingLevel(level: string): ThinkingLevel {
        switch (level.toLowerCase()) {
            case 'minimal': return ThinkingLevel.MINIMAL;
            case 'low': return ThinkingLevel.LOW;
            case 'medium': return ThinkingLevel.MEDIUM;
            case 'high': return ThinkingLevel.HIGH;
            default: return ThinkingLevel.HIGH;
        }
    }
}
