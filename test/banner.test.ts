// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { banner, BANNER_KEY, isMobile, Strait } from '../src/index';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
// From the repo root (vitest's cwd): under jsdom, import.meta.url isn't a file: URL.
const SRC = join(process.cwd(), 'src/banner.ts');
const LINK = 'https://hilltop.strait.link/app';

function setUA(ua: string, touch = 0) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
  Object.defineProperty(navigator, 'maxTouchPoints', { value: touch, configurable: true });
}
// Node 26 ships its own global localStorage (undefined without --localstorage-file), which
// shadows jsdom's; give the tests a plain in-memory one, as a browser would have.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  keys() { return [...this.m.keys()]; }
}
const store = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true, writable: true });

const shadow = (h: { element: HTMLElement }) => h.element.shadowRoot!;
const opts = { link: LINK, title: 'Hilltop Shoes', subtitle: 'Faster checkout in the app' };

beforeEach(() => {
  document.body.innerHTML = '<main>page</main>';
  localStorage.clear();
  setUA(IPHONE);
});
afterEach(() => {
  vi.restoreAllMocks();
  delete (window as any).ReactNativeWebView;
});

describe('banner: when it shows', () => {
  it('shows on iPhone and Android, at the top of the page by default', () => {
    for (const ua of [IPHONE, ANDROID]) {
      setUA(ua);
      const h = banner(opts)!;
      expect(h).not.toBeNull();
      expect(document.body.firstElementChild).toBe(h.element);
      h.remove();
    }
  });

  it('hides on desktop, and shows on an iPad that reports a desktop user agent', () => {
    setUA(DESKTOP);
    expect(banner(opts)).toBeNull();
    setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', 5);
    expect(banner(opts)).not.toBeNull();
  });

  it('force shows it on desktop (previews)', () => {
    setUA(DESKTOP);
    expect(banner({ ...opts, force: true })).not.toBeNull();
  });

  it('hides inside your own app: inApp flag or function, appUserAgent token, React Native WebView bridge', () => {
    expect(banner({ ...opts, inApp: true })).toBeNull();
    expect(banner({ ...opts, inApp: () => true })).toBeNull();
    setUA(`${IPHONE} HilltopShoesApp/3.2`);
    expect(banner({ ...opts, appUserAgent: 'HilltopShoesApp/' })).toBeNull();
    setUA(IPHONE);
    (window as any).ReactNativeWebView = { postMessage() {} };
    expect(banner(opts)).toBeNull();
    delete (window as any).ReactNativeWebView;
    expect(banner({ ...opts, inApp: () => { throw new Error('x'); } })).not.toBeNull();
  });

  it('shows in in-app browsers like Instagram, which are not your app', () => {
    setUA(`${IPHONE} Instagram 350.0.0.0`);
    expect(banner({ ...opts, appUserAgent: 'HilltopShoesApp/' })).not.toBeNull();
  });

  it('never shows twice on one page', () => {
    expect(banner(opts)).not.toBeNull();
    expect(banner(opts)).toBeNull();
    expect(document.querySelectorAll('[data-strait-banner]')).toHaveLength(1);
  });

  it('refuses links that are not http(s)', () => {
    expect(banner({ ...opts, link: 'javascript:alert(1)' })).toBeNull();
    expect(banner({ ...opts, link: 'http://[bad' })).toBeNull();
    expect(document.querySelector('[data-strait-banner]')).toBeNull();
  });
});

