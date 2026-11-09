// trackEvent (ADR 0002): POST /v1/event, same contract as the app SDKs' trackEvent (B15): the tap this
// browser came from is attached for 7 days, setEnabled(false) sends nothing, and inputs the engine would
// refuse are refused here without a request.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TAP = '7c35de9e-1d2b-4c4e-9a59-0f1e2d3c4b5a';
const DAY = 24 * 60 * 60 * 1000;
const device = { screenWidth: 393, pixelRatio: 3, language: 'en-IN', timezone: 'Asia/Kolkata' };
let store: Record<string, string>;
beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  });
  vi.useRealTimers();
  vi.resetModules();
});
const load = () => import('../src/index.js');

function engine(status = 202, match: Record<string, unknown> = { matched: true, longUrl: 'https://app/x', matchMethod: 'exact_ext', clickId: TAP }) {
  const calls: Array<{ path: string; body: Record<string, unknown>; init: RequestInit }> = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ path: new URL(url).pathname, body: JSON.parse(String(init.body)), init });
    return { ok: status < 300, status, json: async () => match } as Response;
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const cfg = (fetch: typeof globalThis.fetch) => ({ publishableKey: 'st_pub_test_x', endpoint: 'https://acme.strait.link/', device, fetch });
const events = (calls: Array<{ path: string }>) => calls.filter((c) => c.path === '/v1/event');

