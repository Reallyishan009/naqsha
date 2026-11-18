import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  blendHalfway,
  isCrossInk,
  isSlashInk,
  packRaised,
  packRgb,
  packShaded,
  positiveModulo,
  shadeChannel,
  shadeTable,
} from '../../src/simulator/index.ts';

const byte = fc.integer({ min: 0, max: 255 });
const rgb = fc.tuple(byte, byte, byte);
const shade = fc.integer({ min: 160, max: 255 });

/** Unpacks a packed word through a byte view, the way the canvas reads it: the bytes in memory order. */
function unpack(word: number): number[] {
  const words = new Uint32Array(1);
  words[0] = word;
  return Array.from(new Uint8Array(words.buffer));
}

describe('style helpers', () => {
  it('R6.1 thread edges are darker than thread centres, and the pixel helpers follow their rules', () => {
    fc.assert(
      fc.property(fc.integer({ min: 3, max: 16 }), (t) => {
        const table = shadeTable(t);
        expect(table).toHaveLength(t);
        table.forEach((value, i) => expect(value).toBe(table[t - 1 - i]));
        const edge = table[0]!;
        const centre = Math.max(...table);
        expect(edge).toBe(Math.min(...table));
        expect(centre).toBe(table[Math.floor((t - 1) / 2)]);
        expect(centre).toBeGreaterThan(edge);
      }),
    );
    fc.assert(
      fc.property(byte, fc.integer({ min: 0, max: 255 }), (channel, s) => {
        const shaded = shadeChannel(channel, s);
        expect(Number.isInteger(shaded)).toBe(true);
        expect(shaded).toBeLessThanOrEqual(channel);
      }),
    );
    fc.assert(
      fc.property(rgb, shade, ([r, g, b], s) => {
        expect(unpack(packRgb(r, g, b))).toEqual([r, g, b, 255]);
        expect(unpack(packShaded([r, g, b], s))).toEqual(
          [r, g, b].map((c) => shadeChannel(c, s)).concat(255),
        );
        expect(unpack(packRaised([r, g, b], s))).toEqual(
          [r, g, b].map((c) => (shadeChannel(c, s) + 255) >> 1).concat(255),
        );
      }),
    );
    fc.assert(
      fc.property(byte, byte, (channel, target) => {
        expect(blendHalfway(channel, target)).toBe((channel + target) >> 1);
      }),
    );
    fc.assert(
      fc.property(fc.integer({ min: -100000, max: 100000 }), fc.integer({ min: 1, max: 1000 }), (a, m) => {
        const result = positiveModulo(a, m);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(m - 1);
        expect((a - result) % m === 0).toBe(true);
      }),
    );
    const coordinate = fc.integer({ min: -1000, max: 1000 });
    fc.assert(
      fc.property(coordinate, coordinate, (x, y) => {
        const slash = (((x + y) % 6) + 6) % 6 < 2;
        const backSlash = (((x - y) % 6) + 6) % 6 < 2;
        expect(isSlashInk(x, y)).toBe(slash);
        expect(isCrossInk(x, y)).toBe(slash || backSlash);
        for (const ink of [isSlashInk, isCrossInk]) {
          expect(ink(x + 6, y)).toBe(ink(x, y));
          expect(ink(x, y + 6)).toBe(ink(x, y));
        }
      }),
    );
  });
});
