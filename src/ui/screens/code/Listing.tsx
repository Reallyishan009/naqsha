import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, FocusEvent, RefObject } from 'react';
import type { Line } from '../../../codec-view/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import { focusTargetAfterWindowMove, pickNumberWidth, windowFor } from '../../state/codeView.ts';
import type { FocusedLineControl, LineControlKind, PickWindow } from '../../state/codeView.ts';
import type { AppAction } from '../../types.ts';
import { BIT_LINE_CONTROL, BREAKPOINT_CONTROL, LineItem } from './LineRow.tsx';
import styles from './Listing.module.css';

/** The line height in pixels when the custom property cannot be read; the App's Touch_Target. */
const FALLBACK_LINE_HEIGHT_PX = 48;

/** The pick index of the first Line the scroll position shows: `floor(scrollTop / lineHeight)` (R2.11). */
export function firstVisiblePickAt(scrollTop: number, lineHeight: number): number {
  if (!(lineHeight > 0) || !(scrollTop > 0)) return 0;
  return Math.floor(scrollTop / lineHeight);
}

/** How many Lines a viewport of `viewportHeight` pixels can show, counting a part-shown Line at each edge. */
export function visiblePicksIn(viewportHeight: number, lineHeight: number): number {
  if (!(lineHeight > 0) || !(viewportHeight > 0)) return 0;
  return Math.ceil(viewportHeight / lineHeight) + 1;
}

/**
 * The scroll position that puts the Line of `pick` inside the viewport with the least movement, or `scrollTop`
 * itself when that Line is already inside (R2.7). It moves the scroll position and never animates it.
 */
export function scrollTopToShowPick(
  pick: number,
  lineHeight: number,
  scrollTop: number,
  viewportHeight: number,
): number {
  if (!(lineHeight > 0) || !(viewportHeight > 0)) return scrollTop;
  const top = pick * lineHeight;
  const bottom = top + lineHeight;
  if (top < scrollTop) return top;
  if (bottom > scrollTop + viewportHeight) return bottom - viewportHeight;
  return scrollTop;
}

/** True when every Line of the visible span that is a pick of the pattern lies inside `pickWindow`. */
function windowCoversView(
  pickWindow: PickWindow,
  pickCount: number,
  firstVisiblePick: number,
  visiblePicks: number,
): boolean {
  if (pickCount <= 0 || visiblePicks <= 0) return true;
  const first = Math.min(Math.max(0, firstVisiblePick), pickCount - 1);
  const last = Math.min(pickCount - 1, firstVisiblePick + visiblePicks - 1);
  return pickWindow.from <= first && last < pickWindow.from + pickWindow.count;
}

/**
 * The Window of the listing. It holds the Selected_Pick and the visible Lines when both fit in Window_Size (R2.4,
 * R2.7, R2.11). When they do not, because the user scrolled far from the Selected_Pick, the visible Lines win, so
 * the viewport is never left without Lines; moving the Selected_Pick then scrolls the listing to it, and both fit
 * again.
 */
export function listingWindow(
  previous: PickWindow | null,
  pickCount: number,
  selectedPick: number,
  firstVisiblePick: number,
  visiblePicks: number,
): PickWindow {
  const wanted = windowFor(previous, pickCount, selectedPick, firstVisiblePick, visiblePicks);
  if (windowCoversView(wanted, pickCount, firstVisiblePick, visiblePicks)) return wanted;
  return windowFor(previous, pickCount, firstVisiblePick, firstVisiblePick, visiblePicks);
}

/** The line height in pixels, read from the one CSS custom property the Window offset and the spacer also use. */
function readLineHeight(scroller: HTMLElement): number {
  const value = Number.parseFloat(getComputedStyle(scroller).getPropertyValue('--code-line-height'));
  return Number.isFinite(value) && value > 0 ? value : FALLBACK_LINE_HEIGHT_PX;
}

/** The Line control that has keyboard focus, read from the element that received it; null for any other element. */
function focusedLineControlOf(target: EventTarget): (FocusedLineControl & { element: HTMLElement }) | null {
  if (!(target instanceof HTMLElement)) return null;
  const kind: LineControlKind | null =
    target.dataset.lineControl === BREAKPOINT_CONTROL
      ? BREAKPOINT_CONTROL
      : target.dataset.lineControl === BIT_LINE_CONTROL
        ? BIT_LINE_CONTROL
        : null;
  const pick = Number(target.closest<HTMLElement>('[data-pick]')?.dataset.pick);
  return kind === null || !Number.isInteger(pick) ? null : { kind, pick, element: target };
}

/** Puts focus on `element` and brings it into view in one step: `behavior: 'auto'` follows the page, which never smooths (R11.9). */
function focusInView(element: HTMLElement): void {
  element.focus();
  element.scrollIntoView({ block: 'nearest', behavior: 'auto' });
}

const NO_PICKS: ReadonlyArray<number> = [];
export type ListingProps = {
  /** One Line for each pick of the Current_Pattern, in pick order; empty when the Current_Pattern has no Lines. */
  lines: ReadonlyArray<Line>;
  hookColumns: number;
  selectedPick: number;
  breakpoints: ReadonlyArray<number>;
  /** The `id` of the Window `<ol>`: the screen's own marker string (R9.9). */
  listingId: string;
  t: Translate;
  dispatch: Dispatch<AppAction>;
  /** The step forward control: where focus goes when the Selected_Pick's Line has no control of the focused kind (R11.13). */
  stepForwardRef: RefObject<HTMLButtonElement | null>;
  /** Pick indices whose card is an accepted suggestion; their Lines say so. */
  repairedPicks?: ReadonlyArray<number>;
};

