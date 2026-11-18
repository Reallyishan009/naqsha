import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCardProfile } from '../../src/codec/index.ts';
import type { CardGrid, CardProfile } from '../../src/codec/types.ts';
import {
  LAYOUT_DIAMETER_TOLERANCE,
  LAYOUT_MATCH_MIN,
  LAYOUT_POSITION_TOLERANCE,
  layoutMatches,
} from '../../src/reader/layout';
import { findPegHolePair, rankPegHolePairs } from '../../src/reader/pegHoles';
import { poseFromPegHoles } from '../../src/reader/pose';
import { MAX_PAIRS_TO_VERIFY } from '../../src/reader/selectPegHoles';
import type { DarkRegion, Pose } from '../../src/reader/types';
import { fitCardInImage, hookPositionRegions, lacingHoleRegions, pegHoleRegions, roundRegion } from '../support/images';
import { cardGridArbitrary, profileArbitrary } from '../support/profiles';

function loadDemoProfile(): CardProfile {
  const parsed = parseCardProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
  if (!parsed.ok) throw new Error('demo profile is invalid');
  return parsed.value;
}
const demo = loadDemoProfile();

/** Regions for the pegs, every punched hook position and every lacing hole. */
function cardRegions(profile: CardProfile, grid: CardGrid, pose: Pose): { regions: DarkRegion[]; pegs: DarkRegion[] } {
  const pegs = pegHoleRegions(profile, pose);
  const hooks = hookPositionRegions(profile, pose).filter(
    (_, index) => grid[Math.floor(index / profile.hookColumns)]![index % profile.hookColumns] === true,
  );
  return { regions: [...pegs, ...hooks, ...lacingHoleRegions(profile, pose)], pegs };
}

describe('layout constants', () => {
  it('start at the design values', () => {
    expect(LAYOUT_POSITION_TOLERANCE).toBe(0.35);
    expect(LAYOUT_DIAMETER_TOLERANCE).toBe(0.3);
    expect(LAYOUT_MATCH_MIN).toBe(0.9);
    expect(MAX_PAIRS_TO_VERIFY).toBe(50);
  });
});

describe('rankPegHolePairs', () => {
  const pose: Pose = { tiltDegrees: 0, pixelsPerMm: 6, originPx: { x: 120, y: 90 }, orientation: 'upright' };
  const candidates = [...pegHoleRegions(demo, pose), ...hookPositionRegions(demo, pose), ...lacingHoleRegions(demo, pose)];

  it('R9.3 returns pairs in ascending fit, at most limit, and the first is the findPegHolePair result', () => {
    const ranked = rankPegHolePairs(demo, candidates, 5);
    expect(ranked.length).toBeLessThanOrEqual(5);
    for (let k = 1; k < ranked.length; k++) expect(ranked[k]!.fit).toBeGreaterThanOrEqual(ranked[k - 1]!.fit);
    expect(ranked[0]).toEqual(findPegHolePair(demo, candidates));
    expect(rankPegHolePairs(demo, candidates, 0)).toEqual([]);
  });
});

