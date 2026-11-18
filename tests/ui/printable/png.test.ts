import { crc32 as zlibCrc32 } from 'node:zlib';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodePngRgba } from '../../../scripts/png_rgba.ts';
import { crc32, withPixelDensity } from '../../../src/ui/printable/png.ts';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

type ParsedChunk = { type: string; data: Uint8Array; crc: number; bytes: Uint8Array };

/** An independent chunk reader for the checks, written without using the code under test. */
function parseChunks(png: Uint8Array): ParsedChunk[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const chunks: ParsedChunk[] = [];
  let offset = 8;
  while (offset < png.length) {
    const length = view.getUint32(offset);
    const type = Buffer.from(png.subarray(offset + 4, offset + 8)).toString('ascii');
    chunks.push({
      type,
      data: png.subarray(offset + 8, offset + 8 + length),
      crc: view.getUint32(offset + 8 + length),
      bytes: png.subarray(offset, offset + 12 + length),
    });
    offset += 12 + length;
  }
  return chunks;
}

function chunkBytes(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = Buffer.from(type, 'ascii');
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  typeBytes.copy(out, 4);
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(zlibCrc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return out;
}

/** Valid PNG bytes: a small RGBA image, optionally with an ancillary chunk after IHDR. */
const pngArbitrary: fc.Arbitrary<Uint8Array> = fc
  .record({
    width: fc.integer({ min: 1, max: 6 }),
    height: fc.integer({ min: 1, max: 6 }),
    seed: fc.integer({ min: 0, max: 0xffff }),
    extra: fc.option(fc.uint8Array({ minLength: 0, maxLength: 12 }), { nil: undefined }),
  })
  .map(({ width, height, seed, extra }) => {
    const data = new Uint8Array(width * height * 4).map((_, i) => (Math.imul(i + 1, 2654435761) ^ seed) & 0xff);
    const png = encodePngRgba(width, height, data);
    if (extra === undefined) return new Uint8Array(png);
    const ihdrEnd = 8 + 12 + 13;
    return new Uint8Array(Buffer.concat([png.subarray(0, ihdrEnd), chunkBytes('gAMA', extra), png.subarray(ihdrEnd)]));
  });

const densityArbitrary = fc.integer({ min: 1, max: 1_000_000 });

describe('crc32', () => {
  it('R21.8 gives the known check value for the text 123456789', () => {
    expect(crc32(Buffer.from('123456789', 'ascii'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('R21.8 equals the Node zlib CRC-32 for any bytes', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 300 }), (bytes) => {
        expect(crc32(bytes)).toBe(zlibCrc32(bytes));
      }),
      { seed: 3601, numRuns: 100 },
    );
  });
});

describe('withPixelDensity', () => {
  it('R21.8 Property 36 inserting the density keeps the PNG intact and is idempotent', () => {
    fc.assert(
      fc.property(pngArbitrary, densityArbitrary, densityArbitrary, (png, density, earlierDensity) => {
        const before = parseChunks(png);
        const once = withPixelDensity(png, density);
        // The original chunks stay, byte for byte and in order, plus one pHYs right after IHDR.
        const after = parseChunks(once);
        expect(Array.from(once.subarray(0, 8))).toEqual(SIGNATURE);
        expect(after.map((chunk) => chunk.type)).toEqual(['IHDR', 'pHYs', ...before.slice(1).map((chunk) => chunk.type)]);
        expect(after.filter((chunk) => chunk.type === 'pHYs')).toHaveLength(1);
        expect(after[0]!.bytes).toEqual(before[0]!.bytes);
        expect(after.slice(2).map((chunk) => Array.from(chunk.bytes))).toEqual(
          before.slice(1).map((chunk) => Array.from(chunk.bytes)),
        );
        const physical = after[1]!;
        const view = new DataView(physical.data.buffer, physical.data.byteOffset, physical.data.byteLength);
        expect(physical.data).toHaveLength(9);
        expect(view.getUint32(0)).toBe(density);
        expect(view.getUint32(4)).toBe(density);
        expect(physical.data[8]).toBe(1);
        expect(physical.crc).toBe(zlibCrc32(Buffer.concat([Buffer.from('pHYs', 'ascii'), physical.data])));
        // The first pHYs comes before the first IDAT.
        expect(after.findIndex((chunk) => chunk.type === 'pHYs')).toBeLessThan(
          after.findIndex((chunk) => chunk.type === 'IDAT'),
        );
        // Idempotent, and an earlier pHYs is replaced, not kept.
        expect(withPixelDensity(once, density)).toEqual(once);
        expect(withPixelDensity(withPixelDensity(png, earlierDensity), density)).toEqual(once);
      }),
      { seed: 3602, numRuns: 100 },
    );
  });

  it('R21.8 writes 12000 pixels per metre for 12 pixels per millimetre', () => {
    const png = encodePngRgba(1, 1, new Uint8Array(4));
    const chunks = parseChunks(withPixelDensity(png, 12 * 1000));
    expect(chunks.map((chunk) => chunk.type)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    const view = new DataView(chunks[1]!.data.buffer, chunks[1]!.data.byteOffset, 9);
    expect(view.getUint32(0)).toBe(12000);
    expect(view.getUint32(4)).toBe(12000);
  });

  it('R21.8 rejects bytes that are not a PNG, a missing IHDR, truncation and a bad density', () => {
    const png = new Uint8Array(encodePngRgba(2, 2, new Uint8Array(16)));
    expect(() => withPixelDensity(new Uint8Array([1, 2, 3]), 1000)).toThrow(RangeError);
    expect(() => withPixelDensity(new Uint8Array(0), 1000)).toThrow(RangeError);
    const badSignature = png.slice();
    badSignature[1] = 0;
    expect(() => withPixelDensity(badSignature, 1000)).toThrow(RangeError);
    expect(() => withPixelDensity(png.subarray(0, png.length - 5), 1000)).toThrow(RangeError);
    expect(() => withPixelDensity(png.subarray(0, 8), 1000)).toThrow(RangeError);
    expect(() => withPixelDensity(png, 0)).toThrow(RangeError);
    expect(() => withPixelDensity(png, Number.NaN)).toThrow(RangeError);
  });

  it('R21.8 does not change the input bytes', () => {
    const png = new Uint8Array(encodePngRgba(2, 2, new Uint8Array(16)));
    const copy = png.slice();
    withPixelDensity(png, 5000);
    expect(png).toEqual(copy);
  });
});
