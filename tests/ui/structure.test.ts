import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../support/source.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'src');
const MODULES = ['codec', 'reader', 'simulator', 'exporter', 'archive'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

type Source = { file: string; relative: string; code: string; codeNoStrings: string };

const sources: Source[] = sourceFiles(SRC).map((file) => {
  const raw = readFileSync(file, 'utf8');
  return {
    file,
    relative: path.relative(SRC, file).split(path.sep).join('/'),
    code: stripComments(raw, false),
    codeNoStrings: stripComments(raw, true),
  };
});

/** Module specifiers of imports, re-exports, side-effect imports and dynamic imports. */
function specifiers(code: string): string[] {
  const patterns = [
    /\b(?:import|export)\b[^;'"`]*?\bfrom\s*(['"])([^'"]+)\1/g,
    /\bimport\s*(['"])([^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  ];
  return patterns.flatMap((pattern) => [...code.matchAll(pattern)].map((m) => m[2]!));
}

describe('src/ui structure', () => {
  const uiSources = sources.filter((s) => s.relative.startsWith('ui/'));

  it('there are source files to scan in src/ui', () => {
    expect(uiSources.length).toBeGreaterThan(0);
  });

  it('R16.3 src/ui imports other src modules only through their index.ts', () => {
    const violations: string[] = [];
    for (const s of uiSources) {
      for (const specifier of specifiers(s.code)) {
        if (!specifier.startsWith('.')) continue;
        const target = path.resolve(path.dirname(s.file), specifier);
        const relative = path.relative(SRC, target).split(path.sep).join('/');
        const [first, ...rest] = relative.split('/');
        if (first === undefined || !MODULES.includes(first)) continue;
        const rest0 = rest.join('/');
        if (!/^index(\.ts)?$/.test(rest0)) violations.push(`${s.relative}: '${specifier}'`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('R16.4 src/ui imports nothing from scripts/', () => {
    const violations: string[] = [];
    for (const s of uiSources) {
      for (const specifier of specifiers(s.code)) {
        if (!specifier.startsWith('.')) continue;
        const target = path.resolve(path.dirname(s.file), specifier);
        if (target === path.join(ROOT, 'scripts') || target.startsWith(path.join(ROOT, 'scripts') + path.sep)) {
          violations.push(`${s.relative}: '${specifier}'`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('R16.8 no file in src uses the any type', () => {
    const violations: string[] = [];
    for (const s of sources) {
      for (const m of s.codeNoStrings.matchAll(/(?<![.\w$])any(?![\w$])/g)) {
        violations.push(`${s.relative}:${s.codeNoStrings.slice(0, m.index).split('\n').length}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('R16.6 no module other than src/ui imports src/ui', () => {
    const violations: string[] = [];
    for (const s of sources.filter((x) => !x.relative.startsWith('ui/') && x.relative !== 'main.tsx')) {
      for (const specifier of specifiers(s.code)) {
        if (!specifier.startsWith('.')) continue;
        const target = path.resolve(path.dirname(s.file), specifier);
        const relative = path.relative(SRC, target).split(path.sep).join('/');
        if (relative === 'ui' || relative.startsWith('ui/')) violations.push(`${s.relative}: '${specifier}'`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('R16.2 package.json dependencies are exactly react and react-dom', () => {
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(['react', 'react-dom']);
  });
});
