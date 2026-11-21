import type { ReactNode } from 'react';
import styles from './Chip.module.css';

export type ChipTone = 'quiet' | 'picture';

export type ChipProps = {
  /** `quiet` is a --tint fill for a chip under a title; `picture` is the opaque --surface and a soft shadow, for a chip laid over a picture. */
  tone?: ChipTone;
  children: ReactNode;
};

/** A small pill with a short label (a word or two, already translated). It is not a control: it has no role and no handler. */
export function Chip({ tone = 'quiet', children }: ChipProps) {
  return <span className={`${styles.chip} ${styles[tone]}`}>{children}</span>;
}
