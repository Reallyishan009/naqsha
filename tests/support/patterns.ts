import * as fc from 'fast-check';
import type { CardProfile, Pattern } from '../../src/codec/types.ts';
import type { ExportOptions } from '../../src/exporter/types.ts';
import { cardGridArbitrary } from './profiles.ts';

/** The pick count a Pattern gets when the caller asks for no range. */
const DEFAULT_MIN_PICKS = 1;
const DEFAULT_MAX_PICKS = 40;

/** How many picks a generated Pattern holds. Either bound may be left out. */
export type PickCountRange = { minPicks?: number; maxPicks?: number };

/**
 * A Pattern of 1 to 40 picks, each a valid card for the profile. `picks` asks for another range,
 * so a caller that needs 0 or 1 picks says so instead of hard-coding a Pattern.
 */
export function patternArbitrary(profile: CardProfile, picks: PickCountRange = {}): fc.Arbitrary<Pattern> {
  return fc.array(cardGridArbitrary(profile), {
    minLength: picks.minPicks ?? DEFAULT_MIN_PICKS,
    maxLength: picks.maxPicks ?? DEFAULT_MAX_PICKS,
  });
}

/** Any valid export options, all four fields present. */
export const exportOptionsArbitrary: fc.Arbitrary<ExportOptions> = fc.record({
  bitDepth: fc.constantFrom<1 | 8>(1, 8),
  liftColour: fc.constantFrom<'black' | 'white'>('black', 'white'),
  pickOrder: fc.constantFrom<'first-at-top' | 'first-at-bottom'>('first-at-top', 'first-at-bottom'),
  endOrder: fc.constantFrom<'first-at-left' | 'first-at-right'>('first-at-left', 'first-at-right'),
});
