import type { Scheduler } from './player.ts';
import type { SimImage } from './types.ts';

/** The one thing paintToCanvas needs from a 2D canvas context. */
export type PaintContext = { putImageData(data: ImageData, x: number, y: number): void };

const imageDataFromBytes = (data: Uint8ClampedArray, width: number, height: number): ImageData =>
  new ImageData(data as Uint8ClampedArray<ArrayBuffer>, width, height);

/**
 * Returns a paint function that copies an image to the canvas with exactly one putImageData call at (0, 0) (R8.2, R10.1).
 * makeImageData is injectable so tests can run in Node, where ImageData does not exist.
 */
export function paintToCanvas(
  context: PaintContext,
  makeImageData: (data: Uint8ClampedArray, width: number, height: number) => ImageData = imageDataFromBytes,
): (image: SimImage) => void {
  return (image) => {
    context.putImageData(makeImageData(image.data, image.width, image.height), 0, 0);
  };
}

/** requestAnimationFrame / cancelAnimationFrame, looked up at call time so importing this file in Node does not throw (R10.3, R12.2). */
export const browserScheduler: Scheduler = {
  request(cb) {
    return globalThis.requestAnimationFrame(cb);
  },
  cancel(id) {
    globalThis.cancelAnimationFrame(id);
  },
};
