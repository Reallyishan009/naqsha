import { readFileSync } from 'node:fs';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { demoPattern } from '../../scripts/make_fixtures.ts';
import { parseCardProfile, validateCardProfile } from '../../src/codec/index.ts';
import type { CardGrid, CardProfile } from '../../src/codec/types.ts';
import { angleDifferenceDegrees } from '../../src/reader/pose';
import { MAX_CANDIDATE_REGIONS, MIN_HOLE_DIAMETER_PX, MIN_REGION_AREA_PX, readCard } from '../../src/reader/readCard';
import type { PixelData, ReadResult } from '../../src/reader/types';
import { padPixelData, renderCardPixels } from '../support/images';
import { cardGridArbitrary, mutateProfile, profileArbitrary, REMOVE } from '../support/profiles';

function loadDemoProfile(): CardProfile {
  const parsed = parseCardProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
  if (!parsed.ok) throw new Error('demo profile is invalid');
  return parsed.value;
}

const demo = loadDemoProfile();
const card = demoPattern(demo)[0]!;
const SEED = 1234;
const clean = { noise: 0, tiltDegrees: 0, shade: 0, seed: SEED, pixelsPerMm: 6 };

/** Removes whole pixel rows from the top of the image. */
function cropTop(pixels: PixelData, rows: number): PixelData {
  return {
    width: pixels.width,
    height: pixels.height - rows,
    data: pixels.data.slice(rows * pixels.width * 4),
  };
}

function expectNoGrid(result: ReadResult): void {
  expect(result.ok).toBe(false);
  expect('grid' in result).toBe(false);
}

describe('readCard', () => {
  it('exports the candidate constants', () => {
    expect(MIN_REGION_AREA_PX).toBe(4);
    expect(MAX_CANDIDATE_REGIONS).toBe(400);
  });

  it('R12.1/R11.3 a clean render reads back exactly, upright, with tilt and scale recovered', () => {
    const result = readCard(demo, renderCardPixels(demo, card, clean));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grid).toEqual(card);
    expect(result.pose.orientation).toBe('upright');
    expect(Math.abs(result.pose.tiltDegrees)).toBeLessThan(0.5);
    expect(Math.abs(result.pose.pixelsPerMm / 6 - 1)).toBeLessThan(0.01);
  });

  it('R12.2 an invalid profile gives invalid-profile with the validateCardProfile violations', () => {
    const pixels = renderCardPixels(demo, card, clean);
    for (const bad of [{}, mutateProfile(demo, ['endOrder'], REMOVE)]) {
      const result = readCard(bad, pixels);
      expectNoGrid(result);
      if (result.ok) continue;
      expect(result.failure.reason).toBe('invalid-profile');
      if (result.failure.reason === 'invalid-profile') {
        expect(result.failure.violations).toEqual(validateCardProfile(bad));
        expect(result.failure.violations.length).toBeGreaterThan(0);
      }
    }
  });

  it('R6.4/R12.1 pixel data of the wrong length gives invalid-image', () => {
    const result = readCard(demo, { width: 10, height: 10, data: new Uint8ClampedArray(399) });
    expectNoGrid(result);
    expect(!result.ok && result.failure.reason).toBe('invalid-image');
  });

  it('R12.2 the profile is checked before the pixels', () => {
    const result = readCard({}, 'not pixels');
    expect(!result.ok && result.failure.reason).toBe('invalid-profile');
  });

  it('R9.7 a uniform grey image gives peg-holes-not-found', () => {
    const data = new Uint8ClampedArray(100 * 80 * 4).fill(200);
    const result = readCard(demo, { width: 100, height: 80, data });
    expectNoGrid(result);
    expect(!result.ok && result.failure.reason).toBe('peg-holes-not-found');
  });

  it('R10.4 a render cropped through the top hook rows gives card-outside-image', () => {
    // Hook row 2 centre is at (5 + 6 + 6) mm * 6 = 102 px; cropping 100 px puts rows 0 to 2 outside, pegs at 165 px stay inside.
    const cropped = cropTop(renderCardPixels(demo, card, clean), 100);
    const result = readCard(demo, cropped);
    expectNoGrid(result);
    expect(!result.ok && result.failure.reason).toBe('card-outside-image');
  });

  it('R12.1 padding the image with a uniform grey border does not change the grid', () => {
    const padded = padPixelData(renderCardPixels(demo, card, clean), { left: 20, top: 10, right: 5, bottom: 30, level: 70 });
    const result = readCard(demo, padded);
    expect(result.ok && result.grid).toEqual(card);
  });

  it('R12.1 the input pixel data is not mutated', () => {
    const pixels = renderCardPixels(demo, card, clean);
    const before = pixels.data.slice();
    readCard(demo, pixels);
    expect(pixels.data).toEqual(before);
  });

  for (const tiltDegrees of [180, 183]) {
    it(`R18.3 a card rotated by ${tiltDegrees} degrees reads back as the upright grid, upside-down`, () => {
      const result = readCard(demo, renderCardPixels(demo, card, { ...clean, tiltDegrees }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.grid).toEqual(card);
      expect(result.pose.orientation).toBe('upside-down');
      expect(angleDifferenceDegrees(result.pose.tiltDegrees, tiltDegrees)).toBeLessThan(0.5);
    });
  }
});

