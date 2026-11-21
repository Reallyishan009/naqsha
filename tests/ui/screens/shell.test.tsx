import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Shell } from '../../../src/ui/App.tsx';
import { DICTIONARIES, EN, HI, translator } from '../../../src/ui/i18n/messages.ts';
import { ScanView } from '../../../src/ui/screens/scan/ScanScreen.tsx';
import { initialAppState } from '../../../src/ui/state/appState.ts';
import { initialScanState } from '../../../src/ui/state/scan.ts';
import { demoProfile } from '../../support/profiles.ts';
import type { AppState, Language, Screen } from '../../../src/ui/types.ts';

function render(state: AppState): string {
  return renderToStaticMarkup(<Shell state={state} dispatch={() => undefined} />);
}

const SCREENS: Screen[] = ['weave', 'keep', 'scan', 'code'];
const LANGUAGES: Language[] = ['hi', 'en'];

function navLabel(language: Language, screen: Screen): string {
  return language === 'en' ? (EN[`nav.${screen}`] as string) : (HI[`nav.${screen}`]?.text as string);
}

describe('shell', () => {
  it('R1.1 the shell provides the Weave, Keep and Scan screens, each with its own heading and content', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const ready = { ...initialAppState, language, profile: { status: 'ready' as const, profile: demoProfile() } };
      const weave = render({ ...ready, screen: 'weave' });
      expect(weave).toContain(`>${navLabel(language, 'weave')}</h2>`);
      expect(weave).toContain(t('weave.empty').replaceAll('"', '&quot;'));
      const keep = render({ ...ready, screen: 'keep' });
      expect(keep).toContain(`>${navLabel(language, 'keep')}</h2>`);
      expect(keep).toContain(t('keep.export.button'));
      // The Scan screen is loaded on demand, so the shell shows the loading text until its chunk arrives. The screen
      // itself is rendered from its own module.
      expect(render({ ...ready, screen: 'scan' })).not.toContain(`>${navLabel(language, 'weave')}</h2>`);
      const scan = renderToStaticMarkup(
        <ScanView
          profile={demoProfile()}
          scan={initialScanState}
          batch={[]}
          pendingRemove={null}
          replacingIndex={null}
          confirmingDone={false}
          viewWidthPx={360}
          t={t}
          onFile={() => undefined}
          onToggle={() => undefined}
          onUndo={() => undefined}
          onZoom={() => undefined}
          onAccept={() => undefined}
          onDiscard={() => undefined}
          onRemoveRequest={() => undefined}
          onRemoveConfirm={() => undefined}
          onRemoveCancel={() => undefined}
          onMove={() => undefined}
          onScanAgain={() => undefined}
          onCancelReplacing={() => undefined}
          onDone={() => undefined}
          onCommit={() => undefined}
          onDoneCancel={() => undefined}
        />,
      );
      expect(scan).toContain(`>${navLabel(language, 'scan')}</h2>`);
    }
    expect(SCREENS).toHaveLength(4);
  });

  it('R1.2 the app starts on the Weave screen', () => {
    expect(initialAppState.screen).toBe('weave');
    const html = render({ ...initialAppState, language: 'en' });
    expect(html).toContain('aria-current="page"');
    expect(/aria-current="page"[^>]*>Weave</.test(html)).toBe(true);
  });

  it('R1.3 four visible navigation controls on every screen, in both languages', () => {
    for (const screen of SCREENS) {
      for (const language of LANGUAGES) {
        const html = render({ ...initialAppState, screen, language });
        const nav = /<nav[^>]*>(.*?)<\/nav>/.exec(html)?.[1] ?? '';
        expect(nav.match(/<button/g)?.length, `${screen} ${language}`).toBe(4);
        for (const target of SCREENS) expect(nav).toContain(`>${navLabel(language, target)}<`);
      }
    }
  });

  it('the pill header has a named menu button that starts collapsed, the group it controls, and one Scan pill, in both languages', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = render({ ...initialAppState, language });
      const button = /<button\b[^>]*aria-expanded="false"[^>]*aria-controls="([^"]+)"[^>]*>(.*?)<\/button>/.exec(html);
      expect(button, `${language} menu button`).not.toBeNull();
      expect(button![2]).toContain(`<span>${t('nav.menu')}</span>`);
      // The group holds the navigation, the language switch, the theme switch and the Scan pill, so it can hide them as one.
      const group = new RegExp(`<div id="${button![1]}"[^>]*data-open="false"[^>]*>(.*)</div></div></header>`).exec(html)?.[1] ?? '';
      expect(group).toContain('<nav ');
      expect(group).toContain('role="group"');
      expect(group).toContain('role="switch"');
      expect(group).toContain(`>${t('nav.scanCard')}</button>`);
      expect(html.split(`>${t('nav.scanCard')}</button>`)).toHaveLength(2);
    }
  });

  it('R12.2 the language switch offers both languages as pressable buttons', () => {
    const html = render({ ...initialAppState, language: 'hi' });
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('lang="hi"');
    expect(html).toContain('lang="en"');
  });

  it('R14.10 there is exactly one live region and it shows the announcement', () => {
    // The card profile is ready: while it loads, the Landing shows a LoadingState, which is a transient `role="status"` of its own.
    const html = render({
      ...initialAppState,
      language: 'en',
      profile: { status: 'ready', profile: demoProfile() },
      announcement: { kind: 'error', messageKey: 'error.generic', id: 1 },
    });
    expect(html.match(/role="status"/g)?.length).toBe(1);
    expect(html).toContain(EN['error.generic'] as string);
  });

  it('R1.7 a profile error shows a message and keeps the navigation', () => {
    const html = render({
      ...initialAppState,
      language: 'en',
      profile: { status: 'failed', failure: { reason: 'not-json' } },
    });
    expect(html).toContain(EN['error.profile.banner'] as string);
    expect(html).toContain(EN['error.profile.not-json'] as string);
    expect((/<nav[^>]*>(.*?)<\/nav>/.exec(html)?.[1] ?? '').match(/<button/g)?.length).toBe(4);
  });

  it('R24.5 a waiting new version is announced with a control that loads it, and nothing is shown otherwise', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const quiet = renderToStaticMarkup(<Shell state={{ ...initialAppState, language }} dispatch={() => undefined} />);
      expect(quiet).not.toContain(t('update.ready'));
      const html = renderToStaticMarkup(
        <Shell state={{ ...initialAppState, language }} dispatch={() => undefined} updateReady onLoadUpdate={() => undefined} />,
      );
      expect(html).toContain(t('update.ready'));
      expect(html).toContain(`>${t('update.load')}</button>`);
      // The navigation is still there, so the notice never blocks the app.
      expect((/<nav[^>]*>(.*?)<\/nav>/.exec(html)?.[1] ?? '').match(/<button/g)?.length).toBe(4);
    }
  });

  it('R14.1 the shell styles give controls a 48 px minimum', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const root = path.resolve(import.meta.dirname, '../../..');
    const tokens = readFileSync(path.join(root, 'src/ui/theme/tokens.css'), 'utf8');
    const shell = readFileSync(path.join(root, 'src/ui/Shell.module.css'), 'utf8');
    expect(tokens).toContain('--touch-target: 48px');
    expect(shell.match(/min-height: var\(--touch-target\)/g)?.length).toBeGreaterThan(0);
    expect(tokens).toContain('prefers-reduced-motion: reduce');
    expect(tokens).toContain('outline: 3px solid var(--zari)');
  });
});
