import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodeCardGrid } from '../../../src/codec/index.ts';
import type { CardProfile } from '../../../src/codec/types.ts';
import { cardToBits, GROUP_SEPARATOR } from '../../../src/codec-view/index.ts';
import type { BitsLine, DamagedLine, DiffEntry, Line } from '../../../src/codec-view/index.ts';
import type { Language } from '../../../src/ui/types.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { cardGridArbitrary, profileArbitrary } from '../../support/profiles.ts';
import {
  diffEntryAccessibleName,
  lineAccessibleName,
  nextBreakpoint,
  parseJump,
  pickNumberWidth,
  toggleBreakpoint,
  WINDOW_MARGIN,
  WINDOW_SIZE,
  windowFor,
} from '../../../src/ui/state/codeView.ts';
import type { PickWindow } from '../../../src/ui/state/codeView.ts';

/** The invariants of the Window for a pick that is a pick of the pattern (design: The listing Window). */
function expectInvariants(
  window: PickWindow,
  pickCount: number,
  selectedPick: number,
  firstVisiblePick: number,
  visiblePicks: number,
): void {
  expect(window.count).toBeLessThanOrEqual(WINDOW_SIZE);
  expect(window.from).toBeGreaterThanOrEqual(0);
  expect(window.from + window.count).toBeLessThanOrEqual(pickCount);
  expect(selectedPick).toBeGreaterThanOrEqual(window.from);
  expect(selectedPick).toBeLessThan(window.from + window.count);
  if (visiblePicks <= window.count) {
    expect(firstVisiblePick).toBeGreaterThanOrEqual(window.from);
    expect(firstVisiblePick + visiblePicks).toBeLessThanOrEqual(window.from + window.count);
  }
}

describe('Window constants', () => {
  it('R2.5 the Window_Size is fixed between 40 and 200 Lines', () => {
    expect(WINDOW_SIZE).toBe(80);
    expect(WINDOW_SIZE).toBeGreaterThanOrEqual(40);
    expect(WINDOW_SIZE).toBeLessThanOrEqual(200);
    expect(WINDOW_MARGIN).toBe(10);
  });
});

