import { InjectionToken } from '@angular/core';
import { LLMConfig } from '@hcs/llm-core';

/**
 * Injection Token for LLM Config Data in Portal components.
 */
export const LLM_CONFIG_DATA = new InjectionToken<LLMConfig>('HCS_LLM_CONFIG_DATA');

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
        // Add more as needed based on the refactored html
    }
}

/**
 * Injection Token for providing translations to the LLM UI.
 */
export const LLM_TRANSLATIONS = new InjectionToken<LLMTranslations>('HCS_LLM_TRANSLATIONS');

/**
 * Default English translations for fallback.
 */
export const DEFAULT_LLM_TRANSLATIONS: LLMTranslations = {
    settings: {
        title: 'LLM Configuration',
        newConfig: 'Add New Profile',
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        test: 'Test Connection',
        confirmDelete: 'Are you sure you want to delete this profile?',
        testing: 'Testing...',
        testSuccess: 'Connection successful!',
        testError: 'Connection failed: {{msg}}',
        newConfigName: 'New Profile'
    }
};
