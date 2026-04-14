import { ILLMStorage } from './llm-storage';
import { LLMProviderRegistry } from './llm-registry';
import { LLMConfig, LLMProvider } from './llm-provider';

/**
 * LLMManager - Orchestrates Multiple LLM Configurations.
 * Pure TypeScript implementation.
 */
export class LLMManager {
    constructor(
        private storage: ILLMStorage,
        private registry: LLMProviderRegistry
    ) {}

    async getProviderForConfig(config: LLMConfig): Promise<LLMProvider | undefined> {
        return this.registry.getProvider(config.provider);
    }

    async getProviderByConfigId(configId: string): Promise<LLMProvider | undefined> {
        const config = await this.storage.getById(configId);
        if (!config) return undefined;
        return this.getProviderForConfig(config);
    }

    async getConfigById(configId: string): Promise<LLMConfig | undefined> {
        return this.storage.getById(configId);
    }

    getProvider(providerName: string): LLMProvider | undefined {
        return this.registry.getProvider(providerName);
    }

    getRegistry(): LLMProviderRegistry {
        return this.registry;
    }
}
