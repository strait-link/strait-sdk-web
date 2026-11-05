import { collectDevice, type DeviceFields } from './device.js';
import { SDK_VERSION } from './version.js';

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
  /**
   * When matched: how the engine matched and how sure it is, e.g.
   * `{ method: 'fingerprint', confidence: 'probable' }` (engine ADR 0081). Absent otherwise.
   */
  match?: MatchInfo;
}

/** How the engine matched a deferred link and how sure it is (engine ADR 0081). */
export interface MatchInfo {
  /** New values may be added by the engine later. */
  method: 'install_referrer' | 'clipboard' | 'fingerprint' | 'test' | (string & {});
  confidence: 'exact' | 'high' | 'probable' | (string & {});
}

/** A referral code as the engine accepts it: 1–64 letters, digits, - or _ (contract B21, proposal). */
const REFERRAL_CODE = /^[A-Za-z0-9_-]{1,64}$/;

/** The referral code in a matched reply, kept exactly as sent, or null when absent or not a valid code. */
export function replyReferralCode(reply: unknown): string | null {
  return typeof reply === 'string' && REFERRAL_CODE.test(reply) ? reply : null;
}

const DONE_KEY = 'strait_match_done';
const ENABLED_KEY = 'strait.enabled';
/** The tap this browser last came from, for trackEvent (ADR 0002; same key and shape as React Native). */
const TAP_KEY = 'strait.lastTap';
/** This page's value when localStorage is blocked (private mode); storage keeps it across visits. */
let enabledHere = true;

/**
 * Opt-out switch for consent flows (default on). Off: `resolveDeferredLink`, `reportWebOpen` and `trackEvent`
 * send nothing (the deferred check stays due, so it runs once you switch back on) and the remembered tap is deleted. Kept in `localStorage`
 * as `strait.enabled` across visits. The banner makes no requests and is not affected.
 */
export function setEnabled(enabled: boolean): void {
  enabledHere = enabled;
  try {
    globalThis.localStorage?.setItem(ENABLED_KEY, enabled ? '1' : '0');
    if (!enabled) globalThis.localStorage?.removeItem(TAP_KEY); // nothing kept while off
  } catch {
    /* blocked storage: this page only */
  }
}

/** The opt-out switch's current value (see setEnabled). */
export function isEnabled(): boolean {
  try {
    const v = globalThis.localStorage?.getItem(ENABLED_KEY);
    if (v != null) return v !== '0';
  } catch {
    /* blocked storage: fall back to this page's value */
  }
  return enabledHere;
}

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

  if (!isEnabled() || (!opts.force && alreadyRan())) return none;
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
      body: JSON.stringify({ publishableKey: config.publishableKey, platform: 'web', ...device, sdkVersion: SDK_VERSION }),
    });
    // A non-2xx (503 cold start, 429, ...) is not an answer: leave the check open so the next visit retries.
    if (!res.ok) return none;
    markRan();
    const json = (await res.json()) as MatchResult;
    const code = json.matched === true ? replyReferralCode(json.referralCode) : null;
    if (code) json.referralCode = code;
    else delete json.referralCode;
    const m = json.match as { method?: unknown; confidence?: unknown } | null | undefined;
    if (json.matched === true && m && typeof m.method === 'string' && typeof m.confidence === 'string') {
      json.match = { method: m.method, confidence: m.confidence } as MatchInfo;
    } else delete json.match;
    if (json.matched === true && typeof json.clickId === 'string') rememberTap(json.clickId);
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
  if (!isEnabled()) return { reported: false, clickId }; // opted out: nothing is sent
  rememberTap(clickId);
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
        sdkVersion: SDK_VERSION,
      }),
    });
    return { reported: res.ok, clickId };
  } catch {
    return { reported: false, clickId };
  }
}

// ── Conversion events (ADR 0002; contract B15, same as the app SDKs' trackEvent) ──

const ATTRIBUTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Remember the tap this browser came from (`{"clickId","at"}`, same key and shape as React Native). */
function rememberTap(clickId: string): void {
  if (!TAP_ID.test(clickId)) return;
  try {
    globalThis.localStorage?.setItem(TAP_KEY, JSON.stringify({ clickId: clickId.toLowerCase(), at: Date.now() }));
  } catch {
    /* blocked storage: events go without a tap id */
  }
}

