import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { angleDifferenceDegrees, cardToImage, normalizeDegrees } from '../../src/reader/pose';
import type { Pose } from '../../src/reader/types';

const angle = fc.oneof(
  fc.double({ min: -1e6, max: 1e6, noNaN: true }),
  fc.integer({ min: -11111, max: 11111 }).map((k) => k * 180),
);

describe('normalizeDegrees', () => {
  it('R18.7 normalised angles lie in (-180, 180] and differ from the input by a multiple of 360', () => {
    fc.assert(
      fc.property(angle, (x) => {
        const r = normalizeDegrees(x);
        const k = (x - r) / 360;
        // The subtraction x - r rounds at about one ulp of x (about 1.2e-10 at 1e6), so the
        // tolerance of 1e-9 is scaled up for inputs beyond 1e6 (never down).
        const tolerance = 1e-9 * Math.max(1, Math.abs(x) / 1e6);
        return r > -180 && r <= 180 && Math.abs(k - Math.round(k)) <= tolerance;
      }),
    );
  });

  it('R18.7 keeps 180 as 180 and turns -180 into 180', () => {
    expect(normalizeDegrees(180)).toBe(180);
    expect(normalizeDegrees(-180)).toBe(180);
  });

  it('R18.7 handles large inputs and returns NaN for non-finite input', () => {
    expect(normalizeDegrees(1e6)).toBeCloseTo(-80, 6); // 1e6 = 2777*360 + 280
    expect(normalizeDegrees(-1e6)).toBeCloseTo(80, 6);
    expect(normalizeDegrees(Infinity)).toBeNaN();
    expect(normalizeDegrees(NaN)).toBeNaN();
  });
});

describe('angleDifferenceDegrees', () => {
  it('R18.7 179 and -179 degrees differ by 2', () => {
    expect(angleDifferenceDegrees(179, -179)).toBeCloseTo(2, 9);
  });
});

describe('cardToImage', () => {
  const s = 7;
  const origin = { x: 30, y: 40 };
  it('R10.1 a 90-degree pose maps (1, 0) mm to (origin.x, origin.y + s)', () => {
    const pose: Pose = { tiltDegrees: 90, pixelsPerMm: s, originPx: origin, orientation: 'upright' };
    const p = cardToImage(pose, { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(origin.x, 9);
    expect(p.y).toBeCloseTo(origin.y + s, 9);
  });

  it('R10.1 a pose with tilt 0 maps (x, y) mm to (origin.x + s*x, origin.y + s*y)', () => {
    const pose: Pose = { tiltDegrees: 0, pixelsPerMm: s, originPx: origin, orientation: 'upright' };
    const p = cardToImage(pose, { x: 3, y: 5 });
    expect(p.x).toBeCloseTo(origin.x + s * 3, 9);
    expect(p.y).toBeCloseTo(origin.y + s * 5, 9);
  });
});
