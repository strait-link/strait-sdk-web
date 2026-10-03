# Changelog

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
