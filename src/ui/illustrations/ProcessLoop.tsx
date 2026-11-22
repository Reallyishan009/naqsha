import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { CardProfile, Pattern } from '../../codec/index.ts';
import { browserScheduler } from '../../simulator/index.ts';
import type { Scheduler } from '../../simulator/index.ts';
import type { Translate } from '../i18n/messages.ts';
import { Button } from '../components/Button.tsx';
import { createProcessLoop } from './processLoop.ts';
import type { ProcessLoopControls } from './processLoop.ts';
import { PAINT_SCALE, browserPainterDeps, createPainter } from './processPaint.ts';
import { buildProcessScene } from './processScene.ts';
import styles from './ProcessLoop.module.css';

/** Tells `onChange` whether the element is on screen; returns a function that stops watching. */
export type ObserveVisibility = (element: Element, onChange: (visible: boolean) => void) => () => void;

/**
 * Watches an element with IntersectionObserver. Where the browser has none the picture counts as visible and
 * nothing is watched, so it still plays.
 */
export const browserObserve: ObserveVisibility = (element, onChange) => {
  if (typeof IntersectionObserver === 'undefined') return () => undefined;
  const observer = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    if (entry !== undefined) onChange(entry.isIntersecting);
  });
  observer.observe(element);
  return () => observer.disconnect();
};

export type ProcessLoopProps = {
  /** A valid Card_Profile. A profile that fails validation draws nothing. */
  profile: CardProfile;
  /** The Pattern whose first picks are woven: a card slides in for each, its hooks lift, a pick of cloth is added. */
  pattern: Pattern;
  /** True under Reduced_Motion: one still picture of the finished cloth and no pause button. */
  reducedMotion: boolean;
  /** A smaller picture, for the cloth view: fewer canvas pixels. */
  compact?: boolean;
  className?: string;
  t: Translate;
  /** Injected so tests can drive time; the browser uses requestAnimationFrame. */
  scheduler?: Scheduler;
  /** Injected so tests can say when the picture is on screen; the browser uses IntersectionObserver. */
  observe?: ObserveVisibility;
};

/**
 * A live picture of what the app does, drawn on a canvas with the real code: a card slides into the Jacquard head,
 * its punched holes light, the hooks of those punched holes lift (the layout of the Hero_Loom), a weft passes and a pick of
 * cloth from the simulator is added; then it loops, in a seven second cycle. It carries no image file. It pauses when
 * it is off screen and when the user presses the pause button, and under Reduced_Motion it shows the finished cloth
 * once and never moves.
 */
export function ProcessLoop({ profile, pattern, reducedMotion, compact = false, className, t, scheduler = browserScheduler, observe = browserObserve }: ProcessLoopProps) {
  const ids = useId().replace(/[^A-Za-z0-9]/g, '');
  const result = useMemo(() => buildProcessScene(profile, pattern), [profile, pattern]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const figureRef = useRef<HTMLElement | null>(null);
  const controlsRef = useRef<ProcessLoopControls | null>(null);
  const [paused, setPaused] = useState(false);
  const scene = result.ok ? result.scene : null;

  useEffect(() => {
    const canvas = canvasRef.current;
    const figure = figureRef.current;
    if (scene === null || canvas === null || figure === null) return undefined;
    const painter = createPainter(scene, browserPainterDeps(canvas));
    if (painter === null) return undefined;
    const controls = createProcessLoop({ scene, paint: painter.paint, scheduler, reducedMotion });
    controlsRef.current = controls;
    setPaused(false);
    controls.start();
    const stopWatching = reducedMotion ? () => undefined : observe(figure, (visible) => controls.setVisible(visible));
    // A change of theme changes the tokens: read them again and draw the picture that is showing.
    const themeWatch = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
      painter.refresh();
      controls.redraw();
    });
    themeWatch?.observe(canvas.ownerDocument.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      themeWatch?.disconnect();
      stopWatching();
      controls.dispose();
      controlsRef.current = null;
    };
  }, [scene, scheduler, reducedMotion, observe]);

  if (scene === null) return null;

  const titleId = `processTitle${ids}`;
  const descId = `processDesc${ids}`;
  const scale = compact ? PAINT_SCALE * 0.6 : PAINT_SCALE;
  const width = Math.round(scene.units.width * scale);
  const height = Math.round(scene.units.height * scale);
  const description = reducedMotion ? t('processLoop.desc.still', { picks: scene.count }) : t('processLoop.desc', { picks: scene.count });

  function toggle(): void {
    const controls = controlsRef.current;
    if (controls === null) return;
    if (controls.isPaused()) controls.resume();
    else controls.pause();
    setPaused(controls.isPaused());
  }

  return (
    <figure ref={figureRef} className={`${styles.loop} ${className ?? ''}`.trim()} data-process-loop="" data-motion={reducedMotion ? 'still' : paused ? 'paused' : 'play'}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        width={width}
        height={height}
        role="img"
        aria-labelledby={titleId}
        aria-describedby={descId}
      />
      <span id={titleId} className={styles.visuallyHidden}>
        {t('processLoop.title')}
      </span>
      <p id={descId} className={styles.visuallyHidden}>
        {description}
      </p>
      {reducedMotion ? null : (
        <div className={styles.bar}>
          <Button onClick={toggle}>{paused ? t('processLoop.play') : t('processLoop.pause')}</Button>
        </div>
      )}
    </figure>
  );
}
