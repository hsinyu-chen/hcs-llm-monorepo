# HCS LLM Provider Monorepo (Professional Edition)

這是一個為 HCS 系列專案（如 TextRPG v2, LLMAvalon）量身打造的專業 LLM 提供者管理系統。採用 **純 TypeScript 核心** 與 **Angular UI 插件化** 架構，確保邏輯、介面與樣式的高度解耦。

## 🌟 核心特性 (Parity with TextRPG/Avalon)

- **1:1 功能對標**：完整移植 TextRPG 的 `LlamaV2Service` 進階特性，包含 **PP 進度追蹤 (Prefill Progress)**。
- **自動模型偵測**：Llama.cpp 提供者支援一鍵抓取 `/props` 端點的模型別名，無需手動填寫。
- **推論思維控制 (Reasoning)**：深度整合 Gemini 與 Llama.cpp 的 `Thinking/Reasoning` 參數。
- **中央化樣式繼承**：所有 Provider UI 均自動承襲主控端的 Premium 黑金風格，無需重複撰寫 SCSS。
- **高擴展多 Profile 架構**：原生支援 IndexedDB 多配置儲存與管理。

---

## 🏗️ 模組結構

### Core (Logic Layer)
- `@hcs/llm-core`: 定義所有介面 (`LLMProvider`)、註冊表與 `LLMManager`。
- `@hcs/llm-provider-gemini`: Google Gemini 串接邏輯。
- `@hcs/llm-provider-openai`: OpenAI 與相容端點邏輯。
- `@hcs/llm-provider-llama-cpp`: 專為本地模型優化的連線邏輯。

### Angular (UI Layer)
- `@hcs/llm-angular-common`: 共享 Tokens (I18n, Portals)。
- `@hcs/llm-angular-settings`: 核心設定面板組件（Orchestrator）。
- `@hcs/llm-angular-ui-*`: 各個 Provider 專屬的配置介面片段。

---

## 🚀 快速上手 (UI 整合)

### 1. 安裝環境與 Provider
在您的 Angular 應用中注入核心服務與 UI 翻譯：

```typescript
// app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    { provide: ILLMStorage, useClass: BrowserIndexedDBStorage },
    { 
      provide: LLM_TRANSLATIONS, 
      useValue: {
        ...DEFAULT_LLM_TRANSLATIONS,
        settings: {
          ...DEFAULT_LLM_TRANSLATIONS.settings,
          presetModel: 'Avalon 引導思考模型' // 客製化翻譯
        }
      }
    }
  ]
};
```

### 2. 加入設定面板
在您的主畫面或設定頁面中加入 `<hcs-llm-settings>`：

```html
<!-- settings.page.html -->
<hcs-llm-settings></hcs-llm-settings>
```

### 3. 多 Profile 管理機制
本系統透過 `LLMStorage` 自動處理多組配置的持久化。

- **獨立配置**：每個 Profile 擁有獨立的 `providerId`、`baseUrl`、`modelId` 與 `additionalSettings`。
- **動態切換**：透過 `LLMManager.getProviderByConfigId(id)` 即可取得對應的執行實例。
- **樣式繼承**：Provider UI 只需使用 `.provider-fields` -> `.form-group` 結構，即可自動獲得由 `angular-settings` 提供的一致性視覺外觀。

---

## 📊 Prefill Progress (PP) 指標說明

針對大型 Prompt 處理，新版 Provider 提供細粒度的數據回傳：

```typescript
// LLMUsageMetadata
{
  promptProgress: 0.85,    // 0~1 的處理進度
  promptTotal: 2048,      // 總 Token 數
  promptProcessed: 1740,  // 已處理 Token 數
  promptCache: 1024       // 已命中快取數
}
```

---

## 🛠️ 開發與編譯

本專案採用 NPM Workspaces 管理：

```bash
# 全域編譯所有模組
npm run build --workspaces

# 啟動 Playground 測試環境
cd packages/playground
npm start
```
