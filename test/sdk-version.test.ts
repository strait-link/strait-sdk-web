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
  it('SDK_VERSION is the package.json version, a plain number', () => {
    expect(SDK_VERSION).toBe(pkg.version);
    expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  // B25 (shared-spec ADR 0007 amendment): web names itself like every other SDK, so the engine's sdk_releases reads it
  // as the web SDK only (a bare 0.8.x could be Flutter or React Native on a website). Same field, so older engines store it as sent.
  it('/v1/open carries sdkVersion = web/<version> and no appVersion; /v1/event carries neither', async () => {
    const sdk = await load();
    const e = engine();
    await sdk.reportWebOpen(cfg(e.fetch), { url: landing });
    await sdk.trackEvent(cfg(e.fetch), 'purchase', { value: 5 });
    expect(e.calls.map((c) => c.path)).toEqual(['/v1/open', '/v1/event']);
    expect(e.calls[0]!.body.sdkVersion).toBe(`web/${pkg.version}`);
    expect(e.calls[0]!.body).not.toHaveProperty('appVersion');
    expect(e.calls[1]!.body).not.toHaveProperty('sdkVersion');
    expect(e.calls[1]!.body).not.toHaveProperty('appVersion');
  });

  it('opted out: nothing is sent, so neither version leaves the page', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setEnabled(false);
    await sdk.reportWebOpen(cfg(e.fetch), { url: landing });
    await sdk.trackEvent(cfg(e.fetch), 'purchase', { value: 5 });
    expect(e.calls).toEqual([]);
  });
});
