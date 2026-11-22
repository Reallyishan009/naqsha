/**
 * Copy and download of the Diff_Text (R6.8). The text is made by `diffToText` and is handed over exactly as it is
 * shown: no line added, removed or reordered, no byte-order mark, no added trailing newline, no changed line ending.
 * The browser is reached only through `DiffTextDeps`, so a test passes fakes and runs these in Node.
 */
import type { DownloadDeps } from '../../../exporter/index.ts';

/** A plain, fixed, ASCII file name. The Diff_Text is the same in both languages, so the name is too (R10.7). */
export const DIFF_TEXT_FILE_NAME = 'naksha-diff.txt';
/** The Diff_Text is UTF-8 text. */
export const DIFF_TEXT_MIME_TYPE = 'text/plain;charset=utf-8';

/** What copying and downloading the Diff_Text need from the browser; tests pass fakes. */
export type DiffTextDeps = {
  /** Writes the text to the clipboard. Resolves `false` when it could not, and never rejects. */
  copyText(text: string): Promise<boolean>;
  /** The same shape the exporter's download takes: a Blob, an object URL and a click on an anchor. */
  download: DownloadDeps;
};

/** What a copy or a download came to. A failure carries no detail: the user is shown one message for each. */
export type DiffTextOutcome = { ok: true } | { ok: false };

/** `navigator.clipboard.writeText`, or `false` when the API is absent or refuses. Looked up at call time. */
async function writeToClipboard(text: string): Promise<boolean> {
  try {
    const clipboard: Clipboard | undefined = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (clipboard === undefined) return false;
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Browser objects, looked up at call time so importing this file in Node does not throw. */
function browserDownloadDeps(): DownloadDeps {
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

/** The browser's own dependencies. Called when a button is pressed, not when the module loads. */
export function browserDiffTextDeps(): DiffTextDeps {
  return { copyText: writeToClipboard, download: browserDownloadDeps() };
}

/** The UTF-8 bytes of the text. `TextEncoder` writes no byte-order mark and changes no character. */
export function diffTextBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** Copies exactly `text`. A refusal, a rejection or a missing clipboard is a failure value, never a throw. */
export async function copyDiffText(deps: DiffTextDeps, text: string): Promise<DiffTextOutcome> {
  try {
    return (await deps.copyText(text)) ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/**
 * Offers exactly `text` as one file: one Blob of DIFF_TEXT_MIME_TYPE, one object URL, one click on an anchor named
 * DIFF_TEXT_FILE_NAME. The URL is revoked through `deps.download.defer`, after the click, as the exporter does.
 * A browser that cannot do it gives a failure value, never a throw.
 */
export function downloadDiffText(deps: DiffTextDeps, text: string): DiffTextOutcome {
  try {
    const { download } = deps;
    const blob = download.makeBlob(diffTextBytes(text), DIFF_TEXT_MIME_TYPE);
    const url = download.createObjectURL(blob);
    const anchor = download.createAnchor();
    anchor.href = url;
    anchor.download = DIFF_TEXT_FILE_NAME;
    anchor.click();
    download.defer(() => {
      download.revokeObjectURL(url);
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** What the status line after the Diff_Text reports; `none` before any button was pressed. */
export type DiffTextStatus = 'none' | 'copied' | 'copyFailed' | 'downloaded' | 'downloadFailed';

/** The Translation_File key of a status, or null while there is nothing to report. */
export function diffTextStatusKey(status: DiffTextStatus): string | null {
  switch (status) {
    case 'none':
      return null;
    case 'copied':
      return 'codeview.diff.copied';
    case 'copyFailed':
      return 'codeview.diff.copyFailed';
    case 'downloaded':
      return 'codeview.diff.downloaded';
    case 'downloadFailed':
      // The Translation_File has no text for this one case; the App's general message is the nearest.
      return 'error.generic';
  }
}

/** The number of text lines to show: one for each line, but never fewer than two nor more than twelve. */
export function diffTextLineCount(text: string): number {
  return Math.min(12, Math.max(2, text.split('\n').length));
}
