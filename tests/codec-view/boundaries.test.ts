/**
 * The boundary test of the Code view feature (R8.11, R8.12).
 *
 * It reads three sets of files and asserts the eleven rows of the boundary-test table in
 * `.kiro/specs/cards-as-code/design.md`:
 *
 * - **the module set**: every `.ts` in `src/codec-view`;
 * - **the screen set**: every file of this feature in `src/ui` (`src/ui/screens/code/**` and
 *   `src/ui/state/codeView.ts`), which is empty until Phase 3 and is picked up when it arrives;
 * - **the downstream set**: every `.ts` in `src/codec`, `src/reader`, `src/simulator`,
 *   `src/exporter` and `src/archive`.
 *
 * Every failure message reads `<file>:<line>: '<specifier or API name>' breaks R8.x`, so a broken
 * boundary names the file, the thing and the criterion (R8.11). The last group of tests plants a
 * bad specifier, a browser API, a card literal, an `any` and a canvas call in text of its own and
 * asserts each message, so the checks cannot pass by finding nothing.
 *
 * **What it cannot find.**
 * 1. A specifier built at run time (`import(base + name)`): `importSpecifiers` reads the text,
 *    not a parse tree.
 * 2. A browser API reached indirectly (`globalThis['document']`, a name passed in as a
 *    parameter), and one named inside a string literal, because strings are blanked.
 * 3. A card dimension written in another form (`6 * 2`, `0xc`): the digits must be the literal,
 *    and only the three values R8.5 names are looked for.
 * 4. `getContext`, which R4.1 allows: the Code_View_Screen has to hand a 2D context to
 *    `paintToCanvas` from `src/simulator`, which is the one renderer (R4.1). The drawing calls
 *    themselves are what this check bans.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { importSpecifiers, stripComments } from '../support/source.ts';
import { scanNumbers } from '../support/termScan.ts';
import { demoProfile } from '../support/profiles.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'src');
const CODEC = path.join(SRC, 'codec');
const CODEC_VIEW = path.join(SRC, 'codec-view');
const UI = path.join(SRC, 'ui');
const TESTS = path.join(ROOT, 'tests');
const STRUCTURE = path.join(ROOT, '.kiro', 'steering', 'structure.md');
const DOWNSTREAM = ['codec', 'reader', 'simulator', 'exporter', 'archive'].map((name) => path.join(SRC, name));

/** The five key exports R8.9 asks `structure.md` to name. */
const KEY_EXPORTS = ['cardToBits', 'patternToLines', 'diffPatterns', 'applyDiff', 'diffToText'] as const;

/** The browser and React names R8.3 bans from `src/codec-view`. */
const BROWSER_API = [
  'react',
  'window',
  'document',
  'navigator',
  'localStorage',
  'indexedDB',
  'fetch',
  'OffscreenCanvas',
  'CanvasRenderingContext2D',
  'ImageData',
  'requestAnimationFrame',
] as const;

/**
 * The canvas drawing calls and pixel-buffer names R4.1 bans from a Code view file, which must
 * paint through `paintToCanvas` from `src/simulator` and add no renderer of its own.
 */
const CANVAS_DRAWING_API = [
  'putImageData',
  'getImageData',
  'createImageData',
  'ImageData',
  'drawImage',
  'createImageBitmap',
  'OffscreenCanvas',
  'CanvasRenderingContext2D',
  'fillRect',
  'clearRect',
  'strokeRect',
  'fillText',
  'strokeText',
  'beginPath',
  'closePath',
  'moveTo',
  'lineTo',
  'arcTo',
  'bezierCurveTo',
  'quadraticCurveTo',
  'createLinearGradient',
  'createRadialGradient',
  'createPattern',
] as const;

type SourceFile = {
  /** Absolute path, so a relative specifier can be resolved against its directory. */
  file: string;
  /** Path from the repository root with forward slashes, as the failure message writes it. */
  relative: string;
  raw: string;
  /** Comments removed, string contents kept: what the specifier scan reads. */
  code: string;
  /** Comments and string contents removed: what the API-name scans read. */
  codeNoStrings: string;
};

