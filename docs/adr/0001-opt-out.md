# ADR 0001: opt-out switch `setEnabled(false)`

Date: 5 Nov 2026 · Status: accepted · Backlog: td2-27 · Same design as strait-sdk-react-native ADR 0002
(and the Android, Swift and Flutter SDKs)

## Problem
Sites and apps in India (DPDP Act) and the EU (GDPR) often have to ask for consent before an attribution
SDK sends anything. Without a switch they must not call Strait at all, or they pick a rival SDK that has one
(Branch documents `disableTracking`).

## Options
1. **Do nothing**: the site skips the calls itself. Works, but every team rebuilds the same flag and the
   remembered choice.
2. **A flag in each call's config**: the site must thread the consent answer into every call.
3. **A persisted switch** `setEnabled(bool)` + `isEnabled()`, default on. **Chosen** (same API as the app SDKs).

## Design
- The web SDK is two stateless calls; both return early while off, before any request:
  `resolveDeferredLink` returns no match **without** marking its one-time check done (it runs on the first
  call after switching back on), `reportWebOpen` returns `{ reported: false, clickId }`.
- Stored as `strait.enabled` (`'0'` / `'1'`) in `localStorage`; absent = on. Blocked storage (private mode)
  falls back to this page's value, so a `setEnabled(false)` always holds for the current page.
- No queue exists here. (Since ADR 0002 the SDK remembers the tap for `trackEvent`; switching off deletes it.) The banner makes no requests (only the
  visitor's own tap on the link) and is not affected.

## Security lens
Spoofing / tampering: a script on the page can flip the flag, but it can already make any request itself.
Data exposure: the point of the change. Abuse / DoS: none (fewer requests).
