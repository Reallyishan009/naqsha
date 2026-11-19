import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { printableLayout } from '../../../src/ui/printable/layout.ts';
import { HOLE_RGB, RING_RGB, STOCK_RGB, rgbHex } from '../../../src/ui/printable/style.ts';
import { printableSvg } from '../../../src/ui/printable/svg.ts';
import { cardGridArbitrary, cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';

function svgFor(profile: ReturnType<typeof demoProfile>, grid: boolean[][]): string {
  const layout = printableLayout(profile, grid);
  if (!layout.ok) throw new Error('layout failed');
  return printableSvg(layout.value);
}

describe('printable SVG', () => {
  it('R21.4 the SVG draws manila stock, a filled round mark per punched hook, a ring per unpunched hook, and the peg and lacing holes', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, (_, row) =>
      Array.from({ length: profile.hookColumns }, (_, column) => (row + column) % 2 === 0),
    );
    const punchedCount = grid.flat().filter(Boolean).length;
    const total = profile.hookRows * profile.hookColumns;
    const svg = svgFor(profile, grid);
    expect(svg).toContain(`<rect x="0" y="0" width="60" height="45" fill="${rgbHex(STOCK_RGB)}"/>`);
    const circles = [...svg.matchAll(/<circle [^>]*\/>/g)].map((match) => match[0]);
    const rings = circles.filter((circle) => circle.includes('fill="none"'));
    const filled = circles.filter((circle) => !circle.includes('fill="none"'));
    expect(rings).toHaveLength(total - punchedCount);
    expect(filled).toHaveLength(punchedCount + profile.pegHoles.length + profile.lacingHoles.positionsMm.length);
    for (const circle of filled) expect(circle).toContain(`fill="${rgbHex(HOLE_RGB)}"`);
    for (const circle of rings) expect(circle).toContain(`stroke="${rgbHex(RING_RGB)}"`);
    expect(rgbHex(RING_RGB)).not.toBe(rgbHex(HOLE_RGB));
    expect(rgbHex(STOCK_RGB)).not.toBe(rgbHex(HOLE_RGB));
  });

  it('R21.7 the demo card is 60 mm by 45 mm with no text or metadata', () => {
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
