/**
 * Checks the built site in dist/ (run after `npm run build`):
 * - the gzipped entry chunk is under 200 KB (R16.1),
 * - dist/index.html has no URL that starts with `/` or `http` (R23.3, R13).
 * - a Scan-only marker string is absent from the entry chunk and present in another chunk (R16.10).
 * - the web app manifest and its icons are there, relative and the size they declare (R24.7).
 * - the inline theme script comes before the module script and the stylesheet link (R4.12).
 * - dist/sw.js carries a generated precache list that covers the built site with a versioned cache name (R24.2, R24.6).
 * - the four Font_Files are in that precache list (design-and-ux-pass R1.7, R1.12).
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fontPrecacheProblems } from './checks/fonts.ts';
import { parsePngInfo } from './checks/pngHeader.ts';
import { precacheProblems, readPrecacheBlock } from './checks/precache.ts';
import type { DistFile } from './checks/precache.ts';

export const ENTRY_CHUNK_LIMIT_BYTES = 200 * 1024;

/**
 * A string literal that only the reader (Scan chunk) contains: the invalid-image detail in
 * src/reader/readCard.ts. Strings survive minification; identifiers do not. If that message
 * changes, update this marker.
 */
export const SCAN_ONLY_MARKER = 'width and height must be positive integers';

export const MANIFEST_FILE = 'manifest.webmanifest';

export type ManifestIcon = { src: string; sizes: string; type?: string };
export type WebManifest = {
  name?: string;
  short_name?: string;
  start_url?: string;
  display?: string;
  theme_color?: string;
  background_color?: string;
  icons?: ManifestIcon[];
};

export type BundleReport = {
  entryChunk: string;
  gzippedBytes: number;
  /** Other .js chunks in dist/assets that contain SCAN_ONLY_MARKER, with their gzipped size. */
  scanChunks: Array<{ file: string; gzippedBytes: number }>;
  /** Every .js file in dist/assets, sorted by name, with its gzipped size. */
  chunks: Array<{ file: string; gzippedBytes: number }>;
  absoluteUrls: string[];
  /** The cache name and number of entries of the generated precache list, when dist/sw.js has one. */
  precache: { cacheName: string; entries: number } | null;
  /** The icon files the manifest names, with the size each PNG really is. */
  icons: Array<{ src: string; declared: string; actual: string }>;
  problems: string[];
};

/** Values of src and href attributes that start with `/` or `http`. */
export function findAbsoluteUrls(html: string): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi)) {
    const value = match[2]!.trim();
    if (value.startsWith('/') || /^https?:/i.test(value) || value.startsWith('//')) urls.push(value);
  }
  return urls;
}

