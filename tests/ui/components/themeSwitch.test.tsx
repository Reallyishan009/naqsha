import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Shell } from '../../../src/ui/App.tsx';
import { Selvedge } from '../../../src/ui/components/Selvedge.tsx';
import { ThemeSwitch } from '../../../src/ui/components/ThemeSwitch.tsx';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { appReducer, initialAppState } from '../../../src/ui/state/appState.ts';
import { demoProfile } from '../../support/profiles.ts';
import type { ThemeName } from '../../../src/ui/theme/contrast.ts';

const SRC = path.resolve(import.meta.dirname, '../../../src/ui');
const noop = (): void => undefined;

function markup(theme: ThemeName, language: 'en' | 'hi' = 'en'): string {
  const t = translator(DICTIONARIES, language);
  return renderToStaticMarkup(
    <ThemeSwitch theme={theme} label={t(theme === 'night' ? 'theme.toDay' : 'theme.toNight')} onChoose={noop} />,
  );
}

describe('ThemeSwitch', () => {
  it('R4.1 the Theme_Switch is an icon-only button with role switch, named by the loom a press switches to', () => {
    const day = markup('day');
    expect(day).toMatch(/^<button [^>]*role="switch"/);
    expect(day).toContain('type="button"');
    expect(day).toContain('aria-label="Switch to night loom"');
    expect(markup('night')).toContain('aria-label="Switch to day loom"');
    // No visible text: the sun or the moon is the whole control.
    expect(day.replace(/<svg.*<\/svg>/, '')).not.toMatch(/<span/);
  });

  it('R4.2 aria-checked follows the theme', () => {
    expect(markup('day')).toContain('aria-checked="false"');
    expect(markup('night')).toContain('aria-checked="true"');
  });

  it('R6.10 the accessible name is the action in both languages and both themes', () => {
    for (const language of ['en', 'hi'] as const) {
      const t = translator(DICTIONARIES, language);
      for (const theme of ['day', 'night'] as const) {
        expect(markup(theme, language)).toContain(`aria-label="${t(theme === 'night' ? 'theme.toDay' : 'theme.toNight')}"`);
      }
    }
  });

  it('R4.1 the sun and the moon are different drawn shapes, both aria-hidden', () => {
    const day = markup('day');
    const night = markup('night');
    expect(day).toContain('data-icon="sun"');
    expect(night).toContain('data-icon="moon"');
    expect(day).toMatch(/<svg [^>]*aria-hidden="true"/);
    expect(night).toMatch(/<svg [^>]*aria-hidden="true"/);
    expect(day).toContain('<circle');
    expect(night).toContain('<path');
    expect(night).not.toContain('<circle');
  });

  it('R4.1 activating the switch asks for the other theme', () => {
    const chosen: ThemeName[] = [];
    for (const theme of ['day', 'night'] as const) {
      const element = ThemeSwitch({ theme, label: 'Switch', onChoose: (next) => chosen.push(next) }) as ReactElement<{
        onClick: () => void;
      }>;
      element.props.onClick();
    }
    expect(chosen).toEqual(['night', 'day']);
  });

  it('R23.5 the switch is at least 48 by 48 px', () => {
    const source = readFileSync(path.join(SRC, 'components/ThemeSwitch.module.css'), 'utf8');
    expect(source).toMatch(/min-width:\s*var\(--touch-target\)/);
    expect(source).toMatch(/min-height:\s*var\(--touch-target\)/);
  });
});

describe('theme change and the AppState', () => {
  it('R4.9 the theme is not an AppState field and no AppAction names it', () => {
    expect(Object.keys(initialAppState)).not.toContain('theme');
    expect(readFileSync(path.join(SRC, 'types.ts'), 'utf8')).not.toMatch(/theme/i);
    expect(readFileSync(path.join(SRC, 'state/appState.ts'), 'utf8')).not.toMatch(/theme/i);
  });

  it('R4.9 every reducer action that a theme change could be mistaken for leaves the AppState as it is', () => {
    // The Shell calls onThemeChosen and never dispatches, so the state a theme change leaves is the state it found.
    const same = appReducer(initialAppState, { type: 'announce', kind: 'confirmation', messageKey: 'x' });
    expect(Object.keys(same).sort()).toEqual(Object.keys(initialAppState).sort());
  });

  it('R4.9 the Shell renders the switch from its theme prop and keeps one nav, four nav buttons and one live region', () => {
    for (const theme of ['day', 'night'] as const) {
      // The card profile is ready: while it loads, the Landing shows a LoadingState, which is a transient `role="status"` of its own.
      const state = { ...initialAppState, language: 'en' as const, profile: { status: 'ready' as const, profile: demoProfile() } };
      const html = renderToStaticMarkup(<Shell state={state} dispatch={noop} theme={theme} />);
      expect(html).toContain(`aria-checked="${theme === 'night'}"`);
      expect(html.match(/<nav /g)).toHaveLength(1);
      expect(html.match(/<button [^>]*class="[^"]*navButton/g)).toHaveLength(4);
      expect(html.match(/role="status"/g)).toHaveLength(1);
      expect(html).toMatch(/<header [^>]*><svg [^>]*data-selvedge/);
      expect(html).toContain(`aria-label="${theme === 'night' ? 'Switch to day loom' : 'Switch to night loom'}"`);
    }
  });
});

describe('Selvedge', () => {
  it('R4.11 the Selvedge is an inline svg 6 px high with a pattern of rects and no gradient', () => {
    const html = renderToStaticMarkup(<Selvedge />);
    expect(html).toMatch(/^<svg /);
    expect(html).toContain('height="6"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<pattern');
    expect(html.match(/<rect /g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).not.toMatch(/gradient|<image/i);
    const css = readFileSync(path.join(SRC, 'components/Selvedge.module.css'), 'utf8');
    expect(css).toContain('fill: var(--zari)');
    expect(css).toContain('fill: var(--madder)');
    // The header no longer clips (the menu sheet hangs below it), so the Selvedge is a strip between the rounded corners.
    expect(readFileSync(path.join(SRC, 'Shell.module.css'), 'utf8')).toMatch(/\.header > \[data-selvedge\] \{[^}]*left: var\(--radius-card\)/);
  });
});
