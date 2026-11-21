/**
 * Pure check of the Font_Files in the Precache (design-and-ux-pass, Requirements 1.1, 1.7, 1.8 and 1.12).
 * No I/O here: `scripts/check_bundle.ts` reads the precache list of `dist/sw.js` and passes its entries in.
 */

/**
 * The four Font_Files, as precache entries: the same relative path the `src` of each `@font-face` rule
 * resolves to in the Built_Site (Rozha One 400, Hind 400, Hind 700, IBM Plex Mono 400).
 */
export const FONT_FILES: readonly string[] = [
  './fonts/RozhaOne-Regular.woff2',
  './fonts/Hind-Regular.woff2',
  './fonts/Hind-Bold.woff2',
  './fonts/IBMPlexMono-Regular.woff2',
];

/** One line for each Font_File that is not in the precache list, naming the file. Empty when all four are listed. */
export function fontPrecacheProblems(entries: readonly string[]): string[] {
  const listed = new Set(entries);
  return FONT_FILES.filter((file) => !listed.has(file)).map((file) => `the precache list has no Font_File ${file}`);
}
