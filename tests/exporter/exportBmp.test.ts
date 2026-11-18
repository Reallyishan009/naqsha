import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { encodeCardGrid, parseCardProfile, validateCardGrid, validateCardProfile } from '../../src/codec/index.ts';
import type { CardProfile, Pattern } from '../../src/codec/index.ts';
import { bmpLayout, exportPatternBmp } from '../../src/exporter/index.ts';
import { exportOptionsArbitrary, patternArbitrary } from '../support/patterns.ts';
import { REMOVE, mutateProfile, profileArbitrary, rowMajorEndOrder } from '../support/profiles.ts';

/** A valid profile with 2 hook rows, 2 hook columns and a row-major endOrder. The geometry of a fixed-seed generated
 * profile is reused: a smaller hook grid in the same card keeps every hole on the card and clear of the peg holes. */
function twoByTwoProfile(): CardProfile {
  const [base] = fc.sample(profileArbitrary, { seed: 1, numRuns: 1 });
  return { ...base!, hookRows: 2, hookColumns: 2, endOrder: rowMajorEndOrder(2, 2) };
}

const hex = (text: string): number[] => text.trim().split(/\s+/).map((byte) => parseInt(byte, 16));

describe('exportPatternBmp 1-bit known bytes', () => {
  it('a 2 x 2 hook profile with two picks exports exactly the 70 bytes of the design', () => {
    const profile = twoByTwoProfile();
    expect(parseCardProfile(profile).ok).toBe(true);
    const pattern: Pattern = [
      [[true, false], [false, true]],
      [[false, false], [true, false]],
    ];
    const expected = hex(`
      42 4D 46 00 00 00 00 00 00 00 3E 00 00 00 28 00 00 00 04 00 00 00 02 00 00 00 01 00 01 00
      00 00 00 00 08 00 00 00 00 00 00 00 00 00 00 00 02 00 00 00 02 00 00 00 FF FF FF 00 00 00
      00 00 20 00 00 00 90 00 00 00
    `);
    expect(expected).toHaveLength(70);
    const result = exportPatternBmp(profile, pattern);
    expect(result.ok && Array.from(result.bytes)).toEqual(expected);
  });

  it('pick order and end order flip the pixel rows and columns, and white lift swaps the colour table', () => {
    const profile = twoByTwoProfile();
    const pattern: Pattern = [
      [[true, false], [false, true]],
      [[false, false], [true, false]],
    ];
    const result = exportPatternBmp(profile, pattern, {
      pickOrder: 'first-at-bottom', endOrder: 'first-at-right', liftColour: 'white',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Array.from(result.bytes.slice(54, 62))).toEqual([0, 0, 0, 0, 0xff, 0xff, 0xff, 0]);
    // stored row 0 is pick 0 (first-at-bottom), ends 1 0 0 1 reversed = 1001; stored row 1 is pick 1, 0010 reversed = 0100.
    expect(Array.from(result.bytes.slice(62, 66))).toEqual([0x90, 0, 0, 0]);
    expect(Array.from(result.bytes.slice(66, 70))).toEqual([0x40, 0, 0, 0]);
  });
});

describe('exportPatternBmp 8-bit known bytes', () => {
  it('a 2 x 2 hook profile with two picks exports exactly the 1,086 bytes of the design', () => {
    const profile = twoByTwoProfile();
    const pattern: Pattern = [
      [[true, false], [false, true]],
      [[false, false], [true, false]],
    ];
    const header = hex(`
      42 4D 3E 04 00 00 00 00 00 00 36 04 00 00 28 00 00 00 04 00 00 00 02 00 00 00 01 00 08 00
      00 00 00 00 08 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 02 00 00 00
    `);
    const lastPixels = hex('00 00 01 00 01 00 00 01');
    expect(header).toHaveLength(54);
    const result = exportPatternBmp(profile, pattern, { bitDepth: 8 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bytes = Array.from(result.bytes);
    expect(bytes).toHaveLength(1086);
    expect(bytes.slice(0, 54)).toEqual(header);
    expect(bytes.slice(54, 58)).toEqual([0xff, 0xff, 0xff, 0x00]);
    expect(bytes.slice(58, 62)).toEqual([0x00, 0x00, 0x00, 0x00]);
    for (let entry = 2; entry < 256; entry++) {
      expect(bytes.slice(54 + 4 * entry, 58 + 4 * entry)).toEqual([0xff, 0xff, 0xff, 0x00]);
    }
    expect(bytes.slice(-8)).toEqual(lastPixels);
  });
});

describe('exportPatternBmp failures', () => {
  it('invalid options are reported with the option name and no bytes', () => {
    const result = exportPatternBmp(twoByTwoProfile(), [[[true, false], [false, true]]], { liftColour: 'red' });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.reason === 'invalid-options' && result.failure.option).toBe('liftColour');
  });

  it('checks the profile before the options', () => {
    const result = exportPatternBmp(null, [], { bitDepth: 3 });
    expect(!result.ok && result.failure.reason).toBe('invalid-profile');
  });

  it('a non-array Pattern is invalid-card at pick -1', () => {
    const result = exportPatternBmp(twoByTwoProfile(), 'nope');
    expect(result).toMatchObject({
      ok: false,
      failure: { reason: 'invalid-card', picks: [{ pick: -1, violations: [{ kind: 'not-an-array', location: 'pattern' }] }] },
    });
  });

  it('bmpLayout gives the sizes the size limit is checked against', () => {
    expect(bmpLayout(2688, 8_000_000, 1).fileSize).toBeGreaterThan(2 ** 31 - 1);
    expect(bmpLayout(4, 2, 1)).toMatchObject({ rowStride: 4, colourEntries: 2, pixelOffset: 62, imageSize: 8, fileSize: 70 });
  });
});

describe('exportPatternBmp properties', () => {
  it('R1.2 an invalid profile fails with invalid-profile and no bytes', () => {
    const mutations: [readonly (string | number)[], unknown][] = [
      [['hookRows'], 0],
      [['name'], REMOVE],
      [[], null],
      [['cardWidthMm'], -1],
    ];
    fc.assert(
      fc.property(profileArbitrary, fc.constantFrom(...mutations), exportOptionsArbitrary, (profile, [path, replacement], options) => {
        const mutated = mutateProfile(profile, path, replacement);
        const expected = validateCardProfile(mutated);
        expect(expected.length).toBeGreaterThan(0);
        const result = exportPatternBmp(mutated, [], options);
        expect(result).toEqual({ ok: false, failure: { reason: 'invalid-profile', violations: expected } });
      }),
    );
  });

  it('R1.3 any damaged card fails the export and every bad pick is listed', () => {
    const damageArbitrary = fc.constantFrom(
      (): unknown => null,
      (): unknown => [],
      (grid: boolean[][]): unknown => grid.map((row, hookRow) => (hookRow === 0 ? [...row.slice(1), 'x'] : row)),
    );
    const scenario = profileArbitrary.chain((profile) =>
      patternArbitrary(profile).chain((pattern) =>
        fc.record({
          profile: fc.constant(profile),
          pattern: fc.constant(pattern),
          damagedPicks: fc.uniqueArray(fc.integer({ min: 0, max: pattern.length - 1 }), { minLength: 1 }),
          damages: fc.array(damageArbitrary, { minLength: pattern.length, maxLength: pattern.length }),
          options: exportOptionsArbitrary,
        }),
      ),
    );
    fc.assert(
      fc.property(scenario, ({ profile, pattern, damagedPicks, damages, options }) => {
        const damagedPattern: unknown[] = pattern.map((grid, pick) =>
          damagedPicks.includes(pick) ? damages[pick]!(grid) : grid,
        );
        const sortedPicks = [...damagedPicks].sort((a, b) => a - b);
        const result = exportPatternBmp(profile, damagedPattern, options);
        expect(result).toEqual({
          ok: false,
          failure: {
            reason: 'invalid-card',
            picks: sortedPicks.map((pick) => ({ pick, violations: validateCardGrid(profile, damagedPattern[pick]) })),
          },
        });
        expect(sortedPicks.every((pick) => validateCardGrid(profile, damagedPattern[pick]).length > 0)).toBe(true);
      }),
    );
  });

  it('R1.4 an empty Pattern fails with empty-pattern', () => {
    fc.assert(
      fc.property(profileArbitrary, exportOptionsArbitrary, (profile, options) => {
        expect(exportPatternBmp(profile, [], options)).toEqual({ ok: false, failure: { reason: 'empty-pattern' } });
      }),
    );
  });

  it('R7.2 the file size in the header equals the byte length and the layout formula', () => {
    const scenario = profileArbitrary.chain((profile) =>
      fc.tuple(fc.constant(profile), patternArbitrary(profile), exportOptionsArbitrary),
    );
    fc.assert(
      fc.property(scenario, ([profile, pattern, options]) => {
        const result = exportPatternBmp(profile, pattern, options);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const bytes = result.bytes;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const width = profile.hookRows * profile.hookColumns;
        const height = pattern.length;
        const rowStride = 4 * Math.ceil((width * options.bitDepth) / 32);
        const pixelOffset = 14 + 40 + 4 * (options.bitDepth === 1 ? 2 : 256);
        expect(view.getUint32(2, true)).toBe(bytes.length);
        expect(bytes.length).toBe(pixelOffset + rowStride * height);
        expect(view.getUint32(10, true)).toBe(pixelOffset);
        expect(view.getUint32(34, true)).toBe(rowStride * height);
        expect(rowStride % 4).toBe(0);
        expect(rowStride * 8).toBeGreaterThanOrEqual(width * options.bitDepth);
        expect((rowStride - 4) * 8).toBeLessThan(width * options.bitDepth);
      }),
    );
  });

  it('R7.3 the colour table is present and matches the lift colour', () => {
    const scenario = profileArbitrary.chain((profile) =>
      fc.tuple(fc.constant(profile), patternArbitrary(profile), exportOptionsArbitrary),
    );
    fc.assert(
      fc.property(scenario, ([profile, pattern, options]) => {
        const result = exportPatternBmp(profile, pattern, options);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const bytes = result.bytes;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const entries = options.bitDepth === 1 ? 2 : 256;
        expect(view.getUint32(46, true)).toBe(entries);
        expect(view.getUint32(10, true)).toBe(54 + 4 * entries);
        const entry = (index: number): number[] => Array.from(bytes.slice(54 + 4 * index, 58 + 4 * index));
        const white = [0xff, 0xff, 0xff, 0x00];
        const black = [0x00, 0x00, 0x00, 0x00];
        expect(entry(1)).toEqual(options.liftColour === 'black' ? black : white);
        expect(entry(0)).toEqual(options.liftColour === 'black' ? white : black);
        for (let index = 2; index < entries; index++) expect(entry(index)).toEqual(entry(0));
      }),
    );
  });
});

describe('exportPatternBmp pixel placement, determinism and totality', () => {
  const scenarioArbitrary = profileArbitrary.chain((profile) =>
    fc.record({ profile: fc.constant(profile), pattern: patternArbitrary(profile), options: exportOptionsArbitrary }),
  );

  it('R2.3 each pixel holds the lift of the end and pick the options place there', () => {
    fc.assert(
      fc.property(scenarioArbitrary, ({ profile, pattern, options }) => {
        const result = exportPatternBmp(profile, pattern, options);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const bytes = result.bytes;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const width = view.getInt32(18, true);
        const height = view.getInt32(22, true);
        const bitCount = view.getUint16(28, true);
        const offset = view.getUint32(10, true);
        const stride = 4 * Math.ceil((width * bitCount) / 32);
        for (let s = 0; s < height; s++) {
          const r = height - 1 - s;
          const p = options.pickOrder === 'first-at-top' ? r : height - 1 - r;
          const ends = encodeCardGrid(profile, pattern[p]);
          expect(ends.ok).toBe(true);
          if (!ends.ok) return;
          for (let x = 0; x < width; x++) {
            const e = options.endOrder === 'first-at-left' ? x : width - 1 - x;
            const index =
              bitCount === 1
                ? (bytes[offset + s * stride + Math.floor(x / 8)]! >> (7 - (x % 8))) & 1
                : bytes[offset + s * stride + x]!;
            expect(index).toBe(ends.value[e] ? 1 : 0);
          }
        }
      }),
    );
  });

  it('R7.4 the same input exports identical bytes', () => {
    fc.assert(
      fc.property(scenarioArbitrary, scenarioArbitrary, ({ profile, pattern, options }, other) => {
        const first = exportPatternBmp(profile, pattern, options);
        exportPatternBmp(other.profile, other.pattern, other.options);
        const second = exportPatternBmp(profile, pattern, options);
        expect(first.ok && second.ok).toBe(true);
        if (first.ok && second.ok) expect(Array.from(second.bytes)).toEqual(Array.from(first.bytes));
      }),
    );
  });

  it('R9.1 exporting never throws for any input', () => {
    const isResult = (value: unknown): void => {
      expect(typeof (value as { ok: unknown }).ok).toBe('boolean');
    };
    fc.assert(
      fc.property(fc.anything(), fc.anything(), fc.anything(), (profile, pattern, options) => {
        isResult(exportPatternBmp(profile, pattern, options));
      }),
    );
    fc.assert(
      fc.property(profileArbitrary, fc.anything(), exportOptionsArbitrary, (profile, pattern, options) => {
        isResult(exportPatternBmp(profile, pattern, options));
      }),
    );
    fc.assert(
      fc.property(scenarioArbitrary, fc.anything(), ({ profile, pattern }, options) => {
        isResult(exportPatternBmp(profile, pattern, options));
      }),
    );
  });
});
