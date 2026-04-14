import { LLMProvider, LLMProviderCapabilities } from './llm-provider';
/**
 * LLMProviderRegistry - Factory for managing LLM providers.
 * Pure TypeScript implementation.
 */
export declare class LLMProviderRegistry {
    private providers;
    register(provider: LLMProvider): void;
    getProvider(providerName: string): LLMProvider | undefined;
    getCapabilities(providerName: string): LLMProviderCapabilities;
    listProviders(): string[];
}
//# sourceMappingURL=llm-registry.d.ts.map