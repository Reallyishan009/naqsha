/**
 * `lineKey` and `alignLines` (task 1.6, R5.2).
 *
 * `alignLines` never sees a Card_Profile: it reads only the two sequences of Line keys. So the
 * Bit_Line width used below is generated, not a card dimension, and the example Bit_Lines are the
 * ones the design writes out in "The tie-breaking rule".
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Violation, ViolationKind } from '../../src/codec/types.ts';
import type { Alignment, Line } from '../../src/codec-view/types.ts';
import { alignLines, lineKey } from '../../src/codec-view/align.ts';

/** The Lines of a list of Bit_Lines, Line p carrying pick index p, as patternToLines numbers them. */
function bitsLines(bitLines: ReadonlyArray<string>): Line[] {
  return bitLines.map((bits, pick): Line => ({ kind: 'bits', pick, bits }));
}

/** One damaged Line: the Line patternToLines writes for a card that failed validateCardGrid. */
function damagedLine(pick: number, kind: ViolationKind, location: string): Line {
  const violation: Violation = { kind, location, message: `${kind} at ${location}` };
  return { kind: 'damaged', pick, violations: [violation] };
}

/** The Lines renumbered from pick 0 upwards, with no gap and no repeat (R1.6). */
function renumber(lines: ReadonlyArray<Line>): Line[] {
  return lines.map((line, pick): Line =>
    line.kind === 'bits'
      ? { kind: 'bits', pick, bits: line.bits }
      : { kind: 'damaged', pick, violations: line.violations },
  );
}

/** The matched pairs as plain number pairs, which read more clearly in a failure message. */
function pairsOf(alignment: Alignment): number[][] {
  return alignment.map((pair) => [pair.firstPick, pair.secondPick]);
}

/** The matched pairs with their two pick indices swapped — step 3 of the tie-breaking rule. */
function mirror(alignment: Alignment): number[][] {
  return alignment.map((pair) => [pair.secondPick, pair.firstPick]);
}

/** The total index displacement of an Alignment, the second key of the dynamic program. */
function totalDisplacement(alignment: Alignment): number {
  return alignment.reduce((sum, pair) => sum + Math.abs(pair.firstPick - pair.secondPick), 0);
}

/**
 * The greatest length a common subsequence of the two key sequences can have and, among the
 * matchings of that length, the least total index displacement — found by walking every
 * order-preserving matching. Exponential, so it is only run on short sequences; it is deliberately
 * not the module's dynamic program, so that it can disagree with it.
 */
function bestMatching(
  firstKeys: ReadonlyArray<string>,
  secondKeys: ReadonlyArray<string>,
): { length: number; displacement: number } {
  let best = { length: 0, displacement: 0 };
  const walk = (fromFirst: number, fromSecond: number, length: number, displacement: number): void => {
    if (length > best.length || (length === best.length && displacement < best.displacement)) {
      best = { length, displacement };
    }
    for (let a = fromFirst; a < firstKeys.length; a += 1) {
      for (let b = fromSecond; b < secondKeys.length; b += 1) {
        if (firstKeys[a] === secondKeys[b]) {
          walk(a + 1, b + 1, length + 1, displacement + Math.abs(a - b));
        }
      }
    }
  };
  walk(0, 0, 0, 0);
  return best;
}

/** A Bit_Line of `endsPerPick` characters. A narrow card keeps equal Bit_Lines, and so ties, common. */
function bitLineArbitrary(endsPerPick: number): fc.Arbitrary<string> {
  return fc
    .array(fc.constantFrom('0', '1'), { minLength: endsPerPick, maxLength: endsPerPick })
    .map((bits) => bits.join(''));
}

const DAMAGE_KINDS: ReadonlyArray<ViolationKind> = ['not-an-array', 'not-a-boolean', 'wrong-hook-row-count'];

/** One Line at pick 0, either a card read as bits or a damaged card; `renumber` gives it its pick. */
function lineArbitrary(endsPerPick: number): fc.Arbitrary<Line> {
  const bits = bitLineArbitrary(endsPerPick).map((text): Line => ({ kind: 'bits', pick: 0, bits: text }));
  const damaged = fc
    .tuple(fc.constantFrom(...DAMAGE_KINDS), fc.constantFrom('grid[0]', 'grid[1]'))
    .map(([kind, location]) => damagedLine(0, kind, location));
  return fc.oneof({ weight: 6, arbitrary: bits }, { weight: 1, arbitrary: damaged });
}

