import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCardProfile } from '../../src/codec/index.ts';
import type { CardGrid, CardProfile } from '../../src/codec/types.ts';
import { cardToImage, normalizeDegrees } from '../../src/reader/pose';
import {
  SAMPLING_RADIUS_FRACTION,
  decidePunched,
  sampleCardGrid,
  samplingRadiusPx,
} from '../../src/reader/sampling';
import type { DarkMap, Pose } from '../../src/reader/types';
import { cardGridArbitrary, profileArbitrary } from '../support/profiles';

function loadDemoProfile(): CardProfile {
  const parsed = parseCardProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
  if (!parsed.ok) throw new Error('demo profile is invalid');
  return parsed.value;
}

const demo = loadDemoProfile();

function hookPointMm(profile: CardProfile, hookRow: number, hookColumn: number) {
  return {
    x: profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm,
    y: profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm,
  };
}

/** Dark discs of the punched hole diameter at every punched hook position, nothing else. */
function drawGrid(profile: CardProfile, pose: Pose, grid: CardGrid, width: number, height: number): DarkMap {
  const dark = new Uint8Array(width * height);
  const radius = (profile.holeDiameterMm * pose.pixelsPerMm) / 2;
  grid.forEach((row, hookRow) =>
    row.forEach((punched, hookColumn) => {
      if (!punched) return;
      const c = cardToImage(pose, hookPointMm(profile, hookRow, hookColumn));
      for (let y = Math.max(0, Math.floor(c.y - radius)); y <= Math.min(height - 1, Math.ceil(c.y + radius)); y++) {
        for (let x = Math.max(0, Math.floor(c.x - radius)); x <= Math.min(width - 1, Math.ceil(c.x + radius)); x++) {
          if ((x + 0.5 - c.x) ** 2 + (y + 0.5 - c.y) ** 2 <= radius * radius) dark[y * width + x] = 1;
        }
      }
    }),
  );
  return { width, height, dark };
}

describe('sampling examples', () => {
  it('R10.3 the sampling radius is 0.6 of the hole radius in pixels', () => {
    const pose: Pose = { tiltDegrees: 0, pixelsPerMm: 10, originPx: { x: 0, y: 0 }, orientation: 'upright' };
    expect(SAMPLING_RADIUS_FRACTION).toBe(0.6);
    expect(samplingRadiusPx(demo, pose)).toBeCloseTo(0.6 * (demo.holeDiameterMm / 2) * 10, 12);
  });

  it('R11.1 exactly half dark is not punched, more than half is', () => {
    expect(decidePunched(5, 10)).toBe(false);
    expect(decidePunched(6, 10)).toBe(true);
  });

  // Added in task 8.2: the strengthened coverage check in tests/structure/propertyNames.test.ts
  // reported decidePunched as an exported function with example tests only.
  it('R11.1 a hook position is punched exactly when more than half of its sampling pixels are dark', () => {
    // **Validates: Requirements 11.1**
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }).chain((sampleCount) => fc.tuple(fc.constant(sampleCount), fc.nat({ max: sampleCount }))),
        ([sampleCount, darkCount]) => {
          expect(decidePunched(darkCount, sampleCount)).toBe(darkCount > sampleCount / 2);
          // The majority is of the sampled pixels, so the decision never depends on the scale.
          expect(decidePunched(darkCount * 3, sampleCount * 3)).toBe(decidePunched(darkCount, sampleCount));
          // Dark and light swapped: both halves cannot be the majority, and a tie is not punched.
          expect(decidePunched(darkCount, sampleCount) && decidePunched(sampleCount - darkCount, sampleCount)).toBe(false);
          if (darkCount * 2 === sampleCount) expect(decidePunched(darkCount, sampleCount)).toBe(false);
        },
      ),
      { seed: 80219, numRuns: 300 },
    );
  });

  it('R10.4 a card shifted so one hook position leaves the image returns null', () => {
    const pose: Pose = { tiltDegrees: 0, pixelsPerMm: 5, originPx: { x: 0, y: 0 }, orientation: 'upright' };
    const width = Math.ceil(demo.cardWidthMm * 5);
    const height = Math.ceil(demo.cardHeightMm * 5);
    const grid: CardGrid = Array.from({ length: demo.hookRows }, () => Array<boolean>(demo.hookColumns).fill(true));
    const map = drawGrid(demo, pose, grid, width, height);
    expect(sampleCardGrid(demo, pose, map)).toEqual(grid);
    const shifted: Pose = { ...pose, originPx: { x: width - 20, y: 0 } };
    expect(sampleCardGrid(demo, shifted, map)).toBeNull();
  });
});

