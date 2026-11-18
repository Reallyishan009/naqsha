import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { decodeEnds, encodeCardGrid } from '../../src/codec/index.ts';
import type { CardProfile, Pattern } from '../../src/codec/index.ts';
import { bmpLayout, exportPatternBmp, readPatternBmp } from '../../src/exporter/index.ts';
import type { ExportOptions } from '../../src/exporter/index.ts';
import { exportOptionsArbitrary, patternArbitrary } from '../support/patterns.ts';
import { profileArbitrary } from '../support/profiles.ts';

type Case = { profile: CardProfile; pattern: Pattern; options: ExportOptions };

const caseArbitrary: fc.Arbitrary<Case> = profileArbitrary.chain((profile) =>
  fc.record({ profile: fc.constant(profile), pattern: patternArbitrary(profile), options: exportOptionsArbitrary }),
);

function exported({ profile, pattern, options }: Case): Uint8Array {
  const result = exportPatternBmp(profile, pattern, options);
  if (!result.ok) throw new Error(`export failed: ${result.failure.reason}`);
  return result.bytes;
}

const viewOf = (bytes: Uint8Array): DataView => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const invalidValueArbitrary: fc.Arbitrary<unknown> = fc.constantFrom<unknown>(
  null, true, false, 0, 2, 16, -1, NaN, '', 'red', 'Black', '1', [], {}, [1],
);

describe('readPatternBmp known cases', () => {
  it('reads a 1-bit and an 8-bit file of the same Pattern back to that Pattern', () => {
    const [testCase] = fc.sample(caseArbitrary, { seed: 3, numRuns: 1 });
    for (const bitDepth of [1, 8] as const) {
      const options = { ...testCase!.options, bitDepth };
      const bytes = exported({ ...testCase!, options });
      expect(readPatternBmp(bytes, testCase!.profile, options)).toEqual({ ok: true, pattern: testCase!.pattern });
    }
  });

  it('rejects non-byte input and short input as not-a-bmp', () => {
    const [testCase] = fc.sample(caseArbitrary, { seed: 3, numRuns: 1 });
    for (const input of [undefined, null, 'BM', [1, 2], new Uint8Array(0), new Uint8Array(53)]) {
      expect(readPatternBmp(input, testCase!.profile)).toEqual({ ok: false, failure: { reason: 'not-a-bmp' } });
    }
  });

  it('rejects an invalid profile first', () => {
    const result = readPatternBmp(new Uint8Array(0), {}, { bitDepth: 3 });
    expect(result.ok === false && result.failure.reason).toBe('invalid-profile');
  });

  it('fails on a huge declared size without allocating a Pattern', () => {
    const [testCase] = fc.sample(caseArbitrary, { seed: 3, numRuns: 1 });
    const bytes = exported(testCase!);
    const view = viewOf(bytes);
    view.setInt32(22, 2 ** 31 - 1, true);
    const result = readPatternBmp(bytes, testCase!.profile, testCase!.options);
    expect(result.ok === false && result.failure.reason).toBe('inconsistent-size');
  });
});

