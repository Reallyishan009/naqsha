import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FONT_FILES, fontPrecacheProblems } from '../../scripts/checks/fonts.ts';
import {
  buildCodePointLists,
  collectStrings,
  isDevanagari,
  parseCodePoint,
  codePointsOf,
  projectTexts,
} from '../../scripts/fonts/codepoints.ts';
import { woff2CodePoints } from '../../scripts/fonts/woff2Cmap.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FONT_DIR = path.join(ROOT, 'public/fonts');
const LICENCE_FILES = ['RozhaOne-OFL.txt', 'Hind-OFL.txt', 'IBMPlexMono-OFL.txt'];

/** The files that carry Devanagari: Rozha One and both Hind files. IBM Plex Mono carries none. */
const DEVANAGARI_FONTS = ['RozhaOne-Regular.woff2', 'Hind-Regular.woff2', 'Hind-Bold.woff2'];
const ALL_FONTS = [...DEVANAGARI_FONTS, 'IBMPlexMono-Regular.woff2'];

function coveredBy(file: string): ReadonlySet<number> {
  const result = woff2CodePoints(readFileSync(path.join(FONT_DIR, file)));
  if (!result.ok) throw new Error(`${file}: ${result.reason}`);
  return result.codePoints;
}

function readMissingGlyphs(): Record<string, Set<number>> {
  const raw = JSON.parse(readFileSync(path.join(ROOT, 'scripts/fonts/missing-glyphs.json'), 'utf8')) as Record<string, string[]>;
  const missing: Record<string, Set<number>> = {};
  for (const [file, listed] of Object.entries(raw)) {
    missing[file] = new Set(listed.map((text) => {
      const codePoint = parseCodePoint(text);
      if (codePoint === null) throw new Error(`${file}: "${text}" in missing-glyphs.json is not a code point`);
      return codePoint;
    }));
  }
  return missing;
}

function hex(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

describe('Font_Files', () => {
  it('R1.1 there are exactly four woff2 files under public/fonts, and FONT_FILES names them', () => {
    const woff2 = readdirSync(FONT_DIR).filter((name) => name.endsWith('.woff2')).sort();
    expect(woff2).toEqual([...ALL_FONTS].sort());
    expect(FONT_FILES.map((entry) => entry.replace(/^\.\/fonts\//, '')).sort()).toEqual(woff2);
  });

  it('R2.3 each licence text is non-empty', () => {
    for (const file of LICENCE_FILES) {
      expect(readFileSync(path.join(FONT_DIR, file), 'utf8').trim().length, file).toBeGreaterThan(0);
    }
  });

  it('R1.5 both Hind files and Rozha One cover every Devanagari code point used in hi.json', () => {
    const hindi = JSON.parse(readFileSync(path.join(ROOT, 'src/ui/i18n/hi.json'), 'utf8')) as unknown;
    const used = [...codePointsOf(collectStrings(hindi))].filter(isDevanagari);
    expect(used.length).toBeGreaterThan(0);
    for (const file of DEVANAGARI_FONTS) {
      const covered = coveredBy(file);
      const lacking = used.filter((codePoint) => !covered.has(codePoint)).map(hex);
      expect(lacking, `${file} lacks Devanagari code points used in hi.json`).toEqual([]);
    }
  });

  it('R1.6 every other required code point is covered unless missing-glyphs.json lists it', () => {
    const lists = buildCodePointLists(projectTexts(ROOT));
    const missing = readMissingGlyphs();
    for (const file of ALL_FONTS) {
      const covered = coveredBy(file);
      const listed = missing[file] ?? new Set<number>();
      const required = DEVANAGARI_FONTS.includes(file) ? [...lists.latinSymbols, ...lists.devanagari] : lists.latinSymbols;
      const lacking = required.filter((codePoint) => !covered.has(codePoint) && !listed.has(codePoint)).map(hex);
      expect(lacking, `${file} lacks required code points that missing-glyphs.json does not list`).toEqual([]);
    }
  });

  it('R1.6 every code point that missing-glyphs.json lists is really not covered', () => {
    for (const [file, listed] of Object.entries(readMissingGlyphs())) {
      const covered = coveredBy(file);
      const present = [...listed].filter((codePoint) => covered.has(codePoint)).map(hex);
      expect(present, `${file} covers code points that missing-glyphs.json lists as missing`).toEqual([]);
    }
  });
});

describe('fontPrecacheProblems', () => {
  it('R1.12 names each Font_File that is missing from the precache list', () => {
    const entries = FONT_FILES.filter((file) => file !== './fonts/Hind-Bold.woff2');
    const problems = fontPrecacheProblems(entries);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('./fonts/Hind-Bold.woff2');
    expect(fontPrecacheProblems([])).toHaveLength(FONT_FILES.length);
  });

  it('R1.7 returns nothing when all four Font_Files are listed', () => {
    expect(fontPrecacheProblems(['./', './index.html', ...FONT_FILES])).toEqual([]);
  });
});
