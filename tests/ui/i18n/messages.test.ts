import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DIFF_MARKERS, GROUP_SEPARATOR } from '../../../src/codec-view/index.ts';
import { DICTIONARIES, EN, HI, fillPlaceholders, lookup, placeholders, translator } from '../../../src/ui/i18n/messages.ts';
import { reviewList } from '../../../src/ui/i18n/reviewList.ts';

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

// Code view keys (cards-as-code, R10 and R11.3 to R11.5).

/** Every key the design's translation table names, plus the refusal keys. */
const DESIGN_TABLE_KEYS: readonly string[] = [
  'nav.code',
  'codeview.listing.name',
  'codeview.line.name',
  'codeview.line.nameEmpty',
  'codeview.line.nameDamaged',
  'codeview.line.damagedLabel',
  'codeview.bitline.name',
  'codeview.breakpoint.name',
  'codeview.pickCount',
  'codeview.announce.pick',
  'codeview.announce.noBreakpoint',
  'codeview.jump.range',
  'codeview.diff.kind.unchanged',
  'codeview.diff.kind.changed',
  'codeview.diff.kind.added',
  'codeview.diff.kind.removed',
  'codeview.diff.name.unchanged',
  'codeview.diff.name.changed',
  'codeview.diff.name.added',
  'codeview.diff.name.removed',
  'codeview.refusal.dimension-mismatch',
  'codeview.refusal.profile-mismatch',
  'codeview.refusal.too-many-picks',
  'error.codeview.load',
];

/** The keys that carry a pick number or an end index and are read aloud (R10.8). */
const ACCESSIBLE_NAME_KEYS: readonly string[] = [
  'codeview.line.name',
  'codeview.line.nameEmpty',
  'codeview.line.nameDamaged',
  'codeview.bitline.name',
  'codeview.breakpoint.name',
  'codeview.announce.pick',
  'codeview.diff.name.unchanged',
  'codeview.diff.name.changed',
  'codeview.diff.name.added',
  'codeview.diff.name.removed',
];

/** The values each refusal carries, as the placeholder names of its message (R6.12). */
const REFUSAL_PLACEHOLDERS: Readonly<Record<string, readonly string[]>> = {
  'codeview.refusal.dimension-mismatch': ['firstHookRows', 'firstHookColumns', 'secondHookRows', 'secondHookColumns'],
  'codeview.refusal.profile-mismatch': ['firstProfileName', 'secondProfileName'],
  'codeview.refusal.too-many-picks': ['limit', 'firstPicks', 'secondPicks'],
};

/** Words that must not stand for pick, end, card, punched hole, naksha or naqshband in new Hindi text (R10.3). */
const OTHER_HINDI_WORDS: readonly string[] = [
  'धागा',
  'धागे',
  'सिरा',
  'सिरे',
  'पर्ची',
  'होल',
  'सुराख',
  'छिद्र',
  'कार्ड्स',
  'पिक्स',
  'एन्ड',
  'नक़्शा',
  'नक़्शबंद',
  'नक्शाबंद',
];

const isCodeViewKey = (key: string): boolean => key === 'nav.code' || key === 'error.codeview.load' || key.startsWith('codeview.');
const CODE_VIEW_KEYS: readonly string[] = Object.keys(EN).filter(isCodeViewKey);
const withoutPlaceholders = (text: string): string => text.replace(/\{\w+\}/g, '');

