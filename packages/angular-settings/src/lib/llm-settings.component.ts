import { 
    Component, 
    inject, 
    signal, 
    output, 
    computed, 
    Injector, 
    Type, 
    ComponentRef,
    InjectionToken
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortalModule, ComponentPortal } from '@angular/cdk/portal';
import { LLMManager, LLMConfig, LLMProvider, ILLMStorage } from '@hcs/llm-core';

import { 
    LLM_TRANSLATIONS, 
    DEFAULT_LLM_TRANSLATIONS,
    LLM_STORAGE_TOKEN,
    LLM_CONFIG_DATA
} from '@hcs/llm-angular-common';

// These would normally be imported from the provider-ui packages
// If we haven't created them yet, we'll need to define where they come from.
// For now, I'll assume they will be provided via a registry or injected.
@Component({
    selector: 'hcs-llm-settings',
    standalone: true,
    imports: [CommonModule, FormsModule, PortalModule],
    templateUrl: './llm-settings.component.html',
    styleUrl: './llm-settings.component.scss'
})
export class LLMSettingsComponent {
    settingsClosed = output<void>();

    // These should be provided in the app root or via a module
    private manager = inject(LLMManager);
    private storage = inject(LLM_STORAGE_TOKEN);
    private injector = inject(Injector);
    
    // I18n bridge
    private customTranslations = inject(LLM_TRANSLATIONS, { optional: true });
    public i18n = computed(() => this.customTranslations || DEFAULT_LLM_TRANSLATIONS);

    // Available Providers (could also be fetched from registry)
    providers = [
        { id: 'gemini', name: 'Google Gemini' },
        { id: 'openai', name: 'OpenAI / Web-API' },
        { id: 'llama.cpp', name: 'Llama.cpp (Local)' }
    ];

    // List of configs - we manually sync with storage since it's now pure TS
    configs = signal<LLMConfig[]>([]);

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
    editingConfig = signal<LLMConfig | null>(null);

    // Dynamic Portal for Provider-specific settings
    // In a real modular setup, we'd have a Registry of UI components
    configPortal = computed(() => {
        const config = this.editingConfig();
        if (!config) return null;

        const provider = this.manager.getProvider(config.provider);
        if (!provider || !provider.settingsComponentId) return null;

        // In a real monorepo, we'd resolve the string ID to a Type<any>
        // For this demo, we'll need a way for the user to register these UI components.
        const component = this.resolveUIComponent(provider.settingsComponentId);
        if (!component) return null;

        const portalInjector = Injector.create({
            providers: [{ provide: LLM_CONFIG_DATA, useValue: config }],
            parent: this.injector
        });

        return new ComponentPortal(component, null, portalInjector);
    });

    private resolveUIComponent(id: string): Type<any> | undefined {
        return this.manager.getRegistry().getUIComponent(id);
    }


    onProviderChange(newProvider: string) {
        const current = this.editingConfig();
        if (current) {
            const providerInstance = this.manager.getProvider(newProvider);
            let defaultModelId = providerInstance ? providerInstance.getDefaultModelId() : '';

            const newSettings: any = { ...current.settings, modelId: defaultModelId };

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
    testStatus = signal<string>('');
    testResponse = signal<string>('');
    isTesting = signal(false);

    // Pricing estimation fields
    costTrigger = signal(0);
    modelPricing = computed(() => {
        this.costTrigger(); // Dependency
        const config = this.editingConfig();
        if (!config) return null;

        const provider = this.manager.getProvider(config.provider);
        if (!provider) return null;

        const s = config.settings;
        const inputPrice = s.inputPrice ?? 0;
        const cachePrice = s.cacheInputPrice ?? 0;
        const outputPrice = s.outputPrice ?? 0;

        // Only show if at least one price is defined and > 0
        if (inputPrice === 0 && cachePrice === 0 && outputPrice === 0) return null;

        // Generic estimation values (could be made inputs later)
        const estInput = 50000;
        const estCached = 10000;
        const estOutput = 5000;

        const inputCost = (estInput / 1000000) * inputPrice;
        const cacheCost = (estCached / 1000000) * cachePrice;
        const outputCost = (estOutput / 1000000) * outputPrice;
        const total = inputCost + cacheCost + outputCost;

        return {
            inputPrice,
            cachePrice,
            outputPrice,
            inputCost,
            cacheCost,
            outputCost,
            total,
            estInput,
            estCached,
            estOutput
        };
    });

    createConfig() {
        const newConfig: LLMConfig = {
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

    editConfig(config: LLMConfig) {
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

    onPortalAttached(ref: any) {
        if (!ref || !(ref instanceof ComponentRef)) return;

        // Subscribe to child's configChanged output to trigger re-calc
        const instance = ref.instance;
        if (instance.configChanged) {
            instance.configChanged.subscribe(() => {
                this.costTrigger.update(v => v + 1);
            });
        }
    }

    async deleteConfig(id: string) {
        if (confirm(this.i18n().settings.confirmDelete)) {
            await this.storage.delete(id);
            await this.loadConfigs();
        }
    }

    async testConnection() {
        const config = this.editingConfig();
        if (!config) return;

        this.isTesting.set(true);
        this.testStatus.set(this.i18n().settings.testing);
        this.testResponse.set('');

        try {
            const provider = await this.manager.getProviderForConfig(config);
            if (!provider) throw new Error('Provider not found');

            const stream = provider.generateContentStream(
                config.settings,
                [{ role: 'user', parts: [{ text: 'Hello, are you alive? Please reply with a short greeting.' }] }],
                'You are a testing assistant.',
                { signal: AbortSignal.timeout(10000) }
            );

            let result = '';
            for await (const chunk of stream) {
                if (chunk.text) {
                    result += chunk.text;
                    this.testResponse.set(result);
                }
            }

            if (result) {
                this.testStatus.set('✅ ' + this.i18n().settings.testSuccess);
            } else {
                this.testStatus.set('❌ Empty response');
            }
        } catch (e: any) {
            this.testStatus.set('❌ ' + (e.message || String(e)));
        } finally {
            this.isTesting.set(false);
        }
    }

    cancelEdit() {
        if (this.editingConfig()) {
            this.editingConfig.set(null);
        } else {
            this.settingsClosed.emit();
        }
    }
}
