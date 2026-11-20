import type { Violation } from '../codec/index.ts';
import { alignLines, lineKey } from './align.ts';
import type {
  ApplyFailure,
  ApplyResult,
  BitLine,
  Diff,
  DiffCounts,
  DiffEntry,
  DiffRefusal,
  Line,
  LineSet,
  LineSetHeader,
} from './types.ts';

/**
 * The largest number of picks per side that diffPatterns accepts (R6.11). It is a module constant,
 * the same on every run (R6.12): the quadratic alignment at this many Lines per side costs about
 * 23 MB and 20 ms on the development machine.
 */
export const DIFF_PICK_LIMIT = 2000;

/** The header of a Line_Set, without its Lines. */
function headerOf(lineSet: LineSet): LineSetHeader {
  return {
    profileName: lineSet.profileName,
    hookRows: lineSet.hookRows,
    hookColumns: lineSet.hookColumns,
    endsPerPick: lineSet.endsPerPick,
  };
}

/**
 * Whether a value can be read field by field. `diffPatterns` is handed a Line_Set by its type, but
 * it must return a value and throw nothing whatever it is actually given (R1.8), so every field of
 * a side is read through this guard before anything else looks at it.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Whether a value is a Line: a card read as bits, or a card damaged and carrying its violations. */
function isLine(value: unknown): value is Line {
  if (!isRecord(value)) return false;
  if (value.kind === 'bits') return typeof value.bits === 'string';
  return value.kind === 'damaged' && Array.isArray(value.violations) && value.violations.every(isRecord);
}

/**
 * The Lines of a Line_Set. A side carrying no list of Lines reads as no Lines, and a list holding
 * something that is not a Line keeps only the Lines, so the Alignment is always over Lines that
 * carry a key and nothing here throws (R1.8). For a Line_Set from `patternToLines` every element
 * is a Line, so this returns the list unchanged.
 */
function linesOf(lineSet: LineSet): ReadonlyArray<Line> {
  const value: unknown = lineSet;
  if (!isRecord(value) || !Array.isArray(value.lines)) return [];
  const lines: ReadonlyArray<unknown> = value.lines;
  return lines.filter(isLine);
}

/** The number of picks a side carries, which is the length of its list of Lines (R6.11). */
function pickCountOf(lineSet: LineSet): number {
  const value: unknown = lineSet;
  return isRecord(value) && Array.isArray(value.lines) ? value.lines.length : 0;
}

/** The Card_Profile name written for a side that carries none, so it differs from any name (R6.10). */
const NO_PROFILE_NAME = '';
/**
 * The hookRows or hookColumns written for a side that carries no number there (R6.9). Two sides
 * that both carry none never read as equal, because this value equals nothing, not even itself, so
 * a value that is not a Line_Set at all is always refused before any work is done on it.
 */
const NO_DIMENSION = Number.NaN;

/** The card geometry a refusal compares: the Card_Profile name and the two hook counts (R6.9, R6.10). */
type HeaderFields = { profileName: string; hookRows: number; hookColumns: number };

/** The Card_Profile name and hook counts a side carries, and the "carries none" values where it does not. */
function headerFieldsOf(lineSet: LineSet): HeaderFields {
  const value: unknown = lineSet;
  if (!isRecord(value)) {
    return { profileName: NO_PROFILE_NAME, hookRows: NO_DIMENSION, hookColumns: NO_DIMENSION };
  }
  return {
    profileName: typeof value.profileName === 'string' ? value.profileName : NO_PROFILE_NAME,
    hookRows: typeof value.hookRows === 'number' ? value.hookRows : NO_DIMENSION,
    hookColumns: typeof value.hookColumns === 'number' ? value.hookColumns : NO_DIMENSION,
  };
}

/**
 * The reason `diffPatterns` refuses the two sides, or nothing where it compares them. The three
 * reasons are checked in this order and before any other work: `profile-mismatch` carrying both
 * Card_Profile names (R6.10), `dimension-mismatch` carrying the hookRows and hookColumns of both
 * sides (R6.9), `too-many-picks` carrying the Diff_Pick_Limit and the pick count of both sides
 * (R6.11). Nothing here reads a Line, so no refusal costs the Alignment.
 *
 * A value that is not a Line_Set at all carries no Card_Profile name and no hook counts, so it is
 * refused here too, by the reason that is true of it: `profile-mismatch` against a real Line_Set,
 * whose name it cannot match, and `dimension-mismatch` where neither side carries hook counts.
 * These are the three refusal reasons the design allows and no fourth (R5.1).
 */
