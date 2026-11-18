import { readFileSync } from 'node:fs';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { demoPattern } from '../../scripts/make_fixtures.ts';
import { parseCardProfile } from '../../src/codec/index.ts';
import type { CardGrid, CardProfile } from '../../src/codec/types.ts';
import { MIN_HOLE_DIAMETER_PX, readCard } from '../../src/reader/readCard';
import { renderCardPixels } from '../support/images';
import { mutateProfile, profileArbitrary } from '../support/profiles';

function parseProfile(value: unknown): CardProfile {
  const parsed = parseCardProfile(value);
  if (!parsed.ok) throw new Error('profile is invalid');
  return parsed.value;
}

/** A grid of hookRows by hookColumns with one punched hole. */
function singleHoleGrid(profile: CardProfile, hookRow: number, hookColumn: number): CardGrid {
  return Array.from({ length: profile.hookRows }, (_, row) =>
    Array.from({ length: profile.hookColumns }, (_, column) => row === hookRow && column === hookColumn),
  );
}

// Counterexample 1 of the R18.5 low-resolution property (seed -1907209653), rebuilt explicitly.
const sixByTwo = parseProfile({"name": "generated-profile", "cardWidthMm": 19.9448, "cardHeightMm": 28.1, "hookRows": 6, "hookColumns": 2, "holeDiameterMm": 1.5, "horizontalPitchMm": 3, "verticalPitchMm": 3.2, "firstHoleCentreMm": {"x": 8.4724, "y": 6.05}, "endOrder": [[4, 2], [9, 0], [1, 7], [8, 5], [11, 10], [6, 3]], "pegHoles": [{"positionMm": {"x": 16.0836, "y": 17.4139176}, "diameterMm": 2.8224}, {"positionMm": {"x": 3.8612, "y": 3.541195}, "diameterMm": 2.205}], "lacingHoles": {"diameterMm": 1.5, "positionsMm": []}});
// Counterexample 2 of the same property (seed -791670624), rebuilt explicitly.
const eightByFive = parseProfile({"name": "generated-profile", "cardWidthMm": 30.306600000000003, "cardHeightMm": 40.5, "hookRows": 8, "hookColumns": 5, "holeDiameterMm": 2.1, "horizontalPitchMm": 3.1, "verticalPitchMm": 4, "firstHoleCentreMm": {"x": 8.9533, "y": 6.249999999999999}, "endOrder": [[10, 33, 6, 17, 31], [3, 8, 0, 37, 39], [19, 15, 1, 22, 32], [2, 30, 14, 4, 7], [11, 35, 38, 24, 18], [9, 28, 26, 5, 16], [34, 12, 20, 25, 36], [21, 27, 13, 29, 23]], "pegHoles": [{"positionMm": {"x": 26.354950000000002, "y": 13.650036899999998}, "diameterMm": 3.3033000000000006}, {"positionMm": {"x": 3.95165, "y": 7.3850999999999996}, "diameterMm": 2.7300000000000004}], "lacingHoles": {"diameterMm": 2.1, "positionsMm": [{"x": 13.607, "y": 2.5999999999999996}, {"x": 16.5391, "y": 2.5999999999999996}, {"x": 13.7146, "y": 2.5999999999999996}]}});
// A 5.9 px sparse card that the peg hole pair selection read as a wrong grid (measured in task 5.17).
const nineByNine = parseProfile({"name": "generated-profile", "cardWidthMm": 47.9536, "cardHeightMm": 45.00000000000001, "hookRows": 9, "hookColumns": 9, "holeDiameterMm": 2.4, "horizontalPitchMm": 3.5, "verticalPitchMm": 3.9, "firstHoleCentreMm": {"x": 9.976799999999999, "y": 6.9}, "endOrder": [[6, 22, 41, 72, 80, 49, 1, 66, 32], [74, 48, 9, 11, 20, 46, 17, 65, 51], [35, 57, 61, 63, 78, 79, 24, 10, 53], [70, 55, 68, 58, 45, 76, 5, 15, 50], [34, 71, 62, 56, 44, 19, 29, 8, 14], [26, 59, 12, 27, 36, 23, 37, 28, 16], [60, 30, 54, 75, 31, 40, 4, 47, 2], [13, 64, 77, 52, 69, 3, 18, 43, 67], [39, 25, 21, 42, 33, 38, 0, 7, 73]], "pegHoles": [{"positionMm": {"x": 4.3884, "y": 15.516720000000001}, "diameterMm": 3.84}, {"positionMm": {"x": 43.565200000000004, "y": 32.449017600000005}, "diameterMm": 4.8768}], "lacingHoles": {"diameterMm": 2.4, "positionsMm": [{"x": 14.8824, "y": 2.85}, {"x": 16.897199999999998, "y": 2.85}]}});

