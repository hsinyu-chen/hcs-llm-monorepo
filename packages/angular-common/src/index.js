"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LLM_TRANSLATIONS = exports.LLM_TRANSLATIONS = exports.LLM_STORAGE_TOKEN = exports.LLM_CONFIG_DATA = void 0;
const core_1 = require("@angular/core");
/**
 * Injection Token for LLM Config Data in Portal components.
 */
exports.LLM_CONFIG_DATA = new core_1.InjectionToken('HCS_LLM_CONFIG_DATA');
/**
 * Injection Token for the Storage Service.
 */
exports.LLM_STORAGE_TOKEN = new core_1.InjectionToken('HCS_LLM_STORAGE_TOKEN');
/**
 * Injection Token for providing translations to the LLM UI.
 */
exports.LLM_TRANSLATIONS = new core_1.InjectionToken('HCS_LLM_TRANSLATIONS');
/**
 * Default English translations for fallback.
 */
exports.DEFAULT_LLM_TRANSLATIONS = {
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
//# sourceMappingURL=index.js.map