// td2-23: every call that records an open or install carries this SDK's version (`sdkVersion`), so support can
// ask "which version?" from the record. A website has no app version: `appVersion` is never sent from the web.
// Conversion events (/v1/event) carry neither, and nothing is sent while opted out.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SDK_VERSION } from '../src/version.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string };
const device = { screenWidth: 393, pixelRatio: 3, language: 'en-IN', timezone: 'Asia/Kolkata' };
const landing = 'https://shop.example/p/42?strait_click=0f8fad5b-d9cb-469f-a165-70867728950e';
let store: Record<string, string>;
beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] });
  vi.resetModules();
});
const load = () => import('../src/index.js');
function engine() {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ path: new URL(url).pathname, body: JSON.parse(String(init.body)) });
    return { ok: true, status: 200, json: async () => ({ matched: true, longUrl: 'https://app/x', matchMethod: 'exact_ext', clickId: '0f8fad5b-d9cb-469f-a165-70867728950e' }) };
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const cfg = (fetch: typeof globalThis.fetch) => ({ publishableKey: 'st_pub_test_x', endpoint: 'https://acme.strait.link', device, fetch });

describe('sdkVersion on recording calls', () => {
  it('SDK_VERSION is the package.json version', () => {
    expect(SDK_VERSION).toBe(pkg.version);
  });

  it('/v1/match and /v1/open carry sdkVersion and no appVersion; /v1/event carries neither', async () => {
    const sdk = await load();
    const e = engine();
    await sdk.resolveDeferredLink(cfg(e.fetch), { force: true });
    await sdk.reportWebOpen(cfg(e.fetch), { url: landing });
    await sdk.trackEvent(cfg(e.fetch), 'purchase', { value: 5 });
    expect(e.calls.map((c) => c.path)).toEqual(['/v1/match', '/v1/open', '/v1/event']);
    for (const c of e.calls.slice(0, 2)) {
      expect(c.body.sdkVersion, c.path).toBe(pkg.version);
      expect(c.body, c.path).not.toHaveProperty('appVersion');
    }
    expect(e.calls[2]!.body).not.toHaveProperty('sdkVersion');
    expect(e.calls[2]!.body).not.toHaveProperty('appVersion');
  });

  it('opted out: nothing is sent, so neither version leaves the page', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setEnabled(false);
    await sdk.resolveDeferredLink(cfg(e.fetch), { force: true });
    await sdk.reportWebOpen(cfg(e.fetch), { url: landing });
    await sdk.trackEvent(cfg(e.fetch), 'purchase', { value: 5 });
    expect(e.calls).toEqual([]);
  });
});
