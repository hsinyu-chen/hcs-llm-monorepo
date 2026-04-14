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
exports.OpenAIConfigComponent = void 0;
const core_1 = require("@angular/core");
const common_1 = require("@angular/common");
const forms_1 = require("@angular/forms");
const llm_angular_common_1 = require("@hcs/llm-angular-common");
let OpenAIConfigComponent = class OpenAIConfigComponent {
    config = (0, core_1.inject)(llm_angular_common_1.LLM_CONFIG_DATA);
    configChanged = (0, core_1.output)();
    constructor() {
        if (!this.config.settings.additionalSettings) {
            this.config.settings.additionalSettings = {};
        }
    }
};
exports.OpenAIConfigComponent = OpenAIConfigComponent;
exports.OpenAIConfigComponent = OpenAIConfigComponent = __decorate([
    (0, core_1.Component)({
        selector: 'hcs-openai-config',
        standalone: true,
        imports: [common_1.CommonModule, forms_1.FormsModule],
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
    }),
    __metadata("design:paramtypes", [])
], OpenAIConfigComponent);
//# sourceMappingURL=index.js.map