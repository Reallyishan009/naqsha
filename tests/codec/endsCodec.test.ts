import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decodeEnds,
  encodeCardGrid,
  endsPerPick,
  validateCardGrid,
  type CardProfile,
} from '../../src/codec/index.ts';
import { cardGridArbitrary, endsArbitrary, profileArbitrary } from '../support/profiles.ts';

const gridAndProfile = profileArbitrary.chain((profile) =>
  fc.record({ profile: fc.constant(profile), grid: cardGridArbitrary(profile) }),
);
const endsAndProfile = profileArbitrary.chain((profile) =>
  fc.record({ profile: fc.constant(profile), ends: endsArbitrary(profile) }),
);

/** A valid grid made invalid by construction: rows added or removed, a row lengthened or shortened, a non-boolean cell, or a non-array. */
const invalidGridAndProfile = gridAndProfile.chain(({ profile, grid }) => {
  const { hookRows, hookColumns } = profile;
  const rowIndex = fc.integer({ min: 0, max: hookRows - 1 });
  const booleanRow = fc.array(fc.boolean(), { minLength: hookColumns, maxLength: hookColumns });
  const invalidGrid: fc.Arbitrary<unknown> = fc.oneof(
    fc.array(booleanRow, { minLength: 1, maxLength: 3 }).map((extraRows) => [...grid, ...extraRows]),
    fc.integer({ min: 1, max: hookRows }).map((removed) => grid.slice(0, hookRows - removed)),
    fc
      .record({ hookRow: rowIndex, extra: fc.array(fc.boolean(), { minLength: 1, maxLength: 3 }) })
      .map(({ hookRow, extra }) => grid.map((row, i) => (i === hookRow ? [...row, ...extra] : row))),
    fc
      .record({ hookRow: rowIndex, removed: fc.integer({ min: 1, max: hookColumns }) })
      .map(({ hookRow, removed }) =>
        grid.map((row, i) => (i === hookRow ? row.slice(0, hookColumns - removed) : row)),
      ),
    fc
      .record({
        hookRow: rowIndex,
        hookColumn: fc.integer({ min: 0, max: hookColumns - 1 }),
        value: fc.constantFrom<unknown>(0, 1, 'true', null, undefined, {}, [], NaN),
      })
      .map(({ hookRow, hookColumn, value }) =>
        grid.map((row, i) => (i === hookRow ? row.map((cell, j) => (j === hookColumn ? value : cell)) : row)),
      ),
    fc.anything().filter((value) => !Array.isArray(value)),
  );
  return fc.record({ profile: fc.constant(profile), grid: invalidGrid });
});

const wrongLengthEnds = profileArbitrary.chain((profile) =>
  fc.record({
    profile: fc.constant(profile),
    ends: fc
      .array(fc.boolean(), { maxLength: 2 * endsPerPick(profile) + 3 })
      .filter((list) => list.length !== endsPerPick(profile)),
  }),
);

const endsWithNonBoolean = endsAndProfile.chain(({ profile, ends }) =>
  fc.record({
    profile: fc.constant(profile),
    ends: fc.constant(ends),
    endIndex: fc.integer({ min: 0, max: ends.length - 1 }),
    value: fc.anything().filter((value) => typeof value !== 'boolean'),
  }),
);

