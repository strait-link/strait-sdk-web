import { collectDevice, type DeviceFields } from './device.js';

export type { DeviceFields } from './device.js';
export { computeSignature, h32 } from './signature.js';
import { banner } from './banner.js';
export { banner, isMobile, BANNER_KEY, type BannerOptions, type BannerHandle } from './banner.js';

export interface StraitConfig {
  /**
   * Your workspace's publishable key (`st_pub_live_…`), from Dashboard →
   * Get started. Safe to ship in apps/websites — never use the secret key here.
   */
  publishableKey: string;
  /**
   * The Strait link host, e.g. https://<your-handle>.strait.link. Must be https
   * (plain http only for localhost, 127.0.0.1 and ::1); otherwise no request is sent.
   */
  endpoint: string;
  /** Override device collection (tests / non-browser hosts). */
  device?: DeviceFields;
  /** Override fetch (tests). */
  fetch?: typeof fetch;
}

export interface MatchResult {
  matched: boolean;
  /** The deferred deep link to route to, when matched. */
  longUrl?: string;
  linkId?: string;
  matchMethod: 'exact_ext' | 'exact_core' | 'none';
  /** When matched (engine B16): the id of the tap this visit came from; pass it as `clickId` with conversion events. */
  clickId?: string;
  /**
   * When matched and the tap carried a referral code (the tap's `?strait_ref=`,
   * else the link's `referralCode`). Referrals are a preview, not switched on
   * yet (contract B21). Absent otherwise.
   */
  referralCode?: string;
}

/** A referral code as the engine accepts it: 1–64 letters, digits, - or _ (contract B21, proposal). */
const REFERRAL_CODE = /^[A-Za-z0-9_-]{1,64}$/;

/** The referral code in a matched reply, kept exactly as sent, or null when absent or not a valid code. */
export function replyReferralCode(reply: unknown): string | null {
  return typeof reply === 'string' && REFERRAL_CODE.test(reply) ? reply : null;
}

const DONE_KEY = 'strait_match_done';

/**
 * Call once on first launch. Asks the Strait engine whether this device
 * recently clicked one of your links, and returns the deferred deep link.
 *
 * Idempotent per browser: the lookup succeeds at most once (a 2xx reply writes an
 * install row server-side, so repeat calls would inflate the install count). A
 * network error or non-2xx reply leaves it open for the next visit. Pass
 * `force: true` only in tests.
 */
export async function resolveDeferredLink(
  config: StraitConfig,
  opts: { force?: boolean } = {},
): Promise<MatchResult> {
  const none: MatchResult = { matched: false, matchMethod: 'none' };

  if (!opts.force && alreadyRan()) return none;
  if (!isSafeEndpoint(config.endpoint)) {
    // Never throws (like every other failure here), but say why: over plain http anyone on the
    // network could rewrite the deferred link the app is about to open.
    console.warn(
      `Strait: endpoint must use https:// (got "${config.endpoint}"); plain http is only allowed for localhost, 127.0.0.1 and ::1. Skipping the deferred-link check.`,
    );
    return none;
  }

  const device = config.device ?? collectDevice();
  const doFetch = config.fetch ?? globalThis.fetch;

  try {
    const res = await doFetch(`${trimSlash(config.endpoint)}/v1/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishableKey: config.publishableKey, platform: 'web', ...device }),
    });
    // A non-2xx (503 cold start, 429, ...) is not an answer: leave the check open so the next visit retries.
    if (!res.ok) return none;
    markRan();
    const json = (await res.json()) as MatchResult;
    const code = json.matched === true ? replyReferralCode(json.referralCode) : null;
    if (code) json.referralCode = code;
    else delete json.referralCode;
    return json;
  } catch {
    return none;
  }
}

function alreadyRan(): boolean {
  try {
    return globalThis.localStorage?.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function markRan(): void {
  try {
    globalThis.localStorage?.setItem(DONE_KEY, '1');
  } catch {
    /* ignore (private mode / no storage) */
  }
}

/** Hosts where plain http is allowed (local development only). Same rule as the Node SDK. */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

function isSafeEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' || (u.protocol === 'http:' && LOOPBACK.has(u.hostname));
  } catch {
    return false;
  }
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

const TAP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The tap id (`strait_click`) in a URL's query, and the URL without it (every other byte kept).
 * Same rule as the app SDKs' `takeClickId`: the last valid id wins; invalid ones are dropped.
 */
function takeTapId(raw: string): { url: string; clickId: string | null } {
  const hash = raw.indexOf('#');
  const base = hash < 0 ? raw : raw.slice(0, hash);
  const frag = hash < 0 ? '' : raw.slice(hash);
  const q = base.indexOf('?');
  if (q < 0) return { url: raw, clickId: null };
  let clickId: string | null = null;
  const kept = base
    .slice(q + 1)
    .split('&')
    .filter((pair) => {
      const i = pair.indexOf('=');
      if (pair.slice(0, i < 0 ? pair.length : i) !== 'strait_click') return true;
      const v = i < 0 ? '' : pair.slice(i + 1);
      if (TAP_ID.test(v)) clickId = v.toLowerCase();
      return false;
    });
  return { url: base.slice(0, q) + (kept.length ? `?${kept.join('&')}` : '') + frag, clickId };
}

export interface WebOpenResult {
  /** true when the engine took the report (2xx; a repeat of the same landing is a no-op there). */
  reported: boolean;
  /** The tap this page view came from, when the URL carried one; pass it as `clickId` with conversion events. */
  clickId?: string;
}

/**
 * Call on page load. Counts this page view as a link open ONLY when the page URL carries
 * `strait_click` (the tap id the engine adds when it sends a tap to your website), and joins it
 * to that tap. A plain visit reports nothing. The open id is derived from the tap id, so a reload
 * or a shared copy of the URL is counted once. Never throws.
 */
export async function reportWebOpen(config: StraitConfig, opts: { url?: string } = {}): Promise<WebOpenResult> {
  const href = opts.url ?? (globalThis as { location?: { href?: string } }).location?.href ?? '';
  const { url, clickId } = takeTapId(href);
  if (!clickId) return { reported: false };
  if (!isSafeEndpoint(config.endpoint)) {
    console.warn(`Strait: endpoint must use https:// (got "${config.endpoint}"); plain http is only allowed for localhost, 127.0.0.1 and ::1. Skipping the open report.`);
    return { reported: false, clickId };
  }
  const doFetch = config.fetch ?? globalThis.fetch;
  try {
    const res = await doFetch(`${trimSlash(config.endpoint)}/v1/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // keepalive: the report survives the visitor navigating away right after load.
      keepalive: true,
      body: JSON.stringify({
        publishableKey: config.publishableKey,
        openId: `web-${clickId}`,
        kind: 'direct',
        route: 'app_link',
        platform: 'web',
        url,
        clickId,
        matched: true,
        firstLaunch: false,
      }),
    });
    return { reported: res.ok, clickId };
  } catch {
    return { reported: false, clickId };
  }
}

/** Namespace form: `Strait.banner({...})`, `Strait.resolveDeferredLink({...})`, `Strait.reportWebOpen({...})`. */
export const Strait = { banner, resolveDeferredLink, reportWebOpen };
