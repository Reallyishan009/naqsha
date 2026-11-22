import { validateCardGrid, validateCardProfile } from '../../codec/index.ts';
import type { CardGrid, CardProfile, PointMm } from '../../codec/index.ts';
import { hookCentreMm } from '../printable/layout.ts';
import type { Disc } from '../printable/layout.ts';

/**
 * Everything a card drawing needs from a Card_Profile, in millimetres from the top-left corner of the card.
 * Every number is read from the profile; this file holds no card dimension.
 */
export type CardGeometry = {
  widthMm: number;
  heightMm: number;
  hookCentres: PointMm[][]; // [hookRow][hookColumn], from hookCentreMm(profile, hookRow, hookColumn)
  holeDiameterMm: number;
  pegHoles: [Disc, Disc]; // each with its own diameter
  lacingHoles: Disc[];
};

/** One punched hook position of a card grid, with the centre the profile gives it. */
export type PunchedHook = { hookRow: number; hookColumn: number; centreMm: PointMm };

/**
 * The geometry of a card from a Card_Profile, or `{ ok: false }` when the profile fails `validateCardProfile`.
 * Pure, and it never throws for any input.
 */
export function cardGeometry(profile: unknown): { ok: true; geometry: CardGeometry } | { ok: false } {
  if (validateCardProfile(profile).length > 0) return { ok: false };
  const valid = profile as CardProfile;
  const hookCentres: PointMm[][] = [];
  for (let hookRow = 0; hookRow < valid.hookRows; hookRow++) {
    const hookRowCentres: PointMm[] = [];
    for (let hookColumn = 0; hookColumn < valid.hookColumns; hookColumn++) {
      hookRowCentres.push(hookCentreMm(valid, hookRow, hookColumn));
    }
    hookCentres.push(hookRowCentres);
  }
  const [firstPeg, secondPeg] = valid.pegHoles;
  return {
    ok: true,
    geometry: {
      widthMm: valid.cardWidthMm,
      heightMm: valid.cardHeightMm,
      hookCentres,
      holeDiameterMm: valid.holeDiameterMm,
      pegHoles: [
        { centreMm: { ...firstPeg.positionMm }, diameterMm: firstPeg.diameterMm },
        { centreMm: { ...secondPeg.positionMm }, diameterMm: secondPeg.diameterMm },
      ],
      lacingHoles: valid.lacingHoles.positionsMm.map((positionMm) => ({
        centreMm: { ...positionMm },
        diameterMm: valid.lacingHoles.diameterMm,
      })),
    },
  };
}

/**
 * The punched hook positions of `grid`, hook row by hook row, or null when `validateCardGrid(profile, grid)`
 * reports any violation (the grid does not match the profile). Never throws.
 */
export function punchedHooks(profile: CardProfile, geometry: CardGeometry, grid: unknown): PunchedHook[] | null {
  if (validateCardGrid(profile, grid).length > 0) return null;
  const matching = grid as CardGrid;
  const punched: PunchedHook[] = [];
  for (let hookRow = 0; hookRow < geometry.hookCentres.length; hookRow++) {
    const hookRowCentres = geometry.hookCentres[hookRow]!;
    for (let hookColumn = 0; hookColumn < hookRowCentres.length; hookColumn++) {
      if (matching[hookRow]![hookColumn] === true) {
        punched.push({ hookRow, hookColumn, centreMm: hookRowCentres[hookColumn]! });
      }
    }
  }
  return punched;
}
