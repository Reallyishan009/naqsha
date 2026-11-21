import styles from './Selvedge.module.css';

/** Names the fill pattern of the one Selvedge of the page. */
const PATTERN_ID = 'selvedge-blocks';

/** The woven edge of the header: 6 px high, alternating --zari and --madder blocks, like the edge of a sari. Decoration only. */
export function Selvedge() {
  return (
    <svg className={styles.selvedge} height="6" width="100%" aria-hidden="true" focusable="false" data-selvedge="">
      <defs>
        <pattern id={PATTERN_ID} width="16" height="6" patternUnits="userSpaceOnUse">
          <rect className={styles.zari} x="0" y="0" width="8" height="6" />
          <rect className={styles.madder} x="8" y="0" width="8" height="6" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="6" fill={`url(#${PATTERN_ID})`} />
    </svg>
  );
}
