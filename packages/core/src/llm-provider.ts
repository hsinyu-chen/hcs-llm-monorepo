/**
 * LLM Provider Abstraction Layer
 * Pure TypeScript interfaces for AI/LLM services.
 */

export const DEFAULT_PROVIDER_ID = 'gemini';

export interface LLMContent {
    role: 'user' | 'model' | 'system';
    parts: LLMPart[];
}

export interface LLMPart {
    text?: string;
    thought?: boolean;
    thoughtSignature?: string;
    functionCall?: object;
    functionResponse?: object;
}

export interface LLMGenerateConfig {
    responseSchema?: object;
    responseMimeType?: string;
    cachedContentName?: string;
    tools?: object[];
    toolConfig?: object;
    intent?: string;
    maxOutputTokens?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    signal?: AbortSignal;
}

export interface LLMUsageMetadata {
    prompt: number;
    candidates: number;
    cached: number;
    promptSpeed?: number;      // tokens/s
    completionSpeed?: number;  // tokens/s
    totalDuration?: number;    // ms
    promptProgress?: number;   // 0-1
    promptTotal?: number;
    promptProcessed?: number;
    promptCache?: number;
}

export interface LLMStreamChunk {
    text?: string;
    thought?: boolean;
    thoughtSignature?: string;
    usageMetadata?: LLMUsageMetadata;
    functionCall?: object;
    finishReason?: string;
}

export interface LLMCacheInfo {
    name: string;
    displayName?: string;
    model: string;
    createTime?: number;  // Unix timestamp
    expireTime?: number;  // Unix timestamp
    usageMetadata?: { totalTokenCount: number };
}

export interface LLMPricingRates {
    input: number;
    output: number;
    cached?: number;
    cacheStorage?: number;
}

export interface LLMModelDefinition {
    id: string;
    name: string;
    getRates: (prompt?: number) => LLMPricingRates;
    supportsThinking?: boolean;
    allowedThinkingLevels?: string[];
    thinkingBudgetLevelMapping?: Record<string, number>;
}

export interface LLMProviderCapabilities {
    supportsContextCaching: boolean;
    supportsThinking: boolean;
    supportsStructuredOutput: boolean;
    isLocalProvider: boolean;
    supportsSpeedMetrics: boolean;
}

/**
 * The main interface that all LLM providers must implement.
 */
export interface LLMProvider {
    readonly providerName: string;

    generateContentStream(
        config: LLMProviderConfig,
        contents: LLMContent[],
        systemInstruction: string,
        genConfig: LLMGenerateConfig
    ): AsyncIterable<LLMStreamChunk>;

    countTokens(config: LLMProviderConfig, modelId: string, contents: LLMContent[]): Promise<number>;
    isConfigured(config: LLMProviderConfig): boolean;
    getCapabilities(): LLMProviderCapabilities;
    getAvailableModels(config: LLMProviderConfig): LLMModelDefinition[] | Promise<LLMModelDefinition[]>;
    getDefaultModelId(): string;
    getPreview?(contents: LLMContent[]): LLMContent[];

    // Context Caching
    createCache?(config: LLMProviderConfig, modelId: string, systemInstruction: string, contents: LLMContent[], ttlSeconds: number): Promise<LLMCacheInfo | null>;
    getCache?(config: LLMProviderConfig, name: string): Promise<LLMCacheInfo | null>;
    updateCacheTTL?(config: LLMProviderConfig, name: string, ttlSeconds: number): Promise<LLMCacheInfo | null>;
    deleteCache?(config: LLMProviderConfig, name: string): Promise<void>;
    deleteAllCaches?(config: LLMProviderConfig): Promise<number>;

    /**
     * Component identifier for provider-specific settings UI.
     * In this pure TS core, we use a string or a generic reference.
     */
    settingsComponentId?: string;
}

export interface LLMProviderConfig {
    apiKey?: string;
    modelId?: string;
    baseUrl?: string;
    temperature?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    maxOutputTokens?: number;
    inputPrice?: number;
    cacheInputPrice?: number;
    outputPrice?: number;
    additionalSettings?: Record<string, number | string | boolean | null | undefined>;
    maxConcurrentRequests?: number;
    minRequestIntervalMs?: number;
}

export interface LLMConfig {
    id: string;
    name: string;
    provider: string;
    settings: LLMProviderConfig;
}