describe('readPatternBmp properties', () => {
  it('R5.2 an invalid option fails with invalid-options naming it', () => {
    fc.assert(
      fc.property(
        profileArbitrary,
        exportOptionsArbitrary,
        fc.constantFrom<keyof ExportOptions>('bitDepth', 'liftColour', 'pickOrder', 'endOrder'),
        invalidValueArbitrary,
        (profile, options, field, invalidValue) => {
          const result = readPatternBmp(new Uint8Array(0), profile, { ...options, [field]: invalidValue });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.failure.reason).toBe('invalid-options');
            if (result.failure.reason === 'invalid-options') expect(result.failure.option).toBe(field);
          }
        },
      ),
    );
  });

  it('R7.1 reading back an exported file returns the original Pattern', () => {
    fc.assert(
      fc.property(caseArbitrary, (testCase) => {
        const result = readPatternBmp(exported(testCase), testCase.profile, testCase.options);
        expect(result).toEqual({ ok: true, pattern: testCase.pattern });
      }),
    );
  });

  it('R6.4 a file of the wrong width fails with width-mismatch', () => {
    const arbitrary = caseArbitrary.chain((testCase) =>
      fc.record({
        testCase: fc.constant(testCase),
        other: profileArbitrary.filter(
          (other) => other.hookRows * other.hookColumns !== testCase.profile.hookRows * testCase.profile.hookColumns,
        ),
      }),
    );
    fc.assert(
      fc.property(arbitrary, ({ testCase, other }) => {
        const result = readPatternBmp(exported(testCase), other, testCase.options);
        expect(result).toEqual({
          ok: false,
          failure: {
            reason: 'width-mismatch',
            fileWidth: testCase.profile.hookRows * testCase.profile.hookColumns,
            profileWidth: other.hookRows * other.hookColumns,
          },
        });
      }),
    );
  });

  it('R6.5 inconsistent sizes fail with inconsistent-size naming the field', () => {
    const mutationArbitrary = fc.oneof(
      fc.record({ kind: fc.constantFrom('fileSize' as const, 'pixelOffset' as const, 'imageSize' as const), delta: fc.integer({ min: 1, max: 2 ** 32 - 1 }) }),
      fc.record({ kind: fc.constant('append' as const), count: fc.integer({ min: 1, max: 20 }) }),
      fc.record({ kind: fc.constant('remove' as const), count: fc.integer({ min: 1, max: 4000 }) }),
    );
    fc.assert(
      fc.property(caseArbitrary, mutationArbitrary, (testCase, mutation) => {
        const original = exported(testCase);
        const layout = bmpLayout(
          testCase.profile.hookRows * testCase.profile.hookColumns,
          testCase.pattern.length,
          testCase.options.bitDepth,
        );
        let mutated = original.slice();
        let expected: unknown;
        if (mutation.kind === 'append') {
          mutated = new Uint8Array(original.length + mutation.count);
          mutated.set(original);
          expected = { reason: 'inconsistent-size', field: 'length', expected: layout.fileSize, actual: mutated.length };
        } else if (mutation.kind === 'remove') {
          mutated = original.slice(0, Math.max(0, original.length - mutation.count));
          expected =
            mutated.length < 54
              ? { reason: 'not-a-bmp' }
              : { reason: 'inconsistent-size', field: 'length', expected: layout.fileSize, actual: mutated.length };
        } else {
          const offset = { fileSize: 2, pixelOffset: 10, imageSize: 34 }[mutation.kind];
          const wanted = layout[mutation.kind];
          const actual = (wanted + mutation.delta) % 2 ** 32;
          viewOf(mutated).setUint32(offset, actual, true);
          expected = { reason: 'inconsistent-size', field: mutation.kind, expected: wanted, actual };
        }
        expect(readPatternBmp(mutated, testCase.profile, testCase.options)).toEqual({ ok: false, failure: expected });
      }),
    );
  });

  it('R6.2 unsupported BMP variants fail with unsupported-bmp naming the field', () => {
    type Mutation = { field: string; offset: number; size: 2 | 4; signed: boolean; value: fc.Arbitrary<number> };
    const mutations: Mutation[] = [
      { field: 'infoHeaderSize', offset: 14, size: 4, signed: false, value: fc.integer({ min: 0, max: 2 ** 32 - 1 }).filter((v) => v !== 40) },
      { field: 'planes', offset: 26, size: 2, signed: false, value: fc.integer({ min: 0, max: 65535 }).filter((v) => v !== 1) },
      { field: 'bitDepth', offset: 28, size: 2, signed: false, value: fc.constantFrom(4, 24) },
      { field: 'compression', offset: 30, size: 4, signed: false, value: fc.integer({ min: 1, max: 3 }) },
      { field: 'height', offset: 22, size: 4, signed: true, value: fc.oneof(fc.constant(0), fc.integer({ min: -(2 ** 31), max: -1 })) },
      { field: 'width', offset: 18, size: 4, signed: true, value: fc.constant(0) },
    ];
    fc.assert(
      fc.property(
        caseArbitrary,
        fc.constantFrom(...mutations).chain((mutation) =>
          fc.record({ mutation: fc.constant(mutation), value: mutation.value }),
        ),
        (testCase, { mutation, value }) => {
          const bytes = exported(testCase).slice();
          const view = viewOf(bytes);
          if (mutation.size === 2) view.setUint16(mutation.offset, value, true);
          else if (mutation.signed) view.setInt32(mutation.offset, value, true);
          else view.setUint32(mutation.offset, value, true);
          expect(readPatternBmp(bytes, testCase.profile, testCase.options)).toEqual({
            ok: false,
            failure: { reason: 'unsupported-bmp', field: mutation.field, value },
          });
        },
      ),
    );
    fc.assert(
      fc.property(caseArbitrary, fc.integer({ min: 0, max: 2 ** 32 - 1 }), (testCase, value) => {
        const bytes = exported(testCase).slice();
        const own = testCase.options.bitDepth === 1 ? 2 : 256;
        const used = value === own ? value + 1 : value;
        viewOf(bytes).setUint32(46, used, true);
        expect(readPatternBmp(bytes, testCase.profile, testCase.options)).toEqual({
          ok: false,
          failure: { reason: 'unsupported-bmp', field: 'coloursUsed', value: used },
        });
      }),
    );
  });
});

