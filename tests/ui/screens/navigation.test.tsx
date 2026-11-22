import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Shell } from '../../../src/ui/App.tsx';
import { EN, HI } from '../../../src/ui/i18n/messages.ts';
import { initialAppState } from '../../../src/ui/state/appState.ts';
import type { Language, Screen } from '../../../src/ui/types.ts';

const SCREENS: Array<Exclude<Screen, 'home'>> = ['weave', 'keep', 'scan', 'code'];
const LANGUAGES: Language[] = ['hi', 'en'];
const ROOT = path.resolve(import.meta.dirname, '../../..');

function label(language: Language, key: string): string {
  return language === 'en' ? (EN[key] as string) : (HI[key]?.text as string);
}

/** The inner markup of each navigation button, with the attributes of its opening tag. */
function navButtons(screen: Screen, language: Language): Array<{ attributes: string; inner: string }> {
  const html = renderToStaticMarkup(<Shell state={{ ...initialAppState, screen, language }} dispatch={() => undefined} />);
  const nav = /<nav[^>]*>(.*?)<\/nav>/.exec(html)?.[1] ?? '';
  return [...nav.matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)].map((match) => ({ attributes: match[1]!, inner: match[2]! }));
}

describe('navigation', () => {
  it('R9.1 four items, each with its label first and a different aria-hidden icon', () => {
    for (const language of LANGUAGES) {
      const icons = new Set<string>();
      const buttons = navButtons('weave', language);
      expect(buttons).toHaveLength(4);
      buttons.forEach((button, index) => {
        const text = label(language, `nav.${SCREENS[index]}`);
        // The label is the first text of the button, before the icon.
        expect(button.inner.startsWith(`${text}<svg`), `${language} ${SCREENS[index]}`).toBe(true);
        const svg = /<svg\b([^>]*)>(.*?)<\/svg>/.exec(button.inner);
        expect(svg?.[1]).toContain('aria-hidden="true"');
        icons.add(svg![2]!);
      });
      expect(icons.size, `${language} the four icons differ`).toBe(4);
    }
  });

  it('R9.2 exactly the current item has aria-current="page", on every screen', () => {
    for (const screen of SCREENS) {
      for (const language of LANGUAGES) {
        const current = navButtons(screen, language).map((button) => button.attributes.includes('aria-current'));
        expect(current, `${screen} ${language}`).toEqual(SCREENS.map((item) => item === screen));
        expect(navButtons(screen, language)[SCREENS.indexOf(screen)]!.attributes).toContain('aria-current="page"');
      }
    }
  });

  it('R9.2 on the home screen no navigation item has aria-current, and there are still four items', () => {
    for (const language of LANGUAGES) {
      const buttons = navButtons('home', language);
      expect(buttons).toHaveLength(4);
      expect(buttons.map((button) => button.attributes.includes('aria-current')), language).toEqual([false, false, false, false]);
    }
  });
  it('R9.4 no navigation item carries the word from nav.advanced (the Code view screen shows it as a chip instead), and nav.code is unchanged', () => {
    expect(EN['nav.code']).toBe('Code');
    for (const language of LANGUAGES) {
      const word = label(language, 'nav.advanced');
      expect(word).not.toBe('');
      const buttons = navButtons('weave', language);
      buttons.forEach((button, index) => {
        expect(button.inner.includes(word), `${language} ${SCREENS[index]}`).toBe(false);
      });
      expect(buttons[3]!.inner.startsWith(`${label(language, 'nav.code')}<svg`)).toBe(true);
    }
    expect(HI['nav.advanced']?.reviewed).toBe(false);
  });

  it('R9.3 R9.5 R9.6 the styles mark the current item by weight, a 3 px underline and a fill, wrap without a media query, and keep 48 px targets (the sheet rows too)', () => {
    const css = readFileSync(path.join(ROOT, 'src/ui/Shell.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = (selector: string): string => {
      for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1]!.trim() === selector) return match[2]!;
      return '';
    };
    const current = rule(".navButton[aria-current='page']");
    expect(current).toMatch(/font-weight:\s*700/);
    expect(current).toMatch(/text-decoration:\s*underline/);
    expect(current).toMatch(/text-decoration-thickness:\s*3px/);
    expect(current).toMatch(/background:\s*var\(--accent\)/);
    expect(current).toMatch(/color:\s*var\(--on-primary\)/);
    expect(rule('.navIcon')).toMatch(/order:\s*-1/);
    expect(rule('.navButton')).toMatch(/flex-direction:\s*row/);
    expect(rule('.navButton')).toMatch(/min-height:\s*var\(--touch-target\)/);
    expect(rule('.navButton')).toMatch(/min-width:\s*var\(--touch-target\)/);
    expect(rule('.nav')).toMatch(/flex-wrap:\s*wrap/);
    expect(rule('.sheet .navButton')).toMatch(/min-height:\s*var\(--touch-target\)/);
    expect(rule('.switches')).toMatch(/flex-wrap:\s*wrap/);
    expect(css).not.toContain('@media');
  });
});
