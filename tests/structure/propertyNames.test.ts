import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Scans test and source text. The marker is built from pieces so that this file
// does not count as a property test just by naming it.
const ASSERT_MARKER = ['fc', 'assert'].join('.');
const ROOT = process.cwd();
// paintToCanvas and browserScheduler (src/simulator/canvas.ts) have example tests with fakes.
// downloadBmp (src/exporter/download.ts) has an example test with fakes.
const EXCLUDED_FROM_COVERAGE = new Set(['loadPixelData', 'paintToCanvas', 'browserScheduler', 'downloadBmp']);
const ID_PREFIX = /^R\d+\.\d+ /;

function listFiles(dir: string, accept: (name: string) => boolean): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...listFiles(path, accept));
    else if (accept(name)) found.push(path);
  }
  return found;
}

type TestCall = {
  line: number;
  modifier: string | null; // 'skip', 'todo', 'only', ... or null
  title: string | null; // null when the first argument is not a string literal
  titleIsTemplate: boolean;
  hasSubstitution: boolean;
  body: string;
};

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (source[i] === '\n') line++;
  return line;
}

// Returns the index just after the string, template or comment starting at i, or i if none starts there.
function skipLiteral(source: string, i: number): number {
  const c = source[i];
  if (c === '/' && source[i + 1] === '/') {
    const end = source.indexOf('\n', i);
    return end === -1 ? source.length : end;
  }
  if (c === '/' && source[i + 1] === '*') {
    const end = source.indexOf('*/', i + 2);
    return end === -1 ? source.length : end + 2;
  }
  if (c === "'" || c === '"') {
    let j = i + 1;
    while (j < source.length && source[j] !== c) j += source[j] === '\\' ? 2 : 1;
    return j + 1;
  }
  if (c === '`') {
    let j = i + 1;
    while (j < source.length && source[j] !== '`') {
      if (source[j] === '\\') j += 2;
      else if (source[j] === '$' && source[j + 1] === '{') j = skipBraces(source, j + 1);
      else j++;
    }
    return j + 1;
  }
  return i;
}

// i points at '{'. Returns the index just after the matching '}'.
function skipBraces(source: string, i: number): number {
  let depth = 0;
  let j = i;
  while (j < source.length) {
    const next = skipLiteral(source, j);
    if (next !== j) {
      j = next;
      continue;
    }
    if (source[j] === '{') depth++;
    else if (source[j] === '}' && --depth === 0) return j + 1;
    j++;
  }
  return j;
}

// open points at '('. Returns the index of the matching ')', or -1.
function matchingParen(source: string, open: number): number {
  let depth = 0;
  let j = open;
  while (j < source.length) {
    const next = skipLiteral(source, j);
    if (next !== j) {
      j = next;
      continue;
    }
    if (source[j] === '(') depth++;
    else if (source[j] === ')' && --depth === 0) return j;
    j++;
  }
  return -1;
}

