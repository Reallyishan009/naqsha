// Kiro PostFileSave hook: run the Vitest files related to the saved file, then typecheck.
// Kiro passes the event as JSON on STDIN. The field holding the file path is not
// documented, so this collects every string in the payload that looks like a path
// under src/ or scripts/. If none is found, it falls back to files git reports as changed.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = process.cwd();
const watched = /^(src|scripts)\/.+\.(ts|tsx)$/;

function readStdin() {
  try { return readFileSync(0, 'utf8'); } catch { return ''; }
}

function collectStrings(value, out) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

function toRepoPath(p) {
  const rel = relative(root, resolve(root, p)).split('\\').join('/');
  return watched.test(rel) && existsSync(rel) ? rel : null;
}

let files = [];
const raw = readStdin().trim();
if (raw) {
  try {
    files = collectStrings(JSON.parse(raw), []).map(toRepoPath).filter(Boolean);
  } catch {
    files = raw.split(/\s+/).map(toRepoPath).filter(Boolean);
  }
}
if (files.length === 0) {
  const changed = execFileSync('git', ['status', '--porcelain', '--untracked-files=all', '--', 'src', 'scripts'], { encoding: 'utf8' });
  files = changed.split('\n').map((l) => l.slice(3).trim()).map(toRepoPath).filter(Boolean);
}
files = [...new Set(files)];

const bin = (name) => resolve(root, 'node_modules/.bin', name);
let failed = false;

if (files.length > 0) {
  console.log(`related tests for: ${files.join(', ')}`);
  const tests = spawnSync(bin('vitest'), ['related', '--run', '--passWithNoTests', ...files], { stdio: 'inherit' });
  if (tests.status !== 0) failed = true;
} else {
  console.log('no saved file under src/ or scripts/ found; skipping related tests');
}

const types = spawnSync(bin('tsc'), ['--noEmit'], { stdio: 'inherit' });
if (types.status !== 0) failed = true;

if (failed) {
  console.error('on-save checks FAILED (see output above)');
  process.exit(1);
}
console.log('on-save checks passed');
