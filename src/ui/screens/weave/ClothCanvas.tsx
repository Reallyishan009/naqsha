import type { Ref } from 'react';
import { createPlayer } from '../../../simulator/index.ts';
import type { Frame, Player, Scheduler, SimImage } from '../../../simulator/index.ts';
import type { ReadyCloth } from '../../types.ts';
import styles from './WeaveScreen.module.css';

/** What the screen is told after the player shows a frame. `atEnd` is true when the last pick of the cloth is woven. */
export type FrameReport = { frame: Frame; kind: 'tick' | 'seek'; atEnd: boolean };

/**
 * A simulator player that also reports every frame it shows, so the screen can keep its pick text and play state in
 * step. The scheduler and paint function are injected, so this runs in Node with a fake scheduler.
 */
export function createClothPlayer(options: {
  ready: ReadyCloth;
  paint: (image: SimImage) => void;
  scheduler: Scheduler;
  onFrame: (report: FrameReport) => void;
}): Player {
  const { ready, paint, scheduler, onFrame } = options;
  const pickCount = ready.cloth.picks.length;
  let endPick = pickCount;
  // The inner player is assigned below. Scheduler callbacks run later, so it exists by the time they use it.
  let inner: Player | null = null;
  const report = (kind: FrameReport['kind']): void => {
    if (inner === null) return;
    const frame = inner.current();
    const atEnd = kind === 'seek' ? frame.pick >= pickCount : frame.phase === 'rest' && frame.pick >= endPick;
    onFrame({ frame, kind, atEnd });
  };
  inner = createPlayer({
    cloth: ready.cloth,
    settings: ready.settings,
    paint,
    scheduler: {
      request: (callback) =>
        scheduler.request((timeMs) => {
          callback(timeMs);
          report('tick');
        }),
      cancel: (id) => scheduler.cancel(id),
    },
  });
  const player = inner;
  return {
    play(startPick, end, picksPerSecond) {
      endPick = end;
      player.play(startPick, end, picksPerSecond);
    },
    pause: () => player.pause(),
    resume: () => player.resume(),
    seek(pick) {
      player.seek(pick);
      report('seek');
    },
    current: () => player.current(),
  };
}

export type ClothCanvasProps = {
  width: number;
  height: number;
  altText: string;
  canvasRef: Ref<HTMLCanvasElement>;
};

/** The cloth canvas. Its pixel size is the cloth viewport; CSS shrinks it to the available width. */
export function ClothCanvas({ width, height, altText, canvasRef }: ClothCanvasProps) {
  return (
    <canvas
      ref={canvasRef}
      className={styles.canvas}
      width={width}
      height={height}
      role="img"
      aria-label={altText}
    />
  );
}
