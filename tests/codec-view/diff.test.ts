/**
 * `diffPatterns`: the Diff_Entries and the Diff_Counts (task 1.9, R5.1, R5.3 to R5.7, R6.1, R6.3).
 *
 * Every card below is built from one generated Card_Profile, so no card dimension and no
 * Ends_Per_Pick value is written here, and every Bit_Line a test compares against comes from
 * `cardToBits` rather than from a string typed out by hand.
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  encodeCardGrid,
  type CardGrid,
  type CardProfile,
  type Pattern,
} from '../../src/codec/index.ts';
import {
  DIFF_PICK_LIMIT,
  applyDiff,
  cardToBits,
  diffPatterns,
  patternToLines,
  type ApplyFailure,
  type BitLine,
  type Diff,
  type DiffEntry,
  type DiffRefusal,
  type Line,
  type LineSet,
  type LineSetHeader,
} from '../../src/codec-view/index.ts';
import { cardGridArbitrary, profileArbitrary } from '../support/profiles.ts';
import { lineSetArbitrary } from '../support/lineSets.ts';
import { patternArbitrary } from '../support/patterns.ts';

/** One generated Card_Profile, drawn at a fixed seed so every example below reads the same card. */
function exampleProfile(): CardProfile {
  const [sampled] = fc.sample(profileArbitrary, { seed: 20901, numRuns: 1 });
  if (sampled === undefined) throw new Error('profileArbitrary produced no Card_Profile');
  return sampled;
}

const profile = exampleProfile();

/** A card for this profile, each hook position punched where `punched` says so. */
function cardWhere(punched: (hookRow: number, hookColumn: number) => boolean): CardGrid {
  return Array.from({ length: profile.hookRows }, (_, hookRow) =>
    Array.from({ length: profile.hookColumns }, (_, hookColumn) => punched(hookRow, hookColumn)),
  );
}

/** A card with one punched hole, at that hook position alone. */
function cardPunchedAt(atHookRow: number, atHookColumn: number): CardGrid {
  return cardWhere((hookRow, hookColumn) => hookRow === atHookRow && hookColumn === atHookColumn);
}

const unpunchedCard = cardWhere(() => false);
const fullyPunchedCard = cardWhere(() => true);
/** Three cards of one punched hole each, so their Bit_Lines differ from one another at two ends. */
const firstHookPunchedCard = cardPunchedAt(0, 0);
const secondHookPunchedCard = cardPunchedAt(0, 1);
const thirdHookPunchedCard = cardPunchedAt(1, 0);
/** A card that fails validateCardGrid, so patternToLines writes a damaged Line for it (R1.9). */
const damagedCard = 'not-a-card';
/** A second damaged card, damaged differently, so its damaged Line carries other violations. */
const otherDamagedCard = [[true]];

/**
 * The end the ends list from `encodeCardGrid` lifts for one hook position. The ends list is the
 * only mapping from a hook position to an end (R1.3), so `endOrder` is never read here.
 */
function endAt(atHookRow: number, atHookColumn: number): number {
  const ends = encodeCardGrid(profile, cardPunchedAt(atHookRow, atHookColumn));
  if (!ends.ok) throw new Error('encodeCardGrid refused a card built for this Card_Profile');
  const end = ends.value.indexOf(true);
  if (end < 0) throw new Error('a card of one punched hole lifted no end');
  return end;
}

/**
 * The Line_Set of a Pattern; a refusal fails the test loudly instead of being swallowed. The cards
 * are typed unknown, so that a damaged card can stand in a Pattern beside the valid ones and come
 * out as a damaged Line (R1.9).
 */
function lineSetOf(pattern: ReadonlyArray<unknown>): LineSet {
  const lines = patternToLines(profile, pattern);
  if (!lines.ok) throw new Error(`patternToLines refused the Pattern: ${lines.failure.message}`);
  return lines.lineSet;
}

/** The Diff of two Line_Sets; a refusal fails the test, since these examples carry one header. */
function comparisonOf(first: LineSet, second: LineSet): Extract<Diff, { ok: true }> {
  const diff = diffPatterns(first, second);
  if (!diff.ok) throw new Error(`diffPatterns refused the comparison: ${diff.refusal.reason}`);
  return diff;
}

/** The pick index an entry carries on the first side, or null where it carries none. */
function firstPickOf(entry: DiffEntry): number | null {
  return entry.kind === 'added' ? null : entry.first.pick;
}

/** The pick index an entry carries on the second side, or null where it carries none. */
function secondPickOf(entry: DiffEntry): number | null {
  return entry.kind === 'removed' ? null : entry.second.pick;
}

/** R5.6: the pick indices each strictly increase across the entries that carry them. */
function expectPicksToStrictlyIncrease(entries: ReadonlyArray<DiffEntry>): void {
  let lastFirst = -1;
  let lastSecond = -1;
  for (const entry of entries) {
    const firstPick = firstPickOf(entry);
    if (firstPick !== null) {
      expect(firstPick).toBeGreaterThan(lastFirst);
      lastFirst = firstPick;
    }
    const secondPick = secondPickOf(entry);
    if (secondPick !== null) {
      expect(secondPick).toBeGreaterThan(lastSecond);
      lastSecond = secondPick;
    }
  }
}

/** The Line at that pick of a Line_Set, which is the Line an entry of that pick holds. */
function lineAt(lineSet: LineSet, pick: number): Line {
  const line = lineSet.lines[pick];
  if (line === undefined) throw new Error(`the Line_Set holds no Line at pick ${pick}`);
  return line;
}

