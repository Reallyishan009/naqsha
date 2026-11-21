import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES } from '../../../src/ui/i18n/messages.ts';
import { ART, ART_LIST, artUrl } from '../../../src/ui/state/art.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const visibleFiles = (directory: string): string[] => readdirSync(path.join(ROOT, directory)).filter((name) => !name.startsWith('.'));
const directoryBytes = (directory: string): number =>
  visibleFiles(directory).reduce((sum, name) => sum + statSync(path.join(ROOT, directory, name)).size, 0);

/**
 * The pixel size an AVIF file declares: the largest of its `ispe` boxes. An encoder that cuts a big picture into tiles
 * declares each tile too, and the whole picture is the largest.
 */
function avifSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  let largest: { width: number; height: number } | null = null;
  for (let at = bytes.indexOf('ispe', 0, 'latin1'); at >= 0; at = bytes.indexOf('ispe', at + 4, 'latin1')) {
    const size = { width: bytes.readUInt32BE(at + 8), height: bytes.readUInt32BE(at + 12) };
    if (largest === null || size.width * size.height > largest.width * largest.height) largest = size;
  }
  if (largest === null) throw new Error(`${file} has no ispe box`);
  return largest;
}

describe('app-made art in public/art', () => {
  it('the catalogue lists every file in public/art once, and no file that is missing', () => {
    expect(ART_LIST.map((art) => art.file).sort()).toEqual(visibleFiles('public/art').sort());
    expect(Object.values(ART).map((art) => art.id).sort()).toEqual(ART_LIST.map((art) => art.id).sort());
  });

  it('every picture has an alt text in English and in Hindi (marked not reviewed) that says more than a file name', () => {
    for (const art of ART_LIST) {
      const english = DICTIONARIES.en[art.altKey] ?? '';
      const hindi = DICTIONARIES.hi[art.altKey];
      expect(english.length, `en ${art.altKey}`).toBeGreaterThan(40);
      expect(hindi?.text.length ?? 0, `hi ${art.altKey}`).toBeGreaterThan(40);
      expect(english).not.toMatch(/\.(avif|jpe?g|png)\b/i);
      expect(hindi?.reviewed, `hi ${art.altKey} reviewed`).toBe(false);
    }
  });

  it('each file is an AVIF of the size the catalogue gives', () => {
    for (const art of ART_LIST) {
      const file = path.join(ROOT, 'public/art', art.file);
      expect(readFileSync(file).subarray(4, 12).toString('latin1'), art.file).toBe('ftypavif');
      expect(avifSize(file), art.file).toEqual({ width: art.width, height: art.height });
    }
  });

  it('public/photos and public/art together weigh at most 600,000 bytes, and the art at most 264,000', () => {
    const art = directoryBytes('public/art');
    expect(art).toBeLessThanOrEqual(264_000);
    expect(art + directoryBytes('public/photos')).toBeLessThanOrEqual(600_000);
  });

  it('artUrl joins the base and the file', () => {
    expect(artUrl('./', 'chain-8.avif')).toBe('./art/chain-8.avif');
    expect(artUrl('/naqsha/', 'chain-8.avif')).toBe('/naqsha/art/chain-8.avif');
  });
});
