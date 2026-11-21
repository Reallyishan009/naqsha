import styles from './WeftProgress.module.css';

export type WeftProgressProps = {
  /** The statement of progress, already translated. It is the only text alternative, so the component has no role. */
  text: string;
};

/** Visible text and a weft drawn across a track. The text states the progress; the drawing is decoration. */
export function WeftProgress({ text }: WeftProgressProps) {
  return (
    <div className={styles.progress}>
      <p className={styles.text}>{text}</p>
      <svg className={styles.drawing} viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <rect className={styles.track} x="0" y="2" width="100" height="4" />
        <rect className={styles.weft} x="0" y="2" width="100" height="4" />
      </svg>
    </div>
  );
}
