import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { printableLayout } from '../../../src/ui/printable/layout.ts';
import { printableRaster } from '../../../src/ui/printable/raster.ts';
import { HOLE_RGB, STOCK_RGB, rgbHex } from '../../../src/ui/printable/style.ts';
import { printableSvg } from '../../../src/ui/printable/svg.ts';
import { stripComments } from '../../support/source.ts';
import { cardGridArbitrary, cardProfileArbitrary } from '../../support/profiles.ts';

const PIXELS_PER_MM = 12;
const PRINTABLE_DIR = path.resolve(import.meta.dirname, '../../../src/ui/printable');

const profileAndGrid = cardProfileArbitrary.chain((profile) =>
  cardGridArbitrary(profile).map((grid) => ({ profile, grid })),
);

describe('printable file and raster share one layout', () => {
  it('R21.12 the SVG circles and the raster pixels sit at the centres of the one layout, for any profile and grid', () => {
    fc.assert(
      fc.property(profileAndGrid, ({ profile, grid }) => {
        const layout = printableLayout(profile, grid);
        expect(layout.ok).toBe(true);
        if (!layout.ok) return;
        const svg = printableSvg(layout.value);
        const raster = printableRaster(profile, grid, PIXELS_PER_MM);
        expect(raster.ok).toBe(true);
        if (!raster.ok) return;

        // Hole-ink circles of the SVG, in order, are the punched hooks, then the peg holes, then the lacing holes.
        const filled = [...svg.matchAll(/<circle cx="([^"]*)" cy="([^"]*)" r="([^"]*)" fill="#([0-9a-f]{6})"\/>/g)];
        const ringed = [...svg.matchAll(/<circle cx="([^"]*)" cy="([^"]*)" r="[^"]*" fill="none"/g)];
        const punched = layout.value.hookMarks.filter((mark) => mark.punched);
        const unpunched = layout.value.hookMarks.filter((mark) => !mark.punched);
        const inkDiscs = [...punched, ...layout.value.pegHoles, ...layout.value.lacingHoles];
        expect(filled).toHaveLength(inkDiscs.length);
        expect(ringed).toHaveLength(unpunched.length);
        filled.forEach((match, index) => {
          expect(Number(match[1])).toBeCloseTo(inkDiscs[index]!.centreMm.x, 3);
          expect(Number(match[2])).toBeCloseTo(inkDiscs[index]!.centreMm.y, 3);
          expect(Number(match[3])).toBeCloseTo(inkDiscs[index]!.diameterMm / 2, 3);
          expect(match[4]).toBe(rgbHex(HOLE_RGB).slice(1));
        });
        ringed.forEach((match, index) => {
          expect(Number(match[1])).toBeCloseTo(unpunched[index]!.centreMm.x, 3);
          expect(Number(match[2])).toBeCloseTo(unpunched[index]!.centreMm.y, 3);
        });

        // The raster has the size of the layout, hole ink at every ink disc and stock inside every ring.
        expect(raster.value.width).toBe(Math.max(1, Math.round(layout.value.widthMm * PIXELS_PER_MM)));
        expect(raster.value.height).toBe(Math.max(1, Math.round(layout.value.heightMm * PIXELS_PER_MM)));
        const pixelAt = (xMm: number, yMm: number): number[] => {
          const offset = (Math.floor(yMm * PIXELS_PER_MM) * raster.value.width + Math.floor(xMm * PIXELS_PER_MM)) * 4;
          return [raster.value.data[offset]!, raster.value.data[offset + 1]!, raster.value.data[offset + 2]!];
        };
        for (const disc of inkDiscs) expect(pixelAt(disc.centreMm.x, disc.centreMm.y)).toEqual([...HOLE_RGB]);
        for (const mark of unpunched) expect(pixelAt(mark.centreMm.x, mark.centreMm.y)).toEqual([...STOCK_RGB]);
      }),
      { seed: 2112, numRuns: 100 },
    );
  }, 120_000);

  it('R21.12 the raster and the SVG take their geometry from printableLayout and do not recompute hook positions', () => {
    const read = (name: string): string => stripComments(readFileSync(path.join(PRINTABLE_DIR, name), 'utf8'), false);
    expect(read('raster.ts')).toMatch(/import \{ printableLayout \} from '\.\/layout\.ts'/);
    expect(read('svg.ts')).toMatch(/import type \{ PrintableLayout \} from '\.\/layout\.ts'/);
    // printSvg and printPng, the two download paths, build the file from the same functions.
    expect(read('download.ts')).toMatch(/printableLayout\(profile, grid\)[\s\S]*printableSvg\(layout\.value\)/);
    expect(read('download.ts')).toMatch(/printableRaster\(profile, grid, pixelsPerMm\)/);
    for (const name of ['raster.ts', 'svg.ts', 'download.ts']) {
      expect(read(name), name).not.toMatch(/firstHoleCentreMm|horizontalPitchMm|verticalPitchMm/);
    }
  });
});
