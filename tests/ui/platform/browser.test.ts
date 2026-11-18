import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  LANGUAGE_STORAGE_KEY,
  autoplay,
  readStoredLanguage,
  storeLanguage,
} from '../../../src/ui/platform/browser.ts';
import type { KeyValueStorage } from '../../../src/ui/platform/browser.ts';
import { FakeStorage } from '../../support/fakes.ts';

const SEED = 3201;

class ThrowingStorage implements KeyValueStorage {
  getItem(): string | null {
    throw new Error('blocked');
  }
  setItem(): void {
    throw new Error('blocked');
  }
}

describe('platform decisions', () => {
  it('R14.8 and R14.9 autoplay is true exactly when reduced motion is off', () => {
    // Feature: app, Property 32: Autoplay follows the motion preference
    fc.assert(
      fc.property(fc.boolean(), fc.constantFrom('sample-selected', 'play-requested'), (reducedMotion, _trigger) => {
        // The decision does not depend on the trigger (sample selected, or play requested at load).
        expect(autoplay(reducedMotion)).toBe(!reducedMotion);
      }),
      { numRuns: 100, seed: SEED },
    );
  });

  it('R12.2 a stored language is read back, and the key is naqsha.language', () => {
    fc.assert(
      fc.property(fc.constantFrom('hi', 'en'), (language) => {
        const storage = new FakeStorage();
        expect(storeLanguage(storage, language)).toBe(true);
        expect(storage.getItem('naqsha.language')).toBe(language);
        expect(readStoredLanguage(storage)).toBe(language);
      }),
      { numRuns: 100, seed: SEED },
    );
    expect(LANGUAGE_STORAGE_KEY).toBe('naqsha.language');
  });

  it('R12.2 an unknown stored value, missing storage and blocked storage all give no language and never throw', () => {
    fc.assert(
      fc.property(
        fc.string().filter((text) => text !== 'hi' && text !== 'en'),
        (text) => {
          const storage = new FakeStorage();
          storage.setItem(LANGUAGE_STORAGE_KEY, text);
          expect(readStoredLanguage(storage)).toBeNull();
        },
      ),
      { numRuns: 100, seed: SEED },
    );
    expect(readStoredLanguage(null)).toBeNull();
    expect(readStoredLanguage(new ThrowingStorage())).toBeNull();
    expect(storeLanguage(null, 'hi')).toBe(false);
    expect(storeLanguage(new ThrowingStorage(), 'hi')).toBe(false);
  });
});
