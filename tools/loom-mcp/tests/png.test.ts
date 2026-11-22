import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { describe, it } from 'node:test';
import { encodePngRgba } from '../../../scripts/png_rgba.ts';
import { decodePng } from '../src/png.ts';
import { ToolError } from '../src/result.ts';
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}
type Make = { width: number; height: number; colourType: number; samples: number[][]; bitDepth?: number; interlace?: number; palette?: number[]; filters?: number[] };
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
/** A PNG whose scanlines are filtered with the given filter per line, written by the standard rules. */
function makePng(make: Make): Buffer {
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[make.colourType]!;
  const stride = make.width * channels;
  const lines: Buffer[] = [];
  for (let y = 0; y < make.height; y++) {
    const filter = make.filters?.[y % make.filters.length] ?? 0;
    const row = make.samples[y]!;
    const out = [filter];
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? row[x - channels]! : 0;
      const up = y > 0 ? make.samples[y - 1]![x]! : 0;
      const upLeft = y > 0 && x >= channels ? make.samples[y - 1]![x - channels]! : 0;
      const predicted = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter]!;
      out.push((row[x]! - predicted) & 0xff);
    }
    lines.push(Buffer.from(out));
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(make.width, 0);
  header.writeUInt32BE(make.height, 4);
  header[8] = make.bitDepth ?? 8;
  header[9] = make.colourType;
  header[12] = make.interlace ?? 0;
  const parts = [SIGNATURE, chunk('IHDR', header)];
  if (make.palette !== undefined) parts.push(chunk('PLTE', Buffer.from(make.palette)));
  parts.push(chunk('IDAT', deflateSync(Buffer.concat(lines))), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}
