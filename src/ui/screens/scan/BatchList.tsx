import { useEffect, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import type { CardProfile } from '../../../codec/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import { punchedCount } from '../../state/scan.ts';
import type { ScanBatch } from '../../types.ts';
import { printableLayout } from '../../printable/layout.ts';
import type { Disc } from '../../printable/layout.ts';
import { HOLE_RGB, STOCK_RGB, rgbHex } from '../../printable/style.ts';
import { Button } from '../../components/Button.tsx';
import { Panel } from '../../components/Panel.tsx';
import styles from './ScanScreen.module.css';

/**
 * A small picture of one card, drawn from the same layout as the printable card: manila stock, round punched
 * holes, peg holes and lacing holes, all from the Card_Profile (R15.6). Unpunched positions get no mark: the
 * ring of the printable card is a tenth of a hole wide, which is under a pixel at thumbnail size.
 * With no profile, or a profile or grid the layout rejects, it draws the plain card outline only.
 */
export function CardThumb({
  grid,
  number,
  profile,
  t,
}: {
  grid: ScanBatch[number];
  number: number;
  profile: CardProfile | null;
  t: Translate;
}) {
  const { punched, total } = punchedCount(grid);
  const label = t('scan.batch.thumb.alt', { number, punched, total });
  const layout = profile === null ? null : printableLayout(profile, grid);
  if (layout === null || !layout.ok) {
    const hookRows = grid.length;
    const hookColumns = grid[0]?.length ?? 0;
    return (
      <svg
        role="img"
        aria-label={label}
        className={styles.thumb}
        viewBox={`0 0 ${hookColumns} ${hookRows}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x="0" y="0" width={hookColumns} height={hookRows} className={styles.thumbCard} />
      </svg>
    );
  }
  const { widthMm, heightMm, hookMarks, pegHoles, lacingHoles } = layout.value;
  const hole = rgbHex(HOLE_RGB);
  const disc = (key: string, { centreMm, diameterMm }: Disc) => (
    <circle key={key} cx={centreMm.x} cy={centreMm.y} r={diameterMm / 2} fill={hole} />
  );
  return (
    <svg
      role="img"
      aria-label={label}
      className={styles.thumb}
      viewBox={`0 0 ${widthMm} ${heightMm}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="0" y="0" width={widthMm} height={heightMm} fill={rgbHex(STOCK_RGB)} />
      {hookMarks.filter((mark) => mark.punched).map((mark) => disc(`h${mark.hookRow}-${mark.hookColumn}`, mark))}
      {pegHoles.map((peg, index) => disc(`p${index}`, peg))}
      {lacingHoles.map((lacing, index) => disc(`l${index}`, lacing))}
    </svg>
  );
}

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
            <CardThumb grid={grid} number={number} profile={props.profile} t={t} />
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
