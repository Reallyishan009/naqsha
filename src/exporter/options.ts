import type { ExportOptions } from './types.ts';

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  bitDepth: 1,
  liftColour: 'black',
  pickOrder: 'first-at-top',
  endOrder: 'first-at-left',
};

type OptionsFailure = { reason: 'invalid-options'; option: string; message: string };
type OptionsResult = { ok: true; value: ExportOptions } | { ok: false; failure: OptionsFailure };

const BIT_DEPTHS: readonly unknown[] = [1, 8];
const LIFT_COLOURS: readonly unknown[] = ['black', 'white'];
const PICK_ORDERS: readonly unknown[] = ['first-at-top', 'first-at-bottom'];
const END_ORDERS: readonly unknown[] = ['first-at-left', 'first-at-right'];

function fail(option: string, message: string): { ok: false; failure: OptionsFailure } {
  return { ok: false, failure: { reason: 'invalid-options', option, message } };
}

function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  if (Array.isArray(value)) return 'an array';
  return `a value of type ${typeof value}`;
}

/** Fills missing fields from the defaults and reports the first invalid field. Never throws. */
export function parseExportOptions(input: unknown): OptionsResult {
  if (input === undefined) return { ok: true, value: { ...DEFAULT_EXPORT_OPTIONS } };
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return fail('options', 'options must be an object or undefined');
  }
  const fields: { name: keyof ExportOptions; allowed: readonly unknown[]; text: string }[] = [
    { name: 'bitDepth', allowed: BIT_DEPTHS, text: '1 or 8' },
    { name: 'liftColour', allowed: LIFT_COLOURS, text: '"black" or "white"' },
    { name: 'pickOrder', allowed: PICK_ORDERS, text: '"first-at-top" or "first-at-bottom"' },
    { name: 'endOrder', allowed: END_ORDERS, text: '"first-at-left" or "first-at-right"' },
  ];
  const record = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const { name, allowed, text } of fields) {
    let value: unknown;
    try {
      value = record[name];
    } catch {
      return fail(name, `${name} could not be read`);
    }
    if (value === undefined) {
      result[name] = DEFAULT_EXPORT_OPTIONS[name];
    } else if (allowed.includes(value)) {
      result[name] = value;
    } else {
      return fail(name, `${name} must be ${text}, got ${describe(value)}`);
    }
  }
  return { ok: true, value: result as ExportOptions };
}
