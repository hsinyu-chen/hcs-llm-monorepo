import {
    LLMProvider,
    LLMProviderCapabilities,
    LLMProviderConfig,
    LLMContent,
    LLMFunctionCall,
    LLMGenerateConfig,
    LLMStreamChunk,
    LLMModelDefinition,
    LLMCacheInfo
} from '@hcs/llm-core';

interface LlamaCppToolCallAccumulator {
    id: string;
    name: string;
    argsBuffer: string;
}

interface PropsShape {
    modelAlias: string | null;
    contextSize: number | null;
    chatTemplate: string | null;
    chatTemplateCaps: {
        supports_tools?: boolean;
        supports_tool_calls?: boolean;
        supports_parallel_tool_calls?: boolean;
    } | null;
}

interface PropsCacheEntry {
    /** Resolved value when the fetch completed; null while in-flight. */
    value: PropsShape | null;
    /** Pending promise when in-flight; absent once resolved (so further hits read `value`). */
    pending?: Promise<PropsShape>;
    /** Unix-ms timestamp after which the cached value is treated as stale. */
    expiresAt: number;
}

/** Time-to-live for /props cache entries. Two competing concerns:
 *    - Long enough to absorb the burst of callers (getAvailableModels,
 *      probeNativeToolSupport, probeParallelToolSupport, fetchModelAlias,
 *      agentContextInfo) at page-load and across rapid signal updates.
 *    - Short enough that a server-side model swap surfaces quickly so we
 *      don't keep showing stale chat_template_caps / contextSize / modelAlias
 *      to the user.
 *  10s is the chosen balance: page-load callers all fire within <500ms so
 *  they fully share the cached entry, but the staleness window is short
 *  enough that the user notices a swap within ~10s of next interaction.
 *  The UI's "🔄 refresh" button bypasses this via invalidatePropsCache. */
const PROPS_CACHE_TTL_MS = 10_000;

export class LlamaCppProvider implements LLMProvider {
    readonly providerName = 'llama.cpp';
    settingsComponentId = 'llama-settings';

    /** Per-baseUrl cache. Static so all instances share — page-load callers
     *  may construct multiple LlamaCppProvider instances (registry +
     *  settings-UI new-up) but they all hit the same server. */
    private static propsCache = new Map<string, PropsCacheEntry>();

    /** Force the next fetchProps for `baseUrl` (or all baseUrls if omitted) to
     *  bypass the cache. Call this from UI affordances that imply the user
     *  expects a fresh read — e.g. the "🔄 refresh from server" button. */
    static invalidatePropsCache(baseUrl?: string): void {
        if (baseUrl === undefined) {
            LlamaCppProvider.propsCache.clear();
        } else {
            LlamaCppProvider.propsCache.delete(baseUrl.replace(/\/$/, ''));
        }
    }

    private extractConfig(config: LLMProviderConfig) {
        const cleanStr = (val: any) => (typeof val === 'string' && val.trim() === '') ? undefined : val;
        const settings = config.additionalSettings || {};

        return {
            baseUrl: config.baseUrl ? config.baseUrl.replace(/\/$/, '') : 'http://localhost:8080',
            modelId: cleanStr(config.modelId) || 'local-model',
            temperature: cleanStr(config.temperature) as number | undefined,
            frequencyPenalty: cleanStr(config.frequency_penalty) as number | undefined,
            presencePenalty: cleanStr(config.presence_penalty) as number | undefined,
            inputPrice: cleanStr(config.inputPrice) as number | undefined,
            cacheInputPrice: cleanStr(config.cacheInputPrice) as number | undefined,
            outputPrice: cleanStr(config.outputPrice) as number | undefined,
            topP: cleanStr(settings['topP']) as number | undefined,
            topK: cleanStr(settings['topK']) as number | undefined,
            minP: cleanStr(settings['minP']) as number | undefined,
            repetitionPenalty: cleanStr(settings['repetitionPenalty']) as number | undefined,
            enableThinking: (settings['enableThinking'] === undefined ? false : settings['enableThinking']) as boolean,
            reasoningEffort: (settings['reasoningEffort'] === undefined ? 'low' : settings['reasoningEffort']) as string
        };
    }

    isConfigured(config: LLMProviderConfig): boolean {
        return !!(config.baseUrl && config.baseUrl.trim());
    }

