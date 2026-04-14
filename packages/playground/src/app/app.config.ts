import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { 
    LLMManager, 
    LLMProviderRegistry, 
    BrowserIndexedDBStorage 
} from '@hcs/llm-core';
import { 
    LLM_STORAGE_TOKEN, 
    LLM_TRANSLATIONS, 
    DEFAULT_LLM_TRANSLATIONS 
} from '@hcs/llm-angular-common';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    
    // 1. Registry (Internal for the app)
    { provide: LLMProviderRegistry, useFactory: () => new LLMProviderRegistry() },
    
    // 2. Storage (Using Browser Local IndexedDB)
    { provide: LLM_STORAGE_TOKEN, useFactory: () => new BrowserIndexedDBStorage() },
    
    // 3. Manager
    { 
        provide: LLMManager, 
        useFactory: (storage: BrowserIndexedDBStorage, registry: LLMProviderRegistry) => {
            return new LLMManager(storage, registry);
        },
        deps: [LLM_STORAGE_TOKEN, LLMProviderRegistry]
    },
    
    // 4. Default Translations
    { provide: LLM_TRANSLATIONS, useValue: DEFAULT_LLM_TRANSLATIONS }
  ]
};
