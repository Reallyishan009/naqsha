/**
 * Lists the code points the Font_Files must hold (design-and-ux-pass, Requirements 1.5 and 1.6).
 *
 * Reads every string value of `src/ui/i18n/en.json` and `src/ui/i18n/hi.json` and the names of
 * the three Sample_Designs, and writes two lists for `pyftsubset`:
 * - `latin-symbols.txt`: Basic Latin (U+0020 to U+007E) and every other code point found that is
 *   not in the Devanagari block, such as punctuation and symbols. All four fonts take this list.
 * - `devanagari.txt`: the Devanagari block (U+0900 to U+097F), the two joiners (U+200C, U+200D)
 *   and the dotted circle (U+25CC) that Devanagari shaping uses. Rozha One and both Hind files
 *   take this list as well; IBM Plex Mono does not.
 *
 * Dev only: nothing here is part of `npm run build`. Usage (Node 22.18+ runs .ts directly):
 *   node scripts/fonts/codepoints.ts <output directory>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const BASIC_LATIN_FIRST = 0x20;
export const BASIC_LATIN_LAST = 0x7e;
export const DEVANAGARI_FIRST = 0x0900;
export const DEVANAGARI_LAST = 0x097f;
/** The two joiners and the dotted circle: used by Devanagari shaping, so Rozha One and Hind only. */
export const SHAPING_EXTRAS: readonly number[] = [0x200c, 0x200d, 0x25cc];
/** The Translation_File keys that hold the names of the three Sample_Designs. */
export const SAMPLE_DESIGN_NAME_KEYS: readonly string[] = ['tryit.diamond', 'tryit.border', 'tryit.floral'];

export type CodePointLists = {
  /** Sorted. Held by every font. */
  latinSymbols: number[];
  /** Sorted. Held by Rozha One and Hind only. */
  devanagari: number[];
};

/** Every string value in a parsed JSON value, at any depth. Keys are not read. */
export function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(collectStrings);
  return [];
}

/** True for U+0000 to U+001F and U+007F to U+009F, which no font draws. */
function isControl(codePoint: number): boolean {
  return codePoint < BASIC_LATIN_FIRST || (codePoint >= 0x7f && codePoint <= 0x9f);
}

export function isDevanagari(codePoint: number): boolean {
  return codePoint >= DEVANAGARI_FIRST && codePoint <= DEVANAGARI_LAST;
}

/** The distinct code points of the texts, without control characters. */
export function codePointsOf(texts: readonly string[]): Set<number> {
  const found = new Set<number>();
  for (const text of texts) {
    for (const character of text) {
      const codePoint = character.codePointAt(0);
      if (codePoint !== undefined && !isControl(codePoint)) found.add(codePoint);
    }
  }
  return found;
}

/** Splits the code points of the texts into the two font lists. */
export function buildCodePointLists(texts: readonly string[]): CodePointLists {
  const latinSymbols = new Set<number>();
  for (let codePoint = BASIC_LATIN_FIRST; codePoint <= BASIC_LATIN_LAST; codePoint++) latinSymbols.add(codePoint);
  for (const codePoint of codePointsOf(texts)) {
    if (!isDevanagari(codePoint) && !SHAPING_EXTRAS.includes(codePoint)) latinSymbols.add(codePoint);
  }
  const devanagari = new Set<number>(SHAPING_EXTRAS);
  for (let codePoint = DEVANAGARI_FIRST; codePoint <= DEVANAGARI_LAST; codePoint++) devanagari.add(codePoint);
  return { latinSymbols: [...latinSymbols].sort((a, b) => a - b), devanagari: [...devanagari].sort((a, b) => a - b) };
}

/** `U+0041` form: at least four upper-case hexadecimal digits. */
export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** The reverse of `formatCodePoint`; null for any other text. */
export function parseCodePoint(text: string): number | null {
  const match = /^U\+([0-9A-F]{4,6})$/.exec(text);
  if (match === null) return null;
  const codePoint = Number.parseInt(match[1]!, 16);
  return codePoint <= 0x10ffff ? codePoint : null;
}

/** The text of a `--unicodes-file` for `pyftsubset`: one `U+XXXX` per line. */
export function formatUnicodesFile(codePoints: readonly number[]): string {
  return codePoints.map(formatCodePoint).join('\n') + '\n';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Every text the fonts must be able to draw: all string values of both Translation_Files, and the
 * names of the Sample_Designs in both languages. The last are already string values; they are
 * added by name as well so that they stay listed if the keys ever move out of the files.
 */
export function projectTexts(repoRoot: string): string[] {
  const readJson = (file: string): unknown => JSON.parse(readFileSync(path.join(repoRoot, 'src/ui/i18n', file), 'utf8'));
  const english = readJson('en.json');
  const hindi = readJson('hi.json');
  const designNames = [english, hindi].flatMap((dictionary) =>
    isRecord(dictionary) ? SAMPLE_DESIGN_NAME_KEYS.flatMap((key) => collectStrings(dictionary[key])) : [],
  );
  return [...collectStrings(english), ...collectStrings(hindi), ...designNames];
}

function run(): void {
  const outputDir = process.argv[2];
  if (outputDir === undefined) {
    console.error('usage: node scripts/fonts/codepoints.ts <output directory>');
    process.exit(1);
  }
  const repoRoot = path.resolve(import.meta.dirname, '../..');
  const lists = buildCodePointLists(projectTexts(repoRoot));
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'latin-symbols.txt'), formatUnicodesFile(lists.latinSymbols));
  writeFileSync(path.join(outputDir, 'devanagari.txt'), formatUnicodesFile(lists.devanagari));
  console.log(`latin-symbols.txt: ${lists.latinSymbols.length} code points; devanagari.txt: ${lists.devanagari.length} code points`);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) run();
