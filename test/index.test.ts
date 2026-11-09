import { beforeEach, describe, expect, it, vi } from 'vitest';
import { replyReferralCode, resolveDeferredLink } from '../src/index.js';

const device = {
  screenWidth: 393,
  pixelRatio: 3,
  language: 'en-IN',
  timezone: 'Asia/Kolkata',
};

const config = {
  publishableKey: 'st_pub_test_ten1key01',
  endpoint: 'https://go.example.com/',
  device,
};

beforeEach(() => {
  // jsdom-free: stub a minimal localStorage on globalThis
  let store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    clear: () => {
      store = {};
    },
  });
});

// Deprecated in 0.8.3 (ADR 0003): Strait saves deferred-match details only on the iPhone tap page, so a
// website can never match. The function stays until 0.9.0 but sends nothing and says why.
describe('resolveDeferredLink (deprecated: not available on web)', () => {
  const NOT_ON_WEB = { matched: false, matchMethod: 'none', reason: 'not_available_on_web' };

  it('sends no request, writes nothing, and returns not_available_on_web', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn() as unknown as typeof fetch;
    const setItem = vi.spyOn(localStorage, 'setItem');
    for (const c of [config, { ...config, endpoint: 'http://go.example.com' }, { ...config, endpoint: '' }]) {
      expect(await resolveDeferredLink({ ...c, fetch: fetchMock })).toEqual(NOT_ON_WEB);
      expect(await resolveDeferredLink({ ...c, fetch: fetchMock }, { force: true })).toEqual(NOT_ON_WEB);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled(); // no strait_match_done, no remembered tap
    warn.mockRestore();
  });

  it('warns once per page, naming what to use instead and when it goes', async () => {
    vi.resetModules();
    const fresh = await import('../src/index.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await fresh.resolveDeferredLink(config);
    await fresh.resolveDeferredLink(config);
    expect(warn).toHaveBeenCalledTimes(1);
    const msg = String(warn.mock.calls[0]![0]);
    expect(msg).toMatch(/resolveDeferredLink is deprecated and not available on the web/);
    expect(msg).toMatch(/iPhone tap page/);
    expect(msg).toMatch(/reportWebOpen/);
    expect(msg).toMatch(/removed in 0\.9\.0/);
    warn.mockRestore();
  });

  it('never throws, even without a browser (no window.screen) or config', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(resolveDeferredLink({} as never)).resolves.toEqual(NOT_ON_WEB);
    warn.mockRestore();
  });
});

describe('replyReferralCode (contract B21, preview)', () => {
  it('accepts 1-64 letters, digits, - or _', () => {
    for (const c of ['ASHA42', 'a', 'user_12-b', 'x'.repeat(64)]) expect(replyReferralCode(c)).toBe(c);
    for (const c of [undefined, null, '', 'x'.repeat(65), 'a b', 'me@example.com', '+919999', 'ü', 42]) expect(replyReferralCode(c)).toBeNull();
  });
});
