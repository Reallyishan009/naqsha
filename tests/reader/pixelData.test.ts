import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isPixelData } from '../../src/reader/pixelData';

const validPixelData = fc
  .record({ width: fc.integer({ min: 1, max: 16 }), height: fc.integer({ min: 1, max: 16 }) })
  .chain(({ width, height }) =>
    fc
      .uint8Array({ minLength: width * height * 4, maxLength: width * height * 4 })
      .map((bytes) => ({ width, height, data: new Uint8ClampedArray(bytes) })),
  );

describe('isPixelData', () => {
  it('R6.1 accepts a 2 x 1 image with 8 bytes', () => {
    expect(isPixelData({ width: 2, height: 1, data: new Uint8ClampedArray(8) })).toBe(true);
  });

  it('R6.4 rejects a wrong byte length, a zero size, a fractional size and non-objects', () => {
    expect(isPixelData({ width: 2, height: 1, data: new Uint8ClampedArray(7) })).toBe(false);
    expect(isPixelData({ width: 0, height: 1, data: new Uint8ClampedArray(0) })).toBe(false);
    expect(isPixelData({ width: 1.5, height: 2, data: new Uint8ClampedArray(12) })).toBe(false);
    expect(isPixelData({ width: 1, height: 1, data: new Uint8Array(4) })).toBe(false);
    expect(isPixelData(null)).toBe(false);
    expect(isPixelData(undefined)).toBe(false);
    expect(isPixelData(Object.create(null))).toBe(false);
  });

  it('R6.4 pixel data with a wrong size or length is rejected, for any value, without throwing', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        validPixelData,
        fc.integer({ min: 1, max: 20 }),
        fc.boolean(),
        fc.constantFrom('zero', 'negative', 'fractional'),
        fc.constantFrom('width', 'height'),
        (anything, valid, delta, grow, badSize, axis) => {
          // any value must not throw; if accepted it must be well formed
          const verdict = isPixelData(anything);
          if (verdict) {
            const p = anything as { width: number; height: number; data: Uint8ClampedArray };
            expect(Number.isInteger(p.width) && p.width > 0).toBe(true);
            expect(Number.isInteger(p.height) && p.height > 0).toBe(true);
            expect(p.data.length).toBe(p.width * p.height * 4);
          }

          // array length changed by a non-zero amount
          const changedLength = grow
            ? valid.data.length + delta
            : Math.max(0, valid.data.length - delta);
          expect(
            isPixelData({ ...valid, data: new Uint8ClampedArray(changedLength) }),
          ).toBe(false);

          // width or height of 0, negative or fractional
          const bad = badSize === 'zero' ? 0 : badSize === 'negative' ? -valid[axis] : valid[axis] + 0.5;
          expect(isPixelData({ ...valid, [axis]: bad })).toBe(false);
          expect(isPixelData(valid)).toBe(true);
        },
      ),
    );
  });
});
