import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  decodeEnds,
  encodeCardGrid,
  endsPerPick,
  validateCardGrid,
  type CardGrid,
  type CardProfile,
} from '../../src/codec/index.ts';
import {
  GROUP_SEPARATOR,
  cardToBits,
  groupBits,
  patternToLines,
  type LineSet,
  type LinesResult,
} from '../../src/codec-view/index.ts';
import { cardGridArbitrary, profileArbitrary } from '../support/profiles.ts';

/** The seed and run count of the properties of this file, written here so a failure can be replayed. */
const BITS_SEED = 10701;
const BITS_RUNS = 300;

/**
 * A Card_Profile with a permuted endOrder together with one valid card for it, so every property
 * of this file takes its card geometry from the generated profile and never from a literal (R12.3).
 */
const profileAndCardArbitrary: fc.Arbitrary<{ profile: CardProfile; card: CardGrid }> = profileArbitrary.chain(
  (profile) => cardGridArbitrary(profile).map((card) => ({ profile, card })),
);

/**
 * A 2 x 2 card whose end order is permuted, so a Bit_Line written out by hand shows that the ends
 * list from encodeCardGrid is the only mapping and no row-major end index is computed (R1.3).
 * endOrder[hookRow][hookColumn]: hook position (0, 0) is end 2, (0, 1) is end 0, (1, 0) is end 3
 * and (1, 1) is end 1.
 */
function permutedTwoByTwoProfile(): CardProfile {
  const [base] = fc.sample(profileArbitrary, { seed: 1, numRuns: 1 });
  return {
    ...base!,
    hookRows: 2,
    hookColumns: 2,
    endOrder: [
      [2, 0],
      [3, 1],
    ],
  };
}

describe('cardToBits', () => {
  it('R1.1 R1.2 R1.3 a card on a permuted end order gives the Bit_Line written out by hand', () => {
    const profile = permutedTwoByTwoProfile();
    const card = [
      [true, false],
      [false, true],
    ];

    // Punched at hook positions (0, 0) and (1, 1), which this end order maps to ends 2 and 1.
    expect(cardToBits(profile, card)).toEqual({ ok: true, bits: '0110' });
  });

  it('R1.1 every unpunched card gives a Bit_Line of one character per end, all of them 0', () => {
    const profile = permutedTwoByTwoProfile();
    const card = [
      [false, false],
      [false, false],
    ];

    expect(cardToBits(profile, card)).toEqual({ ok: true, bits: '0000' });
  });

  it('R1.4 a card that fails validateCardGrid returns the violations and no Bit_Line', () => {
    const profile = permutedTwoByTwoProfile();
    const card = [[true, 'x'], [true]];

    const result = cardToBits(profile, card);

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.violations).toEqual(validateCardGrid(profile, card));
    expect(result.ok ? [] : result.violations.map((violation) => violation.kind)).toEqual([
      'not-a-boolean',
      'wrong-hook-column-count',
    ]);
    expect('bits' in result).toBe(false);
  });

  it('R1.7 the Card_Profile and the card come back unchanged, and equal calls give equal results', () => {
    const profile = permutedTwoByTwoProfile();
    const card = [
      [true, false],
      [false, true],
    ];
    const profileBefore = structuredClone(profile);
    const cardBefore = structuredClone(card);

    const first = cardToBits(profile, card);
    const second = cardToBits(profile, structuredClone(card));

    expect(profile).toEqual(profileBefore);
    expect(card).toEqual(cardBefore);
    expect(second).toEqual(first);
  });

  it('R1.1 a Bit_Line holds one character per end and agrees with encodeCardGrid', () => {
    // **Validates: Requirements R1.1, R1.2, R1.3**
    fc.assert(
      fc.property(profileAndCardArbitrary, ({ profile, card }) => {
        const result = cardToBits(profile, card);
        const ends = encodeCardGrid(profile, card);

        // A valid card gives a Bit_Line, never violations (R1.1).
        expect(result.ok).toBe(true);
        expect(ends.ok).toBe(true);
        if (!result.ok || !ends.ok) return;

        // One character per end, the count taken from the generated profile (R1.1).
        expect(typeof result.bits).toBe('string');
        expect(result.bits).toHaveLength(endsPerPick(profile));
        expect(ends.value).toHaveLength(endsPerPick(profile));

        // Every character is 0 or 1, and nothing else (R1.2).
        expect([...result.bits].filter((character) => character !== '0' && character !== '1')).toEqual([]);

        // Character e is 1 exactly when the ends list from encodeCardGrid lifts end e, which is the
        // only hook-position-to-end mapping; this profile's endOrder is permuted (R1.2, R1.3).
        expect([...result.bits].map((character) => character === '1')).toEqual(ends.value);
      }),
      { seed: BITS_SEED, numRuns: BITS_RUNS },
    );
  });

  it('R1.2 reading a Bit_Line back through decodeEnds returns the original card', () => {
    // **Validates: Requirements R1.2**
    fc.assert(
      fc.property(profileAndCardArbitrary, ({ profile, card }) => {
        const result = cardToBits(profile, card);

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        // Read the Bit_Line back as an ends list: character e is end e.
        const ends = [...result.bits].map((character) => character === '1');
        const decoded = decodeEnds(profile, ends);

        // The ends list the Bit_Line carries is one decodeEnds accepts, so the round trip never refuses.
        expect(decoded.ok).toBe(true);
        if (!decoded.ok) return;

        // The card comes back whole: same hook rows, same hook columns, same punched holes (R1.2).
        expect(decoded.value).toEqual(card);
      }),
      { seed: BITS_SEED, numRuns: BITS_RUNS },
    );
  });
});

