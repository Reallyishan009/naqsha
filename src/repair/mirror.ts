import type { CardGrid } from '../codec/index.ts';
import { HIGH_MIN_COMPARISONS, bestCandidate, isExact } from './candidates.ts';
import type { Candidate } from './candidates.ts';
import type { KindOutcome } from './repeat.ts';
import type { Slot } from './slots.ts';
/** Every centre sum i + j, with the readable pairs it mirrors and how many agree. */
function centreCandidates(slots: ReadonlyArray<Slot>): Candidate[] {
  const candidates: Candidate[] = [];
  const last = slots.length - 1;
  for (let sum = 1; sum <= 2 * last - 1; sum++) {
    let comparedPairs = 0;
    let agreeingPairs = 0;
    for (let first = Math.max(0, sum - last); first < sum - first; first++) {
      const a = slots[first]!.key;
      const b = slots[sum - first]!.key;
      if (a === null || b === null) continue;
      comparedPairs++;
      if (a === b) agreeingPairs++;
    }
    candidates.push({ id: sum, comparedPairs, agreeingPairs });
  }
  return candidates;
}
/** The mirror the chain shows, or null: exact first, then the most agreeing pairs, then the centre nearest the middle. */
export function bestCentre(slots: ReadonlyArray<Slot>): Candidate | null {
  const middle = slots.length - 1;
  return bestCandidate(centreCandidates(slots), (a, b) => Math.abs(a.id - middle) - Math.abs(b.id - middle));
}
/** The card a gap takes from its mirror pick. */
export function mirrorOutcome(
  gap: number,
  slots: ReadonlyArray<Slot>,
  cards: ReadonlyArray<unknown>,
  centre: Candidate | null,
  readableCount: number,
): KindOutcome {
  if (centre === null) return { reason: readableCount <= 3 ? 'too-few-readable-cards' : 'no-mirror' };
  const partner = centre.id - gap;
  if (partner < 0 || partner >= slots.length) return { reason: 'partner-out-of-chain' };
  if (partner === gap) return { reason: 'centre-pick' };
  if (slots[partner]!.key === null) return { reason: 'partner-unreadable' };
  return {
    suggestion: {
      kind: 'mirror',
      confidence: isExact(centre) && centre.comparedPairs >= HIGH_MIN_COMPARISONS ? 'high' : 'medium',
      card: structuredClone(cards[partner]) as CardGrid,
      evidence: {
        kind: 'mirror',
        centreSum: centre.id,
        partnerPick: partner,
        comparedPairs: centre.comparedPairs,
        agreeingPairs: centre.agreeingPairs,
      },
    },
  };
}
