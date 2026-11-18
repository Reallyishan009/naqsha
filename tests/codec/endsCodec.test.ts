import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeEnds, encodeCardGrid, endsPerPick, type CardProfile } from '../../src/codec/index.ts';
import { cardGridArbitrary, endsArbitrary, profileArbitrary } from '../support/profiles.ts';

const gridAndProfile = profileArbitrary.chain((profile) =>
  fc.record({ profile: fc.constant(profile), grid: cardGridArbitrary(profile) }),
);
const endsAndProfile = profileArbitrary.chain((profile) =>
  fc.record({ profile: fc.constant(profile), ends: endsArbitrary(profile) }),
);

describe('endsCodec', () => {
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