function refusalFor(first: LineSet, second: LineSet): DiffRefusal | undefined {
  const firstHeader = headerFieldsOf(first);
  const secondHeader = headerFieldsOf(second);
  if (firstHeader.profileName !== secondHeader.profileName) {
    return {
      reason: 'profile-mismatch',
      firstProfileName: firstHeader.profileName,
      secondProfileName: secondHeader.profileName,
    };
  }
  if (
    firstHeader.hookRows !== secondHeader.hookRows ||
    firstHeader.hookColumns !== secondHeader.hookColumns
  ) {
    return {
      reason: 'dimension-mismatch',
      first: { hookRows: firstHeader.hookRows, hookColumns: firstHeader.hookColumns },
      second: { hookRows: secondHeader.hookRows, hookColumns: secondHeader.hookColumns },
    };
  }
  const firstPicks = pickCountOf(first);
  const secondPicks = pickCountOf(second);
  if (firstPicks > DIFF_PICK_LIMIT || secondPicks > DIFF_PICK_LIMIT) {
    return { reason: 'too-many-picks', limit: DIFF_PICK_LIMIT, firstPicks, secondPicks };
  }
  return undefined;
}

/**
 * The Changed_Holes of two Bit_Lines: the end positions at which they differ, each listed once and
 * in ascending end order (R5.5). It reads the two Bit_Lines the same way round about, so the
 * Changed_Holes of a changed entry do not depend on which Line_Set came first (R6.2).
 *
 * The walk runs to the longer of the two Bit_Lines, so a Line_Set whose Bit_Line is shorter than
 * its Ends_Per_Pick still gives every differing end position and never reads past either string.
 */
function changedHolesBetween(firstBits: BitLine, secondBits: BitLine): number[] {
  const ends = Math.max(firstBits.length, secondBits.length);
  const changedHoles: number[] = [];
  for (let end = 0; end < ends; end += 1) {
    if (firstBits[end] !== secondBits[end]) changedHoles.push(end);
  }
  return changedHoles;
}

/**
 * Whether the caller's first side is the canonical first side of the pair, under the same total
 * order on sequences of Lines that `alignLines` canonicalises by: the number of Lines first, then
 * key by key as strings, the first difference deciding. It reads only the two sequences of keys,
 * never the order they were passed in.
 *
 * Only one thing turns on it: a pair in which at least one side is damaged becomes a separate
 * removed and an added entry, and the entry of the canonical-first side is written first. That is
 * what makes the Diff of the second Line_Set against the first the mirror of the Diff the other
 * way round, entry for entry and in the same order (R5.9).
 */
function firstSideIsCanonical(
  firstKeys: ReadonlyArray<string>,
  secondKeys: ReadonlyArray<string>,
): boolean {
  if (firstKeys.length !== secondKeys.length) {
    return firstKeys.length < secondKeys.length;
  }
  for (let at = 0; at < firstKeys.length; at += 1) {
    if (firstKeys[at] !== secondKeys[at]) {
      return firstKeys[at] < secondKeys[at];
    }
  }
  // The two sequences compare equal, so the caller's pair is the canonical pair.
  return true;
}

/**
 * The Diff_Entries of one block of the Alignment: the Lines left unmatched between two consecutive
 * matches, before the first match, or after the last match, each side in ascending pick index
 * order (R5.4).
 *
 * The k-th unmatched Line of the first side is paired with the k-th of the second, up to the
 * smaller of the two counts; a pair of bits Lines whose Bit_Lines differ is one changed entry with
 * its Changed_Holes; a pair a changed entry cannot hold, because at least one side is damaged and
 * so carries no Bit_Line, becomes a separate removed and added entry (R5.3, R5.5). The leftovers
 * of the longer side, which are the Lines of that block with the highest pick indices, are removed
 * on the first side and added on the second, so one block never holds both leftover kinds (R5.4).
 * No pair crosses a block, because the two blocks are all this reads.
 */
