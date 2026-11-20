import { memo } from 'react';
import type { KeyboardEvent } from 'react';
import { groupBits } from '../../../codec-view/index.ts';
import type { Line } from '../../../codec-view/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import { lineAccessibleName } from '../../state/codeView.ts';
import type { LineControlKind } from '../../state/codeView.ts';
import styles from './LineRow.module.css';

/** The `data-line-control` values: how the listing finds the control that had focus when the Window moves (R11.13). */
export const BREAKPOINT_CONTROL: LineControlKind = 'breakpoint';
export const BIT_LINE_CONTROL: LineControlKind = 'bit-line';

/** Shown in the marks field and on the breakpoint control while the pick has a Breakpoint (R3.7). */
export const BREAKPOINT_MARK = '●';
/** Shown on the breakpoint control while the pick has no Breakpoint. */
export const NO_BREAKPOINT_MARK = '○';
/** Shown in the marks field on the Line of the Selected_Pick (R3.11). */
export const SELECTED_MARK = '▶';

/**
 * The marks field: the Selected_Pick marker, then the Breakpoint marker, each in a slot of its own so the pick
 * number starts at the same offset on every Line. Both show when the Selected_Pick has a Breakpoint (R3.11).
 */
export function marksText(selected: boolean, breakpoint: boolean): string {
  return `${selected ? SELECTED_MARK : ' '} ${breakpoint ? BREAKPOINT_MARK : ' '}`;
}

/** The pick number padded on the left to `width` characters, so every Bit_Line starts at the same offset (R2.3). */
export function paddedPickNumber(pick: number, width: number): string {
  return String(pick).padStart(width, ' ');
}

/**
 * Where a key moves the scroll position of a Bit_Line region: one character for the arrow keys, the first end
 * for Home and the last end for End, kept inside 0 to `scrollWidth`. A key it does not handle gives null, so the
 * browser keeps its own behaviour for it (R11.11).
 */
export function scrollLeftAfterKey(
  key: string,
  scrollLeft: number,
  scrollWidth: number,
  characterWidth: number,
): number | null {
  const keep = (value: number): number => Math.min(Math.max(0, value), Math.max(0, scrollWidth));
  switch (key) {
    case 'ArrowLeft':
      return keep(scrollLeft - characterWidth);
    case 'ArrowRight':
      return keep(scrollLeft + characterWidth);
    case 'Home':
      return 0;
    case 'End':
      return Math.max(0, scrollWidth);
    default:
      return null;
  }
}

export type LineItemProps = {
  line: Line;
  /** True on the Line of the Selected_Pick. */
  selected: boolean;
  /** True while the pick of this Line holds a Breakpoint. */
  breakpoint: boolean;
  /** The character width of the largest pick index of the Current_Pattern. */
  pickWidth: number;
  hookColumns: number;
  t: Translate;
  /** Called with the pick index of this Line; the screen toggles its Breakpoint. */
  onToggleBreakpoint: (pick: number) => void;
  /** True when the card of this pick came from an accepted suggestion, so it is a guess and not a read card. */
  repaired?: boolean;
};

/** One Line of the listing (R2.2, R2.3, R2.9, R3.7, R3.11, R11.11). Memoised: up to Window_Size are rendered. */
function LineItemView({ line, selected, breakpoint, pickWidth, hookColumns, t, onToggleBreakpoint, repaired = false }: LineItemProps) {
  const pick = line.pick;
  const bitsText = line.kind === 'bits' ? groupBits(line.bits, hookColumns) : '';

  const onBitsKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const region = event.currentTarget;
    const characterCount = Math.max(1, bitsText.length);
    const next = scrollLeftAfterKey(event.key, region.scrollLeft, region.scrollWidth, region.scrollWidth / characterCount);
    if (next === null) return;
    event.preventDefault();
    region.scrollLeft = next;
  };

  return (
    <li
      className={styles.line}
      role="group"
      aria-label={repaired ? `${lineAccessibleName(t, line)}, ${t('repair.mark')}` : lineAccessibleName(t, line)}
      aria-current={selected ? 'true' : undefined}
      data-pick={pick}
    >
      <button
        type="button"
        className={styles.breakpoint}
        aria-pressed={breakpoint}
        aria-label={t('codeview.breakpoint.name', { pick })}
        onClick={() => onToggleBreakpoint(pick)}
        data-line-control={BREAKPOINT_CONTROL}
      >
        {breakpoint ? BREAKPOINT_MARK : NO_BREAKPOINT_MARK}
      </button>
      <span className={styles.marks} aria-hidden="true">
        {marksText(selected, breakpoint)}
      </span>
      <span className={styles.pickNumber} aria-hidden="true">
        {paddedPickNumber(pick, pickWidth)}
      </span>
      {repaired ? <span className={styles.repaired}>{t('repair.mark')}</span> : null}
      {line.kind === 'damaged' ? (
        <p className={styles.damaged}>{t('codeview.line.damagedLabel')}</p>
      ) : (
        <div
          className={styles.bits}
          role="group"
          tabIndex={0}
          aria-label={t('codeview.bitline.name', { pick })}
          onKeyDown={onBitsKeyDown}
          data-line-control={BIT_LINE_CONTROL}
        >
          <span className={styles.bitsText}>{bitsText}</span>
        </div>
      )}
    </li>
  );
}

export const LineItem = memo(LineItemView);
