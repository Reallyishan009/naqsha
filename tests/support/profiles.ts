import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import type { CardGrid, CardProfile, Ends } from '../../src/codec/types.ts';

/** The row-major end order: endOrder[hookRow][hookColumn] = hookRow * hookColumns + hookColumn. */
export function rowMajorEndOrder(hookRows: number, hookColumns: number): number[][] {
  return Array.from({ length: hookRows }, (_, hookRow) =>
    Array.from({ length: hookColumns }, (_, hookColumn) => hookRow * hookColumns + hookColumn),
  );
}

/** A random permutation of 0..hookRows*hookColumns-1, laid out as hookRows rows of hookColumns. */
export function endOrderArbitrary(hookRows: number, hookColumns: number): fc.Arbitrary<number[][]> {
  const total = hookRows * hookColumns;
  const endIndices = Array.from({ length: total }, (_, endIndex) => endIndex);
  return fc.shuffledSubarray(endIndices, { minLength: total, maxLength: total }).map((permutation) =>
    Array.from({ length: hookRows }, (_, hookRow) =>
      permutation.slice(hookRow * hookColumns, (hookRow + 1) * hookColumns),
    ),
  );
}

/** Edge clearance, in mm, between a peg hole and the card edge, and between a peg hole and a punched hole. */
const PEG_CLEARANCE_MM = 1.5;

type ProfileDraft = {
  hookRows: number;
  hookColumns: number;
  holeDiameterMm: number;
  horizontalPitchMm: number;
  verticalPitchMm: number;
  smallPegFactor: number;
  pegRatioInverse: number;
  sideMarginExtraMm: number;
  bandMarginExtraMm: number;
  bigPegIsFirst: boolean;
  firstPegIsLeft: boolean;
  pegYFractions: [number, number];
  lacingHoles: { fraction: number; atTop: boolean }[];
  endOrder: number[][];
};

/**
 * Builds a valid profile by construction, with no filtering.
 *
 * Layout: a band of side margin on the left and right of the hook grid holds one peg hole each, centred in the
 * band, so it clears the card edge and the nearest punched hole by at least 1.5 mm. A band above and below the
 * hook grid holds the lacing holes. The side margin is wider than the larger peg hole diameter plus 3 mm, so the
 * two peg holes are always far more than 30% of the card width apart.
 *
 * Diameters: the smaller peg hole is 1.25 to 1.6 times the punched hole diameter (so at least 20% away from it),
 * and the larger peg hole is 1.18 to 1.5 times the smaller (so at least 15% apart).
 */
function buildProfile(draft: ProfileDraft): CardProfile {
  const holeRadiusMm = draft.holeDiameterMm / 2;
  const smallPegDiameterMm = draft.holeDiameterMm * draft.smallPegFactor;
  const bigPegDiameterMm = smallPegDiameterMm * draft.pegRatioInverse;
  const sideMarginMm = bigPegDiameterMm + 2 * PEG_CLEARANCE_MM + draft.sideMarginExtraMm;
  const bandMarginMm = draft.holeDiameterMm + 2 * PEG_CLEARANCE_MM + draft.bandMarginExtraMm;

  const firstHoleX = sideMarginMm + holeRadiusMm;
  const firstHoleY = bandMarginMm + holeRadiusMm;
  const gridRightMm = firstHoleX + (draft.hookColumns - 1) * draft.horizontalPitchMm + holeRadiusMm;
  const gridBottomMm = firstHoleY + (draft.hookRows - 1) * draft.verticalPitchMm + holeRadiusMm;
  const cardWidthMm = gridRightMm + sideMarginMm;
  const cardHeightMm = gridBottomMm + bandMarginMm;

  const pegDiameters = draft.bigPegIsFirst
    ? [bigPegDiameterMm, smallPegDiameterMm]
    : [smallPegDiameterMm, bigPegDiameterMm];
  const pegX = draft.firstPegIsLeft
    ? [sideMarginMm / 2, cardWidthMm - sideMarginMm / 2]
    : [cardWidthMm - sideMarginMm / 2, sideMarginMm / 2];
  const pegY = pegDiameters.map((diameterMm, pegIndex) => {
    const lowest = PEG_CLEARANCE_MM + diameterMm / 2;
    const highest = cardHeightMm - PEG_CLEARANCE_MM - diameterMm / 2;
    return lowest + draft.pegYFractions[pegIndex]! * (highest - lowest);
  });

  return {
    name: 'generated-profile',
    cardWidthMm,
    cardHeightMm,
    hookRows: draft.hookRows,
    hookColumns: draft.hookColumns,
    holeDiameterMm: draft.holeDiameterMm,
    horizontalPitchMm: draft.horizontalPitchMm,
    verticalPitchMm: draft.verticalPitchMm,
    firstHoleCentreMm: { x: firstHoleX, y: firstHoleY },
    endOrder: draft.endOrder,
    pegHoles: [
      { positionMm: { x: pegX[0]!, y: pegY[0]! }, diameterMm: pegDiameters[0]! },
      { positionMm: { x: pegX[1]!, y: pegY[1]! }, diameterMm: pegDiameters[1]! },
    ],
    lacingHoles: {
      diameterMm: draft.holeDiameterMm,
      positionsMm: draft.lacingHoles.map(({ fraction, atTop }) => ({
        x: firstHoleX + fraction * (gridRightMm - firstHoleX),
        y: atTop ? bandMarginMm / 2 : cardHeightMm - bandMarginMm / 2,
      })),
    },
  };
}

