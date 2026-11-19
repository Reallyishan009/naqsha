/**
 * Pure parts of the build-time precache list (R24.2, R24.6, R24.8): which files of `dist/` the service worker
 * precaches, the versioned cache name, and the block of `sw.js` that carries them.
 * No I/O here: `scripts/build_precache.ts` reads `dist/` and `scripts/check_bundle.ts` checks the result.
 */
import { createHash } from 'node:crypto';

/** One built file: its path relative to `dist/` with `/` separators, and a hash of its bytes. */
export type DistFile = { path: string; contentHash: string };

/** Bumped by hand when the worker's own rules change, so a cache written by an older worker is dropped. */
export const PRECACHE_FORMAT_VERSION = 1;

export const PRECACHE_START = '/* naqsha:precache-start */';
export const PRECACHE_END = '/* naqsha:precache-end */';

/** The worker serves itself; it is never a precache entry. */
export const NOT_PRECACHED = ['sw.js'];

/** The start page, which a navigation to the scope root asks for. The file list adds `./index.html` as well. */
export const START_PAGE_ENTRY = './';

/**
 * The precache list of a `dist/` listing: the start page, then every built file except the worker, each as a
 * path relative to the worker's scope. Sorted, so the same `dist/` always gives the same list.
 */
export function precacheEntries(files: readonly DistFile[]): string[] {
  const paths = files
    .map((file) => file.path)
    .filter((path) => !NOT_PRECACHED.includes(path))
    .sort()
    .map((path) => `./${path}`);
  return [START_PAGE_ENTRY, ...paths];
}

/**
 * The cache name: the format version and a hash of every precached file's path and content. A changed file
 * gives a new name, so `activate` drops the old cache and the worker's own bytes differ from the last build.
 */
export function precacheCacheName(files: readonly DistFile[]): string {
  const hash = createHash('sha256');
  hash.update(`v${PRECACHE_FORMAT_VERSION}`);
  for (const file of [...files].filter((file) => !NOT_PRECACHED.includes(file.path)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
    hash.update(`\n${file.path}:${file.contentHash}`);
  }
  return `naqsha-v${PRECACHE_FORMAT_VERSION}-${hash.digest('hex').slice(0, 12)}`;
}

/** The two constants the worker reads, as JavaScript between the markers. */
export function renderPrecacheBlock(cacheName: string, entries: readonly string[]): string {
  const list = entries.map((entry) => `  ${JSON.stringify(entry)},`).join('\n');
  return [PRECACHE_START, `const CACHE_NAME = ${JSON.stringify(cacheName)};`, 'const PRECACHE = [', list, '];', PRECACHE_END].join('\n');
}

/** The cache name and entries a worker source carries, or null when it has no complete block. */
export function readPrecacheBlock(source: string): { cacheName: string; entries: string[] } | null {
  const start = source.indexOf(PRECACHE_START);
  const end = source.indexOf(PRECACHE_END);
  if (start === -1 || end === -1 || end < start) return null;
  const block = source.slice(start + PRECACHE_START.length, end);
  const name = /const CACHE_NAME = ("(?:[^"\\]|\\.)*");/.exec(block);
  const list = /const PRECACHE = (\[[^\]]*\]);/.exec(block);
  if (name === null || list === null) return null;
  try {
    const cacheName = JSON.parse(name[1]!) as unknown;
    const entries = JSON.parse(list[1]!.replace(/,(\s*\])/, '$1')) as unknown;
    if (typeof cacheName !== 'string' || !Array.isArray(entries) || entries.some((entry) => typeof entry !== 'string')) return null;
    return { cacheName, entries: entries as string[] };
  } catch {
    return null;
  }
}

/** The worker source with its precache block replaced, or null when the source has no block to replace. */
export function injectPrecacheBlock(source: string, cacheName: string, entries: readonly string[]): string | null {
  const start = source.indexOf(PRECACHE_START);
  const end = source.indexOf(PRECACHE_END);
  if (start === -1 || end === -1 || end < start) return null;
  return `${source.slice(0, start)}${renderPrecacheBlock(cacheName, entries)}${source.slice(end + PRECACHE_END.length)}`;
}

/** What a precache list must hold for the app to work offline, each with the file name pattern that proves it. */
export const REQUIRED_PRECACHE = [
  { what: 'the start page', test: (entry: string) => entry === START_PAGE_ENTRY },
  { what: 'index.html', test: (entry: string) => entry === './index.html' },
  { what: 'a JavaScript chunk', test: (entry: string) => /^\.\/assets\/.+\.js$/.test(entry) },
  { what: 'a style sheet', test: (entry: string) => /\.css$/.test(entry) },
  { what: 'the Card_Profile JSON', test: (entry: string) => /^\.\/profiles\/.+\.json$/.test(entry) },
  { what: 'the web app manifest', test: (entry: string) => entry === './manifest.webmanifest' },
  { what: 'an icon', test: (entry: string) => /^\.\/icons\/.+\.png$/.test(entry) },
] as const;

/**
 * Everything wrong with a precache list, as one line each: an entry that is not relative to the scope, a built
 * file that is missing from the list, an entry that is not a built file, or a missing required kind of file.
 */
export function precacheProblems(entries: readonly string[], files: readonly DistFile[]): string[] {
  const problems: string[] = [];
  for (const entry of entries) {
    if (entry === START_PAGE_ENTRY) continue;
    if (!entry.startsWith('./')) problems.push(`precache entry "${entry}" is not relative to the worker scope`);
    if (/^https?:/i.test(entry) || entry.startsWith('/') || entry.startsWith('//')) problems.push(`precache entry "${entry}" is an absolute URL`);
  }
  const listed = new Set(entries);
  for (const file of files) {
    if (NOT_PRECACHED.includes(file.path)) continue;
    if (!listed.has(`./${file.path}`)) problems.push(`built file ${file.path} is not in the precache list`);
  }
  const built = new Set(files.map((file) => `./${file.path}`));
  for (const entry of entries) {
    if (entry === START_PAGE_ENTRY) continue;
    if (!built.has(entry)) problems.push(`precache entry "${entry}" is not a file of the built site`);
  }
  for (const required of REQUIRED_PRECACHE) {
    if (!entries.some((entry) => required.test(entry))) problems.push(`the precache list has no ${required.what}`);
  }
  return problems;
}
