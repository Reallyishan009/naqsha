import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { DemoCards } from '../../../src/ui/screens/scan/DemoCards.tsx';
import {
  creditFor,
  fetchDemoImage,
  MADE_DEMO_CARDS,
  parseRealCardCredits,
  REAL_CARD_CREDITS,
  REAL_DEMO_CARDS,
} from '../../../src/ui/state/demoCards.ts';
import { readPhoto } from '../../../src/ui/state/scan.ts';
import { decodePng } from '../../support/png.ts';
import { demoProfile } from '../../support/profiles.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const REAL_DIR = path.join(ROOT, 'public/demo/real-cards');
const CARDS_DIR = path.join(ROOT, 'public/demo/cards');
const REAL_FILES = readdirSync(REAL_DIR).filter((name) => name.endsWith('.jpg'));
const t = translator(DICTIONARIES, 'en');

describe('real card credits parsed from public/demo/real-cards/CREDITS.md', () => {
  it('the folder holds the eight photos', () => {
    expect(REAL_FILES).toHaveLength(8);
  });
  it('every file in the folder has exactly one credit with an author and a licence', () => {
    for (const file of REAL_FILES) {
      const matches = REAL_CARD_CREDITS.filter((credit) => credit.files.includes(file));
      expect(matches, file).toHaveLength(1);
      expect(matches[0]?.author, file).not.toBe('');
      expect(matches[0]?.licenceName, file).not.toBe('');
    }
  });
  it('every credit names only files that exist, and every file is in the shown list', () => {
    for (const credit of REAL_CARD_CREDITS) for (const file of credit.files) expect(REAL_FILES).toContain(file);
    expect(REAL_DEMO_CARDS.map((image) => path.basename(image.path)).sort()).toEqual([...REAL_FILES].sort());
  });
  it('every made demo card shown is a file in public/demo/cards, and the seven are all shown', () => {
    const files = readdirSync(CARDS_DIR).filter((name) => name.endsWith('.png')).sort();
    expect(MADE_DEMO_CARDS.map((image) => path.basename(image.path)).sort()).toEqual(files);
    expect(files).toHaveLength(7);
  });
  it('a range of numbers in a file name is expanded and a plain licence has no link', () => {
    const credits = parseRealCardCredits('| File | Source | Author | Licence |\n|---|---|---|---|\n| a-1..3-x.jpg, b.jpg | [s](https://x) | Ann | CC0 (none) |');
    expect(credits).toEqual([{ files: ['a-1-x.jpg', 'a-2-x.jpg', 'a-3-x.jpg', 'b.jpg'], author: 'Ann', licenceName: 'CC0 (none)', licenceUrl: undefined }]);
  });
  it('a licence link gives its name and its address', () => {
    expect(creditFor('demo/real-cards/real-card-sari-pattern-ccby.jpg')?.licenceUrl).toBe('https://creativecommons.org/licenses/by/2.0/');
  });
  it('lines that are not credits are skipped', () => {
    expect(parseRealCardCredits('# Title\nnot a table\n| a | b |')).toEqual([]);
  });
});

describe('fetching a demo image', () => {
  const ok = (bytes: Uint8Array<ArrayBuffer>) => () => Promise.resolve(new Response(bytes, { headers: { 'content-type': 'image/png' } }));
  it('an image that is fetched becomes a File with the name of the image', async () => {
    const result = await fetchDemoImage('./x.png', 'x.png', ok(new Uint8Array(new ArrayBuffer(3))), () => true);
    expect(result.kind).toBe('file');
    if (result.kind === 'file') {
      expect(result.file.name).toBe('x.png');
      expect(result.file.size).toBe(3);
    }
  });
  it('a failed fetch while offline is "offline", not a scan error', async () => {
    const result = await fetchDemoImage('./x.png', 'x.png', () => Promise.reject(new TypeError('Failed to fetch')), () => false);
    expect(result).toEqual({ kind: 'offline' });
  });
  it('a response that is not ok while offline is "offline"; while online it is "failed"', async () => {
    const missing = () => Promise.resolve(new Response('', { status: 404 }));
    expect(await fetchDemoImage('./x.png', 'x.png', missing, () => false)).toEqual({ kind: 'offline' });
    expect(await fetchDemoImage('./x.png', 'x.png', missing, () => true)).toEqual({ kind: 'failed' });
  });
  it('a fetched demo card is read by the same readPhoto as a chosen photo, and the blank one fails', async () => {
    const read = async (name: string) => {
      const bytes = new Uint8Array(readFileSync(path.join(CARDS_DIR, name)));
      const fetched = await fetchDemoImage(`./${name}`, name, ok(bytes), () => true);
      if (fetched.kind !== 'file') throw new Error('not fetched');
      return readPhoto(demoProfile(), fetched.file, async (blob) => decodePng(new Uint8Array(await blob.arrayBuffer())));
    };
    expect((await read('card-1-clean.png')).kind).toBe('read');
    expect((await read('card-blank-should-fail.png')).kind).toBe('failed');
  });
});

describe('the Demo cards', () => {
  const html = renderToStaticMarkup(DemoCards({ t, base: './', busy: false, notice: null, onDemo: () => undefined }));
  it('shows a Demo chip, the seven made cards and the eight real photos, each with a button and a download link', () => {
    expect(html).toContain('Demo cards');
    expect(html).toContain('>Demo<');
    for (const name of ['Clean 1', 'Clean 2', 'Clean 3', 'Tilted', 'Noisy', 'Noisy and tilted', 'No card (should fail)']) {
      expect(html).toContain(`>${name}<`);
    }
    expect((html.match(/<button/g) ?? []).length).toBe(15);
    expect((html.match(/ download=/g) ?? []).length).toBe(15);
    expect(html).toContain('href="./demo/cards/card-1-noisy-tilted.png"');
  });
  it('says what the real photos are and credits each one', () => {
    expect(html).toContain('may not read these correctly');
    expect(html).toContain('Robert-brook, CC0 (no rights reserved)');
    expect(html).toContain('McKay Savage, CC BY 2.0');
  });
  it('shows the needs-a-connection message and nothing else for an offline press', () => {
    const offline = renderToStaticMarkup(DemoCards({ t, base: './', busy: false, notice: 'offline', onDemo: () => undefined }));
    expect(offline).toContain('needs a connection');
    expect(offline).not.toContain('could not be read');
  });
  it('the thumbnails wait while a photo is being read', () => {
    const busy = renderToStaticMarkup(DemoCards({ t, base: './', busy: true, notice: null, onDemo: () => undefined }));
    expect((busy.match(/<button[^>]* disabled/g) ?? []).length).toBe(15);
  });
});

describe('the demo image paths', () => {
  it('every demo image is a file under demo/ that exists in public', () => {
    for (const image of [...MADE_DEMO_CARDS, ...REAL_DEMO_CARDS]) {
      expect(image.path.startsWith('demo/'), image.path).toBe(true);
      expect(readdirSync(path.join(ROOT, 'public', path.dirname(image.path))), image.path).toContain(path.basename(image.path));
    }
  });
});