describe('diffPatterns entries', () => {
  it('R6.1 R6.3 flipping one punched hole gives one changed entry naming that one changed hole', () => {
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard, unpunchedCard]);
    const second = lineSetOf([unpunchedCard, unpunchedCard, unpunchedCard]);

    const diff = comparisonOf(first, second);

    expect(diff.entries).toEqual([
      { kind: 'unchanged', first: lineAt(first, 0), second: lineAt(second, 0) },
      {
        kind: 'changed',
        first: lineAt(first, 1),
        second: lineAt(second, 1),
        changedHoles: [endAt(0, 0)],
      },
      { kind: 'unchanged', first: lineAt(first, 2), second: lineAt(second, 2) },
    ]);
    expect(diff.counts).toEqual({ changedHoles: 1, addedCards: 0, removedCards: 0 });
    expectPicksToStrictlyIncrease(diff.entries);
  });

  it('R5.4 R6.3 inserting one card gives one added entry and no changed hole', () => {
    const first = lineSetOf([unpunchedCard, fullyPunchedCard]);
    const second = lineSetOf([unpunchedCard, firstHookPunchedCard, fullyPunchedCard]);

    const diff = comparisonOf(first, second);

    expect(diff.entries).toEqual([
      { kind: 'unchanged', first: lineAt(first, 0), second: lineAt(second, 0) },
      { kind: 'added', second: lineAt(second, 1) },
      { kind: 'unchanged', first: lineAt(first, 1), second: lineAt(second, 2) },
    ]);
    expect(diff.counts).toEqual({ changedHoles: 0, addedCards: 1, removedCards: 0 });
    expectPicksToStrictlyIncrease(diff.entries);
  });

  it('R5.4 R6.3 deleting one card gives one removed entry and no changed hole', () => {
    const first = lineSetOf([unpunchedCard, fullyPunchedCard, firstHookPunchedCard]);
    const second = lineSetOf([unpunchedCard, firstHookPunchedCard]);

    const diff = comparisonOf(first, second);

    expect(diff.entries).toEqual([
      { kind: 'unchanged', first: lineAt(first, 0), second: lineAt(second, 0) },
      { kind: 'removed', first: lineAt(first, 1) },
      { kind: 'unchanged', first: lineAt(first, 2), second: lineAt(second, 1) },
    ]);
    expect(diff.counts).toEqual({ changedHoles: 0, addedCards: 0, removedCards: 1 });
    expectPicksToStrictlyIncrease(diff.entries);
  });

  it('R5.3 R5.4 one block holds a changed entry and the leftover added card of the longer side', () => {
    // Between the two matched picks the first side leaves one card unmatched and the second side
    // leaves two: the first pair becomes a changed entry, the leftover second card an added entry.
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard, fullyPunchedCard]);
    const second = lineSetOf([
      unpunchedCard,
      secondHookPunchedCard,
      thirdHookPunchedCard,
      fullyPunchedCard,
    ]);

    const diff = comparisonOf(first, second);

    expect(diff.entries).toEqual([
      { kind: 'unchanged', first: lineAt(first, 0), second: lineAt(second, 0) },
      {
        kind: 'changed',
        first: lineAt(first, 1),
        second: lineAt(second, 1),
        changedHoles: [endAt(0, 0), endAt(0, 1)].sort((a, b) => a - b),
      },
      { kind: 'added', second: lineAt(second, 2) },
      { kind: 'unchanged', first: lineAt(first, 2), second: lineAt(second, 3) },
    ]);
    expect(diff.counts).toEqual({ changedHoles: 2, addedCards: 1, removedCards: 0 });
    expectPicksToStrictlyIncrease(diff.entries);
  });

  it('R5.3 two identically damaged cards come out unchanged', () => {
    const first = lineSetOf([unpunchedCard, damagedCard, fullyPunchedCard]);
    const second = lineSetOf([unpunchedCard, damagedCard, firstHookPunchedCard]);

    const diff = comparisonOf(first, second);

    expect(diff.entries.map((entry) => entry.kind)).toEqual(['unchanged', 'unchanged', 'changed']);
    expect(diff.entries[1]).toEqual({
      kind: 'unchanged',
      first: lineAt(first, 1),
      second: lineAt(second, 1),
    });
    expect(lineAt(first, 1).kind).toBe('damaged');
    expect(diff.counts.addedCards).toBe(0);
    expect(diff.counts.removedCards).toBe(0);
  });

  it('R5.5 a pair where only one side is damaged becomes a separate removed and added entry', () => {
    // A changed entry has to hold two Bit_Lines, and a damaged Line carries none, so the pair
    // cannot be one changed entry.
    const first = lineSetOf([unpunchedCard, damagedCard, fullyPunchedCard]);
    const second = lineSetOf([unpunchedCard, firstHookPunchedCard, fullyPunchedCard]);

    const diff = comparisonOf(first, second);

    expect(diff.entries.map((entry) => entry.kind).sort()).toEqual([
      'added',
      'removed',
      'unchanged',
      'unchanged',
    ]);
    expect(diff.entries).toContainEqual({ kind: 'removed', first: lineAt(first, 1) });
    expect(diff.entries).toContainEqual({ kind: 'added', second: lineAt(second, 1) });
    expect(diff.counts).toEqual({ changedHoles: 0, addedCards: 1, removedCards: 1 });
    expectPicksToStrictlyIncrease(diff.entries);
  });

  it('R5.5 two cards damaged in different ways become a separate removed and added entry', () => {
    const first = lineSetOf([damagedCard]);
    const second = lineSetOf([otherDamagedCard]);

    const diff = comparisonOf(first, second);

    expect(diff.entries.map((entry) => entry.kind).sort()).toEqual(['added', 'removed']);
    expect(diff.counts).toEqual({ changedHoles: 0, addedCards: 1, removedCards: 1 });
  });

  it('R5.5 the removed and added entries of such a pair keep their order the other way round', () => {
    // The two kinds swap and the entries stay in the same order, which is what makes the Diff one
    // way round the mirror of the Diff the other way round (R5.9).
    const first = lineSetOf([unpunchedCard, damagedCard, fullyPunchedCard]);
    const second = lineSetOf([unpunchedCard, firstHookPunchedCard, fullyPunchedCard]);

    const forward = comparisonOf(first, second).entries.map((entry) => entry.kind);
    const backward = comparisonOf(second, first).entries.map((entry) => entry.kind);

    const mirrored = backward.map((kind) =>
      kind === 'added' ? 'removed' : kind === 'removed' ? 'added' : kind,
    );
    expect(mirrored).toEqual(forward);
  });

  it('R5.1 two Line_Sets with no Line give no entry and no count', () => {
    const empty = lineSetOf([]);

    const diff = comparisonOf(empty, empty);

    expect(diff.entries).toEqual([]);
    expect(diff.counts).toEqual({ changedHoles: 0, addedCards: 0, removedCards: 0 });
  });

  it('R5.1 a Line_Set against one with no Line gives one removed entry per card', () => {
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard]);
    const empty = lineSetOf([]);

    const removedDiff = comparisonOf(first, empty);
    const addedDiff = comparisonOf(empty, first);

    expect(removedDiff.entries).toEqual([
      { kind: 'removed', first: lineAt(first, 0) },
      { kind: 'removed', first: lineAt(first, 1) },
    ]);
    expect(removedDiff.counts).toEqual({ changedHoles: 0, addedCards: 0, removedCards: 2 });
    expect(addedDiff.entries).toEqual([
      { kind: 'added', second: lineAt(first, 0) },
      { kind: 'added', second: lineAt(first, 1) },
    ]);
    expect(addedDiff.counts).toEqual({ changedHoles: 0, addedCards: 2, removedCards: 0 });
  });

  it('R5.5 a changed entry names every end at which the two Bit_Lines differ, ascending', () => {
    const first = lineSetOf([unpunchedCard]);
    const second = lineSetOf([fullyPunchedCard]);

    const diff = comparisonOf(first, second);
    const [entry] = diff.entries;

    const unpunchedBits = cardToBits(profile, unpunchedCard);
    const fullyPunchedBits = cardToBits(profile, fullyPunchedCard);
    if (!unpunchedBits.ok || !fullyPunchedBits.ok) throw new Error('cardToBits refused a valid card');
    const everyEnd = Array.from({ length: unpunchedBits.bits.length }, (_, end) => end);

    expect(entry).toEqual({
      kind: 'changed',
      first: lineAt(first, 0),
      second: lineAt(second, 0),
      changedHoles: everyEnd,
    });
    expect(diff.counts.changedHoles).toBe(everyEnd.length);
  });

  it('R5.7 the same two Line_Sets give the same Diff and come back unchanged', () => {
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard, damagedCard]);
    const second = lineSetOf([firstHookPunchedCard, fullyPunchedCard]);
    const firstBefore = structuredClone(first);
    const secondBefore = structuredClone(second);

    const once = diffPatterns(first, second);
    const again = diffPatterns(first, second);

    expect(again).toEqual(once);
    expect(first).toEqual(firstBefore);
    expect(second).toEqual(secondBefore);
  });

  it('R5.6 the pick indices never go backwards across a Diff of several blocks', () => {
    const first = lineSetOf([
      unpunchedCard,
      firstHookPunchedCard,
      fullyPunchedCard,
      secondHookPunchedCard,
      thirdHookPunchedCard,
    ]);
    const second = lineSetOf([
      firstHookPunchedCard,
      fullyPunchedCard,
      thirdHookPunchedCard,
      unpunchedCard,
    ]);

    const diff = comparisonOf(first, second);

    expect(diff.entries.length).toBeGreaterThan(0);
    expectPicksToStrictlyIncrease(diff.entries);
    expect(diff.counts).toEqual({
      changedHoles: diff.entries.reduce(
        (sum, entry) => sum + (entry.kind === 'changed' ? entry.changedHoles.length : 0),
        0,
      ),
      addedCards: diff.entries.filter((entry) => entry.kind === 'added').length,
      removedCards: diff.entries.filter((entry) => entry.kind === 'removed').length,
    });
  });
});
/**
 * The three refusals of `diffPatterns` (task 1.10, R6.9, R6.10, R6.11, R6.12).
 *
 * Every carried value below is read off the Line_Sets under test or off `DIFF_PICK_LIMIT`, so no
 * card dimension and no Ends_Per_Pick value is written here as a literal.
 */

/** A value handed to `diffPatterns` in a Line_Set's place, which R1.8 says it must survive. */
function asGivenLineSet(value: unknown): LineSet {
  return value as LineSet;
}

/**
 * The refusal `diffPatterns` returned, having first checked that it returned no Diff_Entries and
 * no Diff_Counts: the refusal carries the reason and nothing else (R6.9, R6.10, R6.11).
 */
function refusalOf(first: LineSet, second: LineSet): DiffRefusal {
  const diff = diffPatterns(first, second);
  if (diff.ok) throw new Error('diffPatterns compared two Line_Sets it was meant to refuse');
  expect(Object.keys(diff).sort()).toEqual(['ok', 'refusal']);
  return diff.refusal;
}

/** The Line_Set of a Pattern for another Card_Profile, so its header carries that profile's name. */
function lineSetForProfile(forProfile: CardProfile, pattern: ReadonlyArray<unknown>): LineSet {
  const lines = patternToLines(forProfile, pattern);
  if (!lines.ok) throw new Error(`patternToLines refused the Pattern: ${lines.failure.message}`);
  return lines.lineSet;
}

/** The same Line repeated over that many picks, pick indices ascending from 0 (R1.6). */
function lineSetOfPicks(from: LineSet, picks: number): LineSet {
  const line = lineAt(from, 0);
  return { ...from, lines: Array.from({ length: picks }, (_, pick) => ({ ...line, pick })) };
}

describe('diffPatterns refusals', () => {
  it('R6.10 two different Card_Profile names are refused, carrying both names', () => {
    const otherProfile: CardProfile = { ...profile, name: `${profile.name}-loom-a` };
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard]);
    const second = lineSetForProfile(otherProfile, [unpunchedCard, firstHookPunchedCard]);

    expect(refusalOf(first, second)).toEqual({
      reason: 'profile-mismatch',
      firstProfileName: profile.name,
      secondProfileName: otherProfile.name,
    });
    expect(refusalOf(second, first)).toEqual({
      reason: 'profile-mismatch',
      firstProfileName: otherProfile.name,
      secondProfileName: profile.name,
    });
  });

  it('R6.9 different hookRows or hookColumns are refused, carrying both hook counts', () => {
    const first = lineSetOf([unpunchedCard]);
    const moreHookRows: LineSet = { ...first, hookRows: first.hookRows + 1 };
    const moreHookColumns: LineSet = { ...first, hookColumns: first.hookColumns + 1 };

    expect(refusalOf(first, moreHookRows)).toEqual({
      reason: 'dimension-mismatch',
      first: { hookRows: first.hookRows, hookColumns: first.hookColumns },
      second: { hookRows: first.hookRows + 1, hookColumns: first.hookColumns },
    });
    expect(refusalOf(first, moreHookColumns)).toEqual({
      reason: 'dimension-mismatch',
      first: { hookRows: first.hookRows, hookColumns: first.hookColumns },
      second: { hookRows: first.hookRows, hookColumns: first.hookColumns + 1 },
    });
  });

  it('R6.11 a side longer than the Diff_Pick_Limit is refused, carrying the limit and both pick counts', () => {
    const one = lineSetOf([firstHookPunchedCard]);
    const overLimit = lineSetOfPicks(one, DIFF_PICK_LIMIT + 1);
    const atLimit = lineSetOfPicks(one, DIFF_PICK_LIMIT);

    expect(refusalOf(overLimit, one)).toEqual({
      reason: 'too-many-picks',
      limit: DIFF_PICK_LIMIT,
      firstPicks: DIFF_PICK_LIMIT + 1,
      secondPicks: one.lines.length,
    });
    expect(refusalOf(one, overLimit)).toEqual({
      reason: 'too-many-picks',
      limit: DIFF_PICK_LIMIT,
      firstPicks: one.lines.length,
      secondPicks: DIFF_PICK_LIMIT + 1,
    });
    // The limit itself is accepted: it is the largest number of picks per side that is compared.
    expect(diffPatterns(atLimit, atLimit).ok).toBe(true);
  });

  it('R6.12 the Diff_Pick_Limit is a fixed whole number of at least 2,000 picks', () => {
    expect(DIFF_PICK_LIMIT).toBe(2000);
    expect(Number.isInteger(DIFF_PICK_LIMIT)).toBe(true);

    // Every refusal carries that one module constant, so the limit is the same on every run and
    // the same for every pair of Line_Sets.
    const one = lineSetOf([firstHookPunchedCard]);
    const other = lineSetOf([unpunchedCard, fullyPunchedCard]);
    const carried = [
      refusalOf(lineSetOfPicks(one, DIFF_PICK_LIMIT + 1), one),
      refusalOf(other, lineSetOfPicks(other, DIFF_PICK_LIMIT + 2)),
    ].map((refusal) => (refusal.reason === 'too-many-picks' ? refusal.limit : null));
    expect(carried).toEqual([DIFF_PICK_LIMIT, DIFF_PICK_LIMIT]);
  });

  it('R6.9 R6.10 R6.11 the reasons are checked in order: profile name, then dimensions, then picks', () => {
    const otherProfile: CardProfile = { ...profile, name: `${profile.name}-loom-a` };
    const one = lineSetOf([firstHookPunchedCard]);
    // A pair that breaks all three: a different profile name, different hook counts, too many picks.
    const everyFault: LineSet = {
      ...lineSetOfPicks(lineSetForProfile(otherProfile, [firstHookPunchedCard]), DIFF_PICK_LIMIT + 1),
      hookRows: one.hookRows + 1,
    };

    expect(refusalOf(one, everyFault).reason).toBe('profile-mismatch');
    // The same pair with the profile names agreeing falls to the dimension check, and with the
    // hook counts agreeing too, to the pick count.
    const sameName: LineSet = { ...everyFault, profileName: one.profileName };
    expect(refusalOf(one, sameName).reason).toBe('dimension-mismatch');
    const sameDimensions: LineSet = { ...sameName, hookRows: one.hookRows };
    expect(refusalOf(one, sameDimensions).reason).toBe('too-many-picks');
  });

  it('R1.8 R6.10 a value that is not a Line_Set at all is refused and never read into', () => {
    const one = lineSetOf([firstHookPunchedCard]);
    // Values that carry no Card_Profile name, so no name of theirs can match a Line_Set's.
    const notLineSets: ReadonlyArray<unknown> = [
      null,
      undefined,
      0,
      'not-a-line-set',
      true,
      [],
      {},
      { lines: 'not-a-list-of-lines' },
    ];

    for (const value of notLineSets) {
      expect(refusalOf(one, asGivenLineSet(value))).toEqual({
        reason: 'profile-mismatch',
        firstProfileName: one.profileName,
        secondProfileName: '',
      });
      expect(refusalOf(asGivenLineSet(value), one)).toEqual({
        reason: 'profile-mismatch',
        firstProfileName: '',
        secondProfileName: one.profileName,
      });
    }
  });

  it('R1.8 R6.9 two values carrying no hook counts are refused as a dimension mismatch', () => {
    // Neither side carries a Card_Profile name, so the name check passes them on; neither carries
    // hook counts, and a side that carries none never reads as equal to another that carries none.
    const noHookCounts = { hookRows: Number.NaN, hookColumns: Number.NaN };

    expect(refusalOf(asGivenLineSet(null), asGivenLineSet(undefined))).toEqual({
      reason: 'dimension-mismatch',
      first: noHookCounts,
      second: noHookCounts,
    });
    expect(refusalOf(asGivenLineSet({}), asGivenLineSet({ lines: [] }))).toEqual({
      reason: 'dimension-mismatch',
      first: noHookCounts,
      second: noHookCounts,
    });
  });
});
/**
 * `applyDiff`: rebuilding the second Line_Set from the first Line_Set and the Diff (task 1.11,
 * R5.8, R5.10).
 *
 * Every Line_Set below comes from `patternToLines` on the one generated Card_Profile above, so no
 * card dimension and no Ends_Per_Pick value is written here either.
 */

