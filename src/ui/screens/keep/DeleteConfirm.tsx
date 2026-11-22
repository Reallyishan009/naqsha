import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { Translate } from '../../i18n/messages.ts';
import { Button } from '../../components/Button.tsx';
import { Panel } from '../../components/Panel.tsx';
import styles from './KeepScreen.module.css';
type ConfirmProps = { t: Translate; onYes: () => void; onNo: () => void };
/** Asks before deleting. Focus starts on the safe choice; Escape cancels (R7.8). */
export function DeleteConfirm({ t, onYes, onNo }: ConfirmProps) {
  const safeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    safeRef.current?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') onNo();
  };
  return (
    <Panel role="group" aria-label={t('keep.list.deleteConfirm')} className={styles.confirm} onKeyDown={onKeyDown}>
      <p>{t('keep.list.deleteConfirm')}</p>
      <div className={styles.actions}>
        <Button ref={safeRef} onClick={onNo}>
          {t('keep.list.deleteNo')}
        </Button>
        <Button onClick={onYes}>{t('keep.list.deleteYes')}</Button>
      </div>
    </Panel>
  );
}
