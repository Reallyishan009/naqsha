import { useId, useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { CardProfile, Pattern } from '../../codec/index.ts';
import type { Translate } from '../i18n/messages.ts';
import { cardGeometry, punchedHooks } from './cardGeometry.ts';
import { CardFace } from './CardDrawing.tsx';
import { HOOK_UNITS, LIFT_UNITS, MARGIN_UNITS, PRESS_UNITS, WARP_UNITS, heroLayout } from './heroLayout.ts';
import { heroPose } from './heroPose.ts';
import styles from './HeroLoom.module.css';

/** The height of the harness board that the warp ends pass through, in drawing units. */
const BOARD_UNITS = 5;
/** The thickness of the weft bar, in drawing units. */
const WEFT_UNITS = 9;
/** Where the weft lies in the warp band, as a fraction of the band's height from its top. */
const WEFT_AT = 0.62;

export type HeroLoomProps = {
  /** A valid Card_Profile. A profile that fails validation draws nothing. */
  profile: CardProfile;
  /** The Pattern of the first Sample_Design; its first pick with a punched hook position is the one drawn. */
  pattern: Pattern;
  /** True under Reduced_Motion: the lifted pose is shown still and nothing animates. */
  reducedMotion: boolean;
  className?: string;
  t: Translate;
};

/**
 * The Jacquard loom of the Landing, drawn in SVG: the head, the card pressing on the needles, a hook and a warp
 * end for each end, and one weft. Ends that the card lifts have their hook raised and their warp end lifted:
 * higher on the page, and gold (`--zari`) against `--indigo` at rest. One Lift_Cycle plays when the element is
 * first shown; it is never remounted by a re-render or a language change.
 */
export function HeroLoom({ profile, pattern, reducedMotion, className, t }: HeroLoomProps) {
  const ids = useId().replace(/[^A-Za-z0-9]/g, '');
  const geometry = useMemo(() => cardGeometry(profile), [profile]);
  const layout = useMemo(() => (geometry.ok ? heroLayout(profile) : null), [geometry, profile]);
  const pose = useMemo(() => (geometry.ok ? heroPose(profile, pattern) : null), [geometry, profile, pattern]);
  if (!geometry.ok || layout === null || pose === null) return null;

  const { card, needles, hooks, warp, head, viewBox } = layout;
  const lifted = new Set(pose.kind === 'lifted' ? pose.liftedEnds : []);
  const punched = pose.kind === 'lifted' ? punchedHooks(profile, geometry.geometry, pose.grid) : null;
  const scale = card.width / geometry.geometry.widthMm;
  const titleId = `heroTitle${ids}`;
  const descId = `heroDesc${ids}`;
  const description = pose.kind === 'lifted' ? t('hero.desc', { lifted: pose.liftedEnds.length }) : t('hero.desc.plain');

  const restHookTop = hooks.y + LIFT_UNITS;
  const hookBottom = hooks.y + HOOK_UNITS;
  const warpBottom = warp.y + WARP_UNITS;
  const weftTop = warp.y + (warp.height - WEFT_UNITS) * WEFT_AT;
  const postLeft = MARGIN_UNITS / 2;
  const style = { '--lift': `${LIFT_UNITS}px`, '--press': `${PRESS_UNITS}px` } as CSSProperties;

  return (
    <svg
      className={`${styles.hero} ${className ?? ''}`.trim()}
      viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
      data-motion={reducedMotion ? 'still' : 'play'}
      data-pose={pose.kind}
      style={style}
    >
      <title id={titleId}>{t('hero.title')}</title>
      <desc id={descId}>{description}</desc>

      <rect className={styles.plate} x={0} y={0} width={viewBox.width} height={viewBox.height} />
      <line className={styles.post} x1={postLeft} y1={head.y} x2={postLeft} y2={warpBottom} />
      <line className={styles.post} x1={viewBox.width - postLeft} y1={head.y} x2={viewBox.width - postLeft} y2={warpBottom} />

      <g className={styles.headGroup}>
        <rect className={styles.head} x={head.x} y={head.y} width={head.width} height={head.height} />
        <line className={styles.headRule} x1={head.x} y1={head.y + head.height / 2} x2={head.x + head.width} y2={head.y + head.height / 2} />
      </g>

      <g className={styles.card}>
        <g transform={`translate(${card.x} ${card.y}) scale(${scale})`}>
          <CardFace geometry={geometry.geometry} punched={punched} />
        </g>
      </g>

      <g className={styles.needles}>
        {layout.endX.map((x, endIndex) => (
          <line key={endIndex} className={styles.needle} x1={x} y1={needles.y} x2={x} y2={needles.y + needles.height} />
        ))}
      </g>

      <g>
        {layout.endX.map((x, endIndex) =>
          lifted.has(endIndex) ? null : (
            <g key={endIndex} data-end={endIndex}>
              <line className={styles.hook} x1={x} y1={restHookTop} x2={x} y2={hookBottom} />
              <line className={styles.end} x1={x} y1={warp.y} x2={x} y2={warpBottom} />
            </g>
          ),
        )}
      </g>

      <rect className={styles.board} x={warp.x} y={warp.y - BOARD_UNITS / 2} width={warp.width} height={BOARD_UNITS} />

      {/* A nested svg clips what it holds to the warp band, so the weft enters from outside the warp. */}
      <svg x={warp.x} y={warp.y} width={warp.width} height={warp.height} overflow="hidden">
        <rect className={styles.weft} x={0} y={weftTop - warp.y} width={warp.width} height={WEFT_UNITS} />
      </svg>

      <g>
        {layout.endX.map((x, endIndex) =>
          lifted.has(endIndex) ? (
            <g key={endIndex} data-end={endIndex}>
              <line className={styles.hookRaised} x1={x} y1={restHookTop} x2={x} y2={hookBottom} />
              <line className={styles.endLifted} x1={x} y1={warp.y} x2={x} y2={warpBottom} />
            </g>
          ) : null,
        )}
      </g>
    </svg>
  );
}
