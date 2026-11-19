import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../support/source.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const README = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
const PUBLIC_URL = 'https://naqsha-ashen.vercel.app/';
const GIFS = ['media/weave-sample.gif', 'media/scan-printed-card.gif', 'media/keep-export.gif'];
const BANNER = 'media/banner.png';

/** The text of one level-2 section, from its heading to the next level-2 heading. */
function section(heading: string): string {
  const start = README.indexOf(`\n## ${heading}\n`);
  expect(start, `README has no "## ${heading}" section`).toBeGreaterThan(-1);
  const rest = README.slice(start + 1);
  const next = rest.indexOf('\n## ', 1);
  return next === -1 ? rest : rest.slice(0, next);
}

/** Every markdown image: alt text and target. */
function images(): { alt: string; target: string }[] {
  return [...README.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)].map((match) => ({ alt: match[1]!, target: match[2]! }));
}

function startsWith(file: string, bytes: number[]): boolean {
  const head = readFileSync(path.join(ROOT, file)).subarray(0, bytes.length);
  return bytes.every((byte, index) => head[index] === byte);
}

describe('README deployment text', () => {
  it('R23.4 the README documents the Vercel steps: import, Vite preset, build command, output directory, public URL', () => {
    const text = section('Deploy to Vercel');
    expect(text).toMatch(/import this repository/i);
    expect(text).toMatch(/Framework preset: \*\*Vite\*\*/);
    expect(text).toContain('Build command: `npm run build`');
    expect(text).toContain('Output directory: `dist`');
    expect(text).toMatch(/public URL/i);
  });

  it('R23.5 the README states the public URL and that the site needs no login', () => {
    expect(README).toContain(`Public URL: ${PUBLIC_URL}`);
    expect(README).toMatch(/no login/i);
  });

  it('R23.6 the README shows how to run npm run build and npm run preview to check the built site locally', () => {
    const start = README.indexOf('Check the built site locally');
    expect(start).toBeGreaterThan(-1);
    const fenceStart = README.indexOf('```', start);
    const fenceEnd = README.indexOf('```', fenceStart + 3);
    const block = README.slice(fenceStart, fenceEnd);
    expect(block).toMatch(/^npm run build\b/m);
    expect(block).toMatch(/^npm run preview\b/m);
    expect(block.indexOf('npm run build')).toBeLessThan(block.indexOf('npm run preview'));
  });

  it('R23.14 the README states that the profile values are illustrative and unverified and that no loom controller has been tested', () => {
    expect(README).toMatch(/illustrative and unverified/i);
    expect(README).toMatch(/No loom controller has been tested/i);
  });
});

describe('README media', () => {
  it('R23.9 media/ holds one banner image and at least three GIF files, each a real file of its type', () => {
    expect(startsWith(BANNER, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])).toBe(true);
    const gifs = readdirSync(path.join(ROOT, 'media')).filter((name) => name.endsWith('.gif'));
    expect(gifs.length).toBeGreaterThanOrEqual(3);
    for (const file of GIFS) {
      expect(existsSync(path.join(ROOT, file)), file).toBe(true);
      // "GIF8" followed by "7a" or "9a".
      expect(startsWith(file, [0x47, 0x49, 0x46, 0x38]), file).toBe(true);
    }
  });

  it('R23.10 the README opens with the banner and references each GIF once, and every reference resolves to a file', () => {
    const firstLine = README.split('\n').find((line) => line.trim() !== '');
    expect(firstLine).toMatch(new RegExp(`^!\\[[^\\]]+\\]\\(${BANNER.replace('.', '\\.')}\\)$`));
    const targets = images().map((image) => image.target);
    for (const file of [BANNER, ...GIFS]) expect(targets.filter((target) => target === file), file).toHaveLength(1);
    for (const target of targets) expect(existsSync(path.join(ROOT, target)), target).toBe(true);
  });

  it('R23.12 every README image is at most 5 MB and has alternative text that says what it shows', () => {
    const subjects: [string, RegExp][] = [
      [BANNER, /card/i],
      ['media/weave-sample.gif', /weave|cloth/i],
      ['media/scan-printed-card.gif', /scan|read/i],
      ['media/keep-export.gif', /export|bitmap|file/i],
    ];
    for (const [file, subject] of subjects) {
      expect(statSync(path.join(ROOT, file)).size, file).toBeLessThanOrEqual(MAX_MEDIA_BYTES);
      const image = images().find((candidate) => candidate.target === file);
      expect(image, `${file} is not referenced`).toBeDefined();
      expect(image!.alt.trim().split(/\s+/).length, `${file} alt text is too short`).toBeGreaterThanOrEqual(4);
      expect(image!.alt, file).toMatch(subject);
    }
    for (const image of images()) {
      expect(statSync(path.join(ROOT, image.target)).size, image.target).toBeLessThanOrEqual(MAX_MEDIA_BYTES);
      expect(image.alt.trim(), image.target).not.toBe('');
    }
  });

  it('R23.13 no app source, entry page or public file refers to media/, so the media is not part of the Built_Site', () => {
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else files.push(full);
      }
    };
    walk(path.join(ROOT, 'src'));
    walk(path.join(ROOT, 'public'));
    files.push(path.join(ROOT, 'index.html'));
    const offenders = files.filter((file) => /media\//.test(stripComments(readFileSync(file, 'utf8'), false)));
    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([]);
    // Nothing from media/ is copied into public/, which Vite copies into dist/.
    const mediaNames = new Set(readdirSync(path.join(ROOT, 'media')));
    const copied = files.filter((file) => file.includes(`${path.sep}public${path.sep}`) && mediaNames.has(path.basename(file)));
    expect(copied).toEqual([]);
  });
});
