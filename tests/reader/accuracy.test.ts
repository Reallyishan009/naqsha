import { existsSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodePng, FIXTURE_SET } from '../../scripts/make_fixtures.ts';
import type { GroundTruth } from '../../scripts/make_fixtures.ts';
import { parseCardProfile } from '../../src/codec/index.ts';
import type { CardProfile } from '../../src/codec/types.ts';
import { toGreyscale } from '../../src/reader/greyscale';
import { orientationSeparation } from '../../src/reader/orientation';
import { findPegHolePair } from '../../src/reader/pegHoles';
import { angleDifferenceDegrees } from '../../src/reader/pose';
import { MAX_CANDIDATE_REGIONS, MIN_REGION_AREA_PX, readCard } from '../../src/reader/readCard';
import { equivalentDiameterPx, findDarkRegions } from '../../src/reader/regions';
import { chooseThreshold, classifyDark } from '../../src/reader/threshold';
import type { PixelData } from '../../src/reader/types';
import { decodePng } from '../support/png';

/** Required hole accuracy per fixture (R13.1 to R13.3). This table is the requirement. */
const TARGETS: Record<string, { minAccuracy: number; requirement: string }> = {
  'pick0-clean': { minAccuracy: 1, requirement: 'R13.1' },
  'pick1-clean': { minAccuracy: 1, requirement: 'R13.1' },
  'pick2-clean': { minAccuracy: 1, requirement: 'R13.1' },
  'pick0-tilted': { minAccuracy: 1, requirement: 'R13.2' },
  'pick0-noisy': { minAccuracy: 0.95, requirement: 'R13.3' },
  'pick0-noisy-tilted': { minAccuracy: 0.95, requirement: 'R13.3' },
};

const TILT_TOLERANCE_DEGREES = 0.5;
const SCALE_TOLERANCE = 0.01;

function loadProfile(name: string): CardProfile {
  const parsed = parseCardProfile(JSON.parse(readFileSync(`public/profiles/${name}.json`, 'utf8')));
  if (!parsed.ok) throw new Error(`profile ${name} is invalid`);
  return parsed.value;
}

/** Recomputes the reader's intermediate numbers with the public reader functions, for the report line only. */
function diagnostics(profile: CardProfile, pixels: PixelData): string {
  const grey = toGreyscale(pixels);
  const threshold = chooseThreshold(grey);
  const map = classifyDark(grey, threshold);
  const candidates = findDarkRegions(map)
    .map((region, scanIndex) => ({ region, scanIndex }))
    .filter(({ region }) => !region.touchesEdge && region.area >= MIN_REGION_AREA_PX)
    .sort((a, b) => b.region.area - a.region.area || a.scanIndex - b.scanIndex)
    .slice(0, MAX_CANDIDATE_REGIONS)
    .map(({ region }) => region);
  const pair = findPegHolePair(profile, candidates);
  if (pair === null) return `threshold ${threshold}, candidates ${candidates.length}, no peg hole pair`;
  const [peg0, peg1] = profile.pegHoles;
  const measured: [number, number] = [
    equivalentDiameterPx(pair.uprightRegions[0]),
    equivalentDiameterPx(pair.uprightRegions[1]),
  ];
  const q = orientationSeparation([peg0.diameterMm * pair.pixelsPerMm, peg1.diameterMm * pair.pixelsPerMm], measured);
  return (
    `threshold ${threshold}, candidates ${candidates.length}, ` +
    `pegs ${measured[0].toFixed(1)}/${measured[1].toFixed(1)} px, q ${q.toFixed(2)}`
  );
}

describe('decodePng', () => {
  it('R17.5 decoding a PNG written by the generator returns the same grey levels', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 0, max: 0xffffffff }),
        (width, height, seed) => {
          const pixels = new Uint8Array(width * height).map((_, i) => (Math.imul(i + 1, 2654435761) ^ seed) & 0xff);
          const decoded = decodePng(encodePng({ width, height, pixels }));
          expect(decoded.width).toBe(width);
          expect(decoded.height).toBe(height);
          for (let i = 0; i < pixels.length; i++) {
            expect(Array.from(decoded.data.subarray(4 * i, 4 * i + 4))).toEqual([pixels[i], pixels[i], pixels[i], 255]);
          }
        },
      ),
    );
  });

  it('R17.5 decoding throws on a PNG that is not 8-bit greyscale', () => {
    const png = Buffer.from(encodePng({ width: 2, height: 2, pixels: new Uint8Array([1, 2, 3, 4]) }));
    png[8 + 8 + 9] = 2; // IHDR colour type: truecolour
    expect(() => decodePng(png)).toThrow(/colour type 2/);
  });

  it('R17.5 decoding throws on a non-PNG, on a non-zero filter byte and on truncated data', () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3]))).toThrow(/signature/);
    const png = encodePng({ width: 2, height: 2, pixels: new Uint8Array([1, 2, 3, 4]) });
    expect(() => decodePng(png.subarray(0, png.length - 20))).toThrow();
    // An image whose first scanline uses filter 1 (built with the same chunk layout as encodePng).
    const good = Buffer.from(png);
    const idatStart = 8 + 25; // after signature and IHDR chunk (4 + 4 + 13 + 4)
    const idatLength = good.readUInt32BE(idatStart);
    const rebuilt = Buffer.concat([
      good.subarray(0, idatStart),
      chunk('IDAT', deflateSync(Buffer.from([1, 1, 2, 0, 3, 4]))),
      good.subarray(idatStart + 12 + idatLength),
    ]);
    expect(() => decodePng(rebuilt)).toThrow(/filter 1/);
  });
});

