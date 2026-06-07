import { describe, expect, it } from 'vitest';
import { computeSignature, h32 } from '../src/signature.js';
import vectors from './signature-vectors.json' with { type: 'json' };

// SAME golden vectors as the server and every other SDK. If this SDK's copy of
// the signature ever drifts from the spec, deferred match breaks silently — so
// this test is the cross-repo contract.
describe('h32 — golden vectors (cross-repo parity)', () => {
  for (const v of vectors.h32) {
    it(`h32(${JSON.stringify(v.input)})`, () => {
      expect(h32(v.input)).toBe(v.expected);
    });
  }
});

describe('computeSignature — golden vectors (cross-repo parity)', () => {
  for (const v of vectors.signatures) {
    it(v.name, () => {
      expect(computeSignature(v.input)).toEqual(v.expected);
    });
  }
});
