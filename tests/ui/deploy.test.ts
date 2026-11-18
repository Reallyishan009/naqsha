import fc from 'fast-check';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseCardProfile } from '../../src/codec/index.ts';
import { checkBundle, findAbsoluteUrls, findEntryChunk } from '../../scripts/check_bundle.ts';
import viteConfig from '../../vite.config.ts';
import { stripComments } from '../support/source.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SRC = path.join(ROOT, 'src');

function filesUnder(dir: string, pattern: RegExp): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return filesUnder(full, pattern);
    return pattern.test(entry.name) ? [full] : [];
  });
}

describe('deploy configuration', () => {
  it('R23.2 vercel.json names the Vite framework, build command npm run build, output dist and no rewrite', () => {
    const config = JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')) as Record<string, unknown>;
    expect(config).toEqual({ framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist' });
    expect(config).not.toHaveProperty('rewrites');
  });

  it("R23.3 vite.config.ts sets base to './'", () => {
    expect(viteConfig.base).toBe('./');
  });

  it('R13.3 the only fetch in src/ui is the Card_Profile request, built from profileUrl()', () => {
    const calls: string[] = [];
    for (const file of filesUnder(SRC, /\.(ts|tsx)$/)) {
      const code = stripComments(readFileSync(file, 'utf8'), false);
      for (const match of code.matchAll(/\bfetch\s*\(([^)]*\)?)/g)) {
        calls.push(`${path.relative(SRC, file).split(path.sep).join('/')}: ${match[1]!.trim()}`);
      }
    }
    expect(calls).toEqual(['ui/App.tsx: profileUrl()']);
  });

  it('R13.7 no analytics string in the app source or index.html', () => {
    const files = [...filesUnder(SRC, /\.(ts|tsx|css)$/), path.join(ROOT, 'index.html')];
    const offenders = files.filter((file) =>
      /analytics|gtag|googletagmanager|plausible|hotjar|mixpanel|sentry/i.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('R13.6 no http font or other URL in the CSS', () => {
    const offenders = filesUnder(SRC, /\.css$/).filter((file) => /https?:|\/\//.test(readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));
    expect(offenders).toEqual([]);
  });
});

describe('check_bundle helpers', () => {
  const attributeValue = fc.stringMatching(/^[a-z0-9._-]{1,12}$/);

  it('R23.3 a src or href that starts with / or http is reported, and a relative one is not', () => {
    fc.assert(
      fc.property(
        attributeValue,
        fc.constantFrom('/', 'http://', 'https://'),
        fc.constantFrom('src', 'href'),
        (name, prefix, attribute) => {
          expect(findAbsoluteUrls(`<a ${attribute}="${prefix}${name}">`)).toEqual([`${prefix}${name}`]);
          expect(findAbsoluteUrls(`<a ${attribute}="./${name}">`)).toEqual([]);
        },
      ),
    );
  });

  it('R23.3 findEntryChunk returns the module script of index.html', () => {
    const html = '<script type="module" crossorigin src="./assets/index-abc.js"></script>';
    expect(findEntryChunk(html)).toBe('./assets/index-abc.js');
    expect(findEntryChunk('<p>none</p>')).toBeNull();
  });

  it('R23.3 findAbsoluteUrls flags the unbuilt index.html, which uses /src/main.tsx', () => {
    expect(findAbsoluteUrls(readFileSync(path.join(ROOT, 'index.html'), 'utf8'))).toEqual(['/src/main.tsx']);
  });
});

describe('built site', () => {
  let outDir = '';

  beforeAll(async () => {
    outDir = mkdtempSync(path.join(os.tmpdir(), 'naqsha-dist-'));
    await build({ root: ROOT, logLevel: 'silent', build: { outDir, emptyOutDir: true } });
  }, 120_000);

  afterAll(() => {
    if (outDir !== '') rmSync(outDir, { recursive: true, force: true });
  });

  it('R16.1 R23.3 the gzipped entry chunk is under 200 KB and dist/index.html has no absolute URL', () => {
    const report = checkBundle(outDir);
    expect(report.problems).toEqual([]);
    expect(report.gzippedBytes).toBeGreaterThan(0);
  });

  it('R23.8 dist/profiles/demo-12x16.json is valid JSON that parseCardProfile accepts', () => {
    const text = readFileSync(path.join(outDir, 'profiles', 'demo-12x16.json'), 'utf8');
    expect(parseCardProfile(JSON.parse(text)).ok).toBe(true);
  });
});
