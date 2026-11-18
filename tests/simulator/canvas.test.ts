import * as fc from 'fast-check';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserScheduler, paintToCanvas } from '../../src/simulator/index.ts';
import type { SimImage } from '../../src/simulator/index.ts';

type Made = { data: Uint8ClampedArray; width: number; height: number };

function fakeContext() {
  const calls: Array<{ data: Made; x: number; y: number }> = [];
  return {
    calls,
    context: { putImageData: (data: ImageData, x: number, y: number) => void calls.push({ data: data as unknown as Made, x, y }) },
  };
}
const fakeFactory = (data: Uint8ClampedArray, width: number, height: number): ImageData =>
  ({ data, width, height }) as unknown as ImageData;

afterEach(() => vi.unstubAllGlobals());

describe('paintToCanvas', () => {
  it('R8.2 paints one image with one putImageData call at (0, 0), same size and same bytes', () => {
    const { calls, context } = fakeContext();
    const image: SimImage = { width: 2, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]) };
    paintToCanvas(context, fakeFactory)(image);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.x).toBe(0);
    expect(calls[0]!.y).toBe(0);
    expect(calls[0]!.data.width).toBe(2);
    expect(calls[0]!.data.height).toBe(1);
    expect(Array.from(calls[0]!.data.data)).toEqual(Array.from(image.data));
  });

  it('R8.2 for any image size, each paint makes exactly one putImageData call with the same bytes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 8 }), fc.integer({ min: 1, max: 8 }), fc.integer({ min: 1, max: 4 }), (width, height, paints) => {
        const { calls, context } = fakeContext();
        const data = new Uint8ClampedArray(width * height * 4).map((_, i) => (i * 37) % 256);
        const paint = paintToCanvas(context, fakeFactory);
        for (let i = 0; i < paints; i++) paint({ width, height, data });
        expect(calls).toHaveLength(paints);
        for (const call of calls) {
          expect([call.x, call.y, call.data.width, call.data.height]).toEqual([0, 0, width, height]);
          expect(call.data.data).toBe(data);
        }
      }),
    );
  });
});

describe('browserScheduler', () => {
  it('R10.3 request calls requestAnimationFrame once and passes the timestamp through', () => {
    const callbacks: Array<(t: number) => void> = [];
    const raf = vi.fn((cb: (t: number) => void) => (callbacks.push(cb), 41));
    vi.stubGlobal('requestAnimationFrame', raf);
    const seen: number[] = [];
    const id = browserScheduler.request((t) => seen.push(t));
    expect(id).toBe(41);
    expect(raf).toHaveBeenCalledTimes(1);
    callbacks[0]!(123.5);
    expect(seen).toEqual([123.5]);
  });

  it('R10.3 cancel calls cancelAnimationFrame once with the id', () => {
    const caf = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', caf);
    browserScheduler.cancel(7);
    expect(caf).toHaveBeenCalledTimes(1);
    expect(caf).toHaveBeenCalledWith(7);
  });

  it('R10.3 for any timestamp, the callback receives exactly that timestamp', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, min: 0, max: 1e9 }), (timestamp) => {
        let captured: ((t: number) => void) | undefined;
        vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => ((captured = cb), 1));
        let got = -1;
        browserScheduler.request((t) => (got = t));
        captured!(timestamp);
        expect(got).toBe(timestamp);
      }),
    );
  });
});
