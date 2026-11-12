import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { PROBE_TIMEOUT_MS, probeJson } from '../dist/index.js';

const PROBE_URL = 'http://probe.test/props';

let originalFetch;
let fetchCalls = [];

function stubFetch(handler) {
    globalThis.fetch = async (input, init = {}) => {
        fetchCalls.push({ url: String(input), init });
        return handler(init);
    };
}

beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
});

afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.timers.reset();
});

describe('probeJson', () => {
    it('returns the parsed JSON and the start of the body on a 2xx JSON response', async () => {
        stubFetch(() => Response.json({ a: 1 }));
        const result = await probeJson(PROBE_URL, { headers: { Authorization: 'Bearer k' } });
        assert.deepEqual(result, { ok: true, json: { a: 1 }, snippet: '{"a":1}' });
        assert.equal(fetchCalls[0].url, PROBE_URL);
        assert.deepEqual(fetchCalls[0].init.headers, { Authorization: 'Bearer k' });
        assert.ok(fetchCalls[0].init.signal instanceof AbortSignal);
    });

    it('reports unreachable with the error message when fetch fails', async () => {
        stubFetch(() => { throw new TypeError('Failed to fetch'); });
        assert.deepEqual(await probeJson(PROBE_URL), { ok: false, reason: 'unreachable', message: 'Failed to fetch' });
    });

    it('reports unreachable when reading the body fails', async () => {
        const body = new ReadableStream({ pull(controller) { controller.error(new Error('connection reset')); } });
        stubFetch(() => new Response(body));
        assert.deepEqual(await probeJson(PROBE_URL), { ok: false, reason: 'unreachable', message: 'connection reset' });
    });

    for (const status of [401, 403]) {
        it(`reports unauthorized with the status and body for ${status}`, async () => {
            stubFetch(() => new Response('{"error":"invalid key"}', { status, statusText: 'Nope' }));
            assert.deepEqual(await probeJson(PROBE_URL), {
                ok: false, reason: 'unauthorized', status, message: '{"error":"invalid key"}'
            });
        });
    }

    it('falls back to the status text when the body is empty', async () => {
        stubFetch(() => new Response(null, { status: 401, statusText: 'Unauthorized' }));
        assert.deepEqual(await probeJson(PROBE_URL), { ok: false, reason: 'unauthorized', status: 401, message: 'Unauthorized' });
    });

    it('reports http with the status and the first 300 characters of the body for other non-2xx', async () => {
        const text = 'x'.repeat(299) + 'yz';
        stubFetch(() => new Response(text, { status: 500, statusText: 'Server Error' }));
        assert.deepEqual(await probeJson(PROBE_URL), { ok: false, reason: 'http', status: 500, message: text.slice(0, 300) });
    });

    it('never splits a surrogate pair when cutting the body to 300 characters', async () => {
        const text = 'x'.repeat(299) + '\u{1F600}tail';
        stubFetch(() => new Response(text, { status: 500 }));
        const result = await probeJson(PROBE_URL);
        assert.equal(result.message, 'x'.repeat(299) + '\u{1F600}');
    });

    it('reports not-this-server with the status text when a 2xx body is empty', async () => {
        stubFetch(() => new Response(null, { status: 200, statusText: 'OK' }));
        assert.deepEqual(await probeJson(PROBE_URL), { ok: false, reason: 'not-this-server', message: 'OK' });
    });

    it('reports not-this-server with the start of the body when a 2xx body is not JSON', async () => {
        stubFetch(() => new Response('<!doctype html><title>Router</title>', { headers: { 'Content-Type': 'text/html' } }));
        assert.deepEqual(await probeJson(PROBE_URL), {
            ok: false, reason: 'not-this-server', message: '<!doctype html><title>Router</title>'
        });
    });

    it('throws the reason of a signal that is already aborted, without fetching', async () => {
        stubFetch(() => Response.json({}));
        const reason = new Error('cancelled');
        await assert.rejects(probeJson(PROBE_URL, {}, AbortSignal.abort(reason)), err => err === reason);
        assert.equal(fetchCalls.length, 0);
    });

    it('throws the signal reason when the caller aborts mid-request', async () => {
        stubFetch(() => new Promise(() => {}));
        const ac = new AbortController();
        const reason = new Error('cancelled');
        const pending = probeJson(PROBE_URL, {}, ac.signal);
        await new Promise(resolve => setImmediate(resolve));
        ac.abort(reason);
        await assert.rejects(pending, err => err === reason);
    });

    it('throws the signal reason when the caller aborts while the body is read', async () => {
        stubFetch(() => new Response(new ReadableStream({ pull: () => new Promise(() => {}) })));
        const ac = new AbortController();
        const reason = new Error('cancelled');
        const pending = probeJson(PROBE_URL, {}, ac.signal);
        await new Promise(resolve => setImmediate(resolve));
        ac.abort(reason);
        await assert.rejects(pending, err => err === reason);
    });

    it('reports unreachable when the response does not arrive in time', async () => {
        mock.timers.enable({ apis: ['setTimeout'] });
        stubFetch(() => new Promise(() => {}));
        const pending = probeJson(PROBE_URL);
        await new Promise(resolve => setImmediate(resolve));
        mock.timers.tick(PROBE_TIMEOUT_MS);
        const result = await pending;
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'unreachable');
        assert.match(result.message, new RegExp(String(PROBE_TIMEOUT_MS)));
    });

    it('reports unreachable when the body does not finish in time', async () => {
        mock.timers.enable({ apis: ['setTimeout'] });
        let reading = false;
        stubFetch(() => new Response(new ReadableStream({
            pull: () => { reading = true; return new Promise(() => {}); }
        })));
        const pending = probeJson(PROBE_URL);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(reading, true);
        mock.timers.tick(PROBE_TIMEOUT_MS - 1);
        await new Promise(resolve => setImmediate(resolve));
        let settled = false;
        pending.then(() => { settled = true; });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(settled, false);
        mock.timers.tick(1);
        const result = await pending;
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'unreachable');
        assert.match(result.message, new RegExp(String(PROBE_TIMEOUT_MS)));
    });
});