describe('endsCodec', () => {
  it('R4.3 encoding an invalid grid fails with the validation violations and returns no ends', () => {
    // **Validates: Requirements 4.3**
    fc.assert(
      fc.property(invalidGridAndProfile, ({ profile, grid }) => {
        const result = encodeCardGrid(profile, grid);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.violations).toEqual(validateCardGrid(profile, grid));
        expect(result.violations.length).toBeGreaterThan(0);
        expect('ends' in result).toBe(false);
        expect('value' in result).toBe(false);
      }),
    );
  });

  it('R5.2 an ends list of the wrong length is rejected with expected and actual lengths', () => {
    // **Validates: Requirements 5.2**
    fc.assert(
      fc.property(wrongLengthEnds, ({ profile, ends }) => {
        const result = decodeEnds(profile, ends);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
          kind: 'wrong-ends-length',
          expected: endsPerPick(profile),
          actual: ends.length,
        });
      }),
    );
  });

  it('R5.3 a non-boolean end is rejected with its end index', () => {
    // **Validates: Requirements 5.3**
    fc.assert(
      fc.property(endsWithNonBoolean, ({ profile, ends, endIndex, value }) => {
        const replaced: unknown[] = ends.map((end, i) => (i === endIndex ? value : end));
        const result = decodeEnds(profile, replaced);
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.violations).toContainEqual(
          expect.objectContaining({ kind: 'not-a-boolean', location: `ends[${endIndex}]` }),
        );
        expect('value' in result).toBe(false);
      }),
    );
  });

  it("R1.2 encoding follows the profile's end-order and never assumes row-major order", () => {
    // **Validates: Requirements 1.2, 4.1**
    fc.assert(
      fc.property(gridAndProfile, ({ profile, grid }) => {
        const result = encodeCardGrid(profile, grid);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value).toHaveLength(endsPerPick(profile));
        for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
          for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
            expect(result.value[profile.endOrder[hookRow]![hookColumn]!]).toBe(grid[hookRow]![hookColumn]);
          }
        }
      }),
    );
  });

  it('R5.4 decoding an encoded CardGrid returns the original CardGrid', () => {
    // **Validates: Requirements 5.4**
    fc.assert(
      fc.property(gridAndProfile, ({ profile, grid }) => {
        const encoded = encodeCardGrid(profile, grid);
        expect(encoded.ok).toBe(true);
        if (!encoded.ok) return;
        expect(decodeEnds(profile, encoded.value)).toEqual({ ok: true, value: grid });
      }),
    );
  });

  it('R5.5 encoding a decoded ends list returns the original ends list', () => {
    // **Validates: Requirements 5.5**
    fc.assert(
      fc.property(endsAndProfile, ({ profile, ends }) => {
        const decoded = decodeEnds(profile, ends);
        expect(decoded.ok).toBe(true);
        if (!decoded.ok) return;
        expect(encodeCardGrid(profile, decoded.value)).toEqual({ ok: true, value: ends });
      }),
    );
  });

  it('R1.2 a column-major end-order on a 2 x 3 card gives the expected ends list', () => {
    const profile = { hookRows: 2, hookColumns: 3, endOrder: [[0, 2, 4], [1, 3, 5]] } as CardProfile;
    const grid = [[true, false, false], [false, true, true]];
    expect(encodeCardGrid(profile, grid)).toEqual({ ok: true, value: [true, false, false, true, false, true] });
    expect(decodeEnds(profile, [true, false, false, true, false, true])).toEqual({ ok: true, value: grid });
  });

  it('R4.3 an invalid grid returns the validation violations and no ends', () => {
    const profile = { hookRows: 2, hookColumns: 2, endOrder: [[0, 1], [2, 3]] } as CardProfile;
    const result = encodeCardGrid(profile, [[true, false], [true]]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.violations.map((v) => v.kind)).toEqual(['wrong-hook-column-count']);
  });

  it('R5.2 R5.3 decoding reports a non-array, a wrong length and every non-boolean element', () => {
    const profile = { hookRows: 2, hookColumns: 2, endOrder: [[0, 1], [2, 3]] } as CardProfile;
    const notArray = decodeEnds(profile, null);
    expect(!notArray.ok && notArray.violations[0]!.kind).toBe('not-an-array');

    const short = decodeEnds(profile, [true]);
    expect(!short.ok && short.violations).toMatchObject([{ kind: 'wrong-ends-length', expected: 4, actual: 1 }]);

    const bad = decodeEnds(profile, [true, 1, false, 'x']);
    expect(!bad.ok && bad.violations.map(({ kind, location }) => ({ kind, location }))).toEqual([
      { kind: 'not-a-boolean', location: 'ends[1]' },
      { kind: 'not-a-boolean', location: 'ends[3]' },
    ]);
  });

  it('R4.4 R5.7 neither function changes its input', () => {
    const profile = { hookRows: 2, hookColumns: 2, endOrder: [[3, 1], [0, 2]] } as CardProfile;
    const grid = [[true, false], [false, true]];
    const ends = [true, false, true, false];
    const gridCopy = structuredClone(grid);
    const endsCopy = structuredClone(ends);
    encodeCardGrid(profile, grid);
    decodeEnds(profile, ends);
    expect(grid).toEqual(gridCopy);
    expect(ends).toEqual(endsCopy);
  });
});