/** A value handed to `applyDiff` in a Diff's place, which R1.8 says it must survive. */
function asGivenDiff(value: unknown): Diff {
  return value as Diff;
}

/** The four header fields of a Line_Set, which are the header `applyDiff` compares (R5.10). */
function headerOf(lineSet: LineSet): LineSetHeader {
  const { profileName, hookRows, hookColumns, endsPerPick } = lineSet;
  return { profileName, hookRows, hookColumns, endsPerPick };
}

/** The header a value that is not a Diff carries: no Card_Profile name and no hook counts. */
const noHeader: LineSetHeader = {
  profileName: '',
  hookRows: Number.NaN,
  hookColumns: Number.NaN,
  endsPerPick: Number.NaN,
};

/** The Line_Set `applyDiff` rebuilt; a failure fails the test instead of being swallowed. */
function appliedTo(first: LineSet, diff: Diff): LineSet {
  const applied = applyDiff(first, diff);
  if (!applied.ok) throw new Error(`applyDiff rejected the Diff: ${applied.failure.reason}`);
  return applied.lineSet;
}

/**
 * The failure `applyDiff` returned, having first checked that it returned no Line_Set: the result
 * carries the failure and nothing else (R5.10).
 */
function applyFailureOf(first: LineSet, diff: Diff): ApplyFailure {
  const applied = applyDiff(first, diff);
  if (applied.ok) throw new Error('applyDiff applied a Diff it was meant to reject');
  expect(Object.keys(applied).sort()).toEqual(['failure', 'ok']);
  return applied.failure;
}

/** The lines-mismatch failure `applyDiff` returned, with the pick index it carries (R5.10). */
function linesMismatchOf(
  first: LineSet,
  diff: Diff,
): Extract<ApplyFailure, { reason: 'lines-mismatch' }> {
  const failure = applyFailureOf(first, diff);
  if (failure.reason !== 'lines-mismatch') {
    throw new Error(`applyDiff rejected the Diff as ${failure.reason}, not as lines-mismatch`);
  }
  return failure;
}

/** The same Line at another pick index. */
function lineAtPick(line: Line, pick: number): Line {
  return line.kind === 'bits'
    ? { kind: 'bits', pick, bits: line.bits }
    : { kind: 'damaged', pick, violations: line.violations };
}

/**
 * The same Diff with every second-side pick index moved up, so that the second side's picks no
 * longer ascend from 0 and `applyDiff` has to renumber them.
 */
function withSecondPicksShiftedBy(diff: Extract<Diff, { ok: true }>, by: number): Diff {
  const entries: ReadonlyArray<DiffEntry> = diff.entries.map((entry): DiffEntry => {
    switch (entry.kind) {
      case 'unchanged':
        return {
          kind: 'unchanged',
          first: entry.first,
          second: lineAtPick(entry.second, entry.second.pick + by),
        };
      case 'changed':
        return {
          kind: 'changed',
          first: entry.first,
          second: { ...entry.second, pick: entry.second.pick + by },
          changedHoles: entry.changedHoles,
        };
      case 'added':
        return { kind: 'added', second: lineAtPick(entry.second, entry.second.pick + by) };
      case 'removed':
        return entry;
    }
  });
  return { ...diff, entries };
}

describe('applyDiff', () => {
  it('R5.8 a Diff over the Line_Set it was built from gives the second Line_Set', () => {
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard, fullyPunchedCard]);
    const second = lineSetOf([
      unpunchedCard,
      secondHookPunchedCard,
      thirdHookPunchedCard,
      fullyPunchedCard,
    ]);

    expect(appliedTo(first, diffPatterns(first, second))).toEqual(second);
    // And the other way round, where the same Diff shape carries removed entries instead of added.
    expect(appliedTo(second, diffPatterns(second, first))).toEqual(first);
  });

  it('R5.8 a Diff over Line_Sets holding damaged cards gives the second Line_Set', () => {
    const first = lineSetOf([damagedCard, unpunchedCard, otherDamagedCard]);
    const second = lineSetOf([damagedCard, firstHookPunchedCard]);

    expect(first.lines.map((line) => line.kind)).toContain('damaged');
    expect(appliedTo(first, diffPatterns(first, second))).toEqual(second);
    expect(appliedTo(second, diffPatterns(second, first))).toEqual(first);
  });

  it('R5.8 a Diff of a Line_Set with no Line gives the Line_Set with no Line', () => {
    const empty = lineSetOf([]);
    const some = lineSetOf([unpunchedCard, fullyPunchedCard]);

    expect(appliedTo(empty, diffPatterns(empty, some))).toEqual(some);
    expect(appliedTo(some, diffPatterns(some, empty))).toEqual(empty);
    expect(appliedTo(empty, diffPatterns(empty, empty))).toEqual(empty);
  });

  it('R5.8 a Diff carrying copies of the Lines rather than the same Lines is applied', () => {
    const first = lineSetOf([unpunchedCard, damagedCard, fullyPunchedCard]);
    const second = lineSetOf([unpunchedCard, firstHookPunchedCard]);

    // A Diff that has been through structuredClone names Lines equal by value but not the same
    // objects, which is what applyDiff compares by (R5.10).
    const copied = structuredClone(diffPatterns(first, second));

    expect(appliedTo(first, copied)).toEqual(second);
  });

  it('R5.8 the Lines of the rebuilt Line_Set are renumbered from pick 0', () => {
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard, fullyPunchedCard]);
    const second = lineSetOf([unpunchedCard, secondHookPunchedCard]);
    const diff = comparisonOf(first, second);
    const shiftBy = second.lines.length + 1;

    const rebuilt = appliedTo(first, withSecondPicksShiftedBy(diff, shiftBy));

    expect(rebuilt).toEqual(second);
    expect(rebuilt.lines.map((line) => line.pick)).toEqual(
      second.lines.map((_, pick) => pick),
    );
  });

  it('R5.8 the rebuilt Line_Set carries the Diff second header', () => {
    const first = lineSetOf([unpunchedCard]);
    const otherEnds = first.endsPerPick + 1;
    // Ends_Per_Pick is not one of the three refusals, so the comparison goes ahead and the header
    // of the rebuilt Line_Set must be the second side's, not the first's.
    const second: LineSet = { ...lineSetOf([fullyPunchedCard]), endsPerPick: otherEnds };

    const rebuilt = appliedTo(first, diffPatterns(first, second));

    expect(rebuilt).toEqual(second);
    expect(headerOf(rebuilt)).toEqual(headerOf(second));
  });

  it('R5.10 a refused Diff is rejected as refused-diff carrying that refusal', () => {
    const otherProfile: CardProfile = { ...profile, name: `${profile.name}-loom-a` };
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard]);
    const otherName = lineSetForProfile(otherProfile, [unpunchedCard]);
    const otherDimensions: LineSet = { ...first, hookRows: first.hookRows + 1 };

    expect(applyFailureOf(first, diffPatterns(first, otherName))).toEqual({
      reason: 'refused-diff',
      refusal: {
        reason: 'profile-mismatch',
        firstProfileName: profile.name,
        secondProfileName: otherProfile.name,
      },
    });
    expect(applyFailureOf(first, diffPatterns(first, otherDimensions))).toEqual({
      reason: 'refused-diff',
      refusal: {
        reason: 'dimension-mismatch',
        first: { hookRows: first.hookRows, hookColumns: first.hookColumns },
        second: { hookRows: first.hookRows + 1, hookColumns: first.hookColumns },
      },
    });
  });

  it('R5.10 a Diff of another header is rejected as header-mismatch carrying both headers', () => {
    const first = lineSetOf([unpunchedCard, fullyPunchedCard]);
    const second = lineSetOf([unpunchedCard]);
    const diff = diffPatterns(first, second);
    // The same Lines under a header that differs, which is the mistake applyDiff is guarding
    // against: a Diff taken against one design applied to another.
    const otherEnds: LineSet = { ...first, endsPerPick: first.endsPerPick + 1 };

    expect(applyFailureOf(otherEnds, diff)).toEqual({
      reason: 'header-mismatch',
      expected: headerOf(otherEnds),
      actual: headerOf(first),
    });
  });

  it('R5.10 a Diff whose entries name other cards is rejected as lines-mismatch with the pick index', () => {
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard]);
    const second = lineSetOf([unpunchedCard, fullyPunchedCard]);
    const diff = diffPatterns(first, second);
    // The same header and the same number of picks, but another card at pick 1.
    const other = lineSetOf([unpunchedCard, secondHookPunchedCard]);

    const failure = linesMismatchOf(other, diff);

    expect(failure.pick).toBe(1);
    expect(failure.message).toContain('1');
  });

  it('R5.10 a Diff naming more or fewer cards than the Line_Set holds is rejected as lines-mismatch', () => {
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard, fullyPunchedCard]);
    const second = lineSetOf([unpunchedCard]);
    const diff = diffPatterns(first, second);

    // Holds two cards where the Diff names three: the third card it names is pick 2.
    const shorter = lineSetOf([unpunchedCard, firstHookPunchedCard]);
    expect(linesMismatchOf(shorter, diff).pick).toBe(2);

    // Holds four cards where the Diff names three: the card it names none for is pick 3.
    const longer = lineSetOf([
      unpunchedCard,
      firstHookPunchedCard,
      fullyPunchedCard,
      thirdHookPunchedCard,
    ]);
    expect(linesMismatchOf(longer, diff).pick).toBe(3);
  });

  it('R5.8 R5.10 the given Line_Set is never written to, applied or rejected', () => {
    const first = lineSetOf([unpunchedCard, firstHookPunchedCard, damagedCard]);
    const second = lineSetOf([firstHookPunchedCard, fullyPunchedCard]);
    const other = lineSetOf([unpunchedCard]);
    const before = structuredClone(first);

    appliedTo(first, diffPatterns(first, second));
    applyFailureOf(first, diffPatterns(other, second));
    applyFailureOf(first, asGivenDiff('not-a-diff'));

    expect(first).toEqual(before);
  });

  it('R1.8 a value that is not a Diff comes back as a failure and never throws', () => {
    const first = lineSetOf([unpunchedCard]);
    // Values that carry no header, so none of them can be the Diff of this Line_Set.
    const notDiffs: ReadonlyArray<unknown> = [
      null,
      undefined,
      0,
      'not-a-diff',
      true,
      [],
      {},
      { ok: false },
      { ok: 'yes' },
      { ok: false, refusal: 'not-a-refusal' },
      { ok: true, entries: 'not-a-list-of-entries' },
    ];

    for (const value of notDiffs) {
      expect(applyFailureOf(first, asGivenDiff(value))).toEqual({
        reason: 'header-mismatch',
        expected: headerOf(first),
        actual: noHeader,
      });
    }
    // And a value that is not a Line_Set, against a Diff that is one.
    expect(applyFailureOf(asGivenLineSet(null), diffPatterns(first, first))).toEqual({
      reason: 'header-mismatch',
      expected: noHeader,
      actual: headerOf(first),
    });
  });
});
/**
 * The properties of `diffPatterns` and `applyDiff` (tasks 1.13 to 1.18).
 *
 * The seed and run count of every property of this file are written here, so that a reported
 * failure can be replayed by passing them back to the property runner (R12.4).
 */