function lineSequenceArbitrary(endsPerPick: number, maxPicks: number): fc.Arbitrary<Line[]> {
  return fc.array(lineArbitrary(endsPerPick), { maxLength: maxPicks }).map(renumber);
}

/** Two Line sequences of the same generated Ends_Per_Pick, so their Bit_Lines can be equal. */
function pairArbitrary(maxPicks: number): fc.Arbitrary<[Line[], Line[]]> {
  return fc
    .integer({ min: 1, max: 3 })
    .chain((endsPerPick) =>
      fc.tuple(lineSequenceArbitrary(endsPerPick, maxPicks), lineSequenceArbitrary(endsPerPick, maxPicks)),
    );
}

describe('lineKey', () => {
  it('is the Bit_Line of a bits Line', () => {
    expect(lineKey({ kind: 'bits', pick: 7, bits: '0110' })).toBe('0110');
  });

  it("is 'x' with the violation kinds and locations of a damaged Line", () => {
    const line = damagedLine(3, 'not-a-boolean', 'grid[2][5]');
    expect(lineKey(line)).toBe('xnot-a-boolean@grid[2][5]');
  });

  it('is equal for two identically damaged Lines at different picks, and differs when the location does', () => {
    expect(lineKey(damagedLine(0, 'not-an-array', 'grid[0]'))).toBe(lineKey(damagedLine(4, 'not-an-array', 'grid[0]')));
    expect(lineKey(damagedLine(0, 'not-an-array', 'grid[0]'))).not.toBe(lineKey(damagedLine(0, 'not-an-array', 'grid[1]')));
  });

  it('never gives a damaged Line the key of a card read as bits', () => {
    const damagedKey = lineKey(damagedLine(0, 'not-an-array', 'grid[0]'));
    expect(damagedKey.startsWith('x')).toBe(true);
    expect(/^[01]*$/.test(damagedKey)).toBe(false);
  });
});

