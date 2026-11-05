# ADR 0002: `trackEvent` for the web SDK

Date: 5 Nov 2026 · Status: accepted · Backlog: sdk-web-track-event · Same contract as `trackEvent` in the
React Native, Android, Swift and Flutter SDKs (contract B15) and the engine's `POST /v1/event`

## Problem
Every app SDK has `trackEvent(name, …)`; the web SDK has none. Web teams had to hand-write
`POST /v1/event` and carry the tap id (`clickId`) themselves, so most don't, and their conversions are not
joined to the tap that drove them. Anyone comparing us with Branch expects one event API on every platform.

## Options
1. **Do nothing**: keep the raw request in the README and the CLI snippet. Works, but no tap id unless the
   site threads it through, no opt-out, and a different shape from every other SDK.
2. **A stateless helper that needs `clickId` passed in**: smaller, but the site still has to keep the tap id.
3. **`trackEvent(config, name, extra?)` that remembers the tap it already saw.** **Chosen.** Same `extra`
   fields as React Native (`value`, `currency`, `linkId`, `clickId`, `eventId`), same endpoint, same 7-day
   window. `config` comes first like `resolveDeferredLink(config)` and `reportWebOpen(config)`, because the web
   SDK has no client object.

## Design
- **Tap memory (B15).** `reportWebOpen` (a URL with `strait_click`) and a matched `resolveDeferredLink` with a
  `clickId` remember that tap in `localStorage` as `strait.lastTap` = `{"clickId","at"}`, the same key and shape
  as React Native. `trackEvent` attaches it for 7 days; an explicit `extra.clickId` wins; an expired or
  unreadable entry is deleted (B18). Nothing else is stored.
- **Request.** `POST /v1/event` with `publishableKey`, `event`, `platform: 'web'` and only the fields given, plus
  `keepalive: true` so an event fired just before navigating away still arrives. Resolves `true` on 2xx, `false`
  otherwise. Never throws.
- **Validation.** The app SDKs leave this to the engine (its 400 makes `trackEvent` return false). The web SDK
  applies the engine's own rule (`eventInputError`) before sending, so the same inputs give the same `false`
  without a wasted request, and warns once in the console with the reason: name 1-64 characters and not blank,
  `value` finite 0-1e9, `currency` 3 letters, `linkId` at most 128 characters, `eventId` 1-64 of `A-Z a-z 0-9 _ . : -` (a number is stringified
  like React Native). The https-only endpoint rule (TM-07) applies too.
- **Opt-out (ADR 0001).** While `setEnabled(false)`: `trackEvent` returns false and sends nothing, no tap is
  remembered, and switching off deletes the remembered tap.
- **Not included:** no offline queue or generated `eventId` (the app SDKs need those for retries, B13a; a
  page has no background flush, and `keepalive` covers the navigate-away case); no custom `data` (no app SDK
  sends it yet; add it to all SDKs together).

## Security lens
- Spoofing / tampering: the publishable key is public and events sent with it are untrusted by design (the
  engine marks `sentWith: publishable_key`; trust revenue sent from your server). Nothing new.
- Data exposure: the tap id is a random UUID kept first-party in the site's own `localStorage`, 7 days, deleted
  on opt-out. No third-party calls; the only host is the site's own Strait endpoint (https only).
- Abuse / DoS: the engine rate-limits `/v1/event`; client-side validation only removes bad requests.

## Cost
`trackEvent` alone: 2.0 KB minified, 1.0 KB gzip (esbuild 0.25, tree-shaken; mostly helpers shared with the other calls). No dependency.
