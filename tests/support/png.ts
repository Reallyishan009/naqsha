import { inflateSync } from 'node:zlib';
import type { PixelData } from '../../src/reader/types';
import { greyToPixelData } from './images';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Decodes an 8-bit greyscale PNG (colour type 0, no interlace, every scanline filter 0) into RGBA pixel data
 * with r = g = b = level and alpha 255. Throws an Error on any other format or on damaged data.
 */
export function decodePng(bytes: Uint8Array): PixelData {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length < 8 || SIGNATURE.some((value, i) => buffer[i] !== value)) {
    throw new Error('decodePng: not a PNG (bad signature)');
  }

  let width = -1;
  let height = -1;
  let sawHeader = false;
  let sawEnd = false;
  const dataChunks: Buffer[] = [];
  let offset = 8;
  while (offset < buffer.length && !sawEnd) {
    if (offset + 12 > buffer.length) throw new Error('decodePng: truncated chunk header');
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error(`decodePng: truncated ${type} chunk`);
    const data = buffer.subarray(dataStart, dataEnd);
    if (type === 'IHDR') {
      if (length !== 13) throw new Error('decodePng: IHDR must be 13 bytes');
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [bitDepth, colourType, compression, filterMethod, interlace] = [data[8], data[9], data[10], data[11], data[12]];
      if (bitDepth !== 8) throw new Error(`decodePng: unsupported bit depth ${bitDepth}, only 8 is supported`);
      if (colourType !== 0) throw new Error(`decodePng: unsupported colour type ${colourType}, only 0 (greyscale) is supported`);
      if (compression !== 0) throw new Error(`decodePng: unsupported compression method ${compression}`);
      if (filterMethod !== 0) throw new Error(`decodePng: unsupported filter method ${filterMethod}`);
      if (interlace !== 0) throw new Error(`decodePng: unsupported interlace method ${interlace}`);
      if (width < 1 || height < 1) throw new Error('decodePng: width and height must be positive');
      sawHeader = true;
    } else {
      if (!sawHeader) throw new Error('decodePng: IHDR must be the first chunk');
      if (type === 'IDAT') dataChunks.push(data);
      if (type === 'IEND') sawEnd = true;
    }
    const storedCrc = buffer.readUInt32BE(dataEnd);
    if (crc32(buffer.subarray(offset + 4, dataEnd)) !== storedCrc) {
      throw new Error(`decodePng: CRC mismatch in ${type} chunk`);
    }
    offset = dataEnd + 4;
  }
  if (!sawHeader) throw new Error('decodePng: missing IHDR');
  if (dataChunks.length === 0) throw new Error('decodePng: missing IDAT');

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(dataChunks));
  } catch (error) {
    throw new Error(`decodePng: cannot inflate image data (${error instanceof Error ? error.message : String(error)})`);
  }
  const stride = width + 1;
  if (raw.length !== stride * height) {
    throw new Error(`decodePng: image data is ${raw.length} bytes, expected ${stride * height}`);
  }
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride]!;
    if (filter !== 0) throw new Error(`decodePng: scanline ${y} uses filter ${filter}, only filter 0 is supported`);
    pixels.set(raw.subarray(y * stride + 1, (y + 1) * stride), y * width);
  }
  return greyToPixelData({ width, height, pixels });
}
