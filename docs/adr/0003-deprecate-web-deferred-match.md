# ADR 0003: deprecate `resolveDeferredLink` on the web

Date: 9 Nov 2026 · Status: accepted (CEO decision, 9 Nov 2026) · Follows 0.8.2 (docs) and
ops/run-1109/sdk-qa-fixes.md "Open 2"

## Problem
`resolveDeferredLink` asks `POST /v1/match` with `platform: 'web'`. The engine saves match candidates only from
the iPhone tap page (`/v1/match-save`, the **Get the app** step), always as platform `ios`, and matches by
platform, so a website can never get `matched: true`. Prod: 0 `platform='web'` candidates in 60 days. 0.8.2 made
the docs honest, but the function still sells a feature that can't work, and every call writes an unmatched
install row server-side (a website visit counted as an "install").

## Who it serves
Web teams reading our README: they should spend their 5 minutes on calls that work (`reportWebOpen`,
`trackEvent`, the banner), not debug a `matched: false` that is permanent.

## Options
1. **Do nothing** (docs-only, 0.8.2). Honest, but the API and the quick start still lead with it, and the
   empty install rows keep coming.
2. **Make it work**: have the tap page save a `web` candidate for taps sent to a website. New engine + DB work,
   a fingerprint match for a page that already receives the tap id in its URL (`strait_click`): `reportWebOpen`
   gets an exact answer for free. Reinvents what we have.
3. **Remove it now** (breaking: imports fail). Not in a patch.
4. **Deprecate now, remove in 0.9.0.** **Chosen.** Keep the export and its signature (no build breaks), send no
   request, return `{ matched: false, matchMethod: 'none', reason: 'not_available_on_web' }` and warn once per
   page in the console with what to use instead. `@deprecated` in the types and README.

## Design
- No network, no storage: no `/v1/match`, no `strait_match_done`, no remembered tap. `opts.force` and
  `config.device` are ignored (both `@deprecated`).
- `reason` is SDK-only (the API never sends it), so the OpenAPI contract test leaves it out.
- `replyReferralCode`, `DeviceFields` and `StraitConfig.device` only served this call: `@deprecated`, removed with
  it in 0.9.0. `collectDevice` (internal, not exported) is deleted now.
- README: quick start leads with `reportWebOpen`; a "Deferred match: not on the web" section maps each old use to
  its replacement. The example app reports the open instead.

## Security lens
Less surface: the SDK no longer sends coarse device fields (screen, pixel ratio, language, time zone) from web
pages. No new input, storage or endpoint. Spoofing/tampering/DoS: unchanged (one fewer public call).

## Architecture lens
No engine or DB change; `/v1/match` stays for the app SDKs. Fewer requests per first visit (one fewer cold-start
hit on Render). Removal in 0.9.0 is a one-line export drop plus the deprecated types.

## Cost
None. Site/MCP docs that still show `resolveDeferredLink` for the web follow in the site lane.
