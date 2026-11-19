/**
 * Post-build step of `npm run build` (R24.6): reads `dist/`, writes the precache list and the versioned cache
 * name into `dist/sw.js`. The asset names are hashed by the bundler, so they are never written by hand, and
 * `public/sw.js` keeps its placeholders in the repository.
 *
 * Usage (Node 22.18+ runs .ts directly):
 *   node scripts/build_precache.ts [dist directory]
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { injectPrecacheBlock, precacheCacheName, precacheEntries, precacheProblems } from './checks/precache.ts';
import type { DistFile } from './checks/precache.ts';

/** Every file of a built site, as a path relative to it with `/` separators, with a hash of its bytes. */
export function listDistFiles(distDir: string, prefix = ''): DistFile[] {
  const files: DistFile[] = [];
  for (const entry of readdirSync(path.join(distDir, prefix), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...listDistFiles(distDir, relative));
    else {
      const bytes = readFileSync(path.join(distDir, relative));
      files.push({ path: relative, contentHash: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  return files;
}

export type PrecacheResult = { cacheName: string; entries: string[]; problems: string[] };

/** Writes the precache block into `<distDir>/sw.js`. Reports every problem it found; writes nothing when any. */
export function buildPrecache(distDir: string): PrecacheResult {
  const files = listDistFiles(distDir);
  const entries = precacheEntries(files);
  const cacheName = precacheCacheName(files);
  const problems = precacheProblems(entries, files);
  const workerFile = path.join(distDir, 'sw.js');
  if (!files.some((file) => file.path === 'sw.js')) {
    return { cacheName, entries, problems: [...problems, 'the built site has no sw.js'] };
  }
  if (problems.length > 0) return { cacheName, entries, problems };
  const written = injectPrecacheBlock(readFileSync(workerFile, 'utf8'), cacheName, entries);
  if (written === null) return { cacheName, entries, problems: ['sw.js has no precache block to replace'] };
  writeFileSync(workerFile, written);
  return { cacheName, entries, problems: [] };
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  const distDir = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../dist'));
  const result = buildPrecache(distDir);
  if (result.problems.length > 0) {
    for (const problem of result.problems) console.error(`FAIL: ${problem}`);
    process.exit(1);
  }
  console.log(`precache: ${result.entries.length} entries in cache ${result.cacheName}`);
}