const DIFF_SEED = 11001;
const DIFF_RUNS = 300;

/**
 * The pick count range every property of this file generates over: it starts at 0, so a Line_Set
 * of no Lines and a Line_Set of one Line are both generated (R12.3). These are pick counts, not
 * card dimensions; every card dimension comes from the generated Card_Profile.
 */
const MIN_PROPERTY_PICKS = 0;
const MAX_PROPERTY_PICKS = 12;
const PROPERTY_PICKS = { minPicks: MIN_PROPERTY_PICKS, maxPicks: MAX_PROPERTY_PICKS };

/**
 * A value that fails `validateCardGrid` for the profile, so `patternToLines` writes a damaged Line
 * for it (R1.9). Each one is built by spoiling a generated card for this profile — a hook row
 * dropped, an end dropped from every hook row, the hook rows doubled — or is a value that is no
 * card at all, so no card dimension is written here as a literal.
 */
function damagedCardArbitrary(forProfile: CardProfile): fc.Arbitrary<unknown> {
  const cards = cardGridArbitrary(forProfile);
  return fc.oneof<fc.Arbitrary<unknown>[]>(
    fc.constant('not-a-card'),
    fc.constant(null),
    fc.constant([]),
    cards.map((card) => card.slice(1)),
    cards.map((card) => card.map((holes) => holes.slice(1))),
    cards.map((card) => [...card, ...card]),
  );
}

/**
 * A Line_Set for the profile whose Lines are a mixture of Bit_Lines and damaged Lines, built the
 * only way a Line_Set is made: a Pattern through `patternToLines`.
 */
function damagedLineSetArbitrary(forProfile: CardProfile): fc.Arbitrary<LineSet> {
  const card: fc.Arbitrary<unknown> = fc.oneof<fc.Arbitrary<unknown>[]>(
    cardGridArbitrary(forProfile),
    damagedCardArbitrary(forProfile),
  );
  return fc
    .array(card, { minLength: MIN_PROPERTY_PICKS, maxLength: MAX_PROPERTY_PICKS })
    .map((pattern) => lineSetForProfile(forProfile, pattern));
}

/**
 * Any Line_Set on a generated Card_Profile: one of Bit_Lines alone, or one holding damaged Lines
 * too. The hook counts and the `endOrder` come from `profileArbitrary`, which permutes `endOrder`,
 * and the pick count from the range above, so a Line_Set of no Lines is generated as well (R12.3).
 */
const profileAndLineSetArbitrary: fc.Arbitrary<LineSet> = profileArbitrary.chain((forProfile) =>
  fc.oneof(lineSetArbitrary(forProfile, PROPERTY_PICKS), damagedLineSetArbitrary(forProfile)),
);

describe('diffPatterns properties', () => {
  it('R5.1 a design compared with itself reports no change', () => {
    // **Validates: Requirements R5.1, R7.5**

    // What the generated Line_Sets covered, checked after the runs so that the property cannot
    // quietly stop covering a Line_Set with damaged Lines or one with no Lines.
    const covered = { noLines: false, damagedLines: false };

    fc.assert(
      fc.property(profileAndLineSetArbitrary, (lineSet) => {
        covered.noLines ||= lineSet.lines.length === 0;
        covered.damagedLines ||= lineSet.lines.some((line) => line.kind === 'damaged');

        const diff = diffPatterns(lineSet, lineSet);

        // The two sides carry the one header and no more picks than the Diff_Pick_Limit, so the
        // comparison is never refused (R5.1).
        expect(diff.ok).toBe(true);
        if (!diff.ok) return;

        // One unchanged entry per Line, in pick order, each holding that Line on both sides, and
        // no changed, added or removed entry anywhere (R5.1).
        expect(diff.entries).toEqual(
          lineSet.lines.map((line) => ({ kind: 'unchanged', first: line, second: line })),
        );
        expect(diff.entries.filter((entry) => entry.kind !== 'unchanged')).toEqual([]);

        // Zero changed holes, zero added cards, zero removed cards (R7.5).
        expect(diff.counts).toEqual({ changedHoles: 0, addedCards: 0, removedCards: 0 });
      }),
      { seed: DIFF_SEED, numRuns: DIFF_RUNS },
    );

    expect(covered).toEqual({ noLines: true, damagedLines: true });
  });
});

/**
 * The pick count range the round trip below generates over, wider than PROPERTY_PICKS above so
 * that the Alignment runs over longer designs. It starts at 0, so a design of no picks and a
 * design of one pick are both generated (R12.3). These are pick counts, not card dimensions.
 */
const ROUND_TRIP_MIN_PICKS = 0;
const ROUND_TRIP_MAX_PICKS = 24;
const ROUND_TRIP_PICKS = { minPicks: ROUND_TRIP_MIN_PICKS, maxPicks: ROUND_TRIP_MAX_PICKS };

/**
 * One generated Card_Profile and two Patterns for it. Each Pattern draws its own pick count from
 * the range above, so the two designs compared are of differing lengths as often as of the same
 * length, which is the case the Alignment has to work for (R5.8). Every card dimension comes from
 * the profile, and the profile's `endOrder` is a permutation, so the round trip is not resting on
 * a row-major end order.
 */
const profileAndTwoPatternsArbitrary: fc.Arbitrary<{
  forProfile: CardProfile;
  first: Pattern;
  second: Pattern;
}> = profileArbitrary.chain((forProfile) =>
  fc
    .tuple(
      patternArbitrary(forProfile, ROUND_TRIP_PICKS),
      patternArbitrary(forProfile, ROUND_TRIP_PICKS),
    )
    .map(([first, second]) => ({ forProfile, first, second })),
);

describe('applyDiff properties', () => {
  it('R5.8 applying a diff to the first design gives the second', () => {
    // **Validates: Requirements R5.8**

    // What the generated Patterns covered, checked after the runs so that the property cannot
    // quietly stop covering a design of no picks, of one pick, or two designs of differing lengths.
    const covered = { noPicks: false, onePick: false, differingLengths: false };

    fc.assert(
      fc.property(profileAndTwoPatternsArbitrary, ({ forProfile, first, second }) => {
        covered.noPicks ||= first.length === 0 || second.length === 0;
        covered.onePick ||= first.length === 1 || second.length === 1;
        covered.differingLengths ||= first.length !== second.length;

        const firstLines = lineSetForProfile(forProfile, first);
        const secondLines = lineSetForProfile(forProfile, second);
        const firstBefore = structuredClone(firstLines);

        const applied = applyDiff(firstLines, diffPatterns(firstLines, secondLines));

        // Both sides carry the one header and no more picks than the Diff_Pick_Limit, so the
        // comparison is never refused and the Diff is always one applyDiff accepts (R5.8).
        expect(applied.ok).toBe(true);
        if (!applied.ok) return;

        // Line_Set equality of the Glossary: the Card_Profile name, hookRows, hookColumns,
        // Ends_Per_Pick and the ordered Lines are each equal to the second design's.
        expect(headerOf(applied.lineSet)).toEqual(headerOf(secondLines));
        expect(applied.lineSet.lines).toEqual(secondLines.lines);
        expect(applied.lineSet).toEqual(secondLines);

        // The first design is left unchanged (R5.8).
        expect(firstLines).toEqual(firstBefore);
      }),
      { seed: DIFF_SEED, numRuns: DIFF_RUNS },
    );

    expect(covered).toEqual({ noPicks: true, onePick: true, differingLengths: true });
  });
});