describe('readCard resolution floor', () => {
  const cases = [
    { title: '6x2 profile, hole 1.5 mm at 1 px/mm, tilt 170', profile: sixByTwo, at: [5, 0], pixelsPerMm: 1, tilt: 170 },
    { title: '8x5 profile, hole 2.1 mm at 1.1112 px/mm, tilt 0', profile: eightByFive, at: [7, 4], pixelsPerMm: 1.1112365977279721, tilt: 0 },
    { title: '9x9 profile, hole 2.4 mm at 2.47 px/mm (5.9 px), tilt -10', profile: nineByNine, at: [7, 1], pixelsPerMm: 2.4699858918395714, tilt: -9.999999999999988, seed: 279932540 },
  ];
  for (const { title, profile, at, pixelsPerMm, tilt, seed } of cases) {
    it(`R12.5 ${title} fails with resolution-too-low and no grid`, () => {
      const grid = singleHoleGrid(profile, at[0]!, at[1]!);
      const result = readCard(
        profile,
        renderCardPixels(profile, grid, { noise: 0, tiltDegrees: tilt, shade: 0, seed: seed ?? 0, pixelsPerMm }),
      );
      expect(result.ok).toBe(false);
      expect('grid' in result).toBe(false);
      if (result.ok) return;
      expect(result.failure.reason).toBe('resolution-too-low');
      if (result.failure.reason !== 'resolution-too-low') return;
      expect(result.failure.minimumPx).toBe(MIN_HOLE_DIAMETER_PX);
      expect(result.failure.holeDiameterPx).toBeLessThan(MIN_HOLE_DIAMETER_PX);
    });
  }

  it('R12.5 a clean demo render at 6 px/mm reads back as the true grid', () => {
    const demo = parseProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
    const card = demoPattern(demo)[0]!;
    const result = readCard(
      demo,
      renderCardPixels(demo, card, { noise: 0, tiltDegrees: 0, shade: 0, seed: 1234, pixelsPerMm: 6 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.grid).toEqual(card);
  });

  it('R18.8 a valid profile rendered at 2.25 px/mm still fails with ambiguous-orientation', () => {
    const demo = parseProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
    const withFirst = parseProfile(mutateProfile(demo, ['pegHoles', 0, 'diameterMm'], 2.5));
    const pegProfile = parseProfile(mutateProfile(withFirst, ['pegHoles', 1, 'diameterMm'], 2.8));
    const result = readCard(
      pegProfile,
      renderCardPixels(pegProfile, demoPattern(pegProfile)[0]!, {
        noise: 0,
        tiltDegrees: 0,
        shade: 0,
        seed: 1234,
        pixelsPerMm: 2.25,
      }),
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.reason).toBe('ambiguous-orientation');
  });

  it('R12.5 a read never succeeds when the punched hole diameter in pixels is below the minimum', () => {
    fc.assert(
      fc.property(
        profileArbitrary.chain((profile) =>
          fc.record({
            profile: fc.constant(profile),
            hookRow: fc.nat(profile.hookRows - 1),
            hookColumn: fc.nat(profile.hookColumns - 1),
            holeDiameterPx: fc.double({ min: 1, max: MIN_HOLE_DIAMETER_PX - 0.5, noNaN: true }),
            tiltDegrees: fc.oneof(fc.double({ min: -10, max: 10, noNaN: true }), fc.double({ min: 170, max: 190, noNaN: true })),
            seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
          }),
        ),
        ({ profile, hookRow, hookColumn, holeDiameterPx, tiltDegrees, seed }) => {
          const grid = singleHoleGrid(profile, hookRow, hookColumn);
          const pixelsPerMm = holeDiameterPx / profile.holeDiameterMm;
          const result = readCard(
            profile,
            renderCardPixels(profile, grid, { noise: 0, tiltDegrees, shade: 0, seed, pixelsPerMm }),
          );
          expect(result.ok).toBe(false);
        },
      ),
      { numRuns: 25, seed: 51701 },
    );
  });
});
