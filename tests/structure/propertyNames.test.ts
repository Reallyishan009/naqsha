import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Scans test and source text. The marker is built from pieces so that this file
// does not count as a property test just by naming it.
const ASSERT_MARKER = ['fc', 'assert'].join('.');
const ROOT = process.cwd();
/**
 * Exported functions with no property of their own, each with the reason it has none.
 * Nothing goes in here to make the coverage check below pass: a function without a property is
 * either given one or listed here with a reason a reader can check.
 *
 * - loadPixelData (src/reader/canvasSource.ts): it is the browser boundary. Its whole body is
 *   createImageBitmap, OffscreenCanvas and getImageData, so there is no pure input-output rule
 *   to state; tests/reader/canvasSource.test.ts drives it with fakes.
 *
 * paintToCanvas and browserScheduler (src/simulator/canvas.ts) were in this list until task 8.2
 * and are not any more: tests/simulator/canvas.test.ts has a property for each. downloadBmp
 * (src/exporter/download.ts) was removed in the same task, when its property was written in
 * tests/exporter/download.test.ts.
 */
const EXCLUDED_FROM_COVERAGE = new Set(['loadPixelData']);
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

/**
 * Named declarations of a test file: `function name(...) {...}`, `const name = ...;` and
 * `let name = ...;`, at any nesting. Used to follow a property that is written as a named
 * helper: a test that runs the property with `checkTheRule` names the function it checks
 * inside `checkTheRule`, not inside the `it(...)` body.
 */
function findDeclarations(source: string): { name: string; text: string }[] {
  const found: { name: string; text: string }[] = [];
  const opener = /(?<![\w$.])(?:function|const|let)\s+([A-Za-z_$][\w$]*)/g;
  let j = 0;
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
    const start = j + m[0].length;
    let end = start;
    let depth = 0;
    // A function body ends at its closing brace; a const or let ends at the `;` or the line end
    // that follows it at depth 0.
    while (end < source.length) {
      const skipped = skipLiteral(source, end);
      if (skipped !== end) {
        end = skipped;
        continue;
      }
      const c = source[end];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') {
        depth--;
        if (depth === 0 && c === '}' && m[0].startsWith('function')) {
          end++;
          break;
        }
        if (depth < 0) break;
      } else if (depth === 0 && (c === ';' || (c === '\n' && /[;}]\s*$/.test(source.slice(Math.max(0, end - 2), end))))) {
        end++;
        break;
      }
      end++;
    }
    found.push({ name: m[1], text: source.slice(j, end) });
    j = start;
  }
  return found;
}

