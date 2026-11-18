import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EN, HI } from '../../../src/ui/i18n/messages.ts';
import { renderReviewMarkdown, reviewList } from '../../../src/ui/i18n/reviewList.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('review list', () => {
  it('R12.9 the review list is exactly the unreviewed Hindi entries', () => {
    // Feature: app, Property 30: The review list is exactly the unreviewed Hindi entries
    const keys = fc.uniqueArray(fc.string({ minLength: 1, maxLength: 6 }), { maxLength: 12 });
    const dictionaries = keys.chain((list) =>
      fc.tuple(
        fc.constant(list),
        fc.array(fc.record({ text: fc.string(), reviewed: fc.boolean() }), { minLength: list.length, maxLength: list.length }),
        fc.array(fc.string(), { minLength: list.length, maxLength: list.length }),
      ),
    );
    fc.assert(
      fc.property(dictionaries, ([list, hiEntries, enTexts]) => {
        const hi = Object.fromEntries(list.map((key, i) => [key, hiEntries[i]!]));
        const en = Object.fromEntries(list.map((key, i) => [key, enTexts[i]!]));
        const result = reviewList(hi, en);
        // Object key order puts integer-like keys first, so the expectation follows the dictionary's own order.
        const expected = Object.keys(hi).filter((key) => hi[key]!.reviewed !== true);
        expect(result.map((entry) => entry.key)).toEqual(expected);
        for (const entry of result) {
          expect(entry.hi).toBe(hi[entry.key]!.text);
          expect(entry.en).toBe(en[entry.key]);
        }
      }),
      { numRuns: 200, seed: 3001 },
    );
  });

  it('R12.12 the checked-in docs/HINDI_REVIEW.md equals the generated output', () => {
    const checkedIn = readFileSync(path.join(ROOT, 'docs/HINDI_REVIEW.md'), 'utf8');
    expect(checkedIn).toBe(renderReviewMarkdown(reviewList(HI, EN)));
  });

  it('R12.10 a new unreviewed key appears in the list and a reviewed one does not', () => {
    const list = reviewList({ a: { text: 'क', reviewed: false }, b: { text: 'ख', reviewed: true } }, { a: 'A', b: 'B' });
    expect(list).toEqual([{ key: 'a', hi: 'क', en: 'A' }]);
  });
});
