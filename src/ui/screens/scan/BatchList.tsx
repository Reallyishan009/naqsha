import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { CardProfile } from '../../../codec/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import type { ScanBatch } from '../../types.ts';
import { CardThumb } from '../../illustrations/CardDrawing.tsx';
import { Button } from '../../components/Button.tsx';
import { Panel } from '../../components/Panel.tsx';
import styles from './ScanScreen.module.css';

/** The card of the batch is the one `CardDrawing`; the name stays here so earlier imports keep working. */
export { CardThumb };

export type BatchListProps = {
  batch: ScanBatch;
  /** The Card_Profile the cards are drawn from, or null when none is chosen. */
  profile: CardProfile | null;
  /** Index of the card waiting for a confirmed removal, or null. */
  pendingRemove: number | null;
  t: Translate;
  onRemoveRequest: (index: number) => void;
  onRemoveConfirm: () => void;
  onRemoveCancel: () => void;
  onMove: (index: number, by: -1 | 1) => void;
  onScanAgain: (index: number) => void;
};

function RemoveConfirm({ number, t, onYes, onNo }: { number: number; t: Translate; onYes: () => void; onNo: () => void }) {
  const safeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    safeRef.current?.focus();
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.key === 'Escape') onNo();
  };
  const question = t('scan.batch.removeConfirm', { number });
  return (
    <Panel role="group" aria-label={question} className={styles.confirm} onKeyDown={onKeyDown}>
      <p>{question}</p>
      <div className={styles.row}>
        <Button ref={safeRef} onClick={onNo}>
          {t('scan.batch.removeNo')}
        </Button>
        <Button onClick={onYes}>{t('scan.batch.removeYes')}</Button>
      </div>
    </Panel>
  );
}

/** The Scan_Batch: numbered thumbnails with confirmed remove, earlier, later and scan again (R11.2 to R11.5). */
export function BatchList(props: BatchListProps) {
  const { batch, pendingRemove, t } = props;
  // An empty batch has no list. The Scan screen shows its empty state (`scan.batch.empty`) in view, outside "More".
  if (batch.length === 0) return null;
  return (
    <ol className={styles.batch}>
      {batch.map((grid, index) => {
        const number = index + 1;
        return (
          // The batch is a list of values with no identity, so the position is the key.
          <li key={index} className={styles.batchItem}>
            <p className={styles.batchNumber}>{t('scan.batch.card', { number })}</p>
            <CardThumb className={styles.thumb} grid={grid} number={number} profile={props.profile} t={t} />
            <div className={styles.row}>
              <Button onClick={() => props.onRemoveRequest(index)}>{t('scan.batch.remove', { number })}</Button>
              <Button disabled={index === 0} onClick={() => props.onMove(index, -1)}>
                {t('scan.batch.earlier', { number })}
              </Button>
              <Button disabled={index === batch.length - 1} onClick={() => props.onMove(index, 1)}>
                {t('scan.batch.later', { number })}
              </Button>
              <Button onClick={() => props.onScanAgain(index)}>{t('scan.batch.again', { number })}</Button>
            </div>
            {pendingRemove === index ? (
              <RemoveConfirm number={number} t={t} onYes={props.onRemoveConfirm} onNo={props.onRemoveCancel} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
