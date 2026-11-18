import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = path.resolve(import.meta.dirname, '../../src');
const CODEC = path.join(SRC, 'codec');
const READER = path.join(SRC, 'reader');

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

type SourceFile = { file: string; relative: string; raw: string; code: string; codeNoStrings: string };

/**
 * Removes // and /* *\/ comments with a one-pass scanner that tracks '...', "..." and `...`
 * literals, so comment markers inside strings are kept. Newlines are preserved so line
 * numbers stay valid. With blankStrings, string contents are replaced by spaces too.
 * Limits: no regex-literal awareness (a `/` or quote inside a regex literal can confuse it),
 * and `${...}` inside a template literal is treated as string text.
 */
export function stripComments(text: string, blankStrings: boolean): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      out += c;
      i++;
      while (i < text.length && text[i] !== c) {
        if (text[i] === '\\') {
          out += blankStrings ? '  ' : text.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (c !== '`' && text[i] === '\n') break; // unterminated literal: stop at end of line
        out += blankStrings && text[i] !== '\n' ? ' ' : text[i];
        i++;
      }
      if (i < text.length && text[i] === c) {
        out += c;
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function load(dir: string): SourceFile[] {
  return tsFiles(dir).map((file) => {
    const raw = readFileSync(file, 'utf8');
    return {
      file,
      relative: path.relative(SRC, file),
      raw,
      code: stripComments(raw, false),
      codeNoStrings: stripComments(raw, true),
    };
  });
}

const codecFiles = load(CODEC);
const readerFiles = load(READER);
const bothFiles = [...codecFiles, ...readerFiles];

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

function findAll(files: SourceFile[], pattern: RegExp, pick: (f: SourceFile) => string): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const text = pick(f);
    for (const m of text.matchAll(new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'))) {
      hits.push(`${f.relative}:${lineOf(text, m.index)}: ${m[0]}`);
    }
  }
  return hits;
}

/** Module specifiers of `import ... from '...'`, `export ... from '...'`, side-effect imports and `import('...')`. */
function specifiers(code: string): { specifier: string; line: number }[] {
  const found: { specifier: string; line: number }[] = [];
  const patterns = [
    /\b(?:import|export)\b[^;'"`]*?\bfrom\s*(['"])([^'"]+)\1/g,
    /\bimport\s*(['"])([^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const m of code.matchAll(pattern)) found.push({ specifier: m[2], line: lineOf(code, m.index) });
  }
  return found;
}

function importViolations(files: SourceFile[], allowedDirs: string[]): string[] {
  const violations: string[] = [];
  for (const f of files) {
    for (const { specifier, line } of specifiers(f.code)) {
      const where = `${f.relative}:${line}: '${specifier}'`;
      if (!specifier.startsWith('.')) {
        violations.push(`${where} (bare or absolute import)`);
        continue;
      }
      const target = path.resolve(path.dirname(f.file), specifier);
      const inside = allowedDirs.some((dir) => target === dir || target.startsWith(dir + path.sep));
      if (!inside) violations.push(`${where} (resolves outside ${allowedDirs.map((d) => path.relative(SRC, d)).join(', ')})`);
    }
  }
  return violations;
}

const BROWSER_API =
  /\b(?:document|window|OffscreenCanvas|HTMLImageElement|HTMLCanvasElement|ImageBitmap|createImageBitmap|Blob|navigator)\b/;

// Peg-hole words. Matches pegHole, PegHoles, "peg hole", peg-hole, peg_hole, any case.
const PEG_WORD = /peg[\s_-]?hole/i;

// The design's list of files that may use the peg-hole words is: pegHoles.ts, orientation.ts,
// pose.ts, readCard.ts, types.ts, validateCardProfile.ts. It is extended here with layout.ts and
// selectPegHoles.ts, which were added by task 5.16 and legitimately use the words.
const PEG_ALLOWED = new Set([
  'codec/types.ts',
  'codec/validateCardProfile.ts',
  'reader/types.ts',
  'reader/pegHoles.ts',
  'reader/orientation.ts',
  'reader/pose.ts',
  'reader/readCard.ts',
  'reader/layout.ts', // added by task 5.16
  'reader/selectPegHoles.ts', // added by task 5.16
]);

/** The code with module specifiers blanked, so `export * from './pegHoles'` in index.ts is not a use of the word. */
function withoutSpecifiers(code: string): string {
  return code.replace(/(\bfrom\s*)(['"])[^'"]*\2/g, (_m, from: string, q: string) => `${from}${q}${q}`);
}

describe('module boundaries', () => {
  it('there are source files to scan in src/codec and src/reader', () => {
    expect(codecFiles.length).toBeGreaterThan(0);
    expect(readerFiles.length).toBeGreaterThan(0);
  });

  it('R15.1 src/codec imports nothing from other src modules and no packages', () => {
    expect(importViolations(codecFiles, [CODEC])).toEqual([]);
  });

  it('R15.2 src/reader imports only from src/reader and src/codec, and no packages', () => {
    expect(importViolations(readerFiles, [READER, CODEC])).toEqual([]);
  });

  it('R6.5 src/codec uses no browser API', () => {
    expect(findAll(codecFiles, BROWSER_API, (f) => f.codeNoStrings)).toEqual([]);
  });

  it('R6.3 only src/reader/canvasSource.ts names a browser API', () => {
    const others = readerFiles.filter((f) => f.relative !== path.join('reader', 'canvasSource.ts'));
    expect(findAll(others, BROWSER_API, (f) => f.codeNoStrings)).toEqual([]);
  });

  it('R15.5 neither module uses the any type', () => {
    expect(findAll(bothFiles, /(?<![.\w$])any(?![\w$])/, (f) => f.codeNoStrings)).toEqual([]);
  });

  it('R14.2 neither module names demo-12x16', () => {
    expect(findAll(bothFiles, /demo-12x16/, (f) => f.raw)).toEqual([]);
  });

  it('R14.2 neither module imports from or reads public/', () => {
    expect(findAll(bothFiles, /\bpublic\//, (f) => f.raw)).toEqual([]);
  });

  it('R15.4 peg hole words appear only in the files the design allows', () => {
    const offenders = bothFiles.filter((f) => !PEG_ALLOWED.has(f.relative.split(path.sep).join('/')));
    expect(findAll(offenders, PEG_WORD, (f) => withoutSpecifiers(f.raw))).toEqual([]);
  });

  it('the comment stripper keeps comment markers inside strings and drops real comments', () => {
    const sample = "const a = 'x // y'; // gone\n/* gone\nmore */ const b = `/* kept */`;\n";
    expect(stripComments(sample, false)).toBe("const a = 'x // y'; \n\n const b = `/* kept */`;\n");
    expect(stripComments(sample, true)).not.toContain('kept');
  });
});
