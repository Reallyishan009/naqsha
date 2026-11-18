import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodePngRgba } from '../../../scripts/png_rgba.ts';
import type { DownloadDeps } from '../../../src/exporter/index.ts';
import type { PixelData } from '../../../src/reader/index.ts';
import { printPng, printSvg, saveFile } from '../../../src/ui/printable/download.ts';
import type { PrintDeps } from '../../../src/ui/printable/download.ts';
import { DEFAULT_PIXELS_PER_MM, printableRaster } from '../../../src/ui/printable/raster.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { cardGridArbitrary, cardProfileArbitrary, demoProfile, mutateProfile } from '../../support/profiles.ts';

type Saved = { bytes: Uint8Array; fileName: string; mimeType: string };

/** Fake dependencies: the PNG encoder uses the test PNG writer, and saved files are recorded. */
function fakePrintDeps(): { deps: PrintDeps; saved: Saved[]; encoded: PixelData[] } {
  const saved: Saved[] = [];
  const encoded: PixelData[] = [];
  const deps: PrintDeps = {
    encodePng: (pixels) => {
      encoded.push(pixels);
      return Promise.resolve(new Uint8Array(encodePngRgba(pixels.width, pixels.height, pixels.data)));
    },
    saveFile: (bytes, fileName, mimeType) => {
      saved.push({ bytes, fileName, mimeType });
    },
  };
  return { deps, saved, encoded };
}

function chunkTypes(png: Uint8Array): string[] {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const types: string[] = [];
  for (let offset = 8; offset < png.length; offset += 12 + view.getUint32(offset)) {
    types.push(Buffer.from(png.subarray(offset + 4, offset + 8)).toString('ascii'));
  }
  return types;
}

function emptyGrid(hookRows: number, hookColumns: number): boolean[][] {
  return Array.from({ length: hookRows }, () => Array<boolean>(hookColumns).fill(false));
}

/** Grids of the wrong size or with a cell that is not a boolean, for a profile. */
function invalidGridArbitrary(hookRows: number, hookColumns: number): fc.Arbitrary<unknown> {
  return fc.oneof(
    fc.constantFrom<unknown>(undefined, null, 0, 'grid', {}, []),
    fc
      .tuple(fc.integer({ min: 0, max: hookRows + 3 }), fc.integer({ min: 0, max: hookColumns + 3 }))
      .filter(([rows, columns]) => rows !== hookRows || columns !== hookColumns)
      .map(([rows, columns]) => emptyGrid(rows, columns)),
    fc
      .tuple(
        fc.integer({ min: 0, max: hookRows - 1 }),
        fc.integer({ min: 0, max: hookColumns - 1 }),
        fc.constantFrom<unknown>(0, 1, 'x', null, undefined),
      )
      .map(([row, column, cell]) => {
        const grid: unknown[][] = emptyGrid(hookRows, hookColumns);
        grid[row]![column] = cell;
        return grid;
      }),
  );
}

