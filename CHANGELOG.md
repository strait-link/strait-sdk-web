# Changelog

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
