# Changelog

## Unreleased

- `reportWebOpen(config, opts?)`: on page load, a URL carrying `strait_click` (the tap id the engine
  adds to web landings, engine ADR 0064) is reported as one open joined to that tap
  (`POST /v1/open`, platform `web`, openId `web-<tap id>` so reloads count once). Without
  `strait_click` nothing is reported. Release after the engine change is live.

## 0.6.3

- README: the iPhone install matching row says Opt-in (off until you choose it; proven on iPhone
  simulators) instead of Beta, the same words as the platform status page. No code change.
- Test copy of the shared conformance vectors updated to v9 (B14 `deviceClass` group).

## 0.6.2

The first npm release since 0.6.1 (B-SDK-07). Everything below was on main but unpublished.

- Security (TM-07): `resolveDeferredLink` refuses a non-https `endpoint` (plain http only for
  localhost, 127.0.0.1 and ::1): it sends no request, logs a console warning and returns no match.
- Fix (SDK-22): `resolveDeferredLink` marks its one-time check done only after a 2xx reply. A
  503 (server waking up), 429 or network error used to burn the check for good, so that browser
  never got its deferred link; now the next visit retries.

- Packaging: the tarball holds only `dist/`, README, LICENSE and package.json (CHANGELOG.md is no
  longer shipped; read it on GitHub), and `prepublishOnly` rebuilds `dist/` before every publish.
- Smart app banner restyled to the Strait design system v5, light and dark: a warm surface bar
  (`#FFFFFF` / `#191613`), the one orange button (`#FF6A13`, ink text 6.8:1, radius 8), 15 / 13 px
  text (nothing under 12 px), a 2 px focus ring, 44 px tap targets on touch screens, hover and
  press states, no transition under reduced motion, and a border in forced-colours mode. A custom
  `accent` now also sets the hover / press colours, and its text colour is picked for contrast
  (ink or white) unless `accentText` is given.
- The Strait design tokens v5 (colours light / dark, fonts, radius, shadows, motion) are generated
  into `src/tokens.ts` by `scripts/tokens.mjs` from the brand repo. The banner's colours are written
  into `src/banner.ts` by the same script (it keeps no imports), and the tests check they agree.
- Public API kept small (SDK-23, decision record: shared-spec `docs/adr/0001-sdk-public-api-surface.md`):
  `tokens` and `readableOn`, added on main after 0.6.1 and never published, stay internal. The
  exports are the same as 0.6.1. `src/tokens.ts` is no longer compiled into `dist/`.
- `examples/banner.html`: a preview page for every banner option (sample data: Hilltop Shoes).
- README: the common Strait SDK header (logo, promise, badges, links), a platform features table
  with the iPhone beta truth, and a "Docs and support" section.
- Test copy of the shared conformance vectors updated to v8 (B22 page.link `classifyUrl` cases).
  The web SDK carries the vectors only; no code change.

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
  The banner makes no requests of its own (apart from loading your `icon`) and sets no cookies. Shadow DOM, so your page's CSS
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
  `@strait/sdk-web`; `BridgeConfig` is now `StraitConfig`. Publishable keys use
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
