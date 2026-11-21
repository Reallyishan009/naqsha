import type { ReactNode } from 'react';
import styles from './Eyebrow.module.css';

export type EyebrowProps = {
  /** The label, already translated: a few words. */
  children: ReactNode;
};

/** A small spaced label with a hairline on each side. The hairlines are decoration and hidden from assistive technology. */
export function Eyebrow({ children }: EyebrowProps) {
  return (
    <p className={styles.eyebrow}>
      <span className={styles.rule} aria-hidden="true" />
      <span className={styles.text}>{children}</span>
      <span className={styles.rule} aria-hidden="true" />
    </p>
  );
}
