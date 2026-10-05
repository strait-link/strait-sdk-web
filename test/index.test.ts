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

describe('resolveDeferredLink', () => {
  it('POSTs publishableKey + platform + device fields to /v1/match', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ matched: true, longUrl: 'https://app/x', matchMethod: 'exact_ext' }),
    })) as unknown as typeof fetch;

    const res = await resolveDeferredLink({ ...config, fetch: fetchMock });

    expect(res.matched).toBe(true);
    expect(res.longUrl).toBe('https://app/x');
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe('https://go.example.com/v1/match'); // trailing slash trimmed
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ publishableKey: 'st_pub_test_ten1key01', platform: 'web', ...device });
  });

  it('runs at most once per browser (no double install rows)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ matched: false, matchMethod: 'none' }),
    })) as unknown as typeof fetch;

    await resolveDeferredLink({ ...config, fetch: fetchMock });
    await resolveDeferredLink({ ...config, fetch: fetchMock });

    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it('runs again when force:true (tests)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ matched: false, matchMethod: 'none' }),
    })) as unknown as typeof fetch;

    await resolveDeferredLink({ ...config, fetch: fetchMock }, { force: true });
    await resolveDeferredLink({ ...config, fetch: fetchMock }, { force: true });

    expect((fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it('degrades gracefully on network error', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;

    const res = await resolveDeferredLink({ ...config, fetch: fetchMock }, { force: true });
    expect(res).toEqual({ matched: false, matchMethod: 'none' });
  });

  it('returns no-match on a non-200 response', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    const res = await resolveDeferredLink({ ...config, fetch: fetchMock }, { force: true });
    expect(res.matched).toBe(false);
  });
});

describe('referralCode (contract B21, preview)', () => {
  const reply = (body: unknown) => vi.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;
  const matched = { matched: true, longUrl: 'https://shop.example/invite', linkId: 'lnk_42', matchMethod: 'exact_ext' };

  it('passes a valid code through exactly', async () => {
    const r = await resolveDeferredLink({ ...config, fetch: reply({ ...matched, referralCode: 'ASHA42' }) }, { force: true });
    expect(r.referralCode).toBe('ASHA42');
  });

  it('drops a missing, invalid or unmatched code', async () => {
    for (const body of [matched, { ...matched, referralCode: 'not valid' }, { ...matched, referralCode: null }, { matched: false, matchMethod: 'none', referralCode: 'ASHA42' }]) {
      const r = await resolveDeferredLink({ ...config, fetch: reply(body) }, { force: true });
      expect(r).not.toHaveProperty('referralCode');
    }
  });

  it('replyReferralCode accepts 1-64 letters, digits, - or _', () => {
    for (const c of ['ASHA42', 'a', 'user_12-b', 'x'.repeat(64)]) expect(replyReferralCode(c)).toBe(c);
    for (const c of [undefined, null, '', 'x'.repeat(65), 'a b', 'me@example.com', '+919999', 'ü', 42]) expect(replyReferralCode(c)).toBeNull();
  });
});
