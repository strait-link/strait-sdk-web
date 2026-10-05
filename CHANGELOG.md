# Changelog

## Unreleased

## 0.6.1

- **Package renamed** to `@straitlink/web` (npm scope `@straitlink`; it was `@strait/sdk-web`, never
  published to npm). Update imports: `from '@straitlink/web'`. The GitHub repo name is unchanged.
  The code is otherwise identical to 0.6.0. Tag v0.6.0 (cut before the rename) still carries the old
  name `@strait/sdk-web` in its package.json, so install v0.6.1 or later for the new import path.

## 0.6.0

- Referral codes (preview; shared-spec/proposals/referral-code.md, B21): a matched
  `resolveDeferredLink` result carries `referralCode` only when the engine sent a valid
  one (an invalid or unmatched code is dropped). New export `replyReferralCode`.
- **Smart app banner** for mobile web: `banner({ link, title, subtitle, icon, theme })`,
  also as `Strait.banner(...)`. A dismissible bar on phones and tablets whose button
  is a plain link to your Strait link, so the tap opens the app on the right screen,
  or the store with the destination kept through the install. Hidden on desktop and
  inside your own app (`inApp`, `appUserAgent`, or a React Native / flutter_inappwebview
  WebView bridge). Closing it keeps it hidden for `dismissDays` (default 30), stored
  in `localStorage` under `strait.banner.dismissed`; blocked storage is handled.
  The banner makes no requests and sets no cookies. Shadow DOM, so your page's CSS
  and the banner's don't mix. `src/banner.ts` has no imports; `dist/banner.js` is
  about 2.6 KB gzipped (about 1.8 KB minified), held under 3 KB by a test.
- New exports: `banner`, `isMobile`, `BANNER_KEY`, `Strait`, types `BannerOptions`, `BannerHandle`.
- Dev: jsdom for the banner tests.

## 0.5.2

- Carries the shared conformance vectors v6 (contract B18). No code changes: B18
  (strip the query and fragment from open reports and the offline queue) does not
  apply to the web SDK, which sends no open reports and keeps no queue; it calls
  `/v1/match` only, with coarse device fields and no URL.

## 0.5.1

- Installable straight from GitHub: `npm install github:bazingga08/strait-sdk-web#v0.5.1`.
  The build now runs as a `prepare` script (was `prepack`), so npm compiles `dist/`
  when it installs from a git URL. No code changes.

## 0.5.0

- **Renamed to Strait** (breaking, clean break). The package is now
  `@strait/sdk-web`; `StraitConfig`. Publishable keys use
  the `st_pub_live_` / `st_pub_test_` prefix. The once-per-browser storage key is
  now `strait_match_done` (the old key is ignored). Shared vectors use the
  `strait_click` / `strait_link` params. No aliases for the old names are kept.

## 0.1.0

- `resolveDeferredLink` (deferred match, at most once per browser), device
  collection, golden-vector signature parity with every SDK.
- Identifies the workspace by its publishable key (`publishableKey`).
- Carries the shared conformance vectors (v2).

### Packaging

- Publish-ready: complete package metadata (repository, homepage, bugs, keywords),
  `exports` map with types, `sideEffects: false`, MIT `LICENSE`. Only `dist/`,
  README, LICENSE and this changelog ship (no tests, fixtures or source maps).
- The package name, npm scope and URLs come from `brand.json` (applied by
  `scripts/brand.mjs`), so the brand switch is one command.
- Tag `vX.Y.Z` → GitHub Actions runs the tests and publishes to npm with
  provenance (see PUBLISHING.md). Nothing publishes until `NPM_TOKEN` is set and
  the brand is marked final.
