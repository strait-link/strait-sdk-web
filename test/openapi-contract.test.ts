// The web SDK's one API call (POST /v1/match, operation matchInstall) against the API's own description:
// openapi.json, pinned from https://strait.link/openapi.json (scripts/openapi-drift.mjs compares the pin with the
// live file every day). Fails when the request leaves out a required field, sends one the API doesn't know, or
// when MatchResult names a field or matchMethod the API doesn't return.
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { resolveDeferredLink, type MatchResult } from '../src/index.js';

type Schema = { required?: string[]; properties?: Record<string, { enum?: string[] }>; $ref?: string };
const spec = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8')) as {
  paths: Record<string, Record<string, { operationId?: string; requestBody?: { content: Record<string, { schema: Schema }> } }>>;
  components: { schemas: Record<string, Schema> };
};
const entry = Object.entries(spec.paths)
  .flatMap(([path, ms]) => Object.entries(ms).map(([m, o]) => ({ path, method: m.toUpperCase(), op: o })))
  .find((x) => x.op.operationId === 'matchInstall')!;
const body = entry.op.requestBody!.content['application/json']!.schema;
const result = spec.components.schemas.MatchResult!;

// Every MatchResult field and matchMethod this SDK declares (typed, so the lists follow the interface).
const RESULT_KEYS = ['matched', 'longUrl', 'linkId', 'matchMethod', 'clickId', 'referralCode'] as const satisfies ReadonlyArray<keyof MatchResult>;
const METHODS: ReadonlyArray<MatchResult['matchMethod']> = ['exact_ext', 'exact_core', 'none'];

describe('openapi contract: matchInstall', () => {
  it('the request goes to the spec path with the spec verb, every required field and nothing unknown', async () => {
    const seen: Array<{ url: string; init: RequestInit }> = [];
    const store: Record<string, string> = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) });
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      return { ok: true, status: 200, json: async () => ({ matched: false, matchMethod: 'none' }) } as Response;
    }) as unknown as typeof fetch;
    await resolveDeferredLink(
      { publishableKey: 'st_pub_test_k', endpoint: 'https://strait.link', fetch: fetchMock, device: { screenWidth: 393, pixelRatio: 3, language: 'en-IN', timezone: 'Asia/Kolkata' } },
      { force: true },
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]!.init.method).toBe(entry.method);
    expect(new URL(seen[0]!.url).pathname).toBe(entry.path);
    const sent = Object.keys(JSON.parse(String(seen[0]!.init.body)));
    expect(body.required!.filter((k) => !sent.includes(k)), 'required fields not sent').toEqual([]);
    expect(sent.filter((k) => !(k in body.properties!)), 'fields the API does not know').toEqual([]);
  });

  it('MatchResult declares only fields the API returns', () => {
    expect(RESULT_KEYS.filter((k) => !(k in result.properties!))).toEqual([]);
  });

  it('every matchMethod the SDK types is one the API can send', () => {
    expect(METHODS.filter((m) => !result.properties!.matchMethod!.enum!.includes(m))).toEqual([]);
  });
});
