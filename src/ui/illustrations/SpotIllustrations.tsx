import { Frame } from './Drawing.tsx';
import type { DrawingProps } from './Drawing.tsx';
import { STROKE } from './strokes.ts';
import styles from './Drawings.module.css';

/**
 * The three Spot_Illustrations of the empty states. Each sits above a message that says what is missing, so it is
 * decoration by default. What is missing is drawn as a dashed outline. Drawn on a 120 by 90 sheet.
 */
const VIEW_BOX = '0 0 120 90';

/** No saved designs: an empty shelf with the dashed outline of a folder that is not there, and a loose loop of weft. */
export function NoSavedDesignsIllustration(props: DrawingProps) {
  return (
    <Frame kind="spot" viewBox={VIEW_BOX} props={props} name="spot-no-saved-designs">
      <path d="M8 56.5L111 55.5Q113 55.5 113 57.5V61Q113 62.5 111 62.5L9 63Q7 63 7 61V58Z" />
      <path d="M24 63V73M24 73L33 63.5M96 63V73M96 73L87 63.5" />
      <g className={styles.absent}>
        <path d="M30 54V30Q30 28.5 31.5 28.5H49Q50.5 28.5 50.5 30V54" />
        <path strokeWidth={STROKE.fine} d="M56 54L60 22Q60.3 20.5 61.8 20.7L66.5 21.2Q68 21.4 67.8 23L64.5 54" />
      </g>
      <path className={styles.accent} d="M72 55C72 46 83 45 83 51C83 56.5 75 57 76 50C77 45 87 45 91 55" />
    </Frame>
  );
}

/** No cards scanned: a camera frame with nothing in it but the dashed outline of a card and a scan line. */
export function NoCardsScannedIllustration(props: DrawingProps) {
  return (
    <Frame kind="spot" viewBox={VIEW_BOX} props={props} name="spot-no-cards-scanned">
      <path d="M20 28V16Q20 12 24 12H36M84 12H96Q100 12 100 16V28M100 62V74Q100 78 96 78H84M36 78H24Q20 78 20 74V62" />
      <path
        className={styles.absent}
        d="M46 27H75Q78 27 78.2 30L77.8 60Q77.6 63.5 74.5 63.6L45 64Q42 63.8 42 60.5L42.3 30Q42.5 27 46 27Z"
      />
      <path className={styles.accent} d="M27 45.5C45 44 75 47 93 45" />
    </Frame>
  );
}

/** Nothing to compare: two ruled sheets with a gap between them and a two-way arrow across the gap. */
export function NothingToCompareIllustration(props: DrawingProps) {
  return (
    <Frame kind="spot" viewBox={VIEW_BOX} props={props} name="spot-nothing-to-compare">
      <path d="M14 76V16Q14 14 16 14H38L48 24V74Q48 76 46 76Z" />
      <path strokeWidth={STROKE.fine} d="M38 14V22Q38 24 40 24H48M21 36H41M21 44.5H40M21 53H34" />
      <path d="M72 24L82 14H104Q106 14 106 16V74Q106 76 104 76H74Q72 76 72 74Z" />
      <path strokeWidth={STROKE.fine} d="M82 14V22Q82 24 80 24H72" />
      <path className={styles.accent} d="M54 45H66M58 41L54 45L58 49M62 41L66 45L62 49" />
    </Frame>
  );
}