function sourceFile(file: string, raw: string): SourceFile {
  return {
    file,
    relative: path.relative(ROOT, file).split(path.sep).join('/'),
    raw,
    code: stripComments(raw, false),
    codeNoStrings: stripComments(raw, true),
  };
}

function load(file: string): SourceFile {
  return sourceFile(file, readFileSync(file, 'utf8'));
}

/** Every file under `dir` with one of the extensions, sorted, or none when `dir` does not exist. */
function filesUnder(dir: string, extensions: readonly string[]): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return filesUnder(full, extensions);
      return extensions.some((extension) => entry.name.endsWith(extension)) ? [full] : [];
    });
}

const moduleFiles = filesUnder(CODEC_VIEW, ['.ts']).map(load);
/** The Code view files in src/ui. Empty until Phase 3 writes them; every check holds on none. */
const screenFiles = [
  ...filesUnder(path.join(UI, 'screens', 'code'), ['.ts', '.tsx']),
  ...(existsSync(path.join(UI, 'state', 'codeView.ts')) ? [path.join(UI, 'state', 'codeView.ts')] : []),
].map(load);
const downstreamFiles = DOWNSTREAM.flatMap((dir) => filesUnder(dir, ['.ts'])).map(load);
/** The files of this feature: the module and the screen together (R8.6, R8.4, R4.1). */
const featureFiles = [...moduleFiles, ...screenFiles];

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/** The one failure-message shape of this test (R8.11). */
function breach(file: SourceFile, line: number, what: string, criterion: string): string {
  return `${file.relative}:${line}: '${what}' breaks ${criterion}`;
}

function isUnder(file: SourceFile, dir: string): boolean {
  return file.file === dir || file.file.startsWith(dir + path.sep);
}

/** Every named word of the list that the code uses, comments and string contents blanked. */
function apiUses(files: readonly SourceFile[], names: readonly string[], criterion: string): string[] {
  const pattern = new RegExp(`\\b(?:${names.join('|')})\\b`, 'g');
  const found: string[] = [];
  for (const file of files) {
    for (const m of file.codeNoStrings.matchAll(pattern)) {
      found.push(breach(file, lineOf(file.codeNoStrings, m.index), m[0], criterion));
    }
  }
  return found;
}

/** Row 1 and row 2: every specifier is relative, and resolves inside one of `allowedDirs` (R8.2). */
function outsideSpecifiers(files: readonly SourceFile[], allowedDirs: readonly string[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    for (const { specifier, line } of importSpecifiers(file.code)) {
      if (!specifier.startsWith('.')) {
        found.push(breach(file, line, specifier, 'R8.2'));
        continue;
      }
      const target = path.resolve(path.dirname(file.file), specifier);
      if (!allowedDirs.some((dir) => target === dir || target.startsWith(dir + path.sep))) {
        found.push(breach(file, line, specifier, 'R8.2'));
      }
    }
  }
  return found;
}

/** Every specifier of `files` that `names` matches, in a file that is not under `src/ui` (R8.4). */
function specifiersOutsideUi(files: readonly SourceFile[], names: RegExp, criterion: string): string[] {
  const found: string[] = [];
  for (const file of files.filter((candidate) => !isUnder(candidate, UI))) {
    for (const { specifier, line } of importSpecifiers(file.code)) {
      if (names.test(specifier)) found.push(breach(file, line, specifier, criterion));
    }
  }
  return found;
}

/** Every specifier of `files` that `names` matches, whatever directory the file is in. */
function specifiersNaming(files: readonly SourceFile[], names: RegExp, criterion: string): string[] {
  const found: string[] = [];
  for (const file of files) {
    for (const { specifier, line } of importSpecifiers(file.code)) {
      if (names.test(specifier)) found.push(breach(file, line, specifier, criterion));
    }
  }
  return found;
}

const profile = demoProfile();
/** The three values R8.5 names, from the demo profile file, never written here as literals. */
const CARD_VALUES = [profile.hookRows, profile.hookColumns, profile.hookRows * profile.hookColumns];

