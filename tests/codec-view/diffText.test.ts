/**
 * `diffToText` and `DIFF_MARKERS` (task 1.12, R6.4, R6.5, R6.14, R6.15).
 *
 * `diffToText` never sees a Card_Profile: it takes the Bit_Lines and the `hookColumns` it groups
 * them by from the Diff's own two Line_Set headers. So the headers below are each test's fixture
 * rather than any loom's card geometry, and the Diff values are written out by hand as literals of
 * the `Diff` type — `diffPatterns` is not called here, so a failure points at the text format and
 * nothing else.
 *
 * Property P8 over `diffArbitrary` is task 1.19 and lives in this file alongside these examples.
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Violation } from '../../src/codec/types.ts';
import type {
  Diff,
  DiffEntry,
  DiffRefusal,
  Line,
  LineSetHeader,
} from '../../src/codec-view/types.ts';
import { DIFF_MARKERS, diffToText } from '../../src/codec-view/diffText.ts';
import { diffArbitrary } from '../support/lineSets.ts';
import { profileArbitrary } from '../support/profiles.ts';

/** The header both sides of these examples carry: three hook rows of two hook columns, six ends per pick. */
const HEADER: LineSetHeader = {
  profileName: 'first-design',
  hookRows: 3,
  hookColumns: 2,
  endsPerPick: 6,
};

/** One card read as bits, at the pick `patternToLines` numbered it. */
function bitsLine(pick: number, bits: string): Line {
  return { kind: 'bits', pick, bits };
}

/** One damaged card: the Line `patternToLines` writes for a card that failed `validateCardGrid`. */
function damagedLine(pick: number): Line {
  const violation: Violation = {
    kind: 'not-a-boolean',
    location: 'grid[1][0]',
    message: 'hook position must be a boolean',
  };
  return { kind: 'damaged', pick, violations: [violation] };
}

/** A Diff that is not a refusal, over the one header, with the counts stated explicitly. */
function diffOf(
  entries: ReadonlyArray<DiffEntry>,
  counts: { changedHoles: number; addedCards: number; removedCards: number },
): Diff {
  return { ok: true, first: HEADER, second: HEADER, entries, counts };
}

describe('DIFF_MARKERS', () => {
  it('R6.4 gives each Diff_Entry kind its one marker character', () => {
    expect(DIFF_MARKERS).toEqual({ unchanged: ' ', changed: '~', added: '+', removed: '-' });
  });
});