function findTestCalls(source: string): TestCall[] {
  const calls: TestCall[] = [];
  const opener = /(?<![\w$.])(?:it|test)(?:\.(\w+))?\(/g;
  let j = 0;
  // Walk the source so that matches inside strings and comments are ignored.
  while (j < source.length) {
    const next = skipLiteral(source, j);
    if (next !== j) {
      j = next;
      continue;
    }
    opener.lastIndex = j;
    const m = opener.exec(source);
    if (m === null || m.index !== j) {
      j++;
      continue;
    }
    const open = j + m[0].length - 1;
    const close = matchingParen(source, open);
    if (close === -1) {
      j = open + 1;
      continue;
    }
    const args = source.slice(open + 1, close);
    const trimmedStart = args.search(/\S/);
    const quote = trimmedStart === -1 ? '' : args[trimmedStart];
    let title: string | null = null;
    let hasSubstitution = false;
    if (quote === "'" || quote === '"' || quote === '`') {
      const end = skipLiteral(args, trimmedStart);
      const raw = args.slice(trimmedStart + 1, end - 1);
      title = raw;
      hasSubstitution = quote === '`' && raw.includes('${');
    }
    calls.push({
      line: lineOf(source, j),
      modifier: m[1] ?? null,
      title,
      titleIsTemplate: quote === '`',
      hasSubstitution,
      body: args,
    });
    j = open + 1; // continue inside, so nested calls (none expected) are seen too
  }
  return calls;
}

function readTestFiles(): { path: string; source: string }[] {
  return listFiles(join(ROOT, 'tests'), (name) => name.endsWith('.test.ts')).map((path) => ({
    path,
    source: readFileSync(path, 'utf8'),
  }));
}

function exportedFunctionNames(dir: string): { name: string; file: string }[] {
  const names: { name: string; file: string }[] = [];
  for (const path of listFiles(dir, (n) => n.endsWith('.ts') && !n.endsWith('.d.ts'))) {
    const source = readFileSync(path, 'utf8');
    const patterns = [
      /^export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/gm,
      /^export\s+const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=>/gm,
      /^export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/gm,
    ];
    for (const pattern of patterns) {
      for (const m of source.matchAll(pattern)) {
        names.push({ name: m[1], file: relative(ROOT, path) });
      }
    }
  }
  return names;
}

describe('property naming and coverage', () => {
  const files = readTestFiles();

  it('R17.2 every test that calls the property runner has a title starting with a requirement ID', () => {
    const violations: string[] = [];
    const skipped: string[] = [];
    let propertyTests = 0;
    for (const { path, source } of files) {
      const rel = relative(ROOT, path);
      for (const call of findTestCalls(source)) {
        if (call.modifier === 'skip' || call.modifier === 'todo') {
          skipped.push(`${rel}:${call.line} (${call.modifier})`);
        }
        if (!call.body.includes(ASSERT_MARKER)) continue;
        propertyTests++;
        const where = `${rel}:${call.line}`;
        if (call.title === null) {
          violations.push(`${where} title is not a string literal`);
        } else if (call.hasSubstitution) {
          // Only a literal prefix before the first substitution can be resolved.
          const prefix = call.title.slice(0, call.title.indexOf('${'));
          if (!ID_PREFIX.test(prefix)) violations.push(`${where} template title has no literal ID prefix: \`${call.title}\``);
        } else if (!ID_PREFIX.test(call.title)) {
          violations.push(`${where} title has no ID prefix: "${call.title}"`);
        }
      }
    }
    expect(skipped, `skipped or todo tests:\n${skipped.join('\n')}`).toEqual([]);
    expect(propertyTests, 'no property tests were found, so the scan is probably broken').toBeGreaterThan(0);
    expect(violations, violations.join('\n')).toEqual([]);
  });

  it('R17.2 the property runner is only called inside a test body', () => {
    const stray: string[] = [];
    for (const { path, source } of files) {
      const calls = findTestCalls(source);
      let index = source.indexOf(ASSERT_MARKER);
      while (index !== -1) {
        const line = lineOf(source, index);
        const inside = calls.some((c) => line >= c.line && line <= c.line + c.body.split('\n').length - 1);
        if (!inside) stray.push(`${relative(ROOT, path)}:${line}`);
        index = source.indexOf(ASSERT_MARKER, index + 1);
      }
    }
    expect(stray, stray.join('\n')).toEqual([]);
  });

  it('R17.1 and R13.1 every exported function in src/codec, src/reader, src/simulator and src/exporter is named in a test file that calls the property runner', () => {
    const exported = [
      ...exportedFunctionNames(join(ROOT, 'src', 'codec')),
      ...exportedFunctionNames(join(ROOT, 'src', 'reader')),
      ...exportedFunctionNames(join(ROOT, 'src', 'simulator')),
      ...exportedFunctionNames(join(ROOT, 'src', 'exporter')),
    ].filter(({ name }) => !EXCLUDED_FROM_COVERAGE.has(name));
    expect(exported.length, 'no exported functions were found, so the scan is probably broken').toBeGreaterThan(0);

    const propertyFiles = files.filter(({ source }) => source.includes(ASSERT_MARKER));
    const missing = exported.filter(
      ({ name }) => !propertyFiles.some(({ source }) => new RegExp(`(?<![\\w$])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(source)),
    );
    expect(
      missing,
      `not named in any test file that calls the property runner:\n${missing.map((m) => `${m.file}: ${m.name}`).join('\n')}`,
    ).toEqual([]);
  });
});
