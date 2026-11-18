import type { CardProfile, Violation } from './types.ts';

/**
 * Checks a value against the card profile and returns every violation found (R3.5). Never throws (R3.6).
 * The profile must already be valid (it came from parseCardProfile); it is not re-validated here.
 */
export function validateCardGrid(profile: CardProfile, input: unknown): Violation[] {
  if (!Array.isArray(input)) {
    return [
      {
        kind: 'not-an-array',
        location: 'grid',
        message: `grid must be an array of ${profile.hookRows} hook rows, got ${describe(input)}`,
      },
    ];
  }

  const violations: Violation[] = [];

  if (input.length !== profile.hookRows) {
    violations.push({
      kind: 'wrong-hook-row-count',
      location: 'grid',
      message: `grid must have ${profile.hookRows} hook rows, got ${input.length}`,
      expected: profile.hookRows,
      actual: input.length,
    });
  }

  for (let hookRow = 0; hookRow < input.length; hookRow++) {
    const row: unknown = input[hookRow];
    const rowLocation = `grid[${hookRow}]`;
    if (!Array.isArray(row)) {
      violations.push({
        kind: 'not-an-array',
        location: rowLocation,
        message: `hook row ${hookRow} must be an array of ${profile.hookColumns} booleans, got ${describe(row)}`,
      });
      continue;
    }
    if (row.length !== profile.hookColumns) {
      violations.push({
        kind: 'wrong-hook-column-count',
        location: rowLocation,
        message: `hook row ${hookRow} must have ${profile.hookColumns} hook positions, got ${row.length}`,
        expected: profile.hookColumns,
        actual: row.length,
      });
    }
    for (let hookColumn = 0; hookColumn < row.length; hookColumn++) {
      if (typeof row[hookColumn] !== 'boolean') {
        violations.push({
          kind: 'not-a-boolean',
          location: `grid[${hookRow}][${hookColumn}]`,
          message: `hook position (hookRow ${hookRow}, hookColumn ${hookColumn}) must be a boolean, got ${describe(row[hookColumn])}`,
        });
      }
    }
  }

  return violations;
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}