/**
 * Property 5 (task 1.15, R6.1, R6.3): flipping one punched hole of one card.
 *
 * The pick count range starts at 1, because the property is over a Pattern of at least one pick,
 * and these are pick counts, not card dimensions: every card dimension, and so every hook row and
 * hook column range below, comes from the generated Card_Profile.
 */
const FLIP_MIN_PICKS = 1;
const FLIP_MAX_PICKS = 12;
const FLIP_PICKS = { minPicks: FLIP_MIN_PICKS, maxPicks: FLIP_MAX_PICKS };

/** One hook position of a card for the profile, both ranges taken from the profile. */
function hookPositionArbitrary(
  forProfile: CardProfile,
): fc.Arbitrary<{ hookRow: number; hookColumn: number }> {
  return fc.record({
    hookRow: fc.nat({ max: forProfile.hookRows - 1 }),
    hookColumn: fc.nat({ max: forProfile.hookColumns - 1 }),
  });
}

/** The same card with the punched hole at that one hook position flipped, the rest left alone. */
function cardWithPunchedHoleFlipped(
  card: CardGrid,
  atHookRow: number,
  atHookColumn: number,
): CardGrid {
  return card.map((punchedHoles, hookRow) =>
    punchedHoles.map((punched, hookColumn) =>
      hookRow === atHookRow && hookColumn === atHookColumn ? !punched : punched,
    ),
  );
}

/** A copy of a card, so that two picks built from one pool card never share an array. */
function copyOfCard(card: CardGrid): CardGrid {
  return card.map((punchedHoles) => [...punchedHoles]);
}

/**
 * The ends at which the two cards' ends lists differ, ascending. The ends lists come from
 * `encodeCardGrid`, which is the only mapping from a hook position to an end (R1.3), so no end
 * index here is read off `endOrder` or worked out from `hookRows` and `hookColumns`.
 */
function endsChangedBetween(
  forProfile: CardProfile,
  card: CardGrid,
  other: CardGrid,
): ReadonlyArray<number> {
  const ends = encodeCardGrid(forProfile, card);
  const otherEnds = encodeCardGrid(forProfile, other);
  if (!ends.ok || !otherEnds.ok) {
    throw new Error('encodeCardGrid refused a card built for this Card_Profile');
  }
  return ends.value.flatMap((punched, end) => (punched === otherEnds.value[end] ? [] : [end]));
}

/** A Pattern, the pick whose card is flipped, and the hook position flipped on it. */
type FlipCase = {
  forProfile: CardProfile;
  pattern: Pattern;
  pick: number;
  hookRow: number;
  hookColumn: number;
};

/** The pick the case flips, taken from the generated offset and the Pattern's own pick count. */
function flipCase(
  forProfile: CardProfile,
  pattern: Pattern,
  pickOffset: number,
  at: { hookRow: number; hookColumn: number },
): FlipCase {
  return { forProfile, pattern, pick: pickOffset % pattern.length, ...at };
}

/**
 * A Pattern whose picks are drawn from a pool of three cards, so that it holds repeated cards
 * whenever it is longer than the pool. The pool is a generated card, that card with the hook
 * position this case flips already flipped, and that card with a few other hook positions
 * flipped: a Pattern holding the first two therefore makes flipping that one punched hole turn
 * one card into a copy of another card of the Pattern, which is the case the Alignment's
 * least-displacement tie-break exists for. A Pattern of all-distinct cards would never reach it.
 */
function repeatedCardFlipArbitrary(forProfile: CardProfile): fc.Arbitrary<FlipCase> {
  return fc
    .record({
      at: hookPositionArbitrary(forProfile),
      base: cardGridArbitrary(forProfile),
      otherFlips: fc.array(hookPositionArbitrary(forProfile), { maxLength: 3 }),
      fromPool: fc.array(fc.nat({ max: 2 }), { minLength: FLIP_MIN_PICKS, maxLength: FLIP_MAX_PICKS }),
      pickOffset: fc.nat(),
    })
    .map(({ at, base, otherFlips, fromPool, pickOffset }) => {
      const pool: ReadonlyArray<CardGrid> = [
        base,
        cardWithPunchedHoleFlipped(base, at.hookRow, at.hookColumn),
        otherFlips.reduce(
          (card, other) => cardWithPunchedHoleFlipped(card, other.hookRow, other.hookColumn),
          base,
        ),
      ];
      const pattern = fromPool.map((index) => copyOfCard(pool[index]!));
      return flipCase(forProfile, pattern, pickOffset, at);
    });
}

/** Any Pattern of at least one pick for the profile, with any pick and any hook position. */
function anyPatternFlipArbitrary(forProfile: CardProfile): fc.Arbitrary<FlipCase> {
  return fc
    .record({
      pattern: patternArbitrary(forProfile, FLIP_PICKS),
      at: hookPositionArbitrary(forProfile),
      pickOffset: fc.nat(),
    })
    .map(({ pattern, at, pickOffset }) => flipCase(forProfile, pattern, pickOffset, at));
}

/**
 * One generated Card_Profile, a Pattern of at least one pick for it, one pick of that Pattern and
 * one hook position of that pick's card: Patterns drawn from a small pool of cards, which hold
 * repeated cards, and Patterns of freely generated cards, which mostly do not.
 */
const flipOneHoleArbitrary: fc.Arbitrary<FlipCase> = profileArbitrary.chain((forProfile) =>
  fc.oneof(repeatedCardFlipArbitrary(forProfile), anyPatternFlipArbitrary(forProfile)),
);

/** True when two cards of the Pattern are equal, so the Pattern holds a repeated card. */
function holdsRepeatedCard(pattern: Pattern): boolean {
  const keys = pattern.map((card) => JSON.stringify(card));
  return new Set(keys).size < keys.length;
}

describe('diffPatterns one flipped punched hole', () => {
  it('R6.1 flipping one hole gives one changed card and one changed hole', () => {
    // **Validates: Requirements R6.1, R6.3**

    // What the generated Patterns covered, checked after the runs so that the property cannot
    // quietly stop covering a Pattern of one pick, a Pattern holding a repeated card, the flip
    // that turns one card into a copy of another card of the Pattern, or either direction of flip.
    const covered = {
      onePick: false,
      repeatedCards: false,
      flipMakesACopyOfAnotherCard: false,
      punchesAHole: false,
      unpunchesAHole: false,
    };

    fc.assert(
      fc.property(flipOneHoleArbitrary, ({ forProfile, pattern, pick, hookRow, hookColumn }) => {
        const card = pattern[pick]!;
        const flipped = cardWithPunchedHoleFlipped(card, hookRow, hookColumn);
        const second: Pattern = pattern.map((other, atPick) => (atPick === pick ? flipped : other));

        covered.onePick ||= pattern.length === 1;
        covered.repeatedCards ||= holdsRepeatedCard(pattern);
        covered.flipMakesACopyOfAnotherCard ||= pattern.some(
          (other, atPick) => atPick !== pick && JSON.stringify(other) === JSON.stringify(flipped),
        );
        covered.punchesAHole ||= flipped[hookRow]![hookColumn]!;
        covered.unpunchesAHole ||= !flipped[hookRow]![hookColumn]!;

        const firstLines = lineSetForProfile(forProfile, pattern);
        const secondLines = lineSetForProfile(forProfile, second);

        const diff = diffPatterns(firstLines, secondLines);

        // Both sides carry the one header and no more picks than the Diff_Pick_Limit, so the
        // comparison is never refused.
        expect(diff.ok).toBe(true);
        if (!diff.ok) return;

        // Exactly one changed entry, and no added and no removed entry (R6.1).
        const changedEntries = diff.entries.filter(
          (entry): entry is Extract<DiffEntry, { kind: 'changed' }> => entry.kind === 'changed',
        );
        expect(changedEntries).toHaveLength(1);
        expect(diff.entries.filter((entry) => entry.kind === 'added')).toEqual([]);
        expect(diff.entries.filter((entry) => entry.kind === 'removed')).toEqual([]);

        // One changed hole, zero added cards, zero removed cards (R6.1, R6.3).
        expect(diff.counts).toEqual({ changedHoles: 1, addedCards: 0, removedCards: 0 });

        // That entry's Changed_Holes is the single end `encodeCardGrid` maps the flipped hook
        // position to (R6.1).
        const changedEnds = endsChangedBetween(forProfile, card, flipped);
        expect(changedEnds).toHaveLength(1);
        expect(changedEntries[0]!.changedHoles).toEqual(changedEnds);
      }),
      { seed: DIFF_SEED, numRuns: DIFF_RUNS },
    );

    expect(covered).toEqual({
      onePick: true,
      repeatedCards: true,
      flipMakesACopyOfAnotherCard: true,
      punchesAHole: true,
      unpunchesAHole: true,
    });
  });
});

/**
 * Property 6 (task 1.16, R5.2): inserting one card into a design.
 *
 * This is the property R5.2 exists for: an inserted card must leave every later card matched to
 * an equal card, not marked changed. The pick count range starts at 0, so inserting into a
 * Pattern of no picks is generated, and these are pick counts, not card dimensions: every hook
 * row and hook column range below comes from the generated Card_Profile.
 */
const INSERT_MIN_PICKS = 0;
const INSERT_MAX_PICKS = 12;
const INSERT_PICKS = { minPicks: INSERT_MIN_PICKS, maxPicks: INSERT_MAX_PICKS };

/** How many cards a pool of repeated cards holds. These are card counts, not card dimensions. */
const MIN_POOL_CARDS = 1;
const MAX_POOL_CARDS = 3;

/**
 * Where the card goes in: the very start, the very end, or a position worked out from a generated
 * offset and the Pattern's own pick count. The two edges are named rather than left to the offset,
 * because an alignment that pairs the wrong cards fails at an edge as readily as in the middle.
 */
type InsertionPosition = 'start' | 'end' | { offset: number };

