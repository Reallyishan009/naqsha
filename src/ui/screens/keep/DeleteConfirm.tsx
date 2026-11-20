import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { Translate } from '../../i18n/messages.ts';
import styles from './KeepScreen.module.css';
type ConfirmProps = { t: Translate; onYes: () => void; onNo: () => void };
/** Asks before deleting. Focus starts on the safe choice; Escape cancels (R7.8). */
export function DeleteConfirm({ t, onYes, onNo }: ConfirmProps) {
  const safeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    safeRef.current?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') onNo();
  };
  return (
    <div role="group" aria-label={t('keep.list.deleteConfirm')} className={styles.confirm} onKeyDown={onKeyDown}>
      <p>{t('keep.list.deleteConfirm')}</p>
      <div className={styles.actions}>
        <button ref={safeRef} type="button" className={styles.button} onClick={onNo}>
          {t('keep.list.deleteNo')}
        </button>
        <button type="button" className={styles.button} onClick={onYes}>
          {t('keep.list.deleteYes')}
        </button>
      </div>
    </div>
  );
}
