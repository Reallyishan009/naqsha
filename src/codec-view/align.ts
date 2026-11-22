import type { Alignment, Line } from './types.ts';

/** One matched pair of the Alignment: a pick index on each side. */
type MatchedPicks = { firstPick: number; secondPick: number };

/**
 * The comparison key of a Line: its Bit_Line for a bits Line, and 'x' followed by the violation
 * kinds and locations for a damaged Line, so two identically damaged Lines match (R5.2).
 *
 * A Bit_Line holds only '0' and '1', so a damaged key can never equal a bits key.
 */
export function lineKey(line: Line): string {
  if (line.kind === 'bits') {
    return line.bits;
  }
  const faults = line.violations.map((violation) => `${violation.kind}@${violation.location}`);
  return `x${faults.join(',')}`;
}

/**
 * The total order on sequences of Lines that step 1 of the tie-breaking rule canonicalises by: the
 * number of Lines first, then key by key as strings, the first difference deciding. It reads only
 * the two sequences of keys, never the order they were passed in (R5.2).
 */
function compareKeys(first: ReadonlyArray<string>, second: ReadonlyArray<string>): number {
  if (first.length !== second.length) {
    return first.length < second.length ? -1 : 1;
  }
  for (let at = 0; at < first.length; at += 1) {
    if (first[at] !== second[at]) {
      return first[at] < second[at] ? -1 : 1;
    }
  }
  return 0;
}

/**
 * The keys as integer ids from one shared table, so the dynamic program compares two integers
 * instead of two Ends_Per_Pick-character strings.
 */
function internKeys(keys: ReadonlyArray<string>, ids: Map<string, number>): Int32Array {
  const interned = new Int32Array(keys.length);
  for (let at = 0; at < keys.length; at += 1) {
    const key = keys[at];
    const known = ids.get(key);
    if (known === undefined) {
      const fresh = ids.size;
      ids.set(key, fresh);
      interned[at] = fresh;
    } else {
      interned[at] = known;
    }
  }
  return interned;
}

/**
 * Step 2 of the tie-breaking rule: the two-key dynamic program over the canonical pair. Among the
 * common subsequences of the greatest length it takes the one of least total index displacement
 * `Σ |i − j|`, and settles any residual tie by a fixed backtrack order — the diagonal first, then
 * the step towards the first side (R5.2).
 *
 * `len` fits a Uint16Array and `disp` a Uint32Array because `diffPatterns` refuses a side longer
 * than its Diff_Pick_Limit of 2,000 picks before it ever calls here: at most 2,000 matched pairs,
 * each displaced by at most 2,000.
 */
function alignCanonical(firstIds: Int32Array, secondIds: Int32Array): MatchedPicks[] {
  const firstPicks = firstIds.length;
  const secondPicks = secondIds.length;
  const width = secondPicks + 1;
  /** The length of the best common subsequence of the two pick prefixes. */
  const len = new Uint16Array((firstPicks + 1) * width);
  /** The total index displacement of that subsequence. */
  const disp = new Uint32Array((firstPicks + 1) * width);

  for (let i = 1; i <= firstPicks; i += 1) {
    const base = i * width;
    const baseAbove = base - width;
    for (let j = 1; j <= secondPicks; j += 1) {
      const above = baseAbove + j;
      const left = base + j - 1;
      // The better of the two neighbours: greater length, then smaller displacement, then the one
      // that drops a pick of the first side.
      let bestLength = len[above];
      let bestDisplacement = disp[above];
      if (len[left] > bestLength || (len[left] === bestLength && disp[left] < bestDisplacement)) {
        bestLength = len[left];
        bestDisplacement = disp[left];
      }
      if (firstIds[i - 1] === secondIds[j - 1]) {
        const diagonal = baseAbove + j - 1;
        const matchedLength = len[diagonal] + 1;
        const matchedDisplacement = disp[diagonal] + (i > j ? i - j : j - i);
        if (
          matchedLength > bestLength ||
          (matchedLength === bestLength && matchedDisplacement < bestDisplacement)
        ) {
          bestLength = matchedLength;
          bestDisplacement = matchedDisplacement;
        }
      }
      len[base + j] = bestLength;
      disp[base + j] = bestDisplacement;
    }
  }

  const descending: MatchedPicks[] = [];
  let i = firstPicks;
  let j = secondPicks;
  while (i > 0 && j > 0) {
    const here = i * width + j;
    const above = here - width;
    const left = here - 1;
    if (firstIds[i - 1] === secondIds[j - 1]) {
      const diagonal = above - 1;
      const matchedDisplacement = disp[diagonal] + (i > j ? i - j : j - i);
      if (len[here] === len[diagonal] + 1 && disp[here] === matchedDisplacement) {
        descending.push({ firstPick: i - 1, secondPick: j - 1 });
        i -= 1;
        j -= 1;
        continue;
      }
    }
    if (len[above] > len[left] || (len[above] === len[left] && disp[above] <= disp[left])) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  descending.reverse();
  return descending;
}

/**
 * The Alignment of two Line sequences: a common subsequence of the greatest length, chosen by the
 * tie-breaking rule that reads only the two sequences — canonicalise the pair, take the least
 * total index displacement, mirror back (R5.2, R5.9, R6.2).
 *
 * The matched pick indices are positions in the two given sequences, which for a Line_Set from
 * `patternToLines` are the Lines' own pick indices (R1.6). They ascend on both sides.
 */
export function alignLines(first: ReadonlyArray<Line>, second: ReadonlyArray<Line>): Alignment {
  const firstKeys = first.map(lineKey);
  const secondKeys = second.map(lineKey);

  // Step 1: canonicalise, so both alignLines(a, b) and alignLines(b, a) run the same computation
  // on the same ordered pair. The caller's pair is kept when the two sequences compare equal,
  // which means their keys are equal.
  const swapped = compareKeys(firstKeys, secondKeys) > 0;
  const ids = new Map<string, number>();
  const canonicalFirstIds = internKeys(swapped ? secondKeys : firstKeys, ids);
  const canonicalSecondIds = internKeys(swapped ? firstKeys : secondKeys, ids);

  // Step 2: the deterministic two-key dynamic program on the canonical pair.
  const matched = alignCanonical(canonicalFirstIds, canonicalSecondIds);

  // Step 3: mirror the matched pairs back when the canonical pair is not the caller's pair.
  if (!swapped) {
    return matched;
  }
  return matched.map((pair) => ({ firstPick: pair.secondPick, secondPick: pair.firstPick }));
}
