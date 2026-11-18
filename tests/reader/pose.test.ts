import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCardProfile } from '../../src/codec/index.ts';
import type { CardProfile } from '../../src/codec/types.ts';
import { findPegHolePair } from '../../src/reader/pegHoles';
import { angleDifferenceDegrees, cardToImage, normalizeDegrees, poseFromPegHoles } from '../../src/reader/pose';
import type { Orientation, Pose } from '../../src/reader/types';
import { pegHoleRegions } from '../support/images';
import { profileArbitrary } from '../support/profiles';

function loadDemoProfile(): CardProfile {
  const parsed = parseCardProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
  if (!parsed.ok) throw new Error('demo profile is invalid');
  return parsed.value;
}

const demo = loadDemoProfile();

/** Places the demo pegs with the given pose, finds the pair with findPegHolePair, and recovers the pose. */
function recover(profile: CardProfile, pose: Pose): Pose {
  const [peg0, peg1] = pegHoleRegions(profile, pose);
  const pair = findPegHolePair(profile, [peg0, peg1]);
  expect(pair).not.toBeNull();
  return poseFromPegHoles(profile, pair!, pose.orientation);
}

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

describe('poseFromPegHoles', () => {
  it('R9.4 recovers the pose of the demo card at tilt 3 degrees, 6 px/mm, origin (120, 90), upright', () => {
    const pose: Pose = { tiltDegrees: 3, pixelsPerMm: 6, originPx: { x: 120, y: 90 }, orientation: 'upright' };
    const got = recover(demo, pose);
    expect(got.orientation).toBe('upright');
    expect(got.tiltDegrees).toBeCloseTo(3, 6);
    expect(got.pixelsPerMm).toBeCloseTo(6, 9);
    expect(got.originPx.x).toBeCloseTo(120, 6);
    expect(got.originPx.y).toBeCloseTo(90, 6);
  });

  it('R18.7 recovers the same card at tilt 183 as upside-down with tilt -177', () => {
    const pose: Pose = { tiltDegrees: 183, pixelsPerMm: 6, originPx: { x: 120, y: 90 }, orientation: 'upside-down' };
    const got = recover(demo, pose);
    expect(got.orientation).toBe('upside-down');
    expect(got.tiltDegrees).toBeCloseTo(-177, 6);
    expect(got.pixelsPerMm).toBeCloseTo(6, 9);
    expect(got.originPx.x).toBeCloseTo(120, 6);
    expect(got.originPx.y).toBeCloseTo(90, 6);
  });

  it('R9.4 the pose recovered from the peg hole pair equals the pose that placed them', () => {
    const scenario = fc.record({
      profile: profileArbitrary,
      pixelsPerMm: fc.double({ min: 2, max: 20, noNaN: true }),
      offset: fc.double({ min: -10, max: 10, noNaN: true }),
      orientation: fc.constantFrom<Orientation>('upright', 'upside-down'),
      originX: fc.double({ min: -2000, max: 2000, noNaN: true }),
      originY: fc.double({ min: -2000, max: 2000, noNaN: true }),
    });
    fc.assert(
      fc.property(scenario, ({ profile, pixelsPerMm, offset, orientation, originX, originY }) => {
        const pose: Pose = {
          tiltDegrees: normalizeDegrees(offset + (orientation === 'upright' ? 0 : 180)),
          pixelsPerMm,
          originPx: { x: originX, y: originY },
          orientation,
        };
        const [peg0, peg1] = pegHoleRegions(profile, pose);
        const pair = findPegHolePair(profile, [peg0, peg1]);
        expect(pair).not.toBeNull();
        const got = poseFromPegHoles(profile, pair!, orientation);
        expect(got.orientation).toBe(orientation);
        expect(angleDifferenceDegrees(got.tiltDegrees, pose.tiltDegrees)).toBeLessThanOrEqual(1e-6);
        expect(Math.abs(got.pixelsPerMm / pixelsPerMm - 1)).toBeLessThanOrEqual(1e-9);
        expect(Math.abs(got.originPx.x - originX)).toBeLessThanOrEqual(1e-6);
        expect(Math.abs(got.originPx.y - originY)).toBeLessThanOrEqual(1e-6);
      }),
    );
  });
});