describe('windowFor examples', () => {
  it('R2.4 a pattern with no picks gives an empty Window', () => {
    expect(windowFor(null, 0, 0, 0, 10)).toEqual({ from: 0, count: 0 });
    expect(windowFor({ from: 5, count: 20 }, 0, 3, 0, 10)).toEqual({ from: 0, count: 0 });
    expect(windowFor(null, -4, 0, 0, 10)).toEqual({ from: 0, count: 0 });
  });

  it('R2.4 a pattern of one pick gives a Window of that pick', () => {
    const window = windowFor(null, 1, 0, 0, 10);
    expect(window).toEqual({ from: 0, count: 1 });
    expectInvariants(window, 1, 0, 0, 1);
  });

  it('R2.4 a pattern shorter than the Window_Size is held whole', () => {
    expect(windowFor(null, 36, 20, 30, 12)).toEqual({ from: 0, count: 36 });
  });

  it('R2.4 a 10,000-pick pattern gets a Window of exactly Window_Size picks holding the Selected_Pick and the visible picks', () => {
    const pickCount = 10_000;
    for (const [selectedPick, firstVisiblePick, visiblePicks] of [
      [0, 0, 20],
      [9_999, 9_980, 20],
      [5_000, 4_990, 40],
      [4_321, 4_321, 80],
    ] as const) {
      const window = windowFor(null, pickCount, selectedPick, firstVisiblePick, visiblePicks);
      expect(window.count).toBe(WINDOW_SIZE);
      expectInvariants(window, pickCount, selectedPick, firstVisiblePick, visiblePicks);
    }
  });

  it('R2.7 a Selected_Pick far from the visible span stays in the Window and the visible span yields', () => {
    for (const [selectedPick, firstVisiblePick] of [[5_000, 0], [0, 9_999]] as const) {
      const window = windowFor(null, 10_000, selectedPick, firstVisiblePick, 20);
      expect(window.count).toBe(WINDOW_SIZE);
      expectInvariants(window, 10_000, selectedPick, selectedPick, 1);
    }
  });

  it('R2.11 a scroll inside the margin returns the same Window object', () => {
    const previous: PickWindow = { from: 100, count: WINDOW_SIZE };
    const scrolled = windowFor(previous, 10_000, 120, 120 - WINDOW_MARGIN + 5, 20);
    expect(scrolled).toBe(previous);
    const atEdge = windowFor(previous, 10_000, 125, 100 + WINDOW_MARGIN, 40);
    expect(atEdge).toBe(previous);
  });

  it('R2.11 a scroll past the margin moves the Window so every visible pick is in it', () => {
    const previous: PickWindow = { from: 100, count: WINDOW_SIZE };
    const firstVisiblePick = 100 + WINDOW_MARGIN - 1;
    const moved = windowFor(previous, 10_000, firstVisiblePick, firstVisiblePick, 30);
    expect(moved).not.toBe(previous);
    expectInvariants(moved, 10_000, firstVisiblePick, firstVisiblePick, 30);
  });

  it('R2.7 a Selected_Pick outside the Window moves it', () => {
    const previous: PickWindow = { from: 100, count: WINDOW_SIZE };
    const forward = windowFor(previous, 10_000, 5_000, 100, 20);
    expect(forward).not.toBe(previous);
    expectInvariants(forward, 10_000, 5_000, 5_000, 1);
    const backward = windowFor(previous, 10_000, 3, 100, 20);
    expectInvariants(backward, 10_000, 3, 3, 1);
    expect(backward.from).toBe(3);
  });

  it('R2.7 when the visible span is wider than the Window the part holding the Selected_Pick is kept', () => {
    const pickCount = 10_000;
    const below = windowFor(null, pickCount, 500, 100, 400);
    expectInvariants(below, pickCount, 500, 500, 1);
    const inside = windowFor(null, pickCount, 120, 100, 400);
    expectInvariants(inside, pickCount, 120, 120, 1);
    expect(inside.count).toBe(WINDOW_SIZE);
  });

  it('R2.4 a previous Window of another size or outside the pattern is not reused', () => {
    expect(windowFor({ from: 0, count: 10 }, 36, 5, 0, 10)).toEqual({ from: 0, count: 36 });
    const stale: PickWindow = { from: 9_950, count: WINDOW_SIZE };
    const window = windowFor(stale, 100, 50, 40, 20);
    expectInvariants(window, 100, 50, 40, 20);
  });

  it('R2.4 a Window at either end of the pattern is clamped into it', () => {
    expect(windowFor(null, 10_000, 0, 0, 20)).toEqual({ from: 0, count: WINDOW_SIZE });
    expect(windowFor(null, 10_000, 9_999, 9_990, 10)).toEqual({ from: 10_000 - WINDOW_SIZE, count: WINDOW_SIZE });
  });

  it('R2.4 a Selected_Pick or scroll position out of range is clamped and nothing throws', () => {
    expect(windowFor(null, 50, 999, -5, NaN)).toEqual({ from: 0, count: 50 });
    const window = windowFor(null, 10_000, Infinity, NaN, -3);
    expectInvariants(window, 10_000, 9_999, 9_999, 1);
  });
});

describe('pickNumberWidth examples', () => {
  it('R2.3 the width is the number of characters of the largest pick index', () => {
    expect(pickNumberWidth(0)).toBe(1);
    expect(pickNumberWidth(1)).toBe(1);
    expect(pickNumberWidth(10)).toBe(1);
    expect(pickNumberWidth(11)).toBe(2);
    expect(pickNumberWidth(100)).toBe(2);
    expect(pickNumberWidth(101)).toBe(3);
    expect(pickNumberWidth(10_000)).toBe(4);
    expect(pickNumberWidth(10_001)).toBe(5);
  });

  it('R2.3 a count that is not a pick count gives the width of one character', () => {
    expect(pickNumberWidth(NaN)).toBe(1);
    expect(pickNumberWidth(-7)).toBe(1);
  });
});

