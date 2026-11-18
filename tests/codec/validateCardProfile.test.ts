import { readFileSync } from 'node:fs';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MIN_PEG_DIAMETER_DIFFERENCE,
  parseCardProfile,
  validateCardProfile,
  type CardProfile,
} from '../../src/codec/index.ts';
import { REMOVE, mutateProfile, profileArbitrary } from '../support/profiles.ts';

const demoProfile = JSON.parse(
  readFileSync(new URL('../../public/profiles/demo-12x16.json', import.meta.url), 'utf8'),
) as CardProfile;

/** The profile with its two peg hole diameters replaced. Nothing else changes. */
function withPegDiameters(profile: CardProfile, first: number, second: number): unknown {
  return mutateProfile(
    mutateProfile(profile, ['pegHoles', 0, 'diameterMm'], first) as CardProfile,
    ['pegHoles', 1, 'diameterMm'],
    second,
  );
}

/** One-step damage to a valid profile, for the mutated half of Property 3. */
const mutations: ReadonlyArray<(profile: CardProfile) => unknown> = [
  (profile) => mutateProfile(profile, ['endOrder'], REMOVE),
  (profile) => mutateProfile(profile, ['hookRows'], 0),
  (profile) => mutateProfile(profile, ['cardWidthMm'], -1),
  (profile) => mutateProfile(profile, ['pegHoles'], []),
  (profile) => mutateProfile(profile, ['pegHoles', 1, 'positionMm'], profile.pegHoles[0].positionMm),
  (profile) => mutateProfile(profile, ['endOrder', 0, 0], -1),
  (profile) => mutateProfile(profile, ['firstHoleCentreMm', 'x'], 0),
  (profile) => mutateProfile(profile, ['lacingHoles'], REMOVE),
];

describe('validateCardProfile', () => {
  it('R1.1 a profile whose end-order assigns every hook position exactly one end index is accepted', () => {
    fc.assert(
      fc.property(profileArbitrary, (profile) => {
        expect(validateCardProfile(profile)).toEqual([]);
      }),
    );
  });

  it('R2.1 a profile is accepted exactly when validation reports no violations', () => {
    fc.assert(
      fc.property(
        profileArbitrary,
        fc.option(fc.integer({ min: 0, max: mutations.length - 1 }), { nil: undefined }),
        (profile, mutationIndex) => {
          const candidate = mutationIndex === undefined ? profile : mutations[mutationIndex]!(profile);
          expect(parseCardProfile(candidate).ok).toBe(validateCardProfile(candidate).length === 0);
        },
      ),
    );
  });

  it('R2.8 peg hole diameters that differ by less than 10% of the larger are reported', () => {
    fc.assert(
      fc.property(
        profileArbitrary,
        fc.double({ min: 0.5, max: 20, noNaN: true }),
        fc.double({ min: 0.905, max: 1.0, noNaN: true }),
        fc.boolean(),
        (profile, larger, ratio, largerFirst) => {
          const smaller = larger * ratio;
          const candidate = largerFirst ? withPegDiameters(profile, larger, smaller) : withPegDiameters(profile, smaller, larger);
          const kinds = validateCardProfile(candidate).map((violation) => violation.kind);
          expect(kinds).toContain('peg-diameters-too-close');
        },
      ),
    );
  });

  it('R2.8 peg hole diameters that differ by at least 11% of the larger are accepted', () => {
    // The generated profile is otherwise valid. Validation does not compare the peg hole diameters with the
    // punched hole diameter, so overriding the two diameters keeps the profile valid.
    fc.assert(
      fc.property(
        profileArbitrary,
        fc.double({ min: 0.5, max: 20, noNaN: true }),
        fc.double({ min: 0.5, max: 0.89, noNaN: true }),
        fc.boolean(),
        (profile, larger, ratio, largerFirst) => {
          const smaller = larger * ratio;
          const candidate = largerFirst ? withPegDiameters(profile, larger, smaller) : withPegDiameters(profile, smaller, larger);
          expect(validateCardProfile(candidate)).toEqual([]);
        },
      ),
    );
  });

  it('R2.9 validating any value never throws and a non-profile is reported', () => {
    fc.assert(
      fc.property(
        fc.anything({ withNullPrototype: true, withBigInt: true, withSparseArray: true, withObjectString: true }),
        (value) => {
          expect(validateCardProfile(value).length).toBeGreaterThan(0);
        },
      ),
    );
  });

  it('R2.8 peg hole diameters of exactly 10% apart (2.7 mm and 3.0 mm) are accepted', () => {
    expect(MIN_PEG_DIAMETER_DIFFERENCE).toBe(0.1);
    expect(validateCardProfile(withPegDiameters(demoProfile, 2.7, 3.0))).toEqual([]);
    expect(validateCardProfile(withPegDiameters(demoProfile, 3.0, 2.7))).toEqual([]);
  });

  it('R2.8 equal peg hole diameters and diameters 9% apart are reported', () => {
    for (const [first, second] of [
      [3.0, 3.0],
      [2.73, 3.0],
    ] as const) {
      const kinds = validateCardProfile(withPegDiameters(demoProfile, first, second)).map((violation) => violation.kind);
      expect(kinds).toEqual(['peg-diameters-too-close']);
    }
  });

  it('R1.1 the demo profile is valid and keeps its ILLUSTRATIVE marker', () => {
    expect(validateCardProfile(demoProfile)).toEqual([]);
    expect(demoProfile.status).toContain('ILLUSTRATIVE, UNVERIFIED');
  });

  it('R1.4 a profile with no endOrder is reported as a missing field and gets no default order', () => {
    const candidate = mutateProfile(demoProfile, ['endOrder'], REMOVE);
    const violations = validateCardProfile(candidate);
    expect(violations.map(({ kind, location }) => ({ kind, location }))).toEqual([
      { kind: 'missing-field', location: 'endOrder' },
    ]);
    expect(parseCardProfile(candidate).ok).toBe(false);
  });

  it('R2.5 an endOrder that repeats an end index is reported at the second cell and the omitted end is reported', () => {
    const candidate = mutateProfile(demoProfile, ['endOrder', 0, 1], 0);
    expect(validateCardProfile(candidate).map(({ kind, location }) => ({ kind, location }))).toEqual([
      { kind: 'end-order-duplicate', location: 'endOrder[0][1]' },
      { kind: 'end-order-unassigned', location: 'end[1]' },
    ]);
  });

  it('R2.4 a hole that reaches past the right edge of the card is reported at its hook position', () => {
    const candidate = mutateProfile(demoProfile, ['cardWidthMm'], 50);
    expect(validateCardProfile(candidate).map(({ kind, location }) => ({ kind, location }))).toEqual([
      { kind: 'hole-outside-card', location: 'hook[0][15]' },
    ]);
  });

  it('R2.1 every violation is collected, not only the first', () => {
    const candidate = mutateProfile(
      mutateProfile(demoProfile, ['hookRows'], 0) as CardProfile,
      ['pegHoles'],
      [],
    );
    const locations = validateCardProfile(candidate).map((violation) => violation.location);
    expect(locations).toContain('hookRows');
    expect(locations).toContain('pegHoles');
  });
});
