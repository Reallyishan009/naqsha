import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { loadPixelData, type CanvasLike, type ImageSource } from '../../src/reader/canvasSource';

type Call = readonly [string, ...unknown[]];

function fakeCanvasFactory(bytes: Uint8ClampedArray | null, calls: Call[], sizes: Array<[number, number]>) {
  return (width: number, height: number): CanvasLike => {
    sizes.push([width, height]);
    return {
      getContext: (kind) => {
        calls.push(['getContext', kind]);
        if (bytes === null) return null;
        return {
          drawImage: (image, dx, dy) => {
            calls.push(['drawImage', image, dx, dy]);
          },
          getImageData: (sx, sy, sw, sh) => {
            calls.push(['getImageData', sx, sy, sw, sh]);
            return { width: sw, height: sh, data: bytes };
          },
        };
      },
    };
  };
}

const fakeImage = (width: number, height: number): ImageSource => ({ width, height, close: () => {} }) as unknown as ImageSource;

describe('loadPixelData', () => {
  it('R6.2 converting an image source returns its width, height and bytes using only drawImage and getImageData', async () => {
    // **Validates: Requirements 6.2**
    const sizedBytes = fc
      .tuple(fc.integer({ min: 1, max: 32 }), fc.integer({ min: 1, max: 32 }))
      .chain(([width, height]) =>
        fc.tuple(
          fc.constant(width),
          fc.constant(height),
          fc.uint8Array({ minLength: width * height * 4, maxLength: width * height * 4 }),
        ),
      );
    await fc.assert(
      fc.asyncProperty(
        sizedBytes,
        async ([width, height, raw]) => {
          const bytes = new Uint8ClampedArray(raw);
          const calls: Call[] = [];
          const sizes: Array<[number, number]> = [];
          const source = fakeImage(width, height);
          const result = await loadPixelData(source, fakeCanvasFactory(bytes, calls, sizes));
          expect(result.width).toBe(width);
          expect(result.height).toBe(height);
          expect(Array.from(result.data)).toEqual(Array.from(bytes));
          expect(sizes).toEqual([[width, height]]);
          const canvasCalls = calls.filter((c) => c[0] !== 'getContext');
          expect(canvasCalls).toEqual([
            ['drawImage', source, 0, 0],
            ['getImageData', 0, 0, width, height],
          ]);
        },
      ),
    );
  });

  it('R6.2 an HTMLImageElement-like source uses naturalWidth and naturalHeight', async () => {
    const bytes = new Uint8ClampedArray(2 * 3 * 4);
    const source = { naturalWidth: 2, naturalHeight: 3, width: 99, height: 99 } as unknown as ImageSource;
    const result = await loadPixelData(source, fakeCanvasFactory(bytes, [], []));
    expect([result.width, result.height]).toEqual([2, 3]);
  });

  it('R6.2 a missing 2D context rejects with a clear error', async () => {
    await expect(loadPixelData(fakeImage(2, 2), fakeCanvasFactory(null, [], []))).rejects.toThrow(/2D drawing context/);
  });

  it('R6.2 a zero-size source rejects with a clear error', async () => {
    await expect(loadPixelData(fakeImage(0, 5), fakeCanvasFactory(new Uint8ClampedArray(0), [], []))).rejects.toThrow(
      /no pixels/,
    );
  });
});
