import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, EN, HI, translator } from '../../../src/ui/i18n/messages.ts';
import { clampPickNumber, runPrint, TryIt } from '../../../src/ui/screens/weave/TryIt.tsx';
import type { PrintModule } from '../../../src/ui/screens/weave/TryIt.tsx';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import type { Language } from '../../../src/ui/types.ts';
import { demoProfile } from '../../support/profiles.ts';

const SEED = 20240611;
const NUM_RUNS = 200;

function render(language: Language): string {
  const t = translator(DICTIONARIES, language);
  return renderToStaticMarkup(<TryIt profile={demoProfile()} confirm={null} dispatch={() => undefined} t={t} />);
}

function escape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
}

describe('Try it print controls', () => {
  it('R21.6 R21.9 both print sentences are shown for each Sample_Design in both languages', () => {
    for (const language of ['en', 'hi'] as const) {
      const html = render(language);
      const t = translator(DICTIONARIES, language);
      for (const key of ['print.scale', 'print.notCut']) {
        expect(html.split(escape(t(key))).length - 1, `${language} ${key}`).toBe(3);
      }
    }
    expect(EN['print.scale']).toContain('100%');
    expect(HI['print.scale']?.text).toContain('100%');
  });

  it('R21.1 each Sample_Design has a PNG and an SVG download button', () => {
    const html = render('en');
    expect(html.split('>Download PNG<').length - 1).toBe(3);
    expect(html.split('>Download SVG<').length - 1).toBe(3);
  });

  it('R21.2 the chooser starts at the first pick and shows the number of picks', () => {
    const html = render('en');
    const count = generateSample(demoProfile(), 'diamond').length;
    expect(html).toContain(`min="1" max="${count}" step="1" value="1"`);
  });

  it('R21.2 the chooser clamps to the range', () => {
    expect(clampPickNumber(0, 10)).toBe(1);
    expect(clampPickNumber(-5, 10)).toBe(1);
    expect(clampPickNumber(11, 10)).toBe(10);
    expect(clampPickNumber(Number.NaN, 10)).toBe(1);
    expect(clampPickNumber(3.4, 10)).toBe(3);
    expect(clampPickNumber(5, 0)).toBe(1);
  });

  it('R21.2 clampPickNumber returns an integer from 1 to the pick count for any number', () => {
    fc.assert(
      fc.property(fc.double({ noDefaultInfinity: false }), fc.integer({ min: 1, max: 500 }), (value, count) => {
        const pick = clampPickNumber(value, count);
        return Number.isInteger(pick) && pick >= 1 && pick <= count;
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R21.2 a print downloads the chosen pick through the lazily loaded module', async () => {
    const profile = demoProfile();
    const pattern = generateSample(profile, 'border');
    const calls: Array<{ kind: string; grid: unknown; fileName: string }> = [];
    const fake: PrintModule = {
      printPng: async (_p, grid, fileName) => {
        calls.push({ kind: 'png', grid, fileName });
        return { ok: true };
      },
      printSvg: (_p, grid, fileName) => {
        calls.push({ kind: 'svg', grid, fileName });
        return { ok: true };
      },
    };
    expect(await runPrint('png', profile, pattern, 2, 'a.png', async () => fake)).toBeNull();
    expect(await runPrint('svg', profile, pattern, 999, 'b.svg', async () => fake)).toBeNull();
    expect(calls[0]?.grid).toBe(pattern[1]);
    expect(calls[1]?.grid).toBe(pattern[pattern.length - 1]);
  });

  it('R21.17 an invalid card gives the failure message key and no download', async () => {
    const profile = demoProfile();
    const pattern = [[[1]]] as unknown as ReturnType<typeof generateSample>;
    let saved = 0;
    const real = await import('../../../src/ui/printable/download.ts');
    const deps = { encodePng: async () => new Uint8Array(), saveFile: () => void (saved += 1) };
    const module: PrintModule = {
      printPng: (p, g, f) => real.printPng(p, g, f, deps),
      printSvg: (p, g, f) => real.printSvg(p, g, f, deps),
    };
    expect(await runPrint('png', profile, pattern, 1, 'a.png', async () => module)).toBe('error.print.invalid-card');
    expect(await runPrint('svg', profile, pattern, 1, 'a.svg', async () => module)).toBe('error.print.invalid-card');
    expect(saved).toBe(0);
    expect(EN['error.print.invalid-card']).toBeDefined();
    expect(HI['error.print.invalid-card']).toBeDefined();
  });

  it('R21.17 a module that fails to load gives the generic message and no download', async () => {
    const key = await runPrint('png', demoProfile(), generateSample(demoProfile(), 'floral'), 1, 'a.png', () =>
      Promise.reject(new Error('offline')),
    );
    expect(key).toBe('error.generic');
  });
});

describe('Try it Demo strip', () => {
  it('shows "Show a lost card" and "Show a torn card" with a Demo chip, in both languages', () => {
    for (const language of ['en', 'hi'] as const) {
      const html = render(language);
      const t = translator(DICTIONARIES, language);
      expect(html).toContain(`>${escape(t('tryit.demo.lostCard'))}</button>`);
      expect(html).toContain(`>${escape(t('tryit.demo.tornCard'))}</button>`);
      expect(html).toContain(`>${escape(t('demo.chip'))}<`);
      expect(html).toContain('data-demo-gap="missing"');
      expect(html).toContain('data-demo-gap="damaged"');
    }
  });
  it('keeps the three samples and the lost cards button', () => {
    const html = render('en');
    for (const design of ['diamond', 'border', 'floral']) expect(html).toContain(`data-sample="${design}"`);
    expect(html).toContain(escape(EN['tryit.lost'] as string));
  });
  it('without a Card_Profile both demo buttons wait', () => {
    const t = translator(DICTIONARIES, 'en');
    const html = renderToStaticMarkup(<TryIt profile={null} confirm={null} dispatch={() => undefined} t={t} />);
    expect(html.match(/<button[^>]*data-demo-gap="[a-z]+"[^>]*>/g)?.every((tag) => /disabled/.test(tag))).toBe(true);
    expect(html.match(/data-demo-gap/g)).toHaveLength(2);
  });
});
