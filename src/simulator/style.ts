/** Fixed palette. These are colours, not card dimensions, so they are not settings. */
export const BACKGROUND_COLOUR = '#efe9dd';
export const ZARI_GOLD_COLOUR = '#c9a227';
export const ZARI_SILVER_COLOUR = '#b8bcc4';
/** Zari highlight colours, drawn unshaded (R5.5). */
export const ZARI_GOLD_HIGHLIGHT_COLOUR = '#fff2c4';
export const ZARI_SILVER_HIGHLIGHT_COLOUR = '#ffffff';
/** A zari weft cell gets a highlight pixel in its centre row at every column with u mod 4 = 0, u = x mod (baseEnds * t) measured from the start of each repeat. */
export const ZARI_HIGHLIGHT_COLUMN_STEP = 4;

/** Float highlight colour (R3.3). */
export const FLOAT_HIGHLIGHT_COLOUR = '#ff00c8';

/**
 * Blends one colour channel halfway toward a target channel, integer only: (channel + target) >> 1.
 * A highlighted cell has every pixel blended this way with the target #ff00c8, zari highlight pixels included.
 */
export function blendHalfway(channel: number, target: number): number {
  return (channel + target) >> 1;
}

/** Gap row colours (R4.2, R4.3): grey `/` hatch for a missing card, dark red `X` cross-hatch for a damaged card, on white. */
export const GAP_WHITE_COLOUR = '#ffffff';
export const GAP_MISSING_COLOUR = '#808080';
export const GAP_DAMAGED_COLOUR = '#b00020';
/** The hatch period in px, and how many px of each period are inked. */
export const GAP_HATCH_PERIOD = 6;
export const GAP_HATCH_WIDTH = 2;

/** Modulo that is never negative. */
export function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

/** True where the `/` diagonal is inked: (x + y) mod 6 < 2, with x the column measured from the start of each repeat (u) and y the absolute image row. */
export function isSlashInk(x: number, y: number): boolean {
  return positiveModulo(x + y, GAP_HATCH_PERIOD) < GAP_HATCH_WIDTH;
}

/** True where the `X` cross-hatch is inked: the `/` diagonal or (x - y) mod 6 < 2. */
export function isCrossInk(x: number, y: number): boolean {
  return isSlashInk(x, y) || positiveModulo(x - y, GAP_HATCH_PERIOD) < GAP_HATCH_WIDTH;
}

/**
 * Shade factor for each position 0..t-1 across a thread t px wide or tall: edges 160, centre about 255.
 * Integer only, so the same input gives the same table everywhere (R8.3).
 */
export function shadeTable(t: number): number[] {
  const table: number[] = [];
  const span = (t - 1) * (t - 1);
  for (let i = 0; i < t; i++) {
    table.push(160 + Math.floor((95 * 4 * i * (t - 1 - i)) / span));
  }
  return table;
}

/** One colour channel times a shade factor, integer only. */
export function shadeChannel(channel: number, shade: number): number {
  return (channel * shade) >> 8;
}

const LITTLE_ENDIAN = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

/** Packs opaque RGB as one 32-bit word so that writing it through a Uint32Array gives R, G, B, 255 bytes in order. */
export function packRgb(r: number, g: number, b: number): number {
  if (LITTLE_ENDIAN) return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
  return ((r << 24) | (g << 16) | (b << 8) | 255) >>> 0;
}

/** Packs a shaded colour: each channel is (channel * shade) >> 8. */
export function packShaded(rgb: readonly [number, number, number], shade: number): number {
  return packRgb(shadeChannel(rgb[0], shade), shadeChannel(rgb[1], shade), shadeChannel(rgb[2], shade));
}
