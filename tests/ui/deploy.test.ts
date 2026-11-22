import fc from 'fast-check';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseCardProfile } from '../../src/codec/index.ts';
import { buildPrecache } from '../../scripts/build_precache.ts';
import { CHUNK_MARKERS, SCAN_ONLY_MARKER, checkBundle, findAbsoluteUrls, findEntryChunk } from '../../scripts/check_bundle.ts';
import { IMAGE_CREDITS } from '../../src/ui/state/imageCredits.ts';
import { REPOSITORY_URL } from '../../src/ui/state/siteCredits.ts';
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
    // `headers` is the one key added by the security headers fix (tests/scripts/headers.test.ts checks its content); every other key is still refused.
    expect(config).toEqual({ framework: 'vite', buildCommand: 'npm run build', outputDirectory: 'dist', headers: config.headers });
    expect(Array.isArray(config.headers)).toBe(true);
    expect(config).not.toHaveProperty('rewrites');
  });

  it("R23.3 vite.config.ts sets base to './'", () => {
    expect(viteConfig.base).toBe('./');
  });

  it('R13.3 the only fetches in src/ui are the Card_Profile request, built from profileUrl(), and the demo images', () => {
    const calls: string[] = [];
    for (const file of filesUnder(SRC, /\.(ts|tsx)$/)) {
      const code = stripComments(readFileSync(file, 'utf8'), false);
      for (const match of code.matchAll(/\bfetch\s*\(([^)]*\)?)/g)) {
        calls.push(`${path.relative(SRC, file).split(path.sep).join('/')}: ${match[1]!.trim()}`);
      }
    }
    // The second is the Scan screen's demo images: a GET of a file served with the app (public/demo), nothing of the user's sent.
    expect(calls).toEqual(['ui/App.tsx: profileUrl()', 'ui/platform/browser.ts: demoImageUrl)']);
  });

  it('R13.7 no analytics string in the app source or index.html', () => {
    const files = [...filesUnder(SRC, /\.(ts|tsx|css)$/), path.join(ROOT, 'index.html')];
    const offenders = files.filter((file) =>
      /analytics|gtag|googletagmanager|plausible|hotjar|mixpanel|sentry/i.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('R13.2 the source has no account, API key, secret or environment value, and no committed env file', () => {
    const offenders: string[] = [];
    for (const file of filesUnder(SRC, /\.(ts|tsx)$/)) {
      const code = stripComments(readFileSync(file, 'utf8'), false);
      const relative = path.relative(SRC, file).split(path.sep).join('/');
      if (/process\.env|import\.meta\.env\.(?!BASE_URL\b)|import\.meta\.env\[/.test(code)) offenders.push(`${relative}: environment value`);
      if (/\b(api[_-]?key|secret|password|bearer|authorization|credentials)\b/i.test(code)) offenders.push(`${relative}: credential word`);
    }
    expect(offenders).toEqual([]);
    for (const dictionary of ['en.json', 'hi.json']) {
      const text = readFileSync(path.join(SRC, 'ui', 'i18n', dictionary), 'utf8');
      expect(text, dictionary).not.toMatch(/log ?in\b|sign ?in\b|password|\baccount\b/i);
    }
    const rootFiles = readdirSync(ROOT);
    expect(rootFiles.filter((name) => name.startsWith('.env') && name !== '.env.example')).toEqual([]);
    expect(JSON.parse(readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'))).not.toHaveProperty('env');
  });

  it('R13.5 every font stack ends in a generic family, and a web font is declared only in the token file, from a relative path', () => {
    const tokens = readFileSync(path.join(SRC, 'ui', 'theme', 'tokens.css'), 'utf8');
    const stacks = [...tokens.matchAll(/--font-[\w-]+:\s*([^;]+);/g)].map((match) => match[1]!.trim());
    expect(stacks.length).toBeGreaterThanOrEqual(3);
    for (const stack of stacks) {
      const last = stack.split(',').pop()!.trim();
      expect(['serif', 'sans-serif', 'monospace', 'system-ui'], stack).toContain(last);
    }
    for (const file of filesUnder(SRC, /\.css$/)) {
      const withFaces = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(withFaces, `${file} imports a style sheet`).not.toMatch(/@import/);
      // Only the token file declares fonts (R1.2), and each src is a path with no scheme and no host.
      const faces = [...withFaces.matchAll(/@font-face\s*\{[^}]*\}/g)].map((match) => match[0]);
      if (!file.endsWith(`${path.sep}theme${path.sep}tokens.css`)) expect(faces, `${file} declares a web font`).toEqual([]);
      for (const face of faces) {
        for (const source of face.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) expect(source[1], `${file}: ${source[1]}`).toMatch(/^\/?fonts\/[\w-]+\.woff2$/);
      }
      const css = withFaces.replace(/@font-face\s*\{[^}]*\}/g, '');
      for (const match of css.matchAll(/font-family:\s*([^;]+);/g)) {
        const value = match[1]!.trim();
        const generic = /(^|,)\s*(serif|sans-serif|monospace|system-ui)\s*$/.test(value);
        expect(generic || /^var\(--font-[\w-]+\)$/.test(value), `${file}: ${value}`).toBe(true);
      }
    }
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
    // `npm run build` ends with this step, so the built site checked below is the one a host would serve (R24.6).
    const precache = buildPrecache(outDir);
    expect(precache.problems, precache.problems.join('\n')).toEqual([]);
  }, 120_000);

  afterAll(() => {
    if (outDir !== '') rmSync(outDir, { recursive: true, force: true });
  });

  it('R16.1 R23.3 the gzipped entry chunk is under 200 KB and dist/index.html has no absolute URL', () => {
    const report = checkBundle(outDir);
    expect(report.problems).toEqual([]);
    expect(report.gzippedBytes).toBeGreaterThan(0);
  });

  it('cards-as-code R9.3 R9.9 the Scan and Code view markers are each in exactly one chunk, and not the entry chunk', () => {
    expect(CHUNK_MARKERS.map((entry) => entry.name)).toEqual(['Scan', 'Code view']);
    expect(SCAN_ONLY_MARKER).toBe(CHUNK_MARKERS[0]!.marker);
    expect(CHUNK_MARKERS.map((entry) => entry.marker)).toContain('naqsha-code-view-listing');
    const report = checkBundle(outDir);
    const entryText = readFileSync(path.join(outDir, report.entryChunk), 'utf8');
    for (const { name, marker } of CHUNK_MARKERS) {
      expect(entryText.includes(marker), `${name} marker in the entry chunk`).toBe(false);
      const holding = report.markerChunks.filter((chunk) => chunk.name === name);
      expect(holding, `${name} marker chunks`).toHaveLength(1);
      expect(holding[0]!.file).not.toBe(path.basename(report.entryChunk));
      expect(holding[0]!.gzippedBytes).toBeGreaterThan(0);
    }
  });

  it('R13.4 the entry chunk requests the Card_Profile at a path that exists inside the Built_Site', () => {
    const entry = findEntryChunk(readFileSync(path.join(outDir, 'index.html'), 'utf8'));
    expect(entry).not.toBeNull();
    const chunk = readFileSync(path.join(outDir, entry!), 'utf8');
    expect(chunk).toContain('profiles/demo-12x16.json');
    expect(existsSync(path.join(outDir, 'profiles', 'demo-12x16.json'))).toBe(true);
  });

  it('R23.7 the production build contains no third-party URL, no analytics and no network API other than fetch', async () => {
    // The shared build above runs under NODE_ENV=test, so it holds React's development text. Build a production copy.
    const productionDir = mkdtempSync(path.join(os.tmpdir(), 'naqsha-dist-prod-'));
    try {
      await build({
        root: ROOT,
        logLevel: 'silent',
        mode: 'production',
        define: { 'process.env.NODE_ENV': JSON.stringify('production') },
        build: { outDir: productionDir, emptyOutDir: true },
      });
      const allowedUrl = /^https?:\/\/(www\.w3\.org\/|react\.dev\/errors)/;
      // The links the footer shows: the licence and source page of each photo (read from docs/IMAGE_CREDITS.md, the exact
      // addresses and nothing else) and the app's own repository. They are links a visitor may follow, never requests the page makes.
      // The real card photos' CREDITS.md is bundled whole to read its authors and licences; its addresses are links too.
      const realCardLinks = (readFileSync(path.join(ROOT, 'public/demo/real-cards/CREDITS.md'), 'utf8').match(/https?:\/\/[^\s"'`)\\]+/g) ?? []);
      const creditLinks = [...IMAGE_CREDITS.flatMap((credit) => [credit.licenceUrl, credit.sourceUrl]), ...realCardLinks];
      expect(creditLinks.length).toBeGreaterThan(0);
      const allowedLink = (url: string): boolean =>
        // The address pattern below stops at a closing parenthesis, so a link that holds one is seen up to it.
        creditLinks.some((link) => link === url || link.startsWith(`${url})`)) ||
        url === REPOSITORY_URL ||
        url.startsWith(`${REPOSITORY_URL}/`);
      const files = filesUnder(productionDir, /\.(js|css|html)$/);
      expect(files.length).toBeGreaterThan(0);
      const offenders: string[] = [];
      for (const file of files) {
        const text = readFileSync(file, 'utf8');
        for (const url of text.match(/https?:\/\/[^\s"'`)\\]+/g) ?? []) {
          if (!allowedUrl.test(url) && !allowedLink(url)) offenders.push(`${path.relative(productionDir, file)}: ${url}`);
        }
        if (/analytics|gtag|googletagmanager|plausible|hotjar|mixpanel|sentry|XMLHttpRequest|sendBeacon|WebSocket|EventSource/i.test(text)) {
          offenders.push(`${path.relative(productionDir, file)}: analytics or network API`);
        }
      }
      expect(offenders).toEqual([]);
    } finally {
      rmSync(productionDir, { recursive: true, force: true });
    }
  }, 120_000);

  it('R23.13 no README media file is part of the Built_Site', () => {
    const mediaNames = new Set(readdirSync(path.join(ROOT, 'media')).filter((name) => name !== '.gitkeep'));
    expect(mediaNames.size).toBeGreaterThan(0);
    const built = filesUnder(outDir, /.*/).map((file) => path.basename(file));
    expect(built.filter((name) => mediaNames.has(name))).toEqual([]);
    expect(existsSync(path.join(outDir, 'media'))).toBe(false);
  });

  it('R23.8 dist/profiles/demo-12x16.json is valid JSON that parseCardProfile accepts', () => {
    const text = readFileSync(path.join(outDir, 'profiles', 'demo-12x16.json'), 'utf8');
    expect(parseCardProfile(JSON.parse(text)).ok).toBe(true);
  });
});
