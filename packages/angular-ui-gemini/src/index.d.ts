export declare class GeminiConfigComponent {
    config: import("@hcs/llm-core").LLMConfig;
    private provider;
    get models(): import("@hcs/llm-core").LLMModelDefinition[];
    modelId: import("@angular/core", { with: { "resolution-mode": "import" } }).WritableSignal<string>;
    configChanged: import("@angular/core", { with: { "resolution-mode": "import" } }).OutputEmitterRef<void>;
    constructor();
    onModelChange(newModelId: string): void;
    thinkingLevels: import("@angular/core", { with: { "resolution-mode": "import" } }).Signal<string[]>;
    supportsThinking: import("@angular/core", { with: { "resolution-mode": "import" } }).Signal<boolean>;
}
//# sourceMappingURL=index.d.ts.map