function blockEntries(
  firstBlock: ReadonlyArray<Line>,
  secondBlock: ReadonlyArray<Line>,
  firstIsCanonical: boolean,
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const paired = Math.min(firstBlock.length, secondBlock.length);
  for (let at = 0; at < paired; at += 1) {
    const fromFirst = firstBlock[at];
    const fromSecond = secondBlock[at];
    if (fromFirst.kind === 'bits' && fromSecond.kind === 'bits') {
      const changedHoles = changedHolesBetween(fromFirst.bits, fromSecond.bits);
      if (changedHoles.length > 0) {
        entries.push({ kind: 'changed', first: fromFirst, second: fromSecond, changedHoles });
      } else {
        // Unreachable through alignLines: two unmatched Lines of one block with equal Bit_Lines
        // would have lengthened the common subsequence and so been matched. Written out, rather
        // than left to the changed branch, so that no changed entry can ever hold no Changed_Hole
        // (R5.5).
        entries.push({ kind: 'unchanged', first: fromFirst, second: fromSecond });
      }
      continue;
    }
    const removed: DiffEntry = { kind: 'removed', first: fromFirst };
    const added: DiffEntry = { kind: 'added', second: fromSecond };
    entries.push(...(firstIsCanonical ? [removed, added] : [added, removed]));
  }
  for (let at = paired; at < firstBlock.length; at += 1) {
    entries.push({ kind: 'removed', first: firstBlock[at] });
  }
  for (let at = paired; at < secondBlock.length; at += 1) {
    entries.push({ kind: 'added', second: secondBlock[at] });
  }
  return entries;
}

/**
 * The Diff_Counts of a list of Diff_Entries: the Changed_Holes summed over the changed entries,
 * the number of added entries and the number of removed entries (R6.1). An added or a removed
 * entry counts in its own count alone, so no punched hole of an added or a removed card is counted
 * as a Changed_Hole (R6.3).
 */
function countsOf(entries: ReadonlyArray<DiffEntry>): DiffCounts {
  let changedHoles = 0;
  let addedCards = 0;
  let removedCards = 0;
  for (const entry of entries) {
    if (entry.kind === 'changed') changedHoles += entry.changedHoles.length;
    else if (entry.kind === 'added') addedCards += 1;
    else if (entry.kind === 'removed') removedCards += 1;
  }
  return { changedHoles, addedCards, removedCards };
}

/**
 * The Diff of two Line_Sets: either a refusal (profile-mismatch, dimension-mismatch or
 * too-many-picks, checked in that order) or the Diff_Entries in Alignment order with the
 * Diff_Counts (R5.1, R5.3 to R5.7, R6.1, R6.3, R6.9 to R6.11).
 *
 * The matched pairs of the Alignment split the two sides into blocks; each block's entries come
 * first and then the unchanged entry of the match that closes it, so the entries are in Alignment
 * order and the first-side and second-side pick indices each strictly increase across the entries
 * that carry them (R5.6). Nothing is read but the two Line_Sets and nothing is written to them, so
 * the same two Line_Sets always give the same Diff and both come back unchanged (R5.7).
 *
 * The refusals are checked first, so a refused pair costs no Alignment.
 */
export function diffPatterns(first: LineSet, second: LineSet): Diff {
  const refusal = refusalFor(first, second);
  if (refusal !== undefined) return { ok: false, refusal };

  const firstLines = linesOf(first);
  const secondLines = linesOf(second);
  const firstIsCanonical = firstSideIsCanonical(firstLines.map(lineKey), secondLines.map(lineKey));
  const matched = alignLines(firstLines, secondLines);

  const entries: DiffEntry[] = [];
  let firstFrom = 0;
  let secondFrom = 0;
  for (const pair of matched) {
    entries.push(
      ...blockEntries(
        firstLines.slice(firstFrom, pair.firstPick),
        secondLines.slice(secondFrom, pair.secondPick),
        firstIsCanonical,
      ),
    );
    // The match that closes the block: two Lines of equal key, so equal Bit_Lines or two cards
    // damaged alike (R5.3).
    entries.push({
      kind: 'unchanged',
      first: firstLines[pair.firstPick],
      second: secondLines[pair.secondPick],
    });
    firstFrom = pair.firstPick + 1;
    secondFrom = pair.secondPick + 1;
  }
  // The block after the last match, which is the whole of both sides when nothing matched.
  entries.push(
    ...blockEntries(firstLines.slice(firstFrom), secondLines.slice(secondFrom), firstIsCanonical),
  );

  return {
    ok: true,
    first: headerOf(first),
    second: headerOf(second),
    entries,
    counts: countsOf(entries),
  };
}

