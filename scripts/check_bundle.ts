/**
 * Checks the built site in dist/ (run after `npm run build`):
 * - the gzipped entry chunk is under 200 KB (R16.1),
 * - dist/index.html has no URL that starts with `/` or `http` (R23.3, R13).
 * Phase 3 adds the Scan-only marker check.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

export const ENTRY_CHUNK_LIMIT_BYTES = 200 * 1024;

export type BundleReport = {
  entryChunk: string;
  gzippedBytes: number;
  absoluteUrls: string[];
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

export function gzippedSize(bytes: Uint8Array): number {
  return gzipSync(bytes, { level: 9 }).length;
}

export function checkBundle(distDir: string): BundleReport {
  const problems: string[] = [];
  const html = readFileSync(path.join(distDir, 'index.html'), 'utf8');
  const absoluteUrls = findAbsoluteUrls(html);
  if (absoluteUrls.length > 0) problems.push(`dist/index.html has absolute URLs: ${absoluteUrls.join(', ')}`);

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
  return { entryChunk: entryChunk ?? '', gzippedBytes, absoluteUrls, problems };
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  const distDir = path.resolve(import.meta.dirname, '../dist');
  const report = checkBundle(distDir);
  console.log(`entry chunk: ${report.entryChunk}, ${report.gzippedBytes} bytes gzipped (limit ${ENTRY_CHUNK_LIMIT_BYTES})`);
  if (report.problems.length > 0) {
    for (const problem of report.problems) console.error(`FAIL: ${problem}`);
    process.exit(1);
  }
  console.log('bundle check passed');
}
