import type { ReactNode } from 'react';
import styles from './Field.module.css';

export type FieldProps = {
  label: string;
  children: ReactNode;
  /** Layout only (width, flex); a Field's colours and borders come from its own module. */
  className?: string;
  /** `primary` gives the native file-chooser button of a file input the primary Button look. */
  emphasis?: 'primary';
};

/** `<label><span>{label}</span>{control}</label>`: the label wraps its control, as the screens and tests expect. */
export function Field({ label, children, className, emphasis }: FieldProps) {
  const classes = [styles.field, className].filter((name) => name !== undefined && name !== '').join(' ');
  return (
    <label className={classes} data-emphasis={emphasis}>
      <span>{label}</span>
      {children}
    </label>
  );
}
