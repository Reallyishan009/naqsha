import { Frame } from './Drawing.tsx';
import type { DrawingProps } from './Drawing.tsx';
import { STROKE } from './strokes.ts';
import styles from './Drawings.module.css';

/**
 * The three Step_Icons of the Landing Step_Strip, one per step. Each sits beside a label that states the step, so it
 * is decoration by default. They are drawn on a 48 by 48 sheet, a little off true as if by hand.
 */
const VIEW_BOX = '0 0 48 48';

/** Scan a card: a card with a notched corner, held inside four corner brackets. */
export function ScanStepIcon(props: DrawingProps) {
  return (
    <Frame kind="step" viewBox={VIEW_BOX} props={props} name="step-scan">
      <path className={styles.accent} d="M4 14V6.5Q4 4 6.5 4H14M34 4H41.5Q44 4 44 6.5V14M44 34V41.5Q44 44 41.5 44H34M14 44H6.5Q4 44 4 41.5V34" />
      <path d="M20 12L32.5 11.8Q33.5 12 33.4 13L33.6 35Q33.5 36.3 32.4 36.3L15.8 36.4Q14.8 36.3 14.8 35.3L14.9 17.2Z" />
      <g strokeWidth={STROKE.fine}>
        <circle cx="20.2" cy="22" r="1.6" />
        <circle cx="28" cy="21.6" r="1.6" />
        <circle cx="24" cy="27" r="1.6" />
        <circle cx="20" cy="31.6" r="1.6" />
        <circle cx="28.2" cy="31.4" r="1.6" />
      </g>
    </Frame>
  );
}

/** Watch it weave: four warp ends, one weft going over and under them, and the shuttle that carries it. */
export function WeaveStepIcon(props: DrawingProps) {
  return (
    <Frame kind="step" viewBox={VIEW_BOX} props={props} name="step-weave">
      <g strokeWidth={STROKE.fine}>
        <path d="M7 6.5V41.5M15.2 6V42M23 6.4V41.6M31 6V42" />
      </g>
      <path className={styles.accent} d="M3 24C5 20 9 20 11 24S17 28 19 24S25 20 27 24S33 28 35 24" />
      <path d="M35 24Q40.5 16.5 46 24Q40.5 31.5 35 24Z" />
      <path strokeWidth={STROKE.fine} d="M38 24H43" />
    </Frame>
  );
}

/** Keep the design: a folder with a tick on it and a folded design sheet standing up behind its edge. */
export function KeepStepIcon(props: DrawingProps) {
  return (
    <Frame kind="step" viewBox={VIEW_BOX} props={props} name="step-keep">
      <path d="M27 16V7Q27 5.5 28.5 5.5H35.5L40 10V16" />
      <path strokeWidth={STROKE.fine} d="M35.5 5.5V9.5Q35.5 10 36 10H40" />
      <path d="M6 18.5Q6 16 8.5 16H40Q42 16 42 18V38Q42 40.5 39.5 40.5H8.5Q6 40.5 6 38Z" />
      <path d="M6 16V11.5Q6 9.8 8 9.8H17.5L21 16" />
      <path className={styles.accent} d="M16.5 28.5L22 34L32.5 23" />
    </Frame>
  );
}
