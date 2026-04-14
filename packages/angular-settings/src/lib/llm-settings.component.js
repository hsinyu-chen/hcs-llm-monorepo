"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMSettingsComponent = exports.LLM_STORAGE_TOKEN = exports.LLM_CONFIG_DATA = void 0;
const core_1 = require("@angular/core");
const common_1 = require("@angular/common");
const forms_1 = require("@angular/forms");
const portal_1 = require("@angular/cdk/portal");
const llm_core_1 = require("@hcs/llm-core");
/**
 * Injection Token for LLM Config Data in Portal components.
 */
exports.LLM_CONFIG_DATA = new core_1.InjectionToken('HCS_LLM_CONFIG_DATA');
/**
 * Injection Token for the Storage Service.
 */
exports.LLM_STORAGE_TOKEN = new core_1.InjectionToken('HCS_LLM_STORAGE_TOKEN');
const llm_angular_common_1 = require("@hcs/llm-angular-common");
// These would normally be imported from the provider-ui packages
// If we haven't created them yet, we'll need to define where they come from.
// For now, I'll assume they will be provided via a registry or injected.
let LLMSettingsComponent = class LLMSettingsComponent {
    settingsClosed = (0, core_1.output)();
    // These should be provided in the app root or via a module
    manager = (0, core_1.inject)(llm_core_1.LLMManager);
    storage = (0, core_1.inject)(exports.LLM_STORAGE_TOKEN);
    injector = (0, core_1.inject)(core_1.Injector);
    // I18n bridge
    customTranslations = (0, core_1.inject)(llm_angular_common_1.LLM_TRANSLATIONS, { optional: true });
    i18n = (0, core_1.computed)(() => this.customTranslations || llm_angular_common_1.DEFAULT_LLM_TRANSLATIONS);
    // Available Providers (could also be fetched from registry)
    providers = [
        { id: 'gemini', name: 'Google Gemini' },
        { id: 'openai', name: 'OpenAI / Web-API' },
        { id: 'llama.cpp', name: 'Llama.cpp (Local)' }
    ];
    // List of configs - we manually sync with storage since it's now pure TS
    configs = (0, core_1.signal)([]);
    constructor() {
        this.loadConfigs();
        // Setup listener if storage supports it
        if (this.storage.onChanged) {
            this.storage.onChanged = (newConfigs) => this.configs.set(newConfigs);
        }
    }
    async loadConfigs() {
        const c = await this.storage.getAll();
        this.configs.set(c);
    }
    // Editing state
    editingConfig = (0, core_1.signal)(null);
    // Dynamic Portal for Provider-specific settings
    // In a real modular setup, we'd have a Registry of UI components
    configPortal = (0, core_1.computed)(() => {
        const config = this.editingConfig();
        if (!config)
            return null;
        const provider = this.manager.getProvider(config.provider);
        if (!provider || !provider.settingsComponentId)
            return null;
        // In a real monorepo, we'd resolve the string ID to a Type<any>
        // For this demo, we'll need a way for the user to register these UI components.
        const component = this.resolveUIComponent(provider.settingsComponentId);
        if (!component)
            return null;
        const portalInjector = core_1.Injector.create({
            providers: [{ provide: exports.LLM_CONFIG_DATA, useValue: config }],
            parent: this.injector
        });
        return new portal_1.ComponentPortal(component, null, portalInjector);
    });
    // Helper to resolve UI components (should be part of an Angular provider UI registry)
    uiRegistry = new Map();
    registerUIComponent(id, component) {
        this.uiRegistry.set(id, component);
    }
    resolveUIComponent(id) {
        return this.uiRegistry.get(id);
    }
    onProviderChange(newProvider) {
        const current = this.editingConfig();
        if (current) {
            const providerInstance = this.manager.getProvider(newProvider);
            let defaultModelId = providerInstance ? providerInstance.getDefaultModelId() : '';
            const newSettings = { ...current.settings, modelId: defaultModelId };
            if (newProvider === 'gemini') {
                newSettings.thinkingLevel = 'minimal';
            }
            this.editingConfig.set({
                ...current,
                provider: newProvider,
                settings: newSettings
            });
        }
    }
    // Test connection status
    testStatus = (0, core_1.signal)('');
    testResponse = (0, core_1.signal)('');
    isTesting = (0, core_1.signal)(false);
    createConfig() {
        const newConfig = {
            id: crypto.randomUUID(),
            name: this.i18n().settings.newConfigName,
            provider: 'openai',
            settings: {
                modelId: undefined,
                apiKey: ''
            }
        };
        this.editingConfig.set(newConfig);
        this.testStatus.set('');
    }
    editConfig(config) {
        const cloned = JSON.parse(JSON.stringify(config));
        this.editingConfig.set(cloned);
        this.testStatus.set('');
    }
    async saveConfig() {
        const config = this.editingConfig();
        if (config) {
            await this.storage.save(config);
            await this.loadConfigs(); // Manual sync
            this.editingConfig.set(null);
        }
    }
    onPortalAttached(ref) {
        // Handle child outputs if needed
    }
    async deleteConfig(id) {
        if (confirm(this.i18n().settings.confirmDelete)) {
            await this.storage.delete(id);
            await this.loadConfigs();
        }
    }
    async testConnection() {
        const config = this.editingConfig();
        if (!config)
            return;
        this.isTesting.set(true);
        this.testStatus.set(this.i18n().settings.testing);
        this.testResponse.set('');
        try {
            const provider = await this.manager.getProviderForConfig(config);
            if (!provider)
                throw new Error('Provider not found');
            const stream = provider.generateContentStream(config.settings, [{ role: 'user', parts: [{ text: 'Hello, are you alive? Please reply with a short greeting.' }] }], 'You are a testing assistant.', { signal: AbortSignal.timeout(10000) });
            let result = '';
            for await (const chunk of stream) {
                if (chunk.text) {
                    result += chunk.text;
                    this.testResponse.set(result);
                }
            }
            if (result) {
                this.testStatus.set('✅ ' + this.i18n().settings.testSuccess);
            }
            else {
                this.testStatus.set('❌ Empty response');
            }
        }
        catch (e) {
            this.testStatus.set('❌ ' + (e.message || String(e)));
        }
        finally {
            this.isTesting.set(false);
        }
    }
    cancelEdit() {
        if (this.editingConfig()) {
            this.editingConfig.set(null);
        }
        else {
            this.settingsClosed.emit();
        }
    }
};
exports.LLMSettingsComponent = LLMSettingsComponent;
exports.LLMSettingsComponent = LLMSettingsComponent = __decorate([
    (0, core_1.Component)({
        selector: 'hcs-llm-settings',
        standalone: true,
        imports: [common_1.CommonModule, forms_1.FormsModule, portal_1.PortalModule],
        templateUrl: './llm-settings.component.html',
        styleUrl: './llm-settings.component.scss'
    }),
    __metadata("design:paramtypes", [])
], LLMSettingsComponent);
//# sourceMappingURL=llm-settings.component.js.map