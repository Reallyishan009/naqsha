import * as fc from 'fast-check';
import type { CardProfile } from '../../src/codec/types.ts';
import type { Diff, LineSet } from '../../src/codec-view/types.ts';
import { DIFF_PICK_LIMIT, diffPatterns, patternToLines } from '../../src/codec-view/index.ts';
import { patternArbitrary, type PickCountRange } from './patterns.ts';

/**
 * A Line_Set for the profile, built the only way a Line_Set is made: a generated Pattern through
 * `patternToLines`. `picks` asks for a pick count range, so a caller that needs a Line_Set of no
 * Lines or of one Line says so instead of writing a card dimension.
 */
export function lineSetArbitrary(profile: CardProfile, picks: PickCountRange = {}): fc.Arbitrary<LineSet> {
  return patternArbitrary(profile, picks).map((pattern) => {
    const lines = patternToLines(profile, pattern);
    if (!lines.ok) {
      // Unreachable: a generated Pattern is an array of valid cards, so only a bug reaches this.
      throw new Error(`patternToLines refused a generated Pattern: ${lines.failure.message}`);
    }
    return lines.lineSet;
  });
}

/**
 * A refused Diff, one of the three reasons. Every value it carries comes from the given profile
 * or from `DIFF_PICK_LIMIT`, so no card dimension and no pick limit is written here as a literal.
 */
export function diffRefusalArbitrary(profile: CardProfile): fc.Arbitrary<Diff> {
  const spread = fc.integer({ min: 1, max: 4 });
  const dimensionMismatch: fc.Arbitrary<Diff> = fc
    .tuple(spread, spread)
    .map(([hookRowSpread, hookColumnSpread]) => ({
      ok: false,
      refusal: {
        reason: 'dimension-mismatch',
        first: { hookRows: profile.hookRows, hookColumns: profile.hookColumns },
        second: {
          hookRows: profile.hookRows + hookRowSpread,
          hookColumns: profile.hookColumns + hookColumnSpread,
        },
      },
    }));
  const profileMismatch: fc.Arbitrary<Diff> = fc
    .string({ minLength: 1, maxLength: 8 })
    .map((suffix) => ({
      ok: false,
      refusal: {
        reason: 'profile-mismatch',
        firstProfileName: profile.name,
        secondProfileName: `${profile.name}-${suffix}`,
      },
    }));
  const tooManyPicks: fc.Arbitrary<Diff> = fc
    .tuple(fc.integer({ min: 1, max: DIFF_PICK_LIMIT }), fc.nat({ max: DIFF_PICK_LIMIT }))
    .map(([over, secondPicks]) => ({
      ok: false,
      refusal: {
        reason: 'too-many-picks',
        limit: DIFF_PICK_LIMIT,
        firstPicks: DIFF_PICK_LIMIT + over,
        secondPicks,
      },
    }));
  return fc.oneof(dimensionMismatch, profileMismatch, tooManyPicks);
}

/**
 * Any Diff: two generated Patterns through `patternToLines` and `diffPatterns`, or a refusal over
 * the three reasons.
 */
export function diffArbitrary(profile: CardProfile, picks: PickCountRange = {}): fc.Arbitrary<Diff> {
  const compared = fc
    .tuple(lineSetArbitrary(profile, picks), lineSetArbitrary(profile, picks))
    .map(([first, second]) => diffPatterns(first, second));
  return fc.oneof(compared, diffRefusalArbitrary(profile));
}
