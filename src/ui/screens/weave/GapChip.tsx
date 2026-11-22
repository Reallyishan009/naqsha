import type { ReactNode } from 'react';
import { Chip } from '../../components/Chip.tsx';
import styles from './GapChip.module.css';

/**
 * A Chip for picks that could not be read. The dashed outline of a missing card comes before the words, so the flag
 * is told by a shape and by text, never by colour alone.
 */
export function GapChip({ children }: { children: ReactNode }) {
  return (
    <Chip>
      <svg className={styles.mark} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
        <rect x="1.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.5 2" />
      </svg>
      {children}
    </Chip>
  );
}
