import type { KeyboardEventHandler, ReactNode } from 'react';
import styles from './Panel.module.css';

export type PanelProps = {
  as?: 'div' | 'section';
  /** Layout only (margin, width); a Panel's fill and border come from its own module. */
  className?: string;
  role?: 'group';
  'aria-label'?: string;
  'aria-labelledby'?: string;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  children: ReactNode;
};

/** An opaque sheet (--surface, alpha 1) with a 1px --line border, so the Graph_Paper_Ground never shows through text. */
export function Panel({ as: Element = 'div', className, role, 'aria-label': label, 'aria-labelledby': labelledBy, onKeyDown, children }: PanelProps) {
  const classes = className === undefined || className === '' ? styles.panel : `${styles.panel} ${className}`;
  return (
    <Element className={classes} role={role} aria-label={label} aria-labelledby={labelledBy} onKeyDown={onKeyDown}>
      {children}
    </Element>
  );
}
