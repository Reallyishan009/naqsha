import { crc32, inflateSync } from 'node:zlib';
import { LIMITS } from './limits.ts';
import { ToolError } from './result.ts';
/** RGBA, the top line of pixels first: the reader's own pixel type. */
export type DecodedPng = { width: number; height: number; data: Uint8ClampedArray };
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
/** Samples per pixel for each colour type this decoder reads (all at 8 bits). */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
function notPng(message: string): ToolError {
  return new ToolError('not_png', message, 'Give an 8-bit PNG photo of one card, saved without interlacing.');
}
function unsupported(message: string): ToolError {
  return new ToolError('unsupported_png', message, 'Re-save the photo as an 8-bit PNG without interlacing, in grey, RGB, RGBA or palette colour.');
}
function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  return distanceUp <= distanceUpLeft ? up : upLeft;
}
/**
 * Decodes a PNG into RGBA pixels. Reads 8-bit, non-interlaced images of colour type 0, 2, 3, 4 and 6 with all five
 * filters, and checks every chunk's length and CRC. The pixel count is checked before any image data is inflated.
 * Throws a ToolError: not_png for damaged data, unsupported_png for a form it does not read, too_large for size.
 */
export function decodePng(bytes: Uint8Array, maxPixels: number = LIMITS.pngPixels): DecodedPng {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buffer.length < 8 || SIGNATURE.some((value, index) => buffer[index] !== value)) throw notPng('The file is not a PNG.');
  let header: { width: number; height: number; bitDepth: number; colourType: number; interlace: number } | null = null;
  let palette: Buffer | null = null;
  const parts: Buffer[] = [];
  let ended = false;
  let offset = 8;
  while (offset < buffer.length && !ended) {
    if (offset + 12 > buffer.length) throw notPng('The PNG ends in the middle of a chunk.');
    const length = buffer.readUInt32BE(offset);
    if (length > buffer.length - offset - 12) throw notPng('A PNG chunk is longer than the file.');
    const type = buffer.subarray(offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const stored = buffer.readUInt32BE(offset + 8 + length);
    if (crc32(data, crc32(type)) >>> 0 !== stored) throw notPng('A PNG chunk is damaged (its checksum is wrong).');
    const name = type.toString('latin1');
    if (name === 'IHDR') {
      if (length !== 13 || header !== null) throw notPng('The PNG header is wrong.');
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8]!,
        colourType: data[9]!,
        interlace: data[12]!,
      };
      const { width, height } = header;
      if (width === 0 || height === 0) throw notPng('The PNG has no pixels.');
      if (width * height > maxPixels) {
        throw new ToolError('too_large', `The PNG has ${width} x ${height} pixels, more than the limit of ${maxPixels}.`, 'Scale the photo down and try again.');
      }
      if (data[10] !== 0 || data[11] !== 0) throw notPng('The PNG uses an unknown compression or filter method.');
      if (header.bitDepth === 16) throw unsupported('The PNG has 16 bits per sample.');
      if (header.bitDepth !== 8) throw unsupported(`The PNG has ${header.bitDepth} bits per sample.`);
      if (CHANNELS[header.colourType] === undefined) throw unsupported(`The PNG has colour type ${header.colourType}.`);
      if (header.interlace !== 0) throw unsupported('The PNG is interlaced.');
    } else if (header === null) {
      throw notPng('The PNG does not start with its header.');
    } else if (name === 'PLTE') {
      palette = Buffer.from(data);
    } else if (name === 'IDAT') {
      parts.push(Buffer.from(data));
    } else if (name === 'IEND') {
      ended = true;
    }
    offset += 12 + length;
  }
  if (header === null || parts.length === 0 || !ended) throw notPng('The PNG is incomplete.');
  const { width, height, colourType } = header;
  const channels = CHANNELS[colourType]!;
  const stride = width * channels;
  const expected = (stride + 1) * height;
  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(parts), { maxOutputLength: expected + 1 });
  } catch {
    throw notPng('The PNG image data is damaged.');
  }
  if (raw.length !== expected) throw notPng('The PNG image data has the wrong size.');
  const lines = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    if (filter > 4) throw notPng('A PNG scanline has an unknown filter.');
    const source = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? lines[y * stride + x - channels]! : 0;
      const up = y > 0 ? lines[(y - 1) * stride + x]! : 0;
      const upLeft = y > 0 && x >= channels ? lines[(y - 1) * stride + x - channels]! : 0;
      const value = raw[source + x]!;
      const predicted = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up : filter === 3 ? (left + up) >> 1 : paeth(left, up, upLeft);
      lines[y * stride + x] = (value + predicted) & 0xff;
    }
  }
  const data = new Uint8ClampedArray(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const at = pixel * channels;
    const to = pixel * 4;
    if (colourType === 0) {
      data[to] = data[to + 1] = data[to + 2] = lines[at]!;
      data[to + 3] = 255;
    } else if (colourType === 2) {
      data[to] = lines[at]!;
      data[to + 1] = lines[at + 1]!;
      data[to + 2] = lines[at + 2]!;
      data[to + 3] = 255;
    } else if (colourType === 3) {
      const entry = lines[at]! * 3;
      if (palette === null || entry + 2 >= palette.length) throw notPng('A PNG pixel points outside its palette.');
      data[to] = palette[entry]!;
      data[to + 1] = palette[entry + 1]!;
      data[to + 2] = palette[entry + 2]!;
      data[to + 3] = 255;
    } else if (colourType === 4) {
      data[to] = data[to + 1] = data[to + 2] = lines[at]!;
      data[to + 3] = lines[at + 1]!;
    } else {
      data[to] = lines[at]!;
      data[to + 1] = lines[at + 1]!;
      data[to + 2] = lines[at + 2]!;
      data[to + 3] = lines[at + 3]!;
    }
  }
  return { width, height, data };
}
