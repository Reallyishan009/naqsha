import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { IMAGE_CREDITS, parseImageCredits } from '../../../src/ui/state/imageCredits.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const PHOTO_FILES = readdirSync(path.join(ROOT, 'public/photos')).filter((name) => !name.startsWith('.'));
const MARKDOWN = readFileSync(path.join(ROOT, 'docs/IMAGE_CREDITS.md'), 'utf8');

describe('image credits parsed from docs/IMAGE_CREDITS.md', () => {
  it('public/photos holds files to cover', () => {
    expect(PHOTO_FILES.length).toBeGreaterThan(0);
  });

  it('the credits cover every file in public/photos exactly once', () => {
    const covered = IMAGE_CREDITS.flatMap((credit) => credit.files);
    for (const file of PHOTO_FILES) {
      expect(covered.filter((name) => name === file), `${file} in docs/IMAGE_CREDITS.md`).toHaveLength(1);
    }
  });

  it('every credit names only files that exist in public/photos', () => {
    for (const credit of IMAGE_CREDITS) {
      for (const file of credit.files) expect(PHOTO_FILES, file).toContain(file);
    }
  });

  it('each entry has a title, author, licence name, licence link and source link', () => {
    for (const credit of IMAGE_CREDITS) {
      expect(credit.title, credit.files.join(',')).not.toBe('');
      expect(credit.author, credit.files.join(',')).not.toBe('');
      expect(credit.licenceName).toMatch(/^CC BY \d\.\d$/);
      expect(credit.licenceUrl).toMatch(/^https:\/\/creativecommons\.org\/licenses\/by\/\d\.\d\/$/);
      expect(credit.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
    }
  });

  it('a source link that holds parentheses is read to its last closing parenthesis', () => {
    const sari = IMAGE_CREDITS.find((credit) => credit.files.includes('sari-pattern-cards-900.avif'));
    expect(sari?.sourceUrl).toBe(
      'https://commons.wikimedia.org/wiki/File:India_-_Sights_%26_Culture_-_Hand-loom_pattern_cards_for_silk_sari_weaving_(2507306023).jpg',
    );
  });

  it('a table line with two files (the hero) gives one entry with both files', () => {
    const hero = IMAGE_CREDITS.find((credit) => credit.files.includes('loom-hero-1600.avif'));
    expect(hero?.files).toEqual(['loom-hero-1600.avif', 'loom-hero-800.avif']);
    expect(hero?.author).toBe('Herry Lawford');
  });

  it('the markdown file is the source: parsing it again gives the same list', () => {
    expect(parseImageCredits(MARKDOWN)).toEqual(IMAGE_CREDITS);
  });

  it('lines that are not credit entries are skipped and the parser never throws', () => {
    expect(parseImageCredits('')).toEqual([]);
    expect(parseImageCredits('# Image credits\n| a | b |\n|---|---|\n| `x.avif` | t | a | no link | no link |')).toEqual([]);
    expect(parseImageCredits('| `x.avif` | T | A | [CC BY 2.0](https://l/) | [Page](https://s/) |')).toEqual([
      { files: ['x.avif'], title: 'T', author: 'A', licenceName: 'CC BY 2.0', licenceUrl: 'https://l/', sourceUrl: 'https://s/' },
    ]);
  });
});
