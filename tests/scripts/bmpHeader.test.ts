import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bmpMismatches, expectedBmpFileSize, parseBmpHeader } from '../../scripts/checks/bmpHeader.ts';
import { encodePngRgba } from '../../scripts/png_rgba.ts';
import { parsePngInfo } from '../../scripts/checks/pngHeader.ts';
import { withPixelDensity } from '../../src/ui/printable/png.ts';
import { bmpLayout, exportPatternBmp, readPatternBmp } from '../../src/exporter/index.ts';
import { exportOptionsArbitrary, patternArbitrary } from '../support/patterns.ts';
import { demoProfile, profileArbitrary } from '../support/profiles.ts';

const SEED = 60301;
const NUM_RUNS = 100;
const blankPngFor = (width: number, height: number): Uint8Array =>
  new Uint8Array(encodePngRgba(width, height, new Uint8Array(width * height * 4).fill(255)));

describe('parseBmpHeader', () => {
  it('R14.12 reads the header of a demo-profile export: 192 ends, 36 picks, 1 bit, 2 colours', () => {
    const profile = demoProfile();
    const pattern = Array.from({ length: 36 }, () => profile.endOrder.map((row) => row.map((end) => end % 2 === 0)));
    const exported = exportPatternBmp(profile, pattern, { bitDepth: 1 });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const parsed = parseBmpHeader(exported.bytes);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.header).toMatchObject({ width: 192, height: 36, bitsPerPixel: 1, colourCount: 2, colourTableEntries: 2 });
    expect(parsed.header.byteLength).toBe(exported.bytes.length);
    expect(bmpMismatches(parsed.header, { width: 192, height: 36, bitsPerPixel: 1 })).toEqual([]);
  });

  it('names every field that differs from the expectation', () => {
    const profile = demoProfile();
    const pattern = [profile.endOrder.map((row) => row.map(() => true))];
    const exported = exportPatternBmp(profile, pattern, { bitDepth: 8 });
    if (!exported.ok) throw new Error('export failed');
    const parsed = parseBmpHeader(exported.bytes);
    if (!parsed.ok) throw new Error('parse failed');
    const problems = bmpMismatches(parsed.header, { width: 192, height: 36, bitsPerPixel: 1 });
    expect(problems.some((line) => line.startsWith('height is 1, expected 36'))).toBe(true);
    expect(problems.some((line) => line.startsWith('bits per pixel is 8, expected 1'))).toBe(true);
    expect(problems.some((line) => line.startsWith('colour count is 256, expected 2'))).toBe(true);
  });

  it('a truncated file is reported as a mismatch of its size, and short or wrong bytes do not parse', () => {
    const profile = demoProfile();
    const exported = exportPatternBmp(profile, [profile.endOrder.map((row) => row.map(() => false))]);
    if (!exported.ok) throw new Error('export failed');
    const parsed = parseBmpHeader(exported.bytes.slice(0, exported.bytes.length - 1));
    if (!parsed.ok) throw new Error('parse failed');
    expect(bmpMismatches(parsed.header, { width: 192, height: 1, bitsPerPixel: 1 })).toEqual([
      `file size on disk is ${exported.bytes.length - 1}, expected ${exported.bytes.length}`,
    ]);
    expect(parseBmpHeader(new Uint8Array(10)).ok).toBe(false);
    expect(parseBmpHeader(new Uint8Array(60)).ok).toBe(false);
  });

  it('R14.12 the direct parse agrees with bmpLayout and readPatternBmp over generated profiles, patterns and options', () => {
    fc.assert(
      fc.property(
        profileArbitrary.chain((profile) =>
          fc.record({ profile: fc.constant(profile), pattern: patternArbitrary(profile), options: exportOptionsArbitrary }),
        ),
        ({ profile, pattern, options }) => {
          const exported = exportPatternBmp(profile, pattern, options);
          expect(exported.ok).toBe(true);
          if (!exported.ok) return;
          const parsed = parseBmpHeader(exported.bytes);
          expect(parsed.ok).toBe(true);
          if (!parsed.ok) return;
          const width = profile.hookRows * profile.hookColumns;
          const layout = bmpLayout(width, pattern.length, options.bitDepth);
          const { header } = parsed;
          expect(header.width).toBe(layout.width);
          expect(header.height).toBe(layout.height);
          expect(header.bitsPerPixel).toBe(layout.bitDepth);
          expect(header.colourCount).toBe(layout.colourEntries);
          expect(header.colourTableEntries).toBe(layout.colourEntries);
          expect(header.pixelOffset).toBe(layout.pixelOffset);
          expect(header.imageSize).toBe(layout.imageSize);
          expect(header.declaredFileSize).toBe(layout.fileSize);
          expect(header.byteLength).toBe(layout.fileSize);
          expect(expectedBmpFileSize(width, pattern.length, options.bitDepth)).toBe(layout.fileSize);
          expect(bmpMismatches(header, { width, height: pattern.length, bitsPerPixel: options.bitDepth })).toEqual([]);
          // The same file reads back as the same pattern, so the header and the pixels describe one design.
          const back = readPatternBmp(exported.bytes, profile, options);
          expect(back.ok && back.pattern.length).toBe(pattern.length);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('parsePngInfo', () => {
  it('R21.8 reads the size and the pHYs density of a PNG that withPixelDensity wrote', () => {
    const png = blankPngFor(720, 540);
    const parsed = parsePngInfo(withPixelDensity(png, 12000));
    expect(parsed.ok && parsed.info).toMatchObject({
      width: 720,
      height: 540,
      pHYsCount: 1,
      crcsValid: true,
      density: { xPixelsPerMetre: 12000, yPixelsPerMetre: 12000, unit: 1 },
    });
    const bare = parsePngInfo(png);
    expect(bare.ok && bare.info.density).toBeNull();
  });

  it('rejects bytes that are not a PNG and a PNG with a damaged chunk CRC', () => {
    expect(parsePngInfo(new Uint8Array(4)).ok).toBe(false);
    const png = withPixelDensity(blankPngFor(2, 2), 3000);
    const damaged = png.slice();
    damaged[damaged.length - 1] = (damaged[damaged.length - 1]! + 1) & 0xff; // the IEND CRC
    const parsed = parsePngInfo(damaged);
    expect(parsed.ok && parsed.info.crcsValid).toBe(false);
  });

  it('R21.8 the pHYs parse round-trips with withPixelDensity for any size and density', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 1, max: 2147483647 }),
        (width, height, density) => {
          const parsed = parsePngInfo(withPixelDensity(blankPngFor(width, height), density));
          expect(parsed.ok).toBe(true);
          if (!parsed.ok) return;
          expect(parsed.info.width).toBe(width);
          expect(parsed.info.height).toBe(height);
          expect(parsed.info.pHYsCount).toBe(1);
          expect(parsed.info.crcsValid).toBe(true);
          expect(parsed.info.density).toEqual({ xPixelsPerMetre: density, yPixelsPerMetre: density, unit: 1 });
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
