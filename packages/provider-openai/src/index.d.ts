import { LLMProvider, LLMProviderCapabilities, LLMProviderConfig, LLMContent, LLMGenerateConfig, LLMStreamChunk, LLMModelDefinition } from '@hcs/llm-core';
export declare class OpenAIProvider implements LLMProvider {
    readonly providerName = "openai";
    settingsComponentId: string;
    private extractConfig;
    isConfigured(config: LLMProviderConfig): boolean;
    getCapabilities(): LLMProviderCapabilities;
    getAvailableModels(config: LLMProviderConfig): LLMModelDefinition[];
    getDefaultModelId(): string;
    generateContentStream(providerConfig: LLMProviderConfig, contents: LLMContent[], systemInstruction: string, config: LLMGenerateConfig): AsyncGenerator<LLMStreamChunk>;
    countTokens(providerConfig: LLMProviderConfig, _modelId: string, contents: LLMContent[]): Promise<number>;
    private prepareSchema;
}
//# sourceMappingURL=index.d.ts.map