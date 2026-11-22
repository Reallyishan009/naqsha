import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardProfile, Pattern } from '../../../src/codec/index.ts';
import { sampleThenWeave } from '../../../src/ui/screens/home/HomeScreen.tsx';
import { appReducer, initialAppState } from '../../../src/ui/state/appState.ts';
import type { ReadFailure as CardReadFailure } from '../../../src/reader/index.ts';
import type { AppAction, AppState, Language, PatternOrigin, SampleDesign, Screen } from '../../../src/ui/types.ts';
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
  it('R1.2 the app starts on the home screen in Hindi with an empty pattern', () => {
    expect(initialAppState.screen).toBe('home');
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

  describe('the Selected_Pick, the breakpoints and the cloth choices', () => {
    const profile = demoProfile();
    const card = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(false));
    const threePicks: Pattern = [card, card, card];
    const onThreePicks: AppState = { ...initialAppState, current: { pattern: threePicks, origin: { kind: 'sample', design: 'border' } } };

    it('R4.2 the app starts at pick 0 with no breakpoints', () => {
      expect(initialAppState.selectedPick).toBe(0);
      expect(initialAppState.breakpoints).toEqual([]);
    });

    it('R4.2 select-pick sets the pick and clamps it to 0 .. the last pick index', () => {
      expect(appReducer(onThreePicks, { type: 'select-pick', pick: 2 }).selectedPick).toBe(2);
      expect(appReducer(onThreePicks, { type: 'select-pick', pick: 3 }).selectedPick).toBe(2);
      expect(appReducer(onThreePicks, { type: 'select-pick', pick: -4 }).selectedPick).toBe(0);
      expect(appReducer(onThreePicks, { type: 'select-pick', pick: Number.NaN }).selectedPick).toBe(0);
      // A design with no picks has only pick 0.
      expect(appReducer(initialAppState, { type: 'select-pick', pick: 5 }).selectedPick).toBe(0);
    });

    it('R3.1 R3.2 select-pick leaves the Current_Pattern and the breakpoints unchanged', () => {
      const marked = appReducer(onThreePicks, { type: 'toggle-breakpoint', pick: 1 });
      const moved = appReducer(marked, { type: 'select-pick', pick: 2 });
      expect(moved.current).toBe(marked.current);
      expect(moved.breakpoints).toEqual([1]);
    });

    it('R3.10 toggle-breakpoint adds and removes a pick index, keeping the list ascending without repeats', () => {
      let state = onThreePicks;
      for (const pick of [2, 0, 1, 2]) state = appReducer(state, { type: 'toggle-breakpoint', pick });
      expect(state.breakpoints).toEqual([0, 1]);
      expect(appReducer(state, { type: 'toggle-breakpoint', pick: 0 }).breakpoints).toEqual([1]);
      // An index with no card in the design cannot hold a breakpoint.
      expect(appReducer(state, { type: 'toggle-breakpoint', pick: 3 })).toBe(state);
      expect(appReducer(state, { type: 'toggle-breakpoint', pick: -1 })).toBe(state);
      expect(appReducer(state, { type: 'toggle-breakpoint', pick: 0.5 })).toBe(state);
    });

    it('R3.10 the breakpoints and the pick survive navigating away and back', () => {
      const marked = appReducer(appReducer(onThreePicks, { type: 'toggle-breakpoint', pick: 1 }), { type: 'select-pick', pick: 2 });
      const back = appReducer(appReducer(marked, { type: 'navigate', screen: 'code' }), { type: 'navigate', screen: 'weave' });
      expect(back.breakpoints).toEqual([1]);
      expect(back.selectedPick).toBe(2);
    });

    it('R3.10 R4.6 every action that replaces the Current_Pattern sets pick 0 and discards the breakpoints', () => {
      const marked: AppState = {
        ...onThreePicks,
        selectedPick: 2,
        breakpoints: [0, 2],
        batch: [card],
        screen: 'scan',
      };
      const replaced: AppState[] = [
        appReducer(marked, { type: 'request-sample', design: 'floral', pattern: [card] }),
        appReducer(appReducer({ ...marked, current: { pattern: threePicks, origin: { kind: 'scanned', saved: false } } }, { type: 'request-sample', design: 'floral', pattern: [card] }), { type: 'confirm-accepted' }),
        appReducer(marked, { type: 'open-saved', id: 'a', pattern: [card] }),
        appReducer(marked, { type: 'batch-commit', mode: 'replace' }),
        appReducer(marked, { type: 'batch-commit', mode: 'append' }),
      ];
      for (const next of replaced) {
        expect(next.selectedPick).toBe(0);
        expect(next.breakpoints).toEqual([]);
      }
      // A sample waiting for confirmation has not replaced anything yet.
      const waiting = appReducer({ ...marked, current: { pattern: threePicks, origin: { kind: 'scanned', saved: false } } }, { type: 'request-sample', design: 'floral', pattern: [card] });
      expect(waiting.selectedPick).toBe(2);
      expect(waiting.breakpoints).toEqual([0, 2]);
    });

    it('R4.1 set-cloth-choices replaces the choices and keeps the pick', () => {
      const choices = { ...initialAppState.clothChoices, repeat: 3, zari: { on: true, tone: 'gold' } } as const;
      const state = appReducer({ ...onThreePicks, selectedPick: 2 }, { type: 'set-cloth-choices', choices });
      expect(state.clothChoices).toEqual(choices);
      expect(state.selectedPick).toBe(2);
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

  it('R1.5 the Current_Pattern stays in the app state through any run of navigation, language, profile, announcement and read-failure actions', () => {
    const actionArbitrary: fc.Arbitrary<AppAction> = fc.oneof(
      screenArbitrary.map((screen): AppAction => ({ type: 'navigate', screen })),
      fc.constantFrom<Language>('hi', 'en').map((language): AppAction => ({ type: 'set-language', language })),
      fc.constant<AppAction>({ type: 'profile-loaded', state: { status: 'failed', failure: { reason: 'not-json' } } }),
      fc.constant<AppAction>({ type: 'announce', kind: 'confirmation', messageKey: 'weave.play' }),
      fc.constant<AppAction>({ type: 'confirm-dismissed' }),
      fc.constant<AppAction>({ type: 'read-failed', failure: { reason: 'peg-holes-not-found' } }),
    );
    fc.assert(
      fc.property(stateAndPattern, fc.array(actionArbitrary, { minLength: 1, maxLength: 12 }), ({ state }, actions) => {
        let next = state;
        for (const action of actions) next = appReducer(next, action);
        expect(next.current).toBe(state.current);
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
describe('version history actions', () => {
  const pattern: Pattern = [[[true, false]]];
  const archived: AppState = {
    ...initialAppState,
    screen: 'keep',
    current: { pattern: [[[false, true]]], origin: { kind: 'archive', id: 'v1' } },
    selectedPick: 3,
    breakpoints: [1, 2],
  };
  it('R4.2 restore-saved loads the version as the open design from the archive and stays on the same screen', () => {
    const restored = appReducer(archived, { type: 'restore-saved', id: 'v7', pattern });
    expect(restored.screen).toBe('keep');
    expect(restored.current).toEqual({ pattern, origin: { kind: 'archive', id: 'v7' } });
    expect(restored.selectedPick).toBe(0);
    expect(restored.breakpoints).toEqual([]);
  });
  it('R1.1 set-archive-origin moves the archive origin to the version just saved, and changes nothing else', () => {
    const moved = appReducer(archived, { type: 'set-archive-origin', id: 'v2' });
    expect(moved.current).toEqual({ pattern: archived.current.pattern, origin: { kind: 'archive', id: 'v2' } });
    expect({ ...moved, current: archived.current }).toEqual(archived);
  });
  it('R1.2 set-archive-origin leaves a design that did not come from the archive as it is', () => {
    const scanned: AppState = { ...archived, current: { pattern, origin: { kind: 'scanned', saved: false } } };
    expect(appReducer(scanned, { type: 'set-archive-origin', id: 'v2' })).toEqual(scanned);
  });
  it('R4.1 compare-versions asks for the Code view with both sides chosen', () => {
    const first = { kind: 'saved', id: 'v1' } as const;
    const second = { kind: 'current' } as const;
    const compared = appReducer(archived, { type: 'compare-versions', first, second });
    expect(compared.screen).toBe('code');
    expect(compared.compare).toEqual({ first, second });
    expect(compared.current).toEqual(archived.current);
  });
  it('R4.1 the request is cleared by navigating and by loading another pattern', () => {
    const compared = appReducer(archived, { type: 'compare-versions', first: { kind: 'current' }, second: { kind: 'current' } });
    expect(appReducer(compared, { type: 'navigate', screen: 'weave' }).compare).toBeNull();
    expect(appReducer(compared, { type: 'open-saved', id: 'x', pattern }).compare).toBeNull();
    expect(appReducer(compared, { type: 'restore-saved', id: 'x', pattern }).compare).toBeNull();
  });
});
describe('repair actions', () => {
  const card = (hook: number): Pattern[number] => [[hook === 0, hook === 1]];
  const lostSlot = [] as Pattern[number];
  const damaged: AppState = {
    ...initialAppState,
    current: { pattern: [card(0), lostSlot, card(1), lostSlot], origin: { kind: 'sample', design: 'diamond' } },
  };
  it('R4.1 accepting replaces only that card, marks the pick and keeps what was there for Undo', () => {
    const accepted = appReducer(damaged, { type: 'accept-repairs', items: [{ pick: 1, card: card(1) }] });
    expect(accepted.current.pattern).toEqual([card(0), card(1), card(1), lostSlot]);
    expect(accepted.current.origin).toEqual(damaged.current.origin);
    expect(accepted.repairs.picks).toEqual([1]);
    expect(damaged.current.pattern[1]).toBe(lostSlot); // the old state is not changed
  });
  it('R4.2 Undo reverses the last accept only, restores the old slot and removes the mark', () => {
    const one = appReducer(damaged, { type: 'accept-repairs', items: [{ pick: 1, card: card(1) }] });
    const two = appReducer(one, { type: 'accept-repairs', items: [{ pick: 3, card: card(0) }] });
    expect(two.repairs.picks).toEqual([1, 3]);
    const undone = appReducer(two, { type: 'undo-repair' });
    expect(undone.current.pattern).toEqual(one.current.pattern);
    expect(undone.repairs).toEqual(one.repairs);
    const back = appReducer(undone, { type: 'undo-repair' });
    expect(back.current.pattern).toEqual(damaged.current.pattern);
    expect(back.repairs).toEqual(initialAppState.repairs);
  });
  it('R4.2 Undo with nothing to undo changes nothing', () => {
    expect(appReducer(damaged, { type: 'undo-repair' })).toBe(damaged);
  });
  it('R4.2 R4.3 one accept of several cards is one Undo', () => {
    const both = appReducer(damaged, {
      type: 'accept-repairs',
      items: [{ pick: 3, card: card(0) }, { pick: 1, card: card(1) }],
    });
    expect(both.repairs.picks).toEqual([1, 3]);
    expect(both.repairs.history).toHaveLength(1);
    expect(appReducer(both, { type: 'undo-repair' }).current.pattern).toEqual(damaged.current.pattern);
  });
  it('R4.3 a pick outside the design is ignored, and nothing else is accepted by itself', () => {
    expect(appReducer(damaged, { type: 'accept-repairs', items: [{ pick: 9, card: card(1) }, { pick: -1, card: card(1) }] })).toBe(damaged);
    expect(appReducer(damaged, { type: 'accept-repairs', items: [] })).toBe(damaged);
    const other = appReducer(damaged, { type: 'select-pick', pick: 2 });
    expect(other.repairs).toEqual(damaged.repairs);
    expect(other.current.pattern).toEqual(damaged.current.pattern);
  });
  it('R5.3 opening, restoring, a sample or a scan commit clears the repairs', () => {
    const repaired = appReducer(damaged, { type: 'accept-repairs', items: [{ pick: 1, card: card(1) }] });
    const next: Pattern = [card(0)];
    expect(appReducer(repaired, { type: 'open-saved', id: 'a', pattern: next }).repairs).toEqual(initialAppState.repairs);
    expect(appReducer(repaired, { type: 'restore-saved', id: 'a', pattern: next }).repairs).toEqual(initialAppState.repairs);
    expect(appReducer(repaired, { type: 'request-sample', design: 'border', pattern: next }).repairs).toEqual(initialAppState.repairs);
  });
  it('R5.1 saving (the origin moving to the saved version) keeps the pattern and the marks of the session', () => {
    const repaired = appReducer(
      { ...damaged, current: { ...damaged.current, origin: { kind: 'archive', id: 'v1' } } },
      { type: 'accept-repairs', items: [{ pick: 1, card: card(1) }] },
    );
    const saved = appReducer(repaired, { type: 'set-archive-origin', id: 'v2' });
    expect(saved.current.pattern).toEqual(repaired.current.pattern);
    expect(saved.repairs).toEqual(repaired.repairs);
  });
  describe('go-home', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(true));
    const worked = (screen: Screen, origin: PatternOrigin): AppState => ({
      ...initialAppState,
      screen,
      language: 'en',
      profile: { status: 'ready', profile },
      current: { pattern: [grid, grid], origin },
      selectedPick: 1,
      breakpoints: [1],
      finishedPattern: [grid, grid],
      clothChoices: { ...initialAppState.clothChoices, repeat: 3 },
    });
    it('go-home from each screen shows home and keeps the design, pick, breakpoints, cloth choices, language and profile', () => {
      for (const screen of ['weave', 'keep', 'scan', 'code'] as const) {
        const start = worked(screen, { kind: 'sample', design: 'diamond' });
        const home = appReducer({ ...start, compare: { first: { kind: 'current' }, second: { kind: 'saved', id: 'a' } } }, { type: 'go-home' });
        expect(home.screen).toBe('home');
        expect(home.compare).toBeNull();
        expect({ ...home, screen: start.screen, compare: null }).toEqual({ ...start, compare: null });
      }
    });
    it('go-home is a no-op in effect on home', () => {
      const landing = { ...initialAppState, profile: { status: 'ready' as const, profile } };
      expect(appReducer(landing, { type: 'go-home' })).toEqual(landing);
    });
    it('go-home never asks, even over unsaved scanned cards, and keeps them', () => {
      for (const origin of [{ kind: 'scanned', saved: false }, { kind: 'scanned', saved: true }, { kind: 'archive', id: 'a' }] as const) {
        const start = worked('keep', origin);
        const home = appReducer(start, { type: 'go-home' });
        expect(home.confirm).toBeNull();
        expect(home.current).toEqual(start.current);
      }
    });
    it('a sample chosen on home moves to Weave first and then loads, so Weave arrives empty and the sample plays', () => {
      const seen: AppAction[] = [];
      const run = sampleThenWeave((action) => seen.push(action));
      const sample: AppAction = { type: 'request-sample', design: 'diamond', pattern: [grid] };
      run({ type: 'navigate', screen: 'keep' });
      run(sample);
      expect(seen).toEqual([{ type: 'navigate', screen: 'keep' }, { type: 'navigate', screen: 'weave' }, sample]);
      const loaded = seen.reduce(appReducer, { ...initialAppState, profile: { status: 'ready' as const, profile } });
      expect([loaded.screen, loaded.current.origin]).toEqual(['weave', { kind: 'sample', design: 'diamond' }]);
    });
    it('a sample chosen on home over unsaved scanned cards ends on Weave with the question and the cards kept', () => {
      const start = { ...worked('home', { kind: 'scanned', saved: false }), selectedPick: 0 };
      const seen: AppAction[] = [];
      sampleThenWeave((action) => seen.push(action))({ type: 'request-sample', design: 'floral', pattern: [grid] });
      const asked = seen.reduce(appReducer, start);
      expect(asked.screen).toBe('weave');
      expect(asked.confirm).toMatchObject({ kind: 'replace-with-sample' });
      expect(asked.current).toEqual(start.current);
    });
    it('go-home closes a question that was waiting', () => {
      const start = { ...worked('weave', { kind: 'scanned', saved: false }), confirm: { kind: 'replace-with-sample' as const, design: 'diamond' as const, pattern: [] } };
      expect(appReducer(start, { type: 'go-home' }).screen).toBe('home');
    });
  });
});
