// Contract B27 (shared-spec ADR 0009 + 0010, ADR 0004 here): what `setUserId(id)` sends with later events.
// Same code as sdk-react-native/src/core.ts (pinned by the conformance vectors' `userId` group).

/** The longest user id the SDK sends (after trimming); a longer one is not sent (engine ADR 0110). */
export const USER_ID_MAX = 128;

/**
 * B27 (shared-spec ADR 0009, ADR 0010): what `setUserId(id)` sends with later events, or null (nothing sent).
 * Trimmed; empty, longer than USER_ID_MAX or holding a control character = null. An email (any `@`, `＠` or `﹫`)
 * is sent as the SHA-256 hex of its lower-case form, a phone number (`phoneNumberForm`) as the SHA-256 hex of its
 * canonical form: `userIdHashed: true`, the raw value never leaves the device.
 */
export function userIdField(id: unknown): { userId: string; userIdHashed: boolean } | null {
  if (typeof id !== 'string') return null;
  const t = id.trim();
  if (!t || t.length > USER_ID_MAX) return null;
  if (/[@\uff20\ufe6b]/.test(t)) return { userId: sha256Hex(t.toLowerCase()), userIdHashed: true };
  const phone = phoneNumberForm(t);
  if (phone) return { userId: sha256Hex(phone), userIdHashed: true };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(t)) return null;
  return { userId: t, userIdHashed: false };
}

/** The zero of each run of ten decimal digits B27 reads: ASCII, Arabic-Indic, Eastern Arabic-Indic, Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam, full-width. */
const DIGIT_ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xff10];

/** Characters a written phone number may hold between its digits (B27 v15): spaces, dashes (incl. Japanese ー), dots, brackets, slashes, invisible marks. */
function isPhoneSeparator(c: number): boolean {
  return c === 0x20 || c === 0x28 || c === 0x29 || c === 0x2d || c === 0x2e || c === 0x2f || c === 0xa0 ||
    (c >= 0x2000 && c <= 0x2015) || (c >= 0x202a && c <= 0x202f) || c === 0x205f || c === 0x2060 || (c >= 0x2066 && c <= 0x2069) ||
    c === 0xad || c === 0x61c || c === 0x30fc || c === 0xff70 || c === 0x2212 || c === 0x3000 || c === 0xfeff || c === 0xff08 || c === 0xff09 || (c >= 0xff0d && c <= 0xff0f);
}

/**
 * B27 v15 (shared-spec ADR 0010): the canonical form of a phone number, or null when `t` is not one. After an
 * optional `tel:` (any ASCII case), `t` may hold only decimal digits (any `DIGIT_ZEROS` run), separators and one
 * `+` / `＋` before the first digit, with 8-15 digits (8-17 when they start with the international `00` and there
 * is no `+`). Form: `+` and the digits when written with `+`; `+` and the digits after `00`; else the digits (ASCII).
 */
export function phoneNumberForm(t: string): string | null {
  const s = /^tel:/i.test(t) ? t.slice(4) : t;
  let plus = false;
  let digits = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    const zero = DIGIT_ZEROS.find((z) => c >= z && c <= z + 9);
    if (zero !== undefined) digits += String(c - zero);
    else if ((c === 0x2b || c === 0xff0b) && !plus && !digits) plus = true;
    else if (!isPhoneSeparator(c)) return null;
  }
  const zeroZero = !plus && digits.startsWith('00');
  if (digits.length < 8 || digits.length > (zeroZero ? 17 : 15)) return null;
  return plus ? `+${digits}` : zeroZero ? `+${digits.slice(2)}` : digits;
}

/** SHA-256 of the UTF-8 bytes of `s`, lower-case hex (FIPS 180-4). Pure and synchronous: crypto.subtle is async and missing on plain-http pages. */
export function sha256Hex(s: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    let c = s.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length && (s.charCodeAt(i + 1) & 0xfc00) === 0xdc00) {
      c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00);
    } else if (c >= 0xd800 && c < 0xe000) c = 0xfffd; // lone surrogate: U+FFFD, as TextEncoder does
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  const bits = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bits >>> (i * 8)) & 255);
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const w = new Array<number>(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let o = 0; o < bytes.length; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + 4 * i]! << 24) | (bytes[o + 4 * i + 1]! << 16) | (bytes[o + 4 * i + 2]! << 8) | bytes[o + 4 * i + 3]!;
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15]!, 7) ^ rotr(w[i - 15]!, 18) ^ (w[i - 15]! >>> 3);
      const s1 = rotr(w[i - 2]!, 17) ^ rotr(w[i - 2]!, 19) ^ (w[i - 2]! >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) | 0;
    }
    let [a, b, c, d, e, f, g, k] = h as [number, number, number, number, number, number, number, number];
    for (let i = 0; i < 64; i++) {
      const t1 = (k + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i]! + w[i]!) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    [a, b, c, d, e, f, g, k].forEach((v, i) => (h[i] = (h[i]! + v) | 0));
  }
  return h.map((v) => (v >>> 0).toString(16).padStart(8, '0')).join('');
}
