/** The only file in src/exporter that names browser APIs (R8.2). */

/** What downloadBmp needs from the browser; tests pass fakes. */
export type DownloadDeps = {
  makeBlob(bytes: Uint8Array, type: string): Blob;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  createAnchor(): { href: string; download: string; click(): void };
  /** Runs fn later. The default uses setTimeout(fn, 0); tests pass a synchronous version. */
  defer(fn: () => void): void;
};

const SAFE_CHARACTERS = /[A-Za-z0-9_-]/g;

/**
 * Builds the suggested file name: the safe characters of baseName (letters, digits, '-' and '_'),
 * or 'design' when none remain, then `-<bitDepth>bit.bmp` (R8.1, R8.3). Never throws.
 */
export function bmpFileName(baseName: string, bitDepth: 1 | 8): string {
  const kept = typeof baseName === 'string' ? (baseName.match(SAFE_CHARACTERS) ?? []).join('') : '';
  const base = kept === '' ? 'design' : kept;
  return `${base}-${bitDepth}bit.bmp`;
}

/** Browser objects, looked up at call time so importing this file in Node does not throw. */
function defaultDeps(): DownloadDeps {
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
 * Offers the bytes to the user as a download (R8.1): one Blob of type image/bmp, one object URL,
 * one click on an anchor with href and download set.
 *
 * The URL is revoked through deps.defer, after the click. By default that is setTimeout(0), because
 * some browsers (notably Safari) can cancel the download if the URL is revoked in the same tick as the click.
 */
export function downloadBmp(bytes: Uint8Array, fileName: string, deps: DownloadDeps = defaultDeps()): void {
  const blob = deps.makeBlob(bytes, 'image/bmp');
  const url = deps.createObjectURL(blob);
  const anchor = deps.createAnchor();
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  deps.defer(() => {
    deps.revokeObjectURL(url);
  });
}
