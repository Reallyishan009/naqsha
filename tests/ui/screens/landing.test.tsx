import { readFileSync } from 'node:fs';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CardProfile } from '../../../src/codec/index.ts';
import { DICTIONARIES, EN, HI, translator } from '../../../src/ui/i18n/messages.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { renderClothPreview } from '../../../src/ui/screens/weave/ClothPreview.tsx';
import { Landing, SampleTile, SampleTiles } from '../../../src/ui/screens/weave/Landing.tsx';
import type { SampleTileProps } from '../../../src/ui/screens/weave/Landing.tsx';
import { WeaveScreen } from '../../../src/ui/screens/weave/WeaveScreen.tsx';
import { initialAppState } from '../../../src/ui/state/appState.ts';
import type { AppAction, AppState, Language, SampleDesign } from '../../../src/ui/types.ts';
import { demoProfile } from '../../support/profiles.ts';

const LANGUAGES: Language[] = ['en', 'hi'];
const DESIGNS: SampleDesign[] = ['diamond', 'border', 'floral'];

/** The words the Landing may not show, in English and as the Hindi writes them (hi.json has none of them today). */
const FORBIDDEN: Record<Language, string[]> = {
  en: ['bitmap', 'matrix', 'decode', 'threshold', 'grid detection', 'canvas'],
  hi: ['बिटमैप', 'मैट्रिक्स', 'डिकोड', 'थ्रेशोल्ड', 'ग्रिड', 'कैनवास'],
};

function ready(language: Language): AppState {
  return { ...initialAppState, language, profile: { status: 'ready', profile: demoProfile() } };
}

function renderLanding(state: AppState, onRetryProfile?: () => void): string {
  const t = translator(DICTIONARIES, state.language);
  return renderToStaticMarkup(<Landing state={state} dispatch={() => undefined} t={t} onRetryProfile={onRetryProfile} />);
}

/** The visible text and the accessible names (aria-label, alt, title) of a piece of markup. */
function textAndNames(html: string): string {
  const names = [...html.matchAll(/\b(?:aria-label|alt|title)="([^"]*)"/g)].map((match) => match[1]);
  return [html.replace(/<[^>]*>/g, ' '), ...names].join(' ');
}

