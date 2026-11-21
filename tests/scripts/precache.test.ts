import fc from 'fast-check';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildPrecache, listDistFiles } from '../../scripts/build_precache.ts';
import {
  injectPrecacheBlock,
  NOT_PRECACHED,
  precacheCacheName,
  precacheEntries,
  precacheProblems,
  readPrecacheBlock,
  renderPrecacheBlock,
  START_PAGE_ENTRY,
} from '../../scripts/checks/precache.ts';
import type { DistFile } from '../../scripts/checks/precache.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const WORKER_SOURCE = readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');

/** The files every built site has, so a generated listing is one a host could really serve. */
const CORE_FILES = [
  'index.html',
  'manifest.webmanifest',
  'favicon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'profiles/demo-12x16.json',
  'sw.js',
] as const;

const hashedName = fc
  .tuple(fc.constantFrom('index', 'ScanScreen', 'download', 'style'), fc.stringMatching(/^[A-Za-z0-9_-]{8}$/), fc.constantFrom('js', 'css'))
  .map(([name, hash, extension]) => `assets/${name}-${hash}.${extension}`);

/** A listing of a built site: the core files, at least one hashed chunk and one style sheet, plus extras. */
const listingArbitrary = fc
  .tuple(fc.stringMatching(/^[A-Za-z0-9_-]{8}$/), fc.stringMatching(/^[A-Za-z0-9_-]{8}$/), fc.uniqueArray(hashedName, { maxLength: 6 }))
  .map(([entryHash, styleHash, extras]) => {
    const names = new Set<string>([...CORE_FILES, `assets/index-${entryHash}.js`, `assets/index-${styleHash}.css`, ...extras]);
    return [...names].sort();
  });

let distRoot = '';

/** Writes a built site of that listing to disk, with the real worker source, and returns its directory. */
function writeDist(listing: readonly string[], contents: (file: string) => string): string {
  const dir = mkdtempSync(path.join(distRoot, 'dist-'));
  for (const file of listing) {
    const full = path.join(dir, file);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, file === 'sw.js' ? WORKER_SOURCE : contents(file));
  }
  return dir;
}