describe('diffToText examples', () => {
  it('R6.14 writes a three-pick change character for character', () => {
    const diff = diffOf(
      [
        { kind: 'unchanged', first: bitsLine(0, '010101'), second: bitsLine(0, '010101') },
        {
          kind: 'changed',
          first: { kind: 'bits', pick: 1, bits: '111000' },
          second: { kind: 'bits', pick: 1, bits: '110001' },
          changedHoles: [2, 5],
        },
        { kind: 'unchanged', first: bitsLine(2, '000000'), second: bitsLine(2, '000000') },
      ],
      { changedHoles: 2, addedCards: 0, removedCards: 0 },
    );
    const expected = [
      '  0/0 01|01|01',
      '~ 1/1 11|00|01',
      '  2/2 00|00|00',
      '# 2 0 0',
    ].join('\n');
    expect(diffToText(diff)).toBe(expected);
  });

  it('R6.5 joins its lines with a single newline and ends without one', () => {
    const text = diffToText(
      diffOf([{ kind: 'unchanged', first: bitsLine(0, '010101'), second: bitsLine(0, '010101') }], {
        changedHoles: 0,
        addedCards: 0,
        removedCards: 0,
      }),
    );
    expect(text).toBe('  0/0 01|01|01\n# 0 0 0');
    expect(text.endsWith('\n')).toBe(false);
    expect(text).not.toContain('\n\n');
  });

  it("R6.14 writes '-' in the pick field the entry has no index on, and the Bit_Line of the side it has", () => {
    const diff = diffOf(
      [
        { kind: 'removed', first: bitsLine(1, '111000') },
        { kind: 'added', second: bitsLine(1, '001110') },
      ],
      { changedHoles: 0, addedCards: 1, removedCards: 1 },
    );
    expect(diffToText(diff)).toBe(['- 1/- 11|10|00', '+ -/1 00|11|10', '# 0 1 1'].join('\n'));
  });

  it('R6.14 writes the second Line_Set Bit_Line for a changed entry and the first for an unchanged one', () => {
    const changed = diffToText(
      diffOf(
        [
          {
            kind: 'changed',
            first: { kind: 'bits', pick: 0, bits: '000000' },
            second: { kind: 'bits', pick: 0, bits: '111111' },
            changedHoles: [0, 1, 2, 3, 4, 5],
          },
        ],
        { changedHoles: 6, addedCards: 0, removedCards: 0 },
      ),
    );
    expect(changed).toBe(['~ 0/0 11|11|11', '# 6 0 0'].join('\n'));

    const unchanged = diffToText(
      diffOf([{ kind: 'unchanged', first: bitsLine(0, '101010'), second: bitsLine(0, '010101') }], {
        changedHoles: 0,
        addedCards: 0,
        removedCards: 0,
      }),
    );
    expect(unchanged).toBe(['  0/0 10|10|10', '# 0 0 0'].join('\n'));
  });

  it('R6.14 writes the pick fields unpadded', () => {
    const diff = diffOf(
      [
        { kind: 'unchanged', first: bitsLine(9, '000000'), second: bitsLine(9, '000000') },
        { kind: 'unchanged', first: bitsLine(10, '000000'), second: bitsLine(10, '000000') },
      ],
      { changedHoles: 0, addedCards: 0, removedCards: 0 },
    );
    expect(diffToText(diff)).toBe(
      ['  9/9 00|00|00', '  10/10 00|00|00', '# 0 0 0'].join('\n'),
    );
  });

  it('R6.4 writes the lineKey text of a damaged card in place of its Bit_Line', () => {
    const diff = diffOf(
      [
        { kind: 'unchanged', first: damagedLine(0), second: damagedLine(0) },
        { kind: 'removed', first: damagedLine(1) },
        { kind: 'added', second: damagedLine(1) },
      ],
      { changedHoles: 0, addedCards: 1, removedCards: 1 },
    );
    expect(diffToText(diff)).toBe(
      [
        '  0/0 xnot-a-boolean@grid[1][0]',
        '- 1/- xnot-a-boolean@grid[1][0]',
        '+ -/1 xnot-a-boolean@grid[1][0]',
        '# 0 1 1',
      ].join('\n'),
    );
  });

  it('R6.5 writes the summary line alone for a Diff with no Diff_Entries', () => {
    expect(diffToText(diffOf([], { changedHoles: 0, addedCards: 0, removedCards: 0 }))).toBe(
      '# 0 0 0',
    );
  });
});

describe('diffToText refusals', () => {
  it('R6.15 writes one line naming dimension-mismatch and the hook rows and hook columns of both sides', () => {
    const diff: Diff = {
      ok: false,
      refusal: {
        reason: 'dimension-mismatch',
        first: { hookRows: 3, hookColumns: 2 },
        second: { hookRows: 4, hookColumns: 2 },
      },
    };
    expect(diffToText(diff)).toBe('! dimension-mismatch first 3x2 second 4x2');
  });

  it('R6.15 writes one line naming profile-mismatch and both Card_Profile names', () => {
    const diff: Diff = {
      ok: false,
      refusal: {
        reason: 'profile-mismatch',
        firstProfileName: 'first-design',
        secondProfileName: 'second-design',
      },
    };
    expect(diffToText(diff)).toBe('! profile-mismatch first first-design second second-design');
  });

  it('R6.15 writes one line naming too-many-picks, the limit and the pick count of both sides', () => {
    const diff: Diff = {
      ok: false,
      refusal: { reason: 'too-many-picks', limit: 2000, firstPicks: 2500, secondPicks: 1800 },
    };
    expect(diffToText(diff)).toBe('! too-many-picks limit 2000 first 2500 second 1800');
  });

  it('R6.15 gives a refused Diff no entry line and no summary line', () => {
    const diff: Diff = {
      ok: false,
      refusal: { reason: 'too-many-picks', limit: 2000, firstPicks: 2500, secondPicks: 1800 },
    };
    const text = diffToText(diff);
    expect(text.split('\n')).toHaveLength(1);
    expect(text.startsWith('!')).toBe(true);
    expect(text).not.toContain('#');
  });
});
/** The seed and run count of the property of this file, written here so a failure can be replayed. */
const DIFF_TEXT_SEED = 11901;
const DIFF_TEXT_RUNS = 300;

/**
 * Any Diff on one generated Card_Profile: two generated Patterns through `patternToLines` and
 * `diffPatterns`, or one of the three refusals. The pick count range starts at 0, so a Diff with no
 * Diff_Entries is generated too; the card dimensions and the Ends_Per_Pick come from the profile.
 */
