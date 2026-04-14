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
        delete: 'Delete',
        test: 'Test Connection',
        confirmDelete: 'Are you sure you want to delete this profile?',
        testing: 'Testing...',
        testSuccess: 'Connection successful!',
        testError: 'Connection failed: {{msg}}',
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
        modelResponse: 'Model Response:'
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
        delete: '刪除',
        test: '測試連線',
        confirmDelete: '確定要刪除此設定？',
        testing: '測試中...',
        testSuccess: '✅ 連線成功',
        testError: '❌ 連線錯誤: {{msg}}',
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
        modelResponse: '模型回應:'
    }
};
