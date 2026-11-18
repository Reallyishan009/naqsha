import type { CardGrid, CardProfile, Ends, Result, Violation } from './types.ts';
import { validateCardGrid } from './validateCardGrid.ts';

/** The number of ends in one pick: one per hook position. This is a count, not a mapping. */
export function endsPerPick(profile: CardProfile): number {
  return profile.hookRows * profile.hookColumns;
}

/**
 * Turns a card grid into an ends list. The end index of each hook position comes only from profile.endOrder (R1.2, R4.1).
 * An invalid grid returns its violations and no partial ends (R4.3). Never throws; the input is not changed (R4.4).
 * The profile must already be valid (it came from parseCardProfile).
 */
export function encodeCardGrid(profile: CardProfile, grid: unknown): Result<Ends> {
  const violations = validateCardGrid(profile, grid);
  if (violations.length > 0) return { ok: false, violations };

  const rows = grid as CardGrid;
  const ends: Ends = new Array<boolean>(endsPerPick(profile)).fill(false);
  profile.endOrder.forEach((endOrderRow, hookRow) => {
    endOrderRow.forEach((endIndex, hookColumn) => {
      ends[endIndex] = rows[hookRow]![hookColumn]!;
    });
  });
  return { ok: true, value: ends };
}

/**
 * Turns an ends list into a card grid. The end index of each hook position comes only from profile.endOrder (R5.1).
 * Reports a non-array, a wrong length and every non-boolean element (R5.2, R5.3). Never throws; the input is not changed (R5.7).
 * The profile must already be valid (it came from parseCardProfile).
 */
export function decodeEnds(profile: CardProfile, ends: unknown): Result<CardGrid> {
  if (!Array.isArray(ends)) {
    return {
      ok: false,
      violations: [
        {
          kind: 'not-an-array',
          location: 'ends',
          message: `ends must be an array of ${endsPerPick(profile)} booleans, got ${describe(ends)}`,
        },
      ],
    };
  }

  const violations: Violation[] = [];
  const expected = endsPerPick(profile);
  if (ends.length !== expected) {
    violations.push({
      kind: 'wrong-ends-length',
      location: 'ends',
      message: `ends must have ${expected} elements, got ${ends.length}`,
      expected,
      actual: ends.length,
    });
  }
  for (let endIndex = 0; endIndex < ends.length; endIndex++) {
    const element: unknown = ends[endIndex];
    if (typeof element !== 'boolean') {
      violations.push({
        kind: 'not-a-boolean',
        location: `ends[${endIndex}]`,
        message: `end ${endIndex} must be a boolean, got ${describe(element)}`,
      });
    }
  }
  if (violations.length > 0) return { ok: false, violations };

  const grid: CardGrid = profile.endOrder.map((endOrderRow) =>
    endOrderRow.map((endIndex) => ends[endIndex] as boolean),
  );
  return { ok: true, value: grid };
}

function describe(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'an array';
  return typeof value;
}