describe('toggleBreakpoint examples', () => {
  it('R3.6 a toggle sets a Breakpoint where the pick index has none, keeping the list ascending', () => {
    expect(toggleBreakpoint([], 4)).toEqual([4]);
    expect(toggleBreakpoint([2, 9], 5)).toEqual([2, 5, 9]);
    expect(toggleBreakpoint([2, 9], 0)).toEqual([0, 2, 9]);
  });
  it('R3.6 a toggle removes the Breakpoint where the pick index has one', () => {
    expect(toggleBreakpoint([2, 5, 9], 5)).toEqual([2, 9]);
    expect(toggleBreakpoint([5], 5)).toEqual([]);
  });
  it('R3.6 a double toggle restores the set', () => {
    const start = [1, 4, 7];
    for (const pick of [0, 1, 4, 5, 7, 12]) {
      expect(toggleBreakpoint(toggleBreakpoint(start, pick), pick)).toEqual(start);
    }
  });
  it('R3.6 a pick index that is negative or not a whole number leaves the Breakpoints as they were', () => {
    const start = [1, 4];
    expect(toggleBreakpoint(start, -1)).toBe(start);
    expect(toggleBreakpoint(start, 0.5)).toBe(start);
    expect(toggleBreakpoint(start, NaN)).toBe(start);
    expect(toggleBreakpoint(start, Infinity)).toBe(start);
  });
  it('R3.6 a toggle does not change the list it was given', () => {
    const start = [3, 6];
    toggleBreakpoint(start, 3);
    toggleBreakpoint(start, 4);
    expect(start).toEqual([3, 6]);
  });
});

describe('nextBreakpoint examples', () => {
  it('R3.8 it returns the lowest Breakpoint above the pick, found', () => {
    expect(nextBreakpoint([2, 5, 9], 0, 20)).toEqual({ pick: 2, found: true });
    expect(nextBreakpoint([2, 5, 9], 2, 20)).toEqual({ pick: 5, found: true });
    expect(nextBreakpoint([2, 5, 9], 6, 20)).toEqual({ pick: 9, found: true });
  });
  it('R3.8 a Breakpoint on the pick itself is not above it', () => {
    expect(nextBreakpoint([5], 5, 20)).toEqual({ pick: 20, found: false });
  });
  it('R3.9 with no Breakpoint above the pick it returns the last pick index, not found', () => {
    expect(nextBreakpoint([], 3, 20)).toEqual({ pick: 20, found: false });
    expect(nextBreakpoint([1, 2, 3], 3, 20)).toEqual({ pick: 20, found: false });
    expect(nextBreakpoint([2, 5], 20, 20)).toEqual({ pick: 20, found: false });
  });
  it('R3.9 a Breakpoint beyond the last pick index does not count', () => {
    expect(nextBreakpoint([2, 30], 2, 20)).toEqual({ pick: 20, found: false });
  });
});

describe('parseJump examples', () => {
  const lastPick = 9;
  it('R3.4 a whole number from 0 to the last pick index succeeds', () => {
    expect(parseJump('0', lastPick)).toEqual({ ok: true, pick: 0 });
    expect(parseJump('5', lastPick)).toEqual({ ok: true, pick: 5 });
    expect(parseJump(String(lastPick), lastPick)).toEqual({ ok: true, pick: lastPick });
  });
  it('R3.5 a blank value fails', () => {
    expect(parseJump('', lastPick)).toEqual({ ok: false });
    expect(parseJump('   ', lastPick)).toEqual({ ok: false });
  });
  it('R3.5 a value that is not a whole number fails', () => {
    expect(parseJump('3.5', lastPick)).toEqual({ ok: false });
    expect(parseJump('3.0', lastPick)).toEqual({ ok: false });
    expect(parseJump('abc', lastPick)).toEqual({ ok: false });
    expect(parseJump('NaN', lastPick)).toEqual({ ok: false });
    expect(parseJump('Infinity', lastPick)).toEqual({ ok: false });
  });
  it('R3.5 a value outside 0 to the last pick index fails', () => {
    expect(parseJump('-1', lastPick)).toEqual({ ok: false });
    expect(parseJump(String(lastPick + 1), lastPick)).toEqual({ ok: false });
    expect(parseJump('99999999999999999999999', lastPick)).toEqual({ ok: false });
  });
  it('R3.4 a pick number is ASCII digits with optional surrounding whitespace and nothing else', () => {
    expect(parseJump('  7 ', lastPick)).toEqual({ ok: true, pick: 7 });
    expect(parseJump('\t7\n', lastPick)).toEqual({ ok: true, pick: 7 });
    expect(parseJump('007', lastPick)).toEqual({ ok: true, pick: 7 });
    for (const text of ['7e0', '1e3', '0x7', '+7', '٣', '７', '7 7', '7,0', '7_0']) {
      expect(parseJump(text, lastPick), text).toEqual({ ok: false });
    }
  });
  it('R3.5 a design with no picks has no pick index to jump to', () => {
    expect(parseJump('0', -1)).toEqual({ ok: false });
    expect(parseJump('0', NaN)).toEqual({ ok: false });
  });
});

