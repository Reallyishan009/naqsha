import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { WeaveScreen } from '../../../src/ui/screens/weave/WeaveScreen.tsx';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { appReducer, initialAppState } from '../../../src/ui/state/appState.ts';
import type { AppAction, AppState } from '../../../src/ui/types.ts';
import { demoProfile } from '../../support/profiles.ts';

const en = translator(DICTIONARIES, 'en');

describe('Weave finished on return', () => {
  it('R18.6 a cloth woven to the end comes back finished after a visit to Code view, not paused', () => {
    const profile = demoProfile();
    const pattern = generateSample(profile, 'diamond');
    const pickCount = pattern.length;
    expect(pickCount).toBeGreaterThan(1);

    // The actions the Weave screen sends as the sample plays: every frame selects its pick, and the last frame is pick
    // `pickCount`, which the reducer clamps; the end of the cloth is then reported.
    const woven: AppAction[] = [
      { type: 'profile-loaded', state: { status: 'ready', profile } },
      { type: 'request-sample', design: 'diamond', pattern },
      { type: 'cloth-unfinished' },
      { type: 'select-pick', pick: Math.floor(pickCount / 2) },
      { type: 'select-pick', pick: pickCount },
      { type: 'cloth-finished' },
    ];
    const atEnd: AppState = woven.reduce(appReducer, { ...initialAppState, language: 'en' });
    expect(atEnd.selectedPick).toBe(pickCount - 1);

    const back = [{ type: 'navigate', screen: 'code' }, { type: 'navigate', screen: 'weave' }].reduce(
      (state, action) => appReducer(state, action as AppAction),
      atEnd,
    );
    expect(back.current.pattern).toBe(pattern);
    expect(back.selectedPick).toBeGreaterThanOrEqual(0);
    expect(back.selectedPick).toBeLessThanOrEqual(pickCount - 1);

    const html = renderToStaticMarkup(createElement(WeaveScreen, { state: back, dispatch: () => undefined, t: en }));
    // Finished: the Play button, the last pick woven out of all picks, and the scrubber at its end.
    expect(html).toContain(`>${en('weave.play')}</button>`);
    expect(html).not.toContain(en('weave.resume'));
    expect(html).toContain(en('weave.pickPosition', { pick: pickCount, total: pickCount }));
    expect(html).toMatch(new RegExp(`<input[^>]*max="${pickCount}"[^>]*value="${pickCount}"|<input[^>]*value="${pickCount}"[^>]*max="${pickCount}"`));
  });
});
