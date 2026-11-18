import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardProfile, Pattern } from '../../../src/codec/index.ts';
import { appReducer, initialAppState } from '../../../src/ui/state/appState.ts';
import type { AppState, PatternOrigin, SampleDesign, Screen } from '../../../src/ui/types.ts';
import { cardGridArbitrary, cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';

const SEED = 20240514;
const NUM_RUNS = 100;

const screenArbitrary: fc.Arbitrary<Screen> = fc.constantFrom('weave', 'keep', 'scan');
const designArbitrary: fc.Arbitrary<SampleDesign> = fc.constantFrom('diamond', 'border', 'floral');
const originArbitrary: fc.Arbitrary<PatternOrigin> = fc.oneof(
  fc.constant<PatternOrigin>({ kind: 'none' }),
  designArbitrary.map((design): PatternOrigin => ({ kind: 'sample', design })),
  fc.boolean().map((saved): PatternOrigin => ({ kind: 'scanned', saved })),
  fc.string().map((id): PatternOrigin => ({ kind: 'archive', id })),
);

function patternArbitrary(profile: CardProfile, minLength = 0): fc.Arbitrary<Pattern> {
  return fc.array(cardGridArbitrary(profile), { minLength, maxLength: 4 });
}

/** An app state and a pattern for the same profile, so grids have matching dimensions. */
const stateAndPattern: fc.Arbitrary<{ state: AppState; pattern: Pattern }> = cardProfileArbitrary.chain((profile) =>
  fc
    .record({
      screen: screenArbitrary,
      language: fc.constantFrom('hi' as const, 'en' as const),
      pattern: patternArbitrary(profile),
      origin: originArbitrary,
      batch: patternArbitrary(profile),
      sample: patternArbitrary(profile, 1),
      reduced: fc.boolean(),
    })
    .map(({ screen, language, pattern, origin, batch, sample, reduced }) => ({
      state: {
        ...initialAppState,
        screen,
        language,
        current: { pattern, origin },
        batch,
        prefersReducedMotion: reduced,
      },
      pattern: sample,
    })),
);

describe('appReducer examples', () => {
  it('R1.2 the app starts on the Weave screen in Hindi with an empty pattern', () => {
    expect(initialAppState.screen).toBe('weave');
    expect(initialAppState.language).toBe('hi');
    expect(initialAppState.current).toEqual({ pattern: [], origin: { kind: 'none' } });
    expect(initialAppState.batch).toEqual([]);
  });

  it('R4.7 a sample over unsaved scanned cards waits for confirmation, and accepting replaces the pattern', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(true));
    const sample = [grid.map((row) => row.map(() => false))];
    const scanned: AppState = { ...initialAppState, current: { pattern: [grid], origin: { kind: 'scanned', saved: false } } };

    const asked = appReducer(scanned, { type: 'request-sample', design: 'diamond', pattern: sample });
    expect(asked.current).toEqual(scanned.current);
    expect(asked.confirm).toEqual({ kind: 'replace-with-sample', design: 'diamond', pattern: sample });

    const accepted = appReducer(asked, { type: 'confirm-accepted' });
    expect(accepted.current).toEqual({ pattern: sample, origin: { kind: 'sample', design: 'diamond' } });
    expect(accepted.confirm).toBeNull();
  });

  it('R4.7 dismissing the confirmation keeps the scanned cards', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(true));
    const scanned: AppState = { ...initialAppState, current: { pattern: [grid], origin: { kind: 'scanned', saved: false } } };
    const asked = appReducer(scanned, { type: 'request-sample', design: 'border', pattern: [grid] });
    const dismissed = appReducer(asked, { type: 'confirm-dismissed' });
    expect(dismissed.current).toEqual(scanned.current);
    expect(dismissed.confirm).toBeNull();
  });

  it('R4.2 a sample replaces an empty pattern at once', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(false));
    const next = appReducer(initialAppState, { type: 'request-sample', design: 'floral', pattern: [grid] });
    expect(next.current).toEqual({ pattern: [grid], origin: { kind: 'sample', design: 'floral' } });
    expect(next.confirm).toBeNull();
  });

  it('R1.7 profile-loaded and set-language update only their field', () => {
    const profile = demoProfile();
    const loaded = appReducer(initialAppState, { type: 'profile-loaded', state: { status: 'ready', profile } });
    expect(loaded).toEqual({ ...initialAppState, profile: { status: 'ready', profile } });
    expect(appReducer(initialAppState, { type: 'set-language', language: 'en' })).toEqual({
      ...initialAppState,
      language: 'en',
    });
  });

  it('R14.10 each announcement gets a new id', () => {
    const first = appReducer(initialAppState, { type: 'announce', kind: 'error', messageKey: 'a' });
    const second = appReducer(first, { type: 'announce', kind: 'confirmation', messageKey: 'b' });
    expect(first.announcement).toEqual({ kind: 'error', messageKey: 'a', id: 1 });
    expect(second.announcement).toEqual({ kind: 'confirmation', messageKey: 'b', id: 2 });
  });
});

describe('appReducer properties', () => {
  it('R1.4 navigation keeps the current pattern and the scan batch and shows the chosen screen', () => {
    // Feature: app, Property 1: Navigation keeps the Current_Pattern
    fc.assert(
      fc.property(stateAndPattern, screenArbitrary, ({ state }, screen) => {
        const next = appReducer(state, { type: 'navigate', screen });
        expect(next.screen).toBe(screen);
        expect(next.current).toEqual(state.current);
        expect(next.batch).toEqual(state.batch);
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });

  it('R7.7 opening a saved design shows Weave with the archive origin and keeps the scan batch; mark-saved keeps the pattern and batch', () => {
    // Feature: app, Property 1: Navigation keeps the Current_Pattern
    fc.assert(
      fc.property(stateAndPattern, fc.string(), ({ state, pattern }, id) => {
        const opened = appReducer(state, { type: 'open-saved', id, pattern });
        expect(opened.screen).toBe('weave');
        expect(opened.current).toEqual({ pattern, origin: { kind: 'archive', id } });
        expect(opened.batch).toEqual(state.batch);
        const marked = appReducer(state, { type: 'mark-saved', id });
        expect(marked.batch).toEqual(state.batch);
        expect(marked.screen).toBe(state.screen);
        expect(marked.current.pattern).toEqual(state.current.pattern);
        if (state.current.origin.kind === 'scanned') {
          expect(marked.current.origin).toEqual({ kind: 'scanned', saved: true });
        } else {
          expect(marked).toEqual(state);
        }
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });
  it('R4.7 a sample over a scanned unsaved non-empty pattern asks first; otherwise it replaces at once', () => {
    // Feature: app, Property 12: Replacing a scanned unsaved pattern asks first
    fc.assert(
      fc.property(stateAndPattern, designArbitrary, ({ state, pattern }, design) => {
        const next = appReducer(state, { type: 'request-sample', design, pattern });
        const asks =
          state.current.origin.kind === 'scanned' &&
          !state.current.origin.saved &&
          state.current.pattern.length > 0;
        if (asks) {
          expect(next.confirm).not.toBeNull();
          expect(next.current).toEqual(state.current);
        } else {
          expect(next.confirm).toBeNull();
          expect(next.current).toEqual({ pattern, origin: { kind: 'sample', design } });
        }
        expect(next.batch).toEqual(state.batch);
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });
});
