import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Photo } from '../../../src/ui/components/Photo.tsx';
import { PhotoCredits } from '../../../src/ui/components/PhotoCredits.tsx';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { IMAGE_CREDITS } from '../../../src/ui/state/imageCredits.ts';
import { PHOTOS, PHOTO_LIST, photoSrcSet, photoUrl } from '../../../src/ui/state/photos.ts';

const ROOT = path.resolve(import.meta.dirname, '../..', '..');
const PHOTO_FILES = readdirSync(path.join(ROOT, 'public/photos')).filter((name) => !name.startsWith('.'));
const en = translator(DICTIONARIES, 'en');
const hi = translator(DICTIONARIES, 'hi');

describe('photo catalogue', () => {
  it('lists every file in public/photos once, and no file that is missing', () => {
    const listed = PHOTO_LIST.flatMap((photo) => photo.files.map((entry) => entry.file));
    expect([...listed].sort()).toEqual([...PHOTO_FILES].sort());
  });

  it('each photo has an alt text in English and in Hindi that says more than the file name', () => {
    for (const photo of PHOTO_LIST) {
      const english = DICTIONARIES.en[photo.altKey] ?? '';
      const hindi = DICTIONARIES.hi[photo.altKey]?.text ?? '';
      expect(english.length, `en ${photo.altKey}`).toBeGreaterThan(40);
      expect(hindi.length, `hi ${photo.altKey}`).toBeGreaterThan(40);
      expect(english).not.toMatch(/\.(avif|jpe?g|png)\b/i);
      expect(DICTIONARIES.hi[photo.altKey]?.reviewed, `hi ${photo.altKey} reviewed`).toBe(false);
    }
  });

  it('the files of one photo share one shape', () => {
    for (const photo of PHOTO_LIST) {
      const [first, ...rest] = photo.files;
      for (const entry of rest) expect(entry.width / entry.height).toBeCloseTo(first.width / first.height, 2);
    }
  });

  it('photoSrcSet gives width descriptors for the hero and nothing for a single file', () => {
    expect(photoSrcSet(PHOTOS['loom-hero'], './')).toBe('./photos/loom-hero-800.avif 800w, ./photos/loom-hero-1600.avif 1600w');
    expect(photoSrcSet(PHOTOS['sari-pattern-cards'], './')).toBeUndefined();
    expect(photoUrl('/', 'a.avif')).toBe('/photos/a.avif');
  });
});

describe('Photo', () => {
  it('the hero renders an img with a 800 and 1600 srcset, width and height, alt, and no lazy loading by default', () => {
    const markup = renderToStaticMarkup(<Photo photo={PHOTOS['loom-hero']} alt="A loom" sizes="100vw" />);
    // React's server renderer adds a preload link before an eager image; the app renders in the browser.
    expect(markup).toContain('<img ');
    expect(markup).toContain('loom-hero-800.avif 800w');
    expect(markup).toContain('loom-hero-1600.avif 1600w');
    expect(markup).toContain('width="1600"');
    expect(markup).toContain('height="900"');
    expect(markup).toContain('alt="A loom"');
    expect(markup).not.toContain('loading=');
  });

  it('the lazy option sets loading="lazy"; a one-file photo has no srcset', () => {
    const markup = renderToStaticMarkup(<Photo photo={PHOTOS['bradford-card-stack']} alt="Cards" lazy />);
    expect(markup).toContain('loading="lazy"');
    expect(markup).not.toContain('srcSet');
    expect(markup).not.toContain('srcset');
    expect(markup).toContain('width="675"');
    expect(markup).toContain('height="900"');
  });

  it('the placeholder colour is a token, never a literal', () => {
    const css = readFileSync(path.join(ROOT, 'src/ui/components/Photo.module.css'), 'utf8');
    expect(css).toMatch(/background-color:\s*var\(--[\w-]+\)/);
    expect(css).not.toMatch(/gradient|#[0-9a-f]{3,8}\b/i);
  });
});

describe('PhotoCredits', () => {
  it('lists author, title, licence link, source link and the change for every credit, in English', () => {
    const markup = renderToStaticMarkup(<PhotoCredits t={en} />);
    for (const credit of IMAGE_CREDITS) {
      expect(markup).toContain(credit.author.replaceAll('&', '&amp;'));
      expect(markup).toContain(`href="${credit.licenceUrl}"`);
      expect(markup).toContain(`>${credit.licenceName}</a>`);
      expect(markup).toContain(`href="${credit.sourceUrl.replaceAll('&', '&amp;')}"`);
    }
    expect(markup.match(/resized, converted/g)).toHaveLength(IMAGE_CREDITS.length);
    expect(markup.match(/<li /g)).toHaveLength(IMAGE_CREDITS.length);
  });

  it('is written in Hindi when the translator is Hindi, with the same links', () => {
    const markup = renderToStaticMarkup(<PhotoCredits t={hi} />);
    expect(markup).toContain(DICTIONARIES.hi['credits.photos.heading']?.text);
    expect(markup).not.toContain('resized, converted');
    expect(markup.match(/href="https:\/\/creativecommons\.org/g)).toHaveLength(IMAGE_CREDITS.length);
  });
});