describe('precache list built from dist/', () => {
  beforeAll(() => {
    distRoot = mkdtempSync(path.join(os.tmpdir(), 'naqsha-precache-'));
  });

  afterAll(() => {
    if (distRoot !== '') rmSync(distRoot, { recursive: true, force: true });
  });

  it('R24.6 the generated precache list is exactly the files of the built site, each relative to the worker scope', () => {
    // Feature: app, Property 43: The precache list equals the asset list of dist/
    fc.assert(
      fc.property(listingArbitrary, fc.string({ minLength: 1, maxLength: 8 }), (listing, salt) => {
        const dir = writeDist(listing, (file) => `${file}:${salt}`);
        try {
          const result = buildPrecache(dir);
          expect(result.problems).toEqual([]);
          const expected = [START_PAGE_ENTRY, ...listing.filter((file) => !NOT_PRECACHED.includes(file)).map((file) => `./${file}`)];
          expect(result.entries).toEqual(expected);
          // No absolute path, and every built file but the worker is there.
          for (const entry of result.entries) {
            expect(entry.startsWith('./')).toBe(true);
            expect(/^https?:|^\/\/|^\//.test(entry)).toBe(false);
          }
          for (const file of listing) {
            expect(result.entries.includes(`./${file}`), file).toBe(!NOT_PRECACHED.includes(file));
          }
          expect(result.cacheName).toMatch(/^naqsha-v1-[0-9a-f]{12}$/);
          // The worker written to the built site carries exactly that list and cache name.
          const written = readPrecacheBlock(readFileSync(path.join(dir, 'sw.js'), 'utf8'));
          expect(written).toEqual({ cacheName: result.cacheName, entries: result.entries });
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }),
      { numRuns: 200, seed: 2404 },
    );
  });

  it('R24.6 a changed file gives a new cache name, so the old cache is dropped and the worker differs', () => {
    const listing = [...CORE_FILES, 'assets/index-AAAAAAAA.js', 'assets/index-AAAAAAAA.css'];
    const first = writeDist(listing, (file) => `${file}:one`);
    const second = writeDist(listing, (file) => (file === 'profiles/demo-12x16.json' ? `${file}:two` : `${file}:one`));
    const third = writeDist(listing, (file) => `${file}:one`);
    try {
      const a = buildPrecache(first);
      const b = buildPrecache(second);
      const c = buildPrecache(third);
      expect(a.problems).toEqual([]);
      expect(a.entries).toEqual(b.entries);
      // Only the profile's bytes changed, and no file name with them; the cache name still differs.
      expect(a.cacheName).not.toBe(b.cacheName);
      expect(a.cacheName).toBe(c.cacheName);
      expect(readFileSync(path.join(first, 'sw.js'), 'utf8')).not.toBe(readFileSync(path.join(second, 'sw.js'), 'utf8'));
    } finally {
      for (const dir of [first, second, third]) rmSync(dir, { recursive: true, force: true });
    }
  });

  it('R24.2 a built site without the lazy Scan chunk, the profile, the manifest or an icon is reported', () => {
    const files = (paths: readonly string[]): DistFile[] => paths.map((file) => ({ path: file, contentHash: 'x' }));
    const full = [...CORE_FILES, 'assets/index-AAAAAAAA.js', 'assets/index-AAAAAAAA.css'];
    expect(precacheProblems(precacheEntries(files(full)), files(full))).toEqual([]);
    for (const missing of ['manifest.webmanifest', 'icons/icon-192.png', 'profiles/demo-12x16.json', 'index.html']) {
      const listing = full.filter((file) => file !== missing && !(missing === 'icons/icon-192.png' && file === 'icons/icon-512.png'));
      const problems = precacheProblems(precacheEntries(files(listing)), files(listing));
      expect(problems.length, `${missing}: ${problems.join('; ')}`).toBeGreaterThan(0);
    }
    // An entry that is not a file of the built site, and one that is absolute, are both reported.
    expect(precacheProblems([...precacheEntries(files(full)), './assets/gone.js'], files(full))).toEqual([
      'precache entry "./assets/gone.js" is not a file of the built site',
    ]);
    expect(precacheProblems(['/assets/index.js', ...precacheEntries(files(full))], files(full))).toEqual([
      'precache entry "/assets/index.js" is not relative to the worker scope',
      'precache entry "/assets/index.js" is an absolute URL',
      'precache entry "/assets/index.js" is not a file of the built site',
    ]);
  });

  it('R24.6 the block round-trips, and a source without markers is left alone', () => {
    const entries = ['./', './index.html', './assets/index-abc.js'];
    const block = renderPrecacheBlock('naqsha-v1-0123456789ab', entries);
    expect(readPrecacheBlock(block)).toEqual({ cacheName: 'naqsha-v1-0123456789ab', entries });
    const injected = injectPrecacheBlock(WORKER_SOURCE, 'naqsha-v1-0123456789ab', entries);
    expect(injected).not.toBeNull();
    expect(readPrecacheBlock(injected ?? '')).toEqual({ cacheName: 'naqsha-v1-0123456789ab', entries });
    // Injecting twice gives the same file, so the step can be run again.
    expect(injectPrecacheBlock(injected ?? '', 'naqsha-v1-0123456789ab', entries)).toBe(injected);
    expect(injectPrecacheBlock('const nothing = 1;', 'naqsha-v1-0123456789ab', entries)).toBeNull();
    expect(readPrecacheBlock('const nothing = 1;')).toBeNull();
  });

  it('R24.6 a built site with no worker is reported and nothing is written', () => {
    const listing = [...CORE_FILES.filter((file) => file !== 'sw.js'), 'assets/index-AAAAAAAA.js', 'assets/index-AAAAAAAA.css'];
    const dir = writeDist(listing, (file) => file);
    try {
      expect(buildPrecache(dir).problems).toEqual(['the built site has no sw.js']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('the repository worker keeps its placeholders, so only the built copy carries hashed names', () => {
    const block = readPrecacheBlock(WORKER_SOURCE);
    expect(block).not.toBeNull();
    expect(block?.cacheName).toBe('naqsha-v1-placeholder');
    expect(block?.entries).toEqual(['./', './index.html']);
  });

  it('listDistFiles walks folders and hashes contents', () => {
    const listing = ['index.html', 'assets/index-AAAAAAAA.js', 'profiles/demo-12x16.json'];
    const dir = writeDist(listing, (file) => `${file}:bytes`);
    try {
      const files = listDistFiles(dir);
      expect(files.map((file) => file.path).sort()).toEqual([...listing].sort());
      expect(new Set(files.map((file) => file.contentHash)).size).toBe(listing.length);
      expect(precacheCacheName(files)).toBe(precacheCacheName([...files].reverse()));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

/** The Code_View_Marker: a string literal only the Code view chunk holds (R9.9). */
const CODE_VIEW_MARKER = 'naqsha-code-view-listing';

/** Every file under a directory, as a path relative to it with `/` separators. Own walk, not the script's. */
function filesUnder(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
    .sort();
}

/** One line for each expected file (relative to dist) that no precache entry names. Each line names the file. */
function missingFromPrecache(expectedFiles: readonly string[], entries: readonly string[], what: string): string[] {
  const listed = new Set(entries);
  return expectedFiles.filter((file) => !listed.has(`./${file}`)).map((file) => `${what} ${file} is not named by any entry of the precache list in dist/sw.js`);
}

/** The built manifest's icon files, each `src` resolved against dist and given relative to it. */
function manifestIconFiles(distDir: string): string[] {
  const manifest = JSON.parse(readFileSync(path.join(distDir, 'manifest.webmanifest'), 'utf8')) as { icons?: Array<{ src: string }> };
  return (manifest.icons ?? []).map((icon) => path.relative(distDir, path.resolve(distDir, icon.src)).split(path.sep).join('/'));
}

describe('precache list of the built site in dist/sw.js', () => {
  const distDir = path.join(ROOT, 'dist');
  let entries: string[] = [];
  let files: string[] = [];

  beforeAll(() => {
    // These tests read the real build, so run `npm run build` first.
    if (!existsSync(path.join(distDir, 'sw.js'))) throw new Error('dist/sw.js does not exist: run `npm run build` before this test');
    const block = readPrecacheBlock(readFileSync(path.join(distDir, 'sw.js'), 'utf8'));
    if (block === null) throw new Error('dist/sw.js has no generated precache block: run `npm run build` before this test');
    entries = block.entries;
    files = filesUnder(distDir);
  });

  it('R9.6 an entry of the precache list names the Code view chunk, the .js file of dist/assets holding the Code_View_Marker', () => {
    const chunks = filesUnder(path.join(distDir, 'assets')).filter(
      (file) => file.endsWith('.js') && readFileSync(path.join(distDir, 'assets', file), 'utf8').includes(CODE_VIEW_MARKER),
    );
    expect(chunks.length, `no .js file of dist/assets contains the Code_View_Marker "${CODE_VIEW_MARKER}", so there is no Code view chunk`).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(entries, `no entry of the precache list in dist/sw.js names the Code view chunk ./assets/${chunk}`).toContain(`./assets/${chunk}`);
    }
  });

  it('R9.5 the precache list omits no file of the built site and names no file that is not one', () => {
    // The worker serves itself and is never an entry; the start page entry "./" is the scope root.
    const expectedFiles = files.filter((file) => file !== 'sw.js');
    expect(missingFromPrecache(expectedFiles, entries, 'built file')).toEqual([]);
    const known = new Set(expectedFiles.map((file) => `./${file}`));
    const extra = entries.filter((entry) => entry !== './' && !known.has(entry));
    expect(extra, `precache entries that are not a file of dist/: ${extra.join(', ')}`).toEqual([]);
    expect(new Set(entries).size, 'the precache list names an entry twice').toBe(entries.length);
  });

  it('every font file of dist/fonts is named by an entry of the precache list', () => {
    const fonts = files.filter((file) => file.startsWith('fonts/'));
    expect(fonts.filter((file) => file.endsWith('.woff2')).length, 'dist/fonts holds no .woff2 file').toBeGreaterThan(0);
    expect(missingFromPrecache(fonts, entries, 'font file')).toEqual([]);
  });

  it('the manifest and every icon it names, resolved against dist, are files of dist named by the precache list', () => {
    const icons = manifestIconFiles(distDir);
    expect(icons.length, 'dist/manifest.webmanifest names no icon').toBeGreaterThan(0);
    for (const icon of icons) expect(files, `icon ${icon} named by the manifest is not a file of dist/`).toContain(icon);
    expect(missingFromPrecache(['manifest.webmanifest', ...icons], entries, 'manifest file')).toEqual([]);
  });

  it('a missing file is named in the failure message', () => {
    const fake = ['./', './index.html', './fonts/a.woff2'];
    expect(missingFromPrecache(['index.html', 'fonts/a.woff2', 'fonts/b.woff2'], fake, 'font file')).toEqual([
      'font file fonts/b.woff2 is not named by any entry of the precache list in dist/sw.js',
    ]);
    expect(missingFromPrecache([], fake, 'font file')).toEqual([]);
  });
});