const insertionPositionArbitrary: fc.Arbitrary<InsertionPosition> = fc.oneof(
  fc.constant<InsertionPosition>('start'),
  fc.constant<InsertionPosition>('end'),
  fc.nat().map((offset) => ({ offset })),
);

/** The insertion position in the Pattern, from 0 (before pick 0) to the Pattern's pick count. */
function positionIn(pattern: Pattern, where: InsertionPosition): number {
  if (where === 'start') return 0;
  if (where === 'end') return pattern.length;
  return where.offset % (pattern.length + 1);
}

/** The same Pattern with one more card at that position, every other card left where it was. */
function patternWithCardInserted(pattern: Pattern, card: CardGrid, position: number): Pattern {
  return [...pattern.slice(0, position), card, ...pattern.slice(position)];
}

/** A Pattern, the card inserted into it, and the position it is inserted at. */
type InsertCase = {
  forProfile: CardProfile;
  pattern: Pattern;
  inserted: CardGrid;
  position: number;
};

/**
 * A Pattern whose picks are drawn from a small pool of cards, so that it holds repeated cards
 * whenever it is longer than the pool, with the inserted card drawn from that same pool: the
 * inserted card is therefore equal to a card already in the Pattern, which is where a careless
 * alignment pairs the wrong cards and reports a changed card instead of a clean insertion. A
 * Pattern of all-distinct cards and a freshly generated inserted card would never reach it.
 */
function repeatedCardInsertArbitrary(forProfile: CardProfile): fc.Arbitrary<InsertCase> {
  return fc
    .record({
      pool: fc.array(cardGridArbitrary(forProfile), {
        minLength: MIN_POOL_CARDS,
        maxLength: MAX_POOL_CARDS,
      }),
      fromPool: fc.array(fc.nat(), { minLength: INSERT_MIN_PICKS, maxLength: INSERT_MAX_PICKS }),
      insertedFromPool: fc.nat(),
      where: insertionPositionArbitrary,
    })
    .map(({ pool, fromPool, insertedFromPool, where }) => {
      const pattern = fromPool.map((index) => copyOfCard(pool[index % pool.length]!));
      const inserted = copyOfCard(pool[insertedFromPool % pool.length]!);
      return { forProfile, pattern, inserted, position: positionIn(pattern, where) };
    });
}

/** Any Pattern for the profile, any card inserted into it, at any position. */
function anyPatternInsertArbitrary(forProfile: CardProfile): fc.Arbitrary<InsertCase> {
  return fc
    .record({
      pattern: patternArbitrary(forProfile, INSERT_PICKS),
      inserted: cardGridArbitrary(forProfile),
      where: insertionPositionArbitrary,
    })
    .map(({ pattern, inserted, where }) => ({
      forProfile,
      pattern,
      inserted,
      position: positionIn(pattern, where),
    }));
}

/**
 * One generated Card_Profile, a Pattern for it, one card and one insertion position: Patterns
 * drawn from a small pool of cards, whose inserted card is equal to a card already in the
 * Pattern, and Patterns of freely generated cards, whose inserted card mostly is not.
 */
const insertOneCardArbitrary: fc.Arbitrary<InsertCase> = profileArbitrary.chain((forProfile) =>
  fc.oneof(repeatedCardInsertArbitrary(forProfile), anyPatternInsertArbitrary(forProfile)),
);

/**
 * The Bit_Line of a Line. Every card this property generates is a valid card for the profile, so
 * every Line is a Bit_Line and a damaged Line here means `patternToLines` is wrong.
 */
function lineBitsOf(line: Line): string {
  if (line.kind !== 'bits') throw new Error('patternToLines wrote a damaged Line for a valid card');
  return line.bits;
}

/** The Bit_Line of a card; a refusal fails the test, since every card here is a valid one. */
function bitsOf(forProfile: CardProfile, card: CardGrid): string {
  const bits = cardToBits(forProfile, card);
  if (!bits.ok) throw new Error('cardToBits refused a card built for this Card_Profile');
  return bits.bits;
}

describe('diffPatterns one inserted card', () => {
  it('R5.2 inserting one card gives one added card and nothing else', () => {
    // **Validates: Requirements R5.2**

    // What the generated cases covered, checked after the runs so that the property cannot
    // quietly stop covering insertion into a Pattern of no picks, insertion at the very start and
    // at the very end as well as in the middle, a Pattern holding a repeated card, or an inserted
    // card equal to a card already in the Pattern.
    const covered = {
      intoAPatternOfNoPicks: false,
      atTheVeryStart: false,
      atTheVeryEnd: false,
      inTheMiddle: false,
      repeatedCards: false,
      insertedCardAlreadyInThePattern: false,
    };

    fc.assert(
      fc.property(insertOneCardArbitrary, ({ forProfile, pattern, inserted, position }) => {
        const second = patternWithCardInserted(pattern, inserted, position);

        covered.intoAPatternOfNoPicks ||= pattern.length === 0;
        covered.atTheVeryStart ||= pattern.length > 0 && position === 0;
        covered.atTheVeryEnd ||= pattern.length > 0 && position === pattern.length;
        covered.inTheMiddle ||= position > 0 && position < pattern.length;
        covered.repeatedCards ||= holdsRepeatedCard(pattern);
        covered.insertedCardAlreadyInThePattern ||= pattern.some(
          (card) => JSON.stringify(card) === JSON.stringify(inserted),
        );

        const firstLines = lineSetForProfile(forProfile, pattern);
        const secondLines = lineSetForProfile(forProfile, second);

        const diff = diffPatterns(firstLines, secondLines);

        // Both sides carry the one header and no more picks than the Diff_Pick_Limit, so the
        // comparison is never refused.
        expect(diff.ok).toBe(true);
        if (!diff.ok) return;

        // Exactly one added entry, and no changed and no removed entry (R5.2).
        const addedEntries = diff.entries.filter(
          (entry): entry is Extract<DiffEntry, { kind: 'added' }> => entry.kind === 'added',
        );
        expect(addedEntries).toHaveLength(1);
        expect(diff.entries.filter((entry) => entry.kind === 'changed')).toEqual([]);
        expect(diff.entries.filter((entry) => entry.kind === 'removed')).toEqual([]);

        // Every Line of the first Line_Set appears in an unchanged entry, in pick order, each
        // holding that Line on both sides, so no card of the first design is reported as changed
        // by the insertion (R5.2).
        const unchangedEntries = diff.entries.filter(
          (entry): entry is Extract<DiffEntry, { kind: 'unchanged' }> => entry.kind === 'unchanged',
        );
        expect(unchangedEntries.map((entry) => entry.first)).toEqual(firstLines.lines);
        // Each of those entries is matched to a Line of the second Line_Set with an equal
        // Bit_Line; only its pick index moves, by the one card inserted before it.
        for (const entry of unchangedEntries) {
          expect(secondLines.lines).toContainEqual(entry.second);
          expect(lineBitsOf(entry.second)).toEqual(lineBitsOf(entry.first));
        }

        // The added entry holds the inserted card's Bit_Line (R5.2).
        expect(addedEntries[0]!.second).toMatchObject({
          kind: 'bits',
          bits: bitsOf(forProfile, inserted),
        });

        // Zero changed holes, one added card, zero removed cards: no punched hole of the inserted
        // card is a Changed_Hole (R6.1, R6.3).
        expect(diff.counts).toEqual({ changedHoles: 0, addedCards: 1, removedCards: 0 });
      }),
      { seed: DIFF_SEED, numRuns: DIFF_RUNS },
    );

    expect(covered).toEqual({
      intoAPatternOfNoPicks: true,
      atTheVeryStart: true,
      atTheVeryEnd: true,
      inTheMiddle: true,
      repeatedCards: true,
      insertedCardAlreadyInThePattern: true,
    });
  });
});

/**
 * Property 7 (task 1.17, R5.9, R6.2): the Diff of two designs is the mirror of the Diff the other
 * way round.
 *
 * This is the property the canonicalisation of `alignLines` and the `firstSideIsCanonical` helper
 * of `diffPatterns` exist for: a longest common subsequence is not mirror-symmetric for every tie,
 * so the inputs below are built to tie as often as possible. The pick count range starts at 0, so
 * a design of no picks and a design of one pick are both generated (R12.3), and these are pick
 * counts, not card dimensions: every card dimension comes from the generated Card_Profile.
 *
 * The run count is higher than the other properties of this file, because the requirements phase
 * named this the property most likely to fail.
 */
const MIRROR_MIN_PICKS = 0;
const MIRROR_MAX_PICKS = 12;
const MIRROR_PICKS = { minPicks: MIRROR_MIN_PICKS, maxPicks: MIRROR_MAX_PICKS };
const MIRROR_RUNS = 1000;

/** How many cards a pool of repeated cards holds. These are card counts, not card dimensions. */
const MIN_MIRROR_POOL_CARDS = 1;
const MAX_MIRROR_POOL_CARDS = 3;

/** How many edits turn the first design into the second. These are edit counts, not dimensions. */
const MIN_MIRROR_EDITS = 0;
const MAX_MIRROR_EDITS = 5;

/** One generated Card_Profile and two designs for it, each card valid or damaged. */
type MirrorCase = {
  forProfile: CardProfile;
  first: ReadonlyArray<unknown>;
  second: ReadonlyArray<unknown>;
};

/** Any card for the profile, valid or damaged, so a Line_Set holds damaged Lines too (R1.9). */
function anyCardArbitrary(forProfile: CardProfile): fc.Arbitrary<unknown> {
  return fc.oneof<fc.Arbitrary<unknown>[]>(
    cardGridArbitrary(forProfile),
    damagedCardArbitrary(forProfile),
  );
}

/** A copy of a card of a pool, so that two picks drawn from one pool card never share an array. */
function copyOfAnyCard(card: unknown): unknown {
  return structuredClone(card);
}

/**
 * Two designs whose picks are drawn from one small pool of cards, so both hold repeated cards and
 * ties in the alignment are common: where a card appears several times on each side, several
 * longest common subsequences have the same length, and only the tie-breaking rule decides which
 * one is taken. Each side draws its own pick count, so the two are of differing lengths as often
 * as not and either side may hold no Lines at all.
 */
