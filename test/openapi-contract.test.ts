// MatchResult against the API's own description: openapi.json, pinned from https://strait.link/openapi.json
// (scripts/openapi-drift.mjs compares the pin with the live file every day). Fails when MatchResult names a
// field or matchMethod the API doesn't return. Since 0.8.3 resolveDeferredLink sends no POST /v1/match
// (ADR 0003: not available on the web); the type stays until it is removed in 0.9.0.
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
const result = spec.components.schemas.MatchResult!;

// Every MatchResult field and matchMethod this SDK declares (typed, so the lists follow the interface).
// `reason` is the SDK's own 'not_available_on_web' answer (ADR 0003), never sent by the API, so it is left out.
const RESULT_KEYS = ['matched', 'longUrl', 'linkId', 'matchMethod', 'clickId', 'referralCode', 'test', 'match'] as const satisfies ReadonlyArray<keyof MatchResult>;
const METHODS: ReadonlyArray<MatchResult['matchMethod']> = ['exact_ext', 'exact_core', 'none'];

describe('openapi contract: matchInstall', () => {
  it('resolveDeferredLink sends no matchInstall request (deprecated, ADR 0003)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn() as unknown as typeof fetch;
    await resolveDeferredLink({ publishableKey: 'st_pub_test_k', endpoint: 'https://strait.link', fetch: fetchMock }, { force: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(entry.path).toBe('/v1/match'); // still in the API: the app SDKs use it
    warn.mockRestore();
  });

  it('MatchResult declares only fields the API returns', () => {
    expect(RESULT_KEYS.filter((k) => !(k in result.properties!))).toEqual([]);
  });

  it('every matchMethod the SDK types is one the API can send', () => {
    expect(METHODS.filter((m) => !result.properties!.matchMethod!.enum!.includes(m))).toEqual([]);
  });
});
