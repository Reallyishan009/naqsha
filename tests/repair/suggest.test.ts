import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardGrid, CardProfile, Pattern } from '../../src/codec/index.ts';
import { suggestRepairs } from '../../src/repair/index.ts';
import type { GapRepair, SuggestionKind } from '../../src/repair/index.ts';
import { cardGridArbitrary, demoProfile, profileArbitrary } from '../support/profiles.ts';
const profile = demoProfile();
/** A valid card that differs from every other `number` below the number of hook positions: one punched hole. */
function card(number: number, forProfile: CardProfile = profile): CardGrid {
  const hookColumns = forProfile.hookColumns;
  const position = number % (forProfile.hookRows * hookColumns);
  return Array.from({ length: forProfile.hookRows }, (_, hookRow) =>
    Array.from({ length: hookColumns }, (_, hookColumn) => hookRow * hookColumns + hookColumn === position),
  );
}
function chain(numbers: ReadonlyArray<number | null>): unknown[] {
  return numbers.map((number) => (number === null ? null : card(number)));
}
function onlyGap(result: ReturnType<typeof suggestRepairs>): GapRepair {
  if (!result.ok) throw new Error(`suggestRepairs failed: ${result.failure.reason}`);
  expect(result.gaps).toHaveLength(1);
  return result.gaps[0]!;
}
function kindsOf(gap: GapRepair): SuggestionKind[] {
  return [...gap.suggestions.map((s) => s.kind), ...gap.notApplied.map((n) => n.kind)].sort();
}
describe('repeat', () => {
  const block = [0, 1, 2, 3];
  const repeated = [...block, ...block, ...block];
  it('R2.1 a design that repeats every 4 picks gives the card from a whole number of periods away, with its evidence', () => {
    const gap = onlyGap(suggestRepairs(chain(repeated.map((n, i) => (i === 5 ? null : n))), profile));
    const repeat = gap.suggestions.find((s) => s.kind === 'repeat')!;
    expect(repeat.card).toEqual(card(1));
    expect(repeat.confidence).toBe('high');
    expect(repeat.evidence).toMatchObject({ kind: 'repeat', period: 4, supportingPicks: [1, 9], agreeingPairs: repeat.evidence.kind === 'repeat' ? repeat.evidence.comparedPairs : -1 });
  });
  it('R2.1 a lost card at the first or last pick is repaired from the repeat, and neighbours say it is at the chain edge', () => {
    for (const lost of [0, 11]) {
      const gap = onlyGap(suggestRepairs(chain(repeated.map((n, i) => (i === lost ? null : n))), profile));
      expect(gap.suggestions[0]?.kind).toBe('repeat');
      expect(gap.suggestions[0]?.card).toEqual(card(repeated[lost]!));
      expect(gap.notApplied).toContainEqual({ kind: 'neighbours', reason: 'at-chain-edge' });
    }
  });
  it('R2.1 a repeat that holds for most pairs but not all is medium or low, never high', () => {
    const noisy = chain(repeated.map((n, i) => (i === 5 ? null : i === 10 ? 9 : n)));
    const gap = onlyGap(suggestRepairs(noisy, profile));
    const repeat = gap.suggestions.find((s) => s.kind === 'repeat');
    expect(repeat?.confidence).not.toBe('high');
  });
  it('R2.1 supporters that disagree equally give no repeat suggestion and say why', () => {
    // Period 2 holds for every readable pair, but the cards two picks and four picks from the lost pick split 2 to 2.
    const pattern = chain([0, 1, 0, 1, null, 1, 5, 1, 5, 1]);
    const gap = onlyGap(suggestRepairs(pattern, profile));
    expect(gap.notApplied.find((n) => n.kind === 'repeat')?.reason).toBe('supporters-tie');
    expect(gap.suggestions.find((s) => s.kind === 'repeat')).toBeUndefined();
  });
});
describe('mirror', () => {
  const half = [0, 1, 2, 3, 4, 5];
  const palindrome = [...half, ...[...half].reverse()];
  it('R2.1 a symmetric chain gives the card at the mirror pick with its centre', () => {
    const gap = onlyGap(suggestRepairs(chain(palindrome.map((n, i) => (i === 2 ? null : n))), profile));
    const mirror = gap.suggestions.find((s) => s.kind === 'mirror')!;
    expect(mirror.card).toEqual(card(2));
    expect(mirror.confidence).toBe('high');
    expect(mirror.evidence).toMatchObject({ kind: 'mirror', centreSum: 11, partnerPick: 9 });
    expect(gap.notApplied).toContainEqual({ kind: 'repeat', reason: 'no-period' });
  });
  it('R2.1 the centre card of an odd chain has no mirror partner', () => {
    const odd = [0, 1, 2, 3, 4, 9, 4, 3, 2, 1, 0];
    const gap = onlyGap(suggestRepairs(chain(odd.map((n, i) => (i === 5 ? null : n))), profile));
    expect(gap.notApplied).toContainEqual({ kind: 'mirror', reason: 'centre-pick' });
    expect(gap.suggestions.find((s) => s.kind === 'mirror')).toBeUndefined();
  });
  it('R2.1 a mirror pick that is itself lost gives no mirror suggestion', () => {
    const lost = palindrome.map((n, i) => (i === 2 || i === 9 ? null : n));
    const result = suggestRepairs(chain(lost), profile);
    if (!result.ok) throw new Error('failed');
    for (const gap of result.gaps) expect(gap.notApplied).toContainEqual({ kind: 'mirror', reason: 'partner-unreadable' });
  });
});
describe('neighbours', () => {
  it('R2.1 identical picks on both sides propose that card with low confidence and the two picks as evidence', () => {
    const gap = onlyGap(suggestRepairs(chain([7, 1, null, 1, 8]), profile));
    expect(gap.suggestions).toHaveLength(1);
    expect(gap.suggestions[0]).toMatchObject({ kind: 'neighbours', confidence: 'low', evidence: { beforePick: 1, afterPick: 3 } });
    expect(gap.suggestions[0]!.card).toEqual(card(1));
  });
  it('R2.1 different or unreadable neighbours do not apply', () => {
    expect(onlyGap(suggestRepairs(chain([7, 1, null, 2, 8]), profile)).notApplied).toContainEqual({ kind: 'neighbours', reason: 'neighbours-differ' });
    const result = suggestRepairs(chain([1, null, null, 1]), profile);
    if (!result.ok) throw new Error('failed');
    expect(result.gaps[0]!.notApplied).toContainEqual({ kind: 'neighbours', reason: 'neighbour-unreadable' });
  });
});
describe('conflict and evidence', () => {
  it('R2.2 when two kinds propose different cards both are returned, the gap is marked conflicting and neither is dropped', () => {
    // a b a c a b a c a b a c: the repeat says c, the neighbours of pick 3 say a.
    const gap = onlyGap(suggestRepairs(chain([0, 1, 0, null, 0, 1, 0, 2, 0, 1, 0, 2].map((n, i) => (i === 3 ? null : n))), profile));
    expect(gap.conflict).toBe(true);
    expect(gap.suggestions.map((s) => s.kind)).toEqual(expect.arrayContaining(['repeat', 'neighbours']));
    expect(gap.suggestions[0]!.kind).toBe('repeat');
    expect(gap.suggestions.find((s) => s.kind === 'repeat')!.card).toEqual(card(2));
    expect(gap.suggestions.find((s) => s.kind === 'neighbours')!.card).toEqual(card(0));
  });
  it('R2.1 suggestions that agree are not a conflict', () => {
    const gap = onlyGap(suggestRepairs(chain([0, 1, 2, 3, 3, 2, 1, 0].map((n, i) => (i === 3 ? null : n))), profile));
    expect(gap.conflict).toBe(gap.suggestions.some((s) => JSON.stringify(s.card) !== JSON.stringify(gap.suggestions[0]!.card)));
  });
  it('R2.1 each of the three kinds appears exactly once for every gap', () => {
    const result = suggestRepairs(chain([0, 1, 2, 3, 0, 1, null, 3, 0, 1, 2, null]), profile);
    if (!result.ok) throw new Error('failed');
    expect(result.gaps).toHaveLength(2);
    for (const gap of result.gaps) expect(kindsOf(gap)).toEqual(['mirror', 'neighbours', 'repeat']);
  });
  it('R1.1 suggestions are ordered high before medium before low', () => {
    const gap = onlyGap(suggestRepairs(chain([0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2].map((n, i) => (i === 3 ? null : n))), profile));
    const order = { high: 0, medium: 1, low: 2 };
    const ranks = gap.suggestions.map((s) => order[s.confidence]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
  it('R2.1 a missing slot and a damaged slot are told apart', () => {
    const result = suggestRepairs([card(0), null, card(0), [], card(0)], profile);
    if (!result.ok) throw new Error('failed');
    expect(result.gaps.map((g) => [g.pick, g.gapKind])).toEqual([[1, 'missing'], [3, 'damaged']]);
  });
});
describe('edge cases return values', () => {
  it('R1.2 a pattern with no gap has no gap entries', () => {
    expect(suggestRepairs(chain([0, 1, 2, 3]), profile)).toEqual({ ok: true, gaps: [], pickCount: 4, readableCount: 4 });
  });
  it('R1.2 an empty pattern has no gap entries', () => {
    expect(suggestRepairs([], profile)).toEqual({ ok: true, gaps: [], pickCount: 0, readableCount: 0 });
  });
  it('R1.2 when every pick is a gap there is no suggestion and the reason is no-readable-cards', () => {
    const result = suggestRepairs([null, [], null], profile);
    if (!result.ok) throw new Error('failed');
    expect(result.gaps.map((g) => [g.suggestions.length, g.none])).toEqual(Array(3).fill([0, 'no-readable-cards']));
  });
  it('R1.2 cards that do not match the profile are all gaps', () => {
    const wrong = Array.from({ length: 6 }, () => [[true]]);
    const result = suggestRepairs(wrong, profile);
    if (!result.ok) throw new Error('failed');
    expect(result.gaps).toHaveLength(6);
    expect(result.gaps.every((g) => g.gapKind === 'damaged' && g.none === 'no-readable-cards')).toBe(true);
  });
  it('R1.2 a very short chain gives no suggestion and says it is too short', () => {
    const gap = onlyGap(suggestRepairs(chain([1, null]), profile));
    expect(gap).toMatchObject({ suggestions: [], none: 'too-short' });
    const three = onlyGap(suggestRepairs(chain([1, null, 1]), profile));
    expect(three.suggestions.map((s) => s.kind)).toEqual(['neighbours']);
  });
  it('R1.2 a design with no repeat, no mirror and different neighbours gives no suggestion and says there is no evidence', () => {
    const gap = onlyGap(suggestRepairs(chain([0, 1, 2, null, 4, 5, 6, 7]), profile));
    expect(gap).toMatchObject({ suggestions: [], conflict: false, none: 'no-evidence' });
    expect(gap.notApplied.map((n) => n.kind).sort()).toEqual(['mirror', 'neighbours', 'repeat']);
  });
  it('R1.2 an invalid profile and a pattern that is not an array are failure values, and nothing throws', () => {
    expect(suggestRepairs([], {})).toMatchObject({ ok: false, failure: { reason: 'invalid-profile' } });
    expect(suggestRepairs([], null)).toMatchObject({ ok: false, failure: { reason: 'invalid-profile' } });
    for (const bad of ['x', 5, null, undefined, {}]) {
      expect(suggestRepairs(bad, profile)).toEqual({ ok: false, failure: { reason: 'not-a-pattern' } });
    }
  });
  it('R1.1 the pattern and the profile are not changed, and a proposed card is a copy', () => {
    const pattern = chain([0, 1, 2, 3, 0, 1, null, 3, 0, 1, 2, 3]);
    const before = structuredClone({ pattern, profile });
    const result = suggestRepairs(pattern, profile);
    expect({ pattern, profile }).toEqual(before);
    if (!result.ok) throw new Error('failed');
    const proposed = result.gaps[0]!.suggestions[0]!.card;
    proposed[0]![0] = !proposed[0]![0];
    expect(pattern).toEqual(before.pattern);
  });
  it('R1.2 a long chain is answered without a stack or time problem', () => {
    const long = Array.from({ length: 1500 }, (_, i) => (i === 700 ? null : card(i % 7)));
    const started = performance.now();
    const gap = onlyGap(suggestRepairs(long, profile));
    expect(gap.suggestions[0]?.card).toEqual(card(700 % 7));
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
const SEED_REPEAT = 20261121;
const SEED_MIRROR = 20261122;
const gapValue = fc.constantFrom<null | []>(null, []);
describe('properties', () => {
  it('R2.1 a chain made by repeating a block, with one card lost, gets the true card as its top repeat suggestion', () => {
    // Feature: repair-suggestions, Property 1: A lost card of a repeating chain is recovered by the repeat
    fc.assert(
      fc.property(
        profileArbitrary.chain((p) =>
          fc.record({
            p: fc.constant(p),
            block: fc.array(cardGridArbitrary(p), { minLength: 1, maxLength: 6 }),
            extraRepeats: fc.integer({ min: 0, max: 3 }),
            lostAt: fc.nat(),
            lostAs: gapValue,
          }),
        ),
        ({ p, block, extraRepeats, lostAt, lostAs }) => {
          const repeats = Math.max(3, Math.ceil(8 / block.length)) + extraRepeats;
          const pattern: Pattern = Array.from({ length: block.length * repeats }, (_, i) => block[i % block.length]!);
          const lost = lostAt % pattern.length;
          const damaged: unknown[] = pattern.map((c, i) => (i === lost ? lostAs : c));
          const result = suggestRepairs(damaged, p);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.gaps).toHaveLength(1);
          const top = result.gaps[0]!.suggestions.find((s) => s.kind === 'repeat');
          expect(top).toBeDefined();
          expect(top!.card).toEqual(pattern[lost]);
        },
      ),
      { seed: SEED_REPEAT, numRuns: 100 },
    );
  });
  it('R2.1 a palindromic chain with one card lost, other than the centre, gets the true card as its top mirror suggestion', () => {
    // Feature: repair-suggestions, Property 2: A lost card of a symmetric chain is recovered by the mirror
    fc.assert(
      fc.property(
        profileArbitrary.chain((p) =>
          fc.record({
            p: fc.constant(p),
            half: fc.array(cardGridArbitrary(p), { minLength: 5, maxLength: 8 }),
            centre: fc.option(cardGridArbitrary(p), { nil: undefined }),
            lostAt: fc.nat(),
            lostAs: gapValue,
          }),
        ),
        ({ p, half, centre, lostAt, lostAs }) => {
          const pattern: Pattern = [...half, ...(centre === undefined ? [] : [centre]), ...[...half].reverse()];
          // The centre card of an odd chain has no partner; it is covered by an example test, so it is not chosen here.
          const choices = pattern.length - (centre === undefined ? 0 : 1);
          const pick = lostAt % choices;
          const lost = centre !== undefined && pick >= half.length ? pick + 1 : pick;
          const damaged: unknown[] = pattern.map((c, i) => (i === lost ? lostAs : c));
          const result = suggestRepairs(damaged, p);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.gaps).toHaveLength(1);
          const top = result.gaps[0]!.suggestions.find((s) => s.kind === 'mirror');
          expect(top).toBeDefined();
          expect(top!.card).toEqual(pattern[lost]);
        },
      ),
      { seed: SEED_MIRROR, numRuns: 100 },
    );
  });
});