/** The Line_Set of a successful read, so a refusal fails the test loudly instead of being skipped. */
function lineSetOf(result: LinesResult): LineSet {
  if (!result.ok) throw new Error(`patternToLines refused the Pattern: ${result.failure.message}`);
  return result.lineSet;
}

/** The header this profile gives every Line_Set built from it (R1.5). */
function headerOf(profile: CardProfile): Omit<LineSet, 'lines'> {
  return {
    profileName: profile.name,
    hookRows: profile.hookRows,
    hookColumns: profile.hookColumns,
    endsPerPick: endsPerPick(profile),
  };
}

describe('patternToLines', () => {
  it('R1.5 a Pattern of no picks gives the card geometry and no Lines', () => {
    const profile = permutedTwoByTwoProfile();

    expect(lineSetOf(patternToLines(profile, []))).toEqual({ ...headerOf(profile), lines: [] });
  });

  it('R1.5 a Pattern of one pick gives one Line carrying pick index 0 and that card’s Bit_Line', () => {
    const profile = permutedTwoByTwoProfile();
    const card = [
      [true, false],
      [false, true],
    ];

    // Punched at hook positions (0, 0) and (1, 1), which this end order maps to ends 2 and 1.
    expect(lineSetOf(patternToLines(profile, [card]))).toEqual({
      ...headerOf(profile),
      lines: [{ kind: 'bits', pick: 0, bits: '0110' }],
    });
  });

  it('R1.9 a damaged card at pick 1 keeps the Bit_Lines of picks 0 and 2', () => {
    const profile = permutedTwoByTwoProfile();
    const firstCard = [
      [true, false],
      [false, true],
    ];
    const damagedCard = [[true, 'x'], [true]];
    const lastCard = [
      [false, false],
      [true, false],
    ];

    const lineSet = lineSetOf(patternToLines(profile, [firstCard, damagedCard, lastCard]));

    // Hook position (1, 0) is end 3 under this end order, so the last card lifts end 3 alone.
    expect(lineSet.lines).toEqual([
      { kind: 'bits', pick: 0, bits: '0110' },
      { kind: 'damaged', pick: 1, violations: validateCardGrid(profile, damagedCard) },
      { kind: 'bits', pick: 2, bits: '0001' },
    ]);
    expect(lineSet.lines[1]).not.toHaveProperty('bits');
  });

  it('R1.6 the pick indices run ascending from 0 with no gap and no repeat', () => {
    const profile = permutedTwoByTwoProfile();
    const punchedCard = [
      [true, true],
      [true, true],
    ];
    const damagedCard = [[true, 'x'], [true]];
    const pattern = [punchedCard, damagedCard, punchedCard, damagedCard, punchedCard];

    const lineSet = lineSetOf(patternToLines(profile, pattern));

    expect(lineSet.lines).toHaveLength(pattern.length);
    expect(lineSet.lines.map((line) => line.pick)).toEqual(
      pattern.map((_card, pick) => pick),
    );
  });

  it('R1.10 a Pattern that is not an array fails not-a-pattern with no Line_Set and no Lines', () => {
    const profile = permutedTwoByTwoProfile();

    for (const notAPattern of [undefined, null, 0, 'picks', true, { length: 2 }]) {
      const result = patternToLines(profile, notAPattern);

      expect(result.ok).toBe(false);
      expect(result.ok ? undefined : result.failure.reason).toBe('not-a-pattern');
      expect(result.ok ? undefined : result.failure.location).toBe('pattern');
      expect(result.ok ? '' : result.failure.message).not.toBe('');
      expect('lineSet' in result).toBe(false);
      expect('lines' in result).toBe(false);
    }
  });

  it('R1.7 the Card_Profile and the Pattern come back unchanged, and equal calls give equal results', () => {
    const profile = permutedTwoByTwoProfile();
    const pattern = [
      [
        [true, false],
        [false, true],
      ],
      [
        [false, false],
        [true, false],
      ],
    ];
    const profileBefore = structuredClone(profile);
    const patternBefore = structuredClone(pattern);

    const first = patternToLines(profile, pattern);
    const second = patternToLines(profile, structuredClone(pattern));

    expect(profile).toEqual(profileBefore);
    expect(pattern).toEqual(patternBefore);
    expect(second).toEqual(first);
  });

  it('R1.5 every Line of a Line_Set carries the Bit_Line cardToBits gives for that card', () => {
    const profile = permutedTwoByTwoProfile();
    const pattern = [
      [
        [true, true],
        [false, false],
      ],
      [
        [false, true],
        [true, true],
      ],
    ];

    const lineSet = lineSetOf(patternToLines(profile, pattern));

    expect(lineSet.lines).toEqual(
      pattern.map((card, pick) => {
        const read = cardToBits(profile, card);
        return { kind: 'bits', pick, bits: read.ok ? read.bits : '' };
      }),
    );
    expect(lineSet.lines.every((line) => line.kind === 'bits' && line.bits.length === lineSet.endsPerPick)).toBe(true);
  });
});

describe('groupBits', () => {
  it('R2.2 one Group_Separator falls between each group of hookColumns ends and nowhere else', () => {
    const profile = permutedTwoByTwoProfile();
    const bits = '110100';

    const grouped = groupBits(bits, profile.hookColumns);

    expect(grouped).toBe('11|01|00');
    expect(GROUP_SEPARATOR).toBe('|');
    expect(grouped.startsWith(GROUP_SEPARATOR)).toBe(false);
    expect(grouped.endsWith(GROUP_SEPARATOR)).toBe(false);
    expect(grouped.split(GROUP_SEPARATOR).length - 1).toBe(bits.length / profile.hookColumns - 1);
    expect(grouped.replaceAll(GROUP_SEPARATOR, '')).toBe(bits);
  });

  it('R2.2 a Bit_Line of one group carries no Group_Separator', () => {
    expect(groupBits('1101', '1101'.length)).toBe('1101');
    expect(groupBits('', 2)).toBe('');
  });

  it('R2.2 a last group shorter than hookColumns still carries no separator after it', () => {
    expect(groupBits('11010', 2)).toBe('11|01|0');
  });
});