describe('sampleCardGrid properties', () => {
  it('R10.3 the sampling radius never exceeds the hole radius in pixels and is positive', () => {
    const pose = fc.record({
      tiltDegrees: fc.double({ min: -180, max: 180, noNaN: true }).map((t) => normalizeDegrees(t)),
      pixelsPerMm: fc.double({ min: 0.5, max: 50, noNaN: true }),
      originPx: fc.record({
        x: fc.double({ min: -1e5, max: 1e5, noNaN: true }),
        y: fc.double({ min: -1e5, max: 1e5, noNaN: true }),
      }),
      orientation: fc.constantFrom('upright' as const, 'upside-down' as const),
    });
    fc.assert(
      fc.property(profileArbitrary, pose, (profile, p) => {
        const radius = samplingRadiusPx(profile, p);
        const holeRadiusPx = (profile.holeDiameterMm / 2) * p.pixelsPerMm;
        const expected = SAMPLING_RADIUS_FRACTION * holeRadiusPx;
        return radius > 0 && radius <= holeRadiusPx && Math.abs(radius - expected) <= 1e-12 * expected;
      }),
    );
  });

  it('R10.4 a card that leaves the image is refused and no pixel outside the image is read', () => {
    const anyPose = (width: number, height: number) =>
      fc.record({
        tiltDegrees: fc.double({ min: -180, max: 180, noNaN: true }).map((t) => normalizeDegrees(t)),
        pixelsPerMm: fc.double({ min: 1, max: 12, noNaN: true }),
        originPx: fc.oneof(
          fc.record({ x: fc.double({ min: -1e5, max: 1e5, noNaN: true }), y: fc.double({ min: -1e5, max: 1e5, noNaN: true }) }),
          fc.record({ x: fc.double({ min: 0, max: width, noNaN: true }), y: fc.double({ min: 0, max: height, noNaN: true }) }),
        ),
        orientation: fc.constantFrom('upright' as const, 'upside-down' as const),
      });
    // Gentle poses on larger images, so that the card often fits and the non-null branch is exercised too.
    const gentlePose = fc.record({
      tiltDegrees: fc.double({ min: -5, max: 5, noNaN: true }),
      pixelsPerMm: fc.double({ min: 1, max: 3, noNaN: true }),
      originPx: fc.record({ x: fc.double({ min: 0, max: 20, noNaN: true }), y: fc.double({ min: 0, max: 20, noNaN: true }) }),
      orientation: fc.constant('upright' as const),
    });
    const scenario = fc.oneof(
      fc
        .record({ width: fc.integer({ min: 1, max: 300 }), height: fc.integer({ min: 1, max: 300 }) })
        .chain(({ width, height }) =>
          fc.record({ profile: profileArbitrary, width: fc.constant(width), height: fc.constant(height), pose: anyPose(width, height) }),
        ),
      fc.record({
        profile: profileArbitrary,
        width: fc.integer({ min: 200, max: 300 }),
        height: fc.integer({ min: 200, max: 300 }),
        pose: gentlePose,
      }),
    );
    fc.assert(
      fc.property(scenario, ({ profile, width, height, pose }) => {
        const reads: number[] = [];
        const recording = new Proxy(new Uint8Array(width * height), {
          get(target, key, receiver) {
            if (typeof key === 'string' && /^(0|[1-9]\d*)$/.test(key)) reads.push(Number(key));
            return Reflect.get(target, key, receiver);
          },
        });
        const result = sampleCardGrid(profile, pose, { width, height, dark: recording });
        if (result === null) return reads.length === 0;
        return reads.every((index) => index >= 0 && index < width * height && index % width < width);
      }),
    );
  });

  it('R11.1 dark discs drawn at punched hook positions are read back as the same CardGrid', () => {
    const scenario = profileArbitrary.chain((profile) =>
      fc.record({
        profile: fc.constant(profile),
        grid: cardGridArbitrary(profile),
        scale: fc.double({ min: 3, max: 12, noNaN: true }),
        tilt: fc.oneof(
          fc.double({ min: -10, max: 10, noNaN: true }),
          fc.double({ min: 170, max: 190, noNaN: true }).map((t) => normalizeDegrees(t)),
        ),
      }),
    );
    fc.assert(
      fc.property(scenario, ({ profile, grid, scale, tilt }) => {
        const margin = 2;
        const radius = (profile.holeDiameterMm * scale) / 2;
        const probe: Pose = { tiltDegrees: tilt, pixelsPerMm: scale, originPx: { x: 0, y: 0 }, orientation: 'upright' };
        const centres = grid.flatMap((row, hookRow) =>
          row.map((_, hookColumn) => cardToImage(probe, hookPointMm(profile, hookRow, hookColumn))),
        );
        const minX = Math.min(...centres.map((c) => c.x)) - radius - margin;
        const maxX = Math.max(...centres.map((c) => c.x)) + radius + margin;
        const minY = Math.min(...centres.map((c) => c.y)) - radius - margin;
        const maxY = Math.max(...centres.map((c) => c.y)) + radius + margin;
        const pose: Pose = { ...probe, originPx: { x: -minX, y: -minY } };
        const map = drawGrid(profile, pose, grid, Math.ceil(maxX - minX), Math.ceil(maxY - minY));
        expect(sampleCardGrid(profile, pose, map)).toEqual(grid);
      }),
    );
  });
});