/** The module script of index.html: the entry chunk, relative to dist/. */
export function findEntryChunk(html: string): string | null {
  const match = /<script\b[^>]*\btype\s*=\s*["']module["'][^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(html)
    ?? /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*\btype\s*=\s*["']module["']/i.exec(html);
  return match ? match[1]! : null;
}

/**
 * The inline theme script must come first in dist/index.html: before the module script and before the
 * stylesheet link, so `data-theme` is set before the first paint (R4.12). Returns a list of problems.
 */
export function themeScriptProblems(html: string): string[] {
  let themeAt = -1;
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attributes = match[1]!;
    if (/\bsrc\s*=/i.test(attributes) || /\btype\s*=\s*["']module["']/i.test(attributes)) continue;
    if (match[2]!.includes('naqsha.theme') && match[2]!.includes('data-theme')) {
      themeAt = match.index!;
      break;
    }
  }
  if (themeAt < 0) return ['dist/index.html has no inline classic theme script'];
  const problems: string[] = [];
  const moduleAt = html.search(/<script\b[^>]*\btype\s*=\s*["']module["']/i);
  if (moduleAt < 0) problems.push('dist/index.html has no module script, so the theme script cannot be checked against it');
  else if (themeAt > moduleAt) problems.push('the inline theme script in dist/index.html comes after the module script');
  const sheetAt = html.search(/<link\b[^>]*\brel\s*=\s*["']stylesheet["']/i);
  if (sheetAt < 0) problems.push('dist/index.html has no stylesheet link, so the theme script cannot be checked against it');
  else if (themeAt > sheetAt) problems.push('the inline theme script in dist/index.html comes after the stylesheet link');
  return problems;
}

export function gzippedSize(bytes: Uint8Array): number {
  return gzipSync(bytes, { level: 9 }).length;
}

/** One output line for a JavaScript file of dist/assets: its file name and gzipped size in bytes (R15.1). */
export function formatChunkLine(file: string, gzippedBytes: number): string {
  return `chunk: assets/${file}, ${gzippedBytes} bytes gzipped`;
}

/** Every file of dist/, as a path relative to it with `/` separators. */
export function listFiles(dir: string, prefix = ''): string[] {
  return readdirSync(path.join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    return entry.isDirectory() ? listFiles(dir, relative) : [relative];
  });
}

/** What index.html must say for the app to be installable, as a list of problems (empty when all is well). */
export function manifestLinkProblems(html: string): string[] {
  const problems: string[] = [];
  const link = /<link\b[^>]*\brel\s*=\s*["']manifest["'][^>]*>/i.exec(html);
  if (link === null) return ['dist/index.html has no <link rel="manifest">'];
  const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(link[0]);
  if (href === null) problems.push('the manifest link in dist/index.html has no href');
  else if (href[1] !== `./${MANIFEST_FILE}`) problems.push(`the manifest link points at ${href[1]}, expected ./${MANIFEST_FILE}`);
  return problems;
}

/** The manifest fields and icon entries the app needs, as a list of problems. */
export function manifestProblems(manifest: WebManifest): string[] {
  const problems: string[] = [];
  for (const field of ['name', 'short_name', 'display', 'theme_color', 'background_color'] as const) {
    if (typeof manifest[field] !== 'string' || manifest[field] === '') problems.push(`${MANIFEST_FILE} has no ${field}`);
  }
  if (manifest.start_url !== './') problems.push(`${MANIFEST_FILE} start_url is ${JSON.stringify(manifest.start_url)}, expected "./"`);
  const icons = manifest.icons ?? [];
  for (const icon of icons) {
    if (!icon.src.startsWith('./')) problems.push(`${MANIFEST_FILE} icon ${icon.src} is not a relative path`);
  }
  for (const size of ['192x192', '512x512']) {
    if (!icons.some((icon) => icon.sizes === size)) problems.push(`${MANIFEST_FILE} has no ${size} icon`);
  }
  return problems;
}

export function checkBundle(distDir: string): BundleReport {
  const problems: string[] = [];
  const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const absoluteUrls = findAbsoluteUrls(html);
  if (absoluteUrls.length > 0) problems.push(`dist/index.html has absolute URLs: ${absoluteUrls.join(', ')}`);

  problems.push(...themeScriptProblems(html));

  const entryChunk = findEntryChunk(html);
  let gzippedBytes = 0;
  if (entryChunk === null) {
    problems.push('dist/index.html has no module script');
  } else {
    gzippedBytes = gzippedSize(readFileSync(path.join(distDir, entryChunk)));
    if (gzippedBytes >= ENTRY_CHUNK_LIMIT_BYTES) {
      problems.push(`entry chunk ${entryChunk} is ${gzippedBytes} bytes gzipped, limit is ${ENTRY_CHUNK_LIMIT_BYTES}`);
    }
  }

  const scanChunks: BundleReport['scanChunks'] = [];
  const assetsDir = path.join(distDir, 'assets');
  const entryName = entryChunk === null ? '' : path.basename(entryChunk);
  const chunks: BundleReport['chunks'] = readdirSync(assetsDir)
    .filter((name) => name.endsWith('.js'))
    .sort()
    .map((file) => ({ file, gzippedBytes: gzippedSize(readFileSync(path.join(assetsDir, file))) }));
  if (entryChunk !== null) {
    if (readFileSync(path.join(distDir, entryChunk), 'utf8').includes(SCAN_ONLY_MARKER)) {
      problems.push(`entry chunk ${entryChunk} contains the Scan-only marker "${SCAN_ONLY_MARKER}"`);
    }
    for (const file of readdirSync(assetsDir).filter((name) => name.endsWith('.js') && name !== entryName).sort()) {
      const bytes = readFileSync(path.join(assetsDir, file));
      if (bytes.toString('utf8').includes(SCAN_ONLY_MARKER)) scanChunks.push({ file, gzippedBytes: gzippedSize(bytes) });
    }
    if (scanChunks.length === 0) {
      problems.push(`no separate chunk in dist/assets contains the Scan-only marker "${SCAN_ONLY_MARKER}"`);
    }
  }

  // The manifest and its icons (R24.7).
  problems.push(...manifestLinkProblems(html));
  const files = listFiles(distDir);
  const icons: BundleReport['icons'] = [];
  if (!files.includes(MANIFEST_FILE)) {
    problems.push(`dist/${MANIFEST_FILE} is missing`);
  } else {
    let manifest: WebManifest | null = null;
    try {
      manifest = JSON.parse(readFileSync(path.join(distDir, MANIFEST_FILE), 'utf8')) as WebManifest;
    } catch (error) {
      problems.push(`dist/${MANIFEST_FILE} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (manifest !== null) {
      problems.push(...manifestProblems(manifest));
      for (const icon of manifest.icons ?? []) {
        const relative = icon.src.replace(/^\.\//, '');
        if (!files.includes(relative)) {
          problems.push(`the icon dist/${relative} named by the manifest is missing`);
          continue;
        }
        const parsed = parsePngInfo(readFileSync(path.join(distDir, relative)));
        if (!parsed.ok) {
          problems.push(`the icon dist/${relative} is not a PNG: ${parsed.reason}`);
          continue;
        }
        const actual = `${parsed.info.width}x${parsed.info.height}`;
        icons.push({ src: icon.src, declared: icon.sizes, actual });
        if (actual !== icon.sizes) problems.push(`the icon dist/${relative} is ${actual}, but the manifest declares ${icon.sizes}`);
      }
    }
  }

  // The generated precache list (R24.2, R24.6).
  let precache: BundleReport['precache'] = null;
  if (!files.includes('sw.js')) {
    problems.push('dist/sw.js is missing, so the built site has no service worker');
  } else {
    const block = readPrecacheBlock(readFileSync(path.join(distDir, 'sw.js'), 'utf8'));
    if (block === null) {
      problems.push('dist/sw.js has no readable precache block: run node scripts/build_precache.ts after the build');
    } else if (!/^naqsha-v\d+-[0-9a-f]{12}$/.test(block.cacheName)) {
      problems.push(`dist/sw.js has the cache name "${block.cacheName}", which is not a generated versioned name`);
    } else {
      precache = { cacheName: block.cacheName, entries: block.entries.length };
      const distFiles: DistFile[] = files.map((file) => ({ path: file, contentHash: '' }));
      problems.push(...precacheProblems(block.entries, distFiles));
      problems.push(...fontPrecacheProblems(block.entries));
    }
  }
  return { entryChunk: entryChunk ?? '', gzippedBytes, scanChunks, chunks, absoluteUrls, precache, icons, problems };
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  const distDir = path.resolve(import.meta.dirname, '../dist');
  const report = checkBundle(distDir);
  console.log(`entry chunk: ${report.entryChunk}, ${report.gzippedBytes} bytes gzipped (limit ${ENTRY_CHUNK_LIMIT_BYTES})`);
  for (const chunk of report.chunks) console.log(formatChunkLine(chunk.file, chunk.gzippedBytes));
  for (const chunk of report.scanChunks) {
    console.log(`scan chunk: assets/${chunk.file}, ${chunk.gzippedBytes} bytes gzipped`);
  }
  if (report.precache !== null) {
    console.log(`precache: ${report.precache.entries} entries in cache ${report.precache.cacheName}`);
  }
  for (const icon of report.icons) console.log(`icon: ${icon.src}, ${icon.actual}`);
  if (report.problems.length > 0) {
    for (const problem of report.problems) console.error(`FAIL: ${problem}`);
    process.exit(1);
  }
  console.log('bundle check passed');
}