const profileAndDiffArbitrary: fc.Arbitrary<Diff> = profileArbitrary.chain((profile) =>
  diffArbitrary(profile, { minPicks: 0, maxPicks: 12 }),
);

/** The four marker characters, as the text a Diff_Entry line may start with (R6.4). */
const MARKER_CHARACTERS: ReadonlyArray<string> = Object.values(DIFF_MARKERS);

/** One Diff_Entry line read back: its marker, its two pick index fields and the text after them (R6.14). */
type ParsedEntryLine = { marker: string; firstPick: string; secondPick: string; lineText: string };

/**
 * Reads one Diff_Entry line as `<marker> <firstPick>/<secondPick> <text>`, or returns undefined
 * when the line does not have that shape, so the property states the shape rather than assuming it.
 */
function parseEntryLine(line: string): ParsedEntryLine | undefined {
  const matched = /^(.) ([^ ]+) (.*)$/.exec(line);
  if (matched === null) return undefined;
  const [, marker, pickField, lineText] = matched;
  if (marker === undefined || pickField === undefined || lineText === undefined) return undefined;
  const picks = pickField.split('/');
  if (picks.length !== 2) return undefined;
  const [firstPick, secondPick] = picks;
  if (firstPick === undefined || secondPick === undefined) return undefined;
  return { marker, firstPick, secondPick, lineText };
}

/** The pick index a field names, or undefined where the entry has no index on that side (R6.14). */
function pickOf(field: string): number | undefined {
  return field === '-' ? undefined : Number(field);
}

/** The pick index of an entry on each side: undefined where the entry has no index there. */
function entryPicks(entry: DiffEntry): { firstPick: number | undefined; secondPick: number | undefined } {
  switch (entry.kind) {
    case 'unchanged':
    case 'changed':
      return { firstPick: entry.first.pick, secondPick: entry.second.pick };
    case 'added':
      return { firstPick: undefined, secondPick: entry.second.pick };
    case 'removed':
      return { firstPick: entry.first.pick, secondPick: undefined };
  }
}

/** The values a refusal carries, each as the text the one refusal line has to name (R6.15). */
function refusalValues(refusal: DiffRefusal): ReadonlyArray<string> {
  switch (refusal.reason) {
    case 'dimension-mismatch':
      return [
        String(refusal.first.hookRows),
        String(refusal.first.hookColumns),
        String(refusal.second.hookRows),
        String(refusal.second.hookColumns),
      ];
    case 'profile-mismatch':
      return [refusal.firstProfileName, refusal.secondProfileName];
    case 'too-many-picks':
      return [String(refusal.limit), String(refusal.firstPicks), String(refusal.secondPicks)];
  }
}

