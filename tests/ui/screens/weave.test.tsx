import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RiseSkipControl, WeaveScreen } from '../../../src/ui/screens/weave/WeaveScreen.tsx';
import { TryIt } from '../../../src/ui/screens/weave/TryIt.tsx';
import { EN, HI, translator, DICTIONARIES } from '../../../src/ui/i18n/messages.ts';
import { initialAppState } from '../../../src/ui/state/appState.ts';
import type { AppState, Language } from '../../../src/ui/types.ts';
import { demoProfile } from '../../support/profiles.ts';

function render(state: AppState): string {
  const t = translator(DICTIONARIES, state.language);
  return renderToStaticMarkup(<WeaveScreen state={state} dispatch={() => undefined} t={t} />);
}

const LANGUAGES: Language[] = ['hi', 'en'];

describe('weave screen', () => {
  it('R2.1 with no design the screen shows the empty text and the play controls are disabled', () => {
    for (const language of LANGUAGES) {
      const html = render({ ...initialAppState, language });
      const t = translator(DICTIONARIES, language);
      expect(html).toContain(t('weave.empty').replaceAll('"', '&quot;'));
      for (const key of ['weave.play', 'weave.pause', 'weave.stepBack', 'weave.stepForward']) {
        const button = new RegExp(`<button[^>]*disabled[^>]*>${t(key)}</button>`);
        expect(button.test(html), `${language} ${key}`).toBe(true);
      }
      expect(/<input[^>]*type="range"[^>]*disabled/.test(html)).toBe(true);
      expect(html.match(/<select[^>]*disabled/g)?.length).toBe(5);
    }
  });

  it('R2.13 thread size, float highlight and the other preview controls are absent', () => {
    const html = render({ ...initialAppState, language: 'en' });
    for (const word of ['thread size', 'Thread size', 'float', 'Float', 'highlight', 'Highlight']) {
      expect(html).not.toContain(word);
    }
    expect(EN['weave.zari']).toBeDefined();
    expect(HI['weave.zari']).toBeDefined();
  });

  it('R2.8 the speed control offers slow, normal and fast in both languages', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = render({ ...initialAppState, language });
      const field = new RegExp(`<span>${t('weave.speed')}</span><select[^>]*>(.*?)</select>`).exec(html);
      expect(field, `${language} speed control`).not.toBeNull();
      const options = [...field![1]!.matchAll(/<option[^>]*>(.*?)<\/option>/g)].map((match) => match[1]);
      expect(options).toEqual([t('weave.speed.slow'), t('weave.speed.normal'), t('weave.speed.fast')]);
      expect(new Set(options).size).toBe(3);
    }
  });

  it('R3.8 the screen has only the controls of Requirements 2 and 3: no number entry, no thread size, no float highlight', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const whole = render({ ...initialAppState, language, profile: { status: 'ready', profile: demoProfile() } });
      // The Try it section has its own print controls (R21.2); R3.8 is about the cloth controls above it.
      const html = whole.slice(0, whole.indexOf('<section aria-labelledby="tryit-title"'));
      expect(html.length).toBeGreaterThan(0);
      expect(html).not.toContain('type="number"');
      expect(html).not.toContain('type="text"');
      expect(html.match(/<input/g)).toHaveLength(1); // the scrubber
      expect(html).toContain('type="range"');
      // Speed, warp colour, weft colour, zari, repeat.
      expect(html.match(/<select/g)).toHaveLength(5);
      const labels = [...html.matchAll(/<label[^>]*><span>(.*?)<\/span>/g)].map((match) => match[1]);
      expect(labels).toEqual(
        ['weave.scrubber', 'weave.speed', 'weave.warpColour', 'weave.weftColour', 'weave.zari', 'weave.repeat'].map((key) => t(key)),
      );
    }
    const en = render({ ...initialAppState, language: 'en' });
    expect(en).not.toMatch(/picks per second|thread size|float|highlight/i);
  });

  it('R4.1 Try it offers three Sample_Designs, enabled once the profile is ready', () => {
    const loading = render({ ...initialAppState, language: 'en' });
    expect((loading.match(/<button[^>]*disabled[^>]*>(Diamond|Border|Floral)</g) ?? []).length).toBe(3);
    const ready = render({
      ...initialAppState,
      language: 'en',
      profile: { status: 'ready', profile: demoProfile() },
    });
    expect(ready).toMatch(/<button(?![^>]*disabled)[^>]*>Diamond</);
    expect(ready).toMatch(/<button(?![^>]*disabled)[^>]*>Border</);
    expect(ready).toMatch(/<button(?![^>]*disabled)[^>]*>Floral</);
  });

  it('R4.7 Try it asks before replacing unsaved scanned cards, and not otherwise', () => {
    const t = translator(DICTIONARIES, 'en');
    const asking = renderToStaticMarkup(
      <TryIt
        profile={demoProfile()}
        confirm={{ kind: 'replace-with-sample', design: 'floral', pattern: [] }}
        dispatch={() => undefined}
        t={t}
      />,
    );
    expect(asking).toContain(EN['tryit.confirmReplace'] as string);
    expect(asking).toContain(EN['tryit.confirmYes'] as string);
    expect(asking).toContain(EN['tryit.confirmNo'] as string);
    const quiet = renderToStaticMarkup(
      <TryIt profile={demoProfile()} confirm={null} dispatch={() => undefined} t={t} />,
    );
    expect(quiet).not.toContain(EN['tryit.confirmReplace'] as string);
  });

  it('R2.12 a failed profile leaves Try it disabled and the screen usable', () => {
    const html = render({
      ...initialAppState,
      language: 'en',
      profile: { status: 'failed', failure: { reason: 'not-json' } },
    });
    expect((html.match(/<button[^>]*disabled[^>]*>(Diamond|Border|Floral)</g) ?? []).length).toBe(3);
  });
});

describe('rise skip control', () => {
  it('R20.2 the skip control is a labelled button in both languages while the effect runs', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = renderToStaticMarkup(<RiseSkipControl running={true} t={t} onSkip={() => undefined} />);
      expect(html).toContain(`>${t('weave.skipRise')}</button>`);
      expect(html).toContain('type="button"');
    }
    expect(HI['weave.skipRise']).toBeDefined();
  });
  it('R20.4 no skip control is shown when the effect is not running', () => {
    const t = translator(DICTIONARIES, 'en');
    expect(renderToStaticMarkup(<RiseSkipControl running={false} t={t} onSkip={() => undefined} />)).toBe('');
    expect(render({ ...initialAppState, prefersReducedMotion: true })).not.toContain(t('weave.skipRise'));
  });
});