/** Row 7: the demo profile name as a string literal, or one of its card values as a numeral (R8.5). */
function cardLiterals(files: readonly SourceFile[]): string[] {
  const found: string[] = [];
  const name = new RegExp(profile.name, 'g');
  for (const file of files) {
    for (const m of file.raw.matchAll(name)) found.push(breach(file, lineOf(file.raw, m.index), m[0], 'R8.5'));
    for (const finding of scanNumbers(file.raw, CARD_VALUES)) found.push(breach(file, finding.line, finding.literal, 'R8.5'));
  }
  return found;
}

/** Row 8: `any`, `as any`, `@ts-ignore` and `@ts-expect-error` (R8.6). */
function escapeHatches(files: readonly SourceFile[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    for (const m of file.codeNoStrings.matchAll(/(?<![.\w$])any(?![\w$])/g)) {
      found.push(breach(file, lineOf(file.codeNoStrings, m.index), m[0], 'R8.6'));
    }
    // The two suppressions live in comments, so the raw text is what holds them.
    for (const m of file.raw.matchAll(/@ts-(?:ignore|expect-error)/g)) {
      found.push(breach(file, lineOf(file.raw, m.index), m[0], 'R8.6'));
    }
  }
  return found;
}

/** Row 10: a test file of this feature that is not under `tests/codec-view/` or `tests/ui/` (R8.8). */
function misplacedTestFiles(): string[] {
  const found: string[] = [];
  const feature = /(^|\/)codec-view(\/|$)|(^|\/)screens\/code(\/|$)|(^|\/)state\/codeView(\.ts)?$/;
  for (const file of filesUnder(TESTS, ['.test.ts', '.test.tsx']).map(load)) {
    for (const { specifier, line } of importSpecifiers(file.code)) {
      if (!feature.test(specifier)) continue;
      if (file.relative.startsWith('tests/codec-view/') || file.relative.startsWith('tests/ui/')) continue;
      found.push(breach(file, line, specifier, 'R8.8'));
    }
  }
  return found;
}