describe('accessible names (task 2.6)', () => {
  const en = translator(DICTIONARIES, 'en');
  const hi = translator(DICTIONARIES, 'hi');
  const hasLatinLetter = /[A-Za-z]/;

  // Bit_Lines are written out by hand, one character for each end, so no profile is needed.
  const bitsLine = (pick: number, bits: string): BitsLine => ({ kind: 'bits', pick, bits });
  const damagedLine = (pick: number): DamagedLine => ({
    kind: 'damaged',
    pick,
    violations: [{ kind: 'wrong-ends-length', location: 'ends', message: 'wrong length', expected: 8, actual: 7 }],
  });

  describe('lineAccessibleName', () => {
    it('R11.3 pick 5 punched at ends 0, 3 and 7 reads exactly "Pick 5: punched at ends 0, 3, 7" in English', () => {
      expect(lineAccessibleName(en, bitsLine(5, '10010001'))).toBe('Pick 5: punched at ends 0, 3, 7');
    });

    it('R11.4 pick 5 with no punched end reads exactly "Pick 5: no end punched" in English', () => {
      expect(lineAccessibleName(en, bitsLine(5, '00000000'))).toBe('Pick 5: no end punched');
    });

    it('R11.3 one punched end names that end alone, with no comma', () => {
      expect(lineAccessibleName(en, bitsLine(0, '00000100'))).toBe('Pick 0: punched at ends 5');
    });

    it('R11.3 every end punched lists every end index in ascending order', () => {
      expect(lineAccessibleName(en, bitsLine(12, '1111'))).toBe('Pick 12: punched at ends 0, 1, 2, 3');
    });

    it('R11.3 a Group_Separator in the Bit_Line is never counted and never appears in the name', () => {
      const grouped = lineAccessibleName(en, bitsLine(5, `1001${GROUP_SEPARATOR}0001`));
      expect(grouped).not.toContain(GROUP_SEPARATOR);
      expect(lineAccessibleName(en, bitsLine(5, `0000${GROUP_SEPARATOR}0000`))).toBe('Pick 5: no end punched');
    });

    it('R11.3 the pick number appears as digits for a pick with several digits', () => {
      expect(lineAccessibleName(en, bitsLine(10000, '01'))).toBe('Pick 10000: punched at ends 1');
    });

    it('R11.12 a damaged Line names its pick and the damaged card and lists no end index', () => {
      const name = lineAccessibleName(en, damagedLine(7));
      expect(name).toBe('Pick 7: damaged card');
      expect(name).not.toContain('ends');
    });

    it('R10.8 the Hindi names of a bits Line hold पिक and एंड and no English word', () => {
      const several = lineAccessibleName(hi, bitsLine(5, '10010001'));
      expect(several).toContain('पिक');
      expect(several).toContain('एंड');
      expect(several).toContain('5');
      expect(several).toContain('0, 3, 7');
      expect(several).not.toMatch(hasLatinLetter);

      const one = lineAccessibleName(hi, bitsLine(5, '00000100'));
      expect(one).toContain('पिक');
      expect(one).toContain('एंड');
      expect(one).toContain('5');
      expect(one).not.toMatch(hasLatinLetter);
    });

    it('R10.8 the Hindi name of a Line with no punched end holds पिक and no English word', () => {
      const name = lineAccessibleName(hi, bitsLine(5, '00000000'));
      expect(name).toContain('पिक');
      expect(name).toContain('5');
      expect(name).not.toMatch(hasLatinLetter);
      expect(name).not.toBe(lineAccessibleName(en, bitsLine(5, '00000000')));
    });

    it('R10.8 the Hindi name of a damaged Line holds पिक and no English word and no end index', () => {
      const name = lineAccessibleName(hi, damagedLine(7));
      expect(name).toContain('पिक');
      expect(name).toContain('7');
      expect(name).not.toContain('एंड');
      expect(name).not.toMatch(hasLatinLetter);
    });
  });

  describe('diffEntryAccessibleName', () => {
    const first = bitsLine(3, '1010');
    const second = bitsLine(4, '1001');
    const unchanged: DiffEntry = { kind: 'unchanged', first, second: bitsLine(4, '1010') };
    const changed: DiffEntry = { kind: 'changed', first, second, changedHoles: [1, 2] };
    const changedMany: DiffEntry = {
      kind: 'changed',
      first: bitsLine(8, '11110000'),
      second: bitsLine(9, '00001111'),
      changedHoles: [0, 2, 5, 7],
    };
    const added: DiffEntry = { kind: 'added', second: bitsLine(4, '1001') };
    const removed: DiffEntry = { kind: 'removed', first };

    it('R11.5 each of the four kinds reads its kind word and its pick numbers in English', () => {
      expect(diffEntryAccessibleName(en, unchanged)).toBe('Unchanged: pick 3 and pick 4');
      expect(diffEntryAccessibleName(en, changed)).toBe('Changed: pick 3 and pick 4, ends 1, 2');
      expect(diffEntryAccessibleName(en, added)).toBe('Added: pick 4');
      expect(diffEntryAccessibleName(en, removed)).toBe('Removed: pick 3');
    });

    it('R11.5 a changed entry with several differing ends lists them in ascending order', () => {
      expect(diffEntryAccessibleName(en, changedMany)).toBe('Changed: pick 8 and pick 9, ends 0, 2, 5, 7');
    });

    it('R11.5 a changed entry lists ascending ends even when the Changed_Holes arrive unsorted', () => {
      const unsorted: DiffEntry = { ...changedMany, changedHoles: [7, 0, 5, 2] };
      expect(diffEntryAccessibleName(en, unsorted)).toBe('Changed: pick 8 and pick 9, ends 0, 2, 5, 7');
    });

    it('R11.5 each kind in Hindi holds the Hindi kind word and its pick numbers, and no English word', () => {
      const cases: ReadonlyArray<{ entry: DiffEntry; kindWord: string; picks: ReadonlyArray<string> }> = [
        { entry: unchanged, kindWord: hi('codeview.diff.kind.unchanged'), picks: ['3', '4'] },
        { entry: changed, kindWord: hi('codeview.diff.kind.changed'), picks: ['3', '4'] },
        { entry: added, kindWord: hi('codeview.diff.kind.added'), picks: ['4'] },
        { entry: removed, kindWord: hi('codeview.diff.kind.removed'), picks: ['3'] },
      ];
      for (const { entry, kindWord, picks } of cases) {
        const name = diffEntryAccessibleName(hi, entry);
        expect(name, entry.kind).toContain(kindWord);
        expect(name, entry.kind).toContain('पिक');
        for (const pick of picks) expect(name, entry.kind).toContain(pick);
        expect(name, entry.kind).not.toMatch(hasLatinLetter);
      }
    });

    it('R10.8 the Hindi name of a changed entry with several differing ends holds एंड and the ascending ends', () => {
      const name = diffEntryAccessibleName(hi, changedMany);
      expect(name).toContain('एंड');
      expect(name).toContain('0, 2, 5, 7');
      expect(name).not.toMatch(hasLatinLetter);
    });

    it('R11.5 the name of each kind differs from the name of every other kind, so the marker is never the only statement', () => {
      for (const t of [en, hi]) {
        const names = [unchanged, changed, added, removed].map((entry) => diffEntryAccessibleName(t, entry));
        expect(new Set(names).size).toBe(4);
      }
    });
  });
});

