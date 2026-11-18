/** Fixed palette. These are colours, not card dimensions, so they are not settings. */
export const BACKGROUND_COLOUR = '#efe9dd';
export const ZARI_GOLD_COLOUR = '#c9a227';
export const ZARI_SILVER_COLOUR = '#b8bcc4';
/** Zari highlight colours, drawn unshaded (R5.5). */
export const ZARI_GOLD_HIGHLIGHT_COLOUR = '#fff2c4';
export const ZARI_SILVER_HIGHLIGHT_COLOUR = '#ffffff';
/** A zari weft cell gets a highlight pixel in its centre row at every absolute column x with x mod 4 = 0. */
export const ZARI_HIGHLIGHT_COLUMN_STEP = 4;

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
