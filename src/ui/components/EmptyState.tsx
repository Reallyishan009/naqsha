import type { ReactNode } from 'react';
import { Panel } from './Panel.tsx';
import styles from './EmptyState.module.css';

export type EmptyStateProps = {
  /** A decorative drawing; the caller marks it `aria-hidden`, and the message carries the meaning. */
  illustration?: ReactNode;
  /** What is empty, already translated. */
  message: string;
  /** What the weaver can do next, already translated. */
  next: string;
  /** An optional control placed after the next-step sentence. */
  action?: ReactNode;
};

/** A Panel that says what is missing and what to do about it. */
export function EmptyState({ illustration, message, next, action }: EmptyStateProps) {
  return (
    <Panel>
      <div className={styles.empty} data-empty-state="">
        {illustration === undefined || illustration === null ? null : <div className={styles.illustration}>{illustration}</div>}
        <p className={styles.message}>{message}</p>
        <p className={styles.next}>{next}</p>
        {action === undefined || action === null ? null : <div className={styles.action}>{action}</div>}
      </div>
    </Panel>
  );
}
