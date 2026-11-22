import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodeCardGrid, validateCardGrid } from '../../../src/codec/index.ts';
import type { CardProfile, Pattern } from '../../../src/codec/index.ts';
import { exportPatternBmp, readPatternBmp } from '../../../src/exporter/index.ts';
import { suggestRepairs } from '../../../src/repair/index.ts';
import { prepareCloth } from '../../../src/simulator/index.ts';
import { flaggedPick, generateSample, lostCardPicks, sampleWithLostCards, sampleWithOneGap } from '../../../src/ui/samples/sampleDesigns.ts';
import type { SampleDesign } from '../../../src/ui/types.ts';
import { exportOptionsArbitrary } from '../../support/patterns.ts';
import { cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';

const SEED = 20240611;
const NUM_RUNS = 100;
const DESIGNS: readonly SampleDesign[] = ['diamond', 'border', 'floral'];
const designArbitrary = fc.constantFrom<SampleDesign>(...DESIGNS);

/** One line per pick, one character per end, so the design shape shows whatever the endOrder is. */
function endsPicture(profile: CardProfile, pattern: Pattern, pickCount: number): string {
  return pattern
    .slice(0, pickCount)
    .map((card) => {
      const encoded = encodeCardGrid(profile, card);
      if (!encoded.ok) throw new Error('card is not valid');
      return encoded.value.map((lift) => (lift ? '#' : '.')).join('');
    })
    .join('\n');
}

describe('generateSample examples', () => {
  it('R4.4 the three designs differ on the demo profile', () => {
    const profile = demoProfile();
    const [diamond, border, floral] = DESIGNS.map((design) => JSON.stringify(generateSample(profile, design)));
    expect(new Set([diamond, border, floral]).size).toBe(3);
  });

  it('R4.6 an equal copy of the Card_Profile gives the same Pattern for each design, and the profile is not changed', () => {
    const profile = demoProfile();
    const deepFreeze = <T,>(value: T): T => {
      if (typeof value === 'object' && value !== null) {
        for (const inner of Object.values(value)) deepFreeze(inner);
        Object.freeze(value);
      }
      return value;
    };
    const frozen = deepFreeze(structuredClone(profile));
    for (const design of DESIGNS) {
      const first = generateSample(frozen, design);
      expect(generateSample(structuredClone(profile), design)).toEqual(first);
      expect(generateSample(frozen, design)).toEqual(first);
    }
    expect(frozen).toEqual(profile);
  });

  it('R4.3 prints the three designs as text pictures, one repeat of picks each', () => {
    const profile = demoProfile();
    const period = Math.max(2, profile.hookRows);
    for (const design of DESIGNS) {
      const pattern = generateSample(profile, design);
      console.log(`${design}: ${pattern.length} picks, first repeat of ${period} picks, one line per pick, one character per end\n${endsPicture(profile, pattern, period)}`);
      expect(pattern.length).toBe(3 * period);
    }
  });
});

describe('generateSample properties', () => {
  it('R4.3 every card of every Sample_Design is valid for any valid profile', () => {
    // Feature: app, Property 10: Sample designs are valid patterns for any profile
    fc.assert(
      fc.property(cardProfileArbitrary, designArbitrary, (profile, design) => {
        const pattern = generateSample(profile, design);
        expect(pattern.length).toBeGreaterThanOrEqual(1);
        for (const card of pattern) expect(validateCardGrid(profile, card)).toEqual([]);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R4.5 the pattern repeats with period P, has at least two repeats and is deterministic', () => {
    // Feature: app, Property 11: Sample designs repeat and are deterministic
    fc.assert(
      fc.property(cardProfileArbitrary, designArbitrary, (profile, design) => {
        const period = Math.max(2, profile.hookRows);
        const pattern = generateSample(profile, design);
        expect(pattern.length).toBeGreaterThanOrEqual(2 * period);
        for (let pickIndex = 0; pickIndex + period < pattern.length; pickIndex++) {
          expect(pattern[pickIndex + period]).toEqual(pattern[pickIndex]);
        }
        expect(generateSample(profile, design)).toEqual(pattern);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R5.8 a Sample_Design exported to BMP reads back to the same pattern', () => {
    // Feature: app, Property 13: Exported BMP reads back to the same pattern (Sample_Design half)
    fc.assert(
      fc.property(cardProfileArbitrary, designArbitrary, exportOptionsArbitrary, (profile, design, options) => {
        const pattern = generateSample(profile, design);
        for (const chosen of [undefined, options]) {
          const exported = exportPatternBmp(profile, pattern, chosen);
          expect(exported.ok).toBe(true);
          if (!exported.ok) return;
          expect(readPatternBmp(exported.bytes, profile, chosen)).toEqual({ ok: true, pattern });
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R17.7 the demo profile Sample_Designs round-trip through BMP with default options', () => {
    const profile: CardProfile = demoProfile();
    for (const design of DESIGNS) {
      const pattern = generateSample(profile, design);
      const exported = exportPatternBmp(profile, pattern);
      expect(exported.ok).toBe(true);
      if (exported.ok) expect(readPatternBmp(exported.bytes, profile)).toEqual({ ok: true, pattern });
    }
  });
});
describe('the sample with lost cards', () => {
  const profile = demoProfile();
  it('R7.1 it has exactly three gaps, the rest are the diamond sample, and every gap has a suggestion', () => {
    const lost = sampleWithLostCards(profile);
    const diamond = generateSample(profile, 'diamond');
    expect(lost).toHaveLength(diamond.length);
    const gaps = lost.flatMap((card, pick) => (validateCardGrid(profile, card).length > 0 ? [pick] : []));
    expect(gaps).toEqual(lostCardPicks(diamond.length));
    expect(gaps).toHaveLength(3);
    lost.forEach((card, pick) => {
      if (!gaps.includes(pick)) expect(card).toEqual(diamond[pick]);
    });
    const result = suggestRepairs(lost, profile);
    expect(result.ok && result.gaps.map((gap) => gap.suggestions.length > 0)).toEqual([true, true, true]);
  });
  it('R7.1 the first suggestion for each gap is the diamond card that was lost', () => {
    const lost = sampleWithLostCards(profile);
    const diamond = generateSample(profile, 'diamond');
    const result = suggestRepairs(lost, profile);
    if (!result.ok) throw new Error('failed');
    for (const gap of result.gaps) expect(gap.suggestions[0]?.card).toEqual(diamond[gap.pick]);
  });
});
describe('the sample with one card flagged (Weave Demo strip)', () => {
  const profile = demoProfile();
  const diamond = generateSample(profile, 'diamond');
  for (const kind of ['missing', 'damaged'] as const) {
    it(`a ${kind} gap: exactly one pick is flagged ${kind}, the rest are the diamond sample, and the gap has the lost card as its first suggestion`, () => {
      const pattern = sampleWithOneGap(profile, kind);
      expect(pattern).toHaveLength(diamond.length);
      const pick = flaggedPick(diamond.length);
      pattern.forEach((card, index) => {
        if (index !== pick) expect(card).toEqual(diamond[index]);
      });
      const result = suggestRepairs(pattern, profile);
      if (!result.ok) throw new Error('failed');
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]).toMatchObject({ pick, gapKind: kind });
      expect(result.gaps[0]?.suggestions[0]?.card).toEqual(diamond[pick]);
    });
  }
  it('a lost card is a missing slot and a torn card is a card that is there but is no card of the profile', () => {
    const pick = flaggedPick(diamond.length);
    expect(sampleWithOneGap(profile, 'missing')[pick]).toBeNull();
    const torn = sampleWithOneGap(profile, 'damaged')[pick];
    expect(Array.isArray(torn)).toBe(true);
    expect(validateCardGrid(profile, torn).length).toBeGreaterThan(0);
  });
  it('the cloth reports one gap, of the kind asked for, on the flagged pick', () => {
    for (const kind of ['missing', 'damaged'] as const) {
      const cloth = prepareCloth(profile, sampleWithOneGap(profile, kind));
      if (!cloth.ok) throw new Error('not prepared');
      expect(cloth.value.gaps.map((gap) => [gap.pick, gap.kind])).toEqual([[flaggedPick(diamond.length), kind]]);
    }
  });
  it('the flagged pick is inside the design, also for a design too short for the lost-card picks', () => {
    expect(flaggedPick(36)).toBe(4);
    for (const count of [1, 2, 3, 5]) {
      expect(flaggedPick(count)).toBeGreaterThanOrEqual(0);
      expect(flaggedPick(count)).toBeLessThan(count);
    }
  });
});
