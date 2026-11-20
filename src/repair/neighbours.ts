import type { CardGrid } from '../codec/index.ts';
import type { KindOutcome } from './repeat.ts';
import type { Slot } from './slots.ts';
/** The picks on both sides are the same card, so the lost one is probably that card too. Always low confidence. */
export function neighboursOutcome(gap: number, slots: ReadonlyArray<Slot>, cards: ReadonlyArray<unknown>): KindOutcome {
  if (gap === 0 || gap === slots.length - 1) return { reason: 'at-chain-edge' };
  const before = slots[gap - 1]!;
  const after = slots[gap + 1]!;
  if (before.key === null || after.key === null) return { reason: 'neighbour-unreadable' };
  if (before.key !== after.key) return { reason: 'neighbours-differ' };
  return {
    suggestion: {
      kind: 'neighbours',
      confidence: 'low',
      card: structuredClone(cards[before.pick]) as CardGrid,
      evidence: { kind: 'neighbours', beforePick: before.pick, afterPick: after.pick },
    },
  };
}