describe('Code view module boundaries', () => {
  it('the scan reads the module and the downstream modules, so a silent empty scan cannot pass', () => {
    expect(moduleFiles.length).toBeGreaterThan(0);
    expect(downstreamFiles.length).toBeGreaterThan(0);
    expect(moduleFiles.map((file) => file.relative)).toContain('src/codec-view/index.ts');
    expect(moduleFiles.flatMap((file) => importSpecifiers(file.code)).length).toBeGreaterThan(0);
    expect(downstreamFiles.flatMap((file) => importSpecifiers(file.code)).length).toBeGreaterThan(0);
    // The screen set is empty until Phase 3, and every check below holds on an empty set.
    expect(screenFiles.every((file) => isUnder(file, UI))).toBe(true);
  });

  it('R8.2 every specifier in src/codec-view resolves inside src/codec-view or src/codec', () => {
    expect(outsideSpecifiers(moduleFiles, [CODEC_VIEW, CODEC])).toEqual([]);
  });

  it('R8.2 no specifier in src/codec-view is bare, so it names no package and no Node built-in', () => {
    const bare = moduleFiles.flatMap((file) =>
      importSpecifiers(file.code)
        .filter(({ specifier }) => !specifier.startsWith('.'))
        .map(({ specifier, line }) => breach(file, line, specifier, 'R8.2')),
    );
    expect(bare).toEqual([]);
  });

  it('R8.3 no file in src/codec-view names React, the DOM or a browser API', () => {
    expect(apiUses(moduleFiles, BROWSER_API, 'R8.3')).toEqual([]);
  });

  it('R8.4 specifiers naming archive, simulator or react appear only in files under src/ui', () => {
    expect(specifiersOutsideUi(featureFiles, /(^|\/)(?:archive|simulator)(\/|$)|^react$|^react\//, 'R8.4')).toEqual([]);
  });

  it('R8.4 no file of this feature or of the downstream modules outside src/ui names src/ui', () => {
    expect(specifiersOutsideUi([...moduleFiles, ...downstreamFiles], /(^|\/)ui(\/|$)/, 'R8.4')).toEqual([]);
  });

  it('R8.12 no file in codec, reader, simulator, exporter or archive names codec-view', () => {
    expect(specifiersNaming(downstreamFiles, /(^|\/)codec-view(\/|$)/, 'R8.12')).toEqual([]);
  });

  it('R8.5 no file in src/codec-view holds the demo profile name or a card dimension as a literal', () => {
    expect(cardLiterals(moduleFiles)).toEqual([]);
  });

  it('R8.6 no file of this feature uses any, as any, @ts-ignore or @ts-expect-error', () => {
    expect(escapeHatches(featureFiles)).toEqual([]);
  });

  it('R4.1 no Code view file names a canvas drawing API of its own', () => {
    expect(apiUses(featureFiles, CANVAS_DRAWING_API, 'R4.1')).toEqual([]);
  });

  it('R8.8 every test file of this feature lives under tests/codec-view/ or tests/ui/', () => {
    expect(misplacedTestFiles()).toEqual([]);
  });

  it('R8.9 structure.md names src/codec-view, its five key exports and both dependency lines', () => {
    const text = readFileSync(STRUCTURE, 'utf8');
    expect(text).toContain('src/codec-view');
    for (const name of KEY_EXPORTS) expect(text, `structure.md does not name ${name}`).toContain(name);
    expect(text).toMatch(/^codec-view → codec$/m);
    expect(text).toMatch(/^ui →.*\bcodec-view\b/m);
  });
});

describe('the boundary checks report a planted breach, with the file, the thing and the criterion', () => {
  /** A file that is not on disk, so a check can be run against text written here (R8.11). */
  function plant(relative: string, text: string): SourceFile {
    return sourceFile(path.join(ROOT, relative), text);
  }

  const SHAPE = /^[\w./-]+:\d+: '[^']+' breaks R(?:8\.\d+|4\.1)$/;

  it('R8.11 a bare specifier in src/codec-view is reported as R8.2', () => {
    const planted = plant('src/codec-view/planted.ts', "import { useState } from 'react';\n");
    expect(outsideSpecifiers([planted], [CODEC_VIEW, CODEC])).toEqual(["src/codec-view/planted.ts:1: 'react' breaks R8.2"]);
  });

  it('R8.11 a specifier that leaves src/codec-view and src/codec is reported as R8.2', () => {
    const planted = plant('src/codec-view/planted.ts', "import type { X } from './types.ts';\nimport { openIndexedDbStore } from '../archive/idbStore.ts';\n");
    expect(outsideSpecifiers([planted], [CODEC_VIEW, CODEC])).toEqual([
      "src/codec-view/planted.ts:2: '../archive/idbStore.ts' breaks R8.2",
    ]);
  });

  it('R8.11 a browser API in src/codec-view is reported as R8.3, and one in a comment or a string is not', () => {
    const planted = plant('src/codec-view/planted.ts', 'const width = 1;\nconst found = document.title;\n');
    expect(apiUses([planted], BROWSER_API, 'R8.3')).toEqual(["src/codec-view/planted.ts:2: 'document' breaks R8.3"]);
    const quoted = plant('src/codec-view/planted.ts', "// document is named here\nconst key = 'document';\n");
    expect(apiUses([quoted], BROWSER_API, 'R8.3')).toEqual([]);
  });

  it('R8.11 an archive, simulator or react specifier outside src/ui is reported as R8.4, and the same one under src/ui is not', () => {
    const planted = plant('src/codec-view/planted.ts', "import { prepareCloth } from '../simulator/index.ts';\n");
    expect(specifiersOutsideUi([planted], /(^|\/)(?:archive|simulator)(\/|$)|^react$|^react\//, 'R8.4')).toEqual([
      "src/codec-view/planted.ts:1: '../simulator/index.ts' breaks R8.4",
    ]);
    const screen = plant('src/ui/screens/code/planted.ts', "import { prepareCloth } from '../../../simulator/index.ts';\nimport { useState } from 'react';\n");
    expect(specifiersOutsideUi([screen], /(^|\/)(?:archive|simulator)(\/|$)|^react$|^react\//, 'R8.4')).toEqual([]);
  });

  it('R8.11 a src/ui specifier in a file outside src/ui is reported as R8.4', () => {
    const planted = plant('src/codec/planted.ts', "import type { AppState } from '../ui/types.ts';\n");
    expect(specifiersOutsideUi([planted], /(^|\/)ui(\/|$)/, 'R8.4')).toEqual(["src/codec/planted.ts:1: '../ui/types.ts' breaks R8.4"]);
  });

  it('R8.11 a codec-view specifier in a downstream module is reported as R8.12', () => {
    const planted = plant('src/simulator/planted.ts', "import { cardToBits } from '../codec-view/index.ts';\n");
    expect(specifiersNaming([planted], /(^|\/)codec-view(\/|$)/, 'R8.12')).toEqual([
      "src/simulator/planted.ts:1: '../codec-view/index.ts' breaks R8.12",
    ]);
  });

  it('R8.11 the demo profile name and a card dimension in src/codec-view are reported as R8.5', () => {
    const planted = plant('src/codec-view/planted.ts', `const name = '${profile.name}';\nconst ends = ${profile.hookRows * profile.hookColumns};\n`);
    expect(cardLiterals([planted])).toEqual([
      `src/codec-view/planted.ts:1: '${profile.name}' breaks R8.5`,
      `src/codec-view/planted.ts:2: '${profile.hookRows * profile.hookColumns}' breaks R8.5`,
    ]);
  });

  it('R8.11 an any and a suppression comment are reported as R8.6', () => {
    const planted = plant('src/codec-view/planted.ts', 'const line = bits as any;\n// @ts-expect-error the stub has no body\n');
    expect(escapeHatches([planted])).toEqual([
      "src/codec-view/planted.ts:1: 'any' breaks R8.6",
      "src/codec-view/planted.ts:2: '@ts-expect-error' breaks R8.6",
    ]);
  });

  it('R4.1 a canvas drawing call in a Code view file is reported, and getContext is not', () => {
    const planted = plant('src/ui/screens/code/planted.tsx', "const context = canvas.getContext('2d');\ncontext.putImageData(image, 0, 0);\n");
    expect(apiUses([planted], CANVAS_DRAWING_API, 'R4.1')).toEqual(["src/ui/screens/code/planted.tsx:2: 'putImageData' breaks R4.1"]);
  });

  it('R8.11 every planted message names the file, the line, the thing and the criterion', () => {
    const planted = [
      ...outsideSpecifiers([plant('src/codec-view/planted.ts', "import 'node:fs';\n")], [CODEC_VIEW, CODEC]),
      ...apiUses([plant('src/codec-view/planted.ts', 'const f = window.fetch;\n')], BROWSER_API, 'R8.3'),
      ...specifiersNaming([plant('src/archive/planted.ts', "export { x } from '../codec-view/index.ts';\n")], /(^|\/)codec-view(\/|$)/, 'R8.12'),
      ...cardLiterals([plant('src/codec-view/planted.ts', `const hookRows = ${profile.hookRows};\n`)]),
      ...escapeHatches([plant('src/codec-view/planted.ts', 'function f(x: any) { return x; }\n')]),
      ...apiUses([plant('src/ui/state/codeView.ts', 'const image = new ImageData(data, 1, 1);\n')], CANVAS_DRAWING_API, 'R4.1'),
    ];
    expect(planted.length).toBeGreaterThan(6);
    for (const message of planted) expect(message, `message shape: ${message}`).toMatch(SHAPE);
  });

  it('R8.8 a test file of this feature outside tests/codec-view/ and tests/ui/ is reported, and the real tree has none', () => {
    const planted = plant('tests/structure/planted.test.ts', "import { cardToBits } from '../../src/codec-view/index.ts';\n");
    const feature = /(^|\/)codec-view(\/|$)/;
    const found = importSpecifiers(planted.code)
      .filter(({ specifier }) => feature.test(specifier))
      .map(({ specifier, line }) => breach(planted, line, specifier, 'R8.8'));
    expect(found).toEqual(["tests/structure/planted.test.ts:1: '../../src/codec-view/index.ts' breaks R8.8"]);
    expect(found[0]).toMatch(SHAPE);
    expect(misplacedTestFiles()).toEqual([]);
  });
});
