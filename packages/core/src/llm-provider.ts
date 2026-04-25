/**
 * LLM Provider Abstraction Layer
 * Pure TypeScript interfaces for AI/LLM services.
 */

export const DEFAULT_PROVIDER_ID = 'gemini';

export interface LLMContent {
    role: 'user' | 'model' | 'system';
    parts: LLMPart[];
}

export interface LLMFunctionCall {
    /** Required for OpenAI-style providers that thread tool_call_id through tool responses. Optional for Gemini (which does not need correlation ids). */
    id?: string;
    name: string;
    args: Record<string, unknown>;
}

export interface LLMFunctionResponse {
    /** Echoed from the originating LLMFunctionCall.id when present. Required for OpenAI threading; ignored by Gemini. */
    id?: string;
    name: string;
    response: Record<string, unknown>;
}

export interface LLMFunctionDeclaration {
    name: string;
    description: string;
    /** JSON Schema describing the tool's argument object. */
    parameters: object;
}

export interface LLMPart {
    text?: string;
    thought?: boolean;
    thoughtSignature?: string;
    functionCall?: LLMFunctionCall;
    functionResponse?: LLMFunctionResponse;
}

export interface LLMGenerateConfig {
    responseSchema?: object;
    responseMimeType?: string;
    cachedContentName?: string;
    tools?: LLMFunctionDeclaration[];
    toolConfig?: object;
    intent?: string;
    maxOutputTokens?: number;
    temperature?: number;
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
    functionCall?: LLMFunctionCall;
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
    /**
     * Context window in tokens. For cloud providers this is a fixed
     * per-model value bundled in the preset; for local providers (llama.cpp)
     * it is discovered at runtime from the server's /props endpoint.
     * Callers that want to display a "context usage" bar should read this;
     * undefined/omitted means the window is unknown and UI should hide the
     * bar.
     */
    contextSize?: number;
}

export interface LLMProviderCapabilities {
    supportsContextCaching: boolean;
    supportsThinking: boolean;
    supportsStructuredOutput: boolean;
    isLocalProvider: boolean;
    supportsSpeedMetrics: boolean;
    /**
     * True when the provider's context cache holds the content itself on the
     * server (referenced by name, so the client should OMIT the cached content
     * from subsequent requests — e.g. Gemini explicit caching). False when the
     * cache is a prefix-matched KV snapshot and the client MUST still send the
     * content with every request for the prefix to match (e.g. llama.cpp slot
     * save/restore). Defaults to true when the field is absent for backwards
     * compatibility with providers that pre-date this flag.
     */
    cacheBakesContent?: boolean;
    /**
     * True when the provider can route LLMGenerateConfig.tools to the model's
     * native function-calling API and stream back LLMFunctionCall chunks.
     * Callers may still fall back to JSON-schema (responseSchema) prompting
     * when this is false or when a profile explicitly opts out.
     * For local providers this depends on the loaded model's chat template
     * supporting tool calls (Hermes / Llama 3.1+ / Qwen 2.5 / Mistral, …);
     * mismatched models will silently degrade to plain text output.
     */
    supportsNativeToolCalls?: boolean;
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
