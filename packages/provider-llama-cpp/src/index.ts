import {
    LLMProvider,
    LLMProviderCapabilities,
    LLMProviderConfig,
    LLMContent,
    LLMGenerateConfig,
    LLMStreamChunk,
    LLMModelDefinition,
    LLMCacheInfo
} from '@hcs/llm-core';

export class LlamaCppProvider implements LLMProvider {
    readonly providerName = 'llama.cpp';
    settingsComponentId = 'llama-settings';

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

    getCapabilities(): LLMProviderCapabilities {
        return {
            supportsContextCaching: true,
            supportsThinking: true,
            supportsStructuredOutput: true,
            isLocalProvider: true,
            supportsSpeedMetrics: true
        };
    }

    async getAvailableModels(config: LLMProviderConfig): Promise<LLMModelDefinition[]> {
        const c = this.extractConfig(config);
        
        // Always try to fetch current model from server to ensure 'Refresh' works
        const alias = await this.fetchModelAlias(c.baseUrl);
        const modelId = alias || c.modelId || 'local-model';

        return [
            {
                id: modelId,
                name: `Local Model (${modelId})`,
                getRates: () => ({
                    input: c.inputPrice ?? 0,
                    output: c.outputPrice ?? 0,
                    cached: c.cacheInputPrice ?? 0,
                    cacheStorage: 0
                })
            }
        ];
    }

    private async fetchModelAlias(baseUrl: string): Promise<string | null> {
        try {
            const response = await fetch(`${baseUrl}/props`);
            if (response.ok) {
                const data = await response.json();
                if (data.model_alias) return data.model_alias;
                if (data.model_path) {
                    return data.model_path.split(/[/\\]/).pop() || data.model_path;
                }
            }
        } catch {}
        return null;
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

        const messages: any[] = [
            ...(systemInstruction ? [{ role: 'system', content: systemInstruction }] : []),
            ...contents.map(con => ({
                role: con.role === 'model' ? 'assistant' : con.role,
                content: con.parts.map(p => p.text || '').join('\n')
            }))
        ];

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
            ...(config.responseSchema ? {
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
                            if (delta?.content) yield { text: delta.content };
                            if (delta?.reasoning_content) yield { text: delta.reasoning_content, thought: true };

                            if (data.usage || data.timings || data.prompt_progress) {
                                const usage = data.usage;
                                const timings = data.timings;
                                const progress = data.prompt_progress;
                                yield {
                                    usageMetadata: {
                                        prompt: (timings?.prompt_n ?? usage?.prompt_tokens ?? progress?.total) || 0,
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
