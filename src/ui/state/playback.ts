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

/** Whether the first weave of a design is rising out of darkness (R20.2). */
export type RiseState = 'off' | 'running';

export type RiseEvent =
  | { type: 'design-loaded'; reducedMotion: boolean }
  | { type: 'finished' }
  | { type: 'skip' }
  | { type: 'seek' }
  | { type: 'cleared' };

/**
 * The effect starts only when a design is loaded and reduced motion is off (R20.4). It ends on finish, skip, or a
 * step or scrub. Nothing else (replay, colour change, pause) starts it again, so it runs once per design (R20.2).
 */
export function riseReducer(state: RiseState, event: RiseEvent): RiseState {
  switch (event.type) {
    case 'design-loaded':
      return event.reducedMotion ? 'off' : 'running';
    case 'finished':
    case 'skip':
    case 'seek':
    case 'cleared':
      return 'off';
    default: {
      const unreachable: never = event;
      return unreachable;
    }
  }
}

/** How far the weave has come, from 0 to 1. An empty cloth counts as done. */
export function riseFraction(pick: number, pickCount: number): number {
  if (!Number.isInteger(pickCount) || pickCount <= 0) return 1;
  return Math.min(1, Math.max(0, clampPick(pick, pickCount) / pickCount));
}

/**
 * The brightness of the cloth canvas, from 0 (dark) to 1 (full colour). It never decreases as the fraction grows and
 * reaches 1 at fraction 1. It is 1 once skipped and always 1 under reduced motion (R20.2, R20.4).
 */
export function riseLevel(fraction: number, skipped: boolean, reducedMotion: boolean): number {
  if (skipped || reducedMotion) return 1;
  if (Number.isNaN(fraction)) return 0;
  const x = Math.min(1, Math.max(0, fraction));
  return x * x * (3 - 2 * x);
}

/** The alternative text of the cloth canvas; it names the pick and the total. */
export function canvasAltText(t: Translate, pick: number, pickCount: number): string {
  const { current, total } = pickLabel(pick, pickCount);
  return t('weave.canvasAlt', { pick: current, total });
}
