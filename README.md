# Strait SDK for the web

`@straitlink/web`

> **Availability:** Web: Live · SDK: Beta (installed from GitHub; not on npm yet).
> [Platform status](https://straitlink.in/platform-status/) · [Docs](https://straitlink.in/docs/)

Deep linking for the web: deferred match + attribution, in a few lines.

Part of [Strait](https://straitlink.in). The device signature is kept in lockstep with the server
and every other SDK via shared golden vectors (this
package runs the same vectors in CI), so deferred match never drifts.

## Install

<!-- brand:install -->
```sh
npm install @straitlink/web
```
<!-- /brand:install -->

Not on the npm registry yet. Until it is, install from GitHub (npm builds it on install):

```sh
npm install github:bazingga08/strait-sdk-web#v0.6.1
```

## Use

On first launch, ask Strait whether this device recently clicked one of your
links — and route to the deferred destination:

```ts
import { resolveDeferredLink } from '@straitlink/web';

const result = await resolveDeferredLink({
  publishableKey: 'st_pub_live_…',    // Dashboard → Get started (safe in apps; never the secret key)
  endpoint: 'https://<your-handle>.strait.link', // your workspace's link domain
});

if (result.matched && result.longUrl) {
  router.navigate(result.longUrl); // land the user on the right screen
}
```

`resolveDeferredLink` runs **at most once per browser** (it records one install
server-side). It never throws — on any error it resolves to
`{ matched: false, matchMethod: 'none' }`, so it's safe to await on startup.

When the matched tap carried a referral code, the result also has `referralCode`
(preview, not switched on yet; contract B21). It is absent otherwise.

### What it sends

The SDK collects coarse, privacy-clean device fields (screen width, pixel ratio,
2-char language, timezone) and posts them to `/v1/match`. The **server** adds the
IP it observes and computes the match signature — the client never sees or sends
an IP, and the signature is never used as a cross-app identity.

## Smart app banner (mobile web)

Show an "Open in app" bar to visitors on phones. The button is a plain link to your
Strait link, so the tap opens your app on the right screen, or the store with the
destination kept through the install.

```ts
import { Strait } from '@straitlink/web';

Strait.banner({
  link: 'https://<your-handle>.strait.link/app', // a Strait link (opened as is)
  title: 'Hilltop Shoes',
  subtitle: 'Track your order in the app',
  icon: '/icons/app-192.png',
  theme: 'auto',                                  // 'light' | 'dark' | 'auto'
});
```

It shows only on phones and tablets, never inside your own app (pass `inApp` or
`appUserAgent`), and stays hidden for 30 days after the visitor closes it
(`dismissDays`). It makes no requests and sets no cookies: the only thing recorded
is the tap on the link. `dist/banner.js` has no imports, so you can also copy it
next to your pages and load it with `<script type="module">`.

## API

| export | purpose |
|--------|---------|
| `resolveDeferredLink(config, opts?)` | the one call you need on launch |
| `banner(options)` / `Strait.banner(options)` | smart app banner for mobile web; returns `{ element, dismiss, remove }` or `null` when not shown |
| `computeSignature(inputs)` | the canonical signature (advanced/testing) |
| `h32(s)` | the canonical hash (advanced/testing) |

## Support

Questions or a bug: support@straitlink.in (replies within 1 working day, IST) or open a
[GitHub issue](https://github.com/bazingga08/strait-sdk-web/issues). Security reports: security@straitlink.in
(see [SECURITY.md](SECURITY.md)). Docs: https://straitlink.in/docs/sdks/web/
