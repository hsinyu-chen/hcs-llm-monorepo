import { LLMProvider, LLMProviderCapabilities } from './llm-provider';

/**
 * LLMProviderRegistry - Factory for managing LLM providers.
 * Pure TypeScript implementation.
 */
export class LLMProviderRegistry {
    private providers = new Map<string, LLMProvider>();

    private uiComponents = new Map<string, any>();

    register(provider: LLMProvider): void {
        this.providers.set(provider.providerName, provider);
    }

    registerUIComponent(providerName: string, component: any): void {
        this.uiComponents.set(providerName, component);
    }

    getUIComponent(providerName: string): any {
        return this.uiComponents.get(providerName);
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