describe('readCard at low resolution (task 5.13 counterexamples)', () => {
  const lowResolutionProfile = (() => {
    const withFirst = mutateProfile(demo, ['pegHoles', 0, 'diameterMm'], 2.5);
    const parsedFirst = parseCardProfile(withFirst);
    if (!parsedFirst.ok) throw new Error('profile is invalid');
    const parsed = parseCardProfile(mutateProfile(parsedFirst.value, ['pegHoles', 1, 'diameterMm'], 2.8));
    if (!parsed.ok) throw new Error('profile is invalid');
    return parsed.value;
  })();
  const lowResolutionCard = demoPattern(lowResolutionProfile)[0]!;

  it('the low-resolution profile is valid', () => {
    expect(validateCardProfile(lowResolutionProfile)).toEqual([]);
  });

  for (const pixelsPerMm of [2.75, 2.25, 1.25]) {
    it(`R18.5 at ${pixelsPerMm} px/mm the result is the true grid or a failure, never a different grid`, () => {
      const pixels = renderCardPixels(lowResolutionProfile, lowResolutionCard, {
        noise: 0,
        tiltDegrees: 0,
        shade: 0,
        seed: SEED,
        pixelsPerMm,
      });
      const result = readCard(lowResolutionProfile, pixels);
      if (result.ok) expect(result.grid).toEqual(lowResolutionCard);
      else expect('grid' in result).toBe(false);
    });
  }
});

describe('readCard R18.8 chosen scale', () => {
  const pegProfile = (() => {
    const withFirst = parseCardProfile(mutateProfile(demo, ['pegHoles', 0, 'diameterMm'], 2.5));
    if (!withFirst.ok) throw new Error('profile is invalid');
    const parsed = parseCardProfile(mutateProfile(withFirst.value, ['pegHoles', 1, 'diameterMm'], 2.8));
    if (!parsed.ok) throw new Error('profile is invalid');
    return parsed.value;
  })();
  const pegCard = demoPattern(pegProfile)[0]!;

  // Measured in task 5.13 (see measurements.md, "R18.8 chosen scale"): 2.25 px/mm is the highest scale at which the
  // peg holes are found but cannot be told apart (separation 0.49, just under MIN_SEPARATION 0.5, a narrow margin);
  // 2.0 px/mm is the clear case (separation 0.00). Both are deterministic for seed 1234.
  const cases: ReadonlyArray<{ pixelsPerMm: number; title: string; maxSeparation: number }> = [
    {
      pixelsPerMm: 2.25,
      title: 'R18.8 a valid profile rendered at 2.25 px/mm cannot be told apart and fails with ambiguous-orientation',
      maxSeparation: 0.5,
    },
    {
      pixelsPerMm: 2.0,
      title: 'R18.8 a valid profile rendered at 2.0 px/mm is the clear case and fails with ambiguous-orientation',
      maxSeparation: 0.05,
    },
  ];
  for (const { pixelsPerMm, title, maxSeparation } of cases) {
    it(title, () => {
      expect(validateCardProfile(pegProfile)).toEqual([]);
      const result = readCard(
        pegProfile,
        renderCardPixels(pegProfile, pegCard, { noise: 0, tiltDegrees: 0, shade: 0, seed: SEED, pixelsPerMm }),
      );
      expectNoGrid(result);
      expect(!result.ok && result.failure.reason).toBe('ambiguous-orientation');
      if (!result.ok && result.failure.reason === 'ambiguous-orientation') {
        expect(result.failure.separation).toBeLessThan(maxSeparation);
      }
    });
  }
});