/** The colour index of the pixel for a pick and end in a file written with these options, read from the bytes. */
function colourIndexAt(bytes: Uint8Array, testCase: Case, pick: number, end: number): number {
  const width = testCase.profile.hookRows * testCase.profile.hookColumns;
  const height = testCase.pattern.length;
  const bitDepth = testCase.options.bitDepth;
  const layout = bmpLayout(width, height, bitDepth);
  const imageRow = testCase.options.pickOrder === 'first-at-top' ? pick : height - 1 - pick;
  const x = testCase.options.endOrder === 'first-at-left' ? end : width - 1 - end;
  const rowStart = layout.pixelOffset + (height - 1 - imageRow) * layout.rowStride;
  if (bitDepth === 8) return bytes[rowStart + x]!;
  return (bytes[rowStart + Math.floor(x / 8)]! >> (7 - (x % 8))) & 1;
}

describe('readPatternBmp colours', () => {
  it('reading a file with the wrong liftColour option gives the inverse Pattern', () => {
    // Only black and white are in the table, so every pixel classifies, but lifted and down swap (R6.3: the options
    // must match the export).
    const [testCase] = fc.sample(caseArbitrary, { seed: 3, numRuns: 1 });
    const options = { ...testCase!.options, bitDepth: 1 as const, liftColour: 'black' as const };
    const bytes = exported({ ...testCase!, options });
    const wrong = readPatternBmp(bytes, testCase!.profile, { ...options, liftColour: 'white' });
    expect(wrong.ok).toBe(true);
    if (!wrong.ok) return;
    const expected = testCase!.pattern.map((grid) => {
      const ends = encodeCardGrid(testCase!.profile, grid);
      if (!ends.ok) throw new Error('encode failed');
      const inverted = decodeEnds(testCase!.profile, ends.value.map((lifted) => !lifted));
      if (!inverted.ok) throw new Error('decode failed');
      return inverted.value;
    });
    expect(wrong.pattern).toEqual(expected);
  });

  it('R6.3 a pixel whose colour is neither the lifted nor the down colour fails with unknown-colour', () => {
    const arbitrary = fc.record({
      testCase: caseArbitrary,
      choose: fc.nat(),
      blue: fc.integer({ min: 0, max: 255 }),
      green: fc.integer({ min: 0, max: 255 }),
      red: fc.integer({ min: 0, max: 255 }),
      reserved: fc.integer({ min: 0, max: 255 }),
    });
    fc.assert(
      fc.property(arbitrary, ({ testCase, choose, blue, green, red, reserved }) => {
        // A third colour is any colour that is not black and not white.
        const thirdBlue = blue === green && green === red && (blue === 0 || blue === 255) ? (blue === 0 ? 1 : 254) : blue;
        const bytes = exported(testCase).slice();
        const width = testCase.profile.hookRows * testCase.profile.hookColumns;
        const used = new Set<number>();
        for (let pick = 0; pick < testCase.pattern.length; pick++) {
          for (let end = 0; end < width; end++) used.add(colourIndexAt(bytes, testCase, pick, end));
        }
        const usedList = [...used].sort((a, b) => a - b);
        const changed = usedList[choose % usedList.length]!;
        bytes.set([thirdBlue, green, red, reserved], 54 + 4 * changed);
        const result = readPatternBmp(bytes, testCase.profile, testCase.options);
        expect(result.ok).toBe(false);
        if (!result.ok && result.failure.reason === 'unknown-colour') {
          const { pick, end } = result.failure;
          expect(colourIndexAt(bytes, testCase, pick, end)).toBe(changed);
        } else {
          expect(result.ok === false && result.failure.reason).toBe('unknown-colour');
        }
      }),
    );
  });

  it('R7.5 the 1-bit and 8-bit files read back to the same Pattern', () => {
    fc.assert(
      fc.property(caseArbitrary, (testCase) => {
        const read = ([1, 8] as const).map((bitDepth) => {
          const options = { ...testCase.options, bitDepth };
          return readPatternBmp(exported({ ...testCase, options }), testCase.profile, options);
        });
        expect(read[0]).toEqual({ ok: true, pattern: testCase.pattern });
        expect(read[1]).toEqual(read[0]);
      }),
    );
  });
});

