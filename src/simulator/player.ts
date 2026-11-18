import { frameAt } from './frames.ts';
import { renderFrame } from './render.ts';
import type { Frame, PreparedCloth, RenderSettings, SimImage } from './types.ts';

/** Asks for one callback with a timestamp in ms, like requestAnimationFrame. cancel(id) drops a pending request. */
export type Scheduler = { request(cb: (timeMs: number) => void): number; cancel(id: number): void };

export type Player = {
  play(startPick: number, endPick: number, picksPerSecond: number): void;
  pause(): void;
  resume(): void;
  seek(pick: number): void;
  current(): Frame;
};

const sameFrame = (a: Frame, b: Frame): boolean =>
  a.pick === b.pick && a.phase === b.phase && (a.phase !== 'pass' || (b.phase === 'pass' && a.step === b.step));

/**
 * A player for one cloth (R7.3, R9.5, R10.3). The scheduler and the paint function are injected, so this file uses no
 * browser API and never reads a clock: time is the timestamp the scheduler passes to its callback.
 *
 * - play(startPick, endPick, picksPerSecond) records the range and rate and requests a tick. The first tick's
 *   timestamp is the start time. Each tick shows frameAt(elapsed); a frame equal to the last painted one is not
 *   painted again; once the frame is rest(endPick) no further tick is requested. An invalid rate paints rest(startPick)
 *   and finishes. play() restarts from elapsed 0 whatever the state.
 * - pause() cancels the pending request and keeps the elapsed time of the last tick (time between that tick and the
 *   pause is not counted, since there is no clock). resume() requests a tick whose timestamp re-bases the start time,
 *   so the elapsed time continues without a jump. resume() does nothing when playing, finished, failed, or never played.
 * - seek(pick) stops playback, floors a non-integer pick, clamps it to 0..slotCount, and paints renderFrame(rest(pick))
 *   at once. A later resume() plays from that pick to the earlier end pick at the earlier rate (elapsed 0), and does
 *   nothing if play() was never called; a later play() starts from its own arguments.
 * - If renderFrame fails, nothing is painted and playback stops; current() stays at the last good frame. If paint
 *   throws, playback stops the same way. The player never throws.
 * - At most one scheduler request is pending at any time.
 */
export function createPlayer(options: {
  cloth: PreparedCloth;
  settings: RenderSettings;
  paint: (image: SimImage) => void;
  scheduler: Scheduler;
}): Player {
  const { cloth, settings, paint, scheduler } = options;
  const slotCount = cloth.picks.length;
  const clamp = (value: number): number =>
    Number.isFinite(value) ? Math.min(slotCount, Math.max(0, Math.floor(value))) : 0;

  let startPick = 0;
  let endPick = 0;
  let rate = 0;
  let hasRange = false;
  let startTime: number | null = null; // set by the first tick after play or resume
  let elapsedMs = 0; // elapsed at the last tick
  let pendingId: number | null = null;
  let generation = 0; // a callback from an older request is ignored
  let finished = false;
  let failed = false;
  let paintedOnce = false; // false after play() until something is painted, so the first frame is always painted
  let lastFrame: Frame = { pick: 0, phase: 'rest' };

  const cancelPending = (): void => {
    generation++;
    if (pendingId !== null) {
      try {
        scheduler.cancel(pendingId);
      } catch {
        // a failing scheduler must not break the player
      }
      pendingId = null;
    }
  };

  // Renders and paints a frame. Returns false and records a failure when it could not.
  const show = (frame: Frame): boolean => {
    try {
      const result = renderFrame(cloth, settings, frame);
      if (!result.ok) {
        failed = true;
        return false;
      }
      paint(result.value);
      lastFrame = frame;
      return true;
    } catch {
      failed = true;
      return false;
    }
  };

  const requestTick = (): void => {
    const mine = ++generation;
    try {
      pendingId = scheduler.request((timeMs) => {
        if (mine === generation) tick(timeMs);
      });
    } catch {
      pendingId = null;
      failed = true;
    }
  };

  function tick(now: number): void {
    pendingId = null;
    if (startTime === null) startTime = now - elapsedMs;
    elapsedMs = now - startTime;
    const frame = frameAt(cloth, startPick, endPick, rate, elapsedMs);
    if (!sameFrame(frame, lastFrame) || !paintedOnce) {
      if (!show(frame)) return;
      paintedOnce = true;
    }
    const rateValid = Number.isFinite(rate) && rate > 0;
    if (!rateValid || (frame.phase === 'rest' && frame.pick === endPick)) {
      finished = true;
      return;
    }
    requestTick();
  }

  return {
    play(start, end, picksPerSecond) {
      cancelPending();
      startPick = clamp(start);
      endPick = Math.max(startPick, clamp(end));
      rate = picksPerSecond;
      hasRange = true;
      startTime = null;
      elapsedMs = 0;
      finished = false;
      failed = false;
      paintedOnce = false;
      requestTick();
    },
    pause() {
      cancelPending();
      startTime = null;
    },
    resume() {
      if (!hasRange || finished || failed || pendingId !== null) return;
      startTime = null;
      requestTick();
    },
    seek(pick) {
      cancelPending();
      const target = clamp(pick);
      startPick = target;
      endPick = Math.max(target, endPick);
      startTime = null;
      elapsedMs = 0;
      finished = false;
      failed = false;
      paintedOnce = false;
      if (show({ pick: target, phase: 'rest' })) paintedOnce = true;
    },
    current() {
      return lastFrame;
    },
  };
}
