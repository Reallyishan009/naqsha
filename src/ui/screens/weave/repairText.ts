import type { CardGrid } from '../../../codec/index.ts';
import type { GapRepair, RepairFailure, Suggestion } from '../../../repair/index.ts';
import type { Translate } from '../../i18n/messages.ts';
/** The evidence of one suggestion as a sentence. Pick numbers are shown from 1, as everywhere else in the app. */
export function evidenceText(t: Translate, suggestion: Suggestion): string {
  const { evidence } = suggestion;
  switch (evidence.kind) {
    case 'repeat':
      return t('repair.evidence.repeat', {
        period: evidence.period,
        agreeing: evidence.agreeingPairs,
        compared: evidence.comparedPairs,
        picks: evidence.supportingPicks.map((pick) => pick + 1).join(', '),
      });
    case 'mirror':
      return t('repair.evidence.mirror', {
        agreeing: evidence.agreeingPairs,
        compared: evidence.comparedPairs,
        partner: evidence.partnerPick + 1,
      });
    case 'neighbours':
      return t('repair.evidence.neighbours', { before: evidence.beforePick + 1, after: evidence.afterPick + 1 });
    default: {
      const unreachable: never = evidence;
      return unreachable;
    }
  }
}
/** The suggestion "Accept all high-confidence" takes for each gap: the first one, only when it is high and the gap has no conflict. */
export function highConfidenceItems(gaps: ReadonlyArray<GapRepair>): { pick: number; card: CardGrid }[] {
  const items: { pick: number; card: CardGrid }[] = [];
  for (const gap of gaps) {
    const first = gap.suggestions[0];
    if (!gap.conflict && first !== undefined && first.confidence === 'high') items.push({ pick: gap.pick, card: first.card });
  }
  return items;
}
export function failureKey(failure: RepairFailure): string {
  return `repair.failure.${failure.reason}`;
}
/** How many hook positions of the card are punched, and how many there are. */
export function punchedCount(card: CardGrid): { punched: number; total: number } {
  let punched = 0;
  let total = 0;
  for (const hookRow of card) {
    for (const punchedHole of hookRow) {
      total++;
      if (punchedHole) punched++;
    }
  }
  return { punched, total };
}