    getCapabilities(config?: LLMProviderConfig): LLMProviderCapabilities {
        // llama.cpp tool support is per-GGUF (chat template). The static
        // default is conservative (false); callers may override per profile
        // via additionalSettings.supportsNativeToolCalls, and async callers
        // can use probeNativeToolSupport() to auto-detect from the loaded
        // chat_template.
        const flag = config?.additionalSettings?.['supportsNativeToolCalls'];
        const supportsNativeToolCalls = typeof flag === 'boolean' ? flag : false;
        const parallelFlag = config?.additionalSettings?.['supportsParallelToolCalls'];
        const supportsParallelToolCalls = typeof parallelFlag === 'boolean'
            ? parallelFlag
            : false; // Conservative default; the async probe upgrades this when chat_template_caps says yes.
        return {
            supportsContextCaching: true,
            supportsThinking: true,
            supportsStructuredOutput: true,
            isLocalProvider: true,
            supportsSpeedMetrics: true,
            cacheBakesContent: false,
            supportsNativeToolCalls,
            supportsParallelToolCalls
        };
    }

    /**
     * Ask the live endpoint whether the loaded GGUF supports native tool
     * calling. Two signals are checked in order:
     *
     *   1. `/props` -> `chat_template_caps`. Recent llama.cpp versions parse
     *      the chat template themselves and surface explicit booleans
     *      (`supports_tools`, `supports_tool_calls`). When present this is
     *      authoritative — no regex guesswork needed.
     *   2. `/props` -> `chat_template` (string). Fallback for older
     *      llama-server builds that predate `chat_template_caps`. We scan
     *      for tool-related tokens that appear in tool-aware templates
     *      (Hermes-2-Pro, Llama-3.1+, Qwen 2.5+, Mistral).
     *
     * Errors return false so callers safely fall back to JSON-schema mode.
     */
    async probeNativeToolSupport(config: LLMProviderConfig): Promise<boolean> {
        const { baseUrl } = this.extractConfig(config);
        const props = await this.fetchProps(baseUrl);
        if (props.chatTemplateCaps) {
            return !!(props.chatTemplateCaps.supports_tools && props.chatTemplateCaps.supports_tool_calls);
        }
        return this.detectToolSupportFromTemplate(props.chatTemplate);
    }

    /**
     * Reads `chat_template_caps.supports_parallel_tool_calls` when the live
     * llama-server build exposes it. Older builds without `chat_template_caps`
     * are conservatively reported as false (no regex fallback — the chat
     * template wording for parallel calls is not stable enough to detect).
     */
    async probeParallelToolSupport(config: LLMProviderConfig): Promise<boolean> {
        const { baseUrl } = this.extractConfig(config);
        const props = await this.fetchProps(baseUrl);
        return !!props.chatTemplateCaps?.supports_parallel_tool_calls;
    }

    private detectToolSupportFromTemplate(chatTemplate: string | null): boolean {
        if (!chatTemplate) return false;
        // Tokens / keywords that appear in tool-aware chat templates:
        //   <tool_call>          — Hermes-2-Pro, Qwen 2.5
        //   <|python_tag|>       — Llama 3.1+
        //   [TOOL_CALLS] / [AVAILABLE_TOOLS] — Mistral / Mixtral
        //   tool_call_id         — generic OpenAI-shape templates
        return /<tool_call>|<\|python_tag\|>|\[TOOL_CALLS\]|\[AVAILABLE_TOOLS\]|tool_call_id/i.test(chatTemplate);
    }

    /**
     * Convert LLMContent[] to OpenAI-compatible chat messages for llama.cpp's
     * /v1/chat/completions endpoint. Identical contract to the OpenAI provider:
     * functionCall parts become assistant.tool_calls, functionResponse parts
     * become role:'tool' messages.
     */
    private toOpenAIMessages(systemInstruction: string, contents: LLMContent[]): any[] {
        const messages: any[] = [];
        if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

        for (const con of contents) {
            const role = con.role === 'model' ? 'assistant' : con.role;

            if (role === 'user') {
                const textParts: string[] = [];
                for (const p of con.parts) {
                    if (p.functionResponse) {
                        messages.push({
                            role: 'tool',
                            tool_call_id: p.functionResponse.id || p.functionResponse.name,
                            content: typeof p.functionResponse.response === 'string'
                                ? p.functionResponse.response
                                : JSON.stringify(p.functionResponse.response)
                        });
                    } else if (p.text) {
                        textParts.push(p.text);
                    }
                }
                if (textParts.length > 0) messages.push({ role: 'user', content: textParts.join('\n') });
                continue;
            }

            const textParts: string[] = [];
            const toolCalls: any[] = [];
            for (const p of con.parts) {
                if (p.thought) continue;
                if (p.functionCall) {
                    toolCalls.push({
                        id: p.functionCall.id || `call_${toolCalls.length}_${p.functionCall.name}`,
                        type: 'function',
                        function: {
                            name: p.functionCall.name,
                            arguments: JSON.stringify(p.functionCall.args ?? {})
                        }
                    });
                } else if (p.text) {
                    textParts.push(p.text);
                }
            }
            const msg: any = { role: 'assistant' };
            if (textParts.length > 0) msg.content = textParts.join('\n');
            else if (toolCalls.length > 0) msg.content = null;
            if (toolCalls.length > 0) msg.tool_calls = toolCalls;
            messages.push(msg);
        }

        return messages;
    }

