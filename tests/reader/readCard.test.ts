import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { demoPattern } from '../../scripts/make_fixtures.ts';
import { parseCardProfile, validateCardProfile } from '../../src/codec/index.ts';
import type { CardProfile } from '../../src/codec/types.ts';
import { angleDifferenceDegrees } from '../../src/reader/pose';
import { MAX_CANDIDATE_REGIONS, MIN_REGION_AREA_PX, readCard } from '../../src/reader/readCard';
import type { PixelData, ReadResult } from '../../src/reader/types';
import { padPixelData, renderCardPixels } from '../support/images';
import { mutateProfile, REMOVE } from '../support/profiles';

function loadDemoProfile(): CardProfile {
  const parsed = parseCardProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
  if (!parsed.ok) throw new Error('demo profile is invalid');
  return parsed.value;
}

const demo = loadDemoProfile();
const card = demoPattern(demo)[0]!;
const SEED = 1234;
const clean = { noise: 0, tiltDegrees: 0, shade: 0, seed: SEED, pixelsPerMm: 6 };

/** Removes whole pixel rows from the top of the image. */
function cropTop(pixels: PixelData, rows: number): PixelData {
  return {
    width: pixels.width,
    height: pixels.height - rows,
    data: pixels.data.slice(rows * pixels.width * 4),
  };
}

function expectNoGrid(result: ReadResult): void {
  expect(result.ok).toBe(false);
  expect('grid' in result).toBe(false);
}

describe('readCard', () => {
  it('exports the candidate constants', () => {
    expect(MIN_REGION_AREA_PX).toBe(4);
    expect(MAX_CANDIDATE_REGIONS).toBe(400);
  });

  it('R12.1/R11.3 a clean render reads back exactly, upright, with tilt and scale recovered', () => {
    const result = readCard(demo, renderCardPixels(demo, card, clean));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.grid).toEqual(card);
    expect(result.pose.orientation).toBe('upright');
    expect(Math.abs(result.pose.tiltDegrees)).toBeLessThan(0.5);
    expect(Math.abs(result.pose.pixelsPerMm / 6 - 1)).toBeLessThan(0.01);
  });

  it('R12.2 an invalid profile gives invalid-profile with the validateCardProfile violations', () => {
    const pixels = renderCardPixels(demo, card, clean);
    for (const bad of [{}, mutateProfile(demo, ['endOrder'], REMOVE)]) {
      const result = readCard(bad, pixels);
      expectNoGrid(result);
      if (result.ok) continue;
      expect(result.failure.reason).toBe('invalid-profile');
      if (result.failure.reason === 'invalid-profile') {
        expect(result.failure.violations).toEqual(validateCardProfile(bad));
        expect(result.failure.violations.length).toBeGreaterThan(0);
      }
    }
  });

  it('R6.4/R12.1 pixel data of the wrong length gives invalid-image', () => {
    const result = readCard(demo, { width: 10, height: 10, data: new Uint8ClampedArray(399) });
    expectNoGrid(result);
    expect(!result.ok && result.failure.reason).toBe('invalid-image');
  });

  it('R12.2 the profile is checked before the pixels', () => {
    const result = readCard({}, 'not pixels');
    expect(!result.ok && result.failure.reason).toBe('invalid-profile');
  });

  it('R9.7 a uniform grey image gives peg-holes-not-found', () => {
    const data = new Uint8ClampedArray(100 * 80 * 4).fill(200);
    const result = readCard(demo, { width: 100, height: 80, data });
    expectNoGrid(result);
    expect(!result.ok && result.failure.reason).toBe('peg-holes-not-found');
  });

  it('R10.4 a render cropped through the top hook rows gives card-outside-image', () => {
    // Hook row 2 centre is at (5 + 6 + 6) mm * 6 = 102 px; cropping 100 px puts rows 0 to 2 outside, pegs at 165 px stay inside.
    const cropped = cropTop(renderCardPixels(demo, card, clean), 100);
    const result = readCard(demo, cropped);
    expectNoGrid(result);
    expect(!result.ok && result.failure.reason).toBe('card-outside-image');
  });

  it('R12.1 padding the image with a uniform grey border does not change the grid', () => {
    const padded = padPixelData(renderCardPixels(demo, card, clean), { left: 20, top: 10, right: 5, bottom: 30, level: 70 });
    const result = readCard(demo, padded);
    expect(result.ok && result.grid).toEqual(card);
  });

  it('R12.1 the input pixel data is not mutated', () => {
    const pixels = renderCardPixels(demo, card, clean);
    const before = pixels.data.slice();
    readCard(demo, pixels);
    expect(pixels.data).toEqual(before);
  });

  for (const tiltDegrees of [180, 183]) {
    it(`R18.3 a card rotated by ${tiltDegrees} degrees reads back as the upright grid, upside-down`, () => {
      const result = readCard(demo, renderCardPixels(demo, card, { ...clean, tiltDegrees }));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.grid).toEqual(card);
      expect(result.pose.orientation).toBe('upside-down');
      expect(angleDifferenceDegrees(result.pose.tiltDegrees, tiltDegrees)).toBeLessThan(0.5);
    });
  }
});

describe('readCard at low resolution (task 5.13 counterexamples)', () => {
  const lowResolutionProfile = (() => {
    const withFirst = mutateProfile(demo, ['pegHoles', 0, 'diameterMm'], 2.5);
    const parsedFirst = parseCardProfile(withFirst);
    if (!parsedFirst.ok) throw new Error('profile is invalid');
    const parsed = parseCardProfile(mutateProfile(parsedFirst.value, ['pegHoles', 1, 'diameterMm'], 2.8));
    if (!parsed.ok) throw new Error('profile is invalid');
    return parsed.value;
  })();
  const lowResolutionCard = demoPattern(lowResolutionProfile)[0]!;

  it('the low-resolution profile is valid', () => {
    expect(validateCardProfile(lowResolutionProfile)).toEqual([]);
  });

  for (const pixelsPerMm of [2.75, 2.25, 1.25]) {
    it(`R18.5 at ${pixelsPerMm} px/mm the result is the true grid or a failure, never a different grid`, () => {
      const pixels = renderCardPixels(lowResolutionProfile, lowResolutionCard, {
        noise: 0,
        tiltDegrees: 0,
        shade: 0,
        seed: SEED,
        pixelsPerMm,
      });
      const result = readCard(lowResolutionProfile, pixels);
      if (result.ok) expect(result.grid).toEqual(lowResolutionCard);
      else expect('grid' in result).toBe(false);
    });
  }
});
