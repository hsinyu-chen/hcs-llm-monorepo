import { LLMProvider, LLMProviderCapabilities } from './llm-provider';

/**
 * LLMProviderRegistry - Factory for managing LLM providers.
 * Pure TypeScript implementation.
 */
export class LLMProviderRegistry {
    private providers = new Map<string, LLMProvider>();

    register(provider: LLMProvider): void {
        this.providers.set(provider.providerName, provider);
    }

    getProvider(providerName: string): LLMProvider | undefined {
        return this.providers.get(providerName);
    }

    getCapabilities(providerName: string): LLMProviderCapabilities {
        const provider = this.getProvider(providerName);
        if (provider) return provider.getCapabilities();
        
        return {
            supportsContextCaching: false,
            supportsThinking: false,
            supportsStructuredOutput: false,
            isLocalProvider: false,
            supportsSpeedMetrics: false
        };
    }

    listProviders(): string[] {
        return Array.from(this.providers.keys());
    }
}
