import { describe, expect, it } from 'vitest';
import type { DesignSummary } from '../../../src/archive/index.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { EMPTY_METADATA, formatSavedAt } from '../../../src/ui/state/keep.ts';
import { NOTE_EXCERPT_MAX, noteExcerpt, versionLabels } from '../../../src/ui/state/versionLabels.ts';

const en = translator(DICTIONARIES, 'en');
const hi = translator(DICTIONARIES, 'hi');

function summary(id: string, overrides: Partial<DesignSummary> & { name?: string } = {}): DesignSummary {
  const { name = 'Kota', ...rest } = overrides;
  return {
    id,
    profileName: 'p',
    metadata: { ...EMPTY_METADATA, name },
    createdAt: Date.UTC(2024, 0, 5, 10, 30),
    pickCount: 7,
    ...rest,
  };
}

function labelOf(item: DesignSummary): string {
  const label = versionLabels([item], 'en', en).get(item.id);
  if (label === undefined) throw new Error('no label');
  return label;
}

describe('noteExcerpt', () => {
  const E = '…';

  it('R16.2 a note of exactly 40 code points is shown in full', () => {
    const note = 'a'.repeat(NOTE_EXCERPT_MAX);
    expect(noteExcerpt(note, E)).toBe(note);
  });

  it('R16.2 a note of 41 code points with no space is cut at exactly 40 and gets one ellipsis', () => {
    expect(noteExcerpt('a'.repeat(41), E)).toBe(`${'a'.repeat(40)}${E}`);
  });

  it('R16.2 a note of 41 code points with a space is cut at the last space within the first 40', () => {
    const note = `${'a'.repeat(10)} ${'b'.repeat(10)} ${'c'.repeat(18)} ${'d'.repeat(5)}`;
    expect(Array.from(note).length).toBe(46);
    expect(noteExcerpt(note, E)).toBe(`${'a'.repeat(10)} ${'b'.repeat(10)}${E}`);
  });

  it('R16.2 line breaks and runs of whitespace become one space and the ends are trimmed', () => {
    expect(noteExcerpt('  wider\n\n border \t here  ', E)).toBe('wider border here');
  });

  it('R16.3 a missing, empty or blank note gives an empty excerpt', () => {
    expect(noteExcerpt(undefined, E)).toBe('');
    expect(noteExcerpt('', E)).toBe('');
    expect(noteExcerpt(' \n\t ', E)).toBe('');
  });

  it('R16.2 characters above U+FFFF count once each', () => {
    const forty = '𝒜'.repeat(40);
    expect(noteExcerpt(forty, E)).toBe(forty);
    expect(noteExcerpt(`${forty}𝒜`, E)).toBe(`${forty}${E}`);
  });
});

describe('versionLabels', () => {
  const savedAt = formatSavedAt(Date.UTC(2024, 0, 5, 10, 30), 'en');

  it('R16.1 a label is the name and count, the saved date and the note excerpt, joined by " · "', () => {
    expect(labelOf(summary('a', { note: 'wider border' }))).toBe(`Kota (7 picks) · ${savedAt} · wider border`);
  });

  it('R16.3 a version without a note, or with a blank note, has no note part and no trailing separator', () => {
    expect(labelOf(summary('a'))).toBe(`Kota (7 picks) · ${savedAt}`);
    expect(labelOf(summary('a', { note: '  \n ' }))).toBe(`Kota (7 picks) · ${savedAt}`);
  });

  it('R16.4 the date text is the Keep list date text in the language in use', () => {
    const item = summary('a');
    expect(versionLabels([item], 'hi', hi).get('a')).toContain(formatSavedAt(item.createdAt, 'hi'));
    expect(versionLabels([item], 'en', en).get('a')).toContain(formatSavedAt(item.createdAt, 'en'));
  });

  it('R16.5 a missing or invalid saved time leaves out the date and its separator, and the version is still listed', () => {
    expect(labelOf(summary('a', { createdAt: Number.NaN }))).toBe('Kota (7 picks)');
    expect(labelOf(summary('a', { createdAt: undefined as unknown as number }))).toBe('Kota (7 picks)');
    expect(labelOf(summary('a', { createdAt: Number.NaN, note: 'wider' }))).toBe('Kota (7 picks) · wider');
  });

  it('R16.6 an empty or blank name shows the untitled text', () => {
    expect(labelOf(summary('a', { name: '' }))).toBe(`untitled (7 picks) · ${savedAt}`);
    expect(labelOf(summary('a', { name: '   ' }))).toBe(`untitled (7 picks) · ${savedAt}`);
  });

  it('R16.7 equal labels get #1, #2 in saved-time order, then by archive id', () => {
    const list = [
      summary('z', { createdAt: 5 }),
      summary('b', { createdAt: 5 }),
      summary('m', { createdAt: 1 }),
      summary('other', { name: 'Paithani' }),
    ];
    // The saved date shows the minute only, so these three differ in time but not in label.
    const labels = versionLabels(list, 'en', en);
    expect(labels.get('m')).toBe(`Kota (7 picks) · ${formatSavedAt(1, 'en')} #1`);
    expect(labels.get('b')).toBe(`Kota (7 picks) · ${formatSavedAt(5, 'en')} #2`);
    expect(labels.get('z')).toBe(`Kota (7 picks) · ${formatSavedAt(5, 'en')} #3`);
    expect(labels.get('other')).toBe(`Paithani (7 picks) · ${savedAt}`);
  });

  it('R16.7 after the suffix no two labels in the list are equal', () => {
    const list = ['1', '2', '3', '4'].map((id) => summary(id, { name: 'A', createdAt: 1 }));
    const labels = [...versionLabels(list, 'en', en).values()];
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('R16.7 labels that differ are left without a suffix', () => {
    const labels = versionLabels([summary('a'), summary('b', { name: 'Banarasi' })], 'en', en);
    expect(labels.get('a')).not.toContain('#');
    expect(labels.get('b')).not.toContain('#');
  });

  it('R16.9 the separator, the suffix and the ellipsis come from keys in both languages', () => {
    const long = 'x'.repeat(41);
    expect(versionLabels([summary('a', { note: long })], 'hi', hi).get('a')).toContain(`${'x'.repeat(40)}…`);
    expect(hi('codeview.diff.separator')).toBe(' · ');
    expect(hi('codeview.diff.duplicate', { k: 2 })).toBe(' #2');
  });
});
