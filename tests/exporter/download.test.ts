import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { parseCardProfile } from '../../src/codec/index.ts';
import { bmpFileName, downloadBmp, exportPatternBmp, parseExportOptions, readPatternBmp } from '../../src/exporter/index.ts';
import type { DownloadDeps } from '../../src/exporter/index.ts';
import { FakeDownloadDeps } from '../support/fakes.ts';
import { exportOptionsArbitrary, patternArbitrary } from '../support/patterns.ts';
import { REMOVE, mutateProfile, profileArbitrary } from '../support/profiles.ts';

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

type Scenario = { profile: unknown; pattern: unknown; options: unknown };

/** A valid profile with a valid Pattern and valid options, or one of the four ways an export fails. */
const scenarioArbitrary: fc.Arbitrary<Scenario> = profileArbitrary.chain((profile) =>
  fc
    .record({ pattern: patternArbitrary(profile), options: exportOptionsArbitrary })
    .chain(({ pattern, options }) =>
      fc.oneof(
        { weight: 4, arbitrary: fc.constant<Scenario>({ profile, pattern, options }) },
        {
          weight: 1,
          arbitrary: fc
            .constantFrom(...([[['hookRows'], 0], [['name'], REMOVE], [[], null], [['cardWidthMm'], -1]] as const))
            .map(([at, replacement]): Scenario => ({ profile: mutateProfile(profile, at, replacement), pattern, options })),
        },
        { weight: 1, arbitrary: fc.constant<Scenario>({ profile, pattern: [], options }) },
        {
          weight: 1,
          arbitrary: fc
            .constantFrom<unknown>(null, 'x', [null], [[]], [[['x']]])
            .map((damaged): Scenario => ({ profile, pattern: [...pattern, damaged], options })),
        },
        {
          weight: 1,
          arbitrary: fc
            .constantFrom<unknown>(null, 3, 'black', [], { bitDepth: 3 }, { liftColour: 'red' }, { pickOrder: 1 })
            .map((bad): Scenario => ({ profile, pattern, options: bad })),
        },
      ),
    ),
);

describe('downloadBmp', () => {
  it('R8.1 downloadBmp offers the exported bytes once under the name of bmpFileName, and a failed export has nothing to offer', () => {
    // **Validates: Requirements 8.1**
    // A failed export carries no bytes, so downloadBmp cannot be reached with any: the fakes stay untouched.
    // That runExport itself never calls downloadBmp after a failure is Property 14 in tests/ui/state/keep.test.ts.
    let downloaded = 0;
    let failed = 0;
    fc.assert(
      fc.property(scenarioArbitrary, ({ profile, pattern, options }) => {
        const result = exportPatternBmp(profile, pattern, options);
        const deps = new FakeDownloadDeps();
        if (!result.ok) {
          failed += 1;
          expect('bytes' in result).toBe(false);
          expect(deps.downloadCount).toBe(0);
          expect(deps.revoked).toEqual([]);
          return;
        }
        downloaded += 1;
        const parsedProfile = parseCardProfile(profile);
        const parsedOptions = parseExportOptions(options);
        expect(parsedProfile.ok && parsedOptions.ok).toBe(true);
        if (!parsedProfile.ok || !parsedOptions.ok) return;
        const fileName = bmpFileName(parsedProfile.value.name, parsedOptions.value.bitDepth);
        downloadBmp(result.bytes, fileName, deps);
        expect(deps.downloadCount).toBe(1);
        expect(deps.downloads[0]!.fileName).toBe(fileName);
        expect(deps.downloads[0]!.type).toBe('image/bmp');
        expect(deps.downloads[0]!.bytes).toBe(result.bytes);
        expect(readPatternBmp(deps.downloads[0]!.bytes, parsedProfile.value, parsedOptions.value)).toEqual({ ok: true, pattern });
        // The fake runs the deferred function at once, so the single URL is revoked after the click.
        expect(deps.revoked).toHaveLength(1);
      }),
      { seed: 80211, numRuns: 100 },
    );
    expect(downloaded).toBeGreaterThan(0);
    expect(failed).toBeGreaterThan(0);
  });

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