describe('accessible names, property (task 2.6)', () => {
  /** Fixed seed and run count for the R11.3 property (R12.4). */
  const NAME_SEED = 211103;
  const NAME_RUNS = 300;
  const hasLatinLetter = /[A-Za-z]/;
  const digitRuns = /\d+/g;

  /**
   * A card for the profile that is valid, all punched, none punched, or damaged in one of four ways: a missing
   * hook row, a hook row one hook column too long, a hook position that is not a boolean, or no card at all.
   * Every dimension comes from the generated profile.
   */
  function cardOrDamageArbitrary(profile: CardProfile): fc.Arbitrary<unknown> {
    const valid = cardGridArbitrary(profile);
    const filled = (punched: boolean): boolean[][] =>
      Array.from({ length: profile.hookRows }, () => Array.from({ length: profile.hookColumns }, () => punched));
    return fc.oneof(
      { weight: 4, arbitrary: valid },
      { weight: 1, arbitrary: fc.constant(filled(true)) },
      { weight: 1, arbitrary: fc.constant(filled(false)) },
      { weight: 1, arbitrary: valid.map((card) => card.slice(1)) },
      { weight: 1, arbitrary: valid.map((card) => card.map((row, hookRow) => (hookRow === 0 ? [...row, true] : row))) },
      {
        weight: 1,
        arbitrary: fc
          .tuple(valid, fc.nat({ max: profile.hookRows - 1 }), fc.nat({ max: profile.hookColumns - 1 }))
          .map(([card, hookRow, hookColumn]) =>
            card.map((row, rowIndex) =>
              rowIndex === hookRow ? row.map((cell, columnIndex): unknown => (columnIndex === hookColumn ? 'yes' : cell)) : row,
            ),
          ),
      },
      { weight: 1, arbitrary: fc.constant(null) },
    );
  }

  /**
   * One Line of either kind at any pick index, built the only way the app builds one: a card through `cardToBits`,
   * which gives a `bits` Line for a valid card and a `damaged` Line carrying the violations for any other. The
   * expected punched ends of a `bits` Line come from `encodeCardGrid`, the one hook-position-to-end mapping.
   */
  function lineArbitrary(profile: CardProfile): fc.Arbitrary<{ line: Line; punchedEnds: number[] }> {
    return fc.tuple(cardOrDamageArbitrary(profile), fc.integer({ min: 0, max: 100_000 })).map(([card, pick]) => {
      const bits = cardToBits(profile, card);
      if (!bits.ok) return { line: { kind: 'damaged', pick, violations: bits.violations }, punchedEnds: [] };
      const ends = encodeCardGrid(profile, card);
      if (!ends.ok) throw new Error('encodeCardGrid refused a card that cardToBits read');
      const punchedEnds = ends.value.flatMap((punched, end) => (punched ? [end] : []));
      return { line: { kind: 'bits', pick, bits: bits.bits }, punchedEnds };
    });
  }

  it('R11.3 a Line accessible name names its pick and its punched ends', () => {
    // **Validates: Requirements R10.8, R11.3, R11.4, R11.12**
    fc.assert(
      fc.property(
        profileArbitrary.chain((profile) => fc.tuple(fc.constant(profile), lineArbitrary(profile))),
        fc.constantFrom<Language>('en', 'hi'),
        ([profile, { line, punchedEnds }], language) => {
          const t = translator(DICTIONARIES, language);
          const name = lineAccessibleName(t, line);

          // The Line was built from the generated profile: a `bits` Line has one character per end.
          if (line.kind === 'bits') expect(line.bits).toHaveLength(profile.hookRows * profile.hookColumns);

          // Never a Group_Separator, and in Hindi never a Latin letter (R11.3, R10.8).
          expect(name).not.toContain(GROUP_SEPARATOR);
          if (language === 'hi') expect(name).not.toMatch(hasLatinLetter);

          // The pick number as digits, then exactly the punched ends, ascending, and no other number (R11.3, R11.12).
          const numbers = (name.match(digitRuns) ?? []).map(Number);
          expect(numbers).toEqual([line.pick, ...punchedEnds]);
          expect(name.startsWith(language === 'hi' ? 'पिक' : 'Pick')).toBe(true);

          if (line.kind === 'damaged') {
            // The damaged-card text, and no end index and no word for an end (R11.12).
            expect(name).toBe(t('codeview.line.nameDamaged', { pick: line.pick }));
            if (language === 'en') expect(name).toBe(`Pick ${line.pick}: damaged card`);
            if (language === 'hi') expect(name).not.toContain('एंड');
          } else if (punchedEnds.length === 0) {
            // The no-end-punched text (R11.4).
            expect(name).toBe(t('codeview.line.nameEmpty', { pick: line.pick }));
            if (language === 'en') expect(name).toBe(`Pick ${line.pick}: no end punched`);
          } else {
            // The ends joined by a comma and a space, in the text each language fixes (R11.3).
            const list = punchedEnds.join(', ');
            expect(name).toContain(list);
            if (language === 'en') expect(name).toBe(`Pick ${line.pick}: punched at ends ${list}`);
            if (language === 'hi') expect(name).toContain('एंड');
          }

          // Hindi is its own text, not the English text (R10.8).
          if (language === 'hi') expect(name).not.toBe(lineAccessibleName(translator(DICTIONARIES, 'en'), line));
        },
      ),
      { seed: NAME_SEED, numRuns: NAME_RUNS },
    );
  });
});