const tenths = (min: number, max: number): fc.Arbitrary<number> =>
  fc.integer({ min, max }).map((value) => value / 10);
const hundredths = (min: number, max: number): fc.Arbitrary<number> =>
  fc.integer({ min, max }).map((value) => value / 100);

function profilesWithPegRatio(pegRatioMin: number): fc.Arbitrary<CardProfile> {
  return fc
  .record({ hookRows: fc.integer({ min: 2, max: 10 }), hookColumns: fc.integer({ min: 2, max: 12 }) })
  .chain(({ hookRows, hookColumns }) =>
    fc
      .record({
        holeDiameterMm: tenths(15, 24),
        horizontalPitchMm: tenths(25, 40),
        verticalPitchMm: tenths(25, 40),
        smallPegFactor: hundredths(125, 160),
        pegRatioInverse: hundredths(pegRatioMin, 150),
        sideMarginExtraMm: tenths(0, 20),
        bandMarginExtraMm: tenths(0, 20),
        bigPegIsFirst: fc.boolean(),
        firstPegIsLeft: fc.boolean(),
        pegYFractions: fc.tuple(
          fc.integer({ min: 0, max: 1000 }).map((value) => value / 1000),
          fc.integer({ min: 0, max: 1000 }).map((value) => value / 1000),
        ),
        lacingHoles: fc.array(
          fc.record({ fraction: fc.integer({ min: 0, max: 1000 }).map((value) => value / 1000), atTop: fc.boolean() }),
          { maxLength: 4 },
        ),
        endOrder: endOrderArbitrary(hookRows, hookColumns),
      })
      .map((rest) => buildProfile({ hookRows, hookColumns, ...rest })),
  );
}

/** Valid profiles: 2 to 10 hook rows, 2 to 12 hook columns, pitches 2.5 to 4 mm, a permuted endOrder. */
export const profileArbitrary: fc.Arbitrary<CardProfile> = profilesWithPegRatio(118);

/**
 * Valid profiles of varied size, pitch and endOrder permutation, for the app tests. Each peg hole diameter is at
 * least 20% away from the other and from the punched hole diameter (card-geometry.md).
 */
export const cardProfileArbitrary: fc.Arbitrary<CardProfile> = profilesWithPegRatio(125);

/** The demo profile, read from public/profiles/demo-12x16.json. */
export function demoProfile(): CardProfile {
  const text = readFileSync(path.resolve(import.meta.dirname, '../../public/profiles/demo-12x16.json'), 'utf8');
  return JSON.parse(text) as CardProfile;
}

/** Any card grid for the profile: hookRows rows of hookColumns booleans. */
export function cardGridArbitrary(profile: CardProfile): fc.Arbitrary<CardGrid> {
  return fc.array(fc.array(fc.boolean(), { minLength: profile.hookColumns, maxLength: profile.hookColumns }), {
    minLength: profile.hookRows,
    maxLength: profile.hookRows,
  });
}

/** Any ends list for the profile: hookRows * hookColumns booleans. */
export function endsArbitrary(profile: CardProfile): fc.Arbitrary<Ends> {
  const length = profile.hookRows * profile.hookColumns;
  return fc.array(fc.boolean(), { minLength: length, maxLength: length });
}

/** Pass as the replacement in mutateProfile to delete the field (or remove the list element). */
export const REMOVE: unique symbol = Symbol('remove');

/**
 * Returns a deep copy of the profile with the value at `path` replaced, or removed when `replacement` is REMOVE.
 * The input profile is not changed. The result is typed unknown because a mutated profile may be invalid.
 */
export function mutateProfile(
  profile: CardProfile,
  path: readonly (string | number)[],
  replacement: unknown,
): unknown {
  if (path.length === 0) return replacement === REMOVE ? undefined : replacement;
  const copy: unknown = structuredClone(profile);
  let parent = copy as Record<string | number, unknown>;
  for (const key of path.slice(0, -1)) parent = parent[key] as Record<string | number, unknown>;
  const last = path[path.length - 1]!;
  if (replacement !== REMOVE) {
    parent[last] = replacement;
  } else if (Array.isArray(parent) && typeof last === 'number') {
    parent.splice(last, 1);
  } else {
    delete parent[last];
  }
  return copy;
}
