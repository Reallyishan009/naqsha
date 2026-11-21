import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FROST, FROST_MIN_ALPHA, HERO_TINT, NIGHT_PHOTO_TINT, THEME_TOKENS, TOKEN_PAIRS, compositeOver, contrastRatio, frostWorstCase, heroWorstCase, nightPhotoWorstCase, tokenColour } from '../../../src/ui/theme/contrast.ts';
import type { ThemeName } from '../../../src/ui/theme/contrast.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const SEED = 3101;

const hexColour = fc
  .tuple(fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }), fc.integer({ min: 0, max: 255 }))
  .map(([r, g, b]) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`);

describe('contrast', () => {
  it('R14.7 the contrast ratio is symmetric, between 1 and 21, and 1 for equal colours', () => {
    // Feature: app, Property 31: Contrast ratio follows the WCAG formula
    fc.assert(
      fc.property(hexColour, hexColour, (a, b) => {
        const ratio = contrastRatio(a, b);
        expect(ratio).toBe(contrastRatio(b, a));
        expect(ratio).toBeGreaterThanOrEqual(1);
        expect(ratio).toBeLessThanOrEqual(21.0000001);
        expect(contrastRatio(a, a)).toBe(1);
      }),
      { numRuns: 200, seed: SEED },
    );
  });

  it('R14.7 and R14.3 every token pair meets its minimum (4.5 for text, 3 for focus)', () => {
    // Feature: app, Property 31: Contrast ratio follows the WCAG formula
    fc.assert(
      fc.property(fc.constantFrom(...TOKEN_PAIRS), (pair) => {
        const ratio = contrastRatio(tokenColour(pair.theme, pair.foreground), tokenColour(pair.theme, pair.background));
        expect(ratio, `${pair.theme} ${pair.foreground} on ${pair.background}`).toBeGreaterThanOrEqual(pair.minimum);
      }),
      { numRuns: 200, seed: SEED },
    );
  });

  it('black on white is 21 and a known pair matches a hand calculation', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('R15.1 tokens.css holds the same colour values as THEME_TOKENS for both themes', () => {
    const css = readFileSync(path.join(ROOT, 'src/ui/theme/tokens.css'), 'utf8');
    const blocks: Record<ThemeName, string> = {
      day: /:root\s*{([^}]*)}/.exec(css)?.[1] ?? '',
      night: /\[data-theme='night'\]\s*{([^}]*)}/.exec(css)?.[1] ?? '',
    };
    for (const theme of ['day', 'night'] as const) {
      for (const [name, value] of Object.entries(THEME_TOKENS[theme])) {
        const match = new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`).exec(blocks[theme]);
        expect(match?.[1]?.toLowerCase(), `${theme} --${name}`).toBe(value.toLowerCase());
      }
    }
  });

  it('R14.7 the frosted header is checked at its worst case: the surface at its alpha over black in Day and over white in Night', () => {
    // brief.md: contrast is computed on the opaque equivalent over the darkest and the lightest plausible background.
    expect(compositeOver('#FFFBF2', 1, '#000000')).toBe('#FFFBF2');
    expect(compositeOver('#FFFBF2', 0, '#123456')).toBe('#123456');
    expect(compositeOver('#FFFFFF', 0.5, '#000000')).toBe('#808080');
    expect(frostWorstCase('day')).toBe(compositeOver(THEME_TOKENS.day.surface, FROST.day.alpha, '#000000'));
    expect(frostWorstCase('night')).toBe(compositeOver(THEME_TOKENS.night.surface, FROST.night.alpha, '#FFFFFF'));
    for (const theme of ['day', 'night'] as const) {
      expect(FROST[theme].alpha, `${theme} frost alpha`).toBeGreaterThanOrEqual(FROST_MIN_ALPHA);
      // Text that needs 4.5:1 on the glass is in TOKEN_PAIRS, and every such pair meets it at the worst case.
      const onFrost = TOKEN_PAIRS.filter((pair) => pair.theme === theme && pair.background === 'frost');
      expect(onFrost.length, `${theme} pairs on the frosted header`).toBeGreaterThanOrEqual(5);
      for (const pair of onFrost) {
        expect(contrastRatio(tokenColour(theme, pair.foreground), frostWorstCase(theme))).toBeGreaterThanOrEqual(pair.minimum);
      }
    }
  });

  it('R15.1 --frost in tokens.css is the surface colour at the alpha contrast.ts checks, in both themes', () => {
    const css = readFileSync(path.join(ROOT, 'src/ui/theme/tokens.css'), 'utf8');
    const blocks: Record<ThemeName, string> = {
      day: /:root\s*{([^}]*)}/.exec(css)?.[1] ?? '',
      night: /\[data-theme='night'\]\s*{([^}]*--frost[^}]*)}/.exec(css)?.[1] ?? '',
    };
    for (const theme of ['day', 'night'] as const) {
      const match = /--frost:\s*rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)\s*;/.exec(blocks[theme]);
      expect(match, `${theme} --frost is rgb(R G B / alpha)`).not.toBeNull();
      const hex = `#${[match![1], match![2], match![3]].map((value) => Number(value).toString(16).padStart(2, '0')).join('')}`;
      expect(hex.toLowerCase(), `${theme} --frost colour is --surface`).toBe(THEME_TOKENS[theme].surface.toLowerCase());
      expect(Number(match![4]), `${theme} --frost alpha`).toBe(FROST[theme].alpha);
    }
  });

  it('second pass the new text pairs are listed in both themes: eyebrow and body 4.5, display accent 4.5, and the primary Button 4.5', () => {
    for (const theme of ['day', 'night'] as const) {
      const has = (foreground: string, background: string, minimum: number) =>
        TOKEN_PAIRS.some((pair) => pair.theme === theme && pair.foreground === foreground && pair.background === background && pair.minimum === minimum);
      for (const background of ['ground', 'surface', 'tint']) expect(has('eyebrow', background, 4.5), `${theme} eyebrow on ${background}`).toBe(true);
      for (const background of ['ground', 'surface']) {
        expect(has('ink', background, 4.5)).toBe(true);
        expect(has('accent', background, 4.5), `${theme} accent on ${background}`).toBe(true);
      }
      expect(has('on-primary', 'primary', 4.5)).toBe(true);
      expect(has('on-band', 'band', 4.5)).toBe(true);
    }
  });

  it('R14.7 the Landing Night section text is checked on its photo at its worst case, at the alpha tokens.css uses, in both themes', () => {
    const css = readFileSync(path.join(ROOT, 'src/ui/theme/tokens.css'), 'utf8');
    const alpha = /:root\s*{[^}]*--night-photo-alpha:\s*([\d.]+)\s*;/.exec(css)?.[1];
    for (const theme of ['day', 'night'] as const) {
      expect(Number(alpha), `--night-photo-alpha is the alpha contrast.ts checks (${theme})`).toBe(NIGHT_PHOTO_TINT[theme].alpha);
      expect(nightPhotoWorstCase(theme)).toBe(compositeOver(THEME_TOKENS[theme]['hero-tint'], NIGHT_PHOTO_TINT[theme].alpha, '#FFFFFF'));
      const onPhoto = TOKEN_PAIRS.filter((pair) => pair.theme === theme && pair.background === 'night-photo');
      expect(onPhoto.map((pair) => pair.foreground).sort(), `${theme} pairs on the Night section`).toEqual(['band-accent', 'on-band']);
      for (const pair of onPhoto) {
        expect(contrastRatio(tokenColour(theme, pair.foreground), nightPhotoWorstCase(theme)), `${theme} ${pair.foreground} on the Night section`).toBeGreaterThanOrEqual(4.5);
      }
      // It is darker than the hero's, so the section reads as night.
      expect(NIGHT_PHOTO_TINT[theme].alpha).toBeGreaterThan(HERO_TINT[theme].alpha);
    }
  });
  it('R14.7 the Landing hero text is checked on the photo at its worst case: a white pixel under the tint, at the alpha tokens.css uses', () => {
    const css = readFileSync(path.join(ROOT, 'src/ui/theme/tokens.css'), 'utf8');
    const alpha = /:root\s*{[^}]*--hero-tint-alpha:\s*([\d.]+)\s*;/.exec(css)?.[1];
    for (const theme of ['day', 'night'] as const) {
      expect(Number(alpha), `--hero-tint-alpha is the alpha contrast.ts checks (${theme})`).toBe(HERO_TINT[theme].alpha);
      expect(heroWorstCase(theme)).toBe(compositeOver(THEME_TOKENS[theme]['hero-tint'], HERO_TINT[theme].alpha, '#FFFFFF'));
      const onHero = TOKEN_PAIRS.filter((pair) => pair.theme === theme && pair.background === 'hero');
      expect(onHero.map((pair) => pair.foreground).sort(), `${theme} pairs on the hero`).toEqual(['band-accent', 'on-band']);
      for (const pair of onHero) {
        expect(contrastRatio(tokenColour(theme, pair.foreground), heroWorstCase(theme)), `${theme} ${pair.foreground} on the hero`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