describe('readPatternBmp totality', () => {
  const isResult = (value: unknown): void => {
    expect(typeof (value as { ok: unknown }).ok).toBe('boolean');
  };

  it('R6.7 reading any bytes never throws', () => {
    // (a) arbitrary values as the bytes, valid profile and options
    fc.assert(
      fc.property(caseArbitrary, fc.anything(), ({ profile, options }, input) => {
        isResult(readPatternBmp(input, profile, options));
      }),
    );
    // (b) random bytes of length 0..200
    fc.assert(
      fc.property(caseArbitrary, fc.uint8Array({ minLength: 0, maxLength: 200 }), ({ profile, options }, input) => {
        isResult(readPatternBmp(input, profile, options));
      }),
    );
    // (c) valid exports truncated at a random length
    fc.assert(
      fc.property(caseArbitrary, fc.nat(), (testCase, cut) => {
        const bytes = exported(testCase);
        isResult(readPatternBmp(bytes.slice(0, cut % (bytes.length + 1)), testCase.profile, testCase.options));
      }),
    );
    // (d) valid exports with 1..10 random bytes changed, header bytes included
    fc.assert(
      fc.property(
        caseArbitrary,
        fc.array(fc.tuple(fc.nat(), fc.integer({ min: 0, max: 255 })), { minLength: 1, maxLength: 10 }),
        (testCase, changes) => {
          const bytes = exported(testCase).slice();
          for (const [position, value] of changes) bytes[position % bytes.length] = value;
          isResult(readPatternBmp(bytes, testCase.profile, testCase.options));
        },
      ),
    );
    // (d') the same, with every change inside the 54-byte header
    fc.assert(
      fc.property(
        caseArbitrary,
        fc.array(fc.tuple(fc.integer({ min: 0, max: 53 }), fc.integer({ min: 0, max: 255 })), { minLength: 1, maxLength: 10 }),
        (testCase, changes) => {
          const bytes = exported(testCase).slice();
          for (const [position, value] of changes) bytes[position] = value;
          isResult(readPatternBmp(bytes, testCase.profile, testCase.options));
        },
      ),
    );
    // (e) arbitrary values for all three arguments
    fc.assert(
      fc.property(fc.anything(), fc.anything(), fc.anything(), (input, profile, options) => {
        isResult(readPatternBmp(input, profile, options));
      }),
    );
  });
});

describe('readPatternBmp padding', () => {
  it('R6.6 / R3.3 setting every padding byte and unused bit does not change what is read', () => {
    const [testCase] = fc.sample(caseArbitrary, { seed: 3, numRuns: 1 });
    const width = testCase!.profile.hookRows * testCase!.profile.hookColumns;
    const height = testCase!.pattern.length;
    let flipped = 0;
    for (const bitDepth of [1, 8] as const) {
      const options = { ...testCase!.options, bitDepth };
      const bytes = exported({ ...testCase!, options }).slice();
      const before = readPatternBmp(bytes, testCase!.profile, options);
      const layout = bmpLayout(width, height, bitDepth);
      const pixelBytes = bitDepth === 1 ? Math.ceil(width / 8) : width;
      const unusedBits = bitDepth === 1 ? pixelBytes * 8 - width : 0;
      for (let s = 0; s < height; s++) {
        const rowStart = layout.pixelOffset + s * layout.rowStride;
        for (let i = pixelBytes; i < layout.rowStride; i++) {
          bytes[rowStart + i] = 0xff;
          flipped++;
        }
        if (unusedBits > 0) {
          bytes[rowStart + pixelBytes - 1]! |= (1 << unusedBits) - 1;
          flipped++;
        }
      }
      expect(before.ok).toBe(true);
      expect(readPatternBmp(bytes, testCase!.profile, options)).toEqual(before);
    }
    expect(flipped).toBeGreaterThan(0);
  });
});
