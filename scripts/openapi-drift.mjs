// Compare what this SDK relies on in the pinned openapi.json with the live one (https://strait.link/openapi.json):
// the matchInstall operation (verb, path, request fields, required fields) and the MatchResult fields and
// matchMethod values. Fails on any difference so the SDK and its contract test get updated.
//   node scripts/openapi-drift.mjs [live-url]      update the pin: curl -s <url> | jq . > openapi.json
import { readFileSync } from 'node:fs';

const url = process.argv[2] ?? 'https://strait.link/openapi.json';
const pinned = JSON.parse(readFileSync(new URL('../openapi.json', import.meta.url), 'utf8'));
const res = await fetch(url, { headers: { accept: 'application/json' } });
if (!res.ok) {
  console.error(`could not fetch ${url}: HTTP ${res.status}`);
  process.exit(2);
}
const live = await res.json();

const view = (spec) => {
  let op = null;
  for (const [path, ms] of Object.entries(spec.paths ?? {}))
    for (const [m, o] of Object.entries(ms)) if (o?.operationId === 'matchInstall') op = { path, method: m, o };
  const body = op?.o.requestBody?.content?.['application/json']?.schema ?? {};
  const mr = spec.components?.schemas?.MatchResult ?? {};
  return {
    operation: op ? `${op.method.toUpperCase()} ${op.path}` : 'missing',
    requestFields: Object.keys(body.properties ?? {}).sort(),
    requiredFields: [...(body.required ?? [])].sort(),
    resultFields: Object.keys(mr.properties ?? {}).sort(),
    matchMethods: [...(mr.properties?.matchMethod?.enum ?? [])].sort(),
  };
};
const a = view(pinned);
const b = view(live);
let drift = 0;
for (const k of Object.keys(a)) {
  if (JSON.stringify(a[k]) === JSON.stringify(b[k])) continue;
  drift++;
  console.log(`${k}\n  pinned: ${JSON.stringify(a[k])}\n  live:   ${JSON.stringify(b[k])}`);
}
if (!drift) console.log(`matchInstall and MatchResult match ${url}`);
else {
  console.error(`\n${drift} difference(s): update openapi.json, then src/ and test/openapi-contract.test.ts.`);
  process.exit(1);
}
