import { ILLMStorage } from './llm-storage';
import { LLMProviderRegistry } from './llm-registry';
import { LLMConfig, LLMProvider } from './llm-provider';
/**
 * LLMManager - Orchestrates Multiple LLM Configurations.
 * Pure TypeScript implementation.
 */
export declare class LLMManager {
    private storage;
    private registry;
    constructor(storage: ILLMStorage, registry: LLMProviderRegistry);
    getProviderForConfig(config: LLMConfig): Promise<LLMProvider | undefined>;
    getProviderByConfigId(configId: string): Promise<LLMProvider | undefined>;
    getConfigById(configId: string): Promise<LLMConfig | undefined>;
    getProvider(providerName: string): LLMProvider | undefined;
}
//# sourceMappingURL=llm-manager.d.ts.map