    private finalizeToolCall(acc: LlamaCppToolCallAccumulator): LLMFunctionCall {
        let parsed: Record<string, unknown> = {};
        if (acc.argsBuffer) {
            try { parsed = JSON.parse(acc.argsBuffer); }
            catch { parsed = { _raw: acc.argsBuffer }; }
        }
        return { id: acc.id || undefined, name: acc.name, args: parsed };
    }

    async getAvailableModels(config: LLMProviderConfig): Promise<LLMModelDefinition[]> {
        const c = this.extractConfig(config);

        // Fetch both the model alias and the context window from /props in
        // one round trip; both are dynamic (depend on how the server was
        // launched) so we can't bake them into a static preset.
        const props = await this.fetchProps(c.baseUrl);
        const modelId = props.modelAlias || c.modelId || 'local-model';

        return [
            {
                id: modelId,
                name: `Local Model (${modelId})`,
                contextSize: props.contextSize ?? undefined,
                getRates: () => ({
                    input: c.inputPrice ?? 0,
                    output: c.outputPrice ?? 0,
                    cached: c.cacheInputPrice ?? 0,
                    cacheStorage: 0
                })
            }
        ];
    }

    private async fetchProps(baseUrl: string): Promise<PropsShape> {
        // In-flight dedup + short TTL. The page-load burst (getAvailableModels +
        // both probes + fetchModelAlias + agentContextInfo) all hits within
        // milliseconds, so without dedup we'd issue ~5 identical /props
        // requests per profile. With this cache, the first caller fetches and
        // every other caller awaits the same promise.
        const key = baseUrl.replace(/\/$/, '');
        const now = Date.now();
        const cached = LlamaCppProvider.propsCache.get(key);
        if (cached && cached.expiresAt > now) {
            if (cached.pending) return cached.pending;
            if (cached.value) return cached.value;
        }

        const promise = this.doFetchProps(baseUrl);
        LlamaCppProvider.propsCache.set(key, {
            value: null,
            pending: promise,
            expiresAt: now + PROPS_CACHE_TTL_MS
        });
        const value = await promise;
        // Replace the in-flight entry with the resolved value, keeping the
        // same expiresAt so the TTL clock starts at request time (not resolve
        // time) — page-load bursts get the longest possible benefit.
        const existing = LlamaCppProvider.propsCache.get(key);
        if (existing && existing.pending === promise) {
            LlamaCppProvider.propsCache.set(key, {
                value,
                expiresAt: existing.expiresAt
            });
        }
        return value;
    }

    private async doFetchProps(baseUrl: string): Promise<PropsShape> {
        const empty: PropsShape = { modelAlias: null, contextSize: null, chatTemplate: null, chatTemplateCaps: null };
        try {
            const response = await fetch(`${baseUrl}/props`);
            if (!response.ok) return empty;
            const data = await response.json();

            let modelAlias: string | null = null;
            if (data.model_alias) {
                modelAlias = data.model_alias;
            } else if (data.model_path) {
                modelAlias = String(data.model_path).split(/[/\\]/).pop() || data.model_path;
            }

            // llama.cpp server reports context size in a few historical
            // locations depending on version — try them in order.
            const rawCtx =
                data.n_ctx ??
                data.default_generation_settings?.n_ctx ??
                data.default_generation_settings?.params?.n_ctx ??
                null;
            const contextSize = typeof rawCtx === 'number' && rawCtx > 0 ? rawCtx : null;

            const chatTemplate = typeof data.chat_template === 'string' ? data.chat_template : null;
            // Newer llama-server builds parse the chat template and expose
            // structured booleans here. Older builds omit it entirely.
            const chatTemplateCaps = data.chat_template_caps && typeof data.chat_template_caps === 'object'
                ? data.chat_template_caps as {
                    supports_tools?: boolean;
                    supports_tool_calls?: boolean;
                    supports_parallel_tool_calls?: boolean;
                }
                : null;

            return { modelAlias, contextSize, chatTemplate, chatTemplateCaps };
        } catch {
            return empty;
        }
    }