const FAILURE_REASONS = [
  'invalid-profile',
  'invalid-image',
  'peg-holes-not-found',
  'ambiguous-orientation',
  'card-outside-image',
  'resolution-too-low',
];

/** R12.1 and R12.4: a success has a grid and a pose; a failure has one of the six reasons and no grid. */
function expectWellFormed(result: ReadResult): void {
  if (result.ok) {
    expect(result.grid).toBeDefined();
    expect(result.pose).toBeDefined();
  } else {
    expect(FAILURE_REASONS).toContain(result.failure.reason);
    expect('grid' in result).toBe(false);
  }
}

const smallSide = fc.integer({ min: 16, max: 64 });
const noiseImage: fc.Arbitrary<PixelData> = fc
  .tuple(smallSide, smallSide)
  .chain(([width, height]) =>
    fc
      .uint8Array({ minLength: width * height * 4, maxLength: width * height * 4 })
      .map((bytes) => ({ width, height, data: new Uint8ClampedArray(bytes) })),
  );
const uniformImage: fc.Arbitrary<PixelData> = fc
  .tuple(smallSide, smallSide, fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map(([width, height, level, alpha]) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) data.set([level, level, level, alpha], 4 * i);
    return { width, height, data };
  });

describe('readCard failure paths (properties)', () => {
  it('R9.7 an image with no peg holes fails with peg-holes-not-found and no grid', () => {
    // Part 1: a uniform image has no peg holes, so the reason is exactly peg-holes-not-found.
    fc.assert(
      fc.property(profileArbitrary, uniformImage, (profile, image) => {
        const result = readCard(profile, image);
        expect(result.ok).toBe(false);
        expect('grid' in result).toBe(false);
        expect(!result.ok && result.failure.reason).toBe('peg-holes-not-found');
      }),
      { numRuns: 100 },
    );

    // Part 2: random noise can contain a peg-like pair by chance, so the reader may fail at a later step. It must
    // still fail, with one of the six reasons and no grid.
    fc.assert(
      fc.property(profileArbitrary, noiseImage, (profile, image) => {
        const result = readCard(profile, image);
        expect(result.ok).toBe(false);
        expect('grid' in result).toBe(false);
        expect(FAILURE_REASONS).toContain(!result.ok && result.failure.reason);
      }),
      { numRuns: 100 },
    );
  });

  it('R9.7 a noise image that contains a peg-like pair fails at a later step (regression, task 5.13)', () => {
    // Shrunk counterexample found with seed 4242 at run 291 of the earlier single-part property
    // fc.oneof(uniformImage, noiseImage): a 44 x 20 noise image, profile "generated-profile" (card 26.925 x 15.5 mm,
    // 3 x 7 hooks, holeDiameterMm 1.5). It gave resolution-too-low, not peg-holes-not-found. The path is replayed
    // against that same arbitrary, because a path only replays against the arbitrary that produced it.
    const path =
      '291:6:0:3:0:1:1:2:1:0:5:3:4:3:5:4:4:1:1:1:2:0:0:0:0:0:0:0:2:4:3:3:4:3:8:0:0:5:6:15:5:2:1:0:1:0:6:0:1:7:14:1:5:13:6:2:1:1:1:6:0:1:21:10:1:0:0:6:0:1:7:10:16:7:12:5:16:22:1:16:1:1:0:14:5:0:14:2:2:0:0:2:0:8:0:1:0:2:0:2:0:7:0:1:0:1:2:0:0:0:7:0:1:20:0:0:2:0:0:0:0:0:1:7:13:0:1:7:17:0:2:4:6:0:1:0:1:0:0:0:0:8:1:1:4:16:4:11:2:1:4:2:1:0:2:0:0:0:8:1:0:11:23:1:17:1:2:0:9:7:0:11:1:0:3:0:0:2:0:6:15:1:5:2:0:1:10:0:1:0:5:0:8:1:5:11:0:0:3:2:1:0:1:1:0:1:0:1:4:12:7:10:14:1:3:2:0:4:0:6:1:4:8:1:3:6:0:6:0:12:22:0:15:23:0:1:1:8:1:7:13:1:1:0:1:9:1:6:16:7:14:0:1:8:0:1:1:0:9:2:9:6:2:0:1:0:0:0:9:1:0:15:0:1:13:0:7:4:2:1:0:0:2:0:0:0:2:3:0:2:0:0:1:0:8:0:1:0:2:3:7:1:1:0:1:0:1:0:10:6:0:5:7:4:0:6:13:1:5:2:0:0:1:1:7:2:7:0:17:1:12:1:4:16:17:0:1:18:0:5:1:0:0:1:3:1:0:1:9:0:6:16:0:1:0:1:1:0:0:1:2:0:1:1:2:1:0:0:1:0:2:2:5:15:1:20:6:9:7:7:2:2:0:2:10:2:0:12:1:20:1:1:1:0:1:0:0:7:1:1:13:1:6:17:6:0:12:6:10:5:0:2:0:0:2:7:0:1:7:0:17:7:0:13:1:0:1:0:3:0:8:1:7:0:13:3:0:2:0:4:0:7:0:0:1:6:12:7:15:5:2:1:1:2:7:1:7:13:6:12:20:4:0:15:1:3:0:14:1:7:0:10:1:0:2:1:5:1:0:2:2:1:3:1:1:2:0:2:0:1:2:1:0:0:1:1:1:0:2:0:0:1:1:0:0:0:2:23:0:1:1:0:0:0:0:2:1:1:6:16:0:0:1:1:0:0:0:2:19:7:16:1:15:2:7:1:7:17:1:0:9:21:1:17:5:10:1:0:2:0:1:4:0:1:7:0:16:18:7:14:0:1:6:14:17:1:3:0:2:1:0:0:2:7:1:0:4:1:7:15:0:1:23:7:0:16:0:1:7:16:1:7:16:0:1:0:2:11:0:1:6:17:5:10:0:1:6:6:2:9:1:11:0:1:17:1:0:2:0:1:0:7:0:1:0:0:2:0:2:0:1:22:1:6:8:1:2:0:12:0:9:19:1:6:12:4:0:8:0:1:2:1:8:0:1:7:10:1:7:0:14:1:6:15:1:6:11:0:0:0:0:6:17:6:0:0:19:0:10:6:6:12:0:1:18:7:11:1:3:9:1:4:9:7:8:13:1:2:4:0:12:1:17:0:1:7:17:1:18:1:4:9:5:13:1:16:1:16:0:1:5:0:12:23:1:18:0:1:7:0:10:1:0:2:1:1:0:2:0:1:17:1:6:10:1:0:14:0:0:0:0:4:0:0:16:0:1:5:5:0:1:6:0:13:4:0:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:5:0:0:7:0:1:0:0:0:0:0:0:0:0:0:0:0:0:1:5:16:5:0:15:1:6:0:7:9:20:7:16:1:1:0:10:2:0:13:1:7:2:0:4:3:0:1:6:14:7:15:7:11:6:9:16:0:0:0:0:2:0:1:0:0:12:1:4:15:21:1:7:4:0:1:1:0:0:0:0:2:0:0:1:5:11:2:1:2:0:0:0:0:0:0:1:0:1:2:0:0:0:7:0:23:1:14:1:6:0:10:0:0:0:0:2:4:17:18:1:4:9:20:1:3:1:0:0:0:0:0:0:3:0:0:14:1:2:1:1:0:0:3:0:1:7:16:0:1:6:16:1:3:0:14:6:16:1:23:0:0:0:0:3:1:17:1:1:7:1:7:11:6:11:8:14:1:5:11:0:1:3:9:1:7:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:3:3:0:14:1:0:2:8:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:3:2:0:0:7:1:0:0:0:0:3:2:3:6:14:1:0:1:4:9:0:0:1:3:0:0:0:1:6:8:6:5:1:2:0:0:0:1:1:0:0:0:7:2:0:0:0:0:0:0:1:0:0:0:0:1:0:1:0:0:1:3:0:0:0:1:0:13:16:0:1:5:0:11:1:13:1:0:2:0:1:1:1:1:0:5:0:14:4:0:12:3:0:0:5:0:2:3:0:0:1:1:7:6:1:6:13:1:17:0:1:5:10:1:0:1:2:2:8:7:9:2:5:1:4:0:13:1:7:0:11:0:1:7:12:2:12:1:7:0:11:0:1:19:1:0:1:0:0:0:0:0:0:0:1:0:0:0:5:0:1:18:1:0:0:0:0:0:0:0:0:0:1:0:0:1:0:0:7:0:1:0:0:0:0:3:0:0:0:0:12:1:7:16:0:1:1:0:4:2:7:0:16:1:4:0:10:1:14:0:12:0:0:0:0:0:2:1:5:0:1:0:0:4:0:0:0:1:0:0:3:2:0:1:0:1:0:1:8:0:1:0:0:0:0:2:1:1:0:8:1:0:1:0:0:2:0:7:1:6:0:16:0:0:0:0:0:1:1:1:0:8:1:6:1:0:0:0:0:0:0:0:0:0:1:2:0:0:1:0:0:0:0:0:0:1:5:0:17:0:6:6:1:0:13:0:1:23:0:1:7:10:0:2:0:6:11:1:5:0:13:1:0:0:0:0:0:0:0:0:0:2:2:1:8:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:1:1:0:0:13:0:0:0:0:0:2:1:1:7:0:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:6:5:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:2:1:2:0:1:0:0:0:0:0:0:1:0:0:0:1:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:1:1:0:2:0:1:0:0:0:0:0:0:1:0:0:1:0:1:0:0:0:0:0:0:0:0:0:0:0:0:0:0:1:0:2:1:1:0:0:0:4:3:7:1:1:4:1:0:0:0:0:0:0:2:2:18:1:23:0:1:0:1:0:0:11:6:11:1:0:0:0:0';
    const seen: Array<{ width: number; height: number; profileName: string }> = [];
    fc.assert(
      fc.property(profileArbitrary, fc.oneof(uniformImage, noiseImage), (profile, image) => {
        seen.push({ width: image.width, height: image.height, profileName: profile.name });
        const result = readCard(profile, image);
        expect(result.ok).toBe(false);
        expect('grid' in result).toBe(false);
        expect(FAILURE_REASONS).toContain(!result.ok && result.failure.reason);
      }),
      { seed: 4242, path },
    );
    // The replay may run the path's last few steps; every value it tries must be the recorded 44 x 20 image.
    expect(seen.length).toBeGreaterThan(0);
    for (const entry of seen) expect(entry).toEqual({ width: 44, height: 20, profileName: 'generated-profile' });
  });

  it('R12.1 every result is a success with a grid and a pose, or a failure with one of the six reasons', () => {
    fc.assert(
      fc.property(profileArbitrary, fc.oneof(uniformImage, noiseImage), (profile, image) => {
        expectWellFormed(readCard(profile, image));
      }),
      { numRuns: 100 },
    );
  });

  it('R12.2 an invalid profile fails with invalid-profile and the violations of validateCardProfile', () => {
    const damage: ReadonlyArray<(profile: CardProfile) => unknown> = [
      (profile) => mutateProfile(profile, ['endOrder'], REMOVE),
      (profile) => mutateProfile(profile, ['endOrder'], []),
      (profile) => mutateProfile(profile, ['hookRows'], 0),
      (profile) => mutateProfile(profile, ['cardWidthMm'], -1),
      (profile) => mutateProfile(profile, ['pegHoles'], []),
      (profile) => mutateProfile(profile, ['pegHoles'], null),
      (profile) => mutateProfile(profile, ['pegHoles', 1, 'positionMm'], profile.pegHoles[0].positionMm),
      (profile) => mutateProfile(profile, ['endOrder', 0, 0], -1),
      (profile) => mutateProfile(profile, ['firstHoleCentreMm', 'x'], 0),
      (profile) => mutateProfile(profile, ['hookColumns'], 'many'),
    ];
    fc.assert(
      fc.property(
        profileArbitrary,
        fc.integer({ min: 0, max: damage.length - 1 }),
        fc.oneof(uniformImage, noiseImage),
        (profile, index, image) => {
          const bad = damage[index]!(profile);
          const expected = validateCardProfile(bad);
          expect(expected.length).toBeGreaterThan(0);
          const result = readCard(bad, image);
          expect(result.ok).toBe(false);
          expect(!result.ok && result.failure.reason).toBe('invalid-profile');
          if (!result.ok && result.failure.reason === 'invalid-profile') {
            expect(result.failure.violations).toEqual(expected);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  const rawPixels: fc.Arbitrary<unknown> = fc.oneof(
    fc.anything(),
    fc.record({
      width: fc.integer({ min: 0, max: 64 }),
      height: fc.integer({ min: 0, max: 64 }),
      data: fc.uint8Array({ maxLength: 300 }).map((bytes) => new Uint8ClampedArray(bytes)),
    }),
  );

  it('R12.3 any profile value and any pixel data never throws', () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), (profile, pixels) => {
        readCard(profile, pixels);
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(profileArbitrary, rawPixels, (profile, pixels) => {
        readCard(profile, pixels);
      }),
      { numRuns: 100 },
    );
  });

  it('R12.4 a failure never carries a CardGrid', () => {
    fc.assert(
      fc.property(fc.anything(), fc.anything(), (profile, pixels) => {
        expectWellFormed(readCard(profile, pixels));
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(profileArbitrary, rawPixels, (profile, pixels) => {
        expectWellFormed(readCard(profile, pixels));
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(profileArbitrary, fc.oneof(uniformImage, noiseImage), (profile, image) => {
        expectWellFormed(readCard(profile, image));
      }),
      { numRuns: 100 },
    );
  });
});

/** Renders a generated card with the fixture generator, reads it, and returns the grid and the result. */
const renderedCase = (
  pixelsPerMm: fc.Arbitrary<number> | ((profile: CardProfile) => number),
  tiltDegrees: fc.Arbitrary<number>,
) =>
  profileArbitrary.chain((profile) =>
    fc.record({
      profile: fc.constant(profile),
      grid: cardGridArbitrary(profile),
      pixelsPerMm: typeof pixelsPerMm === 'function' ? fc.constant(pixelsPerMm(profile)) : pixelsPerMm,
      tiltDegrees,
      seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
    }),
  );
// R12.5: a punched hole narrower than MIN_HOLE_DIAMETER_PX is refused with resolution-too-low. Property 78 is about
// orientation, so every case must be read: render at 6 px/mm, or at the scale that gives a punched hole one pixel
// above the floor when the profile's holes are small enough that 6 px/mm falls below it.
const scaleAboveFloor = (profile: CardProfile) => Math.max(6, (MIN_HOLE_DIAMETER_PX + 1) / profile.holeDiameterMm);
const upright = fc.double({ min: -10, max: 10, noNaN: true });
const upsideDown = fc.double({ min: 170, max: 190, noNaN: true });
const IMAGE_RUNS = 25;

describe('readCard orientation and scale (image properties)', () => {
  it('R18.3 a card rotated by 180 degrees, plus or minus 10, is read as the same CardGrid as the card upright, with orientation upside-down', () => {
    fc.assert(
      fc.property(renderedCase(scaleAboveFloor, upsideDown), ({ profile, grid, pixelsPerMm, tiltDegrees, seed }) => {
        const result = readCard(
          profile,
          renderCardPixels(profile, grid, { noise: 0, tiltDegrees, shade: 0, seed, pixelsPerMm }),
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.grid).toEqual(grid);
        expect(result.pose.orientation).toBe('upside-down');
        expect(angleDifferenceDegrees(result.pose.tiltDegrees, tiltDegrees)).toBeLessThan(0.5);
      }),
      { numRuns: IMAGE_RUNS, seed: 78018 },
    );
  });

  const neverWrongGrid = ({ profile, grid, pixelsPerMm, tiltDegrees, seed }: {
    profile: CardProfile;
    grid: CardGrid;
    pixelsPerMm: number;
    tiltDegrees: number;
    seed: number;
  }): void => {
    const result = readCard(
      profile,
      renderCardPixels(profile, grid, { noise: 0, tiltDegrees, shade: 0, seed, pixelsPerMm }),
    );
    if (result.ok) expect(result.grid).toEqual(grid);
    else expect('grid' in result).toBe(false);
  };

  it('R18.5 a CardGrid is never returned from a card read the wrong way up', () => {
    fc.assert(
      fc.property(
        renderedCase(fc.double({ min: 2, max: 10, noNaN: true }), fc.oneof(upright, upsideDown)),
        neverWrongGrid,
      ),
      { numRuns: IMAGE_RUNS, seed: 79019 },
    );
  });

  // Regression examples for this property: the three R18.5 low-resolution example tests above (2.75, 2.25 and 1.25 px/mm).
  it('R18.5 a low-resolution render never yields a wrong CardGrid', () => {
    fc.assert(
      fc.property(
        renderedCase(fc.double({ min: 1, max: 4, noNaN: true }), fc.oneof(upright, upsideDown)),
        neverWrongGrid,
      ),
      { numRuns: IMAGE_RUNS, seed: 83020 },
    );
  });
});