/**
 * The scroller: a spacer as tall as every Line together, and the Window `<ol>` offset down to its first Line.
 * Only the Lines of the Window are in the document, at most Window_Size whatever the length of the Current_Pattern.
 */
export function Listing({
  lines,
  hookColumns,
  selectedPick,
  breakpoints,
  listingId,
  t,
  dispatch,
  stepForwardRef,
  repairedPicks = NO_PICKS,
}: ListingProps) {
  const pickCount = lines.length;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ firstVisiblePick: 0, visiblePicks: 0 });
  const [pickWindow, setPickWindow] = useState<PickWindow>(() => listingWindow(null, pickCount, selectedPick, 0, 0));

  // The Window follows the scroll position and the Selected_Pick; the same value comes back while nothing leaves it.
  const shown = listingWindow(pickWindow, pickCount, selectedPick, view.firstVisiblePick, view.visiblePicks);
  if (shown !== pickWindow) setPickWindow(shown);

  const measure = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    const lineHeight = readLineHeight(scroller);
    const firstVisiblePick = firstVisiblePickAt(scroller.scrollTop, lineHeight);
    const visiblePicks = visiblePicksIn(scroller.clientHeight, lineHeight);
    setView((current) =>
      current.firstVisiblePick === firstVisiblePick && current.visiblePicks === visiblePicks
        ? current
        : { firstVisiblePick, visiblePicks },
    );
  }, []);

  useLayoutEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, pickCount]);

  // A deliberate move of the Selected_Pick brings its Line into view, so the Window and the viewport agree (R2.7).
  const shownPick = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (shownPick.current === selectedPick) return;
    shownPick.current = selectedPick;
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    const next = scrollTopToShowPick(selectedPick, readLineHeight(scroller), scroller.scrollTop, scroller.clientHeight);
    if (next !== scroller.scrollTop) scroller.scrollTop = next;
    measure();
  }, [selectedPick, measure]);

  // The Line control that last took focus. A Window move can take its Line out of the document; focus would then fall
  // to the document body, so it is put back on a control of the Selected_Pick's Line (R11.13).
  const focusedRef = useRef<(FocusedLineControl & { element: HTMLElement }) | null>(null);
  const onFocus = useCallback((event: FocusEvent<HTMLDivElement>) => {
    focusedRef.current = focusedLineControlOf(event.target);
  }, []);
  const onBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const left = event.target;
    // A blur that leaves the element in the document is the user moving focus on. One caused by the element being
    // removed finds it gone by the time this microtask runs, and the record is kept for the effect below.
    queueMicrotask(() => {
      if (left instanceof HTMLElement && left.isConnected && focusedRef.current?.element === left) focusedRef.current = null;
    });
  }, []);

  useLayoutEffect(() => {
    const focused = focusedRef.current;
    const scroller = scrollerRef.current;
    if (focused === null || scroller === null || focused.element.isConnected) return;
    focusedRef.current = null;
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    const target = focusTargetAfterWindowMove(focused, shown, selectedPick, lines[selectedPick]?.kind ?? null);
    if (target === null) return;
    const onSelectedLine =
      target === 'step-forward'
        ? null
        : scroller.querySelector<HTMLElement>(`[data-pick="${target.pick}"] [data-line-control="${target.kind}"]`);
    // Step forward is disabled on the last pick index and cannot take focus; a breakpoint control of the Window can.
    const forward = stepForwardRef.current;
    const fallback =
      forward !== null && !forward.disabled
        ? forward
        : scroller.querySelector<HTMLElement>(`[data-pick="${selectedPick}"] [data-line-control="${BREAKPOINT_CONTROL}"]`) ??
          scroller.querySelector<HTMLElement>(`[data-line-control="${BREAKPOINT_CONTROL}"]`);
    const element = onSelectedLine ?? fallback;
    if (element !== null) focusInView(element);
  });

  const onToggleBreakpoint = useCallback((pick: number) => dispatch({ type: 'toggle-breakpoint', pick }), [dispatch]);
  const breakpointSet = useMemo(() => new Set(breakpoints), [breakpoints]);
  const repairedSet = useMemo(() => new Set(repairedPicks), [repairedPicks]);
  const pickWidth = pickNumberWidth(pickCount);
  const windowLines = lines.slice(shown.from, shown.from + shown.count);

  return (
    <div ref={scrollerRef} className={styles.scroller} onScroll={measure} onFocus={onFocus} onBlur={onBlur}>
      <div className={styles.spacer} style={{ height: `calc(var(--code-line-height) * ${pickCount})` }}>
        <ol
          id={listingId}
          aria-label={t('codeview.listing.name')}
          className={styles.window}
          style={{ transform: `translateY(calc(var(--code-line-height) * ${shown.from}))` }}
        >
          {windowLines.map((line) => (
            <LineItem
              key={line.pick}
              line={line}
              selected={line.pick === selectedPick}
              breakpoint={breakpointSet.has(line.pick)}
              repaired={repairedSet.has(line.pick)}
              pickWidth={pickWidth}
              hookColumns={hookColumns}
              t={t}
              onToggleBreakpoint={onToggleBreakpoint}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}
