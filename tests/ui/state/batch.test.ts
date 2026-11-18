import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardGrid, CardProfile } from '../../../src/codec/index.ts';
import { appendCard, commitBatch, moveCard, removeCard, replaceCard } from '../../../src/ui/state/batch.ts';
import { cardGridArbitrary, cardProfileArbitrary } from '../../support/profiles.ts';

const SEED = 20240514;
const NUM_RUNS = 100;

/** A profile with a batch, an extra card, and a current pattern, all for the same profile. */
const batchCase = cardProfileArbitrary.chain((profile: CardProfile) =>
  fc.record({
    batch: fc.array(cardGridArbitrary(profile), { maxLength: 6 }),
    current: fc.array(cardGridArbitrary(profile), { maxLength: 4 }),
    card: cardGridArbitrary(profile),
  }),
);

function grid(value: boolean): CardGrid {
  return [[value]];
}

describe('batch operations examples', () => {
  const a = grid(true);
  const b = grid(false);
  const c = [[true, false]];

  it('R11.1 appendCard adds the card as the next pick', () => {
    expect(appendCard([a, b], c)).toEqual([a, b, c]);
  });

  it('R11.3 removeCard removes exactly the chosen card', () => {
    expect(removeCard([a, b, c], 1)).toEqual([a, c]);
  });

  it('R11.4 moveCard swaps with the neighbour and stops at the edges', () => {
    expect(moveCard([a, b, c], 1, -1)).toEqual([b, a, c]);
    expect(moveCard([a, b, c], 1, 1)).toEqual([a, c, b]);
    expect(moveCard([a, b, c], 0, -1)).toEqual([a, b, c]);
    expect(moveCard([a, b, c], 2, 1)).toEqual([a, b, c]);
  });

  it('R11.5 replaceCard puts the new card in place', () => {
    expect(replaceCard([a, b], 0, c)).toEqual([c, b]);
  });

  it('R11.8 Done replaces the pattern or appends the batch to it', () => {
    expect(commitBatch([b], [a], 'replace')).toEqual([b]);
    expect(commitBatch([b], [a], 'append')).toEqual([a, b]);
  });

  it('R11.10 indices that are not integers in range leave the batch unchanged', () => {
    const batch = [a, b];
    expect(removeCard(batch, -1)).toBe(batch);
    expect(removeCard(batch, 2)).toBe(batch);
    expect(removeCard(batch, 0.5)).toBe(batch);
    expect(replaceCard(batch, 2, c)).toBe(batch);
  });
});

describe('batch operations properties', () => {
  it('R11.1 R11.3 R11.4 R11.5 batch operations keep their invariants and ignore out-of-range indices', () => {
    // Feature: app, Property 26: Batch operations keep their invariants
    fc.assert(
      fc.property(batchCase, fc.integer({ min: -3, max: 10 }), fc.constantFrom(-1 as const, 1 as const), ({ batch, card }, index, by) => {
        const appended = appendCard(batch, card);
        expect(appended).toHaveLength(batch.length + 1);
        expect(appended.slice(0, batch.length)).toEqual(batch);
        expect(appended[batch.length]).toEqual(card);

        const valid = index >= 0 && index < batch.length;
        const removed = removeCard(batch, index);
        const replaced = replaceCard(batch, index, card);
        const moved = moveCard(batch, index, by);
        if (!valid) {
          expect(removed).toEqual(batch);
          expect(replaced).toEqual(batch);
          expect(moved).toEqual(batch);
          return;
        }
        expect(removed).toHaveLength(batch.length - 1);
        expect([...removed.slice(0, index), batch[index]!, ...removed.slice(index)]).toEqual(batch);

        expect(replaced).toHaveLength(batch.length);
        replaced.forEach((existing, position) => {
          expect(existing).toEqual(position === index ? card : batch[position]);
        });

        expect(moved).toHaveLength(batch.length);
        const target = index + by;
        if (target < 0 || target >= batch.length) {
          expect(moved).toEqual(batch);
        } else {
          moved.forEach((existing, position) => {
            const expected = position === index ? batch[target] : position === target ? batch[index] : batch[position];
            expect(existing).toEqual(expected);
          });
        }
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });

  it('R11.9 Done keeps the order of the Scan_Batch, for replace and append', () => {
    // Feature: app, Property 27: Done keeps the order of the Scan_Batch
    fc.assert(
      fc.property(batchCase, ({ batch, current }) => {
        const replaced = commitBatch(batch, current, 'replace');
        expect(replaced).toHaveLength(batch.length);
        replaced.forEach((card, pick) => expect(card).toEqual(batch[pick]));

        const appended = commitBatch(batch, current, 'append');
        expect(appended).toEqual([...current, ...batch]);
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });
});
