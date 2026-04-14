"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlamaConfigComponent = void 0;
const core_1 = require("@angular/core");
const common_1 = require("@angular/common");
const forms_1 = require("@angular/forms");
const llm_angular_common_1 = require("@hcs/llm-angular-common");
let LlamaConfigComponent = class LlamaConfigComponent {
    config = (0, core_1.inject)(llm_angular_common_1.LLM_CONFIG_DATA);
    configChanged = (0, core_1.output)();
    constructor() {
        if (!this.config.settings.additionalSettings) {
            this.config.settings.additionalSettings = {};
        }
    }
};
exports.LlamaConfigComponent = LlamaConfigComponent;
exports.LlamaConfigComponent = LlamaConfigComponent = __decorate([
    (0, core_1.Component)({
        selector: 'hcs-llama-config',
        standalone: true,
        imports: [common_1.CommonModule, forms_1.FormsModule],
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
    }),
    __metadata("design:paramtypes", [])
], LlamaConfigComponent);
//# sourceMappingURL=index.js.map