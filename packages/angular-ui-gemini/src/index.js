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
exports.GeminiConfigComponent = void 0;
const core_1 = require("@angular/core");
const common_1 = require("@angular/common");
const forms_1 = require("@angular/forms");
const llm_angular_common_1 = require("@hcs/llm-angular-common");
const llm_provider_gemini_1 = require("@hcs/llm-provider-gemini");
let GeminiConfigComponent = class GeminiConfigComponent {
    config = (0, core_1.inject)(llm_angular_common_1.LLM_CONFIG_DATA);
    // Instance normally provided via DI or Registry
    provider = new llm_provider_gemini_1.GeminiProvider();
    get models() { return this.provider.getAvailableModels(this.config.settings); }
    modelId = (0, core_1.signal)(this.config.settings.modelId || this.provider.getDefaultModelId());
    configChanged = (0, core_1.output)();
    constructor() {
        if (!this.config.settings.additionalSettings) {
            this.config.settings.additionalSettings = {};
        }
    }
    onModelChange(newModelId) {
        this.modelId.set(newModelId);
        this.config.settings.modelId = newModelId;
        this.configChanged.emit();
    }
    thinkingLevels = (0, core_1.computed)(() => {
        const selectedModel = this.models.find(m => m.id === this.modelId());
        return selectedModel?.allowedThinkingLevels ?? ['minimal', 'low', 'medium', 'high'];
    });
    supportsThinking = (0, core_1.computed)(() => {
        const selectedModel = this.models.find(m => m.id === this.modelId());
        return selectedModel?.supportsThinking ?? false;
    });
};
exports.GeminiConfigComponent = GeminiConfigComponent;
exports.GeminiConfigComponent = GeminiConfigComponent = __decorate([
    (0, core_1.Component)({
        selector: 'hcs-gemini-config',
        standalone: true,
        imports: [common_1.CommonModule, forms_1.FormsModule],
        template: `
    <div class="provider-fields">
      <div class="form-group">
        <label for="geminiKey">Gemini API Key:</label>
        <input id="geminiKey" type="password" [(ngModel)]="config.settings.apiKey" placeholder="AIza...">
      </div>

      <div class="form-group">
        <label for="geminiModel">Model ID:</label>
        <select id="geminiModel" [ngModel]="modelId()" (ngModelChange)="onModelChange($event)">
          @for (m of models; track m.id) {
            <option [value]="m.id">{{m.name}}</option>
          }
        </select>
      </div>

      @if (supportsThinking()) {
        <div class="form-group">
          <label for="thinkingLevel">Thinking Level:</label>
          <select id="thinkingLevel" 
                  [(ngModel)]="config.settings.additionalSettings!['thinkingLevel']"
                  (ngModelChange)="configChanged.emit()">
            @for (level of thinkingLevels(); track level) {
              <option [value]="level">{{level}}</option>
            }
          </select>
          <small class="field-note">Configures the reasoning depth for models that support it.</small>
        </div>
      }
    </div>
  `,
        styles: [`
    .provider-fields { display: flex; flex-direction: column; gap: 4px; }
    .form-group {
      display: grid;
      grid-template-columns: 140px 1fr;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      label { color: #8b949e; font-size: 0.9em; font-weight: 500; }
      input, select {
        width: 100%;
        padding: 10px;
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 6px;
        color: white;
        &:focus { border-color: #58a6ff; outline: none; }
      }
      .field-note { grid-column: 2; font-size: 0.8em; color: #8b949e; }
    }
  `]
    }),
    __metadata("design:paramtypes", [])
], GeminiConfigComponent);
//# sourceMappingURL=index.js.map