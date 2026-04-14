import { InjectionToken } from '@angular/core';
import { LLMConfig, ILLMStorage } from '@hcs/llm-core';
/**
 * Injection Token for LLM Config Data in Portal components.
 */
export declare const LLM_CONFIG_DATA: InjectionToken<LLMConfig>;
/**
 * Injection Token for the Storage Service.
 */
export declare const LLM_STORAGE_TOKEN: InjectionToken<ILLMStorage>;
/**
 * Interface for the required translation keys in the LLM Settings UI.
 */
export interface LLMTranslations {
    settings: {
        title: string;
        newConfig: string;
        save: string;
        cancel: string;
        delete: string;
        test: string;
        confirmDelete: string;
        testing: string;
        testSuccess: string;
        testError: string;
        newConfigName: string;
    };
}
/**
 * Injection Token for providing translations to the LLM UI.
 */
export declare const LLM_TRANSLATIONS: InjectionToken<LLMTranslations>;
/**
 * Default English translations for fallback.
 */
export declare const DEFAULT_LLM_TRANSLATIONS: LLMTranslations;
//# sourceMappingURL=index.d.ts.map