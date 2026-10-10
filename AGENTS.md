# AGENTS.md: Strait web SDK (@straitlink/web)

Instructions for AI coding agents (Claude Code, Cursor, Codex, Copilot…) that add this SDK to an app or work on
this repo. Humans: see README.md.

For websites and web apps: one call on launch resolves a deferred link (a tap that happened before this visit) once per browser.

## Install

Not on the npm registry yet: install from GitHub (it builds during install).

```sh
npm install github:bazingga08/strait-sdk-web#v0.6.1
```

## Keys (the rule agents get wrong most)

- **Publishable key** `st_pub_live_…` (Dashboard → Get started): the only key this SDK takes. It is safe in a web page.
- **Secret key** `st_live_…` (Dashboard → Settings → Secret keys): server only. Never put it in a web page or client bundle: anyone can read it and change your links.
- Never commit either key's real value to this repo, tests or examples. Use placeholders like `st_pub_live_…`.

## Receive links: the one pattern

```ts
import { resolveDeferredLink } from '@straitlink/web';

const result = await resolveDeferredLink({
  publishableKey: 'st_pub_live_…',     // never the secret key
  endpoint: 'https://<your-handle>.strait.link', // the workspace's link domain (ask the human)
});
if (result.matched && result.longUrl) {
  const url = new URL(result.longUrl);
  router.navigate(url.pathname + url.search);
}
```

It runs at most once per browser and never throws (on error: `{ matched: false, matchMethod: 'none' }`), so it is
safe to await at startup. Keep `result.clickId` if you send conversion events later (`POST /v1/event` with the
publishable key and `clickId`).

## Smart app banner (optional)

```ts
import { Strait } from '@straitlink/web';
Strait.banner({ link: 'https://<your-handle>.strait.link/app', title: 'Hilltop Shoes', subtitle: 'Open this in the app' });
```

`link` must be a Strait link (that is what carries the destination through an install). The banner shows on
phones and tablets only, hides inside the customer's own app when you pass `inApp` or `appUserAgent`, and sends
nothing itself. Don't add tracking to it. (Hilltop Shoes is a made-up shop used in examples; use the
customer's own app name.)

## Stop and ask the human

These steps need a person. Don't guess, invent values or work around them; stop and ask:

- **Account and keys.** Creating the workspace (sign up at app.straitlink.in) and copying the publishable key.
  There is no signup API. Never ask for, accept or paste the secret key into web code.
- **The workspace's link domain** (`https://<handle>.strait.link`; custom domains are coming soon). Don't make one up.
- **Dashboard settings** (Android package name and SHA-256, Apple Team ID, custom scheme, link destinations).
  There is no API for app settings.
- **Real-device taps.** A deferred match needs a tap on a real phone, then a visit to the site.
- **Anything you would publish** (`npm publish`, a deploy, a tag): this package is not on npm yet.

## Verify

Without a phone first, ask the engine what a tap on the link would do. It records nothing, sends no webhooks
and isn't billed:

```sh
curl "https://strait.link/v1/simulate?url=https%3A%2F%2F<your-handle>.strait.link%2Fapp&ua=android&publishableKey=st_pub_live_…"
```

Check `decision`, `sentTo`, `location` and the plain-English `reason`. Change the link in the dashboard and
ask again until it is right. Then prove it for real:

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
- Brand: Strait (the company name is never spelt "Straight"). "Straight" and "Stamped" name the two halves of
  the product (the tap goes straight to the exact screen; every tap is recorded); the tagline is "Straight to the screen. On the record." Don't write superlatives ("best", "cheapest") or speed / match-rate numbers in
  docs or comments. iPhone install matching is in beta.

## More

- Docs for this SDK: https://straitlink.in/docs/sdks/web/
- All docs: https://straitlink.in/docs/ · REST API: https://straitlink.in/docs/api/
- Strait from AI tools (MCP server: create links, check App Links files, trace taps): https://straitlink.in/ai/
