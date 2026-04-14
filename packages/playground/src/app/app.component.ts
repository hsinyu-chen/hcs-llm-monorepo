import { Component, inject, OnInit } from '@angular/core';
import { LLMProviderRegistry } from '@hcs/llm-core';
import { LLMSettingsComponent } from '@hcs/llm-angular-settings';

// Providers and their corresponding UI components
import { GeminiProvider } from '@hcs/llm-provider-gemini';
import { GeminiConfigComponent } from '@hcs/llm-angular-ui-gemini';

import { OpenAIProvider } from '@hcs/llm-provider-openai';
import { OpenAIConfigComponent } from '@hcs/llm-angular-ui-openai';

import { LlamaCppProvider } from '@hcs/llm-provider-llama-cpp';
import { LlamaConfigComponent } from '@hcs/llm-angular-ui-llama-cpp';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LLMSettingsComponent],
  template: `
    <div class="app-container">
      <header>
        <h1>HCS LLM Provider Playground</h1>
        <p>Advanced modular LLM management and configuration system</p>
      </header>
      
      <main>
        <hcs-llm-settings></hcs-llm-settings>
      </main>
    </div>
  `
})
export class AppComponent implements OnInit {
  private registry = inject(LLMProviderRegistry);

  ngOnInit() {
    console.log('--- Playground Initializing ---');
    
    // 1. Register Gemini
    const gemini = new GeminiProvider();
    this.registry.register(gemini);
    this.registry.registerUIComponent(gemini.settingsComponentId, GeminiConfigComponent);

    // 2. Register OpenAI
    const openai = new OpenAIProvider();
    this.registry.register(openai);
    this.registry.registerUIComponent(openai.settingsComponentId, OpenAIConfigComponent);

    // 3. Register Llama.cpp
    const llama = new LlamaCppProvider();
    this.registry.register(llama);
    this.registry.registerUIComponent(llama.settingsComponentId, LlamaConfigComponent);
    
    console.log('Registered providers in Playground:', this.registry.listProviders());
  }
}
