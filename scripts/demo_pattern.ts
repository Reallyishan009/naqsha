/** Browser-safe demo pattern (no node imports), shared by make_fixtures.ts and the dev preview page. */
import type { CardGrid, CardProfile, Pattern } from '../src/codec/index.ts';

export const DEMO_PICK_COUNT = 3;

/**
 * A demo pattern: one card per pick, each a diagonal punched-hole run that
 * shifts by one hook column per pick. The top-right position is flipped on
 * every card so no card is symmetric.
 */
export function demoPattern(profile: CardProfile, pickCount = DEMO_PICK_COUNT): Pattern {
  const pattern: Pattern = [];
  for (let pickIndex = 0; pickIndex < pickCount; pickIndex++) {
    const card: CardGrid = [];
    for (let hookRowIndex = 0; hookRowIndex < profile.hookRows; hookRowIndex++) {
      const hookRow: boolean[] = [];
      for (let hookColumnIndex = 0; hookColumnIndex < profile.hookColumns; hookColumnIndex++) {
        hookRow.push((hookColumnIndex + 2 * hookRowIndex + pickIndex) % 3 === 0);
      }
      card.push(hookRow);
    }
    card[0]![profile.hookColumns - 1] = !card[0]![profile.hookColumns - 1];
    pattern.push(card);
  }
  return pattern;
}
