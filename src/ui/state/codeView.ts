import type { DiffEntry, Line } from '../../codec-view/index.ts';
import type { Translate } from '../i18n/messages.ts';

/** The most Lines the listing keeps in the document at once; fixed, whatever the pattern or viewport (R2.5). */
export const WINDOW_SIZE = 80;
/** Picks of headroom kept between the visible span and a Window edge before the Window moves. */
export const WINDOW_MARGIN = 10;

/** A contiguous run of `count` picks starting at pick index `from`. */
export type PickWindow = { from: number; count: number };

/** A whole number from a value that may be NaN, infinite or fractional; NaN gives 0. */
function wholeNumber(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value === Infinity) return Number.MAX_SAFE_INTEGER;
  if (value === -Infinity) return -Number.MAX_SAFE_INTEGER;
  return Math.floor(value);
}

function clampInto(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** True when `window` is a whole run of picks of a pattern of `pickCount` picks. */
function isWindowInside(window: PickWindow, pickCount: number): boolean {
  return (
    Number.isInteger(window.from) &&
    Number.isInteger(window.count) &&
    window.from >= 0 &&
    window.count > 0 &&
    window.from + window.count <= pickCount
  );
}

/**
 * The Window for a listing: at most WINDOW_SIZE picks, inside the pattern, holding the Selected_Pick and,
 * when it fits, the visible picks. Pure and total; `previous` is null before the first render (R2.4, R2.7, R2.11).
 */
export function windowFor(
  previous: PickWindow | null,
  pickCount: number,
  selectedPick: number,
  firstVisiblePick: number,
  visiblePicks: number,
): PickWindow {
  const picks = wholeNumber(pickCount);
  if (picks <= 0) return { from: 0, count: 0 };
  const count = Math.min(WINDOW_SIZE, picks);
  const lastPick = picks - 1;

  const selected = clampInto(wholeNumber(selectedPick), 0, lastPick);
  const visibleCount = wholeNumber(visiblePicks);
  let spanFirst = selected;
  let spanLast = selected;
  if (visibleCount > 0) {
    const visibleFirst = clampInto(wholeNumber(firstVisiblePick), 0, lastPick);
    const visibleLast = clampInto(wholeNumber(firstVisiblePick) + visibleCount - 1, 0, lastPick);
    spanFirst = Math.min(selected, visibleFirst);
    spanLast = Math.max(selected, visibleLast);
  }

  // A span wider than the Window keeps the part holding the Selected_Pick (R2.7 beats R2.11).
  if (spanLast - spanFirst + 1 > count) {
    if (selected <= spanFirst + count - 1) {
      spanLast = spanFirst + count - 1;
    } else {
      spanFirst = selected - count + 1;
      spanLast = selected;
    }
  }

  if (
    previous !== null &&
    previous.count === count &&
    isWindowInside(previous, picks) &&
    spanFirst - previous.from >= WINDOW_MARGIN &&
    previous.from + previous.count - 1 - spanLast >= WINDOW_MARGIN
  ) {
    return previous;
  }

  const from = clampInto(Math.floor((spanFirst + spanLast + 1 - count) / 2), 0, picks - count);
  if (previous !== null && previous.from === from && previous.count === count) return previous;
  return { from, count };
}

/** The character width of the largest pick index, so every Bit_Line starts at the same offset (R2.3). */
export function pickNumberWidth(pickCount: number): number {
  const picks = wholeNumber(pickCount);
  if (picks <= 1) return 1;
  return String(picks - 1).length;
}

/** The pick indices that hold a Breakpoint: ascending, no pick index twice. */
export type Breakpoints = ReadonlyArray<number>;

/**
 * Sets a Breakpoint where `pick` has none and removes it where it has one, so a pick index holds at most one and
 * the list stays ascending without repeats (R3.6). A `pick` that is not a whole number of at least 0 is no pick
 * index, and the Breakpoints come back unchanged. The upper bound is the caller's: it knows the pick count.
 */
export function toggleBreakpoint(breakpoints: Breakpoints, pick: number): Breakpoints {
  if (!Number.isInteger(pick) || pick < 0) return breakpoints;
  const without = breakpoints.filter((existing) => existing !== pick);
  return without.length < breakpoints.length ? without : [...without, pick].sort((a, b) => a - b);
}

/**
 * Where "run to next breakpoint" lands: the lowest Breakpoint above `pick`, with `found` true, or `lastPick` with
 * `found` false when none lies above `pick` (R3.8, R3.9). The result is one pick index, so the screen sets the
 * Selected_Pick once and never passes through the picks between. A Breakpoint above `lastPick` is not a pick of
 * the design and does not count.
 */
export function nextBreakpoint(
  breakpoints: Breakpoints,
  pick: number,
  lastPick: number,
): { pick: number; found: boolean } {
  let lowest: number | null = null;
  for (const breakpoint of breakpoints) {
    if (breakpoint > pick && breakpoint <= lastPick && (lowest === null || breakpoint < lowest)) {
      lowest = breakpoint;
    }
  }
  return lowest === null ? { pick: lastPick, found: false } : { pick: lowest, found: true };
}

/** A pick index read from the jump control, or a failure the screen answers by naming 0 and the last pick index. */
export type JumpParse = { ok: true; pick: number } | { ok: false };

/**
 * Reads the jump control (R3.4, R3.5). A pick number is a run of ASCII digits 0 to 9, optionally surrounded by
 * whitespace, and nothing else: no sign, no decimal point, no exponent, no `0x` prefix, no digit of another
 * script. Leading zeros are allowed and `'007'` is pick 7. It succeeds only for a value from 0 to `lastPick`; a
 * blank value, any other text, a value outside the range and a `lastPick` that is no pick index all fail.
 */
export function parseJump(text: string, lastPick: number): JumpParse {
  if (!Number.isInteger(lastPick) || lastPick < 0) return { ok: false };
  const trimmed = text.trim();
  if (!/^[0-9]+$/.test(trimmed)) return { ok: false };
  const pick = Number(trimmed);
  if (!Number.isSafeInteger(pick) || pick > lastPick) return { ok: false };
  return { ok: true, pick };
}

/** The end indices written as a list: ascending as given, a comma and a space between, nothing else (R11.3). */
function endList(ends: ReadonlyArray<number>): string {
  return ends.join(', ');
}

/** The end indices of the punched holes of a Bit_Line, ascending: the positions of `'1'`, and no other character counts. */
function punchedEnds(bits: string): number[] {
  const ends: number[] = [];
  for (let end = 0; end < bits.length; end += 1) {
    if (bits[end] === '1') ends.push(end);
  }
  return ends;
}

/**
 * The accessible name of one Line (R11.3, R11.4, R11.12). A `bits` Line names its pick and the end indices of its
 * punched holes in ascending order, read from the Bit_Line; a Line with none says no end is punched; a `damaged`
 * Line names its pick and the damaged card, and lists no end index. Every word comes from the Translation_File.
 */
export function lineAccessibleName(t: Translate, line: Line): string {
  if (line.kind === 'damaged') return t('codeview.line.nameDamaged', { pick: line.pick });
  const ends = punchedEnds(line.bits);
  if (ends.length === 0) return t('codeview.line.nameEmpty', { pick: line.pick });
  return t('codeview.line.name', { pick: line.pick, ends: endList(ends) });
}

/**
 * The accessible name of one Diff_Entry (R11.5): the kind word in the current language, the pick number or both
 * pick numbers, and for a `changed` entry the Changed_Holes in ascending order, so the marker character is never
 * the only statement of the kind.
 */
export function diffEntryAccessibleName(t: Translate, entry: DiffEntry): string {
  switch (entry.kind) {
    case 'unchanged':
      return t('codeview.diff.name.unchanged', { firstPick: entry.first.pick, secondPick: entry.second.pick });
    case 'changed':
      return t('codeview.diff.name.changed', {
        firstPick: entry.first.pick,
        secondPick: entry.second.pick,
        ends: endList([...entry.changedHoles].sort((a, b) => a - b)),
      });
    case 'added':
      return t('codeview.diff.name.added', { secondPick: entry.second.pick });
    case 'removed':
      return t('codeview.diff.name.removed', { firstPick: entry.first.pick });
  }
}
