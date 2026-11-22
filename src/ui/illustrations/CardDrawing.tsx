import { memo, useId } from 'react';
import type { CardGrid, CardProfile } from '../../codec/index.ts';
import type { Translate } from '../i18n/messages.ts';
import { cardGeometry, punchedHooks } from './cardGeometry.ts';
import type { CardGeometry, PunchedHook } from './cardGeometry.ts';
import styles from './CardDrawing.module.css';

/** The ring that marks an unpunched hook position is this fraction of a punched hole's radius. */
const UNPUNCHED_MARK_RATIO = 0.5;

export type CardDrawingProps = {
  profile: CardProfile | null;
  grid: CardGrid | null; // null for a card that is missing
  state?: 'ok' | 'damaged' | 'missing'; // default 'ok'; 'ok' with a null grid is 'missing'
  pickNumber?: number; // the number the screen shows for this pick
  adjacentText?: boolean; // true when text beside it states pick number and punched count
  label?: string; // keeps today's aria-label where a test relies on it
  marks?: 'none' | 'rings'; // 'rings' only for the repair panel
  className?: string; // sizing from the screen that holds the card
  t: Translate;
};

/** The box of the hook positions, padded by one hole diameter and kept on the card: where a gap is drawn. */
function hookArea(geometry: CardGeometry): { x: number; y: number; width: number; height: number } {
  const centres = geometry.hookCentres.flat();
  if (centres.length === 0) return { x: 0, y: 0, width: geometry.widthMm, height: geometry.heightMm };
  const pad = geometry.holeDiameterMm;
  const left = Math.max(0, Math.min(...centres.map((centre) => centre.x)) - pad);
  const top = Math.max(0, Math.min(...centres.map((centre) => centre.y)) - pad);
  const right = Math.min(geometry.widthMm, Math.max(...centres.map((centre) => centre.x)) + pad);
  const bottom = Math.min(geometry.heightMm, Math.max(...centres.map((centre) => centre.y)) + pad);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export type CardFaceProps = {
  geometry: CardGeometry;
  /** The punched hook positions to draw, or null to draw no punched hole (a gap, or a grid that does not match). */
  punched: PunchedHook[] | null;
  marks?: 'none' | 'rings';
  /** The id of the hatch pattern; when given, a hatched gap is drawn over the hook positions. */
  gapPatternId?: string;
};

/**
 * The card itself, as SVG content in millimetres from the card's top-left corner: manila stock with square
 * corners, punched holes, the two peg holes, the lacing holes, and optionally a gap. It is the part the
 * Hero_Loom shares, so the card there has the same stock, punched holes and corners.
 */
export function CardFace({ geometry, punched, marks = 'none', gapPatternId }: CardFaceProps) {
  const punchedKeys = new Set((punched ?? []).map((hook) => `${hook.hookRow}:${hook.hookColumn}`));
  const markRadius = (geometry.holeDiameterMm / 2) * UNPUNCHED_MARK_RATIO;
  const gap = gapPatternId === undefined ? null : hookArea(geometry);
  return (
    <g>
      <rect className={styles.stock} x={0} y={0} width={geometry.widthMm} height={geometry.heightMm} />
      {punched?.map((hook) => (
        <circle
          key={`${hook.hookRow}:${hook.hookColumn}`}
          className={styles.punchedHole}
          cx={hook.centreMm.x}
          cy={hook.centreMm.y}
          r={geometry.holeDiameterMm / 2}
        />
      ))}
      {geometry.pegHoles.map((peg, index) => (
        <circle
          key={`peg${index}`}
          className={styles.pegHole}
          cx={peg.centreMm.x}
          cy={peg.centreMm.y}
          r={peg.diameterMm / 2}
        />
      ))}
      {geometry.lacingHoles.map((lacing, index) => (
        <circle
          key={`lacing${index}`}
          className={styles.lacingHole}
          cx={lacing.centreMm.x}
          cy={lacing.centreMm.y}
          r={lacing.diameterMm / 2}
        />
      ))}
      {marks === 'rings' && punched !== null
        ? geometry.hookCentres.flatMap((hookRowCentres, hookRow) =>
            hookRowCentres.flatMap((centre, hookColumn) =>
              punchedKeys.has(`${hookRow}:${hookColumn}`) ? [] : [
                <circle
                  key={`mark${hookRow}:${hookColumn}`}
                  className={styles.unpunchedMark}
                  cx={centre.x}
                  cy={centre.y}
                  r={markRadius}
                />,
              ],
            ),
          )
        : null}
      {gap !== null && gapPatternId !== undefined ? (
        <>
          <rect className={styles.gap} x={gap.x} y={gap.y} width={gap.width} height={gap.height} />
          <rect
            className={styles.gapHatch}
            x={gap.x}
            y={gap.y}
            width={gap.width}
            height={gap.height}
            fill={`url(#${gapPatternId})`}
          />
        </>
      ) : null}
    </g>
  );
}

function CardDrawingView({
  profile,
  grid,
  state = 'ok',
  pickNumber,
  adjacentText = false,
  label,
  marks = 'none',
  className,
  t,
}: CardDrawingProps) {
  const patternId = `gap${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const result = profile === null ? ({ ok: false } as const) : cardGeometry(profile);
  if (profile === null || !result.ok) {
    return <p className={`${styles.cannotDraw} ${className ?? ''}`.trim()}>{t('card.cannotDraw')}</p>;
  }
  const { geometry } = result;
  const shown = state === 'ok' && grid === null ? 'missing' : state;
  const punched = shown === 'ok' && grid !== null ? punchedHooks(profile, geometry, grid) : null;
  const mismatch = shown === 'ok' && grid !== null && punched === null;
  const total = geometry.hookCentres.reduce((sum, hookRowCentres) => sum + hookRowCentres.length, 0);

  let description: string;
  if (mismatch) description = t('card.mismatch');
  else if (shown === 'damaged') description = t('card.damaged');
  else if (shown === 'missing') description = t('card.missing');
  else description = t('card.desc', { punched: punched?.length ?? 0, total });
  const title =
    label ?? (pickNumber === undefined ? description : t('card.title', { pick: pickNumber }));

  const hasGap = shown !== 'ok';
  const figureClass = `${styles.card} ${className ?? ''}`.trim();
  const accessibility = adjacentText
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': label } as const);
  return (
    <figure className={figureClass}>
      <svg
        className={styles.drawing}
        viewBox={`0 0 ${geometry.widthMm} ${geometry.heightMm}`}
        {...accessibility}
      >
        {adjacentText ? null : (
          <>
            <title>{title}</title>
            <desc>{description}</desc>
          </>
        )}
        {hasGap ? (
          <defs>
            <pattern id={patternId} patternUnits="userSpaceOnUse" width={geometry.holeDiameterMm} height={geometry.holeDiameterMm}>
              <line
                className={styles.hatchLine}
                x1={0}
                y1={geometry.holeDiameterMm}
                x2={geometry.holeDiameterMm}
                y2={0}
              />
            </pattern>
          </defs>
        ) : null}
        <CardFace geometry={geometry} punched={punched} marks={marks} gapPatternId={hasGap ? patternId : undefined} />
      </svg>
      {shown === 'damaged' || shown === 'missing' ? (
        <figcaption className={styles.gapText}>{t(shown === 'damaged' ? 'card.damaged' : 'card.missing')}</figcaption>
      ) : null}
    </figure>
  );
}

/** One punch card drawn from its Card_Profile: the one card picture of the app (Requirement 12). */
export const CardDrawing = memo(CardDrawingView);

export type CardThumbProps = {
  grid: CardGrid;
  number: number;
  profile: CardProfile | null;
  className?: string;
  t: Translate;
};

/** A card of the Scan_Batch: `CardDrawing` named by `scan.batch.thumb.alt`, so earlier imports keep working. */
export function CardThumb({ grid, number, profile, className, t }: CardThumbProps) {
  const punched = grid.reduce((sum, hookRow) => sum + hookRow.filter(Boolean).length, 0);
  const total = grid.reduce((sum, hookRow) => sum + hookRow.length, 0);
  return (
    <CardDrawing
      profile={profile}
      grid={grid}
      pickNumber={number}
      label={t('scan.batch.thumb.alt', { number, punched, total })}
      className={className}
      t={t}
    />
  );
}
