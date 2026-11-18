import type { Result } from '../../codec/index.ts';
import type { PixelData } from '../../reader/index.ts';
import { printableLayout } from './layout.ts';
import type { Disc } from './layout.ts';
import { HOLE_RGB, RING_RGB, RING_THICKNESS_FRACTION, STOCK_RGB } from './style.ts';

/** Default rendering resolution for downloads, about 305 dpi. It is a resolution, not a card dimension. */
export const DEFAULT_PIXELS_PER_MM = 12;

type Rgb = readonly [number, number, number];

/** Sets every pixel whose centre lies with inner <= distance <= outer of the centre (millimetres). */
function paintRing(pixels: PixelData, pixelsPerMm: number, disc: Disc, innerMm: number, rgb: Rgb): void {
  const { width, height, data } = pixels;
  const outerMm = disc.diameterMm / 2;
  const minX = Math.max(0, Math.floor((disc.centreMm.x - outerMm) * pixelsPerMm - 1));
  const maxX = Math.min(width - 1, Math.ceil((disc.centreMm.x + outerMm) * pixelsPerMm + 1));
  const minY = Math.max(0, Math.floor((disc.centreMm.y - outerMm) * pixelsPerMm - 1));
  const maxY = Math.min(height - 1, Math.ceil((disc.centreMm.y + outerMm) * pixelsPerMm + 1));
  const outerSquared = outerMm * outerMm;
  const innerSquared = innerMm * innerMm;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x + 0.5) / pixelsPerMm - disc.centreMm.x;
      const dy = (y + 0.5) / pixelsPerMm - disc.centreMm.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared <= outerSquared && distanceSquared >= innerSquared) {
        const offset = (y * width + x) * 4;
        data[offset] = rgb[0];
        data[offset + 1] = rgb[1];
        data[offset + 2] = rgb[2];
        data[offset + 3] = 255;
      }
    }
  }
}

/**
 * Draws the printable card as RGBA pixels, round(widthMm * pixelsPerMm) by round(heightMm * pixelsPerMm).
 * Each pixel centre is tested against the discs and rings of the layout, with no supersampling.
 * Invalid profile, grid or resolution gives violations and no pixels (R21.17).
 */
export function printableRaster(profile: unknown, grid: unknown, pixelsPerMm: number): Result<PixelData> {
  const layout = printableLayout(profile, grid);
  if (!layout.ok) return layout;
  if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) {
    return {
      ok: false,
      violations: [
        {
          kind: 'not-a-positive-number',
          location: 'pixelsPerMm',
          message: 'The resolution must be a positive number of pixels per millimetre.',
          actual: pixelsPerMm,
        },
      ],
    };
  }
  const { widthMm, heightMm, hookMarks, pegHoles, lacingHoles } = layout.value;
  const width = Math.max(1, Math.round(widthMm * pixelsPerMm));
  const height = Math.max(1, Math.round(heightMm * pixelsPerMm));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = STOCK_RGB[0];
    data[offset + 1] = STOCK_RGB[1];
    data[offset + 2] = STOCK_RGB[2];
    data[offset + 3] = 255;
  }
  const pixels: PixelData = { width, height, data };

  for (const mark of hookMarks) {
    if (!mark.punched) {
      const innerMm = (mark.diameterMm / 2) * (1 - 2 * RING_THICKNESS_FRACTION);
      paintRing(pixels, pixelsPerMm, mark, innerMm, RING_RGB);
    }
  }
  const filled: Disc[] = [...hookMarks.filter((mark) => mark.punched), ...pegHoles, ...lacingHoles];
  for (const disc of filled) paintRing(pixels, pixelsPerMm, disc, 0, HOLE_RGB);
  return { ok: true, value: pixels };
}
