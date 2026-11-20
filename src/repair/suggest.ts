import { cardToBits } from '../codec-view/index.ts';
import { parseCardProfile } from '../codec/index.ts';
import { bestCentre, mirrorOutcome } from './mirror.ts';
import { neighboursOutcome } from './neighbours.ts';
import { bestPeriod, repeatOutcome } from './repeat.ts';
import type { KindOutcome } from './repeat.ts';
import { readSlots } from './slots.ts';
import type { Confidence, GapRepair, NoSuggestionReason, Suggestion, SuggestionKind, RepairResult } from './types.ts';
const CONFIDENCE_ORDER: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
const KIND_ORDER: Record<SuggestionKind, number> = { repeat: 0, mirror: 1, neighbours: 2 };
function bySuggestion(a: Suggestion, b: Suggestion): number {
  return CONFIDENCE_ORDER[a.confidence] - CONFIDENCE_ORDER[b.confidence] || KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
}
/**
 * Guesses what each lost card of a chain looked like. A lost card is a gap: nothing there, or something that is
 * not a card of the profile. For each gap, the three kinds (repeat, mirror, neighbours) each give a suggestion or
 * the reason they do not apply. Suggestions are guesses; this changes nothing and never throws.
 */
export function suggestRepairs(pattern: unknown, profile: unknown): RepairResult {
  try {
    const parsed = parseCardProfile(profile);
    if (!parsed.ok) return { ok: false, failure: { reason: 'invalid-profile', violations: parsed.violations } };
    if (!Array.isArray(pattern)) return { ok: false, failure: { reason: 'not-a-pattern' } };
    const cards: ReadonlyArray<unknown> = pattern;
    const slots = readSlots(parsed.value, cards);
    const readableCount = slots.filter((slot) => slot.key !== null).length;
    const period = bestPeriod(slots);
    const centre = bestCentre(slots);
    const gaps: GapRepair[] = [];
    for (const slot of slots) {
      if (slot.gapKind === null) continue;
      const outcomes: [SuggestionKind, KindOutcome][] = [
        ['repeat', repeatOutcome(slot.pick, slots, cards, period, readableCount)],
        ['mirror', mirrorOutcome(slot.pick, slots, cards, centre, readableCount)],
        ['neighbours', neighboursOutcome(slot.pick, slots, cards)],
      ];
      const suggestions: Suggestion[] = [];
      const notApplied: GapRepair['notApplied'] = [];
      for (const [kind, outcome] of outcomes) {
        if ('suggestion' in outcome) suggestions.push(outcome.suggestion);
        else notApplied.push({ kind, reason: outcome.reason });
      }
      suggestions.sort(bySuggestion);
      // The same comparison as everywhere else: two cards are equal when their Bit_Lines are.
      const proposed = new Set(suggestions.map((suggestion) => {
        const bits = cardToBits(parsed.value, suggestion.card);
        return bits.ok ? bits.bits : 'unreadable';
      }));
      const conflict = proposed.size > 1;
      const none: NoSuggestionReason | null =
        suggestions.length > 0 ? null : readableCount === 0 ? 'no-readable-cards' : slots.length < 3 ? 'too-short' : 'no-evidence';
      gaps.push({ pick: slot.pick, gapKind: slot.gapKind, suggestions, conflict, notApplied, none });
    }
    return { ok: true, gaps, pickCount: slots.length, readableCount };
  } catch {
    return { ok: false, failure: { reason: 'not-a-pattern' } };
  }
}
