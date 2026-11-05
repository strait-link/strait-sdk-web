import { beforeEach, describe, expect, it, vi } from 'vitest';

// Opt-out (td2-27, ADR 0001): setEnabled(false) = no /v1/match, no /v1/open, kept across page
// loads in localStorage (`strait.enabled`); setEnabled(true) resumes.

const device = { screenWidth: 393, pixelRatio: 3, language: 'en-IN', timezone: 'Asia/Kolkata' };
const landing = 'https://shop.example/p/42?strait_click=0f8fad5b-d9cb-469f-a165-70867728950e';
let store: Record<string, string>;
beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) });
  vi.resetModules(); // each import below is a fresh page load
});
const load = () => import('../src/index.js');
function engine() {
  const calls: string[] = [];
  const fetch = (async (url: string) => {
    calls.push(new URL(url).pathname);
    return { ok: true, json: async () => ({ matched: true, longUrl: 'https://app/x', matchMethod: 'exact_ext' }) };
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const cfg = (fetch: typeof globalThis.fetch) => ({ publishableKey: 'st_pub_test_x', endpoint: 'https://acme.strait.link', device, fetch });

describe('setEnabled (opt-out)', () => {
  it('disabled: sends nothing (no deferred check, no open report)', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setEnabled(false);
    expect(await sdk.resolveDeferredLink(cfg(e.fetch))).toEqual({ matched: false, matchMethod: 'none' });
    expect(await sdk.reportWebOpen(cfg(e.fetch), { url: landing })).toEqual({ reported: false, clickId: '0f8fad5b-d9cb-469f-a165-70867728950e' });
    expect(e.calls).toEqual([]);
    expect(store.strait_match_done).toBeUndefined(); // the one-time check is still due
  });

  it('persists across page loads', async () => {
    (await load()).setEnabled(false);
    vi.resetModules();
    const sdk = await load(); // next visit, same localStorage
    const e = engine();
    expect(sdk.isEnabled()).toBe(false);
    await sdk.resolveDeferredLink(cfg(e.fetch));
    await sdk.reportWebOpen(cfg(e.fetch), { url: landing });
    expect(e.calls).toEqual([]);
  });

  it('setEnabled(true) resumes: the skipped check and open reports are sent', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setEnabled(false);
    await sdk.resolveDeferredLink(cfg(e.fetch));
    sdk.setEnabled(true);
    expect(sdk.isEnabled()).toBe(true);
    expect((await sdk.resolveDeferredLink(cfg(e.fetch))).matched).toBe(true);
    expect((await sdk.reportWebOpen(cfg(e.fetch), { url: landing })).reported).toBe(true);
    expect(e.calls).toEqual(['/v1/match', '/v1/open']);
  });
});
