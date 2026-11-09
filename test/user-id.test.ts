// Contract B27 (shared-spec ADR 0009, engine ADR 0110, ADR 0004 here): setUserId(id) after the site's own
// sign-in; later trackEvent bodies carry it to the app.event webhook. Emails and phone numbers are hashed in
// the browser. Kept in memory only (this page), never on /v1/open, cleared and ignored while opted out.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex, userIdField, USER_ID_MAX } from '../src/user-id.js';

const v = JSON.parse(readFileSync(new URL('./conformance-vectors.json', import.meta.url), 'utf8'));
const node = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('conformance vectors (B27)', () => {
  it('vectors v13, USER_ID_MAX', () => {
    expect(v.version).toBe(13);
    expect(USER_ID_MAX).toBe(v.constants.USER_ID_MAX);
  });
  it('the pinned openapi.json /v1/event takes userId (max USER_ID_MAX) and userIdHashed', () => {
    const api = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'));
    const props = api.paths['/v1/event'].post.requestBody.content['application/json'].schema.properties;
    expect(props.userId).toMatchObject({ type: 'string', maxLength: USER_ID_MAX });
    expect(props.userIdHashed).toMatchObject({ type: 'boolean' });
  });
  it.each(v.userId)('userIdField: $name', ({ input, expected }) => {
    expect(userIdField(input)).toEqual(expected);
  });
});

describe('sha256Hex', () => {
  it.each(['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(200), 'josé@example.com', '日本語', '\u{1F600}x'])('equals node crypto for %#', (s) => {
    expect(sha256Hex(s)).toBe(node(s));
  });
});

describe('userIdField', () => {
  it('drops non-strings', () => {
    for (const bad of [undefined, 42, {}, true]) expect(userIdField(bad)).toBeNull();
  });
});

const TAP = '7c35de9e-1d2b-4c4e-9a59-0f1e2d3c4b5a';
let store: Record<string, string>;
beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, val: string) => void (store[k] = val),
    removeItem: (k: string) => void delete store[k],
  });
  vi.resetModules();
});
const load = () => import('../src/index.js');
function engine() {
  const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ path: new URL(url).pathname, body: JSON.parse(String(init.body)) });
    return { ok: true, status: 202, json: async () => ({}) } as Response;
  }) as unknown as typeof globalThis.fetch;
  return { fetch, calls };
}
const cfg = (fetch: typeof globalThis.fetch) => ({ publishableKey: 'st_pub_test_x', endpoint: 'https://acme.strait.link', fetch });

describe('setUserId (B27)', () => {
  it('events after setUserId carry it; setUserId(null) stops it', async () => {
    const sdk = await load();
    const e = engine();
    await sdk.trackEvent(cfg(e.fetch), 'open_cart');
    sdk.setUserId('user_4821');
    await sdk.trackEvent(cfg(e.fetch), 'purchase');
    sdk.setUserId(null);
    await sdk.trackEvent(cfg(e.fetch), 'after_logout');
    expect(e.calls[0]!.body).not.toHaveProperty('userId');
    expect(e.calls[1]!.body).toMatchObject({ event: 'purchase', userId: 'user_4821', userIdHashed: false });
    expect(e.calls[2]!.body).not.toHaveProperty('userId');
    expect(e.calls[2]!.body).not.toHaveProperty('userIdHashed');
  });

  it('is on the Strait namespace too', async () => {
    const sdk = await load();
    const e = engine();
    sdk.Strait.setUserId('user_4821');
    await sdk.Strait.trackEvent(cfg(e.fetch), 'purchase');
    expect(e.calls[0]!.body).toMatchObject({ userId: 'user_4821', userIdHashed: false });
  });

  it('an email never leaves the page raw: only its hash is sent, nothing is stored', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setUserId('Priya@Example.com');
    await sdk.trackEvent(cfg(e.fetch), 'purchase');
    expect(e.calls[0]!.body).toMatchObject({ userId: node('priya@example.com'), userIdHashed: true });
    expect(JSON.stringify(e.calls[0]!.body)).not.toMatch(/priya/i);
    expect(JSON.stringify(store)).not.toMatch(/priya|user_|[0-9a-f]{64}/i); // memory only
  });

  it('a phone number is sent as the hash of its digits', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setUserId('+91 98765-43210');
    await sdk.trackEvent(cfg(e.fetch), 'purchase');
    expect(e.calls[0]!.body).toMatchObject({ userId: node('919876543210'), userIdHashed: true });
  });

  it('the id when trackEvent is called is the one sent', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setUserId('user_1');
    const sent = sdk.trackEvent(cfg(e.fetch), 'purchase');
    sdk.setUserId('user_2');
    await sent;
    expect(e.calls[0]!.body).toMatchObject({ userId: 'user_1' });
  });

  it('never on /v1/open', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setUserId('user_4821');
    await sdk.reportWebOpen(cfg(e.fetch), { url: `https://shop.example/p?strait_click=${TAP}` });
    expect(e.calls[0]!.path).toBe('/v1/open');
    expect(e.calls[0]!.body).not.toHaveProperty('userId');
  });

  it('memory only: a new page load has no id until set again', async () => {
    const sdk = await load();
    sdk.setUserId('user_4821');
    vi.resetModules();
    const next = await load();
    const e = engine();
    await next.trackEvent(cfg(e.fetch), 'purchase');
    expect(e.calls[0]!.body).not.toHaveProperty('userId');
  });

  it('opting out clears it; setUserId while off is ignored; back on sends nothing until set again', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setUserId('user_4821');
    sdk.setEnabled(false);
    sdk.setUserId('user_9');
    sdk.setEnabled(true);
    await sdk.trackEvent(cfg(e.fetch), 'purchase');
    expect(e.calls).toHaveLength(1);
    expect(e.calls[0]!.body).not.toHaveProperty('userId');
  });

  it('a stored opt-out from an earlier visit wins: setUserId stores nothing', async () => {
    store['strait.enabled'] = '0';
    const sdk = await load();
    const e = engine();
    sdk.setUserId('user_4821');
    sdk.setEnabled(true);
    await sdk.trackEvent(cfg(e.fetch), 'purchase');
    expect(e.calls[0]!.body).not.toHaveProperty('userId');
  });

  it('a bad value clears the previous id instead of sending it', async () => {
    const sdk = await load();
    const e = engine();
    sdk.setUserId('user_1');
    sdk.setUserId('x'.repeat(USER_ID_MAX + 1));
    await sdk.trackEvent(cfg(e.fetch), 'purchase');
    expect(e.calls[0]!.body).not.toHaveProperty('userId');
  });
});
