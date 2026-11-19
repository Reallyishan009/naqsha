import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../../support/source.ts';

const PRINTABLE_DIR = path.resolve(import.meta.dirname, '../../../src/ui/printable');
const BROWSER_API =
  /\b(document|window|navigator|localStorage|sessionStorage|indexedDB|Blob|FileReader|OffscreenCanvas|HTMLCanvasElement|ImageData|createObjectURL|revokeObjectURL|toBlob|getContext|requestAnimationFrame)\b/;
const NETWORK =
  /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon)\b|\bimport\s*\(|https?:\/\//;

function printableFiles(): string[] {
  return readdirSync(PRINTABLE_DIR).filter((name) => name.endsWith('.ts'));
}

describe('printable card side effects', () => {
  it('R21.10 only download.ts names a browser API, and no printable file makes a network request', () => {
    const files = printableFiles();
    expect(files).toContain('download.ts');
    expect(files.length).toBeGreaterThan(1);
    for (const name of files) {
      // blankStrings: a word inside a string, such as the SVG namespace, is not a call.
      const code = stripComments(readFileSync(path.join(PRINTABLE_DIR, name), 'utf8'), true);
      expect(code, `${name} makes a network request`).not.toMatch(NETWORK);
      if (name !== 'download.ts') expect(code, `${name} names a browser API`).not.toMatch(BROWSER_API);
    }
  });

  it('R21.10 download.ts reaches the browser only for the PNG encoding call and the download trigger', () => {
    const code = stripComments(readFileSync(path.join(PRINTABLE_DIR, 'download.ts'), 'utf8'), true);
    const used = new Set([...code.matchAll(new RegExp(BROWSER_API.source, 'g'))].map((match) => match[1]));
    // Allowed: the download trigger (Blob, object URL, anchor click through document) and the PNG encoding
    // (canvas, putImageData, toBlob). Nothing else, such as storage or a network call.
    const allowed = new Set(['document', 'Blob', 'createObjectURL', 'revokeObjectURL', 'toBlob', 'getContext', 'ImageData']);
    expect([...used].filter((name) => !allowed.has(name!))).toEqual([]);
    expect(code).not.toMatch(/localStorage|sessionStorage|indexedDB/);
  });
});
