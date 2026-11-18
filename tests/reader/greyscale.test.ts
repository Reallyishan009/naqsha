import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { toGreyscale } from '../../src/reader/greyscale';

describe('toGreyscale', () => {
  it('R7.2 a colour pixel r=200, g=100, b=50 gives level 124', () => {
    // floor((299*200 + 587*100 + 114*50 + 500) / 1000) = floor((59800 + 58700 + 5700 + 500) / 1000) = floor(124.7) = 124
    const grey = toGreyscale({ width: 1, height: 1, data: new Uint8ClampedArray([200, 100, 50, 7]) });
    expect(Array.from(grey.levels)).toEqual([124]);
  });

  it('R7.1 a 1 x 1 image gives one level and keeps width and height', () => {
    const grey = toGreyscale({ width: 1, height: 1, data: new Uint8ClampedArray([255, 255, 255, 0]) });
    expect(grey.width).toBe(1);
    expect(grey.height).toBe(1);
    expect(Array.from(grey.levels)).toEqual([255]);
  });

  it('R7.3 equal red, green and blue give that value', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), (v, alpha) => {
        const grey = toGreyscale({ width: 1, height: 1, data: new Uint8ClampedArray([v, v, v, alpha]) });
        expect(grey.levels[0]).toBe(v);
      }),
    );
  });
});
