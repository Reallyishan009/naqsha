import type { CardProfile, PointMm, Result, Violation } from './types.ts';

/** R2.8: peg hole diameters must differ by at least this fraction of the larger diameter. */
export const MIN_PEG_DIAMETER_DIFFERENCE = 0.1;

/**
 * Guards the report of unassigned ends when hookRows * hookColumns is absurdly large.
 * This cap departs from R2.1 ("return all violations") for huge profiles only: it keeps validation from
 * hanging when hookRows * hookColumns is very large. Normal profiles never reach it.
 */
const MAX_UNASSIGNED_VIOLATIONS = 1000;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Reads an own property only, so inherited or prototype keys are never mistaken for fields. */
function own(record: UnknownRecord, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Checks a profile read from outside the program (R2.1).
 * Reports every violation it finds, returns [] for a valid profile, and never throws (R2.9).
 */
export function validateCardProfile(input: unknown): Violation[] {
  if (!isRecord(input)) {
    return [{ kind: 'not-an-object', location: 'profile', message: 'A card profile must be an object.' }];
  }
  const violations: Violation[] = [];
  const report = (violation: Violation): void => {
    violations.push(violation);
  };
  const reportMissing = (location: string): void =>
    report({ kind: 'missing-field', location, message: `The field "${location}" is missing.` });

  /** Rule 4: a positive finite number. Returns the value when valid. */
  const positiveNumber = (record: UnknownRecord, key: string, location: string): number | undefined => {
    const value = own(record, key);
    if (value === undefined) {
      reportMissing(location);
      return undefined;
    }
    if (!isPositiveFiniteNumber(value)) {
      report({
        kind: 'not-a-positive-number',
        location,
        message: `The field "${location}" must be a positive, finite number.`,
        ...(typeof value === 'number' ? { actual: value } : {}),
      });
      return undefined;
    }
    return value;
  };

  /** Any finite number, for coordinates. Returns the value when valid. */
  const finiteNumber = (record: UnknownRecord, key: string, location: string): number | undefined => {
    const value = own(record, key);
    if (value === undefined) {
      reportMissing(location);
      return undefined;
    }
    if (!isFiniteNumber(value)) {
      report({
        kind: 'not-a-positive-number',
        location,
        message: `The field "${location}" must be a finite number.`,
        ...(typeof value === 'number' ? { actual: value } : {}),
      });
      return undefined;
    }
    return value;
  };

  /** A point with finite x and y. Returns the point when valid. */
  const point = (value: unknown, location: string): PointMm | undefined => {
    if (value === undefined) {
      reportMissing(location);
      return undefined;
    }
    if (!isRecord(value)) {
      report({ kind: 'not-an-object', location, message: `The field "${location}" must be an object with x and y.` });
      return undefined;
    }
    const x = finiteNumber(value, 'x', `${location}.x`);
    const y = finiteNumber(value, 'y', `${location}.y`);
    return x === undefined || y === undefined ? undefined : { x, y };
  };

  // Rule 2: missing fields. The presence of the others is reported by the rules below.
  const name = own(input, 'name');
  if (name === undefined) {
    reportMissing('name');
  } else if (typeof name !== 'string') {
    report({ kind: 'not-a-string', location: 'name', message: 'The field "name" must be a string.' });
  }

  // Rule 3: hookRows and hookColumns.
  const integerField = (key: string): number | undefined => {
    const value = own(input, key);
    if (value === undefined) {
      reportMissing(key);
      return undefined;
    }
    if (!isPositiveInteger(value)) {
      report({
        kind: 'not-a-positive-integer',
        location: key,
        message: `The field "${key}" must be a positive integer.`,
        ...(typeof value === 'number' ? { actual: value } : {}),
      });
      return undefined;
    }
    return value;
  };
  const hookRows = integerField('hookRows');
  const hookColumns = integerField('hookColumns');

  // Rule 4: positive finite numbers.
  const cardWidthMm = positiveNumber(input, 'cardWidthMm', 'cardWidthMm');
  const cardHeightMm = positiveNumber(input, 'cardHeightMm', 'cardHeightMm');
  const holeDiameterMm = positiveNumber(input, 'holeDiameterMm', 'holeDiameterMm');
  const horizontalPitchMm = positiveNumber(input, 'horizontalPitchMm', 'horizontalPitchMm');
  const verticalPitchMm = positiveNumber(input, 'verticalPitchMm', 'verticalPitchMm');
  const firstHoleCentreMm = point(own(input, 'firstHoleCentreMm'), 'firstHoleCentreMm');

  const lacingHoles = own(input, 'lacingHoles');
  if (lacingHoles === undefined) {
    reportMissing('lacingHoles');
  } else if (!isRecord(lacingHoles)) {
    report({ kind: 'not-an-object', location: 'lacingHoles', message: 'The field "lacingHoles" must be an object.' });
  } else {
    positiveNumber(lacingHoles, 'diameterMm', 'lacingHoles.diameterMm');
    const positionsMm = own(lacingHoles, 'positionsMm');
    if (positionsMm === undefined) {
      reportMissing('lacingHoles.positionsMm');
    } else if (!Array.isArray(positionsMm)) {
      report({
        kind: 'not-an-array',
        location: 'lacingHoles.positionsMm',
        message: 'The field "lacingHoles.positionsMm" must be a list of positions.',
      });
    }
  }

  // Rule 5: every punched hole position must lie inside the card (R2.4).
  if (
    hookRows !== undefined &&
    hookColumns !== undefined &&
    cardWidthMm !== undefined &&
    cardHeightMm !== undefined &&
    holeDiameterMm !== undefined &&
    horizontalPitchMm !== undefined &&
    verticalPitchMm !== undefined &&
    firstHoleCentreMm !== undefined
  ) {
    const radiusMm = holeDiameterMm / 2;
    const leftEdgeMm = firstHoleCentreMm.x - radiusMm;
    const rightEdgeMm = firstHoleCentreMm.x + (hookColumns - 1) * horizontalPitchMm + radiusMm;
    const topEdgeMm = firstHoleCentreMm.y - radiusMm;
    const bottomEdgeMm = firstHoleCentreMm.y + (hookRows - 1) * verticalPitchMm + radiusMm;
    const outside = (location: string, side: string, actual: number, expected: number): void =>
      report({
        kind: 'hole-outside-card',
        location,
        message: `The hole at ${location} reaches ${actual} mm on its ${side} side, outside the card (limit ${expected} mm).`,
        expected,
        actual,
      });
    if (leftEdgeMm < 0) outside('hook[0][0]', 'left', leftEdgeMm, 0);
    if (rightEdgeMm > cardWidthMm) outside(`hook[0][${hookColumns - 1}]`, 'right', rightEdgeMm, cardWidthMm);
    if (topEdgeMm < 0) outside('hook[0][0]', 'top', topEdgeMm, 0);
    if (bottomEdgeMm > cardHeightMm) outside(`hook[${hookRows - 1}][0]`, 'bottom', bottomEdgeMm, cardHeightMm);
  }

  // Rule 6: endOrder (R1.4, R2.5). A missing endOrder gets no default order.
  const endOrder = own(input, 'endOrder');
  if (endOrder === undefined) {
    reportMissing('endOrder');
  } else if (!Array.isArray(endOrder)) {
    report({
      kind: 'end-order-shape',
      location: 'endOrder',
      message: 'The field "endOrder" must be a list of hook rows, each a list of end indices.',
    });
  } else {
    if (hookRows !== undefined && endOrder.length !== hookRows) {
      report({
        kind: 'end-order-shape',
        location: 'endOrder',
        message: `The field "endOrder" must have ${hookRows} hook rows but has ${endOrder.length}.`,
        expected: hookRows,
        actual: endOrder.length,
      });
    }
    const total = hookRows !== undefined && hookColumns !== undefined ? hookRows * hookColumns : undefined;
    const firstCell = new Map<number, true>();
    for (let hookRowIndex = 0; hookRowIndex < endOrder.length; hookRowIndex++) {
      const row: unknown = endOrder[hookRowIndex];
      const rowLocation = `endOrder[${hookRowIndex}]`;
      if (!Array.isArray(row)) {
        report({ kind: 'end-order-shape', location: rowLocation, message: `${rowLocation} must be a list of end indices.` });
        continue;
      }
      if (hookColumns !== undefined && row.length !== hookColumns) {
        report({
          kind: 'end-order-shape',
          location: rowLocation,
          message: `${rowLocation} must have ${hookColumns} hook columns but has ${row.length}.`,
          expected: hookColumns,
          actual: row.length,
        });
      }
      for (let hookColumnIndex = 0; hookColumnIndex < row.length; hookColumnIndex++) {
        const cell: unknown = row[hookColumnIndex];
        const cellLocation = `${rowLocation}[${hookColumnIndex}]`;
        if (typeof cell !== 'number' || !Number.isInteger(cell)) {
          report({ kind: 'end-order-shape', location: cellLocation, message: `${cellLocation} must be an integer end index.` });
          continue;
        }
        if (total === undefined) continue;
        if (cell < 0 || cell >= total) {
          report({
            kind: 'end-order-out-of-range',
            location: cellLocation,
            message: `${cellLocation} is ${cell}, outside 0 to ${total - 1}.`,
            expected: total - 1,
            actual: cell,
          });
        } else if (firstCell.has(cell)) {
          report({
            kind: 'end-order-duplicate',
            location: cellLocation,
            message: `${cellLocation} repeats end index ${cell}.`,
            actual: cell,
          });
        } else {
          firstCell.set(cell, true);
        }
      }
    }
    if (total !== undefined && firstCell.size < total) {
      let reported = 0;
      for (let endIndex = 0; endIndex < total && reported < MAX_UNASSIGNED_VIOLATIONS; endIndex++) {
        if (firstCell.has(endIndex)) continue;
        reported++;
        report({
          kind: 'end-order-unassigned',
          location: `end[${endIndex}]`,
          message: `End index ${endIndex} is not assigned to any hook position.`,
          actual: endIndex,
        });
      }
    }
  }

  // Rule 7: exactly two distinct peg holes, each with its own position and diameter (R2.6, R2.7).
  const pegHoles = own(input, 'pegHoles');
  if (pegHoles === undefined) {
    reportMissing('pegHoles');
  } else if (!Array.isArray(pegHoles)) {
    report({ kind: 'peg-hole-count', location: 'pegHoles', message: 'The field "pegHoles" must be a list of exactly 2 peg holes.' });
  } else {
    if (pegHoles.length !== 2) {
      report({
        kind: 'peg-hole-count',
        location: 'pegHoles',
        message: `A card must have exactly 2 peg holes but the profile has ${pegHoles.length}.`,
        expected: 2,
        actual: pegHoles.length,
      });
    }
    const positions: Array<PointMm | undefined> = [];
    const diameters: Array<number | undefined> = [];
    for (let pegIndex = 0; pegIndex < pegHoles.length; pegIndex++) {
      const pegHole: unknown = pegHoles[pegIndex];
      const location = `pegHoles[${pegIndex}]`;
      if (!isRecord(pegHole)) {
        report({ kind: 'not-an-object', location, message: `${location} must be an object with positionMm and diameterMm.` });
        positions.push(undefined);
        diameters.push(undefined);
        continue;
      }
      positions.push(point(own(pegHole, 'positionMm'), `${location}.positionMm`));
      diameters.push(positiveNumber(pegHole, 'diameterMm', `${location}.diameterMm`));
    }
    if (pegHoles.length === 2) {
      const [first, second] = positions;
      if (first !== undefined && second !== undefined && first.x === second.x && first.y === second.y) {
        report({
          kind: 'peg-holes-coincide',
          location: 'pegHoles',
          message: 'The two peg holes must be at different positions.',
        });
      }
      // Rule 8: the diameters must differ by at least 10% of the larger (R2.8).
      const [a, b] = diameters;
      if (a !== undefined && b !== undefined) {
        const larger = Math.max(a, b);
        if (Math.abs(a - b) < MIN_PEG_DIAMETER_DIFFERENCE * larger * (1 - 1e-9)) {
          report({
            kind: 'peg-diameters-too-close',
            location: 'pegHoles',
            message: `The peg hole diameters ${a} mm and ${b} mm must differ by at least ${MIN_PEG_DIAMETER_DIFFERENCE * 100}% of the larger.`,
            expected: MIN_PEG_DIAMETER_DIFFERENCE * larger,
            actual: Math.abs(a - b),
          });
        }
      }
    }
  }

  return violations;
}

/** A profile is accepted exactly when validateCardProfile reports no violations (R2.1). */
export function parseCardProfile(input: unknown): Result<CardProfile> {
  const violations = validateCardProfile(input);
  if (violations.length > 0) return { ok: false, violations };
  return { ok: true, value: input as CardProfile };
}
