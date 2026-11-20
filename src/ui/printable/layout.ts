import { parseCardProfile, validateCardGrid } from '../../codec/index.ts';
import type { CardGrid, CardProfile, PointMm, Result } from '../../codec/index.ts';

export type Disc = { centreMm: PointMm; diameterMm: number };
export type HookMark = Disc & { hookRow: number; hookColumn: number; punched: boolean };
export type PrintableLayout = {
  widthMm: number;
  heightMm: number;
  hookMarks: HookMark[]; // hookRows * hookColumns, hook row by hook row
  pegHoles: [Disc, Disc];
  lacingHoles: Disc[];
};

/**
 * Centre of one hook position in millimetres from the top-left corner of the card.
 * Repeats the formula of src/reader/sampling.ts: Property 37 detects any disagreement.
 */
export function hookCentreMm(profile: CardProfile, hookRow: number, hookColumn: number): PointMm {
  return {
    x: profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm,
    y: profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm,
  };
}

/**
 * The one source of geometry for the printable SVG and raster (R21.12).
 * Validates the profile and the grid and returns the violations, with no layout, when either is invalid (R21.17).
 */
export function printableLayout(profileInput: unknown, gridInput: unknown): Result<PrintableLayout> {
  const parsed = parseCardProfile(profileInput);
  if (!parsed.ok) return parsed;
  const profile = parsed.value;
  const violations = validateCardGrid(profile, gridInput);
  if (violations.length > 0) return { ok: false, violations };
  const grid = gridInput as CardGrid;

  const hookMarks: HookMark[] = [];
  for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
    for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
      hookMarks.push({
        centreMm: hookCentreMm(profile, hookRow, hookColumn),
        diameterMm: profile.holeDiameterMm,
        hookRow,
        hookColumn,
        punched: grid[hookRow]![hookColumn]!,
      });
    }
  }
  const [firstPeg, secondPeg] = profile.pegHoles;
  return {
    ok: true,
    value: {
      widthMm: profile.cardWidthMm,
      heightMm: profile.cardHeightMm,
      hookMarks,
      pegHoles: [
        { centreMm: { ...firstPeg.positionMm }, diameterMm: firstPeg.diameterMm },
        { centreMm: { ...secondPeg.positionMm }, diameterMm: secondPeg.diameterMm },
      ],
      lacingHoles: profile.lacingHoles.positionsMm.map((positionMm) => ({
        centreMm: { ...positionMm },
        diameterMm: profile.lacingHoles.diameterMm,
      })),
    },
  };
}
