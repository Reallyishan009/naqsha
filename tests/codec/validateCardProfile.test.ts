import { readFileSync } from 'node:fs';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  MIN_PEG_DIAMETER_DIFFERENCE,
  parseCardProfile,
  validateCardProfile,
  type CardProfile,
} from '../../src/codec/index.ts';
import { REMOVE, mutateProfile, profileArbitrary, rowMajorEndOrder } from '../support/profiles.ts';

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
    // punched hole diameter. Since R2.11, a peg hole of up to 20 mm would overlap other holes, so the two peg
    // holes are moved far from the card (validation does not check where a peg hole lies) and the diameter range
    // stays unchanged. Only the peg positions differ from before.
    fc.assert(
      fc.property(
        profileArbitrary,
        fc.double({ min: 0.5, max: 20, noNaN: true }),
        fc.double({ min: 0.5, max: 0.89, noNaN: true }),
        fc.boolean(),
        (profile, larger, ratio, largerFirst) => {
          const smaller = larger * ratio;
          const resized = largerFirst ? withPegDiameters(profile, larger, smaller) : withPegDiameters(profile, smaller, larger);
          const candidate = mutateProfile(
            mutateProfile(resized as CardProfile, ['pegHoles', 0, 'positionMm'], { x: -1000, y: 0 }) as CardProfile,
            ['pegHoles', 1, 'positionMm'],
            { x: -2000, y: 0 },
          );
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

  it('R2.10 a name of 42 is reported as not-a-string and an absent name as missing-field', () => {
    const summary = (candidate: unknown) =>
      validateCardProfile(candidate).map(({ kind, location }) => ({ kind, location }));
    expect(summary(mutateProfile(demoProfile, ['name'], 42))).toEqual([{ kind: 'not-a-string', location: 'name' }]);
    expect(summary(mutateProfile(demoProfile, ['name'], REMOVE))).toEqual([{ kind: 'missing-field', location: 'name' }]);
    expect(validateCardProfile(mutateProfile(demoProfile, ['name'], ''))).toEqual([]);
  });

  it('R2.10 a profile name that is not a string is reported', () => {
    const nonString: fc.Arbitrary<unknown> = fc.oneof(
      fc.double(),
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
      fc.array(fc.oneof(fc.integer(), fc.string())),
      fc.dictionary(fc.string(), fc.integer()),
      fc.bigInt(),
    );
    fc.assert(
      fc.property(profileArbitrary, nonString, (profile, name) => {
        const candidate = mutateProfile(profile, ['name'], name);
        const violations = validateCardProfile(candidate);
        expect(violations.map(({ kind, location }) => ({ kind, location }))).toEqual([
          { kind: 'not-a-string', location: 'name' },
        ]);
        expect(parseCardProfile(candidate).ok).toBe(false);
      }),
    );
  });

  describe('R2.11 holes that overlap or touch', () => {
    const overlaps = (candidate: unknown) =>
      validateCardProfile(candidate).filter((violation) => violation.kind === 'holes-overlap');
    const namesBoth = (candidate: unknown, a: string, b: string): boolean =>
      overlaps(candidate).some(({ location }) => location === `${a} and ${b}` || location === `${b} and ${a}`);

    it('R2.11 the demo profile has no overlapping holes', () => {
      expect(overlaps(demoProfile)).toEqual([]);
    });
    it('R2.11 two lacing holes 0.87 mm apart with a 1.5 mm diameter are reported naming both', () => {
      const candidate = mutateProfile(
        mutateProfile(demoProfile, ['lacingHoles', 'diameterMm'], 1.5) as CardProfile,
        ['lacingHoles', 'positionsMm'],
        [{ x: 15, y: 2 }, { x: 15.87, y: 2 }],
      );
      expect(namesBoth(candidate, 'lacing[0]', 'lacing[1]')).toBe(true);
      expect(parseCardProfile(candidate).ok).toBe(false);
    });
    it('R2.11 lacing holes exactly touching are rejected and lacing holes 0.001 mm apart are accepted', () => {
      const withSecondLacingX = (x: number) => mutateProfile(demoProfile, ['lacingHoles', 'positionsMm', 1, 'x'], x);
      const first = demoProfile.lacingHoles.positionsMm[0]!;
      const diameter = demoProfile.lacingHoles.diameterMm;
      expect(namesBoth(withSecondLacingX(first.x + diameter), 'lacing[0]', 'lacing[1]')).toBe(true);
      expect(validateCardProfile(withSecondLacingX(first.x + diameter + 0.001))).toEqual([]);
    });
    it('R2.11 a peg hole moved onto a hook position is reported naming both', () => {
      const candidate = mutateProfile(demoProfile, ['pegHoles', 0, 'positionMm'], demoProfile.firstHoleCentreMm);
      expect(namesBoth(candidate, 'pegHoles[0]', 'hook[0][0]')).toBe(true);
    });
    it('R2.11 a horizontal pitch equal to the hole diameter is reported and one slightly larger is accepted', () => {
      const touching = mutateProfile(demoProfile, ['horizontalPitchMm'], demoProfile.holeDiameterMm);
      expect(namesBoth(touching, 'hook[0][0]', 'hook[0][1]')).toBe(true);
      const clear = mutateProfile(demoProfile, ['horizontalPitchMm'], demoProfile.holeDiameterMm + 0.001);
      expect(validateCardProfile(clear)).toEqual([]);
    });
    it('R2.11 a vertical pitch equal to the hole diameter is reported naming the vertical neighbours', () => {
      const touching = mutateProfile(demoProfile, ['verticalPitchMm'], demoProfile.holeDiameterMm);
      expect(namesBoth(touching, 'hook[0][0]', 'hook[1][0]')).toBe(true);
    });

    it('R2.11 a profile with two overlapping or touching holes is reported with both hole names', () => {
      const scenario = fc.oneof(
        fc.record({ kind: fc.constant('lacing-lacing' as const), t: fc.double({ min: 0, max: 1, noNaN: true }) }),
        fc.record({ kind: fc.constant('peg-lacing' as const), t: fc.double({ min: 0, max: 1, noNaN: true }) }),
        fc.record({ kind: fc.constant('hook-pitch' as const), t: fc.double({ min: 0.01, max: 1, noNaN: true }) }),
      );
      fc.assert(
        fc.property(profileArbitrary, scenario, (profile, { kind, t }) => {
          const d = profile.holeDiameterMm;
          let candidate: unknown;
          let a: string;
          let b: string;
          // One hole sits at x = 0 so that the offset t * (sum of radii) is stored exactly and the centre distance
          // is at most the sum of radii in floating point as well (t <= 1).
          if (kind === 'lacing-lacing') {
            candidate = mutateProfile(profile, ['lacingHoles', 'positionsMm'], [
              { x: 0, y: 0 },
              { x: t * d, y: 0 },
            ]);
            [a, b] = ['lacing[0]', 'lacing[1]'];
          } else if (kind === 'peg-lacing') {
            const reach = profile.pegHoles[0].diameterMm / 2 + profile.lacingHoles.diameterMm / 2;
            const movedPeg = mutateProfile(profile, ['pegHoles', 0, 'positionMm'], { x: 0, y: 0 }) as CardProfile;
            candidate = mutateProfile(movedPeg, ['lacingHoles', 'positionsMm'], [{ x: t * reach, y: 0 }]);
            [a, b] = ['pegHoles[0]', 'lacing[0]'];
          } else {
            candidate = mutateProfile(profile, ['horizontalPitchMm'], t * d);
            [a, b] = ['hook[0][0]', 'hook[0][1]'];
          }
          expect(namesBoth(candidate, a, b)).toBe(true);
          expect(parseCardProfile(candidate).ok).toBe(false);
        }),
      );
    });

    it('R2.11 a profile with a lacing hole moved onto another hole is rejected', () => {
      fc.assert(
        fc.property(
          profileArbitrary,
          fc.integer({ min: 0, max: 3 }),
          fc.nat(),
          fc.nat(),
          (profile, targetKind, rowSeed, columnSeed) => {
            const hookRow = rowSeed % profile.hookRows;
            const hookColumn = columnSeed % profile.hookColumns;
            const secondLacing = { x: profile.firstHoleCentreMm.x, y: profile.firstHoleCentreMm.y - 1 };
            const target =
              targetKind === 0
                ? {
                    name: `hook[${hookRow}][${hookColumn}]`,
                    centre: {
                      x: profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm,
                      y: profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm,
                    },
                  }
                : targetKind === 3
                  ? { name: 'lacing[1]', centre: secondLacing }
                  : { name: `pegHoles[${targetKind - 1}]`, centre: profile.pegHoles[targetKind - 1]!.positionMm };
            const candidate = mutateProfile(profile, ['lacingHoles', 'positionsMm'], [
              { x: target.centre.x, y: target.centre.y },
              secondLacing,
            ]);
            expect(namesBoth(candidate, 'lacing[0]', target.name)).toBe(true);
            expect(parseCardProfile(candidate).ok).toBe(false);
          },
        ),
      );
    });

    it('R2.11 the bounded overlap check reports exactly the pairs a brute-force all-pairs check reports', () => {
      const quarter = (min: number, max: number) => fc.integer({ min: min * 4, max: max * 4 }).map((n) => n / 4);
      const point = fc.record({ x: quarter(0, 14), y: quarter(0, 14) });
      const dense = fc
        .record({
          hookRows: fc.integer({ min: 1, max: 4 }),
          hookColumns: fc.integer({ min: 1, max: 4 }),
          holeDiameterMm: quarter(0.5, 3),
          horizontalPitchMm: quarter(0.5, 4),
          verticalPitchMm: quarter(0.5, 4),
          firstHoleCentreMm: point,
          lacingDiameterMm: quarter(0.5, 3),
          lacingPositions: fc.array(point, { maxLength: 6 }),
          pegPositions: fc.tuple(point, point),
          pegDiameters: fc.tuple(quarter(0.5, 4), quarter(0.5, 4)),
        })
        .map((draft): CardProfile => ({
          name: 'dense',
          cardWidthMm: 100,
          cardHeightMm: 100,
          hookRows: draft.hookRows,
          hookColumns: draft.hookColumns,
          holeDiameterMm: draft.holeDiameterMm,
          horizontalPitchMm: draft.horizontalPitchMm,
          verticalPitchMm: draft.verticalPitchMm,
          firstHoleCentreMm: draft.firstHoleCentreMm,
          endOrder: rowMajorEndOrder(draft.hookRows, draft.hookColumns),
          pegHoles: [
            { positionMm: draft.pegPositions[0], diameterMm: draft.pegDiameters[0] },
            { positionMm: draft.pegPositions[1], diameterMm: draft.pegDiameters[1] },
          ],
          lacingHoles: { diameterMm: draft.lacingDiameterMm, positionsMm: draft.lacingPositions },
        }));
      type Hole = { name: string; hook: boolean; x: number; y: number; r: number };
      const allHoles = (profile: CardProfile): Hole[] => {
        const holes: Hole[] = [];
        for (let row = 0; row < profile.hookRows; row++) {
          for (let column = 0; column < profile.hookColumns; column++) {
            holes.push({
              name: `hook[${row}][${column}]`,
              hook: true,
              x: profile.firstHoleCentreMm.x + column * profile.horizontalPitchMm,
              y: profile.firstHoleCentreMm.y + row * profile.verticalPitchMm,
              r: profile.holeDiameterMm / 2,
            });
          }
        }
        profile.lacingHoles.positionsMm.forEach((centre, index) =>
          holes.push({ name: `lacing[${index}]`, hook: false, x: centre.x, y: centre.y, r: profile.lacingHoles.diameterMm / 2 }),
        );
        profile.pegHoles.forEach((peg, index) =>
          holes.push({ name: `pegHoles[${index}]`, hook: false, x: peg.positionMm.x, y: peg.positionMm.y, r: peg.diameterMm / 2 }),
        );
        return holes;
      };
      const pairKey = (a: string, b: string): string => [a, b].sort().join(' and ');
      fc.assert(
        fc.property(dense, (profile) => {
          const holes = allHoles(profile);
          const expectedPairs = new Set<string>();
          let expectedHookPair = false;
          for (let i = 0; i < holes.length; i++) {
            for (let j = i + 1; j < holes.length; j++) {
              const a = holes[i]!;
              const b = holes[j]!;
              if (Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r) continue;
              if (a.hook && b.hook) expectedHookPair = true;
              else expectedPairs.add(pairKey(a.name, b.name));
            }
          }
          const reported = validateCardProfile(profile).filter((violation) => violation.kind === 'holes-overlap');
          const reportedPairs = new Set<string>();
          let reportedHookPair = false;
          for (const { location } of reported) {
            const [a, b] = location.split(' and ') as [string, string];
            if (a.startsWith('hook') && b.startsWith('hook')) reportedHookPair = true;
            else reportedPairs.add(pairKey(a, b));
          }
          expect([...reportedPairs].sort()).toEqual([...expectedPairs].sort());
          expect(reportedHookPair).toBe(expectedHookPair);
          expect(reported.length).toBe(reportedPairs.size + (reportedHookPair ? reported.filter(({ location }) => location.split(' and ').every((name) => name.startsWith('hook'))).length : 0));
        }),
      );
    });
  });
});