describe('alignLines examples', () => {
  it('matches picks 0 and 2 of the design example and leaves pick 1 unmatched on both sides', () => {
    const first = bitsLines(['00', '11', '00']);
    const second = bitsLines(['00', '00', '00']);
    const alignment = alignLines(first, second);
    expect(pairsOf(alignment)).toEqual([
      [0, 0],
      [2, 2],
    ]);
    expect(totalDisplacement(alignment)).toBe(0);
    expect(alignment.map((pair) => pair.firstPick)).not.toContain(1);
    expect(alignment.map((pair) => pair.secondPick)).not.toContain(1);
  });

  it('leaves every Line after an inserted card matched', () => {
    const first = bitsLines(['00', '01', '10']);
    const second = bitsLines(['00', '11', '01', '10']);
    expect(pairsOf(alignLines(first, second))).toEqual([
      [0, 0],
      [1, 2],
      [2, 3],
    ]);
  });

  it('gives mirrored pairs the other way round', () => {
    const first = bitsLines(['00', '01', '10']);
    const second = bitsLines(['00', '11', '01', '10']);
    expect(mirror(alignLines(second, first))).toEqual(pairsOf(alignLines(first, second)));
  });

  it('matches every Line of a sequence aligned with itself', () => {
    const lines = bitsLines(['00', '11', '00', '01']);
    expect(pairsOf(alignLines(lines, lines))).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it('matches nothing when either side has no Lines', () => {
    expect(alignLines([], [])).toEqual([]);
    expect(alignLines(bitsLines(['00', '11']), [])).toEqual([]);
    expect(alignLines([], bitsLines(['00', '11']))).toEqual([]);
  });

  it('matches two identically damaged cards and never a damaged card with a card read as bits', () => {
    const first: Line[] = [damagedLine(0, 'not-an-array', 'grid[0]'), { kind: 'bits', pick: 1, bits: '11' }];
    const second: Line[] = [damagedLine(0, 'not-an-array', 'grid[0]'), { kind: 'bits', pick: 1, bits: '00' }];
    expect(pairsOf(alignLines(first, second))).toEqual([[0, 0]]);
  });
});

describe('alignLines properties', () => {
  it('R5.2 the Alignment matches Lines with equal keys and ascends on both sides', () => {
    // **Validates: Requirements 5.2**
    fc.assert(
      fc.property(pairArbitrary(8), ([first, second]) => {
        const alignment = alignLines(first, second);
        let lastFirst = -1;
        let lastSecond = -1;
        for (const pair of alignment) {
          expect(pair.firstPick).toBeGreaterThan(lastFirst);
          expect(pair.secondPick).toBeGreaterThan(lastSecond);
          expect(pair.firstPick).toBeLessThan(first.length);
          expect(pair.secondPick).toBeLessThan(second.length);
          expect(lineKey(first[pair.firstPick])).toBe(lineKey(second[pair.secondPick]));
          lastFirst = pair.firstPick;
          lastSecond = pair.secondPick;
        }
      }),
      { seed: 10601, numRuns: 500 },
    );
  });

  it('R5.2 the Alignment is as long as a common subsequence can be and displaces the least', () => {
    // **Validates: Requirements 5.2**
    fc.assert(
      fc.property(pairArbitrary(5), ([first, second]) => {
        const alignment = alignLines(first, second);
        const best = bestMatching(first.map(lineKey), second.map(lineKey));
        expect(alignment.length).toBe(best.length);
        expect(totalDisplacement(alignment)).toBe(best.displacement);
      }),
      { seed: 10602, numRuns: 400 },
    );
  });

  it('R5.9 the Alignment one way round is the mirror of the Alignment the other way round', () => {
    // **Validates: Requirements 5.9**
    fc.assert(
      fc.property(pairArbitrary(8), ([first, second]) => {
        expect(mirror(alignLines(second, first))).toEqual(pairsOf(alignLines(first, second)));
      }),
      { seed: 10603, numRuns: 500 },
    );
  });

  it('R5.2 two Patterns that differ at one punched hole leave only that pick unmatched', () => {
    // **Validates: Requirements 5.2**
    const flipped = fc.integer({ min: 1, max: 4 }).chain((endsPerPick) =>
      fc.record({
        bitLines: fc.array(bitLineArbitrary(endsPerPick), { minLength: 1, maxLength: 8 }),
        pickChoice: fc.nat(),
        endChoice: fc.nat(),
        endsPerPick: fc.constant(endsPerPick),
      }),
    );
    fc.assert(
      fc.property(flipped, ({ bitLines, pickChoice, endChoice, endsPerPick }) => {
        const pick = pickChoice % bitLines.length;
        const end = endChoice % endsPerPick;
        const before = bitLines[pick];
        const after = `${before.slice(0, end)}${before[end] === '1' ? '0' : '1'}${before.slice(end + 1)}`;
        const second = [...bitLines];
        second[pick] = after;
        const alignment = alignLines(bitsLines(bitLines), bitsLines(second));
        const expected = bitLines.map((_, at) => [at, at]).filter(([at]) => at !== pick);
        expect(pairsOf(alignment)).toEqual(expected);
      }),
      { seed: 10604, numRuns: 500 },
    );
  });

  it('R5.2 inserting one card leaves every Line of the first Pattern matched', () => {
    // **Validates: Requirements 5.2**
    const inserted = fc.integer({ min: 1, max: 3 }).chain((endsPerPick) =>
      fc.record({
        bitLines: fc.array(bitLineArbitrary(endsPerPick), { maxLength: 8 }),
        card: bitLineArbitrary(endsPerPick),
        atChoice: fc.nat(),
      }),
    );
    fc.assert(
      fc.property(inserted, ({ bitLines, card, atChoice }) => {
        const at = atChoice % (bitLines.length + 1);
        const second = [...bitLines.slice(0, at), card, ...bitLines.slice(at)];
        const alignment = alignLines(bitsLines(bitLines), bitsLines(second));
        expect(alignment.length).toBe(bitLines.length);
        expect(alignment.map((pair) => pair.firstPick)).toEqual(bitLines.map((_, pick) => pick));
        for (const pair of alignment) {
          expect(second[pair.secondPick]).toBe(bitLines[pair.firstPick]);
        }
      }),
      { seed: 10605, numRuns: 500 },
    );
  });
});
