/**
 * The cost of the alignment at the Diff_Pick_Limit (task 1.21).
 *
 * `diffPatterns` runs a quadratic dynamic program over the two sides, so the largest comparison it
 * ever accepts is `DIFF_PICK_LIMIT` picks against `DIFF_PICK_LIMIT` picks (R6.11, R6.12). This file
 * measures that one comparison and prints the time, so a regression in `alignLines` — a dropped
 * key interning, a string comparison in the inner loop, a third key — is visible in the test
 * output even when it stays under the bound.
 *
 * The size of the comparison comes from the exported `DIFF_PICK_LIMIT` and the card geometry from
 * a generated Card_Profile, so no pick limit and no card dimension is written here as a literal
 * (R12.3).
 *
 * The test decides by a ratio, not by a millisecond ceiling (R19.2). The time of the alignment is
 * divided by the time of a baseline measured in the same run on the same machine: a plain integer
 * longest-common-subsequence table over the same two interned key arrays, which calls neither
 * `diffPatterns` nor `alignLines`. Each is timed `TIMED_REPETITIONS` times, alternating, and the
 * least time of each is used.
 * See `DIFF_RATIO_BOUND` for the decision and the numbers.
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardGrid, CardProfile, Pattern } from '../../src/codec/index.ts';
import { DIFF_PICK_LIMIT, diffPatterns, lineKey, patternToLines } from '../../src/codec-view/index.ts';
import type { LineSet } from '../../src/codec-view/index.ts';
import { cardGridArbitrary, profileArbitrary } from '../support/profiles.ts';

/** The seed the Card_Profile and the cards of this file are drawn with, so every run measures the same work. */
const BENCHMARK_SEED = 20_931;

/**
 * The largest ratio of the alignment time to the baseline time that the largest comparison may have.
 *
 * Decision (R19.2): a ratio to a baseline measured in the same run, not a millisecond ceiling. On
 * the development machine the alignment time of a full suite run is bimodal: about 30 to 60 ms in
 * most runs, and about 570 ms in roughly one run in three. The slow time is the first alignment of
 * this size in the worker (later ones are fast again, so it is the JIT and not the load), and it
 * is a CPU time, not a wait. A ceiling above 570 ms could not fail on a 2.0 times slowdown of the
 * fast mode, and a ceiling below it fails on the slow first alignment.
 *
 * What makes the ratio steady, each found by measuring full suite runs:
 * - The alignment and the baseline are each timed `TIMED_REPETITIONS` times, alternating, and the
 *   least of each is used, so the slow first alignment never counts.
 * - The time is the CPU time of the process, not the wall clock, so another test file taking the
 *   core does not count.
 * - The baseline fills the same two tables as the alignment (a `Uint16Array` of lengths and a
 *   `Uint32Array` of displacements, (picks + 1) x (picks + 1) cells) with the same recurrence, so
 *   memory traffic from the other test files slows both alike. A plain integer table in two rows
 *   gave a ratio from 3.6 to 6.0, and one in a full `Int32Array` from 1.8 to 3.5, over five and
 *   eight full suite runs; this baseline gave 1.07 to 1.40 over eleven. It calls neither
 *   `diffPatterns` nor `alignLines`.
 *
 * Measured, three consecutive full suite runs: ratio 1.25, 1.29, 1.40 (alignment 28.99, 31.62,
 * 30.05 ms; baseline 23.27, 24.50, 21.42 ms). The bound is 1.5 times the highest, 2.10, rounded
 * up to one decimal: 2.2. Today's ratio in a full suite run is 1.25 to 1.40, so 2.0 times it is
 * 2.5 to 2.8 and the bound is under it: an alignment that does its work twice fails. The test
 * run alone has a ratio of 0.93 to 0.96, so the bound is meant for the full suite.
 */
const DIFF_RATIO_BOUND = 2.2;

/**
 * How many times the baseline and the alignment of the full comparison are each timed. The least
 * of the times is used, see the test body.
 */
const TIMED_REPETITIONS = 9;

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

/** The CPU time this process has used so far, in milliseconds. */
function cpuNow(): number {
  const used = process.cpuUsage();
  return (used.user + used.system) / 1000;
}

/** The CPU time one comparison of the two Line_Sets takes, in milliseconds. The Diff must not be refused. */
function timeDiff(first: LineSet, second: LineSet): number {
  const start = cpuNow();
  const diff = diffPatterns(first, second);
  const elapsed = cpuNow() - start;
  expect(diff.ok).toBe(true);
  return elapsed;
}