/** The remembered tap id when opened at most 7 days ago; an expired or unreadable entry is deleted (B18). */
function rememberedTap(): string | undefined {
  try {
    const stored = globalThis.localStorage?.getItem(TAP_KEY);
    if (!stored) return undefined;
    const { clickId, at } = (JSON.parse(stored) ?? {}) as { clickId?: unknown; at?: unknown };
    const age = Date.now() - (typeof at === 'number' ? at : NaN);
    if (typeof clickId === 'string' && TAP_ID.test(clickId) && age >= 0 && age <= ATTRIBUTION_WINDOW_MS) return clickId;
    globalThis.localStorage?.removeItem(TAP_KEY);
  } catch {
    /* unreadable: no tap */
  }
  return undefined;
}

export interface TrackEventExtra {
  /** Revenue, 0 to 1,000,000,000. */
  value?: number;
  /** 3-letter ISO code, e.g. `INR`. */
  currency?: string;
  linkId?: string;
  /** The tap this conversion came from. Default: the tap this browser last came from (≤ 7 days). */
  clickId?: string;
  /** Your id for this conversion, e.g. the order id (1-64 of A-Z a-z 0-9 _ . : -). Stored once. */
  eventId?: string;
}

/** Why the engine would refuse this event (its own /v1/event rule), or null. */
function eventError(name: unknown, x: TrackEventExtra & { eventId?: unknown }): string | null {
  if (typeof name !== 'string' || !name.trim() || name.length > 64) return 'event name must be 1-64 characters';
  if (x.value != null && (typeof x.value !== 'number' || !Number.isFinite(x.value) || x.value < 0 || x.value > 1e9)) {
    return 'value must be a number from 0 to 1,000,000,000';
  }
  if (x.currency != null && !/^[A-Za-z]{3}$/.test(String(x.currency))) return 'currency must be a 3-letter ISO code, e.g. USD';
  if (x.linkId != null && (typeof x.linkId !== 'string' || x.linkId.length > 128)) return 'linkId must be a string of at most 128 characters';
  if (x.eventId != null && x.eventId !== '' && !/^[A-Za-z0-9_.:-]{1,64}$/.test(String(x.eventId))) {
    return 'eventId must be 1-64 characters: letters, digits, _ . : -';
  }
  return null;
}

/**
 * Conversion / revenue event (`POST /v1/event`), e.g. `trackEvent(config, 'purchase', { value: 499, currency: 'INR' })`.
 * Resolves true when the engine accepted it. Carries the tap this browser last came from (`reportWebOpen` or a
 * matched `resolveDeferredLink`, ≤ 7 days) unless you pass `clickId`. Pass your order id as `eventId`: the engine
 * stores each eventId once. Sends nothing while `setEnabled(false)`, or when the engine would refuse the input
 * (a console warning says why). Never throws.
 */
export async function trackEvent(config: StraitConfig, name: string, extra?: TrackEventExtra | null): Promise<boolean> {
  if (!isEnabled()) return false;
  extra ??= {}; // plain-JS callers may pass null
  const bad = eventError(name, extra);
  if (bad || !isSafeEndpoint(config.endpoint)) {
    console.warn(`Strait: ${bad ?? `endpoint must use https:// (got "${config.endpoint}"); plain http is only allowed for localhost, 127.0.0.1 and ::1`}. Event "${String(name).slice(0, 64)}" not sent.`);
    return false;
  }
  const remembered = rememberedTap(); // read even when clickId is given: an expired tap is deleted (B18)
  const clickId = extra.clickId || remembered;
  const doFetch = config.fetch ?? globalThis.fetch;
  try {
    const res = await doFetch(`${trimSlash(config.endpoint)}/v1/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // keepalive: the event survives the visitor navigating away right after (e.g. to an order page).
      keepalive: true,
      body: JSON.stringify({
        publishableKey: config.publishableKey,
        event: name,
        platform: 'web',
        ...(extra.value != null ? { value: extra.value } : {}),
        ...(extra.currency != null ? { currency: extra.currency } : {}),
        ...(extra.linkId != null ? { linkId: extra.linkId } : {}),
        ...(clickId ? { clickId } : {}),
        // String(): plain-JS sites pass number order ids; the engine only takes strings.
        ...(extra.eventId != null && extra.eventId !== '' ? { eventId: String(extra.eventId) } : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Namespace form: `Strait.banner({...})`, `Strait.resolveDeferredLink({...})`, `Strait.reportWebOpen({...})`, `Strait.trackEvent({...}, 'purchase')`, `Strait.setEnabled(false)`. */
export const Strait = { banner, resolveDeferredLink, reportWebOpen, trackEvent, setEnabled, isEnabled };
