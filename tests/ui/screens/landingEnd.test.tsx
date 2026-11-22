import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../../../src/ui/components/Button.tsx';
import { DICTIONARIES, EN, HI, translator } from '../../../src/ui/i18n/messages.ts';
import { Landing } from '../../../src/ui/screens/weave/Landing.tsx';
import { NightSection } from '../../../src/ui/screens/weave/LandingEnd.tsx';
import { initialAppState } from '../../../src/ui/state/appState.ts';
import { IMAGE_CREDITS } from '../../../src/ui/state/imageCredits.ts';
import { FONT_CREDITS, REPOSITORY_LICENCE, REPOSITORY_URL, licenceNameOf } from '../../../src/ui/state/siteCredits.ts';
import type { ThemeName } from '../../../src/ui/theme/contrast.ts';
import type { AppState, Language } from '../../../src/ui/types.ts';
import { demoProfile } from '../../support/profiles.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const LANGUAGES: Language[] = ['en', 'hi'];
const SECTIONS = ['hero', 'how', 'what', 'samples', 'night', 'band', 'footer'];

function ready(language: Language): AppState {
  return { ...initialAppState, language, profile: { status: 'ready', profile: demoProfile() } };
}

function renderLanding(language: Language, theme: ThemeName = 'day'): string {
  const t = translator(DICTIONARIES, language);
  return renderToStaticMarkup(<Landing state={ready(language)} dispatch={() => undefined} t={t} theme={theme} />);
}

/** The text as the markup writes it: `&`, `<`, `>`, `"` and `'` as entities. */
function escapeHtml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
}

/** Every element in a tree of React elements (the tree of a component that holds no hook), parents before children. */
function elementsOf(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap((child) => elementsOf(child as ReactNode));
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elementsOf(node.props.children as ReactNode)];
}

