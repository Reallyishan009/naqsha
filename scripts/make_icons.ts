/**
 * Generates the web app manifest icons from `public/favicon.svg` with no dependency (R24.7): it reads the
 * rectangles of the favicon mark and fills them into an RGBA buffer, then writes the PNG with the encoder in
 * `scripts/png_rgba.ts`. The rounded corner of the background (`rx`) is not drawn, so the icon is a full square.
 *
 * Usage (Node 22.18+ runs .ts directly):
 *   node scripts/make_icons.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { encodePngRgba } from './png_rgba.ts';

/** One filled rectangle of the mark, in the SVG's own user units. */
export type SvgRect = { x: number; y: number; width: number; height: number; fill: string };

export const ICON_SIZES = [192, 512] as const;

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`).exec(tag);
  return match === null ? null : match[1]!;
}

function numberAttribute(tag: string, name: string, fallback: number): number {
  const value = attribute(tag, name);
  const parsed = value === null ? Number.NaN : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** The side of the square viewBox, so the mark scales to any icon size. */
export function svgViewSize(svg: string): number {
  const box = /\bviewBox\s*=\s*"([^"]*)"/.exec(svg);
  const parts = (box?.[1] ?? '').trim().split(/\s+/).map(Number);
  const [minX, minY, width, height] = parts;
  if (parts.length !== 4 || minX !== 0 || minY !== 0 || !Number.isFinite(width) || width !== height || width === undefined || width <= 0) {
    throw new Error(`the favicon needs a square viewBox starting at 0 0, found "${box?.[1] ?? 'none'}"`);
  }
  return width;
}

/** Every `<rect>` of the SVG in document order, each with the fill of its own tag or of the group holding it. */
export function svgRects(svg: string): SvgRect[] {
  const rects: SvgRect[] = [];
  const groupFills: string[] = [];
  for (const match of svg.matchAll(/<(\/?)(g|rect)\b([^>]*)>/g)) {
    const [, closing, name, rest] = match;
    const tag = `<${name}${rest ?? ''}>`;
    if (name === 'g') {
      if (closing === '/') groupFills.pop();
      else groupFills.push(attribute(tag, 'fill') ?? '#000000');
      continue;
    }
    if (closing === '/') continue;
    rects.push({
      x: numberAttribute(tag, 'x', 0),
      y: numberAttribute(tag, 'y', 0),
      width: numberAttribute(tag, 'width', 0),
      height: numberAttribute(tag, 'height', 0),
      fill: attribute(tag, 'fill') ?? groupFills[groupFills.length - 1] ?? '#000000',
    });
  }
  return rects;
}

function colourBytes(fill: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(fill.trim());
  if (match === null) throw new Error(`the favicon uses the fill "${fill}", which is not a six-digit hex colour`);
  const value = Number.parseInt(match[1]!, 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

/** Fills the rectangles into a `size` by `size` opaque RGBA buffer, later rectangles over earlier ones. */
export function rasteriseRects(rects: readonly SvgRect[], viewSize: number, size: number): Uint8Array {
  const pixels = new Uint8Array(size * size * 4);
  const scale = size / viewSize;
  for (const rect of rects) {
    const [red, green, blue] = colourBytes(rect.fill);
    const left = Math.max(0, Math.round(rect.x * scale));
    const top = Math.max(0, Math.round(rect.y * scale));
    const right = Math.min(size, Math.round((rect.x + rect.width) * scale));
    const bottom = Math.min(size, Math.round((rect.y + rect.height) * scale));
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const at = (y * size + x) * 4;
        pixels[at] = red;
        pixels[at + 1] = green;
        pixels[at + 2] = blue;
        pixels[at + 3] = 255;
      }
    }
  }
  return pixels;
}

/** The PNG bytes of the icon of that size, from the favicon source. */
export function iconPng(svg: string, size: number): Buffer {
  return encodePngRgba(size, size, rasteriseRects(svgRects(svg), svgViewSize(svg), size));
}

export const iconFileName = (size: number): string => `icon-${size}.png`;

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  const publicDir = path.join(import.meta.dirname, '../public');
  const svg = readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8');
  for (const size of ICON_SIZES) {
    const file = path.join(publicDir, 'icons', iconFileName(size));
    writeFileSync(file, iconPng(svg, size));
    console.log(`wrote ${path.relative(path.join(publicDir, '..'), file)} (${size}x${size})`);
  }
}