/** The header written for a value that carries none of a header's four fields. */
const NO_HEADER: LineSetHeader = {
  profileName: NO_PROFILE_NAME,
  hookRows: NO_DIMENSION,
  hookColumns: NO_DIMENSION,
  endsPerPick: NO_DIMENSION,
};

/**
 * The header a value carries, field by field, and the "carries none" value of `NO_HEADER` wherever
 * it carries no such field. `applyDiff` must return a value and throw nothing whatever it is given
 * (R1.8), so both the Line_Set and the Diff are read through this.
 */
function headerCarriedBy(value: unknown): LineSetHeader {
  if (!isRecord(value)) return NO_HEADER;
  return {
    profileName: typeof value.profileName === 'string' ? value.profileName : NO_PROFILE_NAME,
    hookRows: typeof value.hookRows === 'number' ? value.hookRows : NO_DIMENSION,
    hookColumns: typeof value.hookColumns === 'number' ? value.hookColumns : NO_DIMENSION,
    endsPerPick: typeof value.endsPerPick === 'number' ? value.endsPerPick : NO_DIMENSION,
  };
}

/**
 * Whether two headers are the same header: the same Card_Profile name, hookRows, hookColumns and
 * Ends_Per_Pick. The fields are compared with `Object.is`, so a field that carries no number reads
 * as equal to another that carries no number and a header is never reported as differing from
 * itself.
 */
function sameHeader(first: LineSetHeader, second: LineSetHeader): boolean {
  return (
    Object.is(first.profileName, second.profileName) &&
    Object.is(first.hookRows, second.hookRows) &&
    Object.is(first.hookColumns, second.hookColumns) &&
    Object.is(first.endsPerPick, second.endsPerPick)
  );
}

/** Whether a value is one of the three refusals `diffPatterns` returns and no fourth (R5.1). */
function isRefusal(value: unknown): value is DiffRefusal {
  if (!isRecord(value)) return false;
  return (
    value.reason === 'profile-mismatch' ||
    value.reason === 'dimension-mismatch' ||
    value.reason === 'too-many-picks'
  );
}

/** Whether two violations of a damaged card are the same violation, field by field. */
function sameViolation(first: Violation, second: Violation): boolean {
  return (
    first.kind === second.kind &&
    first.location === second.location &&
    first.message === second.message &&
    first.expected === second.expected &&
    first.actual === second.actual
  );
}

/**
 * Whether two Lines are the same Line: the same pick index and the same Bit_Line, or the same
 * violations in the same order for two damaged cards (R5.10). It compares by value and not by
 * identity, so a Diff carrying a copy of a Line of the given Line_Set is still applied.
 */
function sameLine(first: Line, second: Line): boolean {
  if (first.pick !== second.pick) return false;
  if (first.kind === 'bits') {
    return second.kind === 'bits' && first.bits === second.bits;
  }
  if (second.kind !== 'damaged' || first.violations.length !== second.violations.length) {
    return false;
  }
  return first.violations.every((violation, at) => sameViolation(violation, second.violations[at]));
}

/**
 * The two sides a Diff's entries carry: the Lines the `unchanged`, `changed` and `removed` entries
 * name on the first side, which must be exactly the Lines of the given Line_Set, and the Lines the
 * `unchanged`, `changed` and `added` entries carry on the second side, which are the Lines of the
 * rebuilt Line_Set. A `removed` entry carries no second Line, so it builds nothing.
 *
 * Entries are read in order, and a value that is not a Diff_Entry names no Line and builds none,
 * so nothing here throws (R1.8). For a Diff that `diffPatterns` produced every entry is read.
 */
function sidesOf(entries: unknown): { named: ReadonlyArray<Line>; built: ReadonlyArray<Line> } {
  const named: Line[] = [];
  const built: Line[] = [];
  if (!Array.isArray(entries)) return { named, built };
  const values: ReadonlyArray<unknown> = entries;
  for (const value of values) {
    if (!isRecord(value)) continue;
    const kind = value.kind;
    const namesFirst = kind === 'unchanged' || kind === 'changed' || kind === 'removed';
    const carriesSecond = kind === 'unchanged' || kind === 'changed' || kind === 'added';
    if (namesFirst && isLine(value.first)) named.push(value.first);
    if (carriesSecond && isLine(value.second)) built.push(value.second);
  }
  return { named, built };
}

