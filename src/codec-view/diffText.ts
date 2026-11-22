import type { Diff, DiffCounts, DiffEntry, DiffRefusal, Line } from './types.ts';
import { groupBits } from './bits.ts';
import { lineKey } from './align.ts';

/** The one marker character each Diff_Entry kind is written with (R6.4). */
export const DIFF_MARKERS = { unchanged: ' ', changed: '~', added: '+', removed: '-' } as const;

/** The fixed characters of the Diff_Text format. None of them is a card dimension (R8.5). */
/** Written in a pick index field the entry has no index on (R6.14). */
const NO_PICK = '-';
/** Between the first Line_Set's pick index and the second Line_Set's (R6.14). */
const PICK_SEPARATOR = '/';
/** Between the marker, the pick index field and the Bit_Line (R6.14). */
const FIELD_SEPARATOR = ' ';
/** Between the lines of the Diff_Text; there is no trailing one (R6.5). */
const LINE_SEPARATOR = '\n';
/** Starts the summary line that holds the three Diff_Counts (R6.5). */
const SUMMARY_MARKER = '#';
/** Starts the one line a refused Diff gives, so it can never be read as an entry or a summary (R6.15). */
const REFUSAL_MARKER = '!';
/** Between the hookRows and the hookColumns of a side in the dimension-mismatch line. */
const DIMENSION_SEPARATOR = 'x';
/** Names the two sides of a refusal in the words the refusal carries them under. */
const FIRST_SIDE = 'first';
const SECOND_SIDE = 'second';
/** Names the Diff_Pick_Limit the too-many-picks refusal carries. */
const LIMIT_FIELD = 'limit';
/** Names, on the one line a value that is no Diff gives, what that value is (R1.8, R6.15). */
const NOT_A_DIFF = 'not-a-diff';

/**
 * Whether a value can be read field by field. `diffToText` is handed a Diff by its type, but it
 * must return a value and throw nothing whatever it is actually given (R1.8), so every field of
 * the given value is read through this guard before anything else looks at it.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Whether a value is a violation this module can write: the kind and the location `lineKey` reads
 * when it writes a damaged card in place of a Bit_Line (R6.4).
 */
function isWrittenViolation(value: unknown): boolean {
  return isRecord(value) && typeof value.kind === 'string' && typeof value.location === 'string';
}

/**
 * Whether a value is a Line this module can write: a pick index for its pick index field, and
 * either a Bit_Line to group or the violations written in place of one (R6.4, R6.14).
 */
function isLine(value: unknown): value is Line {
  if (!isRecord(value) || typeof value.pick !== 'number') return false;
  if (value.kind === 'bits') return typeof value.bits === 'string';
  if (value.kind !== 'damaged' || !Array.isArray(value.violations)) return false;
  const violations: ReadonlyArray<unknown> = value.violations;
  return violations.every(isWrittenViolation);
}

/**
 * Whether a value is a Diff_Entry this module can write: one of the four kinds of R6.4, carrying a
 * Line on each side that kind carries one (R6.14).
 *
 * A `changed` entry whose sides are damaged Lines passes too. It is not an entry `diffPatterns`
 * builds, because a damaged card carries no Bit_Line to compare, but `lineText` writes a damaged
 * Line as readily as a Bit_Line, so there is nothing here to refuse.
 */
function isDiffEntry(value: unknown): value is DiffEntry {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'unchanged':
    case 'changed':
      return isLine(value.first) && isLine(value.second);
    case 'added':
      return isLine(value.second);
    case 'removed':
      return isLine(value.first);
    default:
      return false;
  }
}

/** Whether a side of a dimension-mismatch refusal carries the hookRows and hookColumns R6.9 names. */
function hasHookCounts(value: unknown): boolean {
  return (
    isRecord(value) && typeof value.hookRows === 'number' && typeof value.hookColumns === 'number'
  );
}

/**
 * Whether a value is one of the three refusals `diffPatterns` returns and no fourth (R5.1),
 * carrying the values its reason names (R6.9 to R6.11). The refusal line writes those values, so a
 * value carrying a reason it does not carry the values of is no refusal this module can write
 * (R1.8).
 */
function isRefusal(value: unknown): value is DiffRefusal {
  if (!isRecord(value)) return false;
  switch (value.reason) {
    case 'dimension-mismatch':
      return hasHookCounts(value.first) && hasHookCounts(value.second);
    case 'profile-mismatch':
      return (
        typeof value.firstProfileName === 'string' && typeof value.secondProfileName === 'string'
      );
    case 'too-many-picks':
      return (
        typeof value.limit === 'number' &&
        typeof value.firstPicks === 'number' &&
        typeof value.secondPicks === 'number'
      );
    default:
      return false;
  }
}

