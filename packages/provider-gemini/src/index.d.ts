import { Content } from '@google/genai';
import { LLMProvider, LLMProviderCapabilities, LLMProviderConfig, LLMContent, LLMGenerateConfig, LLMStreamChunk, LLMModelDefinition, LLMCacheInfo } from '@hcs/llm-core';
export declare const DEFAULT_GEMINI_MODEL_ID = "gemini-3-flash-preview";
export declare class GeminiProvider implements LLMProvider {
    readonly providerName = "gemini";
    settingsComponentId: string;
    private readonly defaultTools;
    private toGeminiContent;
    private toGeminiPart;
    getCapabilities(): LLMProviderCapabilities;
    getAvailableModels(config: LLMProviderConfig): LLMModelDefinition[];
    getDefaultModelId(): string;
    private getClient;
    private getModelId;
    isConfigured(config: LLMProviderConfig): boolean;
    generateContentStream(config: LLMProviderConfig, contents: LLMContent[], systemInstruction: string, genConfig: LLMGenerateConfig): AsyncGenerator<LLMStreamChunk>;
    getPreview(contents: LLMContent[]): LLMContent[];
    sendMessageStream(providerConfig: LLMProviderConfig, contents: Content[], systemInstruction: string, config?: LLMGenerateConfig): Promise<AsyncGenerator<import("@google/genai", { with: { "resolution-mode": "import" } }).GenerateContentResponse, any, any>>;
    countTokens(config: LLMProviderConfig, model: string, contents: LLMContent[]): Promise<number>;
    createCache(config: LLMProviderConfig, modelId: string, systemInstruction: string, contents: LLMContent[], ttlSeconds: number): Promise<LLMCacheInfo | null>;
    getCache(config: LLMProviderConfig, name: string): Promise<LLMCacheInfo | null>;
    updateCacheTTL(config: LLMProviderConfig, name: string, ttlSeconds: number): Promise<LLMCacheInfo | null>;
    deleteCache(config: LLMProviderConfig, name: string): Promise<void>;
    deleteAllCaches(config: LLMProviderConfig): Promise<number>;
    private mapThinkingLevel;
}
//# sourceMappingURL=index.d.ts.map