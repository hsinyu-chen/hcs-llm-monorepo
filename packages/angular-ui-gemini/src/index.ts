import { Component, inject, computed, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_CONFIG_DATA, LLM_TRANSLATIONS, DEFAULT_LLM_TRANSLATIONS } from '@hcs/llm-angular-common';
import { GeminiProvider } from '@hcs/llm-provider-gemini';

@Component({
  selector: 'hcs-gemini-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="provider-fields">
      <div class="form-group">
        <label for="geminiKey">Gemini API Key:</label>
        <input id="geminiKey" type="password" [(ngModel)]="config.settings.apiKey" placeholder="AIza..." (ngModelChange)="configChanged.emit()">
      </div>

      <div class="form-group">
        <label for="geminiModel">{{ i18n().settings.presetModel }}</label>
        <select id="geminiModel" [ngModel]="modelId()" (ngModelChange)="onModelChange($event)">
          @for (m of models(); track m.id) {
            <option [value]="m.id">{{m.name}}</option>
          }
        </select>
      </div>

      @if (supportsThinking()) {
        <div class="form-group">
          <label for="thinkingLevel">Reasoning Depth:</label>
          <select id="thinkingLevel" 
                  [(ngModel)]="config.settings.additionalSettings!['thinkingLevel']"
                  (ngModelChange)="configChanged.emit()">
            @for (level of thinkingLevels(); track level) {
              <option [value]="level">{{level}}</option>
            }
          </select>
        </div>
      }

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
              <label>{{ i18n().settings.topP }}</label>
              <input type="number" step="0.05" [(ngModel)]="config.settings.additionalSettings!['topP']" (ngModelChange)="configChanged.emit()" placeholder="0.95">
          </div>
          <div class="form-group-vertical">
              <label>{{ i18n().settings.topK }}</label>
              <input type="number" step="1" [(ngModel)]="config.settings.additionalSettings!['topK']" (ngModelChange)="configChanged.emit()" placeholder="40">
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
              <label>{{ i18n().settings.maxTokens }}</label>
              <input type="number" step="256" [(ngModel)]="config.settings.maxOutputTokens" (ngModelChange)="configChanged.emit()" placeholder="4096">
          </div>
      </div>
    </div>
  `
})
export class GeminiConfigComponent {
  config = inject(LLM_CONFIG_DATA);

  // I18n bridge
  private customTranslations = inject(LLM_TRANSLATIONS, { optional: true });
  public i18n = computed(() => this.customTranslations || DEFAULT_LLM_TRANSLATIONS);
  
  // Instance normally provided via DI or Registry
  private provider = new GeminiProvider();

  models = signal<any[]>([]);

  modelId = signal(this.config.settings.modelId || this.provider.getDefaultModelId());
  configChanged = output<void>();

  constructor() {
    if (!this.config.settings.additionalSettings) {
      this.config.settings.additionalSettings = {};
    }
    this.loadModels();
  }

  async loadModels() {
    const list = await this.provider.getAvailableModels(this.config.settings);
    this.models.set(list);
  }

  onModelChange(newModelId: string) {
    this.modelId.set(newModelId);
    this.config.settings.modelId = newModelId;
    this.configChanged.emit();
  }

  thinkingLevels = computed(() => {
    const selectedModel = this.models().find(m => m.id === this.modelId());
    return selectedModel?.allowedThinkingLevels ?? ['minimal', 'low', 'medium', 'high'];
  });

  supportsThinking = computed(() => {
    const selectedModel = this.models().find(m => m.id === this.modelId());
    return selectedModel?.supportsThinking ?? false;
  });
}
