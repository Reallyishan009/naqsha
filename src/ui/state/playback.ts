import type { Pattern } from '../../codec/index.ts';
import type { Translate } from '../i18n/messages.ts';
import type { PlaybackState } from '../types.ts';

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

/**
 * How a cloth that the screen has not shown before is entered:
 * - `show-finished`: the design was already loaded when the screen arrived, so the finished cloth is shown at once;
 *   this is also what reduced motion gets for a new design (R14.9).
 * - `show-selected`: the design was already loaded and the other screen left `AppState.selectedPick` past pick 0, so
 *   the screen shows that pick, paused, with no replay from pick 0 (R4.2).
 * - `autoplay`: a design the visitor has just chosen, so the weave runs from the first pick (R14.8).
 * - `keep`: the same design rebuilt after a colour, zari, repeat or size change, so the current pick stays (R3.6).
 */
export type EntryMode = 'show-finished' | 'show-selected' | 'autoplay' | 'keep';

/**
 * Which entry a cloth gets. `entered` is the design the player was last entered with, null before the first one,
 * and `mounted` is the design that was already loaded when the screen arrived, with `mountedPick` the
 * `AppState.selectedPick` at that moment. At pick 0 the arrival shows the finished cloth; past it, that pick (R4.2).
 * `mountedFinished` says the cloth of the mounted design was finished when the screen arrived; that shows the finished
 * cloth even though `mountedPick` is then the last pick index, as a paused cloth would also have.
 * Designs are told apart by identity, as the application state replaces the whole Pattern for a new design.
 */
export function entryModeFor(
  pattern: Pattern,
  entered: Pattern | null,
  mounted: Pattern,
  mountedPick = 0,
  mountedFinished = false,
): EntryMode {
  if (entered === null) {
    if (pattern !== mounted) return 'autoplay';
    if (mountedFinished) return 'show-finished';
    return mountedPick > 0 ? 'show-selected' : 'show-finished';
  }
  return pattern === entered ? 'keep' : 'autoplay';
}

/** A playback status together with the pick its entry moves the player to. */
export type PlaybackEntry = PlaybackState & { pick: number };

/**
 * The pick the screen shows. A finished cloth is shown as its last pick woven, which is one past the last pick index;
 * `AppState.selectedPick` never goes that far, so the finished status says it (R4.2).
 */
export function shownPick(status: PlaybackState['status'], selectedPick: number, pickCount: number): number {
  return status === 'finished' ? pickCount : selectedPick;
}

/**
 * The status a newly shown cloth starts in, and the pick its entry moves the player to. The pick is dispatched as
 * `select-pick` once, when the cloth is entered. A cloth with no pick has no position but 0.
 */
export function entryPlayback(
  mode: EntryMode,
  previous: PlaybackState,
  selectedPick: number,
  pickCount: number,
  autoplays: boolean,
): PlaybackEntry {
  const count = Number.isInteger(pickCount) && pickCount > 0 ? pickCount : 0;
  if (count === 0) return { status: 'idle', pick: 0 };
  if (mode === 'autoplay') return autoplays ? { status: 'playing', pick: 0 } : { status: 'finished', pick: count };
  if (mode === 'show-finished') return { status: 'finished', pick: count };
  // Paused on the pick the other screen left, clamped to the last pick index; no autoplay and no replay (R4.2).
  if (mode === 'show-selected') return { status: 'paused', pick: Math.min(clampPick(selectedPick, count), count - 1) };
  const pick = clampPick(selectedPick, count);
  if (previous.status === 'playing') return { status: 'playing', pick };
  if (previous.status === 'paused') return { status: 'paused', pick };
  return { status: pick >= count || previous.status === 'finished' ? 'finished' : 'idle', pick };
}

/** A playback state together with the cloth it describes; `cloth` is null before any cloth has been shown. */
export type PlaybackAt<Cloth> = { cloth: Cloth | null; state: PlaybackState };

/**
 * The playback state the screen shows. While the cloth on screen is the one the stored state describes, that
 * state is shown. A cloth the player has not reported on yet is shown in its entry state instead, the very state
 * its entry puts the player in, so the pick counter and the player can never disagree and the counter can never
 * show a position of the design shown before it (R2.10).
 */
export function displayedPlayback<Cloth>(
  shown: Cloth | null,
  at: PlaybackAt<Cloth>,
  mode: EntryMode,
  selectedPick: number,
  pickCount: number,
  autoplays: boolean,
): PlaybackState {
  if (at.cloth === shown) return at.state;
  return entryPlayback(mode, at.state, selectedPick, pickCount, autoplays);
}

/** The alternative text of the cloth canvas; it names the pick and the total. */
export function canvasAltText(t: Translate, pick: number, pickCount: number): string {
  const { current, total } = pickLabel(pick, pickCount);
  return t('weave.canvasAlt', { pick: current, total });
}

/** The control that takes keyboard focus once the skip control has gone: Pause while playing, otherwise Play. */
export type FocusTarget = 'pause' | 'play';
export function focusTargetAfterSkip(status: PlaybackState['status']): FocusTarget {
  return status === 'playing' ? 'pause' : 'play';
}
/** Something that can take focus; a button element in the browser, a fake in tests. */
export type Focusable = { focus: () => void };
/** Moves focus to the control chosen by `focusTargetAfterSkip`. Returns the target, or null when its control is missing. */
export function focusAfterSkip(
  status: PlaybackState['status'],
  controls: { pause: Focusable | null; play: Focusable | null },
): FocusTarget | null {
  const target = focusTargetAfterSkip(status);
  const control = controls[target];
  if (control === null) return null;
  control.focus();
  return target;
}
