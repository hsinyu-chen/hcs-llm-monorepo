"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMProviderRegistry = void 0;
/**
 * LLMProviderRegistry - Factory for managing LLM providers.
 * Pure TypeScript implementation.
 */
class LLMProviderRegistry {
    providers = new Map();
    register(provider) {
        this.providers.set(provider.providerName, provider);
    }
    getProvider(providerName) {
        return this.providers.get(providerName);
    }
    getCapabilities(providerName) {
        const provider = this.getProvider(providerName);
        if (provider)
            return provider.getCapabilities();
        return {
            supportsContextCaching: false,
            supportsThinking: false,
            supportsStructuredOutput: false,
            isLocalProvider: false,
            supportsSpeedMetrics: false
        };
    }
    listProviders() {
        return Array.from(this.providers.keys());
    }
}
exports.LLMProviderRegistry = LLMProviderRegistry;
//# sourceMappingURL=llm-registry.js.map