    private async fetchModelAlias(baseUrl: string): Promise<string | null> {
        return (await this.fetchProps(baseUrl)).modelAlias;
    }

    getDefaultModelId(): string {
        return 'local-model';
    }

    async *generateContentStream(
        providerConfig: LLMProviderConfig,
        contents: LLMContent[],
        systemInstruction: string,
        config: LLMGenerateConfig
    ): AsyncGenerator<LLMStreamChunk> {
        const c = this.extractConfig(providerConfig);
        const baseUrl = c.baseUrl;
        let modelId = c.modelId;

        if (modelId === 'local-model' || !modelId) {
            const alias = await this.fetchModelAlias(baseUrl);
            if (alias) modelId = alias;
        }

        const messages = this.toOpenAIMessages(systemInstruction, contents);

        let n_keep = -1;
        try {
            if (systemInstruction) {
                n_keep = await this.countTokens(providerConfig, c.modelId, [
                    { role: 'system', parts: [{ text: systemInstruction }] }
                ]);
            }
        } catch {}

        const reasoningBudgetMap: Record<string, number> = { low: 512, medium: 2048, high: 8192 };
        const thinkingEnabled = c.enableThinking;
        const reasoningBudget = thinkingEnabled ? (reasoningBudgetMap[c.reasoningEffort] ?? 2048) : 0;

        const tools = config.tools && config.tools.length > 0
            ? config.tools.map(t => ({
                type: 'function',
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.parameters
                }
            }))
            : undefined;

        const requestBody: Record<string, unknown> = {
            model: modelId,
            messages,
            stream: true,
            stream_options: { include_usage: true },
            return_progress: true,
            cache_prompt: true,
            n_keep: n_keep,
            ...(c.temperature != null ? { temperature: c.temperature } : {}),
            ...(c.frequencyPenalty != null ? { frequency_penalty: c.frequencyPenalty } : {}),
            ...(c.presencePenalty != null ? { presence_penalty: c.presencePenalty } : {}),
            ...(c.topP != null ? { top_p: c.topP } : {}),
            ...(c.topK != null ? { top_k: c.topK } : {}),
            ...(c.minP != null ? { min_p: c.minP } : {}),
            ...(c.repetitionPenalty != null ? { repetition_penalty: c.repetitionPenalty } : {}),
            ...(tools ? { tools } : {}),
            ...(config.toolConfig ? { tool_choice: config.toolConfig } : {}),
            ...(config.responseSchema && !tools ? {
                response_format: {
                    type: 'json_schema',
                    json_schema: {
                        name: 'structured_output',
                        strict: true,
                        schema: this.prepareSchema(config.responseSchema)
                    }
                }
            } : {}),
            chat_template_kwargs: { enable_thinking: thinkingEnabled },
            reasoning_budget: reasoningBudget
        };

        const saveAfterGen = typeof config.cachedContentName === 'string' && config.cachedContentName.length > 0;

