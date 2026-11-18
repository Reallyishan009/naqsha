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

  it('R1.4 a profile with no end-order mapping is reported invalid and given no default order', () => {
    fc.assert(
      fc.property(profileArbitrary, (profile) => {
        const candidate = mutateProfile(profile, ['endOrder'], REMOVE);
        const violations = validateCardProfile(candidate);
        expect(violations.some(({ kind, location }) => kind === 'missing-field' && location === 'endOrder')).toBe(true);
        expect(parseCardProfile(candidate).ok).toBe(false);
      }),
    );
  });

  it('R2.5 an end-order that repeats, omits or exceeds an end index is reported', () => {
    // Every case is built from a valid profile (a permutation) by overwriting one cell, so each fault is known.
    // Cells are addressed by their row-major position p, which is also the order the validator visits them in.
    type Fault =
      | { fault: 'duplicate'; profile: CardProfile; cell: number; source: number }
      | { fault: 'out-of-range'; profile: CardProfile; cell: number; value: number }
      | { fault: 'unassigned'; profile: CardProfile; cell: number; source: number };
    const faults: fc.Arbitrary<Fault> = profileArbitrary.chain((profile) => {
      const total = profile.hookRows * profile.hookColumns;
      return fc.oneof(
        // (a) a later cell repeats the value of an earlier cell, so the duplicate is the second cell.
        fc
          .integer({ min: 1, max: total - 1 })
          .chain((cell) =>
            fc.integer({ min: 0, max: cell - 1 }).map((source): Fault => ({ fault: 'duplicate', profile, cell, source })),
          ),
        // (b) a cell holds a negative, too-large or non-integer value.
        fc
          .tuple(
            fc.integer({ min: 0, max: total - 1 }),
            fc.oneof(
              fc.integer({ min: -1000, max: -1 }),
              fc.integer({ min: total, max: total + 1000 }),
              fc.integer({ min: -1000, max: 1000 }).map((whole) => whole + 0.5),
            ),
          )
          .map(([cell, value]): Fault => ({ fault: 'out-of-range', profile, cell, value })),
        // (c) a cell takes the value of another cell, so the end index it held is no longer assigned.
        fc
          .tuple(fc.integer({ min: 0, max: total - 1 }), fc.integer({ min: 1, max: total - 1 }))
          .map(([cell, offset]): Fault => ({ fault: 'unassigned', profile, cell, source: (cell + offset) % total })),
      );
    });
    fc.assert(
      fc.property(faults, (scenario) => {
        const { profile, cell } = scenario;
        const { hookColumns } = profile;
        const at = (position: number): [number, number] => [Math.floor(position / hookColumns), position % hookColumns];
        const [hookRow, hookColumn] = at(cell);
        const valueAt = (position: number): number => {
          const [row, column] = at(position);
          return profile.endOrder[row]![column]!;
        };
        const replacement = scenario.fault === 'out-of-range' ? scenario.value : valueAt(scenario.source);
        const heldEndIndex = valueAt(cell);
        const violations = validateCardProfile(mutateProfile(profile, ['endOrder', hookRow, hookColumn], replacement));
        const found = (kind: string, location: string): boolean =>
          violations.some((violation) => violation.kind === kind && violation.location === location);
        const cellLocation = `endOrder[${hookRow}][${hookColumn}]`;
        if (scenario.fault === 'duplicate') {
          expect(found('end-order-duplicate', cellLocation)).toBe(true);
        } else if (scenario.fault === 'out-of-range') {
          // The design (rule 6) reports a non-integer cell as end-order-shape, not end-order-out-of-range.
          const kind = Number.isInteger(scenario.value) ? 'end-order-out-of-range' : 'end-order-shape';
          expect(found(kind, cellLocation)).toBe(true);
        } else {
          expect(found('end-order-unassigned', `end[${heldEndIndex}]`)).toBe(true);
        }
      }),
    );
  });

  it('R2.7 a profile without exactly two distinct peg holes is reported', () => {
    const pegFaults = fc.oneof(
      fc.constantFrom(0, 1, 3).map((count) => ({ count })),
      fc.constant({ count: 2 }),
    );
    fc.assert(
      fc.property(profileArbitrary, pegFaults, (profile, { count }) => {
        const [first, second] = profile.pegHoles;
        const thirdPegHole = { ...second, positionMm: { x: second.positionMm.x + 1, y: second.positionMm.y } };
        const pegHoles = [first, second, thirdPegHole].slice(0, count);
        const withCount = mutateProfile(profile, ['pegHoles'], pegHoles);
        const candidate =
          count === 2 ? mutateProfile(profile, ['pegHoles', 1, 'positionMm'], first.positionMm) : withCount;
        const kinds = validateCardProfile(candidate).map((violation) => violation.kind);
        expect(kinds).toContain(count === 2 ? 'peg-holes-coincide' : 'peg-hole-count');
      }),
    );
  });
});
