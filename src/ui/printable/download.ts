/** The only file in src/ui/printable that names browser APIs: canvas PNG encoding and the download click (R21.10). */
import type { DownloadDeps } from '../../exporter/index.ts';
import type { PixelData } from '../../reader/index.ts';
import type { PrintFailure } from '../types.ts';
import { printableLayout } from './layout.ts';
import { withPixelDensity } from './png.ts';
import { DEFAULT_PIXELS_PER_MM, printableRaster } from './raster.ts';
import { printableSvg } from './svg.ts';

/** What the print actions need from the browser; tests pass fakes. */
export type PrintDeps = {
  /** Encodes the pixels as PNG bytes (the browser uses a canvas). Rejects when encoding fails. */
  encodePng(pixels: PixelData): Promise<Uint8Array>;
  /** Offers the bytes to the user as a file download. */
  saveFile(bytes: Uint8Array, fileName: string, mimeType: string): void;
};

export type PrintResult = { ok: true } | { ok: false; failure: PrintFailure };

/** Browser objects, looked up at call time so importing this file in Node does not throw. */
function defaultFileDeps(): DownloadDeps {
  return {
    makeBlob: (bytes, type) => new globalThis.Blob([bytes as Uint8Array<ArrayBuffer>], { type }),
    createObjectURL: (blob) => globalThis.URL.createObjectURL(blob),
    revokeObjectURL: (url) => {
      globalThis.URL.revokeObjectURL(url);
    },
    createAnchor: () => globalThis.document.createElement('a'),
    defer: (fn) => {
      globalThis.setTimeout(fn, 0);
    },
  };
}

/**
 * One Blob of the given type, one object URL, one click on an anchor with href and download set.
 * The URL is revoked through deps.defer, after the click (Safari can cancel the download otherwise).
 */
export function saveFile(
  bytes: Uint8Array,
  fileName: string,
  mimeType: string,
  deps: DownloadDeps = defaultFileDeps(),
): void {
  const blob = deps.makeBlob(bytes, mimeType);
  const url = deps.createObjectURL(blob);
  const anchor = deps.createAnchor();
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  deps.defer(() => {
    deps.revokeObjectURL(url);
  });
}

/** Draws the pixels to a canvas with putImageData and encodes them with canvas.toBlob('image/png'). */
async function encodePngWithCanvas(pixels: PixelData): Promise<Uint8Array> {
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('The canvas has no 2D context.');
  context.putImageData(new globalThis.ImageData(pixels.data as Uint8ClampedArray<ArrayBuffer>, pixels.width, pixels.height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (blob === null) throw new Error('The browser could not encode the PNG.');
  return new Uint8Array(await blob.arrayBuffer());
}

export function browserPrintDeps(): PrintDeps {
  return {
    encodePng: encodePngWithCanvas,
    saveFile: (bytes, fileName, mimeType) => {
      saveFile(bytes, fileName, mimeType);
    },
  };
}

/**
 * Draws the printable card, writes the pixel density so that it prints at the card size at 100% scale (R21.8),
 * and offers it as a PNG download. An invalid profile or grid returns a failure and starts no download (R21.17).
 * Rejects if the browser cannot encode the PNG.
 */
export async function printPng(
  profile: unknown,
  grid: unknown,
  fileName: string,
  deps: PrintDeps = browserPrintDeps(),
  pixelsPerMm: number = DEFAULT_PIXELS_PER_MM,
): Promise<PrintResult> {
  const raster = printableRaster(profile, grid, pixelsPerMm);
  if (!raster.ok) return { ok: false, failure: { reason: 'invalid-card', violations: raster.violations } };
  const encoded = await deps.encodePng(raster.value);
  deps.saveFile(withPixelDensity(encoded, Math.round(pixelsPerMm * 1000)), fileName, 'image/png');
  return { ok: true };
}

/** Offers the printable card as an SVG download in millimetres. An invalid profile or grid starts no download. */
export function printSvg(
  profile: unknown,
  grid: unknown,
  fileName: string,
  deps: PrintDeps = browserPrintDeps(),
): PrintResult {
  const layout = printableLayout(profile, grid);
  if (!layout.ok) return { ok: false, failure: { reason: 'invalid-card', violations: layout.violations } };
  deps.saveFile(new TextEncoder().encode(printableSvg(layout.value)), fileName, 'image/svg+xml');
  return { ok: true };
}
