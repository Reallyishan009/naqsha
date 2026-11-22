import type { ReactNode } from 'react';
import styles from './Notice.module.css';

export type NoticeVariant = 'information' | 'success' | 'warning' | 'error';

export type NoticeProps = {
  variant: NoticeVariant;
  /** The word that names the variant ("Note", "Done", "Careful", "Problem"), already translated. */
  word: string;
  /** `error` is `alert` unless told otherwise; the other variants have no role. `null` means no role at all. */
  role?: 'alert' | 'status' | null;
  children: ReactNode;
  action?: ReactNode;
};

/** One drawn icon for each variant; each has a different outline, so a Notice never relies on colour alone. */
function NoticeIcon({ variant }: { variant: NoticeVariant }) {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-icon={variant}>
      {variant === 'information' ? (
        // A circle with a dot over a stem.
        <>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="11" x2="12" y2="17" />
          <line x1="12" y1="7" x2="12" y2="7.5" />
        </>
      ) : null}
      {variant === 'success' ? (
        // A check mark.
        <polyline points="3,13 9,19 21,5" />
      ) : null}
      {variant === 'warning' ? (
        // A triangle with an exclamation mark.
        <>
          <polygon points="12,2 23,21 1,21" />
          <line x1="12" y1="9" x2="12" y2="15" />
          <line x1="12" y1="17.5" x2="12" y2="18" />
        </>
      ) : null}
      {variant === 'error' ? (
        // A square turned on its corner with a cross.
        <>
          <polygon points="12,1 23,12 12,23 1,12" />
          <line x1="8" y1="8" x2="16" y2="16" />
          <line x1="16" y1="8" x2="8" y2="16" />
        </>
      ) : null}
    </svg>
  );
}

/** A message with a word and an icon that differ for each variant, a 2px border in the variant colour and an optional action. */
export function Notice({ variant, word, role, children, action }: NoticeProps) {
  const resolvedRole = role === undefined ? (variant === 'error' ? 'alert' : undefined) : (role ?? undefined);
  return (
    <div className={`${styles.notice} ${styles[variant]}`} role={resolvedRole} data-variant={variant}>
      <p className={styles.heading}>
        <NoticeIcon variant={variant} />
        <span className={styles.word}>{word}</span>
      </p>
      <div className={styles.text}>{children}</div>
      {action === undefined || action === null ? null : <div className={styles.action}>{action}</div>}
    </div>
  );
}
