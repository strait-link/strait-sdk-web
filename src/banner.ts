/**
 * Smart app banner for mobile web: a small, dismissible bar that sends the
 * visitor to your app through a Strait link. The button is a plain link to
 * that Strait link, so the tap goes through Strait like any other tap: the app
 * opens on the right screen, or the store opens and the destination is kept
 * through the install (deferred deep link).
 *
 * The banner itself sends nothing: no requests, no cookies, no identifiers.
 * The only thing recorded is the tap on the link, by Strait, as for any link.
 *
 * This file has no imports, so dist/banner.js can also be copied and served
 * as a standalone ES module.
 */

export interface BannerOptions {
  /** Your Strait link, e.g. https://<your-handle>.strait.link/app. Opened as is. */
  link: string;
  /** Usually your app's name. */
  title: string;
  /** One short line under the title, e.g. "Faster checkout in the app". */
  subtitle?: string;
  /** URL of your app icon (shown at 40×40). */
  icon?: string;
  /** Button text. Default "Open in app". */
  button?: string;
  /** "auto" (default) follows the visitor's light/dark setting. */
  theme?: 'light' | 'dark' | 'auto';
  /** "top" (default) pushes the page down; "bottom" floats over the page. */
  position?: 'top' | 'bottom';
  /** Days to stay hidden after the visitor closes it. Default 30. */
  dismissDays?: number;
  /** Button colour (any CSS colour) and its text colour. */
  accent?: string;
  accentText?: string;
  /** True (or a function returning true) when this page runs inside your own app. */
  inApp?: boolean | (() => boolean);
  /** A token your app's WebView adds to its user agent; the banner hides when it's present. */
  appUserAgent?: string;
  /** Show even on desktop, inside the app or after a dismissal (for previews). */
  force?: boolean;
}

export interface BannerHandle {
  /** The element added to the page. */
  element: HTMLElement;
  /** Hide it and remember the dismissal, as the close button does. */
  dismiss(): void;
  /** Take it off the page without remembering anything. */
  remove(): void;
}

export const BANNER_KEY = 'strait.banner.dismissed';
const DAY = 864e5;

/** Phones and tablets, including iPads that report a desktop user agent. */
export function isMobile(nav: Navigator): boolean {
  const ua = nav.userAgent || '';
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && (nav.maxTouchPoints || 0) > 1);
}

function inOwnApp(o: BannerOptions, w: any): boolean {
  try {
    if (typeof o.inApp === 'function' ? o.inApp() : o.inApp) return true;
  } catch {
    /* a throwing check counts as "not in the app" */
  }
  if (o.appUserAgent && (w.navigator.userAgent || '').includes(o.appUserAgent)) return true;
  // Bridges that only a host app's WebView injects (React Native WebView, flutter_inappwebview).
  return !!(w.ReactNativeWebView || w.flutter_inappwebview);
}

function dismissedRecently(days: number): boolean {
  try {
    const at = Number(localStorage.getItem(BANNER_KEY));
    return at > 0 && Date.now() - at < days * DAY;
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    localStorage.setItem(BANNER_KEY, String(Date.now()));
  } catch {
    /* private mode / storage blocked: it just shows again next visit */
  }
}

const LIGHT = '--bg:#fff;--fg:#1C1410;--mu:#5B4F47;--bd:#E7E0D9;--ac:#1C1410;--at:#fff;--fr:#D9620F';
const DARK = '--bg:#1F1B18;--fg:#F6F1EC;--mu:#B9AEA5;--bd:#362F2A;--ac:#F6F1EC;--at:#121010;--fr:#FA8E3A';

function css(theme: string, bottom: boolean): string {
  const vars =
    theme === 'dark' ? `:host{${DARK}}` :
    theme === 'light' ? `:host{${LIGHT}}` :
    `:host{${LIGHT}}@media(prefers-color-scheme:dark){:host{${DARK}}}`;
  return `${vars}
:host{all:initial;display:block;${bottom ? 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;' : ''}}
aside{display:flex;align-items:center;gap:10px;box-sizing:border-box;width:100%;padding:8px 12px 8px 4px;${bottom ? 'padding-bottom:calc(8px + env(safe-area-inset-bottom));border-top' : 'border-bottom'}:1px solid var(--bd);background:var(--bg);color:var(--fg);font:14px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
button{flex:none;display:grid;place-items:center;width:36px;height:44px;margin:0;padding:0;border:0;background:none;color:var(--mu);cursor:pointer;border-radius:8px}
img{flex:none;width:40px;height:40px;border-radius:10px;object-fit:cover}
div{flex:1;min-width:0}
b,span{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
b{font-weight:600}
span{color:var(--mu);font-size:13px}
a{flex:none;padding:10px 16px;border-radius:999px;background:var(--ac);color:var(--at);font-weight:600;text-decoration:none;white-space:nowrap}
a:focus-visible,button:focus-visible{outline:2px solid var(--fr);outline-offset:2px}`;
}

/**
 * Show the banner if it should be shown: on a phone or tablet, outside your
 * own app, and not closed in the last `dismissDays` days. Returns null when it
 * isn't shown (desktop, inside the app, dismissed, no DOM, invalid link, or
 * already on the page).
 */
export function banner(o: BannerOptions): BannerHandle | null {
  const w: any = typeof window === 'undefined' ? null : window;
  const doc = w?.document as Document | undefined;
  if (!doc?.body || doc.querySelector('[data-strait-banner]')) return null;

  let href: string;
  try {
    const u = new URL(o.link, w.location.href);
    if (!/^https?:$/.test(u.protocol)) return null;
    href = u.href;
  } catch {
    return null;
  }

  if (!o.force && (!isMobile(w.navigator) || inOwnApp(o, w) || dismissedRecently(o.dismissDays ?? 30))) return null;

  const bottom = o.position === 'bottom';
  const el = (t: string, attrs: Record<string, string> = {}, text?: string) => {
    const n = doc.createElement(t);
    for (const k in attrs) n.setAttribute(k, attrs[k]!);
    if (text != null) n.textContent = text;
    return n;
  };

  const host = el('div', { 'data-strait-banner': '' });
  if (o.accent) host.style.setProperty('--ac', o.accent);
  if (o.accentText) host.style.setProperty('--at', o.accentText);
  const root = host.attachShadow({ mode: 'open' });
  root.append(el('style', {}, css(o.theme || 'auto', bottom)));

  const bar = el('aside', { 'aria-label': `${o.title} app` });
  const close = el('button', { type: 'button', 'aria-label': 'Close' });
  close.innerHTML =
    '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  bar.append(close);
  if (o.icon) bar.append(el('img', { src: o.icon, alt: '', width: '40', height: '40' }));
  const text = el('div');
  text.append(el('b', {}, o.title));
  if (o.subtitle) text.append(el('span', {}, o.subtitle));
  bar.append(text, el('a', { href }, o.button || 'Open in app'));
  root.append(bar);

  const remove = () => host.remove();
  const dismiss = () => {
    remember();
    remove();
  };
  close.addEventListener('click', dismiss);

  if (bottom) doc.body.append(host);
  else doc.body.prepend(host);
  return { element: host, dismiss, remove };
}