function reason(call: () => unknown): string {
  try {
    call();
  } catch (error) {
    assert.ok(error instanceof ToolError);
    return error.reason;
  }
  return 'no error';
}
/** A small deterministic picture: sample values that differ from their neighbours, so every filter does real work. */
function samples(width: number, height: number, channels: number): number[][] {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width * channels }, (_, x) => (x * 37 + y * 91 + x * y * 13) & 0xff));
}
describe('PNG decoder', () => {
  const rgba = (colourType: number, row: number[], at: number): number[] => {
    if (colourType === 0) return [row[at]!, row[at]!, row[at]!, 255];
    if (colourType === 2) return [row[at * 3]!, row[at * 3 + 1]!, row[at * 3 + 2]!, 255];
    if (colourType === 4) return [row[at * 2]!, row[at * 2]!, row[at * 2]!, row[at * 2 + 1]!];
    return [row[at * 4]!, row[at * 4 + 1]!, row[at * 4 + 2]!, row[at * 4 + 3]!];
  };
  for (const colourType of [0, 2, 4, 6]) {
    for (const filter of [0, 1, 2, 3, 4]) {
      it(`R4.1 colour type ${colourType} with filter ${filter} decodes to the exact pixels`, () => {
        const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colourType]!;
        const pixels = samples(7, 5, channels);
        const decoded = decodePng(makePng({ width: 7, height: 5, colourType, samples: pixels, filters: [filter] }));
        assert.equal(decoded.width, 7);
        assert.equal(decoded.height, 5);
        for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) {
          assert.deepEqual([...decoded.data.subarray((y * 7 + x) * 4, (y * 7 + x) * 4 + 4)], rgba(colourType, pixels[y]!, x), `pixel ${x},${y}`);
        }
      });
    }
  }
  it('R4.1 a palette image decodes through its palette', () => {
    const decoded = decodePng(makePng({ width: 3, height: 2, colourType: 3, samples: [[0, 1, 2], [2, 1, 0]], palette: [10, 20, 30, 40, 50, 60, 70, 80, 90], filters: [1, 4] }));
    assert.deepEqual([...decoded.data.subarray(0, 12)], [10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255]);
    assert.deepEqual([...decoded.data.subarray(12, 16)], [70, 80, 90, 255]);
  });
  it('R4.1 a mix of filters on different lines decodes', () => {
    const pixels = samples(9, 8, 3);
    const decoded = decodePng(makePng({ width: 9, height: 8, colourType: 2, samples: pixels, filters: [0, 1, 2, 3, 4] }));
    assert.deepEqual([...decoded.data.subarray(7 * 9 * 4, 7 * 9 * 4 + 4)], [...rgba(2, pixels[7]!, 0)]);
  });
  it('R4.1 the PNG the app scripts write decodes to the same RGBA', () => {
    const data = new Uint8ClampedArray(4 * 3 * 4).map((_, index) => (index * 29) & 0xff);
    const decoded = decodePng(encodePngRgba(4, 3, data));
    assert.deepEqual([...decoded.data], [...data]);
  });
  it('R4.1 a real fixture decodes, as grey', () => {
    const decoded = decodePng(readFileSync(new URL('../../../tests/fixtures/pick0-clean.png', import.meta.url)));
    assert.ok(decoded.width > 100 && decoded.height > 100);
    for (let at = 0; at < decoded.data.length; at += 4097 * 4) assert.ok(decoded.data[at] === decoded.data[at + 1] && decoded.data[at + 3] === 255);
  });
  it('R1.2 text that is not a PNG, and a short file, are not_png', () => {
    assert.equal(reason(() => decodePng(Buffer.from('hello world, this is text'))), 'not_png');
    assert.equal(reason(() => decodePng(new Uint8Array(3))), 'not_png');
    assert.equal(reason(() => decodePng(SIGNATURE)), 'not_png');
  });
  it('R1.2 a damaged checksum, a cut file and a chunk longer than the file are not_png', () => {
    const good = makePng({ width: 4, height: 4, colourType: 0, samples: samples(4, 4, 1) });
    const flipped = Buffer.from(good);
    flipped[flipped.length - 20] = flipped[flipped.length - 20]! ^ 0xff;
    assert.equal(reason(() => decodePng(flipped)), 'not_png');
    assert.equal(reason(() => decodePng(good.subarray(0, good.length - 15))), 'not_png');
    const long = Buffer.from(good);
    long.writeUInt32BE(0x7fffffff, 8);
    assert.equal(reason(() => decodePng(long)), 'not_png');
  });
  it('R1.2 image data that does not inflate, or has the wrong size, is not_png', () => {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(4, 0);
    header.writeUInt32BE(4, 4);
    header[8] = 8;
    header[9] = 0;
    const garbage = Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', Buffer.from('not zlib data')), chunk('IEND', Buffer.alloc(0))]);
    assert.equal(reason(() => decodePng(garbage)), 'not_png');
    const short = Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.alloc(5))), chunk('IEND', Buffer.alloc(0))]);
    assert.equal(reason(() => decodePng(short)), 'not_png');
    const noEnd = Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.alloc(20)))]);
    assert.equal(reason(() => decodePng(noEnd)), 'not_png');
  });
  it('R1.2 an unknown filter and a palette index outside the palette are not_png', () => {
    const bad = makePng({ width: 2, height: 1, colourType: 0, samples: [[1, 2]] });
    const header = Buffer.alloc(13);
    header.writeUInt32BE(2, 0);
    header.writeUInt32BE(1, 4);
    header[8] = 8;
    const withFilter9 = Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IDAT', deflateSync(Buffer.from([9, 1, 2]))), chunk('IEND', Buffer.alloc(0))]);
    assert.equal(reason(() => decodePng(withFilter9)), 'not_png');
    assert.ok(bad.length > 0);
    assert.equal(reason(() => decodePng(makePng({ width: 2, height: 1, colourType: 3, samples: [[0, 5]], palette: [1, 2, 3] }))), 'not_png');
  });
  it('R1.2 16-bit, packed, interlaced and unknown colour types are unsupported_png', () => {
    assert.equal(reason(() => decodePng(makePng({ width: 2, height: 2, colourType: 0, samples: samples(2, 2, 1), bitDepth: 16 }))), 'unsupported_png');
    assert.equal(reason(() => decodePng(makePng({ width: 2, height: 2, colourType: 0, samples: samples(2, 2, 1), bitDepth: 1 }))), 'unsupported_png');
    assert.equal(reason(() => decodePng(makePng({ width: 2, height: 2, colourType: 0, samples: samples(2, 2, 1), interlace: 1 }))), 'unsupported_png');
    const header = Buffer.alloc(13);
    header.writeUInt32BE(2, 0);
    header.writeUInt32BE(2, 4);
    header[8] = 8;
    header[9] = 5;
    assert.equal(reason(() => decodePng(Buffer.concat([SIGNATURE, chunk('IHDR', header), chunk('IEND', Buffer.alloc(0))]))), 'unsupported_png');
  });
  it('R8.2 an image with more pixels than the limit is too_large before its data is read', () => {
    const header = Buffer.alloc(13);
    header.writeUInt32BE(5000, 0);
    header.writeUInt32BE(5000, 4);
    header[8] = 8;
    header[9] = 0;
    // No image data at all: only the size in the header is looked at.
    assert.equal(reason(() => decodePng(Buffer.concat([SIGNATURE, chunk('IHDR', header)]))), 'too_large');
    assert.equal(reason(() => decodePng(makePng({ width: 10, height: 10, colourType: 0, samples: samples(10, 10, 1) }), 99)), 'too_large');
    assert.doesNotThrow(() => decodePng(makePng({ width: 10, height: 10, colourType: 0, samples: samples(10, 10, 1) }), 100));
  });
});