describe('layoutMatches', () => {
  const pose: Pose = { tiltDegrees: 3, pixelsPerMm: 6, originPx: { x: 120, y: 90 }, orientation: 'upright' };
  const grid: CardGrid = Array.from({ length: demo.hookRows }, (_, r) =>
    Array.from({ length: demo.hookColumns }, (_, c) => (r + c) % 2 === 0),
  );
  const { regions } = cardRegions(demo, grid, pose);

  it('R9.3 the true pose explains every region', () => {
    const result = layoutMatches(demo, pose, regions, fitCardInImage(demo, pose).imageSize);
    expect(result.matches).toBe(true);
    expect(result.explained).toBe(result.inCard);
    expect(result.missingLacingHoles).toBe(0);
  });

  it('R9.3 a pose with the wrong scale does not match', () => {
    expect(layoutMatches(demo, { ...pose, pixelsPerMm: 4.5 }, regions, fitCardInImage(demo, pose).imageSize).matches).toBe(false);
  });

  it('R9.3 a card with a missing lacing hole does not match', () => {
    const lacing = lacingHoleRegions(demo, pose);
    const sameCentre = (r: DarkRegion, l: DarkRegion) => r.centroid.x === l.centroid.x && r.centroid.y === l.centroid.y;
    const missingOne = regions.filter((region) => !sameCentre(region, lacing[0]!));
    expect(missingOne.length).toBe(regions.length - 1);
    const result = layoutMatches(demo, pose, missingOne, fitCardInImage(demo, pose).imageSize);
    expect(result.missingLacingHoles).toBe(1);
    expect(result.matches).toBe(false);
  });

  it('R10.4 a lacing hole whose disc is not fully inside the image is not required', () => {
    const lacing = lacingHoleRegions(demo, pose);
    // Crop the image just above the bottom lacing holes: they are outside it, so they are neither required nor present.
    const { imageSize } = fitCardInImage(demo, pose);
    const croppedHeight = Math.floor(lacing[2]!.centroid.y - 20);
    const visible = regions.filter((region) => region.centroid.y < croppedHeight);
    const result = layoutMatches(demo, pose, visible, { width: imageSize.width, height: croppedHeight });
    expect(result.missingLacingHoles).toBe(0);
    expect(result.matches).toBe(true);
    // The same regions with an image that holds the whole card do miss the bottom lacing holes.
    expect(layoutMatches(demo, pose, visible, imageSize).missingLacingHoles).toBe(2);
  });
});

describe('layout check properties', () => {
  const poseArbitrary: fc.Arbitrary<Pose> = fc
    .tuple(
      fc.double({ min: 2, max: 12, noNaN: true }),
      fc.double({ min: -10, max: 10, noNaN: true }),
      fc.boolean(),
      fc.double({ min: 0, max: 2000, noNaN: true }),
      fc.double({ min: 0, max: 2000, noNaN: true }),
    )
    .map(([pixelsPerMm, offsetDegrees, upsideDown, x, y]): Pose => ({
      tiltDegrees: upsideDown ? 180 + offsetDegrees : offsetDegrees,
      pixelsPerMm,
      originPx: { x, y },
      orientation: upsideDown ? 'upside-down' : 'upright',
    }));

  const scenarioArbitrary = profileArbitrary.chain((profile) =>
    fc.tuple(fc.constant(profile), cardGridArbitrary(profile), poseArbitrary),
  );

  function checkTrueBeatsDecoys([profile, grid, unfittedPose]: [CardProfile, CardGrid, Pose]): void {
    // Translate the card into the image so every lacing hole is inside it (the image holds the whole card).
    const { pose, imageSize } = fitCardInImage(profile, unfittedPose);
    const { regions, pegs } = cardRegions(profile, grid, pose);
    const truth = layoutMatches(profile, pose, regions, imageSize);
    expect(truth.matches).toBe(true);
    expect(truth.explained).toBe(truth.inCard);
    expect(truth.inCard).toBe(regions.length);

    for (const pair of rankPegHolePairs(profile, regions, Number.MAX_SAFE_INTEGER)) {
      const [a, b] = pair.uprightRegions;
      if (pegs.includes(a) && pegs.includes(b)) continue;
      for (const orientation of ['upright', 'upside-down'] as const) {
        const decoy = layoutMatches(profile, poseFromPegHoles(profile, pair, orientation), regions, imageSize);
        if (decoy.matches) {
          expect(decoy.explained, `decoy ${orientation} ${JSON.stringify(decoy)} vs true ${JSON.stringify(truth)}`).toBeLessThan(
            truth.explained,
          );
        }
      }
    }
  }

  it('R9.3 the true pose explains every region, and any pose from a decoy pair that matches the layout explains fewer regions', () => {
    fc.assert(fc.property(scenarioArbitrary, checkTrueBeatsDecoys));
  });

  // Regression: replays the task 5.16 counterexample (3 x 3 card, one punched hole, no lacing holes) from its seed and path.
  it('R9.3 regression: 3 x 3 card with one punched hole and a decoy pair giving an upside-down pose', () => {
    fc.assert(fc.property(scenarioArbitrary, checkTrueBeatsDecoys), { seed: -106734385, path: '38:35:0:0:0:0:0:0:0:0:0' });
  });
});
