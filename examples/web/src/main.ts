import { resolveDeferredLink, trackEvent } from '@straitlink/web';

const publishableKey = import.meta.env.VITE_STRAIT_PUBLISHABLE_KEY ?? '';
const endpoint = (import.meta.env.VITE_STRAIT_ENDPOINT ?? '').replace(/\/+$/, '');
const logEl = document.getElementById('log')!;
const log = (msg: string) => (logEl.textContent += `${msg}\n`);

// 1. Deep link: on the web the link lands on a URL of this site; route on its path and query.
function route(path: string) {
  document.getElementById('route')!.textContent = path;
  log(`deep link -> ${path}`);
}
route(location.pathname + location.search);

if (!publishableKey || publishableKey.includes('REPLACE_ME') || !endpoint) {
  log('Set VITE_STRAIT_PUBLISHABLE_KEY and VITE_STRAIT_ENDPOINT in .env (copy .env.example), then reload.');
} else {
  // 2. Deferred deep link: once per browser, ask Strait whether this visitor tapped one of your links.
  const result = await resolveDeferredLink({ publishableKey, endpoint });
  log(`deferred: matched=${result.matched} method=${result.matchMethod}`);
  if (result.matched && result.longUrl) {
    const dest = new URL(result.longUrl, location.href);
    route(dest.pathname + dest.search);
  }
}

// 3. Event: trackEvent attaches the tap this visitor came from (same call as the app SDKs).
document.getElementById('purchase')!.addEventListener('click', async () => {
  if (!publishableKey || publishableKey.includes('REPLACE_ME')) return log('Set your publishable key first.');
  const ok = await trackEvent({ publishableKey, endpoint }, 'purchase', { value: 4.99, currency: 'USD' });
  log(`event purchase -> ${ok ? 'accepted' : 'not accepted'}`);
});