describe('banner: content and accessibility', () => {
  it('is a labelled landmark with a real link to the Strait link, unchanged', () => {
    const h = banner({ ...opts, link: `${LINK}?utm_source=web` })!;
    const aside = shadow(h).querySelector('aside')!;
    expect(aside.getAttribute('aria-label')).toBe('Hilltop Shoes app');
    const a = shadow(h).querySelector('a')!;
    expect(a.getAttribute('href')).toBe(`${LINK}?utm_source=web`);
    expect(a.textContent).toBe('Open in app');
    expect(shadow(h).querySelector('b')!.textContent).toBe('Hilltop Shoes');
    expect(shadow(h).querySelector('span')!.textContent).toBe('Faster checkout in the app');
  });

  it('close is a labelled button; the icon is decorative', () => {
    const h = banner({ ...opts, icon: 'https://cdn.hilltop.example/icon.png' })!;
    const btn = shadow(h).querySelector('button')!;
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.getAttribute('aria-label')).toBe('Close');
    expect(btn.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true');
    expect(shadow(h).querySelector('img')!.getAttribute('alt')).toBe('');
  });

  it('treats title and subtitle as text, never HTML', () => {
    const h = banner({ ...opts, title: '<img src=x onerror=alert(1)>' })!;
    expect(shadow(h).querySelectorAll('img')).toHaveLength(0);
    expect(shadow(h).querySelector('b')!.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('custom button text, accent colours, themes and bottom position', () => {
    const h = banner({ ...opts, button: 'Get the app', accent: '#0a7', accentText: '#000', theme: 'dark', position: 'bottom' })!;
    expect(shadow(h).querySelector('a')!.textContent).toBe('Get the app');
    expect(h.element.style.getPropertyValue('--ac')).toBe('#0a7');
    expect(h.element.style.getPropertyValue('--at')).toBe('#000');
    const css = shadow(h).querySelector('style')!.textContent!;
    expect(css).toContain('--bg:#1F1B18');
    expect(css).not.toContain('prefers-color-scheme');
    expect(css).toContain('position:fixed');
    expect(document.body.lastElementChild).toBe(h.element);
    h.remove();
    const auto = banner(opts)!;
    expect(shadow(auto).querySelector('style')!.textContent).toContain('prefers-color-scheme:dark');
  });
});

describe('banner: dismissal', () => {
  it('close removes it and keeps it hidden for 30 days by default', () => {
    const now = Date.UTC(2026, 9, 5);
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const h = banner(opts)!;
    shadow(h).querySelector('button')!.click();
    expect(document.querySelector('[data-strait-banner]')).toBeNull();
    expect(localStorage.getItem(BANNER_KEY)).toBe(String(now));
    expect(banner(opts)).toBeNull();
    vi.spyOn(Date, 'now').mockReturnValue(now + 29 * 864e5);
    expect(banner(opts)).toBeNull();
    vi.spyOn(Date, 'now').mockReturnValue(now + 31 * 864e5);
    expect(banner(opts)).not.toBeNull();
  });

  it('dismissDays changes the window; force ignores it', () => {
    banner(opts)!.dismiss();
    expect(banner({ ...opts, dismissDays: 0 })).not.toBeNull();
    document.querySelector('[data-strait-banner]')!.remove();
    expect(banner(opts)).toBeNull();
    expect(banner({ ...opts, force: true })).not.toBeNull();
  });

  it('remove() does not remember anything', () => {
    banner(opts)!.remove();
    expect(localStorage.getItem(BANNER_KEY)).toBeNull();
    expect(banner(opts)).not.toBeNull();
  });

  it('still works when storage throws (private mode, blocked site data)', () => {
    vi.spyOn(store, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(store, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    const h = banner(opts)!;
    expect(h).not.toBeNull();
    expect(() => h.dismiss()).not.toThrow();
    expect(document.querySelector('[data-strait-banner]')).toBeNull();
  });
});

describe('banner: privacy', () => {
  it('makes no network requests and sets no cookies, shown or dismissed', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const beacon = vi.fn();
    (navigator as any).sendBeacon = beacon;
    const xhr = vi.spyOn(XMLHttpRequest.prototype, 'open');
    const before = document.cookie;
    const h = banner({ ...opts, icon: undefined })!;
    h.dismiss();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beacon).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    expect(document.cookie).toBe(before);
    expect(store.keys()).toEqual([BANNER_KEY]);
    vi.unstubAllGlobals();
    delete (navigator as any).sendBeacon;
  });

  it('source has no network calls at all', () => {
    const src = readFileSync(SRC, 'utf8');
    expect(src).not.toMatch(/\bfetch\(|sendBeacon|XMLHttpRequest|document\.cookie|import /);
  });
});

describe('banner: API surface and size', () => {
  it('Strait.banner is the same function', () => {
    expect(Strait.banner).toBe(banner);
    expect(typeof Strait.resolveDeferredLink).toBe('function');
  });

  it('isMobile', () => {
    expect(isMobile({ userAgent: ANDROID, maxTouchPoints: 5 } as Navigator)).toBe(true);
    expect(isMobile({ userAgent: DESKTOP, maxTouchPoints: 0 } as Navigator)).toBe(false);
  });

  it('returns null without a DOM body (e.g. during server rendering)', () => {
    const body = document.body;
    body.remove();
    expect(banner(opts)).toBeNull();
    document.documentElement.append(body);
  });

  it('stays under 3 KB gzipped (compiled, unminified)', () => {
    const src = readFileSync(SRC, 'utf8');
    const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, removeComments: true } }).outputText;
    const size = gzipSync(js, { level: 9 }).length;
    expect(size).toBeLessThan(3 * 1024);
  });
});
