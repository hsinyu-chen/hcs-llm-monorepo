# HCS LLM Provider Monorepo

A modular LLM provider management system built with a pure TypeScript core and an Angular UI layer.

## Overview

This repository provides a decoupled architecture for managing multiple LLM providers, including support for real-time progress tracking, automated model discovery, and centralized configuration management.

## Core Features

- **Prefill Progress Tracking**: Support for real-time prompt processing metrics including total tokens, processed tokens, and cache hits.
- **Automated Model Discovery**: Integrated logic for Llama.cpp to automatically fetch model aliases from the server props endpoint.
- **Reasoning Control**: Configuration support for thinking and reasoning levels for supported providers.
- **Centralized UI Styling**: Unified style inheritance for all provider configuration components via the settings orchestrator.
- **Multi-Profile Management**: Support for multiple independent configuration profiles persisted via IndexedDB.

## Module Structure

### Core (Logic Layer)
- `@hcs/llm-core`: Interfaces, provider registry, manager, and base storage logic.
- `@hcs/llm-provider-gemini`: Logic for Google Gemini integration.
- `@hcs/llm-provider-openai`: Logic for OpenAI and compatible endpoints.
- `@hcs/llm-provider-llama-cpp`: Logic for Llama.cpp server integration.

### Angular (UI Layer)
- `@hcs/llm-angular-common`: Shared tokens for translations and portals.
- `@hcs/llm-angular-settings`: The primary settings orchestrator component.
- `@hcs/llm-angular-ui-*`: Specific configuration UI fragments for each provider.

## Usage Guide

### 1. Provider and Storage Setup
Inject the core services into your Angular application:

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
          presetModel: 'Custom Model Label'
        }
      }
    }
  ]
};
```

### 2. UI Integration
Include the settings component in your template:

```html
<!-- settings.page.html -->
<hcs-llm-settings></hcs-llm-settings>
```

### 3. Profile Management
Configuration profiles are managed via the `LLMStorage` interface.
- **Independent Profiles**: Each profile maintains its own credentials, endpoints, and provider-specific settings.
- **Dynamic Retrieval**: Use `LLMManager.getProviderByConfigId(id)` to retrieve the corresponding provider instance for a specific profile.
- **Styles**: Provider UI components utilize shared classes (`.provider-fields`, `.form-group`) defined in the settings package for visual consistency.

## Usage Metadata

Providers return detailed metrics for prompt processing:

```typescript
// LLMUsageMetadata
{
  promptProgress: number;   // Value between 0 and 1
  promptTotal: number;      // Total prompt tokens
  promptProcessed: number;  // Tokens processed so far
  promptCache: number;     // Tokens served from cache
}
```

## Development

```bash
# Build all packages
npm run build --workspaces

# Run the playground environment
cd packages/playground
npm start
```

---

## Customization

### 1. Internationalization (i18n)
The UI components use the `LLM_TRANSLATIONS` token. You can provide a custom implementation in your application configuration:

```typescript
import { LLM_TRANSLATIONS, DEFAULT_LLM_TRANSLATIONS } from '@hcs/llm-angular-common';

const customTranslations = {
  ...DEFAULT_LLM_TRANSLATIONS,
  settings: {
    ...DEFAULT_LLM_TRANSLATIONS.settings,
    modelId: 'Custom Model Label'
  }
};

providers: [
  { provide: LLM_TRANSLATIONS, useValue: customTranslations }
]
```

### 2. Storage Backend
The core logic relies on the `ILLMStorage` interface. The default implementation is `BrowserIndexedDBStorage`, but it can be replaced with any class implementing the required methods (`getAll`, `getById`, `save`, `delete`):

```typescript
import { ILLMStorage } from '@hcs/llm-core';

export class MyCustomStorage implements ILLMStorage {
  // Implement interface methods
}

providers: [
  { provide: ILLMStorage, useClass: MyCustomStorage }
]
```