function pooledMirrorArbitrary(forProfile: CardProfile): fc.Arbitrary<MirrorCase> {
  const fromPool = fc.array(fc.nat(), {
    minLength: MIRROR_MIN_PICKS,
    maxLength: MIRROR_MAX_PICKS,
  });
  return fc
    .record({
      pool: fc.array(anyCardArbitrary(forProfile), {
        minLength: MIN_MIRROR_POOL_CARDS,
        maxLength: MAX_MIRROR_POOL_CARDS,
      }),
      firstFromPool: fromPool,
      secondFromPool: fromPool,
    })
    .map(({ pool, firstFromPool, secondFromPool }) => ({
      forProfile,
      first: firstFromPool.map((index) => copyOfAnyCard(pool[index % pool.length])),
      second: secondFromPool.map((index) => copyOfAnyCard(pool[index % pool.length])),
    }));
}

/** One edit of a design: a card put in, a card taken out, or a card swapped for another. */
type PatternEdit =
  | { kind: 'insert'; card: unknown; offset: number }
  | { kind: 'delete'; offset: number }
  | { kind: 'replace'; card: unknown; offset: number };

function patternEditArbitrary(forProfile: CardProfile): fc.Arbitrary<PatternEdit> {
  const card = anyCardArbitrary(forProfile);
  return fc.oneof<fc.Arbitrary<PatternEdit>[]>(
    fc.record({ kind: fc.constant<'insert'>('insert'), card, offset: fc.nat() }),
    fc.record({ kind: fc.constant<'delete'>('delete'), offset: fc.nat() }),
    fc.record({ kind: fc.constant<'replace'>('replace'), card, offset: fc.nat() }),
  );
}

/**
 * The design the edits make of this one, each edit applied at a position worked out from its
 * generated offset and the design's own pick count. An edit of a design of no picks that needs a
 * card to work on leaves it as it is.
 */
function patternEdited(
  pattern: ReadonlyArray<unknown>,
  edits: ReadonlyArray<PatternEdit>,
): ReadonlyArray<unknown> {
  let edited: ReadonlyArray<unknown> = pattern;
  for (const edit of edits) {
    if (edit.kind === 'insert') {
      const at = edit.offset % (edited.length + 1);
      edited = [...edited.slice(0, at), edit.card, ...edited.slice(at)];
      continue;
    }
    if (edited.length === 0) continue;
    const at = edit.offset % edited.length;
    edited =
      edit.kind === 'delete'
        ? [...edited.slice(0, at), ...edited.slice(at + 1)]
        : [...edited.slice(0, at), edit.card, ...edited.slice(at + 1)];
  }
  return edited;
}

/**
 * A design and the design a handful of edits make of it: several cards put in, taken out and
 * swapped, so the two sides share a long run of equal cards broken in several places. That is the
 * shape a design under revision has, and it gives the alignment several separate blocks to pair.
 */
function editedMirrorArbitrary(forProfile: CardProfile): fc.Arbitrary<MirrorCase> {
  return fc
    .record({
      pattern: fc.array(anyCardArbitrary(forProfile), {
        minLength: MIRROR_MIN_PICKS,
        maxLength: MIRROR_MAX_PICKS,
      }),
      edits: fc.array(patternEditArbitrary(forProfile), {
        minLength: MIN_MIRROR_EDITS,
        maxLength: MAX_MIRROR_EDITS,
      }),
    })
    .map(({ pattern, edits }) => ({
      forProfile,
      first: pattern,
      second: patternEdited(pattern, edits),
    }));
}

/**
 * One design against a copy of itself. The design's proof that the rule is symmetric rests on the
 * two sides comparing equal being the one case where the canonical pair is the caller's pair
 * whichever way round it was passed, so it is generated on its own as well.
 */
function sameSidesMirrorArbitrary(forProfile: CardProfile): fc.Arbitrary<MirrorCase> {
  return fc
    .array(anyCardArbitrary(forProfile), {
      minLength: MIRROR_MIN_PICKS,
      maxLength: MIRROR_MAX_PICKS,
    })
    .map((pattern) => ({
      forProfile,
      first: pattern,
      second: pattern.map((card) => copyOfAnyCard(card)),
    }));
}

/**
 * One generated Card_Profile and two designs for it, which `diffPatterns` refuses in neither
 * direction: both go through `patternToLines` on the one profile, so the two Line_Sets carry the
 * one header, and neither holds more picks than the Diff_Pick_Limit.
 */
const mirrorCaseArbitrary: fc.Arbitrary<MirrorCase> = profileArbitrary.chain((forProfile) =>
  fc.oneof(
    pooledMirrorArbitrary(forProfile),
    editedMirrorArbitrary(forProfile),
    sameSidesMirrorArbitrary(forProfile),
  ),
);

/**
 * The mirror of one Diff_Entry: the two sides swapped, so an `unchanged` and a `changed` entry
 * keep their two Lines and a `changed` entry its Changed_Holes, while an `added` entry becomes the
 * `removed` entry of that same Line and a `removed` entry the `added` entry of that same Line
 * (R5.9).
 */
function mirroredEntry(entry: DiffEntry): DiffEntry {
  switch (entry.kind) {
    case 'unchanged':
      return { kind: 'unchanged', first: entry.second, second: entry.first };
    case 'changed':
      return {
        kind: 'changed',
        first: entry.second,
        second: entry.first,
        changedHoles: entry.changedHoles,
      };
    case 'added':
      return { kind: 'removed', first: entry.second };
    case 'removed':
      return { kind: 'added', second: entry.first };
  }
}

/** Whether a side holds the same card at two picks, so the alignment has a tie to break. */
function holdsARepeatedLine(lineSet: LineSet): boolean {
  const keys = lineSet.lines.map((line) =>
    line.kind === 'bits' ? line.bits : `damaged:${JSON.stringify(line.violations)}`,
  );
  return new Set(keys).size < keys.length;
}

/** Whether the two sides hold the same Lines, which is the `A = B` case of the design. */
function holdsTheSameLines(first: LineSet, second: LineSet): boolean {
  return JSON.stringify(first.lines) === JSON.stringify(second.lines);
}

/** The Line a `removed` or an `added` entry carries, or nothing for an entry of another kind. */
function leftoverLineOf(entry: DiffEntry): Line | undefined {
  if (entry.kind === 'removed') return entry.first;
  if (entry.kind === 'added') return entry.second;
  return undefined;
}

/** Whether an entry is of one of the two kinds a block's leftover Lines come out as (R5.4). */
function isLeftoverKind(entry: DiffEntry): boolean {
  return entry.kind === 'added' || entry.kind === 'removed';
}

/**
 * The entries of each block of the Diff. The entries of a block come first and then the
 * `unchanged` entry of the match that closes it, so splitting on the `unchanged` entries gives
 * the blocks back.
 */
function blocksOf(entries: ReadonlyArray<DiffEntry>): DiffEntry[][] {
  const blocks: DiffEntry[][] = [[]];
  for (const entry of entries) {
    if (entry.kind === 'unchanged') blocks.push([]);
    else blocks[blocks.length - 1]!.push(entry);
  }
  return blocks;
}

/**
 * How one block of a Diff reads under R5.4: the couples the block's pairing produced, then the
 * leftover entries of the longer side. A couple is either one `changed` entry, or a `removed` and
 * an `added` entry for a pair that could not be one `changed` entry, written in either order.
 */
type BlockPairing = { couples: DiffEntry[][]; leftovers: DiffEntry[] };

/**
 * The couples and the leftovers of one block. A block holds its paired entries first and then the
 * leftovers of the longer side, which R5.4 says are all of one kind, so the walk stops at the
 * first entry that is not followed by a partner of the other leftover kind.
 */
function pairingOfBlock(block: ReadonlyArray<DiffEntry>): BlockPairing {
  const couples: DiffEntry[][] = [];
  let at = 0;
  while (at < block.length) {
    const entry = block[at]!;
    if (entry.kind === 'changed') {
      couples.push([entry]);
      at += 1;
      continue;
    }
    const next = block[at + 1];
    if (next === undefined || !isLeftoverKind(next) || next.kind === entry.kind) break;
    couples.push([entry, next]);
    at += 2;
  }
  return { couples, leftovers: block.slice(at) };
}

/**
 * Whether the Diff holds a pair of one block written as a separate `removed` and `added` entry in
 * which one of the two Lines is damaged and the other carries a Bit_Line. That is the case
 * `firstSideIsCanonical` exists for: the pair cannot be one `changed` entry, so which of the two
 * entries is written first has to be decided by the pair and not by the caller's argument order.
 */
function holdsAPairOfOneDamagedCard(entries: ReadonlyArray<DiffEntry>): boolean {
  return blocksOf(entries).some((block) =>
    pairingOfBlock(block).couples.some(
      (couple) =>
        couple.length === 2 &&
        couple.map(leftoverLineOf).filter((line) => line?.kind === 'damaged').length === 1,
    ),
  );
}

