import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodeCardGrid, validateCardGrid } from '../../../src/codec/index.ts';
import type { CardProfile, Pattern } from '../../../src/codec/index.ts';
import { exportPatternBmp, readPatternBmp } from '../../../src/exporter/index.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
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