describe('Landing', () => {
  it('R8.1 R8.12 a Weave screen with no pick and a ready profile shows the Landing, and one with a pick does not', () => {
    const t = translator(DICTIONARIES, 'en');
    const empty = renderToStaticMarkup(<WeaveScreen state={ready('en')} dispatch={() => undefined} t={t} />);
    const headline = (EN['landing.headline'] as string).replaceAll("'", '&#x27;');
    expect(empty).toContain(headline);
    expect(initialAppState.screen).toBe('weave');
    const profile = demoProfile();
    const arrived: AppState = {
      ...ready('en'),
      current: { pattern: generateSample(profile, 'diamond'), origin: { kind: 'sample', design: 'diamond' } },
    };
    const player = renderToStaticMarkup(<WeaveScreen state={arrived} dispatch={() => undefined} t={t} />);
    expect(player).not.toContain(headline);
  });

  it('R8.2 the headline is a heading in the display font, in both languages from the translation files', () => {
    expect(EN['landing.headline']).toBe("Read a loom's punch cards. Weave the design again.");
    expect(HI['landing.headline']?.reviewed).toBe(false);
    for (const language of LANGUAGES) {
      const html = renderLanding(ready(language));
      const text = translator(DICTIONARIES, language)('landing.headline').replaceAll("'", '&#x27;');
      expect(html).toMatch(new RegExp(`<h3 class="[^"]*headline[^"]*">${text}</h3>`));
    }
    const css = readFileSync('src/ui/screens/weave/Landing.module.css', 'utf8');
    expect(/\.headline\s*\{[^}]*font-family:\s*var\(--font-display\)/.test(css)).toBe(true);
  });

  it('R8.3 the Step_Strip has three steps in order, each labelled in the current language', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = renderLanding(ready(language));
      const list = /<ol [^>]*>(.*?)<\/ol>/s.exec(html)?.[1] ?? '';
      const labels = [...list.matchAll(/<li [^>]*>.*?<span class="[^"]*stepLabel[^"]*">(.*?)<\/span><\/li>/gs)].map((match) => match[1]);
      expect(labels).toEqual([t('landing.step.scan'), t('landing.step.weave'), t('landing.step.keep')]);
      expect(html).toContain(`aria-label="${t('landing.steps.name')}"`);
    }
    for (const key of ['landing.step.scan', 'landing.step.weave', 'landing.step.keep']) {
      expect(HI[key]?.reviewed, key).toBe(false);
    }
  });

  it('R8.4 R8.5 there is one tile for each Sample_Design, the first primary and the other two secondary', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = renderLanding(ready(language));
      const tiles = [...html.matchAll(/<button\b[^>]*data-sample="([a-z]+)"[^>]*>/g)];
      expect(tiles.map((match) => match[1])).toEqual(DESIGNS);
      const kinds = tiles.map((match) => {
        const classes = /class="([^"]*)"/.exec(match[0])?.[1] ?? '';
        return /(?:^|_)primary(?:_|$)/.test(classes.split(/\s+/).join('_')) ? 'primary' : 'secondary';
      });
      expect(kinds).toEqual(['primary', 'secondary', 'secondary']);
      for (const tile of tiles) expect(tile[0]).toContain('type="button"');
      // Each tile holds the name, a picture and the label, and the whole of it is the one button.
      for (const design of DESIGNS) {
        const body = new RegExp(`<button\\b[^>]*data-sample="${design}"[^>]*>(.*?)</button>`, 's').exec(html)?.[1] ?? '';
        expect(body).toContain(t(`tryit.${design}`));
        expect(body).toContain('<canvas');
        expect(body).toContain(t('landing.tile.try'));
      }
      // No other primary Button on the Landing.
      const primaries = [...html.matchAll(/<(?:button|a)\b[^>]*class="([^"]*)"[^>]*>/g)].filter((match) =>
        match[1]!.split(/\s+/).some((name) => /(?:^|_)primary(?:_|$)/.test(name)),
      );
      expect(primaries).toHaveLength(1);
    }
  });

  it('R8.6 pressing a tile dispatches request-sample with the Pattern of its own design', () => {
    const profile = demoProfile();
    const t = translator(DICTIONARIES, 'en');
    const dispatched: AppAction[] = [];
    // SampleTiles holds no hook, so it can be called on its own and its tiles' handlers read from the element tree.
    const tree = SampleTiles({
      profile: { status: 'ready', profile },
      previews: DESIGNS.map((design) => ({ design, pattern: generateSample(profile, design) })),
      dispatch: (action) => dispatched.push(action),
      t,
    }) as ReactElement<{ children: ReactElement<SampleTileProps>[] }>;
    const tiles = tree.props.children;
    expect(tiles.map((tile) => tile.props.design)).toEqual(DESIGNS);
    for (const tile of tiles) tile.props.onChoose();
    expect(dispatched).toEqual(
      DESIGNS.map((design) => ({ type: 'request-sample', design, pattern: generateSample(profile, design) })),
    );
  });

  it('R8.7 the link to Scan comes after the last tile, is quiet, and goes to Scan', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = renderLanding(ready(language));
      const link = /<a [^>]*href="#scan"[^>]*>(.*?)<\/a>/s.exec(html);
      expect(link?.[1]).toBe(t('landing.scanLink'));
      expect(/class="[^"]*quiet[^"]*"/.test(link?.[0] ?? '')).toBe(true);
      expect(html.indexOf('href="#scan"')).toBeGreaterThan(html.lastIndexOf('data-sample='));
    }
  });

  it('R8.8 the previews are drawn by the simulator from each design and use no image file', () => {
    const profile = demoProfile();
    for (const design of DESIGNS) {
      const pattern = generateSample(profile, design);
      const image = renderClothPreview(profile, pattern);
      expect(image).not.toBeNull();
      expect(image!.data.length).toBe(image!.width * image!.height * 4);
      // The cloth has more than one colour: warp, weft and the shed are all drawn.
      const colours = new Set<number>();
      const pixels = new Uint32Array(image!.data.buffer, image!.data.byteOffset, image!.width * image!.height);
      for (const pixel of pixels) colours.add(pixel);
      expect(colours.size, design).toBeGreaterThan(1);
    }
    const html = renderLanding(ready('en'));
    expect(html).not.toMatch(/<img|<picture|\bsrc=|url\(/);
  });

  it('R8.9 the Landing shows no forbidden word in its text or accessible names, in either language', () => {
    for (const language of LANGUAGES) {
      for (const state of [ready(language), { ...initialAppState, language }]) {
        const text = textAndNames(renderLanding(state)).toLowerCase();
        for (const word of [...FORBIDDEN.en, ...FORBIDDEN.hi]) expect(text, `${language}: ${word}`).not.toContain(word.toLowerCase());
      }
      const t = translator(DICTIONARIES, language);
      for (const key of ['landing.headline', 'landing.step.scan', 'landing.step.weave', 'landing.step.keep', 'landing.steps.name', 'landing.tile.try', 'landing.scanLink', 'weave.purpose', 'weave.empty']) {
        for (const word of [...FORBIDDEN.en, ...FORBIDDEN.hi]) expect(t(key).toLowerCase(), `${language} ${key}`).not.toContain(word.toLowerCase());
      }
    }
  });

  it('R8.13 while the profile loads the Landing shows the loading message in place of the tiles', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = renderLanding({ ...initialAppState, language });
      expect(html).toContain(t('status.loading'));
      expect(html).toMatch(/<div role="status">/);
      expect(html).not.toContain('data-sample=');
      expect(html).toContain(t('landing.headline').replaceAll("'", '&#x27;'));
    }
  });

  it('R8.11 when the profile failed the Landing shows the error in place of the tiles, with a retry only when it can retry', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const failed: AppState = { ...initialAppState, language, profile: { status: 'failed', failure: { reason: 'not-json' } } };
      const html = renderLanding(failed, () => undefined);
      expect(html).toContain(t('error.profile.not-json'));
      expect(html).toContain(t('notice.error'));
      expect(html).not.toContain('data-sample=');
      expect(html).not.toContain('role="alert"');
      expect(html).toMatch(new RegExp(`<button[^>]*>${t('state.retry')}</button>`));
      expect(renderLanding(failed)).not.toContain(t('state.retry'));
    }
  });

  it('R8.14 a design the simulator cannot draw gives no preview and no error, so the tile keeps its name and label', () => {
    const profile = demoProfile();
    const broken = { ...profile, hookRows: 0 } as unknown as CardProfile;
    expect(renderClothPreview(broken, generateSample(profile, 'diamond'))).toBeNull();
    expect(renderClothPreview(profile, null as never)).toBeNull();
    const t = translator(DICTIONARIES, 'en');
    const html = renderToStaticMarkup(
      <SampleTile design="border" profile={broken} pattern={[]} primary={false} t={t} onChoose={() => undefined} />,
    );
    expect(html).toContain('data-sample="border"');
    expect(html).toContain(t('tryit.border'));
    expect(html).toContain(t('landing.tile.try'));
    expect(html).not.toContain(t('notice.error'));
  });

  it('R8.2 the Landing text is left-aligned, with no centred rule', () => {
    const css = readFileSync('src/ui/screens/weave/Landing.module.css', 'utf8');
    expect(css).not.toMatch(/text-align:\s*center/);
    expect(/\.landing\s*\{[^}]*text-align:\s*left/.test(css)).toBe(true);
  });
});
