import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { DEFAULT_EXPORT_OPTIONS, parseExportOptions } from '../../src/exporter/index.ts';
import type { ExportOptions } from '../../src/exporter/index.ts';
import { exportOptionsArbitrary } from '../support/patterns.ts';

const FIELDS: (keyof ExportOptions)[] = ['bitDepth', 'liftColour', 'pickOrder', 'endOrder'];

/** Values that are invalid for every field, built from a fixed list (none is a valid option value). */
const invalidValueArbitrary: fc.Arbitrary<unknown> = fc.constantFrom<unknown>(
  null, true, false, 0, 2, 16, -1, NaN, '', 'red', 'Black', '1', [], {}, [1],
);

describe('parseExportOptions', () => {
  it('returns the defaults for undefined', () => {
    expect(parseExportOptions(undefined)).toEqual({ ok: true, value: DEFAULT_EXPORT_OPTIONS });
    expect(DEFAULT_EXPORT_OPTIONS).toEqual({
      bitDepth: 1, liftColour: 'black', pickOrder: 'first-at-top', endOrder: 'first-at-left',
    });
  });

  it('returns a fresh object each time', () => {
    const result = parseExportOptions(undefined);
    expect(result.ok && result.value).not.toBe(DEFAULT_EXPORT_OPTIONS);
  });

  it('fills missing fields from the defaults', () => {
    expect(parseExportOptions({ bitDepth: 8 })).toEqual({
      ok: true, value: { ...DEFAULT_EXPORT_OPTIONS, bitDepth: 8 },
    });
  });

  it('reports null and non-objects as invalid-options naming options', () => {
    for (const input of [null, 5, 'x', true, []]) {
      const result = parseExportOptions(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.option).toBe('options');
    }
  });

  it('reports the first bad field in the order bitDepth, liftColour, pickOrder, endOrder', () => {
    const result = parseExportOptions({ endOrder: 'x', liftColour: 'x' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.option).toBe('liftColour');
      expect(result.failure.message).toContain('liftColour');
    }
  });

  it('R5.1 any valid options are returned unchanged', () => {
    fc.assert(
      fc.property(exportOptionsArbitrary, (options) => {
        expect(parseExportOptions(options)).toEqual({ ok: true, value: options });
      }),
    );
  });

  it('R5.2 an invalid option fails with invalid-options naming it', () => {
    fc.assert(
      fc.property(
        exportOptionsArbitrary,
        fc.constantFrom(...FIELDS),
        invalidValueArbitrary,
        (options, field, invalidValue) => {
          const result = parseExportOptions({ ...options, [field]: invalidValue });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.failure.reason).toBe('invalid-options');
            expect(result.failure.option).toBe(field);
          }
        },
      ),
    );
  });

  it('R5.2 parseExportOptions never throws', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        expect(typeof parseExportOptions(input).ok).toBe('boolean');
      }),
    );
  });
});