/** The Line keys of both sides as integers from one shared table, so the baseline compares integers like the alignment does. */
function internedKeys(first: LineSet, second: LineSet): [Int32Array, Int32Array] {
  const ids = new Map<string, number>();
  const intern = (lineSet: LineSet): Int32Array =>
    Int32Array.from(lineSet.lines, (line) => {
      const key = lineKey(line);
      const known = ids.get(key);
      if (known !== undefined) return known;
      ids.set(key, ids.size);
      return ids.size - 1;
    });
  return [intern(first), intern(second)];
}

/**
 * The reference workload: the length of the longest common subsequence of two integer sequences,
 * kept in a `Uint16Array` and a `Uint32Array` of (first + 1) x (second + 1) cells. It calls neither
 * `diffPatterns` nor `alignLines`. Returns the CPU time in milliseconds and the length, so the work
 * cannot be optimised away.
 */
function timeBaseline(firstIds: Int32Array, secondIds: Int32Array): { elapsed: number; length: number } {
  const start = cpuNow();
  const width = secondIds.length + 1;
  const length = new Uint16Array((firstIds.length + 1) * width);
  const displacement = new Uint32Array((firstIds.length + 1) * width);
  for (let i = 1; i <= firstIds.length; i += 1) {
    const id = firstIds[i - 1];
    const base = i * width;
    for (let j = 1; j <= secondIds.length; j += 1) {
      const here = base + j;
      const above = here - width;
      let bestLength = length[above];
      let bestDisplacement = displacement[above];
      if (length[here - 1] > bestLength) {
        bestLength = length[here - 1];
        bestDisplacement = displacement[here - 1];
      }
      if (id === secondIds[j - 1] && length[above - 1] + 1 > bestLength) {
        bestLength = length[above - 1] + 1;
        bestDisplacement = displacement[above - 1] + (i > j ? i - j : j - i);
      }
      length[here] = bestLength;
      displacement[here] = bestDisplacement;
    }
  }
  return { elapsed: cpuNow() - start, length: length[length.length - 1] };
}

describe('benchmark', () => {
  it(
    'R6.12 a diff of Diff_Pick_Limit picks against Diff_Pick_Limit picks stays inside the ratio bound to a same-run baseline, and its time, baseline and ratio are printed',
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

      // Baseline and alignment alternate, so a burst of load from other test files falls on both
      // and not on one. The least time of each is kept: the cost of the code is the time it takes
      // when nothing else is in the way, and every slower repetition is the machine's.
      const [firstIds, secondIds] = internedKeys(first, second);
      const baselines: number[] = [];
      const alignments: number[] = [];
      let baselineLength: number | undefined;
      for (let repetition = 0; repetition < TIMED_REPETITIONS; repetition += 1) {
        const measuredBaseline = timeBaseline(firstIds, secondIds);
        baselineLength ??= measuredBaseline.length;
        expect(measuredBaseline.length).toBe(baselineLength);
        baselines.push(measuredBaseline.elapsed);
        alignments.push(timeDiff(first, second));
      }
      const elapsed = Math.min(...alignments);
      const baseline = Math.min(...baselines);
      const ratio = elapsed / baseline;
      const listed = (times: ReadonlyArray<number>): string => times.map((time) => time.toFixed(2)).join(' / ');

      // Written straight to stdout rather than through console.log, so the measured time is in the
      // output of `npm run test:run` whether or not the run has a terminal attached.
      process.stdout.write(
        `benchmark: codec-view diffPatterns, ${profile.hookRows} x ${profile.hookColumns} hook positions ` +
          `(${first.endsPerPick} ends per pick), ${DIFF_PICK_LIMIT} x ${DIFF_PICK_LIMIT} picks: ` +
          `${elapsed.toFixed(2)} ms (best of ${listed(alignments)}), baseline ${baseline.toFixed(2)} ms ` +
          `(best of ${listed(baselines)}), ratio ${ratio.toFixed(2)}, bound ${DIFF_RATIO_BOUND}; ` +
          `smaller sizes ${smaller
            .map((measured) => `${measured.picks} x ${measured.picks}: ${measured.elapsed.toFixed(2)} ms`)
            .join(', ')}\n`,
      );

      expect(
        ratio,
        `alignment ${elapsed.toFixed(2)} ms, baseline ${baseline.toFixed(2)} ms, ratio ${ratio.toFixed(2)}, bound ${DIFF_RATIO_BOUND}`,
      ).toBeLessThan(DIFF_RATIO_BOUND);
    },
    300_000,
  );
});
