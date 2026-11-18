import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BORDER_MM,
  PIXELS_PER_MM,
  demoPattern,
  encodePng,
  renderCard,
  type RenderOptions,
} from '../../scripts/make_fixtures';
import type { CardProfile } from '../../src/codec/types';

const profile = JSON.parse(
  readFileSync(new URL('../../public/profiles/demo-12x16.json', import.meta.url), 'utf8'),
) as CardProfile;
const pattern = demoPattern(profile);
const card = pattern[0]!;
const harsh: RenderOptions = { noise: 18, tiltDegrees: -6, shade: 0.25, seed: 42 };

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
});
