import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateCardGrid, type CardProfile } from '../../src/codec/index.ts';
import { cardGridArbitrary, profileArbitrary } from '../support/profiles.ts';

/** Reference check, written independently of validateCardGrid: is this exactly a hookRows x hookColumns boolean grid? */
function isGridFor(profile: CardProfile, value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === profile.hookRows &&
    value.every(
      (row: unknown) =>
        Array.isArray(row) && row.length === profile.hookColumns && row.every((cell: unknown) => typeof cell === 'boolean'),
    )
  );
}

describe('validateCardGrid', () => {
  // **Validates: Requirements 3.1**
  it('R3.1 a grid with hookRows rows of hookColumns booleans is accepted', () => {
    fc.assert(
      fc.property(
        profileArbitrary.chain((profile) => fc.record({ profile: fc.constant(profile), grid: cardGridArbitrary(profile) })),
        ({ profile, grid }) => {
          expect(validateCardGrid(profile, grid)).toEqual([]);
        },
      ),
    );
  });

  it('R3.6 any value that is not a grid is reported without throwing', () => {
    // **Validates: Requirements 3.6**
    // fc.pre drops only values that an independent reference check says are valid grids. The array arbitraries
    // can occasionally build a valid grid; fc.anything() almost never does.
    fc.assert(
      fc.property(
        profileArbitrary,
        fc.oneof(fc.anything(), fc.array(fc.anything()), fc.array(fc.array(fc.anything()))),
        (profile, value) => {
          fc.pre(!isGridFor(profile, value));
          const violations = validateCardGrid(profile, value);
          expect(violations.length).toBeGreaterThan(0);
        },
      ),
    );
  });

  it('R3.6 null, undefined and non-array values are reported as not-an-array', () => {
    const profile = { hookRows: 2, hookColumns: 3 } as CardProfile;
    for (const value of [null, undefined, 5, 'x', {}]) {
      expect(validateCardGrid(profile, value).map((violation) => violation.kind)).toEqual(['not-an-array']);
    }
  });

  it('R3.2 R3.3 R3.4 R3.5 all violations are returned with expected, actual and locations', () => {
    const profile = { hookRows: 3, hookColumns: 2 } as CardProfile;
    const violations = validateCardGrid(profile, [[true, false], [true], [true, 1]]);
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'wrong-hook-column-count', location: 'grid[1]', expected: 2, actual: 1 }),
      expect.objectContaining({ kind: 'not-a-boolean', location: 'grid[2][1]' }),
    ]);
    expect(validateCardGrid(profile, [[true, false]])).toEqual([
      expect.objectContaining({ kind: 'wrong-hook-row-count', location: 'grid', expected: 3, actual: 1 }),
    ]);
  });
});
