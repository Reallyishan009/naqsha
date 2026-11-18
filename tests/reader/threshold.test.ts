import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chooseThreshold, classifyDark } from '../../src/reader/threshold';
import type { GreyImage } from '../../src/reader/types';

const greyImage = (maxSide: number): fc.Arbitrary<GreyImage> =>
  fc
    .tuple(fc.integer({ min: 0, max: maxSide }), fc.integer({ min: 0, max: maxSide }))
    .chain(([width, height]) =>
      fc
        .array(fc.integer({ min: 0, max: 255 }), { minLength: width * height, maxLength: width * height })
        .map((l) => ({ width, height, levels: Uint8Array.from(l) })),
    );

describe('chooseThreshold', () => {
  it('R8.1 a two-level image of 20 and 215 gets threshold 118, the middle of the empty gap', () => {
    // best split t = 20; bins 21..214 are empty so tEnd = 214; t* = floor((20 + 214) / 2) = 117; threshold = 118
    const grey: GreyImage = { width: 4, height: 1, levels: Uint8Array.from([20, 215, 20, 215]) };
    const threshold = chooseThreshold(grey);
    expect(threshold).toBe(118);
    expect(threshold).toBeGreaterThan(20);
    expect(threshold).toBeLessThanOrEqual(215);
    expect(Array.from(classifyDark(grey, threshold).dark)).toEqual([1, 0, 1, 0]);
  });

  it('R8.4 an image with no pixels or one grey level gets threshold 0', () => {
    expect(chooseThreshold({ width: 0, height: 0, levels: new Uint8Array(0) })).toBe(0);
    expect(chooseThreshold({ width: 2, height: 2, levels: new Uint8Array(4).fill(255) })).toBe(0);
  });

  it('R8.1 the threshold depends only on the histogram', () => {
    fc.assert(
      fc.property(greyImage(64), fc.integer(), (grey, seed) => {
        const shuffled = Uint8Array.from(grey.levels);
        let state = seed >>> 0;
        for (let i = shuffled.length - 1; i > 0; i--) {
          state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
          const j = state % (i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        expect(chooseThreshold({ ...grey, levels: shuffled })).toBe(chooseThreshold(grey));
      }),
    );
  });

  it('R8.3 shifting every level by a constant without clipping keeps the dark and light classification', () => {
    const arb = fc
      .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
      .map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as const)
      .chain(([lo, hi]) =>
        fc.tuple(
          fc.tuple(fc.integer({ min: 0, max: 16 }), fc.integer({ min: 0, max: 16 })).chain(([w, h]) =>
            fc
              .array(fc.integer({ min: lo, max: hi }), { minLength: w * h, maxLength: w * h })
              .map((l) => ({ width: w, height: h, levels: Uint8Array.from(l) }) as GreyImage),
          ),
          fc.integer({ min: -lo, max: 255 - hi }),
        ),
      );
    fc.assert(
      fc.property(arb, ([grey, shift]) => {
        const shifted: GreyImage = { ...grey, levels: grey.levels.map((v) => v + shift) };
        const a = classifyDark(grey, chooseThreshold(grey));
        const b = classifyDark(shifted, chooseThreshold(shifted));
        expect(Array.from(b.dark)).toEqual(Array.from(a.dark));
      }),
    );
  });

  it('R8.4 any image has a threshold from 0 to 255, and an image with one grey level has no dark pixel', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 64 }),
        fc.integer({ min: 0, max: 64 }),
        fc.integer({ min: 0, max: 255 }),
        (width, height, level) => {
          const grey: GreyImage = { width, height, levels: new Uint8Array(width * height).fill(level) };
          const threshold = chooseThreshold(grey);
          expect(Number.isInteger(threshold)).toBe(true);
          expect(threshold).toBeGreaterThanOrEqual(0);
          expect(threshold).toBeLessThanOrEqual(255);
          expect(classifyDark(grey, threshold).dark.every((d) => d === 0)).toBe(true);
        },
      ),
    );
    fc.assert(
      fc.property(greyImage(64), (grey) => {
        const threshold = chooseThreshold(grey);
        expect(Number.isInteger(threshold)).toBe(true);
        expect(threshold).toBeGreaterThanOrEqual(0);
        expect(threshold).toBeLessThanOrEqual(255);
      }),
    );
  });
});