describe('diffPatterns the mirror of a diff', () => {
  it('R5.9 the diff of two designs is the mirror of the diff the other way round', () => {
    // **Validates: Requirements R5.9, R6.2**

    // What the generated designs covered, checked after the runs so that the property cannot
    // quietly stop covering the hard cases: designs holding repeated cards, where the alignment
    // has ties to break; designs of differing lengths, including one side holding no Lines at all;
    // designs holding damaged Lines, matched alike and paired against a Bit_Line; and designs
    // that differ by several cards put in and taken out, not by one.
    const covered = {
      noLinesOnOneSide: false,
      noLinesOnEitherSide: false,
      theSameLinesOnBothSides: false,
      differingLengths: false,
      firstSideShorter: false,
      firstSideLonger: false,
      equalLengthsDiffering: false,
      repeatedLines: false,
      damagedLines: false,
      twoDamagedLinesMatched: false,
      aDamagedCardPairedWithABitsCard: false,
      severalAddedCards: false,
      severalRemovedCards: false,
      addedAndRemovedTogether: false,
      changedCards: false,
    };

    fc.assert(
      fc.property(mirrorCaseArbitrary, ({ forProfile, first, second }) => {
        const firstLines = lineSetForProfile(forProfile, first);
        const secondLines = lineSetForProfile(forProfile, second);

        covered.noLinesOnOneSide ||= firstLines.lines.length === 0 || secondLines.lines.length === 0;
        covered.noLinesOnEitherSide ||=
          firstLines.lines.length === 0 && secondLines.lines.length === 0;
        covered.theSameLinesOnBothSides ||= holdsTheSameLines(firstLines, secondLines);
        covered.differingLengths ||= firstLines.lines.length !== secondLines.lines.length;
        covered.firstSideShorter ||= firstLines.lines.length < secondLines.lines.length;
        covered.firstSideLonger ||= firstLines.lines.length > secondLines.lines.length;
        covered.equalLengthsDiffering ||=
          firstLines.lines.length === secondLines.lines.length &&
          !holdsTheSameLines(firstLines, secondLines);
        covered.repeatedLines ||=
          holdsARepeatedLine(firstLines) || holdsARepeatedLine(secondLines);
        covered.damagedLines ||= [...firstLines.lines, ...secondLines.lines].some(
          (line) => line.kind === 'damaged',
        );

        const forward = diffPatterns(firstLines, secondLines);
        const backward = diffPatterns(secondLines, firstLines);

        // Both sides carry the one header and no more picks than the Diff_Pick_Limit, so the
        // comparison is refused in neither direction, which is the pairs R5.9 is about.
        expect(forward.ok).toBe(true);
        expect(backward.ok).toBe(true);
        if (!forward.ok || !backward.ok) return;

        covered.twoDamagedLinesMatched ||= forward.entries.some(
          (entry) => entry.kind === 'unchanged' && entry.first.kind === 'damaged',
        );
        covered.aDamagedCardPairedWithABitsCard ||= holdsAPairOfOneDamagedCard(forward.entries);
        covered.severalAddedCards ||= forward.counts.addedCards > 1;
        covered.severalRemovedCards ||= forward.counts.removedCards > 1;
        covered.addedAndRemovedTogether ||=
          forward.counts.addedCards > 0 && forward.counts.removedCards > 0;
        covered.changedCards ||= forward.counts.changedHoles > 0;

        // The same number of Diff_Entries in the same order, and entry for entry: each
        // `unchanged` and each `changed` entry holding the same two Lines, a `changed` entry the
        // same Changed_Holes in the same order, and each `added` entry of the one Diff being the
        // `removed` entry of the other for that same Line (R5.9).
        expect(backward.entries).toHaveLength(forward.entries.length);
        expect(backward.entries.map(mirroredEntry)).toEqual(forward.entries);

        // The two headers swap with the two sides, so the Diff one way round names the designs
        // the Diff the other way round names (R5.9).
        expect(backward.first).toEqual(forward.second);
        expect(backward.second).toEqual(forward.first);

        // The changed-hole counts of the two Diffs are equal, and the added and removed card
        // counts swap, as the mirrored entries require (R6.2).
        expect(backward.counts.changedHoles).toBe(forward.counts.changedHoles);
        expect(backward.counts).toEqual({
          changedHoles: forward.counts.changedHoles,
          addedCards: forward.counts.removedCards,
          removedCards: forward.counts.addedCards,
        });
      }),
      { seed: DIFF_SEED, numRuns: MIRROR_RUNS },
    );

    expect(covered).toEqual({
      noLinesOnOneSide: true,
      noLinesOnEitherSide: true,
      theSameLinesOnBothSides: true,
      differingLengths: true,
      firstSideShorter: true,
      firstSideLonger: true,
      equalLengthsDiffering: true,
      repeatedLines: true,
      damagedLines: true,
      twoDamagedLinesMatched: true,
      aDamagedCardPairedWithABitsCard: true,
      severalAddedCards: true,
      severalRemovedCards: true,
      addedAndRemovedTogether: true,
      changedCards: true,
    });
  });
});
/**
 * The folded-in R5.5 property (task 1.18): every Diff is well formed.
 *
 * This is the shape every Diff has to have whatever the two designs are, so it runs over the same
 * designs as Property 7 above — picks drawn from one small pool, a design and the design a handful
 * of edits make of it, and a design against a copy of itself — which give ties in the alignment,
 * repeated cards, damaged Lines, differing lengths and either side holding no Lines at all. Every
 * card dimension comes from the generated Card_Profile and every pick count from those
 * arbitraries, so no card dimension and no Ends_Per_Pick value is written here.
 *
 * A `changed` entry's two Bit_Lines are read off the entry itself. A damaged Line carries no
 * Bit_Line, so a block that pairs a damaged Line with a `bits` Line comes out as a separate
 * `removed` and `added` couple and never as a `changed` entry; that a `changed` entry always holds
 * two `bits` Lines is part of R5.3 being well formed and is asserted below.
 */

/**
 * The end positions at which two Bit_Lines differ, ascending. A Bit_Line holds one character per
 * end (R1.1), so the character index is the end position, and no mapping from a hook position is
 * needed here.
 */
function endsDifferingBetweenBits(first: BitLine, second: BitLine): ReadonlyArray<number> {
  const ends: number[] = [];
  for (let end = 0; end < Math.max(first.length, second.length); end += 1) {
    if (first[end] !== second[end]) ends.push(end);
  }
  return ends;
}

/** R5.5: the end positions a Changed_Holes lists go up, each listed once. */
function expectStrictlyAscending(ends: ReadonlyArray<number>): void {
  for (let at = 1; at < ends.length; at += 1) {
    expect(ends[at]!).toBeGreaterThan(ends[at - 1]!);
  }
}

describe('diffPatterns every diff is well formed', () => {
  it('R5.5 every diff entry names the holes that differ and the picks never go backwards', () => {
    // **Validates: Requirements R5.3, R5.4, R5.5, R5.6, R6.1**

    // What the generated designs covered, checked after the runs so that the property cannot
    // quietly stop covering the cases that give the clauses something to say: changed entries,
    // one entry holding several Changed_Holes, blocks whose longer side leaves leftovers of
    // either kind, a block holding both a couple and a leftover, and the damaged Line paired with
    // a bits Line, which is the pair that must not come out as a changed entry.
    const covered = {
      noLinesOnOneSide: false,
      onePickOnOneSide: false,
      damagedLines: false,
      changedEntries: false,
      severalChangedHolesInOneEntry: false,
      aBlockWithLeftoverAddedEntries: false,
      aBlockWithLeftoverRemovedEntries: false,
      aBlockWithACoupleAndALeftover: false,
      aDamagedCardPairedWithABitsCard: false,
    };

    fc.assert(
      fc.property(mirrorCaseArbitrary, ({ forProfile, first, second }) => {
        const firstLines = lineSetForProfile(forProfile, first);
        const secondLines = lineSetForProfile(forProfile, second);

        covered.noLinesOnOneSide ||= firstLines.lines.length === 0 || secondLines.lines.length === 0;
        covered.onePickOnOneSide ||= firstLines.lines.length === 1 || secondLines.lines.length === 1;
        covered.damagedLines ||= [...firstLines.lines, ...secondLines.lines].some(
          (line) => line.kind === 'damaged',
        );

        const diff = diffPatterns(firstLines, secondLines);

        // Both sides carry the one header and no more picks than the Diff_Pick_Limit, so the
        // comparison is never refused and every run sees a Diff that has to be well formed.
        expect(diff.ok).toBe(true);
        if (!diff.ok) return;

        covered.changedEntries ||= diff.entries.some((entry) => entry.kind === 'changed');
        covered.severalChangedHolesInOneEntry ||= diff.entries.some(
          (entry) => entry.kind === 'changed' && entry.changedHoles.length > 1,
        );
        covered.aDamagedCardPairedWithABitsCard ||= holdsAPairOfOneDamagedCard(diff.entries);

        // Each `changed` entry holds two Bit_Lines, because a damaged Line carries none (R5.3),
        // and its Changed_Holes is non-empty, strictly ascending, and exactly the end positions
        // at which those two Bit_Lines differ (R5.5).
        for (const entry of diff.entries) {
          if (entry.kind !== 'changed') continue;
          expect(entry.first.kind).toBe('bits');
          expect(entry.second.kind).toBe('bits');
          expect(entry.second.bits.length).toBe(entry.first.bits.length);
          expect(entry.changedHoles).toEqual(
            endsDifferingBetweenBits(entry.first.bits, entry.second.bits),
          );
          expect(entry.changedHoles.length).toBeGreaterThan(0);
          expectStrictlyAscending(entry.changedHoles);
        }

        // The first-side and the second-side pick indices each strictly increase across the
        // entries that carry them (R5.6).
        expectPicksToStrictlyIncrease(diff.entries);

        // No block holds both leftover `added` and leftover `removed` entries, because the
        // leftovers all come from the longer side of that block (R5.4). The leftovers of a block
        // are the entries after its couples, so a `changed` entry among them would mean the
        // couples and the leftovers are not written in that order.
        for (const block of blocksOf(diff.entries)) {
          const { couples, leftovers } = pairingOfBlock(block);
          const leftoverAdded = leftovers.filter((entry) => entry.kind === 'added');
          const leftoverRemoved = leftovers.filter((entry) => entry.kind === 'removed');
          expect(leftoverAdded.length > 0 && leftoverRemoved.length > 0).toBe(false);
          expect(leftovers.filter((entry) => !isLeftoverKind(entry))).toEqual([]);

          covered.aBlockWithLeftoverAddedEntries ||= leftoverAdded.length > 0;
          covered.aBlockWithLeftoverRemovedEntries ||= leftoverRemoved.length > 0;
          covered.aBlockWithACoupleAndALeftover ||= couples.length > 0 && leftovers.length > 0;
        }

        // The Diff_Counts are the totals the entries give: the Changed_Holes summed over the
        // `changed` entries, the number of `added` entries and the number of `removed` entries,
        // each a whole number of 0 or more (R6.1).
        expect(diff.counts).toEqual({
          changedHoles: diff.entries.reduce(
            (sum, entry) => sum + (entry.kind === 'changed' ? entry.changedHoles.length : 0),
            0,
          ),
          addedCards: diff.entries.filter((entry) => entry.kind === 'added').length,
          removedCards: diff.entries.filter((entry) => entry.kind === 'removed').length,
        });
        for (const count of [
          diff.counts.changedHoles,
          diff.counts.addedCards,
          diff.counts.removedCards,
        ]) {
          expect(Number.isInteger(count)).toBe(true);
          expect(count).toBeGreaterThanOrEqual(0);
        }
      }),
      { seed: DIFF_SEED, numRuns: DIFF_RUNS },
    );

    expect(covered).toEqual({
      noLinesOnOneSide: true,
      onePickOnOneSide: true,
      damagedLines: true,
      changedEntries: true,
      severalChangedHolesInOneEntry: true,
      aBlockWithLeftoverAddedEntries: true,
      aBlockWithLeftoverRemovedEntries: true,
      aBlockWithACoupleAndALeftover: true,
      aDamagedCardPairedWithABitsCard: true,
    });
  });
});