/**
 * The Diff_Counts a value carries, or nothing where it carries no three numbers there. The summary
 * line writes them as decimal numerals (R6.5), so a value carrying anything else is no Diff this
 * module can write (R1.8).
 */
function countsCarriedBy(value: unknown): DiffCounts | undefined {
  if (!isRecord(value)) return undefined;
  const { changedHoles, addedCards, removedCards } = value;
  if (
    typeof changedHoles !== 'number' ||
    typeof addedCards !== 'number' ||
    typeof removedCards !== 'number'
  ) {
    return undefined;
  }
  return { changedHoles, addedCards, removedCards };
}

/**
 * The hookColumns written for a header that carries no number there. `groupBits` leaves a Bit_Line
 * ungrouped for a count that has no groups in it, so such a header costs the Group_Separators and
 * nothing else (R1.8). It is a "carries none" value and not a card dimension (R8.5).
 */
const NO_HOOK_COLUMNS = Number.NaN;

/**
 * The hookColumns a Line_Set header carries. It is the only field of either header the Diff_Text
 * reads: `groupBits` cuts a Bit_Line into groups of that many ends (R6.4).
 */
function hookColumnsCarriedBy(value: unknown): number {
  return isRecord(value) && typeof value.hookColumns === 'number'
    ? value.hookColumns
    : NO_HOOK_COLUMNS;
}

/**
 * Which field of a value handed to `diffToText` is not the field a Diff carries there: `ok`,
 * `refusal`, `entries`, one `entry` of that list, or `counts`.
 */
type DiffProblem = 'ok' | 'refusal' | 'entries' | 'entry' | 'counts';

/**
 * The one line a value that is not a Diff at all gives: REFUSAL_MARKER, NOT_A_DIFF and the field
 * that is not a Diff's. It has the shape R6.15 fixes for a refused Diff — a single line starting
 * '!' naming the problem, with no Diff_Entry line and no summary line — so it can never be read as
 * an entry or a summary. `not-a-diff` is none of the three refusal reasons, so the line cannot be
 * read as a refusal either.
 */
function notADiffLine(problem: DiffProblem): string {
  return [REFUSAL_MARKER, NOT_A_DIFF, problem].join(FIELD_SEPARATOR);
}

/**
 * What is written in place of a Line's Bit_Line: the Bit_Line with its Group_Separators for a card
 * read as bits (R6.4), and the lineKey text — 'x' and the violation kinds — for a damaged card,
 * which has no Bit_Line to write.
 */
function lineText(line: Line, hookColumns: number): string {
  return line.kind === 'bits' ? groupBits(line.bits, hookColumns) : lineKey(line);
}

/** One pick index field: the decimal numeral of a pick, or NO_PICK where the entry has no index (R6.14). */
function pickField(pick: number | undefined): string {
  return pick === undefined ? NO_PICK : String(pick);
}

/**
 * One Diff_Entry as `<marker> <firstPick>/<secondPick> <grouped Bit_Line>`, the Bit_Line being the
 * second Line_Set's for an added or changed entry and the first Line_Set's for an unchanged or
 * removed entry, and the pick index fields unpadded (R6.4, R6.14).
 */
function entryLine(entry: DiffEntry, firstHookColumns: number, secondHookColumns: number): string {
  const written = writtenSide(entry, firstHookColumns, secondHookColumns);
  return [
    DIFF_MARKERS[entry.kind],
    `${pickField(written.firstPick)}${PICK_SEPARATOR}${pickField(written.secondPick)}`,
    lineText(written.line, written.hookColumns),
  ].join(FIELD_SEPARATOR);
}

/** The two pick index fields of an entry and the one Line, with its hookColumns, that is written. */
function writtenSide(
  entry: DiffEntry,
  firstHookColumns: number,
  secondHookColumns: number,
): { firstPick: number | undefined; secondPick: number | undefined; line: Line; hookColumns: number } {
  switch (entry.kind) {
    case 'unchanged':
      return {
        firstPick: entry.first.pick,
        secondPick: entry.second.pick,
        line: entry.first,
        hookColumns: firstHookColumns,
      };
    case 'changed':
      return {
        firstPick: entry.first.pick,
        secondPick: entry.second.pick,
        line: entry.second,
        hookColumns: secondHookColumns,
      };
    case 'added':
      return {
        firstPick: undefined,
        secondPick: entry.second.pick,
        line: entry.second,
        hookColumns: secondHookColumns,
      };
    case 'removed':
      return {
        firstPick: entry.first.pick,
        secondPick: undefined,
        line: entry.first,
        hookColumns: firstHookColumns,
      };
  }
}

