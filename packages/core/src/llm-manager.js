"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMManager = void 0;
/**
 * LLMManager - Orchestrates Multiple LLM Configurations.
 * Pure TypeScript implementation.
 */
class LLMManager {
    storage;
    registry;
    constructor(storage, registry) {
        this.storage = storage;
        this.registry = registry;
    }
    async getProviderForConfig(config) {
        return this.registry.getProvider(config.provider);
    }
    async getProviderByConfigId(configId) {
        const config = await this.storage.getById(configId);
        if (!config)
            return undefined;
        return this.getProviderForConfig(config);
    }
    async getConfigById(configId) {
        return this.storage.getById(configId);
    }
    getProvider(providerName) {
        return this.registry.getProvider(providerName);
    }
}
exports.LLMManager = LLMManager;
//# sourceMappingURL=llm-manager.js.map