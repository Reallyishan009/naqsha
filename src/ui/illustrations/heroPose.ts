import {
  encodeCardGrid,
  endsPerPick,
  validateCardGrid,
  type CardGrid,
  type CardProfile,
  type Pattern,
} from '../../codec/index.ts';

/** The pose of the Hero_Loom: the lifted ends of one pick, or a plain loom with nothing raised. */
export type HeroPose =
  | { kind: 'plain' }
  | {
      kind: 'lifted';
      /** Index of the first pick that has at least one punched hook position. */
      pickIndex: number;
      grid: CardGrid;
      /** The ends that lift, in increasing order. One per punched hook position of the pick. */
      liftedEnds: number[];
      endsPerPick: number;
    };

const PLAIN: HeroPose = { kind: 'plain' };

/** True when the pick looks like it has a punched hook position, whatever its shape. Never throws. */
function hasPunchedHole(pick: unknown): boolean {
  return Array.isArray(pick) && pick.some((hookRow: unknown) => Array.isArray(hookRow) && hookRow.some((punchedHole: unknown) => punchedHole === true));
}

/**
 * Picks what the Hero_Loom shows: the first pick of the pattern with a punched hook position, checked with
 * validateCardGrid and encoded with encodeCardGrid, so each lifted end is the end its hook position maps to.
 * Returns `plain` when no pick qualifies, the pick does not match the profile, or encoding fails.
 * Never throws and never changes its input. The profile must already be valid.
 */
export function heroPose(profile: CardProfile, pattern: Pattern): HeroPose {
  if (!Array.isArray(pattern)) return PLAIN;
  const pickIndex = pattern.findIndex(hasPunchedHole);
  if (pickIndex < 0) return PLAIN;

  const grid = pattern[pickIndex];
  if (validateCardGrid(profile, grid).length > 0) return PLAIN;
  const encoded = encodeCardGrid(profile, grid);
  if (!encoded.ok) return PLAIN;

  const liftedEnds: number[] = [];
  encoded.value.forEach((lifted, endIndex) => {
    if (lifted) liftedEnds.push(endIndex);
  });
  return { kind: 'lifted', pickIndex, grid: grid as CardGrid, liftedEnds, endsPerPick: endsPerPick(profile) };
}