describe('print actions', () => {
  it('R21.17 Property 14 an invalid profile or grid gives a failure and no download', async () => {
    await fc.assert(
      fc.asyncProperty(
        cardProfileArbitrary.chain((profile) =>
          fc.oneof(
            // Valid profile, invalid grid.
            invalidGridArbitrary(profile.hookRows, profile.hookColumns).map((grid) => ({ profile: profile as unknown, grid })),
            // Invalid profile, any grid.
            fc.tuple(
              fc.constantFrom<unknown>(
                mutateProfile(profile, ['hookRows'], 0),
                mutateProfile(profile, ['cardWidthMm'], -1),
                mutateProfile(profile, ['pegHoles'], []),
                mutateProfile(profile, [], null),
              ),
              cardGridArbitrary(profile),
            ).map(([invalidProfile, grid]) => ({ profile: invalidProfile, grid })),
            // Anything at all.
            fc.tuple(fc.anything(), fc.anything()).map(([anyProfile, anyGrid]) => ({ profile: anyProfile, grid: anyGrid })),
          ),
        ),
        async ({ profile, grid }) => {
          const { deps, saved, encoded } = fakePrintDeps();
          const png = await printPng(profile, grid, 'card.png', deps);
          const svg = printSvg(profile, grid, 'card.svg', deps);
          expect(png.ok).toBe(false);
          expect(svg.ok).toBe(false);
          if (!png.ok) expect(png.failure.reason).toBe('invalid-card');
          if (!svg.ok) expect(svg.failure.violations.length).toBeGreaterThan(0);
          expect(saved).toHaveLength(0);
          expect(encoded).toHaveLength(0);
        },
      ),
      { seed: 1401, numRuns: 100 },
    );
  });

  it('R21.8 a downloaded PNG has the chunks IHDR, pHYs, IDAT, IEND and a density of 12000', async () => {
    const profile = demoProfile();
    const { deps, saved } = fakePrintDeps();
    const result = await printPng(profile, emptyGrid(profile.hookRows, profile.hookColumns), 'demo-1.png', deps);
    expect(result).toEqual({ ok: true });
    expect(saved).toHaveLength(1);
    expect(saved[0]!.fileName).toBe('demo-1.png');
    expect(saved[0]!.mimeType).toBe('image/png');
    const png = saved[0]!.bytes;
    expect(chunkTypes(png)).toEqual(['IHDR', 'pHYs', 'IDAT', 'IEND']);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const physicalStart = 8 + 12 + 13; // after the signature and IHDR
    expect(view.getUint32(physicalStart + 8)).toBe(12000);
    expect(view.getUint32(physicalStart + 12)).toBe(12000);
    expect(png[physicalStart + 16]).toBe(1);
  });

  it('R21.18 the downloaded SVG has no metadata and no text', () => {
    const profile = demoProfile();
    const { deps, saved } = fakePrintDeps();
    const result = printSvg(profile, generateSample(profile, 'diamond')[0], 'demo-1.svg', deps);
    expect(result).toEqual({ ok: true });
    expect(saved).toHaveLength(1);
    expect(saved[0]!.mimeType).toBe('image/svg+xml');
    const text = new TextDecoder().decode(saved[0]!.bytes);
    expect(text.startsWith('<svg')).toBe(true);
    expect(text).not.toContain('<metadata');
    expect(text).not.toContain('<text');
    expect(text).not.toContain('<title');
    expect(text).not.toContain('<desc');
  });

  it('R21.17 an invalid grid for the demo profile starts no download', async () => {
    const profile = demoProfile();
    const { deps, saved } = fakePrintDeps();
    const png = await printPng(profile, [], 'x.png', deps);
    const svg = printSvg(profile, [], 'x.svg', deps);
    expect(png.ok).toBe(false);
    expect(svg.ok).toBe(false);
    expect(saved).toHaveLength(0);
  });

  it('R21.19 drawing a Sample_Design pick takes under 500 ms in Node', () => {
    const profile = demoProfile();
    const grid = generateSample(profile, 'floral')[0]!;
    const start = performance.now();
    const raster = printableRaster(profile, grid, DEFAULT_PIXELS_PER_MM);
    const elapsedMs = performance.now() - start;
    console.log(`printableRaster floral pick 0, demo profile, 12 px/mm: ${elapsedMs.toFixed(1)} ms in Node`);
    expect(raster.ok).toBe(true);
    expect(elapsedMs).toBeLessThan(500);
  });
});

describe('saveFile', () => {
  it('R21.5 offers one Blob of the given type through one click, then revokes the URL', () => {
    const events: string[] = [];
    const blob = { fake: 'blob' } as unknown as Blob;
    const bytes = new Uint8Array([1, 2, 3]);
    let deferred: (() => void) | undefined;
    const anchor = {
      href: '',
      download: '',
      click() {
        events.push(`click ${this.href} ${this.download}`);
      },
    };
    const deps: DownloadDeps = {
      makeBlob(b, type) {
        events.push(`makeBlob ${type} ${b === bytes}`);
        return blob;
      },
      createObjectURL(b) {
        events.push(`createObjectURL ${b === blob}`);
        return 'blob:fake';
      },
      revokeObjectURL(url) {
        events.push(`revoke ${url}`);
      },
      createAnchor: () => anchor,
      defer(fn) {
        deferred = fn;
      },
    };
    saveFile(bytes, 'card.png', 'image/png', deps);
    expect(events).toEqual(['makeBlob image/png true', 'createObjectURL true', 'click blob:fake card.png']);
    deferred?.();
    expect(events.at(-1)).toBe('revoke blob:fake');
  });
});
