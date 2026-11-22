import { useEffect, useState } from 'react';

/** The two timer functions the delay needs; a test passes a fake clock instead of the browser's. */
export type Timers = {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

/** How long an operation runs before a WeftProgress appears. */
export const PROGRESS_DELAY_MS = 300;

export const browserTimers: Timers = {
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Runs `onElapsed` once after `ms`. The returned function cancels it; calling it after the timer fired does nothing. */
export function startDelay(ms: number, onElapsed: () => void, timers: Timers): () => void {
  let live = true;
  const handle = timers.setTimeout(() => {
    if (!live) return;
    live = false;
    onElapsed();
  }, ms);
  return () => {
    if (!live) return;
    live = false;
    timers.clearTimeout(handle);
  };
}

/** True once `active` has been true for `ms`; false again as soon as `active` is false. */
export function useAfterDelay(active: boolean, ms: number = PROGRESS_DELAY_MS, timers: Timers = browserTimers): boolean {
  const [elapsed, setElapsed] = useState(false);
  useEffect(() => {
    if (!active) {
      setElapsed(false);
      return undefined;
    }
    return startDelay(ms, () => setElapsed(true), timers);
  }, [active, ms, timers]);
  return active && elapsed;
}
