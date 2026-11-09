# ADR 0004: `setUserId(id)` on the web (contract B27)

Date: 10 Nov 2026 · Status: accepted · Backlog: td2-22 · Decision made in shared-spec ADR 0009 and engine ADR
0110; this records only the web platform choices.

## Problem
A site wants Strait's `app.event` webhook to say which of *its* users converted. B27 settles the behaviour for
every SDK (in-memory id, emails and phones hashed on the device, `/v1/event` bodies only, cleared on opt-out).

## Web choices
- **Where it lives: a module variable (this page).** No `localStorage`, `sessionStorage` or cookie, as the
  contract says (no stored personal identifier). A page load starts without it, so the site calls
  `setUserId` on each page load while signed in (README says so). The site already knows its session there.
- **Hashing: the pure synchronous `sha256Hex` ported verbatim from React Native.** `crypto.subtle.digest` is
  async (would make `setUserId` async and race the next `trackEvent`) and is missing on plain-http pages
  (`isSecureContext` false, e.g. a LAN dev server). No dependency added. Cost: about 2 KB gzip (compiled, unminified), and only
  when `setUserId` is imported (tree-shaken otherwise; the `trackEvent`-only bundle is unchanged).
- **Opt-out:** `isEnabled()` is synchronous here (reads `localStorage`), so a stored "off" from an earlier
  visit always wins at `setUserId` time; no async re-check is needed (unlike React Native).
- **No queue:** the web SDK has none (events go once with `keepalive`), so the id is in the body built at
  `trackEvent` time and nowhere else.

## Security lens
Data exposure: raw emails / phones never leave the page; nothing is persisted; never logged. Spoofing: any
page script can call `setUserId`, but it can already send any request; receivers treat publishable-key
events as claims. DoS: capped at 128 UTF-16 units.