function chunk(type: string, data: Buffer): Buffer {
  // Reuse encodePng's CRC by encoding nothing new: build the chunk with decodePng-compatible CRC.
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  let c = 0xffffffff;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let v = n;
    for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
    table[n] = v >>> 0;
  }
  for (const byte of Buffer.concat([typeBytes, data])) c = table[(c ^ byte) & 0xff]! ^ (c >>> 8);
  crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, typeBytes, data, crc]);
}

describe('fixture accuracy', () => {
  it('R17.7 every fixture in FIXTURE_SET exists and has a target', () => {
    for (const { name } of FIXTURE_SET) {
      expect(existsSync(`tests/fixtures/${name}.png`), `${name}.png`).toBe(true);
      expect(existsSync(`tests/fixtures/${name}.json`), `${name}.json`).toBe(true);
      expect(TARGETS[name], `target for ${name}`).toBeDefined();
    }
    expect(Object.keys(TARGETS).sort()).toEqual(FIXTURE_SET.map((f) => f.name).sort());
  });

  for (const { name } of FIXTURE_SET) {
    const target = TARGETS[name]!;
    const percent = (target.minAccuracy * 100).toFixed(0);
    const title =
      target.minAccuracy === 1
        ? `${target.requirement} ${name} is read with 100% hole accuracy, tilt within 0.5 degrees (R9.6) and scale within 1% (R9.4)`
        : `${target.requirement} ${name} is read with at least ${percent}% hole accuracy, tilt within 0.5 degrees (R9.6) and scale within 1% (R9.4)`;

    it(title, () => {
      const truth = JSON.parse(readFileSync(`tests/fixtures/${name}.json`, 'utf8')) as GroundTruth;
      const profile = loadProfile(truth.profile);
      const pixels = decodePng(readFileSync(`tests/fixtures/${name}.png`));
      const result = readCard(profile, pixels);

      if (!result.ok) {
        const failure = result.failure;
        const detail = failure.reason === 'ambiguous-orientation' ? ` (separation ${failure.separation})` : '';
        console.log(`${name}: readCard failed: ${failure.reason}${detail}; ${diagnostics(profile, pixels)}`);
        expect.fail(`${name}: readCard failed with ${failure.reason}${detail}`);
      }

      const total = profile.hookRows * profile.hookColumns;
      const mismatches: string[] = [];
      for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
        for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
          if (result.grid[hookRow]?.[hookColumn] !== truth.card[hookRow]![hookColumn]) {
            mismatches.push(`(${hookRow}, ${hookColumn})`);
          }
        }
      }
      const matched = total - mismatches.length;
      const accuracy = matched / total;
      const tiltError = angleDifferenceDegrees(result.pose.tiltDegrees, truth.options.tiltDegrees);
      const scaleError = Math.abs(result.pose.pixelsPerMm - truth.options.pixelsPerMm) / truth.options.pixelsPerMm;

      console.log(
        `${name}: accuracy ${(accuracy * 100).toFixed(2)}% (${matched}/${total}), ` +
          `tilt ${result.pose.tiltDegrees.toFixed(2)} (expected ${truth.options.tiltDegrees}), ` +
          `scale ${result.pose.pixelsPerMm.toFixed(3)} (expected ${truth.options.pixelsPerMm}), ` +
          diagnostics(profile, pixels),
      );

      const summary =
        `${name}: accuracy ${(accuracy * 100).toFixed(2)}% (need ${(target.minAccuracy * 100).toFixed(2)}%), ` +
        `mismatched (hookRow, hookColumn): [${mismatches.join(' ')}], ` +
        `tilt ${result.pose.tiltDegrees} (expected ${truth.options.tiltDegrees}, error ${tiltError}), ` +
        `scale ${result.pose.pixelsPerMm} (expected ${truth.options.pixelsPerMm}, error ${(scaleError * 100).toFixed(3)}%)`;
      expect(accuracy >= target.minAccuracy, summary).toBe(true);
      expect(tiltError <= TILT_TOLERANCE_DEGREES, `R9.6 tilt: ${summary}`).toBe(true);
      expect(scaleError <= SCALE_TOLERANCE, `R9.4 scale: ${summary}`).toBe(true);
      expect(result.pose.orientation, `orientation: ${summary}`).toBe('upright');
    });
  }
});