/**
 * Why the entries do not name, in ascending pick index order, exactly the Lines of the given
 * Line_Set, or nothing where they do (R5.10). The failure carries the pick index at which the two
 * part company.
 */
function linesMismatch(
  lines: ReadonlyArray<Line>,
  named: ReadonlyArray<Line>,
): ApplyFailure | undefined {
  for (let at = 1; at < named.length; at += 1) {
    if (named[at].pick <= named[at - 1].pick) {
      return {
        reason: 'lines-mismatch',
        pick: named[at].pick,
        message: `the diff names the card at pick ${named[at].pick} after the card at pick ${named[at - 1].pick}, so its entries are not in ascending pick index order`,
      };
    }
  }
  const paired = Math.min(lines.length, named.length);
  for (let at = 0; at < paired; at += 1) {
    if (!sameLine(named[at], lines[at])) {
      return {
        reason: 'lines-mismatch',
        pick: lines[at].pick,
        message: `the diff names a different card where the given Line_Set holds the card at pick ${lines[at].pick}`,
      };
    }
  }
  if (named.length < lines.length) {
    const unnamed = lines[named.length];
    return {
      reason: 'lines-mismatch',
      pick: unnamed.pick,
      message: `the diff names no card at pick ${unnamed.pick} of the given Line_Set`,
    };
  }
  if (named.length > lines.length) {
    const extra = named[lines.length];
    return {
      reason: 'lines-mismatch',
      pick: extra.pick,
      message: `the diff names a card at pick ${extra.pick}, which the given Line_Set does not hold`,
    };
  }
  return undefined;
}

/** The same Line at another pick index, built fresh so no Line of a given Line_Set is written to. */
function atPick(line: Line, pick: number): Line {
  return line.kind === 'bits'
    ? { kind: 'bits', pick, bits: line.bits }
    : { kind: 'damaged', pick, violations: line.violations };
}

/**
 * The second Line_Set of a Diff, rebuilt from the first Line_Set the Diff was taken against
 * (R5.8): the `unchanged`, `changed` and `added` entries each contribute their second Line, a
 * `removed` entry contributes nothing, the Lines are renumbered from pick 0 upwards, and the
 * header is the Diff's second header.
 *
 * Three things come back as a failure value, with no Line_Set (R5.10): a Diff that is a refusal,
 * as `refused-diff` carrying that refusal; a Diff whose first header differs from the given
 * Line_Set's, as `header-mismatch` carrying both headers; and entries that do not name, in
 * ascending pick index order, exactly the Lines of the given Line_Set, as `lines-mismatch`
 * carrying the pick index at which the two part company.
 *
 * The renumbering is a no-op for a Diff that `diffPatterns` produced, because the second side's
 * pick indices already ascend from 0 with no gap (R1.6). The given Line_Set is only read, never
 * written to, and every Line of the result is built fresh (R5.8, R5.10).
 *
 * A value that is not a Diff at all carries no header, so it cannot be the Diff of this Line_Set
 * and comes back as `header-mismatch` naming the header the Line_Set has and the none it carries.
 * That keeps `applyDiff` total without a fourth failure reason (R1.8).
 */
export function applyDiff(first: LineSet, diff: Diff): ApplyResult {
  const given: unknown = diff;
  const expected = headerCarriedBy(first);

  if (!isRecord(given) || given.ok !== true) {
    const refusal: unknown = isRecord(given) ? given.refusal : undefined;
    if (isRefusal(refusal)) {
      return { ok: false, failure: { reason: 'refused-diff', refusal } };
    }
    return { ok: false, failure: { reason: 'header-mismatch', expected, actual: NO_HEADER } };
  }

  const actual = headerCarriedBy(given.first);
  if (!sameHeader(actual, expected)) {
    return { ok: false, failure: { reason: 'header-mismatch', expected, actual } };
  }

  const sides = sidesOf(given.entries);
  const mismatch = linesMismatch(linesOf(first), sides.named);
  if (mismatch !== undefined) {
    return { ok: false, failure: mismatch };
  }

  return {
    ok: true,
    lineSet: {
      ...headerCarriedBy(given.second),
      lines: sides.built.map((line, pick) => atPick(line, pick)),
    },
  };
}
