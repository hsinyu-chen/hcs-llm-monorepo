import type { LLMProbeResult } from './llm-provider.js';

/** Covers the whole exchange, response body included. */
export const PROBE_TIMEOUT_MS = 10_000;

const SNIPPET_LENGTH = 300;

function firstCodePoints(text: string, count: number): string {
    let end = 0;
    for (let n = 0; n < count && end < text.length; n++) {
        end += text.codePointAt(end)! > 0xffff ? 2 : 1;
    }
    return text.slice(0, end);
}

/**
 * A successful exchange carries the parsed body and the start of its text,
 * so a provider whose shape check fails can report 'not-this-server' with it.
 */
export type ProbeJsonResult =
    | { ok: true; json: unknown; snippet: string }
    | Extract<LLMProbeResult, { ok: false }>;

/**
 * Sends one request and classifies the outcome for `LLMProvider.probe`.
 * Never rejects for a failed check; rejects with `signal.reason` when `signal` aborts.
 */
export async function probeJson(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<ProbeJsonResult> {
    if (signal?.aborted) throw signal.reason;

    const ac = new AbortController();
    const onAbort = () => ac.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(
        () => ac.abort(new Error(`No complete response within ${PROBE_TIMEOUT_MS} ms`)),
        PROBE_TIMEOUT_MS
    );
    // fetch implementations differ in whether an abort also fails a pending body read, so every await races it.
    const aborted = new Promise<never>((_, reject) => {
        ac.signal.addEventListener('abort', () => reject(ac.signal.reason), { once: true });
    });
    aborted.catch(() => {});

    try {
        let response: Response;
        let text: string;
        try {
            response = await Promise.race([fetch(url, { ...init, signal: ac.signal }), aborted]);
            text = await Promise.race([response.text(), aborted]);
        } catch (e) {
            if (signal?.aborted) throw signal.reason;
            return { ok: false, reason: 'unreachable', message: e instanceof Error ? e.message : String(e) };
        }

        const snippet = firstCodePoints(text, SNIPPET_LENGTH);
        const message = snippet || response.statusText || undefined;
        if (response.status === 401 || response.status === 403) {
            return { ok: false, reason: 'unauthorized', status: response.status, message };
        }
        if (!response.ok) {
            return { ok: false, reason: 'http', status: response.status, message };
        }
        try {
            return { ok: true, json: JSON.parse(text), snippet };
        } catch {
            return { ok: false, reason: 'not-this-server', message };
        }
    } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
    }
}
