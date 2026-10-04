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
  /** The Strait link host, e.g. https://<your-handle>.strait.link. */
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
}

const DONE_KEY = 'strait_match_done';

/**
 * Call once on first launch. Asks the Strait engine whether this device
 * recently clicked one of your links, and returns the deferred deep link.
 *
 * Idempotent per browser: the lookup runs at most once (it writes an install
 * row server-side, so repeat calls would inflate the install count). Pass
 * `force: true` only in tests.
 */
export async function resolveDeferredLink(
  config: StraitConfig,
  opts: { force?: boolean } = {},
): Promise<MatchResult> {
  const none: MatchResult = { matched: false, matchMethod: 'none' };

  if (!opts.force && alreadyRan()) return none;

  const device = config.device ?? collectDevice();
  const doFetch = config.fetch ?? globalThis.fetch;

  try {
    const res = await doFetch(`${trimSlash(config.endpoint)}/v1/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishableKey: config.publishableKey, platform: 'web', ...device }),
    });
    markRan();
    if (!res.ok) return none;
    return (await res.json()) as MatchResult;
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

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

/** Namespace form: `Strait.banner({...})`, `Strait.resolveDeferredLink({...})`. */
export const Strait = { banner, resolveDeferredLink };
