export type PointMm = { x: number; y: number };

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
  pegHoles: { diameterMm: number; positionsMm: PointMm[] };
  lacingHoles: { diameterMm: number; positionsMm: PointMm[] };
};

/** The hole grid of one card (one pick): hookRows x hookColumns. true = punched = hook lifts. */
export type CardGrid = boolean[][];

/** A pattern is a list of cards, one per pick. */
export type Pattern = CardGrid[];
