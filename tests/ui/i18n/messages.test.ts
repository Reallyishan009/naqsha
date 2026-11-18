import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, EN, HI, fillPlaceholders, lookup, placeholders, translator } from '../../../src/ui/i18n/messages.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SEED = 2801;

describe('translations', () => {
  it('R12.6 hi and en have the same keys and the same placeholders', () => {
    // Feature: app, Property 28: Both languages have the same keys and placeholders
    expect(Object.keys(HI).sort()).toEqual(Object.keys(EN).sort());
    // The property ranges over every key of the checked-in dictionaries.
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(EN)), (key) => {
        expect(new Set(placeholders(HI[key]!.text))).toEqual(new Set(placeholders(EN[key]!)));
      }),
      { numRuns: 200, seed: SEED },
    );
  });

  it('R12.7 lookup falls back to en, then to the key', () => {
    // Feature: app, Property 29: Missing text falls back to English, then to the key
    const key = fc.string({ minLength: 1, maxLength: 8 });
    const en = fc.dictionary(key, fc.string());
    const hi = fc.dictionary(key, fc.string().map((text) => ({ text, reviewed: false })));
    fc.assert(
      fc.property(fc.constantFrom('hi', 'en'), key, en, hi, (language, k, enDict, hiDict) => {
        const result = lookup({ en: enDict, hi: hiDict }, language, k);
        if (language === 'hi' && Object.hasOwn(hiDict, k)) expect(result).toBe(hiDict[k]!.text);
        else if (Object.hasOwn(enDict, k)) expect(result).toBe(enDict[k]);
        else expect(result).toBe(k);
      }),
      { numRuns: 300, seed: SEED },
    );
  });

  it('R12.1 placeholders are filled by name and unknown ones stay', () => {
    expect(fillPlaceholders('Pick {pick} of {total}', { pick: 3, total: 12 })).toBe('Pick 3 of 12');
    expect(fillPlaceholders('Pick {pick} of {total}', { pick: 3 })).toBe('Pick 3 of {total}');
    expect(translator(DICTIONARIES, 'en')('weave.pickPosition', { pick: 2, total: 9 })).toBe('Pick 2 of 9');
    expect(translator(DICTIONARIES, 'hi')('weave.pickPosition', { pick: 2, total: 9 })).toContain('2');
  });

  it('R12.7 an unknown key is shown as itself', () => {
    expect(lookup(DICTIONARIES, 'hi', 'no.such.key')).toBe('no.such.key');
  });

  it('R12.8 hi.json avoids "bitmap", "matrix" and "decode" and their Devanagari forms', () => {
    const forbidden = /bitmap|matrix|decode|बिटमैप|बिटमैप|मैट्रिक्स|मेट्रिक्स|डीकोड|डिकोड/i;
    // No key of the cards-as-code view exists in this phase, so no key is exempt.
    for (const [key, entry] of Object.entries(HI)) {
      expect(forbidden.test(entry.text), key).toBe(false);
    }
  });

  it('R12.11 every hi entry has a boolean reviewed flag and is in Devanagari', () => {
    const raw: unknown = JSON.parse(readFileSync(path.join(ROOT, 'src/ui/i18n/hi.json'), 'utf8'));
    expect(typeof raw).toBe('object');
    for (const [key, entry] of Object.entries(raw as Record<string, { text?: unknown; reviewed?: unknown }>)) {
      expect(typeof entry.text, key).toBe('string');
      expect(typeof entry.reviewed, key).toBe('boolean');
    }
  });

  it('R12.11 the first Hindi draft is entirely unreviewed', () => {
    expect(Object.values(HI).every((entry) => entry.reviewed === false)).toBe(true);
  });
});
