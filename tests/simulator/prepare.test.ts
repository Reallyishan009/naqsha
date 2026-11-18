import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodeCardGrid, parseCardProfile, validateCardGrid } from '../../src/codec/index.ts';
import { parseRenderSettings, prepareCloth } from '../../src/simulator/index.ts';
import { cardGridArbitrary, mutateProfile, profileArbitrary, REMOVE } from '../support/profiles.ts';
import { slotListArbitrary } from '../support/slots.ts';

/** A valid profile made invalid by construction. */
const invalidProfileArbitrary = profileArbitrary.chain((profile) =>
  fc
    .constantFrom<[string[], unknown]>(
      [['hookRows'], 0],
      [['hookColumns'], 'many'],
      [['cardWidthMm'], REMOVE],
      [['endOrder'], []],
      [['pegHoles'], []],
      [['name'], REMOVE],
    )
    .map(([path, replacement]) => ({ profile, invalid: mutateProfile(profile, path, replacement) })),
);

const profileAndSlots = profileArbitrary.chain((profile) =>
  fc.record({ profile: fc.constant(profile), samples: slotListArbitrary(profile) }),
);

describe('prepareCloth', () => {
  it('R1.2 an invalid profile fails with invalid-profile and nothing is rendered', () => {
    fc.assert(
      fc.property(invalidProfileArbitrary, ({ invalid }) => {
        const parsed = parseCardProfile(invalid);
        expect(parsed.ok).toBe(false);
        const result = prepareCloth(invalid, []);
        expect(result.ok).toBe(false);
        if (result.ok || parsed.ok) return;
        expect(result.failure).toEqual({ reason: 'invalid-profile', violations: parsed.violations });
      }),
    );
  });

  it('R1.3 every slot is classified as woven, missing or damaged by validateCardGrid', () => {
    fc.assert(
      fc.property(profileAndSlots, ({ profile, samples }) => {
        const result = prepareCloth(profile, samples.map((sample) => sample.slot));
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const { picks, gaps } = result.value;
        expect(picks).toHaveLength(samples.length);
        const expectedGaps: unknown[] = [];
        samples.forEach((sample, pick) => {
          const row = picks[pick]!;
          expect(row.kind).toBe(sample.expected);
          if (sample.expected === 'damaged') {
            const violations = validateCardGrid(profile, sample.slot);
            expect(violations.length).toBeGreaterThan(0);
            expect(row).toEqual({ kind: 'damaged', violations });
            expectedGaps.push({ pick, kind: 'damaged', violations });
          } else if (sample.expected === 'missing') {
            expectedGaps.push({ pick, kind: 'missing', violations: [] });
          }
        });
        expect(gaps).toEqual(expectedGaps);
      }),
    );
  });

  it('R2.2 the lift set of a pick is exactly the ends encodeCardGrid marks as lifted', () => {
    const profileAndCard = profileArbitrary.chain((profile) =>
      fc.record({ profile: fc.constant(profile), card: cardGridArbitrary(profile) }),
    );
    fc.assert(
      fc.property(profileAndCard, ({ profile, card }) => {
        const result = prepareCloth(profile, [card]);
        expect(result.ok).toBe(true);
        const encoded = encodeCardGrid(profile, card);
        expect(encoded.ok).toBe(true);
        if (!result.ok || !encoded.ok) return;
        const row = result.value.picks[0]!;
        expect(row.kind).toBe('woven');
        if (row.kind !== 'woven') return;
        expect(row.lift).toHaveLength(encoded.value.length);
        expect(result.value.baseEnds).toBe(encoded.value.length);
        encoded.value.forEach((lifted, end) => expect(row.lift[end]).toBe(lifted ? 1 : 0));
      }),
    );
  });

  it('a slots value that is not an array fails with invalid-settings naming slots', () => {
    const profile = fc.sample(profileArbitrary, { numRuns: 1, seed: 1 })[0]!;
    for (const slots of [undefined, null, 'cards', 3, {}]) {
      expect(prepareCloth(profile, slots)).toEqual({
        ok: false,
        failure: { reason: 'invalid-settings', setting: 'slots', message: expect.any(String) },
      });
    }
  });

  it('an empty slot list prepares an empty cloth', () => {
    const profile = fc.sample(profileArbitrary, { numRuns: 1, seed: 2 })[0]!;
    const result = prepareCloth(profile, []);
    expect(result.ok && result.value.picks.length === 0 && result.value.gaps.length === 0).toBe(true);
  });
});

// Property 3 (R1.6, "Cut last") is skipped by user decision; only Property 22 is implemented in task 4.1.
// Property 22 (R11.1) is split over two files with the same title: prepareCloth and parseRenderSettings here, renderFrame in render.test.ts.
describe('simulator never throws', () => {
  it('R11.1 the simulator never throws for any input', () => {
    fc.assert(
      fc.property(
        fc.anything({ withNullPrototype: true, withBigInt: true, withSparseArray: true, withObjectString: true }),
        fc.anything({ withNullPrototype: true, withBigInt: true, withSparseArray: true, withObjectString: true }),
        (profile, slots) => {
          expect(typeof prepareCloth(profile, slots).ok).toBe('boolean');
          expect(typeof parseRenderSettings(profile).ok).toBe('boolean');
        },
      ),
    );
  });
});
