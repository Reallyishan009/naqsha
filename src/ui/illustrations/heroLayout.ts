import { endsPerPick, type CardProfile } from '../../codec/index.ts';

/*
 * Drawing units of the Hero_Loom illustration. They size the picture on its own viewBox and are not
 * card dimensions: every count and every proportion that belongs to the card comes from the profile.
 */

/** Space round the drawing, and the x of end 0. */
export const MARGIN_UNITS = 8;
/** Distance between the x of two neighbouring ends. */
export const END_PITCH_UNITS = 4;
/** How far a raised hook and a lifted end rise. Must stay below HOOK_UNITS so a raised hook stays in its band. */
export const LIFT_UNITS = 30;
/** How far the card moves down to press on the needles. */
export const PRESS_UNITS = 10;

/** Height of the Jacquard head frame. */
export const HEAD_UNITS = 28;
/** Height of the needles under the card. */
export const NEEDLE_UNITS = 36;
/** Height of the band the hooks hang in. */
export const HOOK_UNITS = 80;
/** Height of the warp ends under the hooks. */
export const WARP_UNITS = 200;

/** A box in viewBox units. */
export type HeroBox = { x: number; y: number; width: number; height: number };

export type HeroLayout = {
  /** Size of the viewBox, with its origin at 0, 0. */
  viewBox: { width: number; height: number };
  /** width / height of the viewBox, for the box that holds the picture. */
  aspect: number;
  /** The Jacquard head frame. */
  head: HeroBox;
  /** The card, with the aspect ratio of the profile's card. It spans every end. */
  card: HeroBox;
  /** The needles, from the card down to the hooks. */
  needles: HeroBox;
  /** The band the hooks hang in. */
  hooks: HeroBox;
  /** The band the warp ends run through. */
  warp: HeroBox;
  /** endX[i] is the x of end i: MARGIN_UNITS + i * END_PITCH_UNITS. One entry per end. */
  endX: number[];
};

/**
 * The layout of the Hero_Loom for a card profile: one hook and one warp end at the x of each end of a pick,
 * and a card box whose height follows the profile's card aspect ratio. The profile must already be valid.
 */
export function heroLayout(profile: CardProfile): HeroLayout {
  const endCount = endsPerPick(profile);
  const endX = Array.from({ length: endCount }, (_, endIndex) => MARGIN_UNITS + endIndex * END_PITCH_UNITS);

  const innerWidth = endCount * END_PITCH_UNITS;
  const width = innerWidth + 2 * MARGIN_UNITS;
  const cardHeight = innerWidth * (profile.cardHeightMm / profile.cardWidthMm);

  const head: HeroBox = { x: MARGIN_UNITS, y: MARGIN_UNITS, width: innerWidth, height: HEAD_UNITS };
  const card: HeroBox = { x: MARGIN_UNITS, y: head.y + head.height, width: innerWidth, height: cardHeight };
  // The card presses down by PRESS_UNITS, so the needles start that far below it.
  const needles: HeroBox = { x: MARGIN_UNITS, y: card.y + card.height + PRESS_UNITS, width: innerWidth, height: NEEDLE_UNITS };
  const hooks: HeroBox = { x: MARGIN_UNITS, y: needles.y + needles.height, width: innerWidth, height: HOOK_UNITS };
  const warp: HeroBox = { x: MARGIN_UNITS, y: hooks.y + hooks.height, width: innerWidth, height: WARP_UNITS };
  const height = warp.y + warp.height + MARGIN_UNITS;

  return { viewBox: { width, height }, aspect: width / height, head, card, needles, hooks, warp, endX };
}
