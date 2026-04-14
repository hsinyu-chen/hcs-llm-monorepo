import { Component, inject, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_CONFIG_DATA, LLM_TRANSLATIONS, DEFAULT_LLM_TRANSLATIONS } from '@hcs/llm-angular-common';
import { LlamaCppProvider } from '@hcs/llm-provider-llama-cpp';

@Component({
  selector: 'hcs-llama-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styles: [`
    .provider-fields { position: relative; }
    .refresh-mask {
        position: absolute;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.3);
        backdrop-filter: blur(2px);
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        color: #fff;
        font-weight: bold;
        pointer-events: none;
    }
  `],
  template: `
    <div class="provider-fields">
      @if (isRefreshing()) {
        <div class="refresh-mask">REFRESHING...</div>
      }

      <div class="form-group">
        <label for="llamaUrl">Base URL:</label>
        <div class="input-with-action">
          <input id="llamaUrl" type="text" [(ngModel)]="config.settings.baseUrl" 
                 placeholder="http://localhost:8080" (ngModelChange)="configChanged.emit()">
          <button class="refresh-btn" (click)="refreshModel()" [disabled]="isRefreshing()" [title]="'Refresh from server'">
            {{ isRefreshing() ? '...' :'🔄' }}
          </button>
        </div>
      </div>

      <div class="form-group">
        <label for="llamaModel">Model Name:</label>
        <input id="llamaModel" type="text" [(ngModel)]="config.settings.modelId" 
               placeholder="local-model" (ngModelChange)="configChanged.emit()">
      </div>

      <div class="advanced-divider">{{ i18n().settings.modelPricingTitle }}</div>
      <div class="form-grid columns-3">
          <div class="form-group-vertical">
              <label>{{ i18n().settings.customInputPrice }}</label>
              <input type="number" step="0.01" [(ngModel)]="config.settings.inputPrice" (ngModelChange)="configChanged.emit()" placeholder="0.00">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.customCachePrice }}</label>
              <input type="number" step="0.01" [(ngModel)]="config.settings.cacheInputPrice" (ngModelChange)="configChanged.emit()" placeholder="0.00">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.customOutputPrice }}</label>
              <input type="number" step="0.01" [(ngModel)]="config.settings.outputPrice" (ngModelChange)="configChanged.emit()" placeholder="0.00">
          </div>
      </div>

      <div class="advanced-divider">SAMPLING & PENALTIES</div>
      
      <div class="form-grid columns-3">
          <div class="form-group-vertical">
              <label>{{ i18n().settings.temperature }}</label>
              <input type="number" step="0.1" [(ngModel)]="config.settings.temperature" (ngModelChange)="configChanged.emit()" placeholder="0.7">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.freqPenalty }}</label>
              <input type="number" step="0.05" [(ngModel)]="config.settings.frequency_penalty" (ngModelChange)="configChanged.emit()" placeholder="0.0">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.presPenalty }}</label>
              <input type="number" step="0.05" [(ngModel)]="config.settings.presence_penalty" (ngModelChange)="configChanged.emit()" placeholder="0.0">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.topP }}</label>
              <input type="number" step="0.05" [(ngModel)]="config.settings.additionalSettings!['topP']" (ngModelChange)="configChanged.emit()" placeholder="0.95">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.topK }}</label>
              <input type="number" step="1" [(ngModel)]="config.settings.additionalSettings!['topK']" (ngModelChange)="configChanged.emit()" placeholder="40">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.minP }}</label>
              <input type="number" step="0.05" [(ngModel)]="config.settings.additionalSettings!['minP']" (ngModelChange)="configChanged.emit()" placeholder="0.05">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.repeatPenalty }}</label>
              <input type="number" step="0.05" [(ngModel)]="config.settings.additionalSettings!['repetitionPenalty']" (ngModelChange)="configChanged.emit()" placeholder="1.1">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.maxTokens }}</label>
              <input type="number" step="256" [(ngModel)]="config.settings.maxOutputTokens" (ngModelChange)="configChanged.emit()" placeholder="4096">
          </div>
      </div>

      <div class="advanced-divider">REASONING</div>
      <div class="form-group-toggle">
          <label>Enable Thinking:</label>
          <input type="checkbox" [(ngModel)]="config.settings.additionalSettings!['enableThinking']" (ngModelChange)="configChanged.emit()">
      </div>
      @if (config.settings.additionalSettings!['enableThinking']) {
        <div class="form-group">
            <label>Reasoning Effort (Budget):</label>
            <select [(ngModel)]="config.settings.additionalSettings!['reasoningEffort']" (ngModelChange)="configChanged.emit()">
                <option value="low">Low (512)</option>
                <option value="medium">Medium (2048)</option>
                <option value="high">High (8192)</option>
            </select>
        </div>
      }
    </div>
  `
})
export class LlamaConfigComponent {
  config = inject(LLM_CONFIG_DATA);
  configChanged = output<void>();

  // I18n bridge
  private customTranslations = inject(LLM_TRANSLATIONS, { optional: true });
  public i18n = computed(() => this.customTranslations || DEFAULT_LLM_TRANSLATIONS);
  
  private provider = new LlamaCppProvider();
  isRefreshing = signal(false);

  constructor() {
    if (!this.config.settings.additionalSettings) {
      this.config.settings.additionalSettings = {};
    }
  }

  async refreshModel() {
    this.isRefreshing.set(true);
    try {
      const models = await this.provider.getAvailableModels(this.config.settings);
      if (models && models.length > 0) {
        this.config.settings.modelId = models[0].id;
        this.configChanged.emit();
      }
    } catch (e) {
      console.error('Failed to refresh model alias', e);
    } finally {
      this.isRefreshing.set(false);
    }
  }
}
