import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../../support/png.ts';
import { validateCardGrid } from '../../../src/codec/index.ts';
import type { CardGrid } from '../../../src/codec/index.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { ScanView } from '../../../src/ui/screens/scan/ScanScreen.tsx';
import type { ScanViewProps } from '../../../src/ui/screens/scan/ScanScreen.tsx';
import {
  initialScanState,
  initialZoom,
  hookSpacingCssPx,
  MAX_ZOOM,
  nextMarkerIndex,
  readPhoto,
  RequestCounter,
  scanReducer,
} from '../../../src/ui/state/scan.ts';
import type { ReadFailure } from '../../../src/reader/index.ts';
import type { ReadOutcome } from '../../../src/ui/state/scan.ts';
import { cardGridArbitrary, demoProfile } from '../../support/profiles.ts';
import type { Language, ScanState } from '../../../src/ui/types.ts';

const SEED = 20240614;
const NUM_RUNS = 100;
const LANGUAGES: Language[] = ['hi', 'en'];
const noop = (): void => undefined;

async function readFixtureOutcome(): Promise<Extract<ReadOutcome, { kind: 'read' }>> {
  const pixels = decodePng(new Uint8Array(readFileSync('tests/fixtures/pick0-clean.png')));
  const outcome = await readPhoto(demoProfile(), new Blob([new Uint8Array([0])]), () => Promise.resolve(pixels));
  if (outcome.kind !== 'read') throw new Error('fixture did not read');
  return outcome;
}

function view(language: Language, overrides: Partial<ScanViewProps> = {}): string {
  const props: ScanViewProps = {
    profile: demoProfile(),
    scan: initialScanState,
    batch: [],
    pendingRemove: null,
    replacingIndex: null,
    confirmingDone: false,
    viewWidthPx: 360,
    t: translator(DICTIONARIES, language),
    onFile: noop,
    onToggle: noop,
    onUndo: noop,
    onZoom: noop,
    onAccept: noop,
    onDiscard: noop,
    onRemoveRequest: noop,
    onRemoveConfirm: noop,
    onRemoveCancel: noop,
    onMove: noop,
    onScanAgain: noop,
    onCancelReplacing: noop,
    onDone: noop,
    onCommit: noop,
    onDoneCancel: noop,
    ...overrides,
  };
  return renderToStaticMarkup(<ScanView {...props} />);
}

async function readState(): Promise<ScanState> {
  const outcome = await readFixtureOutcome();
  return scanReducer(initialScanState, { type: 'finish', outcome, zoom: 2, replacing: null });
}

