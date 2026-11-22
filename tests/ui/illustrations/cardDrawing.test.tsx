import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardGrid, CardProfile } from '../../../src/codec/index.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { CardDrawing, CardThumb } from '../../../src/ui/illustrations/CardDrawing.tsx';
import { cardGeometry } from '../../../src/ui/illustrations/cardGeometry.ts';
import type { CardGeometry } from '../../../src/ui/illustrations/cardGeometry.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { REMOVE, cardProfileArbitrary, demoProfile, mutateProfile } from '../../support/profiles.ts';

const en = translator(DICTIONARIES, 'en');
const hi = translator(DICTIONARIES, 'hi');
const ILLUSTRATIONS = path.resolve(import.meta.dirname, '../../../src/ui/illustrations');

type Circle = { className: string; cx: number; cy: number; r: number };

function attribute(tag: string, name: string): string {
  return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
}
/** Every `<circle>` of the markup, whose class name contains `marker`. */
function circlesOf(html: string, marker: string): Circle[] {
  return [...html.matchAll(/<circle\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => attribute(tag, 'class').includes(marker))
    .map((tag) => ({
      className: attribute(tag, 'class'),
      cx: Number(attribute(tag, 'cx')),
      cy: Number(attribute(tag, 'cy')),
      r: Number(attribute(tag, 'r')),
    }));
}
function geometryOf(profile: CardProfile): CardGeometry {
  const result = cardGeometry(profile);
  if (!result.ok) throw new Error('the profile should give a geometry');
  return result.geometry;
}
/** A valid profile with other values than the demo profile, fixed by seed. */
function otherProfile(): CardProfile {
  const demo = demoProfile();
  const [other] = fc
    .sample(cardProfileArbitrary, { seed: 41203, numRuns: 20 })
    .filter((candidate) => candidate.cardWidthMm !== demo.cardWidthMm && candidate.hookRows !== demo.hookRows);
  if (other === undefined) throw new Error('no second profile');
  return other;
}
/** A grid for the profile with a known mix of punched and unpunched hook positions. */
function checkerGrid(profile: CardProfile): CardGrid {
  return Array.from({ length: profile.hookRows }, (_, hookRow) =>
    Array.from({ length: profile.hookColumns }, (_, hookColumn) => (hookRow + hookColumn) % 2 === 0),
  );
}
const countPunched = (grid: CardGrid): number => grid.flat().filter(Boolean).length;
function render(props: Partial<Parameters<typeof CardDrawing>[0]> & { profile: CardProfile | null; grid: CardGrid | null }): string {
  return renderToStaticMarkup(<CardDrawing t={en} {...props} />);
}

describe('CardDrawing', () => {
  it.each([
    ['the demo profile', demoProfile()],
    ['a second profile', otherProfile()],
  ])('R12.3 one punchedHole circle for each punched hook position, at its centre and radius, for %s', (_name, profile) => {
    const grid = checkerGrid(profile);
    const geometry = geometryOf(profile);
    const circles = circlesOf(render({ profile, grid, pickNumber: 1 }), 'punchedHole');
    expect(circles).toHaveLength(countPunched(grid));
    const expected = grid.flatMap((hookRowCells, hookRow) =>
      hookRowCells.flatMap((punched, hookColumn) => (punched ? [geometry.hookCentres[hookRow]![hookColumn]!] : [])),
    );
    expect(circles.map(({ cx, cy }) => ({ x: cx, y: cy }))).toEqual(expected);
    for (const circle of circles) expect(circle.r).toBe(profile.holeDiameterMm / 2);
  });

  it('R12.3 the Sample_Design pick has one punchedHole circle for each punched hook position', () => {
    const profile = demoProfile();
    const grid = generateSample(profile, 'diamond')[0]!;
    expect(circlesOf(render({ profile, grid }), 'punchedHole')).toHaveLength(countPunched(grid));
  });

  it('R12.1 R12.2 the two peg holes keep their own diameters and the lacing holes come from the profile', () => {
    for (const profile of [demoProfile(), otherProfile()]) {
      const html = render({ profile, grid: checkerGrid(profile) });
      expect(circlesOf(html, 'pegHole').map(({ cx, cy, r }) => ({ x: cx, y: cy, d: r * 2 }))).toEqual(
        profile.pegHoles.map((peg) => ({ x: peg.positionMm.x, y: peg.positionMm.y, d: peg.diameterMm })),
      );
      expect(circlesOf(html, 'lacingHole').map(({ cx, cy, r }) => ({ x: cx, y: cy, d: r * 2 }))).toEqual(
        profile.lacingHoles.positionsMm.map((position) => ({ x: position.x, y: position.y, d: profile.lacingHoles.diameterMm })),
      );
    }
  });

  it('R12.8 the viewBox is the card size of the profile, so the box keeps the card aspect ratio', () => {
    for (const profile of [demoProfile(), otherProfile()]) {
      expect(render({ profile, grid: checkerGrid(profile) })).toContain(`viewBox="0 0 ${profile.cardWidthMm} ${profile.cardHeightMm}"`);
    }
  });

  it('R12.1 the stock rectangle has corner radius 0: no rx and no ry on any rectangle', () => {
    const profile = demoProfile();
    const html = render({ profile, grid: checkerGrid(profile), state: 'damaged' });
    const rectangles = [...html.matchAll(/<rect\b[^>]*>/g)].map((match) => match[0]);
    expect(rectangles.length).toBeGreaterThan(0);
    for (const tag of rectangles) expect(tag).not.toMatch(/\sr[xy]=/);
    expect(attribute(rectangles[0]!, 'width')).toBe(String(profile.cardWidthMm));
    expect(attribute(rectangles[0]!, 'height')).toBe(String(profile.cardHeightMm));
  });

  it('R12.1 no class is named hole alone, and the stock, holes and shadow come from tokens in the style sheet', () => {
    const css = readFileSync(path.join(ILLUSTRATIONS, 'CardDrawing.module.css'), 'utf8');
    expect(css).not.toMatch(/\.hole\b/);
    expect(css).toMatch(/\.stock\s*\{[^}]*fill:\s*var\(--card\)/);
    expect(css).toMatch(/\.punchedHole[^{]*\{[^}]*fill:\s*var\(--hole\)/);
    expect(css).toMatch(/box-shadow:\s*var\(--shadow-card\)/);
    expect(css).toMatch(/\.stock\s*\{[^}]*stroke:\s*var\(--ink-soft\)[^}]*vector-effect:\s*non-scaling-stroke/);
    expect(css).toMatch(/\.hatchLine\s*\{[^}]*stroke:\s*var\(--madder\)/);
  });

  it('R12.5 a grid that does not match draws stock, peg holes and lacing holes, no punched hole, and says so in desc', () => {
    const profile = demoProfile();
    const wrongGrid: CardGrid = [[true, false, true]];
    const html = render({ profile, grid: wrongGrid, pickNumber: 2 });
    expect(circlesOf(html, 'punchedHole')).toHaveLength(0);
    expect(circlesOf(html, 'pegHole')).toHaveLength(profile.pegHoles.length);
    expect(circlesOf(html, 'lacingHole')).toHaveLength(profile.lacingHoles.positionsMm.length);
    expect(html).toMatch(/<desc>[^<]*This card does not match the card profile/);
    expect(html).not.toContain('<figcaption');
  });

  it('R12.12 an invalid or missing profile draws no card, shows the cannot-draw text and does not throw', () => {
    const profile = demoProfile();
    const invalid = mutateProfile(profile, ['holeDiameterMm'], REMOVE) as CardProfile;
    for (const bad of [invalid, null]) {
      let html = '';
      expect(() => {
        html = render({ profile: bad, grid: checkerGrid(profile) });
      }).not.toThrow();
      expect(html).toContain('This card cannot be drawn');
      expect(html).not.toContain('<svg');
      expect(html).not.toContain('<circle');
    }
    expect(renderToStaticMarkup(<CardDrawing t={hi} profile={null} grid={null} />)).toContain(hi('card.cannotDraw'));
  });

  it('R12.6 without adjacent text the svg has role img, a title with the pick number and a desc with the punched count', () => {
    const profile = demoProfile();
    const grid = checkerGrid(profile);
    const total = profile.hookRows * profile.hookColumns;
    const html = render({ profile, grid, pickNumber: 7 });
    expect(html).toMatch(/<svg[^>]*role="img"/);
    expect(html).not.toContain('aria-hidden');
    expect(html).toContain('<title>Card for pick 7</title>');
    expect(html).toContain(`<desc>${countPunched(grid)} of ${total} hook positions punched</desc>`);
    const inHindi = renderToStaticMarkup(<CardDrawing t={hi} profile={profile} grid={grid} pickNumber={7} />);
    expect(inHindi).toContain(`<title>${hi('card.title', { pick: 7 })}</title>`);
  });

  it('R12.6 R12.11 a given label is the aria-label and the title', () => {
    const profile = demoProfile();
    const html = render({ profile, grid: checkerGrid(profile), label: 'Card 3: 9 punched holes out of 192' });
    expect(html).toContain('aria-label="Card 3: 9 punched holes out of 192"');
    expect(html).toContain('<title>Card 3: 9 punched holes out of 192</title>');
  });

  it('R12.7 with adjacent text the svg is aria-hidden and has no role, title or desc', () => {
    const profile = demoProfile();
    const html = render({ profile, grid: checkerGrid(profile), pickNumber: 1, adjacentText: true });
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain('<title');
    expect(html).not.toContain('<desc');
  });

  it.each([
    ['damaged', 'This card is damaged'],
    ['missing', 'This card is missing'],
  ] as const)('R12.10 a %s card draws a hatched gap and shows its state as visible text', (state, text) => {
    const profile = demoProfile();
    const html = render({ profile, grid: null, state, adjacentText: true });
    expect(html).toContain(`<figcaption`);
    expect(html).toMatch(new RegExp(`<figcaption[^>]*>${text}</figcaption>`));
    expect(html).toContain('<pattern');
    expect(html).toMatch(/<rect[^>]*fill="url\(#gap[A-Za-z0-9]+\)"/);
    expect(circlesOf(html, 'punchedHole')).toHaveLength(0);
  });

  it('R12.10 an ok card with no grid is shown as missing', () => {
    const html = render({ profile: demoProfile(), grid: null });
    expect(html).toMatch(/<figcaption[^>]*>This card is missing<\/figcaption>/);
  });

  it('R12.1 a card that is ok has no gap and no caption, and no mark for an unpunched hook position', () => {
    const profile = demoProfile();
    const html = render({ profile, grid: checkerGrid(profile) });
    expect(html).not.toContain('<figcaption');
    expect(html).not.toContain('<pattern');
    expect(circlesOf(html, 'unpunchedMark')).toHaveLength(0);
  });

  it('R12.1 marks rings draws one unpunchedMark circle for each unpunched hook position', () => {
    for (const profile of [demoProfile(), otherProfile()]) {
      const grid = checkerGrid(profile);
      const geometry = geometryOf(profile);
      const marks = circlesOf(render({ profile, grid, marks: 'rings' }), 'unpunchedMark');
      expect(marks).toHaveLength(profile.hookRows * profile.hookColumns - countPunched(grid));
      for (const mark of marks) {
        expect(mark.r).toBeLessThan(geometry.holeDiameterMm / 2);
        expect(mark.r).toBeGreaterThan(0);
      }
    }
  });

  it('R12.4 CardThumb keeps its props and its accessible name, and draws through CardDrawing', () => {
    const profile = demoProfile();
    const grid = checkerGrid(profile);
    const html = renderToStaticMarkup(<CardThumb grid={grid} number={3} profile={profile} t={en} />);
    const total = profile.hookRows * profile.hookColumns;
    expect(html).toContain(`aria-label="Card 3: ${countPunched(grid)} punched holes out of ${total}"`);
    expect(circlesOf(html, 'punchedHole')).toHaveLength(countPunched(grid));
    expect(renderToStaticMarkup(<CardThumb grid={grid} number={1} profile={null} t={en} />)).toContain('This card cannot be drawn');
  });

  it('R12.9 R4.10 the drawing module and its style sheet hold no colour literal and no card dimension of the demo profile', () => {
    const source = readFileSync(path.join(ILLUSTRATIONS, 'CardDrawing.tsx'), 'utf8');
    const css = readFileSync(path.join(ILLUSTRATIONS, 'CardDrawing.module.css'), 'utf8');
    for (const text of [source, css]) {
      expect(text).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(text).not.toMatch(/\b(?:rgba?|hsla?|oklch|oklab)\(/i);
      expect(text).not.toMatch(/gradient|<filter|blur\(/i);
    }
    expect(source).not.toMatch(/\b(?:fill|stroke)=["'](?!none|url)/);
    expect(css).not.toMatch(/transition|animation/);
  });

  it('R12.4 R12.11 no earlier card picture remains in src/ui: CardDrawing is the only component that draws a card', () => {
    const uiRoot = path.resolve(ILLUSTRATIONS, '..');
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return files(full);
        return /\.tsx?$/.test(entry.name) ? [full] : [];
      });
    const relative = (file: string): string => path.relative(uiRoot, file).split(path.sep).join('/');
    const sources = files(uiRoot).map((file) => ({ name: relative(file), text: readFileSync(file, 'utf8') }));
    // The one component that is named CardDrawing, and no second drawing of punched holes as circles.
    expect(sources.filter((source) => /export const CardDrawing\b|function CardDrawing\b/.test(source.text)).map((source) => source.name)).toEqual([
      'illustrations/CardDrawing.tsx',
    ]);
    expect(sources.filter((source) => /HOOK_SPACING_PX/.test(source.text))).toEqual([]);
    const circlesOfHooks = sources.filter((source) => /<circle/.test(source.text) && /punched|hookRow|hookColumn/i.test(source.text));
    // printable/svg.ts writes the downloadable card file, which is not a picture on a screen.
    expect(circlesOfHooks.map((source) => source.name).sort()).toEqual(['illustrations/CardDrawing.tsx', 'printable/svg.ts']);
    for (const source of sources.filter((entry) => entry.name.startsWith('screens/'))) {
      expect(source.text, source.name).not.toMatch(/printableLayout|STOCK_RGB|HOLE_RGB/);
    }
  });
});
