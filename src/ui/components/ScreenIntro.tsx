import styles from './ScreenIntro.module.css';

export type ScreenIntroProps = {
  /** What the Screen is for: one sentence of at most 100 characters, already translated. */
  purpose: string;
  /** What to do next: one sentence of at most 100 characters, already translated. */
  next: string;
};

/** The purpose line and the next-step line under a Screen heading. */
export function ScreenIntro({ purpose, next }: ScreenIntroProps) {
  return (
    <div className={styles.intro}>
      <p className={styles.purpose}>{purpose}</p>
      <p className={styles.next}>{next}</p>
    </div>
  );
}
