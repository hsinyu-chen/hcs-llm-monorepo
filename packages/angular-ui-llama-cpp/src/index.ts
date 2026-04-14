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
        <input id="llamaModel" type="text" [(ngModel)]="config.settings.modelId" 
               placeholder="local-model" (ngModelChange)="configChanged.emit()">
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
    </div>
  `,
  styles: [`
    .provider-fields { display: flex; flex-direction: column; gap: 4px; }
    .form-group {
      display: grid;
      grid-template-columns: 140px 1fr;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      label { color: #8b949e; font-size: 0.85em; font-weight: 500; }
      input[type="text"] { width: 100%; padding: 8px; background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: white; }
    }
    .advanced-divider { font-size: 0.7rem; color: #58a6ff; margin-top: 12px; border-bottom: 1px solid #30363d; padding-bottom: 2px; }
    .form-grid { display: grid; gap: 8px; &.columns-2 { grid-template-columns: 1fr 1fr; } }
    .form-group-vertical {
        label { display: block; font-size: 0.7rem; color: #8b949e; margin-bottom: 2px; }
        input { width: 100%; padding: 4px 8px; background: #0d1117; border: 1px solid #30363d; border-radius: 4px; color: white; }
    }
  `]
})
export class LlamaConfigComponent {
  config = inject(LLM_CONFIG_DATA);
  configChanged = output<void>();

  constructor() {
    if (!this.config.settings.additionalSettings) {
      this.config.settings.additionalSettings = {};
    }
  }
}
