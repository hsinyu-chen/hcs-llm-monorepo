import { Component, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LLM_CONFIG_DATA } from '@hcs/llm-angular-common';
import { LlamaCppProvider } from '@hcs/llm-provider-llama-cpp';

@Component({
  selector: 'hcs-llama-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="provider-fields">
      <div class="form-group">
        <label for="llamaUrl">Base URL:</label>
        <input id="llamaUrl" type="text" [(ngModel)]="config.settings.baseUrl" 
               placeholder="http://localhost:8080" (ngModelChange)="configChanged.emit()">
      </div>

      <div class="form-group">
        <label for="llamaModel">Model Name:</label>
        <div class="input-with-action">
          <input id="llamaModel" type="text" [(ngModel)]="config.settings.modelId" 
                 placeholder="local-model" (ngModelChange)="configChanged.emit()">
          <button class="refresh-btn" (click)="refreshModel()" [disabled]="isRefreshing" [title]="'Refresh from server'">
            {{ isRefreshing ? '...' :'🔄' }}
          </button>
        </div>
      </div>

      <div class="advanced-divider">SAMPLING & PENALTIES</div>
      
      <div class="form-grid columns-2">
          <div class="form-group-vertical">
              <label>Temperature</label>
              <input type="number" step="0.1" [(ngModel)]="config.settings.temperature" (ngModelChange)="configChanged.emit()">
          </div>
          <div class="form-group-vertical">
              <label>Min P</label>
              <input type="number" step="0.05" [(ngModel)]="config.settings.additionalSettings!['minP']" (ngModelChange)="configChanged.emit()">
          </div>
          <div class="form-group-vertical">
              <label>Repeat Penalty</label>
              <input type="number" step="0.05" [(ngModel)]="config.settings.additionalSettings!['repetitionPenalty']" (ngModelChange)="configChanged.emit()">
          </div>
          <div class="form-group-vertical">
              <label>Max Tokens</label>
              <input type="number" step="256" [(ngModel)]="config.settings.maxOutputTokens" (ngModelChange)="configChanged.emit()">
          </div>
      </div>

      <div class="advanced-divider">REASONING</div>
      <div class="form-group">
          <label>Enable Thinking:</label>
          <input type="checkbox" [(ngModel)]="config.settings.additionalSettings!['enableThinking']" (ngModelChange)="configChanged.emit()">
      </div>
      @if (config.settings.additionalSettings!['enableThinking']) {
        <div class="form-group">
            <label>Reasoning Effort:</label>
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
  
  private provider = new LlamaCppProvider();
  isRefreshing = false;

  constructor() {
    if (!this.config.settings.additionalSettings) {
      this.config.settings.additionalSettings = {};
    }
  }

  async refreshModel() {
    this.isRefreshing = true;
    try {
      const models = await this.provider.getAvailableModels(this.config.settings);
      if (models && models.length > 0) {
        this.config.settings.modelId = models[0].id;
        this.configChanged.emit();
      }
    } catch (e) {
      console.error('Failed to refresh model alias', e);
    } finally {
      this.isRefreshing = false;
    }
  }
}
