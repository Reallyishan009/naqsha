/**
 * The cost of the alignment at the Diff_Pick_Limit (task 1.21).
 *
 * `diffPatterns` runs a quadratic dynamic program over the two sides, so the largest comparison it
 * ever accepts is `DIFF_PICK_LIMIT` picks against `DIFF_PICK_LIMIT` picks (R6.11, R6.12). This file
 * measures that one comparison and prints the time, so a regression in `alignLines` — a dropped
 * key interning, a string comparison in the inner loop, a third key — is visible in the test
 * output even when it stays under the ceiling.
 *
 * The size of the comparison comes from the exported `DIFF_PICK_LIMIT` and the card geometry from
 * a generated Card_Profile, so no pick limit and no card dimension is written here as a literal
 * (R12.3).
 *
 * The ceiling is a regression guard and not a measurement: the dynamic program takes 20 to 30 ms
 * on the development machine, so `DIFF_CEILING_MS` is set far above that. It is there to fail on a
 * change of order — a cubic alignment, or per-cell work on Ends_Per_Pick-character strings — and
 * never on a loaded machine or a cold JIT. A smaller regression shows up in the printed number.
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardGrid, CardProfile, Pattern } from '../../src/codec/index.ts';
import { DIFF_PICK_LIMIT, diffPatterns, patternToLines } from '../../src/codec-view/index.ts';
import type { LineSet } from '../../src/codec-view/index.ts';
import { cardGridArbitrary, profileArbitrary } from '../support/profiles.ts';

/** The seed the Card_Profile and the cards of this file are drawn with, so every run measures the same work. */
const BENCHMARK_SEED = 20_931;

/**
 * How long the largest comparison the module accepts may take. Generous on purpose: see the file
 * comment. The measured time is printed either way.
 */
const DIFF_CEILING_MS = 1000;

/**
 * The smaller sizes measured before the full one, as a fraction of the Diff_Pick_Limit. They warm
 * the JIT and show the growth of the dynamic program, so the full-size number can be read against
 * them. Nothing is asserted about them.
 */
const SMALLER_FRACTIONS = [8, 4, 2];

/** One card every this many picks is punched differently on the second side, a believable edit. */
const PICKS_PER_EDIT = 100;

/**
 * How many Card_Profiles are drawn to pick the one this file measures on. The widest of them is
 * taken, so the Bit_Lines are as long as `profileArbitrary` makes them and a regression that
 * compares two Bit_Lines per cell of the dynamic program, instead of two interned keys, shows in
 * the measured time. It is a draw count and not a card dimension (R12.3).
 */
const PROFILE_DRAWS = 20;

/**
 * The Card_Profile of this file: the widest of `PROFILE_DRAWS` generated profiles, so the card
 * geometry is taken from the arbitrary and not written here (R12.3).
 */
function benchmarkProfile(): CardProfile {
  const drawn = fc.sample(profileArbitrary, { seed: BENCHMARK_SEED, numRuns: PROFILE_DRAWS });
  const widest = drawn.reduce<CardProfile | undefined>(
    (best, profile) =>
      best === undefined || profile.hookRows * profile.hookColumns > best.hookRows * best.hookColumns
        ? profile
        : best,
    undefined,
  );
  if (widest === undefined) throw new Error('profileArbitrary produced no Card_Profile');
  return widest;
}

/** A Pattern of `picks` generated cards for the profile, the same cards on every run. */
function benchmarkPattern(profile: CardProfile, picks: number): Pattern {
  return fc.sample(cardGridArbitrary(profile), { seed: BENCHMARK_SEED, numRuns: picks });
}

/** The same card with the punched hole at one hook position flipped, built fresh. */
function flipOneHole(card: CardGrid, at: number): CardGrid {
  const hookRow = at % card.length;
  const hookColumn = at % card[hookRow]!.length;
  return card.map((row, row_at) =>
    row_at === hookRow
      ? row.map((punchedHole, column_at) => (column_at === hookColumn ? !punchedHole : punchedHole))
      : row,
  );
}

/**
 * The second side of the comparison: the same Pattern with one card deleted in the middle, one
 * fresh card appended, and one punched hole flipped every `PICKS_PER_EDIT` picks. So the alignment
 * has to match a long common subsequence, carry a deletion and an insertion, and leave the edited
 * picks unmatched — the work a real comparison of two versions of one naksha does. Both sides hold
 * the same number of picks, so the comparison is the largest the module accepts.
 */
function editedPattern(profile: CardProfile, pattern: Pattern): Pattern {
  const deletedAt = Math.floor(pattern.length / 2);
  const [appended] = fc.sample(cardGridArbitrary(profile), { seed: BENCHMARK_SEED + 1, numRuns: 1 });
  if (appended === undefined) throw new Error('cardGridArbitrary produced no card');
  const kept = pattern.filter((_card, pick) => pick !== deletedAt);
  const edited = kept.map((card, pick) => (pick % PICKS_PER_EDIT === 0 ? flipOneHole(card, pick) : card));
  return [...edited, appended];
}

/** The Line_Set of a Pattern, so a refusal fails the test loudly instead of being measured. */
function linesOf(profile: CardProfile, pattern: Pattern): LineSet {
  const lines = patternToLines(profile, pattern);
  if (!lines.ok) throw new Error(`patternToLines refused the Pattern: ${lines.failure.message}`);
  return lines.lineSet;
}

/** The time one comparison of the two Line_Sets takes, in milliseconds. The Diff must not be refused. */
function timeDiff(first: LineSet, second: LineSet): number {
  const start = performance.now();
  const diff = diffPatterns(first, second);
  const elapsed = performance.now() - start;
  expect(diff.ok).toBe(true);
  return elapsed;
}

describe('benchmark', () => {
  it(
    'R6.12 a diff of Diff_Pick_Limit picks against Diff_Pick_Limit picks finishes inside the ceiling, and its measured time is printed',
    () => {
      const profile = benchmarkProfile();

      // The smaller sizes first: they warm the JIT and show how the cost grows with the pick count.
      const smaller = SMALLER_FRACTIONS.map((fraction) => {
        const picks = Math.floor(DIFF_PICK_LIMIT / fraction);
        const pattern = benchmarkPattern(profile, picks);
        const first = linesOf(profile, pattern);
        const second = linesOf(profile, editedPattern(profile, pattern));
        return { picks, elapsed: timeDiff(first, second) };
      });

      const pattern = benchmarkPattern(profile, DIFF_PICK_LIMIT);
      const first = linesOf(profile, pattern);
      const second = linesOf(profile, editedPattern(profile, pattern));
      expect(first.lines).toHaveLength(DIFF_PICK_LIMIT);
      expect(second.lines).toHaveLength(DIFF_PICK_LIMIT);

      const elapsed = timeDiff(first, second);

      // Written straight to stdout rather than through console.log, so the measured time is in the
      // output of `npm run test:run` whether or not the run has a terminal attached.
      process.stdout.write(
        `benchmark: codec-view diffPatterns, ${profile.hookRows} x ${profile.hookColumns} hook positions ` +
          `(${first.endsPerPick} ends per pick), ${DIFF_PICK_LIMIT} x ${DIFF_PICK_LIMIT} picks: ` +
          `${elapsed.toFixed(2)} ms, ceiling ${DIFF_CEILING_MS} ms; ` +
          `smaller sizes ${smaller
            .map((measured) => `${measured.picks} x ${measured.picks}: ${measured.elapsed.toFixed(2)} ms`)
            .join(', ')}\n`,
      );

      expect(elapsed).toBeLessThan(DIFF_CEILING_MS);
    },
    300_000,
  );
});
