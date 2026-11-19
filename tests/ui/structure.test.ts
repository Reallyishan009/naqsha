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

  it('R15.3 every style sheet is a CSS Module in the folder of the component that imports it, and no CSS framework is used', () => {
    const cssFiles = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return cssFiles(full);
        return entry.name.endsWith('.css') ? [full] : [];
      });
    const uiDir = path.join(SRC, 'ui');
    const found = cssFiles(uiDir).map((file) => path.relative(uiDir, file).split(path.sep).join('/'));
    expect(found.length).toBeGreaterThan(0);
    // The one global sheet is the token file (R15.1). Every other sheet is a .module.css file.
    expect(found.filter((file) => !file.endsWith('.module.css'))).toEqual(['theme/tokens.css']);

    const importedModules = new Set<string>();
    for (const s of uiSources) {
      for (const match of s.code.matchAll(/import\s+(?:[\w$]+\s+from\s+)?(['"])([^'"]+\.css)\1/g)) {
        const specifier = match[2]!;
        const target = path.resolve(path.dirname(s.file), specifier);
        if (specifier.endsWith('.module.css')) {
          expect(specifier.startsWith('./'), `${s.relative}: ${specifier} is not in the component folder`).toBe(true);
          importedModules.add(target);
        } else {
          expect(specifier, s.relative).toBe('./theme/tokens.css');
        }
      }
    }
    for (const file of found.filter((name) => name.endsWith('.module.css'))) {
      expect(importedModules.has(path.join(uiDir, file)), `${file} is not imported by a component in its folder`).toBe(true);
    }

    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const packages = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    expect(
      packages.filter((name) => /tailwind|bootstrap|bulma|foundation-sites|styled-components|@emotion|@mui|chakra|sass|less|postcss|unocss|windicss/i.test(name)),
    ).toEqual([]);
    for (const file of found) {
      const css = readFileSync(path.join(uiDir, file), 'utf8');
      expect(css, file).not.toMatch(/@tailwind|@apply|@import/);
    }
  });

  it('R16.7 the build script runs tsc --noEmit before the bundler, and tsconfig turns strict mode on', () => {
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    expect(manifest.scripts.build).toMatch(/^tsc --noEmit && vite build$/);
    expect(manifest.scripts.typecheck).toBe('tsc --noEmit');
    const tsconfig = JSON.parse(readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf8')) as {
      compilerOptions: { strict?: boolean };
      include: string[];
    };
    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.include).toEqual(expect.arrayContaining(['src', 'tests']));
  });

  it('R16.9 browser APIs for file choice, download, camera and image decoding are named only in src/ui and the files that isolate them', () => {
    const browserApi =
      /\b(getUserMedia|mediaDevices|showOpenFilePicker|createObjectURL|createImageBitmap|FileReader|OffscreenCanvas|HTMLInputElement)\b|\b(document|window|navigator)\./;
    // Each of these is the one place its module reaches the browser: image decoding, the BMP download, the mount point.
    const isolating = new Set(['reader/canvasSource.ts', 'exporter/download.ts', 'main.tsx']);
    const offenders = sources
      .filter((s) => !s.relative.startsWith('ui/') && !isolating.has(s.relative))
      .filter((s) => browserApi.test(s.codeNoStrings))
      .map((s) => s.relative);
    expect(offenders).toEqual([]);
    // The isolating files exist, so the allowance above is not stale.
    for (const file of isolating) expect(sources.some((s) => s.relative === file), file).toBe(true);
    // Inside src/ui the camera API is named only in the one file that isolates it (R18), and a photo file is chosen only through a file input.
    expect(
      sources
        .filter((s) => /getUserMedia|mediaDevices/.test(s.codeNoStrings))
        .map((s) => s.relative)
        .sort(),
    ).toEqual(['ui/screens/scan/camera.ts']);
  });

  it('R16.2 package.json dependencies are exactly react and react-dom', () => {
    const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(['react', 'react-dom']);
  });
});
