import { describe, expect, it } from 'vitest';
import { DICTIONARIES, EN, HI, pluralKey, translator } from '../../../src/ui/i18n/messages.ts';
import { EMPTY_METADATA } from '../../../src/ui/state/keep.ts';
import { versionLabels } from '../../../src/ui/state/versionLabels.ts';

const en = translator(DICTIONARIES, 'en');
const hi = translator(DICTIONARIES, 'hi');

describe('R17 singular and plural pick texts', () => {
  it('R17.1 R17.2 keep.list.picks reads "1 pick" for 1 and "picks" for 0 and 2', () => {
    expect(en('keep.list.picks', { count: 1 })).toBe('1 pick');
    expect(en('keep.list.picks', { count: 0 })).toBe('0 picks');
    expect(en('keep.list.picks', { count: 2 })).toBe('2 picks');
    expect(en('keep.list.picks', { count: 12 })).toBe('12 picks');
    expect(en('keep.list.picks', { count: 1 })).not.toBe('1 picks');
  });
  it('R17.1 R17.2 codeview.pickCount reads "1 pick" for 1 and "picks" for 0 and 2', () => {
    expect(en('codeview.pickCount', { count: 1 })).toBe('1 pick');
    expect(en('codeview.pickCount', { count: 0 })).toBe('0 picks');
    expect(en('codeview.pickCount', { count: 2 })).toBe('2 picks');
    expect(en('codeview.pickCount', { count: 1 })).not.toBe('1 picks');
  });
  it('R17.1 R17.2 codeview.diff.option reads "{name} (1 pick)" for 1 and "picks" for 0 and 2', () => {
    expect(en('codeview.diff.option', { name: 'Kota', count: 1 })).toBe('Kota (1 pick)');
    expect(en('codeview.diff.option', { name: 'Kota', count: 0 })).toBe('Kota (0 picks)');
    expect(en('codeview.diff.option', { name: 'Kota', count: 2 })).toBe('Kota (2 picks)');
    expect(en('codeview.diff.option', { name: 'Kota', count: 1 })).not.toContain('1 picks');
  });
  it('R17.3 repair.evidence.repeat reads without "1 picks" for a period of 1 and with "12 picks" for 12', () => {
    const params = { agreeing: 3, compared: 4, picks: '5' };
    expect(en('repair.evidence.repeat', { ...params, period: 1 })).toBe(
      'Cards repeat every pick (3 of 4 pairs agree). Taken from pick 5.',
    );
    expect(en('repair.evidence.repeat', { ...params, period: 12 })).toBe(
      'Cards repeat every 12 picks (3 of 4 pairs agree). Taken from pick 5.',
    );
  });
  it('R17.1 a Version_Label for a version of one pick reads "name (1 pick)"', () => {
    const summary = { id: 'a', profileName: 'p', metadata: { ...EMPTY_METADATA, name: 'Kota' }, createdAt: Number.NaN, pickCount: 1 };
    expect(versionLabels([summary], 'en', en).get('a')).toBe('Kota (1 pick)');
    expect(versionLabels([{ ...summary, pickCount: 0 }], 'en', en).get('a')).toBe('Kota (0 picks)');
    expect(versionLabels([{ ...summary, pickCount: 2 }], 'en', en).get('a')).toBe('Kota (2 picks)');
  });
  it('R17.3 each pair is stored as .one and .other and the base key is gone', () => {
    for (const base of ['keep.list.picks', 'codeview.pickCount', 'codeview.diff.option', 'repair.evidence.repeat']) {
      expect(Object.hasOwn(EN, `${base}.one`), `${base}.one`).toBe(true);
      expect(Object.hasOwn(EN, `${base}.other`), `${base}.other`).toBe(true);
      expect(Object.hasOwn(EN, base), base).toBe(false);
    }
  });
  it('R17.4 hi and en have exactly the same keys, and each new hi entry is unreviewed', () => {
    expect(Object.keys(HI).sort()).toEqual(Object.keys(EN).sort());
    for (const base of ['keep.list.picks', 'codeview.pickCount', 'codeview.diff.option', 'repair.evidence.repeat']) {
      expect(HI[`${base}.one`]?.reviewed, `${base}.one`).toBe(false);
      expect(HI[`${base}.other`]?.reviewed, `${base}.other`).toBe(false);
    }
  });
  it('R17.4 the Hindi text of a count of 1 and of a count of 2 comes from the same count rule', () => {
    expect(hi('keep.list.picks', { count: 1 })).toBe('1 पिक');
    expect(hi('keep.list.picks', { count: 2 })).toBe('2 पिक');
    expect(hi('codeview.diff.option', { name: 'कोटा', count: 1 })).toBe('कोटा (1 पिक)');
  });
  it('R17.6 pluralKey chooses from the count alone and leaves other keys and non-number counts alone', () => {
    expect(pluralKey(EN, 'keep.list.picks', { count: 1 })).toBe('keep.list.picks.one');
    expect(pluralKey(EN, 'keep.list.picks', { count: 0 })).toBe('keep.list.picks.other');
    expect(pluralKey(EN, 'keep.list.picks', { count: 2 })).toBe('keep.list.picks.other');
    expect(pluralKey(EN, 'repair.evidence.repeat', { period: 1 })).toBe('repair.evidence.repeat.one');
    expect(pluralKey(EN, 'keep.list.picks', { count: '1' })).toBe('keep.list.picks');
    expect(pluralKey(EN, 'keep.list.picks')).toBe('keep.list.picks');
    expect(pluralKey(EN, 'keep.save.guessesNote.one', { count: 1 })).toBe('keep.save.guessesNote.one');
    expect(pluralKey(EN, 'keep.title', { count: 1 })).toBe('keep.title');
  });
});
