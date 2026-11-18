import type { PrintableLayout } from './layout.ts';
import { HOLE_RGB, RING_RGB, RING_THICKNESS_FRACTION, STOCK_RGB, rgbHex } from './style.ts';

/** Fixed precision for every number written, so the file is the same every time. */
function num(value: number): string {
  return value.toFixed(4).replace(/\.?0+$/, '');
}

/**
 * The printable card as an SVG with all coordinates in millimetres (R21.5, R21.7).
 * Drawing only: no text, no metadata (R21.18).
 */
export function printableSvg(layout: PrintableLayout): string {
  const { widthMm, heightMm } = layout;
  const hole = rgbHex(HOLE_RGB);
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(widthMm)}mm" height="${num(heightMm)}mm" viewBox="0 0 ${num(widthMm)} ${num(heightMm)}">`,
    `<rect x="0" y="0" width="${num(widthMm)}" height="${num(heightMm)}" fill="${rgbHex(STOCK_RGB)}"/>`,
  ];
  const disc = (cx: number, cy: number, diameterMm: number): string =>
    `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(diameterMm / 2)}" fill="${hole}"/>`;
  for (const mark of layout.hookMarks) {
    const { x, y } = mark.centreMm;
    if (mark.punched) {
      parts.push(disc(x, y, mark.diameterMm));
    } else {
      const thickness = RING_THICKNESS_FRACTION * mark.diameterMm;
      parts.push(
        `<circle cx="${num(x)}" cy="${num(y)}" r="${num((mark.diameterMm - thickness) / 2)}" fill="none" stroke="${rgbHex(RING_RGB)}" stroke-width="${num(thickness)}"/>`,
      );
    }
  }
  for (const peg of layout.pegHoles) parts.push(disc(peg.centreMm.x, peg.centreMm.y, peg.diameterMm));
  for (const lacing of layout.lacingHoles) parts.push(disc(lacing.centreMm.x, lacing.centreMm.y, lacing.diameterMm));
  parts.push('</svg>');
  return parts.join('\n');
}
