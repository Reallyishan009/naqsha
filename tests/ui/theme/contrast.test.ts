import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { THEME_TOKENS, TOKEN_PAIRS, contrastRatio } from '../../../src/ui/theme/contrast.ts';
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
        const tokens = THEME_TOKENS[pair.theme];
        const ratio = contrastRatio(tokens[pair.foreground], tokens[pair.background]);
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
});
