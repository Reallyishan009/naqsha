import type { Scheduler } from '../../simulator/index.ts';
import { poseAt, stillPose } from './processScene.ts';
import type { ProcessPose, ProcessScene } from './processScene.ts';

/** The longest step of time one tick may count, so a tab that was in the background does not jump ahead. */
export const MAX_STEP_MS = 100;

export type ProcessLoopOptions = {
  scene: ProcessScene;
  /** Draws one pose. */
  paint: (pose: ProcessPose) => void;
  /** requestAnimationFrame in the browser, a fake in tests. */
  scheduler: Scheduler;
  /** True under Reduced_Motion: one still picture, nothing moves, no tick is ever requested. */
  reducedMotion: boolean;
};

export type ProcessLoopControls = {
  /** Draws the first picture (the still one under Reduced_Motion) and starts running when it may. */
  start(): void;
  /** The user's pause. */
  pause(): void;
  resume(): void;
  /** Whether the picture is on screen. The loop runs only while it is. Starts as true. */
  setVisible(visible: boolean): void;
  /** True while a tick is requested. */
  isRunning(): boolean;
  /** True after pause() and before resume(). */
  isPaused(): boolean;
  /** Time into the cycle that the next picture will show, in milliseconds. */
  elapsedMs(): number;
  /** Draws the current picture again, for example after a colour change. */
  redraw(): void;
  /** Stops for good and drops the pending request. */
  dispose(): void;
};

/**
 * The clock of the Process_Loop. It counts only the time it was running (the difference between two tick timestamps,
 * at most MAX_STEP_MS), so pausing, hiding and resuming never jump. It runs only when it is started, not paused by the
 * user, on screen and not under Reduced_Motion. It reads no clock and uses no browser API.
 */
export function createProcessLoop(options: ProcessLoopOptions): ProcessLoopControls {
  const { scene, paint, scheduler, reducedMotion } = options;
  let started = false;
  let disposed = false;
  let paused = false;
  let visible = true;
  let elapsed = 0;
  let lastTime: number | null = null;
  let pending: number | null = null;

  const shouldRun = (): boolean => started && !disposed && !reducedMotion && !paused && visible;
  const draw = (): void => paint(reducedMotion ? stillPose(scene) : poseAt(scene, elapsed));

  function tick(timeMs: number): void {
    pending = null;
    if (!shouldRun()) return;
    const step = lastTime === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, timeMs - lastTime));
    lastTime = timeMs;
    elapsed += step;
    draw();
    update();
  }

  function update(): void {
    if (shouldRun()) {
      if (pending === null) pending = scheduler.request(tick);
    } else {
      if (pending !== null) scheduler.cancel(pending);
      pending = null;
      lastTime = null;
    }
  }

  return {
    start() {
      if (started || disposed) return;
      started = true;
      draw();
      update();
    },
    pause() {
      paused = true;
      update();
    },
    resume() {
      paused = false;
      update();
    },
    setVisible(next) {
      visible = next;
      update();
    },
    isRunning: () => pending !== null,
    isPaused: () => paused,
    elapsedMs: () => elapsed,
    redraw() {
      if (started && !disposed) draw();
    },
    dispose() {
      disposed = true;
      update();
    },
  };
}
