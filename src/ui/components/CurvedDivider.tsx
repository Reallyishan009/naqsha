import styles from './CurvedDivider.module.css';

export type CurvedDividerProps = {
  /** Layout only (where it sits). The fill is the colour of the section below: set `--divider-fill` on this element or an ancestor; it defaults to the page ground. */
  className?: string;
};

/**
 * A soft wave that closes the section above it and hands over to the next one. It is a drawing with no meaning, so it
 * is hidden from assistive technology and cannot take focus. It stretches to the width it is given.
 */
export function CurvedDivider({ className }: CurvedDividerProps) {
  const classes = className === undefined || className === '' ? styles.divider : `${styles.divider} ${className}`;
  return (
    <svg className={classes} viewBox="0 0 1440 72" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className={styles.fill} d="M0 44 C 320 6, 660 6, 980 34 S 1290 62, 1440 24 V72 H0 Z" />
    </svg>
  );
}
