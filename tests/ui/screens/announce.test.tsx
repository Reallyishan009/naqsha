import { renderToStaticMarkup } from 'react-dom/server';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Shell } from '../../../src/ui/App.tsx';
import { EN, HI, placeholders } from '../../../src/ui/i18n/messages.ts';
import { appReducer, initialAppState } from '../../../src/ui/state/appState.ts';
import { demoProfile } from '../../support/profiles.ts';
import type { AppState, Language } from '../../../src/ui/types.ts';

const LANGUAGES: Language[] = ['en', 'hi'];

/** Each key with the placeholder names found in its en or hi text. */
const KEYS_WITH_PLACEHOLDERS: ReadonlyArray<{ key: string; names: string[] }> = Object.keys(EN)
  .map((key) => ({
    key,
    names: [...new Set([...placeholders(EN[key] as string), ...placeholders(HI[key]?.text ?? '')])],
  }))
  .filter((entry) => entry.names.length > 0);

/** The text inside the one live region, after an announce action goes through the reducer. */
function liveRegionText(
  language: Language,
  messageKey: string,
  params?: Readonly<Record<string, string | number>>,
): string {
  const state: AppState = appReducer(
    // The card profile is ready: while it loads, the Landing shows a LoadingState, a transient `role="status"` before the live region.
    { ...initialAppState, language, profile: { status: 'ready', profile: demoProfile() } },
    { type: 'announce', kind: 'confirmation', messageKey, ...(params === undefined ? {} : { params }) },
  );
  const html = renderToStaticMarkup(<Shell state={state} dispatch={() => undefined} />);
  return /role="status"[^>]*>(.*?)<\/div>/s.exec(html)?.[1] ?? '';
}

describe('live region placeholders', () => {
  it('there are keys with placeholders to check', () => {
    expect(KEYS_WITH_PLACEHOLDERS.length).toBeGreaterThan(0);
  });

  it('R14.10 an announced message shows no unfilled {placeholder} in either language, for every key with placeholders', () => {
    const value = fc.oneof(fc.integer({ min: 1, max: 9999 }), fc.stringMatching(/^[A-Za-z0-9 ]{1,12}$/));
    fc.assert(
      fc.property(
        fc.constantFrom(...KEYS_WITH_PLACEHOLDERS),
        fc.constantFrom(...LANGUAGES),
        fc.array(value, { minLength: 8, maxLength: 8 }),
        ({ key, names }, language, values) => {
          const params = Object.fromEntries(names.map((name, index) => [name, values[index] as string | number]));
          const text = liveRegionText(language, key, params);
          expect(text, `${key} ${language}`).not.toMatch(/\{\w+\}/);
          expect(text.length).toBeGreaterThan(0);
        },
      ),
    );
  });

  it('R14.10 scan.accepted announces the card number in English and Hindi', () => {
    expect(liveRegionText('en', 'scan.accepted', { number: 3 })).toBe('Card 3 added.');
    expect(liveRegionText('hi', 'scan.accepted', { number: 3 })).toBe('कार्ड 3 जोड़ा गया।');
  });

  it('R14.10 scan.replaced announces the card number', () => {
    expect(liveRegionText('en', 'scan.replaced', { number: 2 })).toBe('Card 2 replaced.');
  });
});
