import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { iconFileName, iconPng, ICON_SIZES, rasteriseRects, svgRects, svgViewSize } from '../../scripts/make_icons.ts';
import { manifestLinkProblems, manifestProblems, MANIFEST_FILE } from '../../scripts/check_bundle.ts';
import type { WebManifest } from '../../scripts/check_bundle.ts';
import { parsePngInfo } from '../../scripts/checks/pngHeader.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FAVICON = readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8');
const MANIFEST = JSON.parse(readFileSync(path.join(ROOT, 'public', MANIFEST_FILE), 'utf8')) as WebManifest;
const TOKENS = readFileSync(path.join(ROOT, 'src/ui/theme/tokens.css'), 'utf8');

const token = (name: string): string => {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(TOKENS);
  if (match === null) throw new Error(`no --${name} token`);
  return match[1]!.trim();
};

describe('web app manifest and icons', () => {
  it('R24.7 the manifest has the fields an installable app needs, with relative icon paths', () => {
    expect(manifestProblems(MANIFEST)).toEqual([]);
    expect(MANIFEST.start_url).toBe('./');
    expect(MANIFEST.display).toBe('standalone');
  });

  it('R24.7 R15.1 the manifest colours are Day loom tokens', () => {
    expect(MANIFEST.theme_color).toBe(token('surface'));
    expect(MANIFEST.background_color).toBe(token('ground'));
  });

  it('R23.3 index.html links the manifest and the icon by relative paths', () => {
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(manifestLinkProblems(html)).toEqual([]);
    expect(html).toContain('href="./icons/icon-192.png"');
    expect(html).toContain(`content="${MANIFEST.theme_color}"`);
  });

  it('R24.7 every icon the manifest names is a checked-in PNG of the size it declares', () => {
    const icons = MANIFEST.icons ?? [];
    expect(icons.length).toBe(ICON_SIZES.length);
    for (const icon of icons) {
      const bytes = readFileSync(path.join(ROOT, 'public', icon.src.replace(/^\.\//, '')));
      const parsed = parsePngInfo(bytes);
      expect(parsed.ok, icon.src).toBe(true);
      if (!parsed.ok) continue;
      expect(`${parsed.info.width}x${parsed.info.height}`).toBe(icon.sizes);
      expect(parsed.info.crcsValid).toBe(true);
    }
  });

  it('R24.7 the checked-in icons are the ones the generator makes from favicon.svg', () => {
    for (const size of ICON_SIZES) {
      const checkedIn = readFileSync(path.join(ROOT, 'public/icons', iconFileName(size)));
      expect(Buffer.from(iconPng(FAVICON, size)).equals(checkedIn), `${iconFileName(size)} is not what make_icons.ts produces`).toBe(true);
    }
  });

  it('the favicon mark is read as a square of filled rectangles in Day loom colours', () => {
    expect(svgViewSize(FAVICON)).toBe(32);
    const rects = svgRects(FAVICON);
    // One background rectangle and the squares of the mark.
    expect(rects.length).toBeGreaterThan(8);
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 32, height: 32, fill: token('ground') });
    const fills = new Set(rects.map((rect) => rect.fill.toUpperCase()));
    expect(fills).toEqual(new Set([token('ground'), token('indigo'), token('zari')].map((value) => value.toUpperCase())));
  });

  it('the rasteriser fills every pixel of the icon and scales the mark', () => {
    const rects = svgRects(FAVICON);
    const pixels = rasteriseRects(rects, svgViewSize(FAVICON), 64);
    expect(pixels.length).toBe(64 * 64 * 4);
    for (let at = 3; at < pixels.length; at += 4) expect(pixels[at]).toBe(255);
    // The top-left square of the mark is the ground colour at 2x scale, the one beside it is not.
    const colourAt = (x: number, y: number): string => {
      const at = (y * 64 + x) * 4;
      return `#${[pixels[at]!, pixels[at + 1]!, pixels[at + 2]!].map((value) => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
    };
    expect(colourAt(2, 2)).toBe(token('ground').toUpperCase());
    expect(colourAt(12, 12)).toBe(token('indigo').toUpperCase());
  });

  it('a favicon without a square viewBox or with an unusable fill is refused', () => {
    expect(() => svgViewSize('<svg viewBox="0 0 32 16"></svg>')).toThrow(/square viewBox/);
    expect(() => svgViewSize('<svg></svg>')).toThrow(/square viewBox/);
    expect(() => rasteriseRects([{ x: 0, y: 0, width: 1, height: 1, fill: 'red' }], 1, 1)).toThrow(/six-digit hex colour/);
  });
});
