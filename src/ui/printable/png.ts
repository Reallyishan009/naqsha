/** Pure PNG byte handling for the printable card. No browser API (R21.10). */

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const MAX_PIXELS_PER_METRE = 0x7fffffff;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 as the PNG specification defines it (polynomial 0xEDB88320), as an unsigned 32-bit number. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

type Chunk = { type: string; start: number; end: number };

/** Splits the bytes after the signature into chunks. Throws a RangeError when a chunk runs past the end. */
function readChunks(png: Uint8Array): Chunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: Chunk[] = [];
  let offset = SIGNATURE.length;
  while (offset < png.length) {
    if (offset + 12 > png.length) throw new RangeError('withPixelDensity: truncated chunk');
    const length = view.getUint32(offset);
    const end = offset + 12 + length;
    if (end > png.length) throw new RangeError('withPixelDensity: truncated chunk');
    const type = String.fromCharCode(png[offset + 4]!, png[offset + 5]!, png[offset + 6]!, png[offset + 7]!);
    chunks.push({ type, start: offset, end });
    offset = end;
  }
  return chunks;
}

/**
 * Returns a copy of the PNG with one `pHYs` chunk giving the same density on both axes, unit metre (R21.8).
 * Any existing `pHYs` chunk is removed first, and the new one goes right after `IHDR`, so calling it twice
 * gives the same bytes as calling it once. `pixelsPerMetre` is rounded to a whole number.
 * Throws a RangeError for a missing PNG signature, a missing `IHDR` first chunk, a truncated chunk or a density
 * outside 1 to 2147483647.
 */
export function withPixelDensity(png: Uint8Array, pixelsPerMetre: number): Uint8Array {
  const density = Math.round(pixelsPerMetre);
  if (!Number.isFinite(density) || density < 1 || density > MAX_PIXELS_PER_METRE) {
    throw new RangeError('withPixelDensity: density must be between 1 and 2147483647 pixels per metre');
  }
  if (png.length < SIGNATURE.length || SIGNATURE.some((value, i) => png[i] !== value)) {
    throw new RangeError('withPixelDensity: not a PNG (bad signature)');
  }
  const chunks = readChunks(png);
  const first = chunks[0];
  if (first === undefined || first.type !== 'IHDR') throw new RangeError('withPixelDensity: IHDR must be the first chunk');

  const chunkBytes = new Uint8Array(21); // length, type, 9 data bytes, CRC
  const view = new DataView(chunkBytes.buffer);
  view.setUint32(0, 9);
  chunkBytes.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  view.setUint32(8, density);
  view.setUint32(12, density);
  chunkBytes[16] = 1; // unit: metre
  view.setUint32(17, crc32(chunkBytes.subarray(4, 17)));

  const kept = chunks.filter((chunk) => chunk.type !== 'pHYs');
  const size = SIGNATURE.length + kept.reduce((sum, chunk) => sum + chunk.end - chunk.start, 0) + chunkBytes.length;
  const out = new Uint8Array(size);
  out.set(SIGNATURE, 0);
  let offset = SIGNATURE.length;
  kept.forEach((chunk, index) => {
    out.set(png.subarray(chunk.start, chunk.end), offset);
    offset += chunk.end - chunk.start;
    if (index === 0) {
      out.set(chunkBytes, offset);
      offset += chunkBytes.length;
    }
  });
  return out;
}
