import { reportWebOpen, trackEvent } from '@straitlink/web';

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
  // 2. Open report: a landing from a Strait tap (?strait_click=…) counts as an open of that tap.
  const open = await reportWebOpen({ publishableKey, endpoint });
  log(`open: reported=${open.reported}${open.clickId ? ` tap=${open.clickId}` : ' (no strait_click in the URL)'}`);
}

// 3. Event: trackEvent attaches the tap this visitor came from (same call as the app SDKs).
document.getElementById('purchase')!.addEventListener('click', async () => {
  if (!publishableKey || publishableKey.includes('REPLACE_ME')) return log('Set your publishable key first.');
  const ok = await trackEvent({ publishableKey, endpoint }, 'purchase', { value: 4.99, currency: 'USD' });
  log(`event purchase -> ${ok ? 'accepted' : 'not accepted'}`);
});
