import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
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
