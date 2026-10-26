// reportWebOpen: a page load counts as a link open only when the page URL carries the tap id the
// engine adds to web landings (strait_click, engine ADR 0064). Same rule as React Native web and Flutter web.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { reportWebOpen } from '../src/index.js';

const TAP = '7c35de9e-1d2b-4c4e-9a59-0f1e2d3c4b5a';
const config = { publishableKey: 'st_pub_test_ten1key01', endpoint: 'https://go.example.com/' };

function fetchStub(status = 202) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init.body)) });
    return { ok: status < 300, status, json: async () => ({ ok: true, duplicate: false }) } as Response;
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}

describe('reportWebOpen', () => {
  it('a landing from a Strait tap: one /v1/open joined to the tap, the tap id removed from the reported url', async () => {
    const { fetch, calls } = fetchStub();
    const r = await reportWebOpen({ ...config, fetch }, { url: `https://shop.example/sale?utm_source=news&strait_click=${TAP.toUpperCase()}#top` });
    expect(r).toEqual({ reported: true, clickId: TAP });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://go.example.com/v1/open');
    expect(calls[0]!.body).toEqual({
      publishableKey: config.publishableKey,
      openId: `web-${TAP}`,
      kind: 'direct',
      route: 'app_link',
      platform: 'web',
      url: 'https://shop.example/sale?utm_source=news#top',
      clickId: TAP,
      matched: true,
      firstLaunch: false,
    });
  });

  it('the same landing reported twice (a reload, a shared URL) sends the same openId, so the engine counts it once', async () => {
    const { fetch, calls } = fetchStub();
    const url = `https://shop.example/p?strait_click=${TAP}`;
    await reportWebOpen({ ...config, fetch }, { url });
    await reportWebOpen({ ...config, fetch }, { url });
    expect(calls.map((c) => c.body.openId)).toEqual([`web-${TAP}`, `web-${TAP}`]);
  });

  it('a plain visit (no strait_click, or not a tap id) reports nothing', async () => {
    const { fetch, calls } = fetchStub();
    expect(await reportWebOpen({ ...config, fetch }, { url: 'https://shop.example/sale?utm_source=news' })).toEqual({ reported: false });
    expect(await reportWebOpen({ ...config, fetch }, { url: 'https://shop.example/?strait_click=not-a-tap' })).toEqual({ reported: false });
    expect(calls).toHaveLength(0);
  });

  it('reads the page URL by default', async () => {
    const { fetch, calls } = fetchStub();
    vi.stubGlobal('location', { href: `https://shop.example/?strait_click=${TAP}` });
    expect((await reportWebOpen({ ...config, fetch })).reported).toBe(true);
    expect(calls).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('never throws: no answer or a non-2xx is reported:false; a plain-http endpoint sends nothing', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('network');
    }) as unknown as typeof fetch;
    const url = `https://shop.example/?strait_click=${TAP}`;
    expect(await reportWebOpen({ ...config, fetch: down }, { url })).toEqual({ reported: false, clickId: TAP });
    expect(await reportWebOpen({ ...config, fetch: fetchStub(429).fetch }, { url })).toEqual({ reported: false, clickId: TAP });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { fetch, calls } = fetchStub();
    expect((await reportWebOpen({ ...config, endpoint: 'http://go.example.com', fetch }, { url })).reported).toBe(false);
    expect(calls).toHaveLength(0);
    warn.mockRestore();
  });
});

describe('openapi contract: reportOpen', () => {
  type Schema = { required?: string[]; properties?: Record<string, unknown>; $ref?: string };
  const spec = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as {
    paths: Record<string, Record<string, { operationId?: string; requestBody?: { content: Record<string, { schema: Schema }> } }>>;
    components: { schemas: Record<string, Schema> };
  };
  const [path, ms] = Object.entries(spec.paths).find(([, m]) => m.post?.operationId === 'reportOpen')!;
  let schema = ms.post!.requestBody!.content['application/json']!.schema;
  if (schema.$ref) schema = spec.components.schemas[schema.$ref.split('/').pop()!]!;

  it('goes to the spec path with every required field and nothing unknown', async () => {
    const { fetch, calls } = fetchStub();
    await reportWebOpen({ ...config, fetch }, { url: `https://shop.example/?strait_click=${TAP}` });
    expect(new URL(calls[0]!.url).pathname).toBe(path);
    const sent = Object.keys(calls[0]!.body);
    for (const k of schema.required ?? []) expect(sent, k).toContain(k);
    for (const k of sent) expect(Object.keys(schema.properties ?? {}), k).toContain(k);
  });
});
