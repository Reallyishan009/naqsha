import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decideOrientation,
  MIN_SEPARATION,
  orientationSeparation,
  type DiameterPair,
} from '../../src/reader/orientation';

// Expected pairs with a gap, built by construction: e0 in 2..100, e1 = e0 + gap (gap 1..100, either sign), both within 2..200.
const expectedWithGap: fc.Arbitrary<DiameterPair> = fc
  .tuple(fc.integer({ min: 2, max: 100 }), fc.integer({ min: 1, max: 100 }), fc.boolean())
  .map(([e0, gap, flip]): DiameterPair => (flip ? [e0 + gap, e0] : [e0, e0 + gap]));

const measuredDiameter = fc.double({ min: 0, max: 400, noNaN: true });
const measuredPair: fc.Arbitrary<DiameterPair> = fc.tuple(measuredDiameter, measuredDiameter);

describe('orientation worked examples', () => {
  const e: DiameterPair = [15, 18];

  it('R18.2 measured [15.1, 17.9] against expected [15, 18] gives q +0.933 and upright', () => {
    const d = decideOrientation(e, [15.1, 17.9]);
    expect(d.separation).toBeCloseTo(0.9333, 3);
    expect(d.kind).toBe('upright');
  });

  it('R18.3 measured [17.9, 15.1] against expected [15, 18] gives q -0.933 and upside-down', () => {
    const d = decideOrientation(e, [17.9, 15.1]);
    expect(d.separation).toBeCloseTo(-0.9333, 3);
    expect(d.kind).toBe('upside-down');
  });

  it('R18.4 measured [16.5, 16.5] against expected [15, 18] gives q 0 and ambiguous', () => {
    const d = decideOrientation(e, [16.5, 16.5]);
    expect(d.separation).toBeCloseTo(0, 10);
    expect(d.kind).toBe('ambiguous');
  });

  it('R18.4 equal expected diameters give separation 0 and ambiguous, never NaN', () => {
    const d = decideOrientation([15, 15], [15, 15]);
    expect(d).toEqual({ kind: 'ambiguous', separation: 0 });
  });

  it('R18.6 the decision thresholds are at plus and minus MIN_SEPARATION', () => {
    expect(MIN_SEPARATION).toBe(0.5);
    // e = [0, 4], u = [1, 3]: cUp = 2, cDown = 6, q = 0.5
    expect(decideOrientation([0, 4], [1, 3]).kind).toBe('upright');
    expect(decideOrientation([0, 4], [3, 1]).kind).toBe('upside-down');
  });
});

describe('orientation properties', () => {
  it('R18.4 two equal measured diameters are ambiguous', () => {
    fc.assert(
      fc.property(expectedWithGap, fc.integer({ min: 2, max: 200 }), (expected, m) => {
        const d = decideOrientation(expected, [m, m]);
        expect(d.separation).toBe(0);
        expect(d.kind).toBe('ambiguous');
      }),
    );
  });

  // Error as a fraction of g / 4, in [-1, 1]. The exact boundaries -1, 0 and 1 are generated on purpose.
  const errorFraction = fc.oneof(fc.double({ min: -1, max: 1, noNaN: true }), fc.constantFrom(-1, 0, 1));

  it('R18.5 measurement errors within a quarter of the diameter gap never change the decision', () => {
    fc.assert(
      fc.property(expectedWithGap, fc.boolean(), errorFraction, errorFraction, (expected, upsideDown, t0, t1) => {
        const [e0, e1] = expected;
        const bound = Math.abs(e0 - e1) / 4;
        const x0 = t0 * bound;
        const x1 = t1 * bound;
        const measuredUpright: DiameterPair = upsideDown ? [e1 + x0, e0 + x1] : [e0 + x0, e1 + x1];
        expect(decideOrientation(expected, measuredUpright).kind).toBe(upsideDown ? 'upside-down' : 'upright');
      }),
    );
  });

  it('R18.6 multiplying every diameter by the same factor does not change the separation or the decision', () => {
    fc.assert(
      fc.property(expectedWithGap, measuredPair, fc.integer({ min: -4, max: 4 }), (expected, measured, k) => {
        const f = 2 ** k;
        const scaledExpected: DiameterPair = [expected[0] * f, expected[1] * f];
        const scaledMeasured: DiameterPair = [measured[0] * f, measured[1] * f];
        expect(orientationSeparation(scaledExpected, scaledMeasured)).toBe(orientationSeparation(expected, measured));
        expect(decideOrientation(scaledExpected, scaledMeasured)).toEqual(decideOrientation(expected, measured));
      }),
    );
  });
});