/**
 * The summary line: SUMMARY_MARKER and the three Diff_Counts as decimal numerals separated by
 * single spaces, in the order changed holes, added cards, removed cards (R6.5).
 */
function summaryLine(counts: DiffCounts): string {
  return [SUMMARY_MARKER, counts.changedHoles, counts.addedCards, counts.removedCards].join(
    FIELD_SEPARATOR,
  );
}

/**
 * The one line a refused Diff gives: REFUSAL_MARKER, the refusal reason and the values that refusal
 * carries, and no entry line and no summary line (R6.15).
 */
function refusalLine(refusal: DiffRefusal): string {
  switch (refusal.reason) {
    case 'dimension-mismatch':
      return [
        REFUSAL_MARKER,
        refusal.reason,
        FIRST_SIDE,
        `${refusal.first.hookRows}${DIMENSION_SEPARATOR}${refusal.first.hookColumns}`,
        SECOND_SIDE,
        `${refusal.second.hookRows}${DIMENSION_SEPARATOR}${refusal.second.hookColumns}`,
      ].join(FIELD_SEPARATOR);
    case 'profile-mismatch':
      return [
        REFUSAL_MARKER,
        refusal.reason,
        FIRST_SIDE,
        refusal.firstProfileName,
        SECOND_SIDE,
        refusal.secondProfileName,
      ].join(FIELD_SEPARATOR);
    case 'too-many-picks':
      return [
        REFUSAL_MARKER,
        refusal.reason,
        LIMIT_FIELD,
        refusal.limit,
        FIRST_SIDE,
        refusal.firstPicks,
        SECOND_SIDE,
        refusal.secondPicks,
      ].join(FIELD_SEPARATOR);
    default:
      // Unreachable: `isRefusal` has already read the reason as one of the three the design allows
      // (R5.1). Written out so that this function returns a line for every value it is handed and
      // never no value at all (R1.8).
      return notADiffLine('refusal');
  }
}

/**
 * The Diff as plain text: one line per Diff_Entry as `<marker> <firstPick>/<secondPick> <grouped
 * Bit_Line>`, then a summary line starting '#' holding the three Diff_Counts (R6.4, R6.5, R6.14).
 * The lines are joined with a single newline and there is no trailing newline; a Diff with no
 * Diff_Entries is the summary line alone (R6.5).
 *
 * A refused Diff gives one line starting '!' naming the reason and the values it carries, with no
 * entry line and no summary line (R6.15).
 *
 * A value that is not a Diff at all gives one line of that same shape, starting '!' and naming
 * `not-a-diff` and the field it does not carry as a Diff carries it: a value that cannot be read
 * field by field or carries no `ok`, a refused Diff carrying no reason of the three or not the
 * values that reason names, a Diff carrying no list of Diff_Entries or a list holding something
 * that is no Diff_Entry, and a Diff carrying no Diff_Counts. That keeps `diffToText` total without
 * writing a partial Diff_Text, in which a missing count or a dropped entry would read as a true
 * report of the comparison (R1.8).
 */
export function diffToText(diff: Diff): string {
  const given: unknown = diff;
  if (!isRecord(given) || typeof given.ok !== 'boolean') return notADiffLine('ok');
  if (!given.ok) {
    return isRefusal(given.refusal) ? refusalLine(given.refusal) : notADiffLine('refusal');
  }
  if (!Array.isArray(given.entries)) return notADiffLine('entries');
  const counts = countsCarriedBy(given.counts);
  if (counts === undefined) return notADiffLine('counts');

  const firstHookColumns = hookColumnsCarriedBy(given.first);
  const secondHookColumns = hookColumnsCarriedBy(given.second);
  const entries: ReadonlyArray<unknown> = given.entries;
  const lines: string[] = [];
  for (const entry of entries) {
    if (!isDiffEntry(entry)) return notADiffLine('entry');
    lines.push(entryLine(entry, firstHookColumns, secondHookColumns));
  }
  return [...lines, summaryLine(counts)].join(LINE_SEPARATOR);
}
