import type { CardGrid } from '../codec/index.ts';
import { HIGH_MIN_COMPARISONS, bestCandidate, isExact } from './candidates.ts';
import type { Candidate } from './candidates.ts';
import type { Slot } from './slots.ts';
import type { Confidence, NotAppliedReason, Suggestion } from './types.ts';
/** Every period from 1 to half the chain, with the readable pairs that far apart and how many agree. */
function periodCandidates(slots: ReadonlyArray<Slot>): Candidate[] {
  const candidates: Candidate[] = [];
  for (let period = 1; period <= Math.floor(slots.length / 2); period++) {
    let comparedPairs = 0;
    let agreeingPairs = 0;
    for (let pick = 0; pick + period < slots.length; pick++) {
      const first = slots[pick]!.key;
      const second = slots[pick + period]!.key;
      if (first === null || second === null) continue;
      comparedPairs++;
      if (first === second) agreeingPairs++;
    }
    candidates.push({ id: period, comparedPairs, agreeingPairs });
  }
  return candidates;
}
/** The period the whole chain shows, or null: exact first, then the most agreeing pairs, then the shortest. */
export function bestPeriod(slots: ReadonlyArray<Slot>): Candidate | null {
  return bestCandidate(periodCandidates(slots), (a, b) => a.id - b.id);
}
export type KindOutcome = { suggestion: Suggestion } | { reason: NotAppliedReason };
/** The card a gap takes from the picks a whole number of periods away. `cards` holds the readable card of each pick. */
export function repeatOutcome(
  gap: number,
  slots: ReadonlyArray<Slot>,
  cards: ReadonlyArray<unknown>,
  period: Candidate | null,
  readableCount: number,
): KindOutcome {
  if (period === null) return { reason: readableCount <= 3 ? 'too-few-readable-cards' : 'no-period' };
  const supporters: Slot[] = [];
  for (let pick = gap % period.id; pick < slots.length; pick += period.id) {
    if (pick !== gap && slots[pick]!.key !== null) supporters.push(slots[pick]!);
  }
  if (supporters.length === 0) return { reason: 'no-supporter' };
  const counts = new Map<string, number>();
  for (const supporter of supporters) counts.set(supporter.key!, (counts.get(supporter.key!) ?? 0) + 1);
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 1 && ranked[0]![1] === ranked[1]![1]) return { reason: 'supporters-tie' };
  const [winner] = ranked[0]!;
  const agreeing = supporters.filter((supporter) => supporter.key === winner);
  const unanimous = ranked.length === 1;
  const confidence: Confidence =
    unanimous && isExact(period) && period.comparedPairs >= HIGH_MIN_COMPARISONS && agreeing.length >= 2
      ? 'high'
      : unanimous
        ? 'medium'
        : 'low';
  return {
    suggestion: {
      kind: 'repeat',
      confidence,
      card: structuredClone(cards[agreeing[0]!.pick]) as CardGrid,
      evidence: {
        kind: 'repeat',
        period: period.id,
        supportingPicks: agreeing.map((supporter) => supporter.pick),
        comparedPairs: period.comparedPairs,
        agreeingPairs: period.agreeingPairs,
      },
    },
  };
}
