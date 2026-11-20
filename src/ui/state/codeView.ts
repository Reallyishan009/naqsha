import type { DiffEntry, Line } from '../../codec-view/index.ts';
import type { Translate } from '../i18n/messages.ts';
import type { AppAction } from '../types.ts';

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

/** The controls of the Code_View_Screen that move the Selected_Pick on purpose (R3.1, R3.2, R3.4, R3.8). */
export type PickControl = 'step-back' | 'step-forward' | 'jump' | 'run-to-next-breakpoint';

export type PickControlInput = {
  control: PickControl;
  selectedPick: number;
  pickCount: number;
  breakpoints: Breakpoints;
  /** What the jump control holds; read only when `control` is `'jump'`. */
  jumpText?: string;
};

export type PickControlOutcome = {
  /** What the screen dispatches, in order: nothing, or one `select-pick` and at most one `announce`. */
  actions: ReadonlyArray<AppAction>;
  /** True when the jump control was applied with a value outside 0 to the last pick index (R3.5). */
  jumpRejected: boolean;
  /** True when "run to next breakpoint" found no Breakpoint above the Selected_Pick (R3.9). */
  noFurtherBreakpoint: boolean;
};

const NO_ACTIONS: ReadonlyArray<AppAction> = [];

function movedTo(pick: number, selectedPick: number): ReadonlyArray<AppAction> {
  const select: AppAction = { type: 'select-pick', pick };
  // The pick is announced once per deliberate move, and only when the Selected_Pick changes (R11.6).
  return pick === selectedPick
    ? [select]
    : [select, { type: 'announce', kind: 'confirmation', messageKey: 'codeview.announce.pick', params: { pick } }];
}

/**
 * What activating a Code view control does, as the actions to dispatch (R3.1 to R3.5, R3.8, R3.9, R3.12, R11.6).
 * Pure and total. A step beyond the first or the last pick index, and any control on a Current_Pattern with no
 * picks, gives no action and no error, so activating a disabled control changes nothing. The Breakpoints are never
 * an output: no control but the Line's own breakpoint control changes them.
 *
 * "Run to next breakpoint" is one `select-pick` straight to `nextBreakpoint`. When none lies above, it stops at the
 * last pick index and announces `codeview.announce.noBreakpoint` instead of the pick, because the live region holds
 * one message and the second would replace the first.
 */
export function pickControlOutcome(input: PickControlInput): PickControlOutcome {
  const { control, selectedPick, pickCount, breakpoints } = input;
  const idle: PickControlOutcome = { actions: NO_ACTIONS, jumpRejected: false, noFurtherBreakpoint: false };
  if (!Number.isInteger(pickCount) || pickCount <= 0) return idle;
  const lastPick = pickCount - 1;

  switch (control) {
    case 'step-forward':
      return selectedPick >= lastPick ? idle : { ...idle, actions: movedTo(selectedPick + 1, selectedPick) };
    case 'step-back':
      return selectedPick <= 0 ? idle : { ...idle, actions: movedTo(selectedPick - 1, selectedPick) };
    case 'jump': {
      const jump = parseJump(input.jumpText ?? '', lastPick);
      return jump.ok ? { ...idle, actions: movedTo(jump.pick, selectedPick) } : { ...idle, jumpRejected: true };
    }
    case 'run-to-next-breakpoint': {
      const next = nextBreakpoint(breakpoints, selectedPick, lastPick);
      if (next.found) return { ...idle, actions: movedTo(next.pick, selectedPick) };
      return {
        ...idle,
        noFurtherBreakpoint: true,
        actions: [
          { type: 'select-pick', pick: next.pick },
          { type: 'announce', kind: 'confirmation', messageKey: 'codeview.announce.noBreakpoint' },
        ],
      };
    }
  }
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

/** The two kinds of control a Line carries: its breakpoint control and its Bit_Line region (R11.13). */
export type LineControlKind = 'breakpoint' | 'bit-line';

/** The control of a Line that had keyboard focus: its kind and the pick index of its Line. */
export type FocusedLineControl = { kind: LineControlKind; pick: number };

/** Where focus goes after a Window move: a control of a Line, or the step forward control. */
export type FocusTarget = FocusedLineControl | 'step-forward';

/**
 * Where keyboard focus goes when the Window moved (R11.13). `focused` is the control that had focus before the move.
 * It gives null while the Line of that control is still in the Window, because focus did not leave the document.
 * Otherwise it gives the same kind of control on the Line of the Selected_Pick, or `'step-forward'` where that Line
 * has none: the Selected_Pick's Line is not in the Window, or it is a `damaged` Line, which has a breakpoint control
 * and no Bit_Line region. `selectedLineKind` is the kind of the Selected_Pick's Line, or null when there is none.
 * Pure and total.
 */
export function focusTargetAfterWindowMove(
  focused: FocusedLineControl,
  pickWindow: PickWindow,
  selectedPick: number,
  selectedLineKind: Line['kind'] | null,
): FocusTarget | null {
  const inWindow = (pick: number): boolean => pick >= pickWindow.from && pick < pickWindow.from + pickWindow.count;
  if (inWindow(focused.pick)) return null;
  if (!inWindow(selectedPick) || selectedLineKind === null) return 'step-forward';
  if (focused.kind === 'bit-line' && selectedLineKind !== 'bits') return 'step-forward';
  return { kind: focused.kind, pick: selectedPick };
}