describe('diffToText properties', () => {
  it('R6.4 the diff text holds one line per entry, one summary line, and never goes backwards', () => {
    // **Validates: Requirements R6.4, R6.5, R6.14, R6.15**
    fc.assert(
      fc.property(profileAndDiffArbitrary, (diff) => {
        const text = diffToText(diff);
        const lines = text.split('\n');

        if (!diff.ok) {
          // A refused Diff gives exactly one line, starting '!', naming the reason and the values
          // it carries, with no Diff_Entry line and no summary line (R6.15).
          expect(lines).toHaveLength(1);
          expect(text.startsWith('!')).toBe(true);
          expect(text).toContain(diff.refusal.reason);
          for (const value of refusalValues(diff.refusal)) {
            expect(text).toContain(value);
          }
          // No summary line: no line starts with the summary marker. A '#' inside a value the
          // refusal carries — a Card_Profile name, say — is not a summary line.
          expect(lines.filter((line) => line.startsWith('#'))).toEqual([]);
          return;
        }

        // One line per Diff_Entry followed by one summary line, joined by single newlines (R6.4, R6.5).
        expect(lines).toHaveLength(diff.entries.length + 1);
        const summary = lines[lines.length - 1];
        expect(summary).toBe(
          `# ${diff.counts.changedHoles} ${diff.counts.addedCards} ${diff.counts.removedCards}`,
        );

        let lastFirstPick = -1;
        let lastSecondPick = -1;
        for (const [at, entry] of diff.entries.entries()) {
          const line = lines[at];
          expect(line).toBeDefined();
          if (line === undefined) return;
          const parsed = parseEntryLine(line);
          expect(parsed).toBeDefined();
          if (parsed === undefined) return;

          // Every entry line starts with exactly one of the four markers, the one of its kind (R6.4).
          expect(MARKER_CHARACTERS.filter((marker) => marker === parsed.marker)).toHaveLength(1);
          expect(parsed.marker).toBe(DIFF_MARKERS[entry.kind]);

          // Each pick index field is a decimal numeral, or '-' where the entry has no index on that
          // side, and it names that entry's own pick index (R6.14).
          const picks = entryPicks(entry);
          for (const [field, pick] of [
            [parsed.firstPick, picks.firstPick],
            [parsed.secondPick, picks.secondPick],
          ] as const) {
            if (pick === undefined) {
              expect(field).toBe('-');
            } else {
              expect(field).toMatch(/^[0-9]+$/);
              expect(pickOf(field)).toBe(pick);
            }
          }

          // Down the Diff_Text neither the first-side nor the second-side pick indices decrease (R6.14).
          const writtenFirst = pickOf(parsed.firstPick);
          if (writtenFirst !== undefined) {
            expect(writtenFirst).toBeGreaterThanOrEqual(lastFirstPick);
            lastFirstPick = writtenFirst;
          }
          const writtenSecond = pickOf(parsed.secondPick);
          if (writtenSecond !== undefined) {
            expect(writtenSecond).toBeGreaterThanOrEqual(lastSecondPick);
            lastSecondPick = writtenSecond;
          }

          // The line carries text in place of the Bit_Line, and the summary marker starts no entry line.
          expect(parsed.lineText.length).toBeGreaterThan(0);
          expect(parsed.marker).not.toBe('#');
        }
      }),
      { seed: DIFF_TEXT_SEED, numRuns: DIFF_TEXT_RUNS },
    );
  });
});

/**
 * `diffToText` on a value that is not a Diff (R1.8, R6.15). Property P10 of
 * `tests/codec-view/totality.test.ts` found, at seed 11820, that `diffToText` threw a TypeError on
 * a Diff whose `entries` field held text; these examples pin the line it gives instead, for that
 * counterexample and for every other shape the Diff type cannot rule out at run time.
 */

/**
 * A value handed to `diffToText` in place of a Diff. R1.8 is about what the module does when such a
 * value reaches it while the app runs, which no type can state.
 */
function asGiven<Value>(value: unknown): Value {
  return value as Value;
}

/** Diff_Counts of no change, the counts these examples carry where the problem lies elsewhere. */
const NO_CHANGES = { changedHoles: 0, addedCards: 0, removedCards: 0 };

/** One Diff_Entry `diffToText` writes, so an entries list can hold a real entry beside junk. */
const ONE_ENTRY: DiffEntry = {
  kind: 'unchanged',
  first: bitsLine(0, '010101'),
  second: bitsLine(0, '010101'),
};

/**
 * The shape R6.15 fixes for the one line a Diff that holds no entries to write gives: a single
 * line starting '!', with no summary line, so it can be read as neither an entry nor a summary.
 */
function expectOneRefusalShapedLine(text: string): void {
  expect(text.split('\n')).toHaveLength(1);
  expect(text.startsWith('!')).toBe(true);
  expect(text).not.toContain('#');
}

/** Every given value gives that one line, and every line has the shape R6.15 fixes. */
function expectEachGives(given: ReadonlyArray<unknown>, line: string): void {
  for (const value of given) {
    const text = diffToText(asGiven(value));
    expect(text).toBe(line);
    expectOneRefusalShapedLine(text);
  }
}

