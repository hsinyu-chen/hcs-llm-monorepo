import { Component, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_CONFIG_DATA } from '@hcs/llm-angular-common';
import { OpenAIProvider } from '@hcs/llm-provider-openai';

@Component({
  selector: 'hcs-openai-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="provider-fields">
      <div class="form-group">
        <label for="openaiUrl">Base URL:</label>
        <input id="openaiUrl" type="text" [(ngModel)]="config.settings.baseUrl" 
               placeholder="https://api.openai.com/v1" (ngModelChange)="configChanged.emit()">
      </div>

      <div class="form-group">
        <label for="openaiKey">API Key:</label>
        <input id="openaiKey" type="password" [(ngModel)]="config.settings.apiKey" 
               placeholder="sk-..." (ngModelChange)="configChanged.emit()">
      </div>

      <div class="form-group">
        <label for="openaiModel">Model ID:</label>
        <input id="openaiModel" type="text" [(ngModel)]="config.settings.modelId" 
               placeholder="gpt-4o" (ngModelChange)="configChanged.emit()">
      </div>

      <div class="advanced-divider">Advanced Settings</div>
      
      <div class="form-grid columns-2">
          <div class="form-group-vertical">
              <label for="temp">Temperature</label>
              <input id="temp" type="number" step="0.1" min="0" max="2" 
                     [(ngModel)]="config.settings.temperature" (ngModelChange)="configChanged.emit()">
          </div>
          <div class="form-group-vertical">
              <label for="maxTokens">Max Tokens</label>
              <input id="maxTokens" type="number" step="128" min="1" 
                     [(ngModel)]="config.settings.maxOutputTokens" (ngModelChange)="configChanged.emit()">
          </div>
      </div>
    </div>
  `,
  styles: [`
    .provider-fields { display: flex; flex-direction: column; gap: 4px; }
    .form-group {
      display: grid;
      grid-template-columns: 140px 1fr;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      label { color: #8b949e; font-size: 0.9em; font-weight: 500; }
      input {
        width: 100%;
        padding: 8px;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 6px;
        color: white;
      }
    }
    .advanced-divider { 
        margin: 16px 0 12px 0; 
        font-size: 0.8rem; 
        color: #58a6ff; 
        border-bottom: 1px solid #30363d;
        padding-bottom: 4px;
    }
    .form-grid { display: grid; gap: 12px; &.columns-2 { grid-template-columns: 1fr 1fr; } }
    .form-group-vertical {
        label { display: block; font-size: 0.75rem; color: #8b949e; margin-bottom: 4px; }
        input { width: 100%; padding: 6px; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; color: white; }
    }
  `]
})
export class OpenAIConfigComponent {
  config = inject(LLM_CONFIG_DATA);
  configChanged = output<void>();

  constructor() {
    if (!this.config.settings.additionalSettings) {
      this.config.settings.additionalSettings = {};
    }
  }
}
