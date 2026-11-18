export type PointMm = { x: number; y: number };

/** A fixed alignment hole. Not part of the pattern. */
export type PegHole = { positionMm: PointMm; diameterMm: number };

/**
 * The physical layout of a card, loaded at runtime from a profile file.
 * Looms differ, so nothing in src/codec or src/reader may hard-code these
 * values. See .kiro/steering/card-geometry.md.
 */
export type CardProfile = {
  name: string;
  status?: string;
  cardWidthMm: number;
  cardHeightMm: number;
  hookRows: number;
  hookColumns: number;
  holeDiameterMm: number;
  horizontalPitchMm: number;
  verticalPitchMm: number;
  firstHoleCentreMm: PointMm;
  /** endOrder[hookRow][hookColumn] = end index, a permutation of 0..hookRows*hookColumns-1. */
  endOrder: number[][];
  /** Exactly two peg holes with different diameters. */
  pegHoles: [PegHole, PegHole];
  lacingHoles: { diameterMm: number; positionsMm: PointMm[] };
};

/** The hole grid of one card (one pick): hookRows x hookColumns. true = punched = hook lifts. */
export type CardGrid = boolean[][];

/** A pattern is a list of cards, one per pick. */
export type Pattern = CardGrid[];

/** Length hookRows * hookColumns; ends[endIndex] is true when that end lifts. */
export type Ends = boolean[];

export type ViolationKind =
  | 'not-an-object' | 'missing-field' | 'not-a-string'
  | 'not-a-positive-integer' | 'not-a-positive-number' | 'hole-outside-card'
  | 'end-order-shape' | 'end-order-duplicate' | 'end-order-unassigned' | 'end-order-out-of-range'
  | 'peg-hole-count' | 'peg-holes-coincide' | 'peg-diameters-too-close'
  | 'not-an-array' | 'wrong-hook-row-count' | 'wrong-hook-column-count' | 'not-a-boolean'
  | 'wrong-ends-length';

export type Violation = {
  kind: ViolationKind;
  /** Where the problem is, for example "hookRows", "endOrder[3][5]", "grid[2]", "ends[17]". */
  location: string;
  message: string;
  expected?: number;
  actual?: number;
};

export type Result<T> = { ok: true; value: T } | { ok: false; violations: Violation[] };
