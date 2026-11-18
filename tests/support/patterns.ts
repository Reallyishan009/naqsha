import * as fc from 'fast-check';
import type { CardProfile, Pattern } from '../../src/codec/types.ts';
import type { ExportOptions } from '../../src/exporter/types.ts';
import { cardGridArbitrary } from './profiles.ts';

/** A Pattern of 1 to 40 picks, each a valid card for the profile. */
export function patternArbitrary(profile: CardProfile): fc.Arbitrary<Pattern> {
  return fc.array(cardGridArbitrary(profile), { minLength: 1, maxLength: 40 });
}

/** Any valid export options, all four fields present. */
export const exportOptionsArbitrary: fc.Arbitrary<ExportOptions> = fc.record({
  bitDepth: fc.constantFrom<1 | 8>(1, 8),
  liftColour: fc.constantFrom<'black' | 'white'>('black', 'white'),
  pickOrder: fc.constantFrom<'first-at-top' | 'first-at-bottom'>('first-at-top', 'first-at-bottom'),
  endOrder: fc.constantFrom<'first-at-left' | 'first-at-right'>('first-at-left', 'first-at-right'),
});
