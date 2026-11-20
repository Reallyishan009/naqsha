import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
const PACKAGE = path.resolve(import.meta.dirname, '..');
const REPO = path.resolve(PACKAGE, '../..');
function walk(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(full);
  }
  return found;
}
describe('isolation (R2.1)', () => {
  it('R2.1 the package pins the SDK and zod to exact versions, and its lockfile resolves the same versions', () => {
    const manifest = JSON.parse(readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; devDependencies?: unknown };
    assert.deepEqual(manifest.dependencies, { '@modelcontextprotocol/sdk': '1.32.2', zod: '4.6.7' });
    assert.equal(manifest.devDependencies, undefined);
    const lock = JSON.parse(readFileSync(path.join(PACKAGE, 'package-lock.json'), 'utf8')) as { packages: Record<string, { version: string }> };
    assert.equal(lock.packages['node_modules/@modelcontextprotocol/sdk']?.version, '1.32.2');
    assert.equal(lock.packages['node_modules/zod']?.version, '4.6.7');
  });
  it('R2.1 the root package.json and root lockfile do not mention the SDK or zod', () => {
    const root = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as { dependencies?: object; devDependencies?: object };
    const names = [...Object.keys(root.dependencies ?? {}), ...Object.keys(root.devDependencies ?? {})];
    assert.ok(!names.some((name) => name.startsWith('@modelcontextprotocol') || name === 'zod'), names.join(', '));
    const lock = readFileSync(path.join(REPO, 'package-lock.json'), 'utf8');
    assert.ok(!lock.includes('@modelcontextprotocol'));
    assert.ok(!/"node_modules\/zod"/.test(lock));
  });
  it('R2.1 nothing under src/ imports from tools/', () => {
    const offenders = walk(path.join(REPO, 'src')).filter((file) => /(?:from|import)\s*\(?\s*['"][^'"]*\btools\//.test(readFileSync(file, 'utf8')));
    assert.deepEqual(offenders, []);
  });
  it('R2.1 the root typecheck does not include tools/ and the root test run does not include its tests', () => {
    const tsconfig = JSON.parse(readFileSync(path.join(REPO, 'tsconfig.json'), 'utf8')) as { include: string[] };
    assert.ok(!tsconfig.include.some((entry) => entry.startsWith('tools')));
    const vite = readFileSync(path.join(REPO, 'vite.config.ts'), 'utf8');
    assert.ok(!vite.includes('tools/'));
  });
});
describe('no network, no shell, no environment (R8.3)', () => {
  const forbidden: [string, RegExp][] = [
    ['child_process', /child_process/],
    ['a network module', /node:(net|http|https|http2|dgram|dns|tls)\b|from\s+['"](net|http|https|http2|dgram|dns|tls)['"]/],
    ['fetch', /\bfetch\s*\(/],
    ['WebSocket or XMLHttpRequest', /\b(WebSocket|XMLHttpRequest)\b/],
    ['the environment', /process\.env|\bprocess\[\s*['"]env['"]\s*\]/],
    ['eval', /\beval\s*\(|new Function\s*\(/],
  ];
  for (const [label, pattern] of forbidden) {
    it(`R8.3 the server source has no ${label}`, () => {
      const offenders = walk(path.join(PACKAGE, 'src')).filter((file) => pattern.test(readFileSync(file, 'utf8')));
      assert.deepEqual(offenders, []);
    });
  }
  it('R8.3 the app modules the tools call have none of them either', () => {
    for (const module of ['codec', 'codec-view', 'reader', 'simulator', 'exporter']) {
      for (const file of walk(path.join(REPO, 'src', module))) {
        const text = readFileSync(file, 'utf8');
        assert.ok(!/child_process|process\.env|node:net|node:http/.test(text), file);
      }
    }
  });
});