describe('scan screen render', () => {
  it('R8.3 R10.1 R10.4 R10.8 each hook position is a button with an accessible name, and the legend explains the marks', async () => {
    const scan = await readState();
    const profile = demoProfile();
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = view(language, { scan });
      const names = [...html.matchAll(/<button[^>]*class="[^"]*marker[^"]*"[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);
      expect(names).toHaveLength(profile.hookRows * profile.hookColumns);
      expect(new Set(names).size).toBe(names.length);
      expect(html).toContain(t('scan.legend.punched'));
      expect(html).toContain(t('scan.legend.unpunched'));
      expect(html).toContain(t('scan.legend.corrected'));
      // Only one marker is in the tab order.
      expect((html.match(/class="[^"]*marker[^"]*"[^>]*tabindex="0"/g) ?? []).length + (html.match(/tabindex="0"[^>]*class="[^"]*marker/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });

  it('R10.4 R10.5 a changed hook shows the corrected badge and Undo becomes available', async () => {
    const scan = scanReducer(await readState(), { type: 'toggle', position: { hookRow: 0, hookColumn: 0 } });
    const html = view('en', { scan });
    expect(html).toContain('changed by you');
    expect(html).toMatch(/<button[^>]*class="[^"]*button[^"]*"[^>]*>Undo last change/);
    expect(html).not.toMatch(/disabled=""[^>]*>Undo last change/);
    const fresh = view('en', { scan: await readState() });
    expect(fresh).toMatch(/disabled=""[^>]*>Undo last change/);
  });

  it('R11.7 Done is disabled for an empty batch and enabled with a card', () => {
    const card: CardGrid = [[true, false]];
    expect(view('en')).toMatch(/disabled=""[^>]*>Done</);
    expect(view('en', { batch: [card] })).not.toMatch(/disabled=""[^>]*>Done</);
  });

  it('R22.1 R22.3 the Card_Profile name and the Unverified_Profile notice are shown in both languages', () => {
    const profile = demoProfile();
    expect(profile.status).toContain('UNVERIFIED');
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = view(language);
      expect(html).toContain(profile.name);
      expect(html).toContain(t('notice.unverifiedProfile'));
    }
  });

  it('R11.2 R11.3 R11.4 R11.5 the batch list has numbered cards with remove, earlier, later and scan again, and asks before removing', () => {
    const card: CardGrid = [[true, false], [false, true]];
    const html = view('en', { batch: [card, card], pendingRemove: 1 });
    for (const number of [1, 2]) {
      expect(html).toContain(`Card ${number}`);
      expect(html).toContain(`Remove card ${number}`);
      expect(html).toContain(`Move card ${number} earlier`);
      expect(html).toContain(`Move card ${number} later`);
      expect(html).toContain(`Scan card ${number} again`);
    }
    expect(html).toContain('Remove card 2? This cannot be undone.');
    expect(html).not.toContain('Remove card 1? This cannot be undone.');
    // The first card cannot move earlier and the last cannot move later.
    expect(html).toMatch(/disabled=""[^>]*>Move card 1 earlier/);
    expect(html).toMatch(/disabled=""[^>]*>Move card 2 later/);
  });

  it('R11.8 Done with a current pattern asks replace or append', () => {
    const html = view('en', { batch: [[[true]]], confirmingDone: true });
    expect(html).toContain('Replace the design');
    expect(html).toContain('Add after the design');
  });

  it('R9.7 an invalid-profile failure lists the violation locations; other failures show one plain message', () => {
    const scan: ScanState = {
      status: 'failed',
      failure: {
        reason: 'invalid-profile',
        violations: [{ kind: 'missing-field', location: 'holeDiameterMm', message: 'is missing' }],
      },
    };
    expect(view('en', { scan })).toContain('holeDiameterMm');
    const peg = view('en', { scan: { status: 'failed', failure: { reason: 'peg-holes-not-found' } } });
    expect(peg).toContain('two large alignment holes');
    expect(peg).not.toContain('holeDiameterMm');
  });

  it('R8.6 a file the browser cannot decode shows the invalid-image message in both languages', async () => {
    const outcome = await readPhoto(demoProfile(), new Blob([new Uint8Array([0])]), () => Promise.reject(new Error('not an image')));
    expect(outcome.kind).toBe('failed');
    if (outcome.kind !== 'failed') return;
    expect(outcome.failure.reason).toBe('invalid-image');
    const scan = scanReducer(initialScanState, { type: 'finish', outcome, zoom: 1, replacing: null });
    expect(scan).toMatchObject({ status: 'failed', failure: { reason: 'invalid-image' } });
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = view(language, { scan });
      expect(html).toContain(t('error.read.invalid-image'));
      expect(t('error.read.invalid-image')).not.toBe('error.read.invalid-image');
    }
    expect(view('en', { scan })).toContain('could not be used as an image');
  });

  it('R9.9 every read failure shows a sentence and never only its raw kind string', () => {
    const failures: ReadFailure[] = [
      { reason: 'peg-holes-not-found' },
      { reason: 'ambiguous-orientation', separation: 0.1 },
      { reason: 'resolution-too-low', holeDiameterPx: 5, minimumPx: 11 },
      { reason: 'card-outside-image' },
      { reason: 'invalid-image', detail: 'x' },
      { reason: 'invalid-profile', violations: [] },
    ];
    for (const failure of failures) {
      for (const language of LANGUAGES) {
        const t = translator(DICTIONARIES, language);
        const message = t(`error.read.${failure.reason}`);
        expect(message, `${language} ${failure.reason}`).not.toBe(failure.reason);
        expect(message.trim().split(/\s+/).length, `${language} ${failure.reason}`).toBeGreaterThanOrEqual(5);
        const html = view(language, { scan: { status: 'failed', failure } });
        expect(html).toContain(message);
        // The kind string may not be the visible text of any element.
        expect(html).not.toContain(`>${failure.reason}<`);
      }
    }
  });

  it('R8.7 with no card profile the screen says so and offers no file input', () => {
    const html = view('en', { profile: null });
    expect(html).toContain('not loaded');
    expect(html).not.toContain('type="file"');
  });

  it('R13.1 R16.10 the scan sources make no network request and App loads the screen lazily', () => {
    for (const file of ['ScanScreen.tsx', 'CardOverlay.tsx', 'BatchList.tsx']) {
      const source = readFileSync(`src/ui/screens/scan/${file}`, 'utf8');
      expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource/);
    }
    expect(readFileSync('src/ui/state/scan.ts', 'utf8')).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon/);
    const app = readFileSync('src/ui/App.tsx', 'utf8');
    // The Scan screen is still a dynamic import, now handed to `useLazyScreen` so a retry can ask for the chunk again.
    expect(app).toMatch(/importScanScreen = \(\) => import\('\.\/screens\/scan\/ScanScreen\.tsx'\)/);
    expect(app).toMatch(/useLazyScreen\(importScanScreen, /);
    expect(app).not.toMatch(/^import .*screens\/scan/m);
  });
});

describe('scan state', () => {
  it('R10.6 R10.7 toggling a hook twice restores the read grid, and undoing every change returns it', async () => {
    // Feature: app, Property 24: Toggling a hook twice restores the grid
    const outcome = await readFixtureOutcome();
    const profile = demoProfile();
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            hookRow: fc.integer({ min: 0, max: profile.hookRows - 1 }),
            hookColumn: fc.integer({ min: 0, max: profile.hookColumns - 1 }),
          }),
          { maxLength: 30 },
        ),
        async (positions) => {
          let state = scanReducer(initialScanState, { type: 'finish', outcome, zoom: 1, replacing: null });
          for (const position of positions) state = scanReducer(state, { type: 'toggle', position });
          if (state.status !== 'read') throw new Error('expected read');
          expect(validateCardGrid(profile, state.grid)).toEqual([]);
          for (let i = 0; i < positions.length; i++) state = scanReducer(state, { type: 'undo' });
          if (state.status !== 'read') throw new Error('expected read');
          expect(state.grid).toEqual(state.readGrid);
          expect(state.corrected).toEqual([]);
        },
      ),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });

  it('R8.5 a late result never replaces a newer one: only the latest request is current', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (count) => {
        const counter = new RequestCounter();
        const requests = Array.from({ length: count }, () => counter.begin());
        const current = requests.filter((request) => counter.isLatest(request));
        expect(current).toEqual([requests[count - 1]]);
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });

  it('R10.8 arrow keys keep the focused marker inside the grid, and other keys are ignored', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom('ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'),
        fc.nat(),
        (hookRows, hookColumns, key, seed) => {
          const index = seed % (hookRows * hookColumns);
          const next = nextMarkerIndex(key, index, hookRows, hookColumns);
          expect(next).not.toBeNull();
          expect(next!).toBeGreaterThanOrEqual(0);
          expect(next!).toBeLessThan(hookRows * hookColumns);
        },
      ),
      { numRuns: NUM_RUNS, seed: SEED },
    );
    expect(nextMarkerIndex('a', 0, 2, 2)).toBeNull();
    expect(nextMarkerIndex('ArrowRight', 1, 2, 2)).toBe(1);
  });

  it('R10.3 the starting zoom is within range and reaches a 48 pixel hit area when the range allows', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.5, max: 200, noNaN: true }), (spacing) => {
        const zoom = initialZoom(spacing);
        expect(zoom).toBeGreaterThanOrEqual(1);
        expect(zoom).toBeLessThanOrEqual(MAX_ZOOM);
        if (spacing * MAX_ZOOM >= 48) expect(spacing * zoom).toBeGreaterThanOrEqual(48);
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
    expect(hookSpacingCssPx(demoProfile(), { tiltDegrees: 0, pixelsPerMm: 6, originPx: { x: 0, y: 0 }, orientation: 'upright' }, 600, 300)).toBeGreaterThan(0);
  });

  it('R10.6 toggling keeps the grid size and changes one punched hole', () => {
    const profile = demoProfile();
    fc.assert(
      fc.property(cardGridArbitrary(profile), (grid) => {
        const state = scanReducer(
          scanReducer(initialScanState, {
            type: 'finish',
            outcome: {
              kind: 'read',
              grid,
              image: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
              pose: { tiltDegrees: 0, pixelsPerMm: 1, originPx: { x: 0, y: 0 }, orientation: 'upright' },
            },
            zoom: 1,
            replacing: null,
          }),
          { type: 'toggle', position: { hookRow: 0, hookColumn: 0 } },
        );
        if (state.status !== 'read') throw new Error('expected read');
        expect(state.grid).toHaveLength(grid.length);
        expect(state.grid[0]![0]).toBe(!grid[0]![0]);
        expect(state.readGrid).toBe(grid);
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });
});
