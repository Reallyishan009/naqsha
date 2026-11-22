import { cardToBits } from '../codec-view/index.ts';
import type { CardProfile } from '../codec/index.ts';
export type Slot = {
  pick: number;
  /** The Bit_Line of a readable card, compared by equality; null for a gap. */
  key: string | null;
  gapKind: 'missing' | 'damaged' | null;
};
/** Classifies every pick as readable or a gap, as the simulator does: nothing there is missing, an unreadable card is damaged. */
export function readSlots(profile: CardProfile, pattern: ReadonlyArray<unknown>): Slot[] {
  const slots: Slot[] = [];
  for (let pick = 0; pick < pattern.length; pick++) {
    const card = pattern[pick];
    if (card === null || card === undefined) {
      slots.push({ pick, key: null, gapKind: 'missing' });
      continue;
    }
    const bits = cardToBits(profile, card);
    slots.push(bits.ok ? { pick, key: bits.bits, gapKind: null } : { pick, key: null, gapKind: 'damaged' });
  }
  return slots;
}
