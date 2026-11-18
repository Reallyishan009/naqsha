import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { bmpFileName, downloadBmp } from '../../src/exporter/index.ts';
import type { DownloadDeps } from '../../src/exporter/index.ts';

const SAFE = /[A-Za-z0-9_-]/g;

const baseNameArbitrary: fc.Arbitrary<string> = fc.oneof(
  fc.string({ unit: 'binary' }),
  fc.string({ unit: 'grapheme' }),
  fc.stringMatching(/^[A-Za-z0-9_\- ./é]{0,20}$/),
);

describe('bmpFileName', () => {
  it('R8.3 file names hold only safe characters and the bit depth', () => {
    // **Validates: Requirements 8.3**
    fc.assert(
      fc.property(baseNameArbitrary, fc.constantFrom<1 | 8>(1, 8), (baseName, bitDepth) => {
        const name = bmpFileName(baseName, bitDepth);
        expect(name).toMatch(/^[A-Za-z0-9_-]+-(1|8)bit\.bmp$/);
        expect(name.endsWith(`-${bitDepth}bit.bmp`)).toBe(true);
        const kept = (baseName.match(SAFE) ?? []).join('');
        const base = name.slice(0, name.length - `-${bitDepth}bit.bmp`.length);
        expect(base).toBe(kept === '' ? 'design' : kept);
      }),
    );
  });

  it('R8.3 gives examples of the suggested name', () => {
    expect(bmpFileName('design', 1)).toBe('design-1bit.bmp');
    expect(bmpFileName('my card/1.bmp', 8)).toBe('mycard1bmp-8bit.bmp');
    expect(bmpFileName('', 1)).toBe('design-1bit.bmp');
    expect(bmpFileName('日本語', 8)).toBe('design-8bit.bmp');
    expect(bmpFileName(undefined as unknown as string, 1)).toBe('design-1bit.bmp');
  });
});

describe('downloadBmp', () => {
  it('R8.1 offers one image/bmp Blob through one click, then revokes the URL', () => {
    const events: string[] = [];
    const blob = { fake: 'blob' } as unknown as Blob;
    const anchor = {
      href: '',
      download: '',
      click() {
        events.push(`click ${this.href} ${this.download}`);
      },
    };
    const bytes = new Uint8Array([66, 77, 1, 2]);
    const deps: DownloadDeps = {
      makeBlob(b, type) {
        events.push(`makeBlob ${type} ${b === bytes}`);
        return blob;
      },
      createObjectURL(b) {
        events.push(`createObjectURL ${b === blob}`);
        return 'blob:fake-1';
      },
      revokeObjectURL(url) {
        events.push(`revoke ${url}`);
      },
      createAnchor: () => anchor,
      defer: (fn) => {
        fn();
      },
    };

    downloadBmp(bytes, 'design-1bit.bmp', deps);

    expect(events).toEqual([
      'makeBlob image/bmp true',
      'createObjectURL true',
      'click blob:fake-1 design-1bit.bmp',
      'revoke blob:fake-1',
    ]);
  });

  it('R8.1 revokes only when the deferred function runs, which is after the click', () => {
    const deferred: (() => void)[] = [];
    const revoked: string[] = [];
    let clicks = 0;
    const deps: DownloadDeps = {
      makeBlob: () => ({}) as Blob,
      createObjectURL: () => 'blob:fake-2',
      revokeObjectURL: (url) => revoked.push(url),
      createAnchor: () => ({ href: '', download: '', click: () => void clicks++ }),
      defer: (fn) => deferred.push(fn),
    };
    downloadBmp(new Uint8Array(0), 'a-1bit.bmp', deps);
    expect(clicks).toBe(1);
    expect(revoked).toEqual([]);
    deferred.forEach((fn) => fn());
    expect(revoked).toEqual(['blob:fake-2']);
  });

  it('R8.2 importing the module in plain Node with Blob, URL and document absent does not throw', () => {
    const script = `
      delete globalThis.Blob; delete globalThis.URL; delete globalThis.document;
      const m = await import(${JSON.stringify(pathToFileURL(resolve('src/exporter/download.ts')).href)});
      console.log(typeof m.downloadBmp, typeof m.bmpFileName);
    `;
    const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
    expect(out.trim()).toBe('function function');
  });
});