/** The test body, plus the text of every declaration of the same file it names, followed through. */
function withHelpers(body: string, declarations: { name: string; text: string }[]): string {
  let text = body;
  const taken = new Set<string>();
  for (let round = 0; round < 5; round++) {
    const next = declarations.filter(
      ({ name }) => !taken.has(name) && new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`).test(text),
    );
    if (next.length === 0) break;
    for (const declaration of next) {
      taken.add(declaration.name);
      text += `\n${declaration.text}`;
    }
  }
  return text;
}

/** The searched text of every property test of one file: its body plus the helpers it names. */
function propertyBodies(source: string): string[] {
  const declarations = findDeclarations(source);
  return findTestCalls(source)
    .filter((call) => call.body.includes(ASSERT_MARKER))
    .map((call) => withHelpers(call.body, declarations));
}

/** True when one of those texts names `name` as a whole word. */
function namedInAProperty(bodies: readonly string[], name: string): boolean {
  const named = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, '\\$')}(?![\\w$])`);
  return bodies.some((body) => named.test(body));
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

  it('R17.3 every property test title states the requirement in words after its ID', () => {
    const short: string[] = [];
    let propertyTests = 0;
    for (const { path, source } of files) {
      for (const call of findTestCalls(source)) {
        if (!call.body.includes(ASSERT_MARKER) || call.title === null) continue;
        propertyTests++;
        const statement = call.title.replace(/\$\{[^}]*\}/g, '').replace(/^(?:R\d+\.\d+ )+/, '').trim();
        if (statement.split(/\s+/).filter((word) => word !== '').length < 3) {
          short.push(`${relative(ROOT, path)}:${call.line} "${call.title}"`);
        }
      }
    }
    expect(propertyTests, 'no property tests were found, so the scan is probably broken').toBeGreaterThan(0);
    expect(short, short.join('\n')).toEqual([]);
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

  /**
   * Since task 8.2 the rule is the stricter one the review used by hand: the function must be
   * named inside the same `it(...)` or `test(...)` block as the property runner, so the property
   * is a property *of that function*. Being named somewhere in a file that happens to contain a
   * property elsewhere is not enough.
   *
   * One extension, because a property may be written as a named helper: the text searched is the
   * test body plus the text of the declarations of the same file that the body names, followed
   * through (the property of tests/reader/layout.test.ts runs `checkTrueBeatsDecoys`, and
   * reaches `layoutMatches` that way; tests/reader/pegHoles.test.ts reaches
   * `selectPegHolePair` through two such hops). The helper is part of the property, so this is
   * still a property of the function; what it does not allow is a name that appears only in an
   * example test, or anywhere else in the file.
   *
   * The name must also stand on its own, not after a dot: `fc.nat` is not a use of a function
   * called `nat`, and `deps.frameAt` is not a use of the exported `frameAt`.
   *
   * What it still cannot tell: that the property says something worth saying about the function.
   * A test that calls the function once and asserts nothing about it would pass.
   */
  it('R17.1 and R13.1 every exported function in src/codec, src/reader, src/simulator and src/exporter is named inside a test that calls the property runner', () => {
    const exported = [
      ...exportedFunctionNames(join(ROOT, 'src', 'codec')),
      ...exportedFunctionNames(join(ROOT, 'src', 'reader')),
      ...exportedFunctionNames(join(ROOT, 'src', 'simulator')),
      ...exportedFunctionNames(join(ROOT, 'src', 'exporter')),
    ].filter(({ name }) => !EXCLUDED_FROM_COVERAGE.has(name));
    expect(exported.length, 'no exported functions were found, so the scan is probably broken').toBeGreaterThan(0);

    const bodies = files.flatMap(({ source }) => propertyBodies(source));
    expect(bodies.length, 'no property tests were found, so the scan is probably broken').toBeGreaterThan(0);
    const missing = exported.filter(({ name }) => !namedInAProperty(bodies, name));
    expect(
      missing,
      `not named inside any test that calls the property runner:\n${missing.map((m) => `${m.file}: ${m.name}`).join('\n')}`,
    ).toEqual([]);
  });

  it('R17.1 the coverage rule reads the test body, not the whole file', () => {
    const source = [
      "import * as fc from 'fast-check';",
      "it('R1.1 a property of one function', () => {",
      `  ${ASSERT_MARKER}(fc.property(fc.nat(), (n) => covered(n) === n));`,
      '});',
      "it('R1.2 an example of another function', () => {",
      '  expect(notCovered(1)).toBe(1);',
      '});',
    ].join('\n');
    const bodies = findTestCalls(source)
      .filter((call) => call.body.includes(ASSERT_MARKER))
      .map((call) => call.body);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toContain('covered');
    expect(bodies[0]).not.toContain('notCovered');
    // The old rule, which searched the whole file, could not tell these two apart.
    expect(source).toContain('notCovered');
    expect(namedInAProperty(propertyBodies(source), 'covered')).toBe(true);
    expect(namedInAProperty(propertyBodies(source), 'notCovered')).toBe(false);
  });

  it('R17.1 a function counts as covered from inside a property or its helper, and not from an example test', () => {
    // **Validates: Requirements 17.1**
    const place = fc.constantFrom('property', 'helper', 'helper-of-helper', 'example');
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{3,10}$/), place, fc.nat({ max: 4 }), (name, where, spare) => {
        // A file that always has one property test, about a function this one is not.
        const other = `${name}Other`;
        const lines = [
          "import * as fc from 'fast-check';",
          ...Array.from({ length: spare }, (_, i) => `const unused${i} = ${i};`),
          where === 'helper' ? `const check = (n: number) => ${name}(n) === n;` : '',
          where === 'helper-of-helper' ? `const inner = (n: number) => ${name}(n) === n;\nconst check = (n: number) => inner(n);` : '',
          `it('R1.1 a property that is about ${where}', () => {`,
          where === 'property'
            ? `  ${ASSERT_MARKER}(fc.property(fc.nat(), (n) => ${name}(n) === n));`
            : where === 'example'
              ? `  ${ASSERT_MARKER}(fc.property(fc.nat(), (n) => ${other}(n) === n));`
              : `  ${ASSERT_MARKER}(fc.property(fc.nat(), check));`,
          '});',
          where === 'example' ? `it('R1.2 an example only', () => {\n  expect(${name}(1)).toBe(1);\n});` : '',
        ].filter((line) => line !== '');
        const source = lines.join('\n');
        const bodies = propertyBodies(source);
        expect(bodies.length).toBe(1);
        expect(source).toContain(name);
        expect(namedInAProperty(bodies, name)).toBe(where !== 'example');
      }),
      { seed: 80220, numRuns: 200 },
    );
  });
});
