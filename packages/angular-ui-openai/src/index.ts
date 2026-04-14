import { Component, inject, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_CONFIG_DATA, LLM_TRANSLATIONS, DEFAULT_LLM_TRANSLATIONS } from '@hcs/llm-angular-common';
import { OpenAIProvider } from '@hcs/llm-provider-openai';

@Component({
  selector: 'hcs-openai-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="provider-fields">
      <div class="form-group">
        <label for="openaiPreset">{{ i18n().settings.presetModel }}</label>
        <select id="openaiPreset" (change)="applyPreset($event)">
          <option value="">-- Choose Preset Pricing --</option>
          @for (p of presets; track p.id) {
            <option [value]="p.id">{{p.id}}</option>
          }
        </select>
      </div>

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

      <div class="advanced-divider">{{ i18n().settings.modelPricingTitle }}</div>

      <div class="form-grid columns-3">
          <div class="form-group-vertical">
              <label>{{ i18n().settings.modelInput }} (1M)</label>
              <input type="number" step="0.01" [(ngModel)]="config.settings.inputPrice" (ngModelChange)="configChanged.emit()">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.modelCached }} (1M)</label>
              <input type="number" step="0.01" [(ngModel)]="config.settings.cacheInputPrice" (ngModelChange)="configChanged.emit()">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.modelOutput }} (1M)</label>
              <input type="number" step="0.01" [(ngModel)]="config.settings.outputPrice" (ngModelChange)="configChanged.emit()">
          </div>
      </div>

      <div class="advanced-divider">Sampling & Reasoning</div>
      
      <div class="form-grid columns-2">
          <div class="form-group-vertical">
              <label for="temp">{{ i18n().settings.temperature }}</label>
              <input id="temp" type="number" step="0.1" min="0" max="2" 
                     [(ngModel)]="config.settings.temperature" (ngModelChange)="configChanged.emit()">
          </div>
          <div class="form-group-vertical">
              <label for="maxTokens">{{ i18n().settings.maxTokens }}</label>
              <input id="maxTokens" type="number" step="128" min="1" 
                     [(ngModel)]="config.settings.maxOutputTokens" (ngModelChange)="configChanged.emit()">
          </div>
          <div class="form-group-vertical">
              <label for="freq">{{ i18n().settings.freqPenalty }}</label>
              <input id="freq" type="number" step="0.05" [(ngModel)]="config.settings.frequency_penalty" (ngModelChange)="configChanged.emit()">
          </div>
          <div class="form-group-vertical">
              <label for="pres">{{ i18n().settings.presPenalty }}</label>
              <input id="pres" type="number" step="0.05" [(ngModel)]="config.settings.presence_penalty" (ngModelChange)="configChanged.emit()">
          </div>
      </div>

      <div class="advanced-divider">Extended Config (OpenRouter/O1/O3)</div>
      
      <div class="form-group-toggle">
        <label>Use Chat Template Kwargs (OpenRouter/etc):</label>
        <input type="checkbox" [(ngModel)]="config.settings.additionalSettings!['useChatTemplateKwargs']" (ngModelChange)="configChanged.emit()">
      </div>

      @if (config.settings.additionalSettings!['useChatTemplateKwargs']) {
        <div class="extra-kwargs-panel">
          <div class="form-group-toggle">
            <label>Enable Thinking:</label>
            <input type="checkbox" [(ngModel)]="config.settings.additionalSettings!['enableThinking']" (ngModelChange)="configChanged.emit()">
          </div>
          @if (config.settings.additionalSettings!['enableThinking']) {
            <div class="form-group">
              <label>Reasoning Effort:</label>
              <select [(ngModel)]="config.settings.additionalSettings!['reasoningEffort']" (ngModelChange)="configChanged.emit()">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          }
        </div>
      }
    </div>
  `
})
export class OpenAIConfigComponent {
  config = inject(LLM_CONFIG_DATA);
  configChanged = output<void>();

  // I18n bridge
  private customTranslations = inject(LLM_TRANSLATIONS, { optional: true });
  public i18n = computed(() => this.customTranslations || DEFAULT_LLM_TRANSLATIONS);

  presets = [
    { id: 'gpt-5.2', input: 1.75, cached: 0.175, output: 14.00 },
    { id: 'gpt-5.1', input: 1.25, cached: 0.125, output: 10.00 },
    { id: 'gpt-5', input: 1.25, cached: 0.125, output: 10.00 },
    { id: 'gpt-5-mini', input: 0.25, cached: 0.025, output: 2.00 },
    { id: 'gpt-5-nano', input: 0.05, cached: 0.005, output: 0.40 },
    { id: 'gpt-5.2-chat-latest', input: 1.75, cached: 0.175, output: 14.00 },
    { id: 'gpt-5.1-chat-latest', input: 1.25, cached: 0.125, output: 10.00 },
    { id: 'gpt-5-chat-latest', input: 1.25, cached: 0.125, output: 10.00 },
    { id: 'gpt-5.3-codex', input: 1.75, cached: 0.175, output: 14.00 },
    { id: 'gpt-5.2-codex', input: 1.75, cached: 0.175, output: 14.00 },
    { id: 'gpt-5.1-codex-max', input: 1.25, cached: 0.125, output: 10.00 },
    { id: 'gpt-5.1-codex', input: 1.25, cached: 0.125, output: 10.00 },
    { id: 'gpt-5-codex', input: 1.25, cached: 0.125, output: 10.00 },
    { id: 'gpt-5.2-pro', input: 21.00, cached: 0, output: 168.00 },
    { id: 'gpt-5-pro', input: 15.00, cached: 0, output: 120.00 },
    { id: 'gpt-4.1', input: 2.00, cached: 0.50, output: 8.00 },
    { id: 'gpt-4.1-mini', input: 0.40, cached: 0.10, output: 1.60 },
    { id: 'gpt-4.1-nano', input: 0.10, cached: 0.025, output: 0.40 },
    { id: 'gpt-4o', input: 2.50, cached: 1.25, output: 10.00 },
    { id: 'gpt-4o-mini', input: 0.15, cached: 0.075, output: 0.60 },
    { id: 'gpt-4o-audio-preview', input: 2.50, cached: 0, output: 10.00 },
    { id: 'gpt-4o-mini-audio-preview', input: 0.15, cached: 0, output: 0.60 },
    { id: 'o1', input: 15.00, cached: 7.50, output: 60.00 },
    { id: 'o1-pro', input: 150.00, cached: 0, output: 600.00 },
    { id: 'o3-pro', input: 20.00, cached: 0, output: 80.00 },
    { id: 'o3', input: 2.00, cached: 0.50, output: 8.00 },
    { id: 'o3-deep-research', input: 10.00, cached: 2.50, output: 40.00 },
    { id: 'o4-mini', input: 1.10, cached: 0.275, output: 4.40 },
    { id: 'o4-mini-deep-research', input: 2.00, cached: 0.50, output: 8.00 },
    { id: 'o3-mini', input: 1.10, cached: 0.55, output: 4.40 },
    { id: 'o1-mini', input: 1.10, cached: 0.55, output: 4.40 },
  ];

  constructor() {
    if (!this.config.settings.additionalSettings) {
      this.config.settings.additionalSettings = {};
    }
  }

  applyPreset(event: any) {
    const id = event.target.value;
    const preset = this.presets.find(p => p.id === id);
    if (preset) {
      this.config.settings.modelId = preset.id;
      this.config.settings.inputPrice = preset.input;
      this.config.settings.cacheInputPrice = preset.cached;
      this.config.settings.outputPrice = preset.output;
      this.configChanged.emit();
    }
  }
}
