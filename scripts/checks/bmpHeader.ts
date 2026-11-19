/**
 * Direct parse of a BMP header, written without the exporter, so `npm run check:browser` checks a downloaded
 * file against an independent reading of the format. Pure: bytes in, values out.
 */
export type BmpHeader = {
  /** File size written in the file header. */
  declaredFileSize: number;
  /** Number of bytes actually given. */
  byteLength: number;
  pixelOffset: number;
  infoHeaderSize: number;
  width: number;
  height: number;
  bitsPerPixel: number;
  compression: number;
  imageSize: number;
  /** The "colours used" header field. */
  colourCount: number;
  /** Colour table entries actually present between the info header and the pixels. */
  colourTableEntries: number;
};

export type BmpHeaderResult = { ok: true; header: BmpHeader } | { ok: false; reason: string };

const FILE_HEADER_BYTES = 14;
const INFO_HEADER_BYTES = 40;
const HEADERS_BYTES = FILE_HEADER_BYTES + INFO_HEADER_BYTES;

export function parseBmpHeader(bytes: Uint8Array): BmpHeaderResult {
  if (bytes.length < HEADERS_BYTES) return { ok: false, reason: `only ${bytes.length} bytes, a BMP header needs ${HEADERS_BYTES}` };
  if (bytes[0] !== 0x42 || bytes[1] !== 0x4d) return { ok: false, reason: 'no "BM" signature' };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const pixelOffset = view.getUint32(10, true);
  return {
    ok: true,
    header: {
      declaredFileSize: view.getUint32(2, true),
      byteLength: bytes.length,
      pixelOffset,
      infoHeaderSize: view.getUint32(14, true),
      width: view.getInt32(18, true),
      height: view.getInt32(22, true),
      bitsPerPixel: view.getUint16(28, true),
      compression: view.getUint32(30, true),
      imageSize: view.getUint32(34, true),
      colourCount: view.getUint32(46, true),
      colourTableEntries: Math.max(0, Math.floor((pixelOffset - HEADERS_BYTES) / 4)),
    },
  };
}

/**
 * The size of an uncompressed BMP with a colour table, from the format alone: rows padded to 4 bytes,
 * 2 table entries for 1 bit and 256 for 8 bits, 4 bytes per entry.
 */
export function expectedBmpFileSize(width: number, height: number, bitsPerPixel: 1 | 8): number {
  const rowBytes = Math.ceil((width * bitsPerPixel) / 8);
  const paddedRow = Math.ceil(rowBytes / 4) * 4;
  const entries = bitsPerPixel === 1 ? 2 : 256;
  return HEADERS_BYTES + 4 * entries + paddedRow * height;
}

export type BmpExpectation = { width: number; height: number; bitsPerPixel: 1 | 8 };

/** Every way the header differs from what was expected. An empty list means the file matches. */
export function bmpMismatches(header: BmpHeader, expected: BmpExpectation): string[] {
  const problems: string[] = [];
  const entries = expected.bitsPerPixel === 1 ? 2 : 256;
  const size = expectedBmpFileSize(expected.width, expected.height, expected.bitsPerPixel);
  const check = (name: string, actual: number, wanted: number): void => {
    if (actual !== wanted) problems.push(`${name} is ${actual}, expected ${wanted}`);
  };
  check('width', header.width, expected.width);
  check('height', header.height, expected.height);
  check('bits per pixel', header.bitsPerPixel, expected.bitsPerPixel);
  check('colour count', header.colourCount, entries);
  check('colour table entries', header.colourTableEntries, entries);
  check('compression', header.compression, 0);
  check('info header size', header.infoHeaderSize, INFO_HEADER_BYTES);
  check('declared file size', header.declaredFileSize, size);
  check('file size on disk', header.byteLength, size);
  return problems;
}
