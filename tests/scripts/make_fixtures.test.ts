import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BORDER_MM,
  FIXTURE_SET,
  PIXELS_PER_MM,
  demoPattern,
  encodePng,
  groundTruthText,
  renderCard,
  type GroundTruth,
  type RenderInput,
} from '../../scripts/make_fixtures';
import type { CardProfile } from '../../src/codec/types';

const profile = JSON.parse(
  readFileSync(new URL('../../public/profiles/demo-12x16.json', import.meta.url), 'utf8'),
) as CardProfile;
const pattern = demoPattern(profile);
const card = pattern[0]!;
const harsh: RenderInput = { noise: 18, tiltDegrees: -6, shade: 0.25, seed: 42 };

describe('fixture generator', () => {
  it('produces identical PNG bytes for the same seed', () => {
    const first = encodePng(renderCard(profile, card, harsh));
    const second = encodePng(renderCard(profile, card, harsh));
    expect(first.equals(second)).toBe(true);
  });

  it('produces different PNG bytes for a different seed', () => {
    const first = encodePng(renderCard(profile, card, harsh));
    const second = encodePng(renderCard(profile, card, { ...harsh, seed: 43 }));
    expect(first.equals(second)).toBe(false);
  });

  it('draws punched holes dark and unpunched positions light on a clean render of one card', () => {
    const image = renderCard(profile, card, { noise: 0, tiltDegrees: 0, shade: 0, seed: 1 });
    for (let hookRowIndex = 0; hookRowIndex < profile.hookRows; hookRowIndex++) {
      for (let hookColumnIndex = 0; hookColumnIndex < profile.hookColumns; hookColumnIndex++) {
        const x = Math.round(
          (profile.firstHoleCentreMm.x + hookColumnIndex * profile.horizontalPitchMm + BORDER_MM) * PIXELS_PER_MM,
        );
        const y = Math.round(
          (profile.firstHoleCentreMm.y + hookRowIndex * profile.verticalPitchMm + BORDER_MM) * PIXELS_PER_MM,
        );
        const level = image.pixels[y * image.width + x]!;
        expect(level < 100).toBe(card[hookRowIndex]![hookColumnIndex]);
      }
    }
  });

  it('draws each peg hole at its own position with its own diameter', () => {
    const image = renderCard(profile, card, { noise: 0, tiltDegrees: 0, shade: 0, seed: 1 });
    const darkRunPx = (centreXmm: number, centreYmm: number): number => {
      const y = Math.round((centreYmm + BORDER_MM) * PIXELS_PER_MM);
      const x = Math.round((centreXmm + BORDER_MM) * PIXELS_PER_MM);
      let count = 0;
      for (let dx = -3 * PIXELS_PER_MM; dx <= 3 * PIXELS_PER_MM; dx++) {
        if (image.pixels[y * image.width + x + dx]! < 100) count++;
      }
      return count;
    };
    const [first, second] = profile.pegHoles;
    const firstRunPx = darkRunPx(first.positionMm.x, first.positionMm.y);
    const secondRunPx = darkRunPx(second.positionMm.x, second.positionMm.y);
    expect(Math.abs(firstRunPx - first.diameterMm * PIXELS_PER_MM)).toBeLessThanOrEqual(1);
    expect(Math.abs(secondRunPx - second.diameterMm * PIXELS_PER_MM)).toBeLessThanOrEqual(1);
    expect(secondRunPx).toBeGreaterThan(firstRunPx);
  });

  it('R19.8 a render at 3 px/mm is half the width and height of one at 6 px/mm, and the option is recorded', () => {
    const clean = { noise: 0, tiltDegrees: 0, shade: 0, seed: 1 };
    const full = renderCard(profile, card, { ...clean, pixelsPerMm: 6 });
    const half = renderCard(profile, card, { ...clean, pixelsPerMm: 3 });
    expect(Math.abs(half.width - full.width / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(half.height - full.height / 2)).toBeLessThanOrEqual(1);
    const recorded = JSON.parse(groundTruthText(profile, card, 'x.png', { ...clean, pixelsPerMm: 3 })) as GroundTruth;
    expect(recorded.options.pixelsPerMm).toBe(3);
  });

  it('R19.8 pixelsPerMm defaults to 6 and is recorded when omitted', () => {
    const clean = { noise: 0, tiltDegrees: 0, shade: 0, seed: 1 };
    const defaulted = renderCard(profile, card, clean);
    const explicit = renderCard(profile, card, { ...clean, pixelsPerMm: 6 });
    expect(defaulted).toEqual(explicit);
    const recorded = JSON.parse(groundTruthText(profile, card, 'x.png', clean)) as GroundTruth;
    expect(recorded.options.pixelsPerMm).toBe(PIXELS_PER_MM);
  });
});

describe('card-geometry.md', () => {
  it("R19.5 the Layout table in card-geometry.md states the demo profile's peg positions and diameters", () => {
    const markdown = readFileSync(new URL('../../.kiro/steering/card-geometry.md', import.meta.url), 'utf8');
    const layout = markdown.slice(markdown.indexOf('## Layout'));
    const rowCells = (label: string): string => {
      const row = layout.split('\n').find((line) => line.startsWith(`| ${label} |`));
      expect(row, `Layout table row "${label}"`).toBeDefined();
      return row!.split('|')[2]!;
    };
    const numbersIn = (text: string): number[] => (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

    profile.pegHoles.forEach((pegHole, pegIndex) => {
      expect(numbersIn(rowCells(`Peg hole ${pegIndex} position (mm)`))).toEqual([
        pegHole.positionMm.x,
        pegHole.positionMm.y,
      ]);
      expect(numbersIn(rowCells(`Peg hole ${pegIndex} diameter (mm)`))).toEqual([pegHole.diameterMm]);
    });
  });
});

describe('committed fixtures', () => {
  const fixturesUrl = new URL('../fixtures/', import.meta.url);

  it('R19.6 regenerating FIXTURE_SET in memory gives exactly the committed bytes', () => {
    for (const { name, pickIndex, options } of FIXTURE_SET) {
      const png = encodePng(renderCard(profile, pattern[pickIndex]!, options));
      const json = groundTruthText(profile, pattern[pickIndex]!, `${name}.png`, options, pickIndex);
      expect(png.equals(readFileSync(new URL(`${name}.png`, fixturesUrl))), `${name}.png`).toBe(true);
      expect(readFileSync(new URL(`${name}.json`, fixturesUrl), 'utf8'), `${name}.json`).toBe(json);
    }
  });

  it('R19.6 tests/fixtures contains exactly the PNG and JSON files for FIXTURE_SET', () => {
    const expected = FIXTURE_SET.flatMap(({ name }) => [`${name}.png`, `${name}.json`]).sort();
    expect(readdirSync(fixturesUrl).sort()).toEqual(expected);
  });

  it('R19.8 every FIXTURE_SET entry sets pixelsPerMm explicitly', () => {
    for (const { options } of FIXTURE_SET) expect(options.pixelsPerMm).toBe(6);
  });
});
