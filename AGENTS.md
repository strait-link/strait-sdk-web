# AGENTS.md: Strait web SDK (@strait/sdk-web)

Instructions for AI coding agents (Claude Code, Cursor, Codex, Copilot…) that add this SDK to an app or work on
this repo. Humans: see README.md.

For websites and web apps: one call on launch resolves a deferred link (a tap that happened before this visit) once per browser.

## Install

Not on the npm registry yet: install from GitHub (it builds during install).

```sh
npm install github:bazingga08/strait-sdk-web#v0.5.2
```

## Keys (the rule agents get wrong most)

- **Publishable key** `st_pub_live_…` (Dashboard → Get started): the only key this SDK takes. It is safe in a web page.
- **Secret key** `st_live_…` (Dashboard → Settings → Secret keys): server only. Never put it in a web page or client bundle: anyone can read it and change your links.
- Never commit either key's real value to this repo, tests or examples. Use placeholders like `st_pub_live_…`.

## Receive links: the one pattern

```ts
import { resolveDeferredLink } from '@strait/sdk-web';

const result = await resolveDeferredLink({
  publishableKey: 'st_pub_live_…',     // never the secret key
  endpoint: 'https://acme.strait.link',    // the workspace's link domain
});
if (result.matched && result.longUrl) {
  const url = new URL(result.longUrl);
  router.navigate(url.pathname + url.search);
}
```

It runs at most once per browser and never throws (on error: `{ matched: false, matchMethod: 'none' }`), so it is
safe to await at startup. Keep `result.clickId` if you send conversion events later (`POST /v1/event` with the
publishable key and `clickId`).

## Verify

1. With a link whose destination is your site, tap it on a phone, then open the site: `resolveDeferredLink`
   returns `matched: true` and the destination.
2. Open the site again: no second match (once per browser).
3. Dashboard → Analytics shows the tap.

## Working on this repo

- Test: `npm ci && npm run typecheck && npm test` (must pass before any commit; check the exit code).
- The match signature and the pure helpers are pinned by shared golden vectors
  (`test/*vectors*.json`): byte-identical copies live in every SDK and the engine. Never edit a vector file
  here alone; vectors change only through `shared-spec/` and land in every repo together.
- The package's public identity (name, scope, owner, domain) lives only in `brand.json`; change it with
  `shared-spec/scripts/rename-brand.sh` (all SDKs) or `node scripts/brand.mjs --write`.
- Wire names are part of the contract: query params `strait_click` / `strait_link`, storage keys `strait.*`,
  headers `X-Strait-*`. Don't rename them.
- Brand: Strait (never "Straight"). Don't write superlatives ("best", "cheapest") or speed / match-rate numbers in
  docs or comments. iPhone install matching is in beta.

## More

- Docs for this SDK: https://straitlink.in/docs/sdks/web/
- All docs: https://straitlink.in/docs/ · REST API: https://straitlink.in/docs/api/
- Strait from AI tools (MCP server: create links, check App Links files, trace taps): https://straitlink.in/ai/