describe('trackEvent: send', () => {
  it('posts the event to /v1/event with the publishable key, platform web and only the fields given', async () => {
    const sdk = await load();
    const e = engine();
    expect(await sdk.trackEvent(cfg(e.fetch), 'purchase', { value: 4.99, currency: 'USD', eventId: 'ord_1001' })).toBe(true);
    expect(e.calls).toHaveLength(1);
    expect(e.calls[0]!.path).toBe('/v1/event');
    expect(e.calls[0]!.body).toEqual({ publishableKey: 'st_pub_test_x', event: 'purchase', platform: 'web', value: 4.99, currency: 'USD', eventId: 'ord_1001' });
    expect(e.calls[0]!.init.keepalive).toBe(true); // survives navigating away right after a purchase
  });

  it('attaches the tap this visit came from: a landing with strait_click (reportWebOpen)', async () => {
    const sdk = await load();
    const e = engine();
    await sdk.reportWebOpen(cfg(e.fetch), { url: `https://shop.example/p?strait_click=${TAP}` });
    vi.resetModules(); // a later page of the same site
    const next = await load();
    await next.trackEvent(cfg(e.fetch), 'signup');
    expect(events(e.calls)[0]!.body.clickId).toBe(TAP);
  });

  it('an explicit clickId wins over the remembered tap', async () => {
    const sdk = await load();
    const e = engine();
    await sdk.reportWebOpen(cfg(e.fetch), { url: `https://shop.example/p?strait_click=${TAP}` });
    await sdk.trackEvent(cfg(e.fetch), 'signup');
    const other = '0f8fad5b-d9cb-469f-a165-70867728950e';
    await sdk.trackEvent(cfg(e.fetch), 'signup', { clickId: other, linkId: 'lnk_1' });
    expect(events(e.calls).map((c) => [c.body.clickId, c.body.linkId])).toEqual([[TAP, undefined], [other, 'lnk_1']]);
  });

  it('a tap older than 7 days is not attached and is deleted', async () => {
    vi.useFakeTimers({ now: 1_000_000_000_000 });
    const sdk = await load();
    const e = engine();
    await sdk.reportWebOpen(cfg(e.fetch), { url: `https://shop.example/?strait_click=${TAP}` });
    vi.setSystemTime(1_000_000_000_000 + 7 * DAY - 1);
    await sdk.trackEvent(cfg(e.fetch), 'a');
    vi.setSystemTime(1_000_000_000_000 + 7 * DAY + 1);
    const mine = '0f8fad5b-d9cb-469f-a165-70867728950e';
    await sdk.trackEvent(cfg(e.fetch), 'b', { clickId: mine }); // deleted even when a clickId is given
    expect(store['strait.lastTap']).toBeUndefined();
    await sdk.trackEvent(cfg(e.fetch), 'c');
    expect(events(e.calls).map((c) => c.body.clickId)).toEqual([TAP, mine, undefined]);
    expect(store['strait.lastTap']).toBeUndefined();
  });

  it('never throws: no answer or a non-2xx is false', async () => {
    const sdk = await load();
    const down = vi.fn(async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    expect(await sdk.trackEvent(cfg(down), 'purchase')).toBe(false);
    expect(await sdk.trackEvent(cfg(engine(429).fetch), 'purchase')).toBe(false);
    expect(await sdk.trackEvent(cfg(engine().fetch), 'purchase', null)).toBe(true); // plain JS
  });
});

describe('trackEvent: opt-out', () => {
  it('setEnabled(false): sends nothing, remembers no tap, and forgets the one it had', async () => {
    const sdk = await load();
    const e = engine();
    await sdk.reportWebOpen(cfg(e.fetch), { url: `https://shop.example/?strait_click=${TAP}` });
    expect(store['strait.lastTap']).toBeDefined();
    sdk.setEnabled(false);
    expect(store['strait.lastTap']).toBeUndefined();
    expect(await sdk.trackEvent(cfg(e.fetch), 'purchase', { value: 1 })).toBe(false);
    await sdk.reportWebOpen(cfg(e.fetch), { url: `https://shop.example/?strait_click=${TAP}` });
    expect(store['strait.lastTap']).toBeUndefined();
    expect(e.calls.map((c) => c.path)).toEqual(['/v1/open']); // only the open from before the switch
    sdk.setEnabled(true);
    expect(await sdk.trackEvent(cfg(e.fetch), 'purchase')).toBe(true);
  });
});

describe('trackEvent: validation (the engine rule, checked before sending)', () => {
  it.each([
    ['empty name', '', {}],
    ['blank name', '   ', {}],
    ['name over 64', 'x'.repeat(65), {}],
    ['value not finite', 'p', { value: Number.NaN }],
    ['value negative', 'p', { value: -1 }],
    ['value over 1e9', 'p', { value: 1e9 + 1 }],
    ['currency not 3 letters', 'p', { currency: 'US$' }],
    ['eventId with a space', 'p', { eventId: 'ord 1' }],
    ['eventId over 64', 'p', { eventId: 'x'.repeat(65) }],
    ['linkId over 128', 'p', { linkId: 'l'.repeat(129) }],
  ] as const)('%s: false, no request, one console warning', async (_, name, extra) => {
    const sdk = await load();
    const e = engine();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await sdk.trackEvent(cfg(e.fetch), name, extra as never)).toBe(false);
    expect(e.calls).toHaveLength(0);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('a number eventId (an order id) is sent as a string; a plain-http endpoint sends nothing', async () => {
    const sdk = await load();
    const e = engine();
    await sdk.trackEvent(cfg(e.fetch), 'purchase', { eventId: 1001 as unknown as string });
    expect(e.calls[0]!.body.eventId).toBe('1001');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await sdk.trackEvent({ ...cfg(e.fetch), endpoint: 'http://acme.strait.link' }, 'purchase')).toBe(false);
    expect(e.calls).toHaveLength(1);
    warn.mockRestore();
  });

  it('is on the Strait namespace too', async () => {
    const sdk = await load();
    expect(typeof sdk.trackEvent).toBe('function');
    expect(sdk.Strait.trackEvent).toBe(sdk.trackEvent);
  });
});

describe('openapi contract: recordEvent', () => {
  type Schema = { required?: string[]; properties?: Record<string, unknown> };
  const spec = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as {
    paths: Record<string, Record<string, { operationId?: string; requestBody?: { content: Record<string, { schema: Schema }> } }>>;
  };
  const [path, ms] = Object.entries(spec.paths).find(([, m]) => m.post?.operationId === 'recordEvent')!;
  const schema = ms.post!.requestBody!.content['application/json']!.schema;

  it('goes to the spec path with every required field and nothing unknown', async () => {
    const sdk = await load();
    const e = engine();
    await sdk.reportWebOpen(cfg(e.fetch), { url: `https://shop.example/?strait_click=${TAP}` });
    await sdk.trackEvent(cfg(e.fetch), 'purchase', { value: 1, currency: 'INR', linkId: 'lnk_1', eventId: 'o1' });
    const sent = events(e.calls)[0]!;
    expect(sent.path).toBe(path);
    for (const k of schema.required ?? []) expect(Object.keys(sent.body), k).toContain(k);
    for (const k of Object.keys(sent.body)) expect(Object.keys(schema.properties ?? {}), k).toContain(k);
  });
});