describe('Code view translations', () => {
  it('R10.1 every key of the design table is in both files, and the screen keys are too', () => {
    for (const key of DESIGN_TABLE_KEYS) {
      expect(Object.hasOwn(EN, key), `en ${key}`).toBe(true);
      expect(Object.hasOwn(HI, key), `hi ${key}`).toBe(true);
    }
    // The task adds the control, heading and message keys of screen tasks 3.1 to 3.8 as well.
    expect(CODE_VIEW_KEYS.length).toBeGreaterThan(DESIGN_TABLE_KEYS.length);
    expect([...CODE_VIEW_KEYS].sort()).toEqual(Object.keys(HI).filter(isCodeViewKey).sort());
  });

  it('R10.2 each Code view key has the same placeholder names in hi and en', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CODE_VIEW_KEYS), (key) => {
        expect(new Set(placeholders(HI[key]!.text)), key).toEqual(new Set(placeholders(EN[key]!)));
      }),
      { numRuns: 200, seed: SEED },
    );
  });

  it('R6.12 each refusal message names exactly the values its refusal carries', () => {
    for (const [key, names] of Object.entries(REFUSAL_PLACEHOLDERS)) {
      expect([...new Set(placeholders(EN[key]!))].sort(), `en ${key}`).toEqual([...names].sort());
      expect([...new Set(placeholders(HI[key]!.text))].sort(), `hi ${key}`).toEqual([...names].sort());
    }
  });

  it('R10.4 every Code view hi entry is not reviewed and the review list names it with both texts', () => {
    const listed = new Map(reviewList(HI, EN).map((entry) => [entry.key, entry]));
    fc.assert(
      fc.property(fc.constantFrom(...CODE_VIEW_KEYS), (key) => {
        expect(HI[key]!.reviewed, key).toBe(false);
        expect(listed.get(key), key).toEqual({ key, hi: HI[key]!.text, en: EN[key]! });
      }),
      { numRuns: 200, seed: SEED },
    );
  });

  it('R10.3 new Hindi text uses पिक, एंड, कार्ड and छेद for those concepts and no other word', () => {
    const terms: ReadonlyArray<{ english: RegExp; hindi: string }> = [
      { english: /\bpicks?\b/i, hindi: 'पिक' },
      { english: /\bends?\b/i, hindi: 'एंड' },
      { english: /\bcards?\b/i, hindi: 'कार्ड' },
      { english: /punched hole/i, hindi: 'छेद' },
    ];
    fc.assert(
      fc.property(fc.constantFrom(...CODE_VIEW_KEYS), (key) => {
        const hindi = HI[key]!.text;
        for (const term of terms) {
          if (term.english.test(EN[key]!)) expect(hindi, `${key} names ${term.hindi}`).toContain(term.hindi);
        }
        for (const other of OTHER_HINDI_WORDS) expect(hindi.includes(other), `${key} uses ${other}`).toBe(false);
      }),
      { numRuns: 200, seed: SEED },
    );
  });

  it('R10.5 no Code view text holds a digit: numbers come in through placeholders', () => {
    fc.assert(
      fc.property(fc.constantFrom(...CODE_VIEW_KEYS), (key) => {
        expect(/[0-9०-९]/.test(EN[key]!), `en ${key}`).toBe(false);
        expect(/[0-9०-९]/.test(HI[key]!.text), `hi ${key}`).toBe(false);
      }),
      { numRuns: 200, seed: SEED },
    );
  });

  it('R10.6 R10.7 the Group_Separator and the Diff_Entry markers are not in any Code view text', () => {
    const fixed = [GROUP_SEPARATOR, ...Object.values(DIFF_MARKERS).filter((marker) => marker.trim() !== '')];
    fc.assert(
      fc.property(fc.constantFrom(...CODE_VIEW_KEYS), (key) => {
        for (const character of fixed) {
          expect(EN[key]!.includes(character), `en ${key} holds ${character}`).toBe(false);
          expect(HI[key]!.text.includes(character), `hi ${key} holds ${character}`).toBe(false);
        }
      }),
      { numRuns: 200, seed: SEED },
    );
  });

  it('R10.8 the Hindi accessible names hold पिक and no Latin letter outside a placeholder', () => {
    for (const key of ACCESSIBLE_NAME_KEYS) {
      const hindi = HI[key]!.text;
      expect(hindi, key).toContain('पिक');
      expect(/[A-Za-z]/.test(withoutPlaceholders(hindi)), key).toBe(false);
    }
    expect(HI['codeview.line.name']!.text).toContain('एंड');
    expect(HI['codeview.diff.name.changed']!.text).toContain('एंड');
  });

  it('R11.3 R11.4 the Line accessible names read exactly as the requirements fix them in en', () => {
    expect(EN['codeview.line.name']).toBe('Pick {pick}: punched at ends {ends}');
    expect(EN['codeview.line.nameEmpty']).toBe('Pick {pick}: no end punched');
    const t = translator(DICTIONARIES, 'en');
    expect(t('codeview.line.name', { pick: 5, ends: '0, 3, 7' })).toBe('Pick 5: punched at ends 0, 3, 7');
    expect(t('codeview.line.nameEmpty', { pick: 5 })).toBe('Pick 5: no end punched');
  });

  it('R11.5 each Diff_Entry name states its kind word and its pick numbers in both languages', () => {
    for (const language of ['en', 'hi'] as const) {
      const t = translator(DICTIONARIES, language);
      for (const kind of ['unchanged', 'changed', 'added', 'removed'] as const) {
        expect(t(`codeview.diff.name.${kind}`, { firstPick: 3, secondPick: 4, ends: '1, 2' }), `${language} ${kind}`).toContain(
          t(`codeview.diff.kind.${kind}`),
        );
      }
    }
  });
});
