import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardProfile, Pattern } from '../../../src/codec/index.ts';
import { appReducer, initialAppState } from '../../../src/ui/state/appState.ts';
import type { ReadFailure as CardReadFailure } from '../../../src/reader/index.ts';
import type { AppAction, AppState, PatternOrigin, SampleDesign, Screen } from '../../../src/ui/types.ts';
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

  it('R11.8 R11.10 accepting a card appends it; an unaccepted read does not alter the batch', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(true));
    const accepted = appReducer(initialAppState, { type: 'batch-accept', grid });
    expect(accepted.batch).toEqual([grid]);
    const failed = appReducer(accepted, { type: 'read-failed', failure: { reason: 'card-outside-image' } });
    expect(failed.batch).toEqual([grid]);
  });

  it('R11.8 Done with replace or append sets the pattern and clears the batch', () => {
    const profile = demoProfile();
    const on = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(true));
    const off = on.map((row) => row.map(() => false));
    const state: AppState = { ...initialAppState, screen: 'scan', current: { pattern: [off], origin: { kind: 'sample', design: 'border' } }, batch: [on] };
    expect(appReducer(state, { type: 'batch-commit', mode: 'replace' }).current.pattern).toEqual([on]);
    const appended = appReducer(state, { type: 'batch-commit', mode: 'append' });
    expect(appended.current.pattern).toEqual([off, on]);
    expect(appended.batch).toEqual([]);
    expect(appended.screen).toBe('weave');
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
  it('R1.4 R11.1 batch actions and read-failed keep the current pattern and screen', () => {
    // Feature: app, Property 1: Navigation keeps the Current_Pattern
    fc.assert(
      fc.property(stateAndPattern, fc.integer({ min: -1, max: 5 }), ({ state, pattern }, index) => {
        const card = pattern[0]!;
        const actions: AppAction[] = [
          { type: 'batch-accept', grid: card },
          { type: 'batch-remove', index },
          { type: 'batch-move', index, by: 1 },
          { type: 'batch-replace', index, grid: card },
          { type: 'read-failed', failure: { reason: 'peg-holes-not-found' } },
        ];
        for (const action of actions) {
          const next = appReducer(state, action);
          expect(next.current).toEqual(state.current);
          expect(next.screen).toBe(state.screen);
        }
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });

  it('R9.1 R11.10 a read-failed action leaves the batch unchanged and announces the failure', () => {
    // Feature: app, Property 23: A failed or unaccepted read leaves the Scan_Batch unchanged
    const failureArbitrary: fc.Arbitrary<CardReadFailure> = fc.oneof(
      fc.constant<CardReadFailure>({ reason: 'peg-holes-not-found' }),
      fc.constant<CardReadFailure>({ reason: 'card-outside-image' }),
      fc.string().map((detail): CardReadFailure => ({ reason: 'invalid-image', detail })),
      fc.double({ noNaN: true }).map((separation): CardReadFailure => ({ reason: 'ambiguous-orientation', separation })),
      fc
        .tuple(fc.double({ noNaN: true }), fc.double({ noNaN: true }))
        .map(([holeDiameterPx, minimumPx]): CardReadFailure => ({ reason: 'resolution-too-low', holeDiameterPx, minimumPx })),
      fc.constant<CardReadFailure>({ reason: 'invalid-profile', violations: [] }),
    );
    fc.assert(
      fc.property(stateAndPattern, failureArbitrary, ({ state }, failure) => {
        const next = appReducer(state, { type: 'read-failed', failure });
        expect(next.batch).toEqual(state.batch);
        expect(next.current).toEqual(state.current);
        expect(next.announcement?.kind).toBe('error');
        expect(next.announcement?.messageKey).not.toBe(failure.reason);
        expect(next.announcement?.id).toBe((state.announcement?.id ?? 0) + 1);
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });

  it('R11.6 R11.9 batch-commit sets the pattern from the batch, shows Weave, and does nothing for an empty batch', () => {
    // Feature: app, Property 27: Done keeps the order of the Scan_Batch
    fc.assert(
      fc.property(stateAndPattern, fc.constantFrom('replace' as const, 'append' as const), ({ state }, mode) => {
        const next = appReducer(state, { type: 'batch-commit', mode });
        if (state.batch.length === 0) {
          expect(next).toEqual(state);
          return;
        }
        expect(next.screen).toBe('weave');
        expect(next.current.origin).toEqual({ kind: 'scanned', saved: false });
        expect(next.current.pattern).toEqual(
          mode === 'replace' ? state.batch : [...state.current.pattern, ...state.batch],
        );
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
