import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { encodePngRgba } from '../../scripts/png_rgba.ts';
import { SAMPLE_VIEWPORT, renderSampleCloth } from '../../scripts/render_sample.ts';
import fc from 'fast-check';

/** Reads IHDR and the inflated IDAT length of a PNG; enough to check an RGBA image. */
function inspectRgbaPng(png: Buffer) {
  expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const idat: Buffer[] = [];
  let header: { width: number; height: number; bitDepth: number; colourType: number } | undefined;
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), bitDepth: body[8]!, colourType: body[9]! };
    } else if (type === 'IDAT') {
      idat.push(body);
    }
    offset += 12 + length;
  }
  return { header: header!, inflatedLength: inflateSync(Buffer.concat(idat)).length };
}

describe('sample cloth PNG', () => {
  it('R8.1 rendering the sample cloth twice gives identical PNG bytes', () => {
    expect(renderSampleCloth().equals(renderSampleCloth())).toBe(true);
  });

  it('R5.5 the sample cloth PNG is an RGBA image the size of the viewport', () => {
    const { header, inflatedLength } = inspectRgbaPng(renderSampleCloth());
    expect(header).toEqual({
      width: SAMPLE_VIEWPORT.width,
      height: SAMPLE_VIEWPORT.height,
      bitDepth: 8,
      colourType: 6,
    });
    expect(inflatedLength).toBe(SAMPLE_VIEWPORT.height * (SAMPLE_VIEWPORT.width * 4 + 1));
  });

  it('R8.1 encodePngRgba is deterministic and records the size for any RGBA image', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 2 ** 31 }),
        (width, height, seed) => {
          const data = new Uint8Array(width * height * 4).map((_, i) => (seed * (i + 1) + i) & 0xff);
          const first = encodePngRgba(width, height, data);
          expect(first.equals(encodePngRgba(width, height, data))).toBe(true);
          const { header, inflatedLength } = inspectRgbaPng(first);
          expect(header.width).toBe(width);
          expect(header.height).toBe(height);
          expect(inflatedLength).toBe(height * (width * 4 + 1));
        },
      ),
    );
  });
});
