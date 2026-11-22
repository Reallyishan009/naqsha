/** Fewest readable pairs a period or a mirror needs before it counts as evidence. */
export const MIN_COMPARISONS = 3;
/** Share of readable pairs that must agree for a period or a mirror to count. */
export const AGREEMENT_FLOOR = 0.8;
/** Readable pairs needed for high confidence. */
export const HIGH_MIN_COMPARISONS = 4;
/** A period or a mirror centre, with how many readable pairs it compared and how many agreed. */
export type Candidate = { id: number; comparedPairs: number; agreeingPairs: number };
export function qualifies(candidate: Candidate): boolean {
  return (
    candidate.comparedPairs >= MIN_COMPARISONS && candidate.agreeingPairs / candidate.comparedPairs >= AGREEMENT_FLOOR
  );
}
export function isExact(candidate: Candidate): boolean {
  return candidate.agreeingPairs === candidate.comparedPairs;
}
/**
 * The best qualifying candidate: all pairs agree first, then the most agreeing pairs, then `tieBreak`
 * (negative when the first is better). Null when none qualifies.
 */
export function bestCandidate(
  candidates: ReadonlyArray<Candidate>,
  tieBreak: (a: Candidate, b: Candidate) => number,
): Candidate | null {
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (!qualifies(candidate)) continue;
    if (best === null) {
      best = candidate;
      continue;
    }
    const exactDifference = Number(isExact(candidate)) - Number(isExact(best));
    const order =
      exactDifference !== 0
        ? -exactDifference
        : candidate.agreeingPairs !== best.agreeingPairs
          ? best.agreeingPairs - candidate.agreeingPairs
          : tieBreak(candidate, best);
    if (order < 0) best = candidate;
  }
  return best;
}
