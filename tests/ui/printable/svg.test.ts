import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { printableLayout } from '../../../src/ui/printable/layout.ts';
import { printableSvg } from '../../../src/ui/printable/svg.ts';
import { cardGridArbitrary, cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';

function svgFor(profile: ReturnType<typeof demoProfile>, grid: boolean[][]): string {
  const layout = printableLayout(profile, grid);
  if (!layout.ok) throw new Error('layout failed');
  return printableSvg(layout.value);
}

describe('printable SVG', () => {
  it('the demo card is 60 mm by 45 mm with no text or metadata', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(true));
    const svg = svgFor(profile, grid);
    expect(svg).toContain('width="60mm"');
    expect(svg).toContain('height="45mm"');
    expect(svg).toContain('viewBox="0 0 60 45"');
    expect(svg).not.toContain('<metadata');
    expect(svg).not.toContain('<text');
  });

  it('R21.5 Property 35 the SVG width, height and viewBox are in millimetres', () => {
    fc.assert(
      fc.property(
        cardProfileArbitrary.chain((profile) => cardGridArbitrary(profile).map((grid) => ({ profile, grid }))),
        ({ profile, grid }) => {
          const svg = svgFor(profile, grid);
          const read = (name: string): string => new RegExp(`${name}="([^"]*)"`).exec(svg)![1]!;
          const close = (text: string, expected: number): void => {
            expect(text.endsWith('mm')).toBe(true);
            expect(Number(text.slice(0, -2))).toBeCloseTo(expected, 3);
          };
          close(read('width'), profile.cardWidthMm);
          close(read('height'), profile.cardHeightMm);
          const [x, y, w, h] = read('viewBox').split(' ').map(Number);
          expect([x, y]).toEqual([0, 0]);
          expect(w).toBeCloseTo(profile.cardWidthMm, 3);
          expect(h).toBeCloseTo(profile.cardHeightMm, 3);
        },
      ),
      { seed: 3501, numRuns: 100 },
    );
  });
});
