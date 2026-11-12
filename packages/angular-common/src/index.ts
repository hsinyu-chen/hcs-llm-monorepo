import { InjectionToken } from '@angular/core';
import { LLMConfig, ILLMStorage } from '@hcs/llm-core';

/**
 * Injection Token for LLM Config Data in Portal components.
 */
export const LLM_CONFIG_DATA = new InjectionToken<LLMConfig>('HCS_LLM_CONFIG_DATA');

/**
 * Injection Token for the Storage Service.
 */
export const LLM_STORAGE_TOKEN = new InjectionToken<ILLMStorage>('HCS_LLM_STORAGE_TOKEN');

/**
 * Asks the user to confirm an action; resolves `true` to proceed.
 * Defaults to `window.confirm`; hosts with their own dialogs provide a replacement.
 */
export const LLM_CONFIRM = new InjectionToken<(message: string) => Promise<boolean>>('HCS_LLM_CONFIRM', {
    providedIn: 'root',
    factory: () => (message: string) => Promise.resolve(window.confirm(message))
});

/**
 * Interface for the required translation keys in the LLM Settings UI.
 */
export interface LLMTranslations {
    settings: {
        title: string;
        newConfig: string;
        save: string;
        cancel: string;
        copy: string;
        /** Template for a copied profile's name; `{{name}}` is the source profile's name. */
        copyName: string;
        edit: string;
        delete: string;
        namePlaceholder: string;
        noProfiles: string;
        totalProjection: string;
        test: string;
        confirmDelete: string;
        testing: string;
        testSuccess: string;
        /** `{{msg}}` is the error message. */
        testError: string;
        testEmpty: string;
        newConfigName: string;
        configName: string;
        provider: string;
        presetModel: string;
        temperature: string;
        freqPenalty: string;
        presPenalty: string;
        modelPricingTitle: string;
        modelRates: string;
        modelInput: string;
        modelCached: string;
        modelOutput: string;
        modelEstDisclaimer: string;
        customInputPrice: string;
        customCachePrice: string;
        customOutputPrice: string;
        rateLimitTitle: string;
        maxConcurrentRequests: string;
        minRequestInterval: string;
        modelResponse: string;
        topP: string;
        topK: string;
        minP: string;
        repeatPenalty: string;
        maxTokens: string;
        /** Placeholder of a sampling field left unset, so the server's own default applies. */
        serverDefault: string;
        maxTokensIncludesThinking: string;
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
        title: 'LLM Configuration Management',
        newConfig: 'Add New Profile',
        save: 'Save Changes',
        cancel: 'Cancel',
        copy: 'Copy',
        copyName: '{{name}} (Copy)',
        edit: 'Edit',
        delete: 'Delete',
        namePlaceholder: 'Enter name...',
        noProfiles: 'No profiles found.',
        totalProjection: 'Total Projection:',
        test: 'Test Connection',
        confirmDelete: 'Are you sure you want to delete this profile?',
        testing: 'Testing...',
        testSuccess: 'Connection successful!',
        testError: 'Connection failed: {{msg}}',
        testEmpty: 'The model returned an empty response.',
        newConfigName: 'New Profile',
        configName: 'Profile Name:',
        provider: 'Provider:',
        presetModel: 'Preset Model:',
        temperature: 'Temperature:',
        freqPenalty: 'Freq Penalty:',
        presPenalty: 'Pres Penalty:',
        modelPricingTitle: 'Model Pricing & Estimation',
        modelRates: 'Rates (per 1M tokens/USD):',
        modelInput: 'Input',
        modelCached: 'Cached',
        modelOutput: 'Output',
        modelEstDisclaimer: '* Estimates are for reference only. Actual costs depend on usage.',
        customInputPrice: 'Input Price (1M tokens/USD):',
        customCachePrice: 'Cache Price (1M tokens/USD):',
        customOutputPrice: 'Output Price (1M tokens/USD):',
        rateLimitTitle: 'Rate Limits',
        maxConcurrentRequests: 'Max Concurrent Requests',
        minRequestInterval: 'Min Request Interval (ms)',
        modelResponse: 'Model Response:',
        topP: 'Top P:',
        topK: 'Top K:',
        minP: 'Min P:',
        repeatPenalty: 'Repeat Penalty:',
        maxTokens: 'Max Tokens:',
        serverDefault: 'Server default',
        maxTokensIncludesThinking: 'On a llama-server /v1 endpoint this limit also counts thinking tokens.'
    }
};

/**
 * Full Traditional Chinese translations from LLMAvalon.
 */
export const ZH_LLM_TRANSLATIONS: LLMTranslations = {
    settings: {
        title: 'LLM 設定管理',
        newConfig: '+ 新增設定 Profile',
        save: '儲存設定',
        cancel: '取消',
        copy: '複製',
        copyName: '{{name}} (副本)',
        edit: '編輯',
        delete: '刪除',
        namePlaceholder: '輸入名稱...',
        noProfiles: '尚無設定。',
        totalProjection: '預估總計:',
        test: '測試連線',
        confirmDelete: '確定要刪除此設定？',
        testing: '測試中...',
        testSuccess: '連線成功',
        testError: '連線錯誤: {{msg}}',
        testEmpty: '模型回傳了空白回應。',
        newConfigName: '新設定',
        configName: '設定名稱:',
        provider: '供應商:',
        presetModel: '預設模型 (Preset):',
        temperature: '溫度 (Temperature):',
        freqPenalty: '詞頻懲罰 (Freq Penalty):',
        presPenalty: '存在懲罰 (Pres Penalty):',
        modelPricingTitle: '模型計費與預估',
        modelRates: '費率 (每 1M tokens/USD):',
        modelInput: '輸入',
        modelCached: '快取',
        modelOutput: '輸出',
        modelEstDisclaimer: '* 預估值僅供參考，實際費用取決於發言量與遊戲長度。',
        customInputPrice: '輸入價格 (1M tokens/USD):',
        customCachePrice: '快取輸入價格 (1M tokens/USD):',
        customOutputPrice: '輸出價格 (1M tokens/USD):',
        rateLimitTitle: '速率限制',
        maxConcurrentRequests: '最大同時請求數',
        minRequestInterval: '最小請求間隔 (ms)',
        modelResponse: '模型回應:',
        topP: 'Top P:',
        topK: 'Top K:',
        minP: 'Min P:',
        repeatPenalty: '重複懲罰 (Repeat Penalty):',
        maxTokens: '最大 Token 數 (Max Tokens):',
        serverDefault: '伺服器預設',
        maxTokensIncludesThinking: '接 llama-server 的 /v1 時，這個上限也包含思考的 token。'
    }
};
