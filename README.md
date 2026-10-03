# @strait/sdk-web

Deep linking for the web — deferred match + attribution, in a few lines.

Part of [Strait](../). The device signature is kept in lockstep with the server
and every other SDK via [`shared-spec`](../shared-spec) golden vectors (this
package runs the same vectors in CI), so deferred match never drifts.

## Install

<!-- brand:install -->
```sh
npm install @strait/sdk-web
```
<!-- /brand:install -->

## Use

On first launch, ask Strait whether this device recently clicked one of your
links — and route to the deferred destination:

```ts
import { resolveDeferredLink } from '@strait/sdk-web';

const result = await resolveDeferredLink({
  publishableKey: 'st_pub_live_…',    // Dashboard → Get started (safe in apps; never the secret key)
  endpoint: 'https://go.yourbrand.com', // your Strait link host
});

if (result.matched && result.longUrl) {
  router.navigate(result.longUrl); // land the user on the right screen
}
```

`resolveDeferredLink` runs **at most once per browser** (it records one install
server-side). It never throws — on any error it resolves to
`{ matched: false, matchMethod: 'none' }`, so it's safe to await on startup.

### What it sends

The SDK collects coarse, privacy-clean device fields (screen width, pixel ratio,
2-char language, timezone) and posts them to `/v1/match`. The **server** adds the
IP it observes and computes the match signature — the client never sees or sends
an IP, and the signature is never used as a cross-app identity.

## API

| export | purpose |
|--------|---------|
| `resolveDeferredLink(config, opts?)` | the one call you need on launch |
| `computeSignature(inputs)` | the canonical signature (advanced/testing) |
| `h32(s)` | the canonical hash (advanced/testing) |