describe('diffToText on a value that is not a Diff', () => {
  it('R1.8 names the ok field for a value that carries no ok field', () => {
    expectEachGives(
      [null, undefined, 0, 'a diff', true, {}, [], { ok: 'yes' }, { ok: null }],
      '! not-a-diff ok',
    );
  });

  it('R1.8 names the refusal field for a refused Diff carrying no refusal of the three reasons', () => {
    expectEachGives(
      [
        { ok: false },
        { ok: false, refusal: undefined },
        { ok: false, refusal: 'dimension-mismatch' },
        { ok: false, refusal: { reason: 'no-such-reason' } },
      ],
      '! not-a-diff refusal',
    );
  });

  it('R1.8 names the refusal field for a refusal carrying none of the values its reason names', () => {
    expectEachGives(
      [
        { ok: false, refusal: { reason: 'dimension-mismatch' } },
        { ok: false, refusal: { reason: 'dimension-mismatch', first: {}, second: {} } },
        { ok: false, refusal: { reason: 'profile-mismatch', firstProfileName: 'first-design' } },
        { ok: false, refusal: { reason: 'too-many-picks' } },
      ],
      '! not-a-diff refusal',
    );
  });

  it('R1.8 names the entries field for a Diff carrying no list of Diff_Entries', () => {
    expectEachGives(
      [
        { ok: true, first: HEADER, second: HEADER, counts: NO_CHANGES },
        { ok: true, first: HEADER, second: HEADER, entries: '', counts: NO_CHANGES },
        { ok: true, first: HEADER, second: HEADER, entries: {}, counts: NO_CHANGES },
        { ok: true, first: HEADER, second: HEADER, entries: 0, counts: NO_CHANGES },
      ],
      '! not-a-diff entries',
    );
  });

  it('R1.8 names one entry for an entries list holding something that is no Diff_Entry', () => {
    const notEntries: ReadonlyArray<unknown> = [
      null,
      'unchanged',
      {},
      { kind: 'moved' },
      // A kind of R6.4 missing the Line its side carries, or carrying something that is no Line.
      { kind: 'unchanged', first: bitsLine(0, '010101') },
      { kind: 'changed', first: bitsLine(0, '010101'), second: 'bits' },
      { kind: 'added', second: { kind: 'bits', pick: 0 } },
      { kind: 'removed', first: { kind: 'bits', pick: '0', bits: '010101' } },
      { kind: 'removed', first: { kind: 'damaged', pick: 0, violations: 'not-a-boolean' } },
      { kind: 'removed', first: { kind: 'damaged', pick: 0, violations: [{ kind: 'not-a-boolean' }] } },
    ];
    expectEachGives(
      notEntries.map((junk) => ({
        ok: true,
        first: HEADER,
        second: HEADER,
        entries: [ONE_ENTRY, junk],
        counts: NO_CHANGES,
      })),
      '! not-a-diff entry',
    );
  });

  it('R1.8 names the counts field for a Diff carrying no three Diff_Counts', () => {
    expectEachGives(
      [
        { ok: true, first: HEADER, second: HEADER, entries: [ONE_ENTRY] },
        { ok: true, first: HEADER, second: HEADER, entries: [ONE_ENTRY], counts: 'none' },
        {
          ok: true,
          first: HEADER,
          second: HEADER,
          entries: [ONE_ENTRY],
          counts: { changedHoles: 0, addedCards: 0 },
        },
        {
          ok: true,
          first: HEADER,
          second: HEADER,
          entries: [ONE_ENTRY],
          counts: { changedHoles: '0', addedCards: 0, removedCards: 0 },
        },
      ],
      '! not-a-diff counts',
    );
  });

  it('R1.8 writes the Diff_Text of the counterexample P10 reported, where it used to throw', () => {
    // The shrunk counterexample of P10 at seed 11820: a Diff that is no refusal whose `entries`
    // field holds text rather than a list of Diff_Entries. The two headers here are this file's
    // fixture, because the card geometry the counterexample carried made no difference to the throw.
    const reported: unknown = {
      ok: true,
      first: HEADER,
      second: HEADER,
      entries: '',
      counts: NO_CHANGES,
    };
    const text = diffToText(asGiven(reported));
    expect(text).toBe('! not-a-diff entries');
    expectOneRefusalShapedLine(text);
  });

  it("R6.15 writes no line of a value that is no Diff under any of the three refusal reasons", () => {
    // `not-a-diff` is none of the three reasons, so no reader of a Diff_Text can mistake one of
    // these lines for a refusal `diffPatterns` returned (R5.1, R6.15).
    const text = diffToText(asGiven({ ok: true, entries: '' }));
    for (const reason of ['dimension-mismatch', 'profile-mismatch', 'too-many-picks']) {
      expect(text).not.toContain(reason);
    }
    expect(text).toContain('not-a-diff');
  });

  it('R1.8 still writes a header-less Diff as its entry lines and its summary line', () => {
    // A Diff carrying its entries and counts but no Line_Set header has no hookColumns to cut the
    // Bit_Line on, so the Bit_Line comes back ungrouped rather than throwing, and the entry line
    // and the summary line are written as ever (R6.4, R6.5).
    const text = diffToText(asGiven({ ok: true, entries: [ONE_ENTRY], counts: NO_CHANGES }));
    expect(text).toBe(['  0/0 010101', '# 0 0 0'].join('\n'));
  });
});