        try {
            const response = await fetch(`${baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: config.signal
            });

            if (!response.ok) {
                let errorMsg = `llama.cpp OAI error (${response.status})`;
                try {
                    const body = await response.text();
                    console.error('LlamaCpp OAI Error Details:', body);
                    if (body) {
                        try {
                            const json = JSON.parse(body);
                            errorMsg += `: ${json.error?.message || json.message || body}`;
                        } catch {
                            errorMsg += `: ${body}`;
                        }
                    }
                } catch {}
                throw new Error(errorMsg);
            }
            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            const toolCallAcc: Record<number, LlamaCppToolCallAccumulator> = {};

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (value) buffer += decoder.decode(value, { stream: true });
                    if (done && buffer.trim()) buffer += '\n';

                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) continue;
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const delta = data.choices?.[0]?.delta;
                            const finishReason = data.choices?.[0]?.finish_reason;
                            if (delta?.content) yield { text: delta.content };
                            if (delta?.reasoning_content) yield { text: delta.reasoning_content, thought: true };

                            if (Array.isArray(delta?.tool_calls)) {
                                for (const tc of delta.tool_calls) {
                                    const idx = tc.index ?? 0;
                                    const acc = toolCallAcc[idx] ??= { id: '', name: '', argsBuffer: '' };
                                    if (tc.id) acc.id = tc.id;
                                    if (tc.function?.name) acc.name = tc.function.name;
                                    if (tc.function?.arguments) acc.argsBuffer += tc.function.arguments;
                                }
                            }

                            if (finishReason === 'tool_calls' || (finishReason && Object.keys(toolCallAcc).length > 0)) {
                                for (const acc of Object.values(toolCallAcc)) {
                                    yield { functionCall: this.finalizeToolCall(acc) };
                                }
                                for (const k of Object.keys(toolCallAcc)) delete toolCallAcc[k as unknown as number];
                            }

                            if (data.usage || data.timings || data.prompt_progress) {
                                const usage = data.usage;
                                const timings = data.timings;
                                const progress = data.prompt_progress;
                                yield {
                                    usageMetadata: {
                                        prompt: (timings?.prompt_n !== undefined
                                            ? (timings.prompt_n + (timings.cache_n || 0))
                                            : (usage?.prompt_tokens ?? progress?.total)) || 0,
                                        candidates: (timings?.predicted_n ?? usage?.completion_tokens) || 0,
                                        cached: (timings?.cache_n ?? usage?.prompt_tokens_details?.cached_tokens ?? progress?.cache) || 0,
                                        promptSpeed: timings?.prompt_per_second ?? (progress?.time_ms ? (progress.processed / (progress.time_ms / 1000)) : undefined),
                                        completionSpeed: timings?.predicted_per_second,
                                        promptProgress: progress && progress.total > 0 ? (progress.processed / progress.total) : undefined,
                                        promptTotal: progress?.total,
                                        promptProcessed: progress?.processed,
                                        promptCache: progress?.cache
                                    }
                                };
                            }
                        } catch {}
                    }
                    if (done) break;
                }

                // Flush any remaining tool_calls if the stream ended without a finish_reason event.
                for (const acc of Object.values(toolCallAcc)) {
                    yield { functionCall: this.finalizeToolCall(acc) };
                }
            } finally { reader.releaseLock(); }
        } finally {
            // Post-gen slot save: if the caller tagged this generation with a
            // cachedContentName, persist slot 0's KV to that filename so the next
            // session can restore it and skip PP. Stateless: no pending-save map,
            // no hash tracking — the caller's presence of cachedContentName IS the
            // signal. Each turn with the same name overwrites the .bin with the
            // latest accumulated KV, so restores always resume at the newest state.
            if (saveAfterGen && !config.signal?.aborted) {
                try {
                    const saveRes = await fetch(`${baseUrl}/slots/0?action=save`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filename: config.cachedContentName })
                    });
                    if (!saveRes.ok) {
                        console.warn(`[LlamaCpp] Slot save failed (${saveRes.status}): ${await saveRes.text()}`);
                    }
                } catch (e) {
                    console.warn('[LlamaCpp] Post-gen slot save threw:', e);
                }
            }
        }
    }

    async countTokens(providerConfig: LLMProviderConfig, _modelId: string, contents: LLMContent[]): Promise<number> {
        const baseUrl = this.extractConfig(providerConfig).baseUrl;
        const text = contents.flatMap(c => c.parts).map(p => p.text || '').join('\n');
        if (!text) return 0;

        let lastError: any;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const response = await fetch(`${baseUrl}/tokenize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: text })
                });
                if (response.ok) {
                    const data = await response.json();
                    return Array.isArray(data.tokens) ? data.tokens.length : 0;
                }
                const errorBody = await response.text();
                lastError = new Error(`Tokenize failed (${response.status}): ${errorBody}`);
            } catch (e) {
                lastError = e;
            }
            
            if (attempt < 2) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        console.error('LlamaCpp Tokenize Error:', lastError);
        // We throw instead of fallback to ensure NIAH tests don't continue with wrong density
        throw lastError || new Error('Tokenize failed');
    }

    // =========================================================================
    // Context Caching — mapped onto llama.cpp slot save/restore.
    // Implementation contract (differs from server-side providers like Gemini):
    //   - createCache():     erases slot 0 and mints a deterministic filename.
    //                        The .bin does NOT exist until the first generation
    //                        with this name as cachedContentName completes
    //                        (post-gen save writes it). Caller calling getCache()
    //                        between createCache() and the first generate will
    //                        get null — this is eventual-consistency by design,
    //                        since saving a synthetic priming request produced
    //                        token sequences that didn't prefix-match real requests.
    //   - getCache(name):    POSTs /slots/0?action=restore. On 200, slot 0 is
    //                        loaded with the .bin's KV — the NEXT generateContentStream
    //                        will prefix-match against it. On failure, returns null.
    //   - updateCacheTTL:    no-op (slots have no server-side TTL); returns a stub
    //                        with a far-future expireTime so countdown UIs display
    //                        "persistent" rather than decaying to zero.
    //   - deleteCache(name): POSTs /slots/0?action=erase. NOTE: llama.cpp server
    //                        exposes no file-delete API, so the .bin on disk is
    //                        NOT removed. If the same name is createCache()d again
    //                        later, post-gen save overwrites it.
    //   - deleteAllCaches:   same as deleteCache (single-slot model); returns 1.
    // Filename strategy: stable per (baseUrl, modelId) — no content hash. One
    // .bin per server+model combo, always overwritten in place. This avoids
    // orphan accumulation; staleness detection is the caller's responsibility.
    // =========================================================================

    private deriveSlotFilename(baseUrl: string, modelId: string): string {
        const raw = `${baseUrl}|${modelId}`;
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = ((hash << 5) - hash) + raw.charCodeAt(i);
            hash |= 0;
        }
        return `cache_${Math.abs(hash).toString(36)}.bin`;
    }

    private farFutureExpire(): number {
        return Date.now() + 365 * 24 * 3600 * 1000;
    }

    private async eraseSlot(baseUrl: string): Promise<void> {
        try {
            await fetch(`${baseUrl}/slots/0?action=erase`, { method: 'POST' });
        } catch (e) {
            console.warn('[LlamaCpp] Slot erase failed:', e);
        }
    }

    async createCache(
        config: LLMProviderConfig,
        modelId: string,
        _systemInstruction: string,
        _contents: LLMContent[],
        _ttlSeconds: number
    ): Promise<LLMCacheInfo | null> {
        const { baseUrl } = this.extractConfig(config);
        const filename = this.deriveSlotFilename(baseUrl, modelId);
        await this.eraseSlot(baseUrl);
        return {
            name: filename,
            displayName: filename,
            model: modelId,
            createTime: Date.now(),
            expireTime: this.farFutureExpire(),
            usageMetadata: { totalTokenCount: 0 }
        };
    }

    async getCache(config: LLMProviderConfig, name: string): Promise<LLMCacheInfo | null> {
        const { baseUrl, modelId } = this.extractConfig(config);
        try {
            const res = await fetch(`${baseUrl}/slots/0?action=restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: name })
            });
            if (!res.ok) return null;
            const data = await res.json().catch(() => ({}));
            const restored = data?.n_restored ?? data?.tokens_restored ?? 0;
            return {
                name,
                displayName: name,
                model: modelId,
                createTime: undefined,
                expireTime: this.farFutureExpire(),
                usageMetadata: { totalTokenCount: restored }
            };
        } catch (e) {
            console.warn('[LlamaCpp] getCache restore failed:', e);
            return null;
        }
    }

    async updateCacheTTL(
        _config: LLMProviderConfig,
        name: string,
        _ttlSeconds: number
    ): Promise<LLMCacheInfo | null> {
        return {
            name,
            displayName: name,
            model: this.extractConfig(_config).modelId,
            createTime: undefined,
            expireTime: this.farFutureExpire(),
            usageMetadata: undefined
        };
    }

    async deleteCache(config: LLMProviderConfig, _name: string): Promise<void> {
        const { baseUrl } = this.extractConfig(config);
        await this.eraseSlot(baseUrl);
    }

    async deleteAllCaches(config: LLMProviderConfig): Promise<number> {
        const { baseUrl } = this.extractConfig(config);
        await this.eraseSlot(baseUrl);
        return 1;
    }

    private prepareSchema(schema: any): any {
        if (!schema || typeof schema !== 'object') return schema;
        const result = JSON.parse(JSON.stringify(schema)); 
        const process = (obj: any) => {
            if (obj.type === 'object' && obj.properties) {
                obj.additionalProperties = false;
                obj.required = Object.keys(obj.properties);
                for (const key in obj.properties) process(obj.properties[key]);
            } else if (obj.type === 'array' && obj.items) {
                process(obj.items);
            }
            delete obj.title;
            delete obj.description;
            delete obj.default;
            delete obj.$schema;
        };
        process(result);
        return result;
    }
}
