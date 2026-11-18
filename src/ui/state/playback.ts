import type { Translate } from '../i18n/messages.ts';

/** Picks per second for the three speeds: slow, normal, fast (design: Playback speeds). */
export const SPEEDS: readonly [number, number, number] = [1, 4, 12];

function clampPick(value: number, pickCount: number): number {
  const last = Number.isInteger(pickCount) && pickCount > 0 ? pickCount : 0;
  if (Number.isNaN(value)) return 0;
  return Math.min(last, Math.max(0, Math.round(value)));
}

/** The pick after the given one, within 0..pickCount. */
export function stepForward(pick: number, pickCount: number): number {
  return clampPick(clampPick(pick, pickCount) + 1, pickCount);
}

/** The pick before the given one, within 0..pickCount. */
export function stepBack(pick: number, pickCount: number): number {
  return clampPick(clampPick(pick, pickCount) - 1, pickCount);
}

/** Turns a scrubber value (any number, NaN included) into an integer pick within 0..pickCount. */
export function scrubTo(value: number, pickCount: number): number {
  return clampPick(value, pickCount);
}

/** The one-based pick shown to the user and the total. At pick = pickCount (finished) the current pick is the total. */
export function pickLabel(pick: number, pickCount: number): { current: number; total: number } {
  const total = Number.isInteger(pickCount) && pickCount > 0 ? pickCount : 0;
  return { current: Math.min(total, clampPick(pick, total) + 1), total };
}

/** The pick position text, for example "Pick 3 of 36". */
export function pickPositionText(t: Translate, pick: number, pickCount: number): string {
  const { current, total } = pickLabel(pick, pickCount);
  return t('weave.pickPosition', { pick: current, total });
}

/** The alternative text of the cloth canvas; it names the pick and the total. */
export function canvasAltText(t: Translate, pick: number, pickCount: number): string {
  const { current, total } = pickLabel(pick, pickCount);
  return t('weave.canvasAlt', { pick: current, total });
}
