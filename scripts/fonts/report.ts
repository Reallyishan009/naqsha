/**
 * Reports on the subset fonts (design-and-ux-pass, Requirements 1.5, 1.6, 2.3 and 2.5).
 *
 * Prints, for each Font_File, its size in bytes before subsetting (the source .ttf) and after
 * (the woff2), the sum after, and the code points the source font lacks. It writes the last to
 * `scripts/fonts/missing-glyphs.json`, which the font test reads: a code point listed there is
 * allowed to be absent from the Font_File, any other required code point is not.
 *
 * The exit code is 1 when a required code point that the source font has is missing from the
 * woff2, because that means the subsetting dropped it.
 *
 * Dev only. Run by `subset.sh`, or on its own after it:
 *   node scripts/fonts/report.ts
 */
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildCodePointLists, formatCodePoint, projectTexts } from './codepoints.ts';
import type { CodePointLists } from './codepoints.ts';
import { sfntCodePoints, woff2CodePoints } from './woff2Cmap.ts';

export type FontEntry = {
  family: string;
  weight: number;
  /** The directory of the font in google/fonts under `ofl/`. */
  sourceDirectory: string;
  sourceFile: string;
  outputFile: string;
  licenceFile: string;
  /** True for the fonts that also hold the Devanagari list. */
  hasDevanagari: boolean;
};

/** The six Font_Files and the four licence texts (design-and-ux-pass Requirements 1.1 and 2.3; Newsreader added by second-pass-run1 task 3.1). */
export const FONTS: readonly FontEntry[] = [
  {
    family: 'Rozha One',
    weight: 400,
    sourceDirectory: 'rozhaone',
    sourceFile: 'RozhaOne-Regular.ttf',
    outputFile: 'RozhaOne-Regular.woff2',
    licenceFile: 'RozhaOne-OFL.txt',
    hasDevanagari: true,
  },
  {
    family: 'Hind',
    weight: 400,
    sourceDirectory: 'hind',
    sourceFile: 'Hind-Regular.ttf',
    outputFile: 'Hind-Regular.woff2',
    licenceFile: 'Hind-OFL.txt',
    hasDevanagari: true,
  },
  {
    family: 'Hind',
    weight: 700,
    sourceDirectory: 'hind',
    sourceFile: 'Hind-Bold.ttf',
    outputFile: 'Hind-Bold.woff2',
    licenceFile: 'Hind-OFL.txt',
    hasDevanagari: true,
  },
  {
    family: 'IBM Plex Mono',
    weight: 400,
    sourceDirectory: 'ibmplexmono',
    sourceFile: 'IBMPlexMono-Regular.ttf',
    outputFile: 'IBMPlexMono-Regular.woff2',
    licenceFile: 'IBMPlexMono-OFL.txt',
    hasDevanagari: false,
  },
  {
    family: 'Newsreader',
    weight: 400,
    sourceDirectory: 'newsreader',
    sourceFile: 'Newsreader-VF.ttf',
    outputFile: 'Newsreader-Regular.woff2',
    licenceFile: 'Newsreader-OFL.txt',
    hasDevanagari: false,
  },
  {
    family: 'Newsreader (italic)',
    weight: 400,
    sourceDirectory: 'newsreader',
    sourceFile: 'Newsreader-Italic-VF.ttf',
    outputFile: 'Newsreader-Italic.woff2',
    licenceFile: 'Newsreader-OFL.txt',
    hasDevanagari: false,
  },
];

export type ReportEntry = {
  font: FontEntry;
  bytesBefore: number;
  bytesAfter: number;
  /** Required code points the source font has no glyph for. Sorted. */
  missing: number[];
  /** Required code points the source font has but the woff2 lost. Sorted. Expected empty. */
  dropped: number[];
};

/** The code points one font must hold, sorted. */
export function requiredCodePoints(font: FontEntry, lists: CodePointLists): number[] {
  const required = font.hasDevanagari ? [...lists.latinSymbols, ...lists.devanagari] : lists.latinSymbols;
  return [...new Set(required)].sort((a, b) => a - b);
}

/** The members of `required` that `covered` lacks, sorted. */
export function missingCodePoints(required: readonly number[], covered: ReadonlySet<number>): number[] {
  return required.filter((codePoint) => !covered.has(codePoint)).sort((a, b) => a - b);
}

export function totalBytesAfter(entries: readonly ReportEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.bytesAfter, 0);
}

function describeCodePoint(codePoint: number): string {
  return `${formatCodePoint(codePoint)} ${String.fromCodePoint(codePoint)}`;
}

/** The plain text report: the figures that go into the Font_Weight_Report, and the missing code points. */
export function formatReport(entries: readonly ReportEntry[]): string {
  const lines = ['file | bytes before | bytes after'];
  for (const entry of entries) lines.push(`${entry.font.outputFile} | ${entry.bytesBefore} | ${entry.bytesAfter}`);
  lines.push(`sum after subsetting | | ${totalBytesAfter(entries)}`);
  lines.push('');
  for (const entry of entries) {
    const missing = entry.missing.length === 0 ? 'none' : entry.missing.map(describeCodePoint).join(', ');
    lines.push(`${entry.font.outputFile}: source font lacks ${missing}`);
    if (entry.dropped.length > 0) lines.push(`${entry.font.outputFile}: LOST BY SUBSETTING ${entry.dropped.map(describeCodePoint).join(', ')}`);
  }
  return lines.join('\n') + '\n';
}

/** The text of `missing-glyphs.json`: for each Font_File, the code points its source font lacks. */
export function missingGlyphsJson(entries: readonly ReportEntry[]): string {
  const byFile: Record<string, string[]> = {};
  for (const entry of entries) byFile[entry.font.outputFile] = entry.missing.map(formatCodePoint);
  return JSON.stringify(byFile, null, 2) + '\n';
}

function readCoverage(file: string, read: typeof sfntCodePoints): ReadonlySet<number> {
  const result = read(readFileSync(file));
  if (!result.ok) throw new Error(`${file}: ${result.reason}`);
  return result.codePoints;
}

function run(): void {
  const repoRoot = path.resolve(import.meta.dirname, '../..');
  const sourceDir = path.join(import.meta.dirname, 'source');
  const outputDir = path.join(repoRoot, 'public/fonts');
  const lists = buildCodePointLists(projectTexts(repoRoot));
  const entries: ReportEntry[] = FONTS.map((font) => {
    const sourceFile = path.join(sourceDir, font.sourceFile);
    const outputFile = path.join(outputDir, font.outputFile);
    const required = requiredCodePoints(font, lists);
    const missing = missingCodePoints(required, readCoverage(sourceFile, sfntCodePoints));
    const lost = missingCodePoints(required, readCoverage(outputFile, woff2CodePoints));
    return {
      font,
      bytesBefore: statSync(sourceFile).size,
      bytesAfter: statSync(outputFile).size,
      missing,
      dropped: lost.filter((codePoint) => !missing.includes(codePoint)),
    };
  });
  writeFileSync(path.join(import.meta.dirname, 'missing-glyphs.json'), missingGlyphsJson(entries));
  process.stdout.write(formatReport(entries));
  if (entries.some((entry) => entry.dropped.length > 0)) process.exit(1);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) run();
