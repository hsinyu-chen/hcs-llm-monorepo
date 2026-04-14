---
trigger: always_on
---

***
description: Project Coding Standards and Rules for HCS LLM Monorepo
***

# Code Quality Rules

- NO `@ts-ignore` (Strict Type Safety)
- NO `any` `unknown` (Use proper interfaces/types)

## Build Before Report
- use `npm run build` to verify all packages before committing.
- Ensure all packages in the workspace compile without errors.

## Env
- Windows, Powershell

# ANGULAR CODING STANDARDS (v18+)
**THIS IS ZONELESS COMPATIBLE UI LAYER**

## 🚫 NEGATIVE CONSTRAINTS (HARD BANS)
1. **NO Manual Subscriptions**: BANNED `.subscribe()`. Use Signals, `effect`, or `toSignal`.
2. **NO Constructor Injection**: BANNED `constructor(private http: HttpClient)`. Use `inject()`.
3. **NO Zone.js**: Keep components Zoneless-friendly. Avoid logic that relies on synchronous zone-based change detection.
4. **NO Classic Decorators**: BANNED `@Input`, `@Output`, `@ViewChild`. Use Signal-based `input()`, `output()`, `viewChild()`.
5. **NO Modules**: Standalone Components ONLY.
6. **NO Computed Side-Effects**: Do not use `computed()` for writable state.

## ✅ REQUIRED PATTERNS (DO THIS)

### 1. Signal IO & Queries
- `input.required<T>()` / `output<T>()` / `model<T>()`
- `viewChild.required<T>()` / `contentChild.required<T>()`

### 2. Dependency Injection
- Use `inject()` for all services and tokens: `private storage = inject(LLM_STORAGE_TOKEN);`

### 3. Change Detection
- `ChangeDetectionStrategy.OnPush` (Always for UI components).

### 4. Decoupling
- **Logic vs. UI**: Keep AI logic in the pure TS providers (`packages/provider-*`). 
- **Framework Agnostic**: Core packages MUST NOT depend on `@angular/core`.

## 📝 MONOREPO STANDARDS

- **Package Scoping**: All internal packages must use `@hcs/` scope.
- **Independence**: UI packages depend on `core` and `common`, but `core` must remain zero-dependency.
- **Entry Points**: Every package must have a `src/index.ts` exporting its public API.
