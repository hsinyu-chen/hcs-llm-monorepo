"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiProvider = exports.DEFAULT_GEMINI_MODEL_ID = void 0;
const genai_1 = require("@google/genai");
exports.DEFAULT_GEMINI_MODEL_ID = 'gemini-3-flash-preview';
class GeminiProvider {
    providerName = 'gemini';
    settingsComponentId = 'gemini-settings';
    defaultTools = [];
    toGeminiContent(content) {
        return {
            role: content.role === 'system' ? 'user' : content.role,
            parts: content.parts.map(p => this.toGeminiPart(p))
        };
    }
    toGeminiPart(part) {
        const result = {};
        if (part.text !== undefined)
            result.text = part.text;
        if (part.functionCall)
            result.functionCall = part.functionCall;
        if (part.functionResponse)
            result.functionResponse = part.functionResponse;
        return result;
    }
    getCapabilities() {
        return {
            supportsContextCaching: true,
            supportsThinking: true,
            supportsStructuredOutput: true,
            isLocalProvider: false,
            supportsSpeedMetrics: false
        };
    }
    getAvailableModels(config) {
        return [
            {
                id: 'gemini-3.1-pro-preview',
                name: 'Gemini 3.1 Pro Preview',
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
    getDefaultModelId() {
        return exports.DEFAULT_GEMINI_MODEL_ID;
    }
    getClient(config) {
        if (!config.apiKey)
            throw new Error('Gemini API key is required');
        return new genai_1.GoogleGenAI({ apiKey: config.apiKey });
    }
    getModelId(config) {
        return config.modelId || exports.DEFAULT_GEMINI_MODEL_ID;
    }
    isConfigured(config) {
        return !!(config.apiKey && config.apiKey.trim());
    }
    async *generateContentStream(config, contents, systemInstruction, genConfig) {
        const geminiContents = contents.map(c => this.toGeminiContent(c));
        const stream = await this.sendMessageStream(config, geminiContents, systemInstruction, genConfig);
        for await (const chunk of stream) {
            if (genConfig.signal?.aborted)
                return;
            const candidate = chunk.candidates?.[0];
            const finishReason = candidate?.finishReason;
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    const extPart = part;
                    yield {
                        text: extPart.text,
                        thought: extPart.thought,
                        thoughtSignature: extPart.thoughtSignature,
                        functionCall: extPart.functionCall,
                        finishReason,
                        usageMetadata: chunk.usageMetadata ? {
                            prompt: chunk.usageMetadata.promptTokenCount || 0,
                            candidates: chunk.usageMetadata.candidatesTokenCount || 0,
                            cached: chunk.usageMetadata.cachedContentTokenCount || 0
                        } : undefined
                    };
                }
            }
            else if (finishReason) {
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
    getPreview(contents) {
        return contents.map(content => ({
            ...content,
            parts: content.parts.map(part => {
                const newPart = { ...part };
                delete newPart.thoughtSignature;
                return newPart;
            })
        }));
    }
    async sendMessageStream(providerConfig, contents, systemInstruction, config = {}) {
        const client = this.getClient(providerConfig);
        const lastModelId = this.getModelId(providerConfig);
        const cachedContentName = config.cachedContentName;
        const responseSchema = config.responseSchema;
        const currentModel = this.getAvailableModels(providerConfig).find(m => m.id === lastModelId);
        const modelSupportsThinking = currentModel?.supportsThinking ?? false;
        let currentThinkingLevel = genai_1.ThinkingLevel.MINIMAL;
        const confLevel = providerConfig.additionalSettings?.['thinkingLevel'];
        if (confLevel)
            currentThinkingLevel = this.mapThinkingLevel(confLevel);
        const modelVersionMatch = lastModelId.match(/gemini-(\d+\.?\d*)/);
        const version = modelVersionMatch ? parseFloat(modelVersionMatch[1]) : 3.0;
        const isLegacyModel = version < 2.5;
        const generationConfig = {
            safetySettings: [
                { category: genai_1.HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: genai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: genai_1.HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: genai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: genai_1.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: genai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: genai_1.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: genai_1.HarmBlockThreshold.BLOCK_NONE },
                { category: genai_1.HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: genai_1.HarmBlockThreshold.BLOCK_NONE }
            ]
        };
        if (config.maxOutputTokens)
            generationConfig.maxOutputTokens = config.maxOutputTokens;
        if (config.presence_penalty !== undefined)
            generationConfig.presencePenalty = config.presence_penalty;
        if (config.frequency_penalty !== undefined) {
            generationConfig.frequencyPenalty = config.frequency_penalty;
        }
        else if (isLegacyModel) {
            generationConfig.frequencyPenalty = 0.2;
        }
        if (modelSupportsThinking) {
            generationConfig.thinkingConfig = { includeThoughts: true };
            if (currentModel?.thinkingBudgetLevelMapping) {
                const budget = currentModel.thinkingBudgetLevelMapping[currentThinkingLevel];
                if (budget !== undefined) {
                    generationConfig.thinkingConfig.thinkingBudget = budget;
                }
            }
            else {
                generationConfig.thinkingConfig.thinkingLevel = currentThinkingLevel;
            }
        }
        if (systemInstruction && !cachedContentName) {
            generationConfig.systemInstruction = { parts: [{ text: systemInstruction }] };
        }
        if (cachedContentName) {
            generationConfig.cachedContent = cachedContentName;
        }
        else {
            generationConfig.tools = this.defaultTools;
        }
        if (responseSchema)
            generationConfig.responseMimeType = "application/json";
        if (config.responseMimeType && !responseSchema)
            generationConfig.responseMimeType = config.responseMimeType;
        if (responseSchema)
            generationConfig.responseSchema = responseSchema;
        if (config.toolConfig && !cachedContentName)
            generationConfig.toolConfig = config.toolConfig;
        const request = {
            model: lastModelId,
            contents: contents,
            config: generationConfig
        };
        return await client.models.generateContentStream(request);
    }
    async countTokens(config, model, contents) {
        let client;
        try {
            client = this.getClient(config);
        }
        catch {
            return 0;
        }
        const geminiContents = contents.map(c => this.toGeminiContent(c));
        try {
            const response = await client.models.countTokens({ model, contents: geminiContents });
            return response.totalTokens || 0;
        }
        catch (e) {
            console.warn('Failed to count tokens:', e);
            return 0;
        }
    }
    async createCache(config, modelId, systemInstruction, contents, ttlSeconds) {
        let client;
        try {
            client = this.getClient(config);
        }
        catch {
            return null;
        }
        const geminiContents = contents.map(c => this.toGeminiContent(c));
        try {
            const params = {
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
        }
        catch (e) {
            console.warn('Cache creation failed:', e);
            return null;
        }
    }
    async getCache(config, name) {
        let client;
        try {
            client = this.getClient(config);
        }
        catch {
            return null;
        }
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
        }
        catch (e) {
            return null;
        }
    }
    async updateCacheTTL(config, name, ttlSeconds) {
        let client;
        try {
            client = this.getClient(config);
        }
        catch {
            return null;
        }
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
        }
        catch (e) {
            return null;
        }
    }
    async deleteCache(config, name) {
        let client;
        try {
            client = this.getClient(config);
        }
        catch {
            return;
        }
        try {
            await client.caches.delete({ name });
        }
        catch (e) { }
    }
    async deleteAllCaches(config) {
        let client;
        try {
            client = this.getClient(config);
        }
        catch {
            return 0;
        }
        let count = 0;
        try {
            const list = await client.caches.list();
            for await (const cache of list) {
                if (cache.name) {
                    try {
                        await client.caches.delete({ name: cache.name });
                        count++;
                    }
                    catch (e) { }
                }
            }
        }
        catch (e) { }
        return count;
    }
    mapThinkingLevel(level) {
        switch (level.toLowerCase()) {
            case 'minimal': return genai_1.ThinkingLevel.MINIMAL;
            case 'low': return genai_1.ThinkingLevel.LOW;
            case 'medium': return genai_1.ThinkingLevel.MEDIUM;
            case 'high': return genai_1.ThinkingLevel.HIGH;
            default: return genai_1.ThinkingLevel.HIGH;
        }
    }
}
exports.GeminiProvider = GeminiProvider;
//# sourceMappingURL=index.js.map