describe('Landing, the last three sections', () => {
  it('R8.1 the Landing has seven sections in order: hero, how it works, what you can do, samples, night, band, footer', () => {
    for (const language of LANGUAGES) {
      const html = renderLanding(language);
      const found = [...html.matchAll(/data-landing-section="([a-z]+)"/g)].map((match) => match[1]);
      expect(found, language).toEqual(SECTIONS);
    }
  });

  it('every photo in docs/IMAGE_CREDITS.md and public/photos has its credit in the footer, with its licence and source links', () => {
    const files = readdirSync(path.join(ROOT, 'public/photos')).filter((name) => !name.startsWith('.'));
    for (const language of LANGUAGES) {
      const html = renderLanding(language);
      const footer = html.slice(html.indexOf('<footer'));
      for (const file of files) expect(footer, `${language}: credit for ${file}`).toContain(file);
      for (const credit of IMAGE_CREDITS) {
        expect(footer, credit.title).toContain(escapeHtml(credit.title));
        expect(footer, credit.author).toContain(escapeHtml(credit.author));
        expect(footer).toContain(`href="${escapeHtml(credit.licenceUrl)}"`);
        expect(footer).toContain(`href="${escapeHtml(credit.sourceUrl)}"`);
      }
    }
  });

  it('the Night button is a secondary Button that offers the other theme and hands the choice to the prop', () => {
    const t = translator(DICTIONARIES, 'en');
    for (const [theme, offered, label] of [
      ['day', 'night', EN['landing.night.action']],
      ['night', 'day', EN['landing.night.actionBack']],
    ] as const) {
      const chosen: ThemeName[] = [];
      const tree = NightSection({ language: 'en', t, theme, onThemeChosen: (next) => chosen.push(next) });
      const buttons = elementsOf(tree).filter((element) => element.type === Button);
      expect(buttons, theme).toHaveLength(1);
      const button = buttons[0]!;
      expect(button.props.variant, 'not a second primary Button').not.toBe('primary');
      expect(button.props.children).toBe(label);
      (button.props.onClick as () => void)();
      expect(chosen, theme).toEqual([offered]);
    }
    expect(EN['landing.night.actionBack']).toBe('Back to day');
    expect(HI['landing.night.actionBack']?.reviewed).toBe(false);
  });

  it('the Night section writes its button label for the theme in use, and does not break when no handler is given', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      expect(renderLanding(language, 'day')).toContain(`>${t('landing.night.action')}</button>`);
      expect(renderLanding(language, 'night')).toContain(`>${t('landing.night.actionBack')}</button>`);
    }
    const tree = NightSection({ language: 'en', t: translator(DICTIONARIES, 'en'), theme: 'day' });
    const button = elementsOf(tree).find((element) => element.type === Button)!;
    expect(() => (button.props.onClick as () => void)()).not.toThrow();
  });

  it('the Landing still has exactly one primary Button, with the two new sections added', () => {
    for (const language of LANGUAGES) {
      const html = renderLanding(language);
      const primaries = [...html.matchAll(/<(?:button|a)\b[^>]*class="([^"]*)"[^>]*>/g)].filter((match) =>
        match[1]!.split(/\s+/).some((name) => /(?:^|_)primary(?:_|$)/.test(name)),
      );
      expect(primaries, language).toHaveLength(1);
    }
  });

  it('the band holds the Scan and Sample buttons and the privacy line; the footer holds the four links, the licence, the GitHub link and the Kiro line', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = renderLanding(language);
      const band = html.slice(html.indexOf('data-landing-section="band"'), html.indexOf('<footer'));
      expect(band).toContain(`>${t('nav.scanCard')}</button>`);
      expect(band).toContain(`>${t('landing.trySample')}</button>`);
      expect(band).toContain(escapeHtml(t('landing.band.privacy')));
      const footer = html.slice(html.indexOf('<footer'));
      for (const screen of ['weave', 'keep', 'scan', 'code']) expect(footer).toContain(`href="#${screen}"`);
      expect(footer).toContain(escapeHtml(t('landing.footer.licence', { licence: REPOSITORY_LICENCE })));
      expect(footer).toMatch(new RegExp(`<a [^>]*href="${REPOSITORY_URL}"[^>]*rel="noopener"[^>]*>|<a [^>]*rel="noopener"[^>]*href="${REPOSITORY_URL}"[^>]*>`));
      expect(footer).toContain(escapeHtml(t('landing.footer.built')));
    }
    expect(EN['landing.footer.built']).toBe('Built with Kiro; planning and prompt drafting with Claude');
  });

  it('the licence named in the footer is the first line of LICENSE, and the repository address is the one in package.json', () => {
    const licence = readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
    expect(REPOSITORY_LICENCE).toBe(licence.split(/\r?\n/).find((line) => line.trim() !== '')!.trim());
    expect(REPOSITORY_LICENCE).toBe('MIT License');
    expect(licenceNameOf('\n\n  Apache License  \nVersion 2.0')).toBe('Apache License');
    expect(licenceNameOf('')).toBe('');
    const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { repository?: { url?: string } };
    expect(pkg.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '')).toBe(REPOSITORY_URL);
  });

  it('the font credits are one entry for each font family in public/fonts, each with a licence text that exists', () => {
    const files = readdirSync(path.join(ROOT, 'public/fonts'));
    const families = new Set(files.filter((name) => name.endsWith('.woff2')).map((name) => name.split('-')[0]));
    expect(FONT_CREDITS).toHaveLength(families.size);
    const licenceFiles = files.filter((name) => name.endsWith('-OFL.txt')).sort();
    expect(FONT_CREDITS.map((font) => font.licenceFile).sort()).toEqual(licenceFiles);
    for (const font of FONT_CREDITS) {
      expect(font.licence).toBe('SIL OFL 1.1');
      expect(families.has(font.licenceFile.replace(/-OFL\.txt$/, '')), font.family).toBe(true);
    }
    for (const language of LANGUAGES) {
      const html = renderLanding(language);
      expect(html.match(/data-font-family="/g) ?? []).toHaveLength(families.size);
    }
  });

  it('the Landing asks for no picture from another site: every image address is the app\'s own', () => {
    for (const language of LANGUAGES) {
      const html = renderLanding(language);
      const addresses = [...html.matchAll(/<img\b[^>]*>/g)].flatMap((match) => {
        const src = /\ssrc="([^"]*)"/.exec(match[0])?.[1];
        const srcSet = /\ssrcSet="([^"]*)"/.exec(match[0])?.[1] ?? '';
        return [...(src === undefined ? [] : [src]), ...srcSet.split(',').map((entry) => entry.trim().split(/\s+/)[0] ?? '')].filter((address) => address !== '');
      });
      expect(addresses.length, language).toBeGreaterThan(10);
      for (const address of addresses) expect(address, address).toMatch(/^(?:\.\/|\/)(?:photos|art)\/[A-Za-z0-9_-]+\.avif$/);
    }
    for (const file of ['Landing.module.css', 'LandingEnd.module.css', 'LandingSections.module.css']) {
      expect(readFileSync(path.join(ROOT, 'src/ui/screens/weave', file), 'utf8'), file).not.toMatch(/url\(/);
    }
  });

  it('the footer text is left-aligned, with no centred rule', () => {
    const css = readFileSync(path.join(ROOT, 'src/ui/screens/weave/LandingEnd.module.css'), 'utf8');
    expect(css).not.toMatch(/text-align:\s*center/);
    expect(/\.footer\s*\{[^}]*text-align:\s*left/.test(css)).toBe(true);
  });
});
