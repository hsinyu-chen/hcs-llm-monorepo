import { Type, InjectionToken } from '@angular/core';
import { ComponentPortal } from '@angular/cdk/portal';
import { LLMConfig, ILLMStorage } from '@hcs/llm-core';
/**
 * Injection Token for LLM Config Data in Portal components.
 */
export declare const LLM_CONFIG_DATA: InjectionToken<LLMConfig>;
/**
 * Injection Token for the Storage Service.
 */
export declare const LLM_STORAGE_TOKEN: InjectionToken<ILLMStorage>;
export declare class LLMSettingsComponent {
    settingsClosed: import("@angular/core", { with: { "resolution-mode": "import" } }).OutputEmitterRef<void>;
    private manager;
    private storage;
    private injector;
    private customTranslations;
    i18n: import("@angular/core", { with: { "resolution-mode": "import" } }).Signal<import("@hcs/llm-angular-common").LLMTranslations>;
    providers: {
        id: string;
        name: string;
    }[];
    configs: import("@angular/core", { with: { "resolution-mode": "import" } }).WritableSignal<LLMConfig[]>;
    constructor();
    loadConfigs(): Promise<void>;
    editingConfig: import("@angular/core", { with: { "resolution-mode": "import" } }).WritableSignal<LLMConfig>;
    configPortal: import("@angular/core", { with: { "resolution-mode": "import" } }).Signal<ComponentPortal<any>>;
    private uiRegistry;
    registerUIComponent(id: string, component: Type<any>): void;
    private resolveUIComponent;
    onProviderChange(newProvider: string): void;
    testStatus: import("@angular/core", { with: { "resolution-mode": "import" } }).WritableSignal<string>;
    testResponse: import("@angular/core", { with: { "resolution-mode": "import" } }).WritableSignal<string>;
    isTesting: import("@angular/core", { with: { "resolution-mode": "import" } }).WritableSignal<boolean>;
    createConfig(): void;
    editConfig(config: LLMConfig): void;
    saveConfig(): Promise<void>;
    onPortalAttached(ref: any): void;
    deleteConfig(id: string): Promise<void>;
    testConnection(): Promise<void>;
    cancelEdit(): void;
}
//# sourceMappingURL=llm-settings.component.d.ts.map