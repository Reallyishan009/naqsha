import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScreenBoundary, Shell, screenErrorKey } from '../../../src/ui/App.tsx';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { initialAppState } from '../../../src/ui/state/appState.ts';
import type { AppState, Language, Screen } from '../../../src/ui/types.ts';

const LANGUAGES: Language[] = ['hi', 'en'];
const noop = (): void => undefined;

function render(state: AppState, onRetryProfile?: () => void): string {
  return renderToStaticMarkup(<Shell state={state} dispatch={noop} onRetryProfile={onRetryProfile} />);
}

/** The inner text of each navigation button. */
function navCount(html: string): number {
  return (/<nav[^>]*>(.*?)<\/nav>/.exec(html)?.[1] ?? '').match(/<button/g)?.length ?? 0;
}

const count = (html: string, pattern: RegExp): number => html.match(pattern)?.length ?? 0;

describe('Shell states on StateMessage and LoadingState', () => {
  it('R11.10 a failed profile on Keep is an error StateMessage with a Try again control, no role, and the navigation', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = render({ ...initialAppState, language, screen: 'keep', profile: { status: 'failed', failure: { reason: 'not-json' } } }, noop);
      expect(html).toContain(t('error.profile.banner'));
      expect(html).toContain(t('error.profile.not-json'));
      expect(html).toContain(`>${t('state.retry')}</button>`);
      // The Shell's live region and the Screens announce a profile failure, so the visible message has no role.
      expect(html).not.toContain('role="alert"');
      expect(navCount(html)).toBe(4);
    }
  });

  it('R11.10 on the Landing the Shell leaves the profile retry to the Landing, so there is one Try again control', () => {
    const t = translator(DICTIONARIES, 'en');
    const html = render({ ...initialAppState, language: 'en', screen: 'weave', profile: { status: 'failed', failure: { reason: 'not-json' } } }, noop);
    expect(count(html, new RegExp(`>${t('state.retry')}</button>`, 'g'))).toBe(1);
    expect(navCount(html)).toBe(4);
  });

  it('R11.9 a loading profile on Keep is one LoadingState region besides the Shell live region', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = render({ ...initialAppState, language, screen: 'keep' });
      expect(html).toContain(t('status.loading'));
      // The LoadingState region and the one persistent Shell live region.
      expect(count(html, /role="status"/g)).toBe(2);
      expect(count(html, /<div role="status" aria-live="polite"/g)).toBe(1);
    }
  });

  it('R11.9 on the Landing the loading profile is shown once, by the Landing', () => {
    const t = translator(DICTIONARIES, 'en');
    const html = render({ ...initialAppState, language: 'en', screen: 'weave' });
    expect(count(html, new RegExp(t('status.loading'), 'g'))).toBe(1);
  });

  it('R11.9 while a Screen chunk is not there the fallback is a LoadingState with the screen text, and the navigation stays', () => {
    for (const screen of ['scan', 'code'] as Screen[]) {
      for (const language of LANGUAGES) {
        const t = translator(DICTIONARIES, language);
        const html = render({ ...initialAppState, language, screen, profile: { status: 'failed', failure: { reason: 'not-json' } } });
        expect(html).toContain(t('status.screen'));
        expect(navCount(html)).toBe(4);
      }
    }
  });
});

describe('ScreenBoundary failure', () => {
  it('R11.10 a failed Screen is an error StateMessage that announces itself once and offers a Try again control', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      for (const screen of ['weave', 'code'] as Screen[]) {
        const message = t(screenErrorKey(screen));
        const boundary = new ScreenBoundary({ message, t, onRetry: noop, children: null });
        boundary.state = ScreenBoundary.getDerivedStateFromError();
        const html = renderToStaticMarkup(boundary.render());
        expect(html).toContain(message.replaceAll("'", '&#x27;'));
        expect(count(html, /role="alert"/g)).toBe(1);
        expect(html).toContain(`>${t('state.retry')}</button>`);
        expect(html).not.toContain('autofocus');
      }
    }
  });

  it('a Screen that has not failed renders its children and no message', () => {
    const t = translator(DICTIONARIES, 'en');
    const boundary = new ScreenBoundary({ message: 'x', t, onRetry: noop, children: 'fine' });
    expect(boundary.render()).toBe('fine');
  });
});
