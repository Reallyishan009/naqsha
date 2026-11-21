import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { DesignSummary, Metadata } from '../../../src/archive/index.ts';
import type { CardGrid, Pattern } from '../../../src/codec/index.ts';
import { DICTIONARIES, archiveFailureKey, translator } from '../../../src/ui/i18n/messages.ts';
import { CodeViewScreen } from '../../../src/ui/screens/code/CodeViewScreen.tsx';
import { DiffPanelView } from '../../../src/ui/screens/code/DiffPanel.tsx';
import type { DiffPanelViewProps } from '../../../src/ui/screens/code/DiffPanel.tsx';
import { KeepView } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import type { KeepViewProps } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import { ScanView } from '../../../src/ui/screens/scan/ScanScreen.tsx';
import type { ScanViewProps } from '../../../src/ui/screens/scan/ScanScreen.tsx';
import { WeaveScreen } from '../../../src/ui/screens/weave/WeaveScreen.tsx';
import { generateSample, sampleWithLostCards } from '../../../src/ui/samples/sampleDesigns.ts';
import { initialAppState } from '../../../src/ui/state/appState.ts';
import { EMPTY_METADATA, initialKeepForm } from '../../../src/ui/state/keep.ts';
import { initialScanState, readPhoto, scanReducer } from '../../../src/ui/state/scan.ts';
import type { AppState, Language, ScanState } from '../../../src/ui/types.ts';
import { decodePng } from '../../support/png.ts';
import { demoProfile } from '../../support/profiles.ts';

const LANGUAGES: Language[] = ['en', 'hi'];
const noop = (): void => undefined;

/**
 * How many primary Buttons the markup shows: each `<button>` or link whose class list holds a `primary` class from the
 * shared Button module, and each file chooser that a Field gives the primary look (`data-emphasis="primary"`).
 */
function primaryButtons(html: string): number {
  let count = 0;
  for (const tag of html.matchAll(/<(button|a)\b[^>]*>/g)) {
    const classes = /class="([^"]*)"/.exec(tag[0])?.[1] ?? '';
    if (classes.split(/\s+/).some((name) => /(?:^|_)primary(?:_|$)/.test(name))) count += 1;
  }
  return count + (html.match(/data-emphasis="primary"/g)?.length ?? 0);
}

/** Every state of one Screen, as a name and the markup, in the language. */
type StateMarkup = { state: string; html: string };

function ready(language: Language, extra: Partial<AppState> = {}): AppState {
  return { ...initialAppState, language, profile: { status: 'ready', profile: demoProfile() }, ...extra };
}
function withPattern(language: Language, pattern: Pattern): AppState {
  return ready(language, { current: { pattern, origin: { kind: 'sample', design: 'diamond' } } });
}
function weaveStates(language: Language): StateMarkup[] {
  const t = translator(DICTIONARIES, language);
  const render = (state: AppState): string =>
    renderToStaticMarkup(<WeaveScreen state={state} dispatch={noop} t={t} />);
  const profile = demoProfile();
  return [
    { state: 'empty', html: render(ready(language)) },
    { state: 'loading', html: render({ ...initialAppState, language, profile: { status: 'loading' } }) },
    {
      state: 'error',
      html: render({ ...initialAppState, language, profile: { status: 'failed', failure: { reason: 'not-json' } } }),
    },
    { state: 'with content', html: render(withPattern(language, generateSample(profile, 'diamond'))) },
    { state: 'with content, lost cards', html: render(withPattern(language, sampleWithLostCards(profile))) },
  ];
}

function summary(id: string, metadata: Partial<Metadata>): DesignSummary {
  return {
    id,
    profileName: demoProfile().name,
    metadata: { ...EMPTY_METADATA, ...metadata },
    createdAt: 1,
    pickCount: 7,
  };
}
function keepStates(language: Language): StateMarkup[] {
  const profile = demoProfile();
  const render = (overrides: Partial<KeepViewProps>): string => {
    const props: KeepViewProps = {
      profile,
      pattern: generateSample(profile, 'diamond'),
      form: initialKeepForm,
      designs: [],
      pendingDeleteId: null,
      savedText: null,
      exportDone: false,
      failureKey: null,
      t: translator(DICTIONARIES, language),
      onFormAction: noop,
      onExport: noop,
      onSave: noop,
      onOpen: noop,
      onDeleteRequest: noop,
      onDeleteConfirm: noop,
      onDeleteCancel: noop,
      language,
      ...overrides,
    };
    return renderToStaticMarkup(<KeepView {...props} />);
  };
  const designs = [summary('one', { name: 'Kota' }), summary('two', { name: 'Paithani' })];
  return [
    { state: 'empty', html: render({ pattern: [] }) },
    { state: 'loading', html: render({ profile: null, designs: null }) },
    { state: 'error', html: render({ designs: null, failureKey: archiveFailureKey({ reason: 'storage-unavailable', detail: 'x' }) }) },
    { state: 'with content', html: render({ designs }) },
    { state: 'with content, saved and exported', html: render({ designs, savedText: 'Saved', exportDone: true }) },
    { state: 'with content, delete asked', html: render({ designs, pendingDeleteId: 'one' }) },
  ];
}

async function readState(): Promise<ScanState> {
  const pixels = decodePng(new Uint8Array(readFileSync('tests/fixtures/pick0-clean.png')));
  const outcome = await readPhoto(demoProfile(), new Blob([new Uint8Array([0])]), () => Promise.resolve(pixels));
  if (outcome.kind !== 'read') throw new Error('the fixture did not read');
  return scanReducer(initialScanState, { type: 'finish', outcome, zoom: 2, replacing: null });
}
function scanStates(language: Language, read: ScanState): StateMarkup[] {
  const profile = demoProfile();
  const card: CardGrid = generateSample(profile, 'diamond')[0]!;
  const render = (overrides: Partial<ScanViewProps>): string => {
    const props: ScanViewProps = {
      profile,
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
  };
  return [
    { state: 'empty', html: render({}) },
    { state: 'empty, no card profile', html: render({ profile: null }) },
    { state: 'loading', html: render({ scan: { status: 'reading', fileName: 'card.png' } }) },
    { state: 'error', html: render({ scan: { status: 'failed', failure: { reason: 'peg-holes-not-found' } } }) },
    { state: 'with content, a card read', html: render({ scan: read }) },
    { state: 'with content, a card read and a batch', html: render({ scan: read, batch: [card, card] }) },
    { state: 'with content, a batch', html: render({ batch: [card, card] }) },
    { state: 'with content, remove asked', html: render({ batch: [card, card], pendingRemove: 1 }) },
    { state: 'with content, done asked', html: render({ batch: [card, card], confirmingDone: true }) },
  ];
}

function codeStates(language: Language): StateMarkup[] {
  const t = translator(DICTIONARIES, language);
  const render = (state: AppState): string =>
    renderToStaticMarkup(<CodeViewScreen state={{ ...state, screen: 'code' }} dispatch={noop} t={t} />);
  const diff = (overrides: Partial<DiffPanelViewProps>): string =>
    renderToStaticMarkup(
      <DiffPanelView
        summaries={{ status: 'ready', list: [] }}
        first={null}
        second={null}
        comparison={{ status: 'idle' }}
        currentAvailable
        t={t}
        onFirstChange={noop}
        onSecondChange={noop}
        onCompare={noop}
        {...overrides}
      />,
    );
  const profile = demoProfile();
  const list = [summary('one', { name: 'Kota' }), summary('two', { name: 'Paithani' })];
  return [
    { state: 'empty', html: render(ready(language)) },
    { state: 'loading', html: render({ ...initialAppState, language, profile: { status: 'loading' } }) },
    {
      state: 'error',
      html: render({ ...initialAppState, language, profile: { status: 'failed', failure: { reason: 'not-json' } } }),
    },
    { state: 'with content', html: render(withPattern(language, generateSample(profile, 'diamond'))) },
    { state: 'with content, lost cards', html: render(withPattern(language, sampleWithLostCards(profile))) },
    { state: 'compare panel, list loading', html: diff({ summaries: { status: 'loading' } }) },
    {
      state: 'compare panel, list failed',
      html: diff({ summaries: { status: 'failed', failure: { reason: 'storage-unavailable', detail: 'x' } } }),
    },
    { state: 'compare panel, nothing saved', html: diff({}) },
    {
      state: 'compare panel, two designs chosen',
      html: diff({
        summaries: { status: 'ready', list },
        first: { kind: 'saved', id: 'one' },
        second: { kind: 'saved', id: 'two' },
      }),
    },
  ];
}

describe('the one primary Button of each Screen', () => {
  it('R6.5 the counter counts the primary Button of the shared module, a primary link and a primary file chooser', () => {
    expect(primaryButtons('<button type="button" class="_button_1 _primary_2">x</button>')).toBe(1);
    expect(primaryButtons('<button class="_button_1 _secondary_2">x</button><button class="_button_1 _quiet_2">y</button>')).toBe(0);
    expect(
      primaryButtons(
        '<button class="_button_1 _primary_2">x</button><a class="_button_1 _primary_2" href="#">y</a><label data-emphasis="primary"><input type="file"/></label>',
      ),
    ).toBe(3);
  });

  it('R6.5 no Screen shows more than one primary Button in its empty, loading, error and with-content states', async () => {
    const read = await readState();
    const byScreen: Record<string, (language: Language) => StateMarkup[]> = {
      Weave: weaveStates,
      Keep: keepStates,
      Scan: (language) => scanStates(language, read),
      'Code view': codeStates,
    };
    for (const [screen, states] of Object.entries(byScreen)) {
      for (const language of LANGUAGES) {
        const shown = states(language);
        // Each Screen is checked in an empty, a loading, an error and a with-content state.
        for (const kind of ['empty', 'loading', 'error', 'with content']) {
          expect(
            shown.some((entry) => entry.state === kind || entry.state.startsWith(`${kind},`)),
            `${screen} ${language} has a ${kind} state`,
          ).toBe(true);
        }
        for (const { state, html } of shown) {
          expect(primaryButtons(html), `${screen} (${language}), ${state}`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('R6.5 R6.6 where a Screen has its main control it shows exactly one primary Button: Play, export, choose a photo or Accept, Compare', async () => {
    const read = await readState();
    const only = (states: StateMarkup[], name: string): number => primaryButtons(states.find((entry) => entry.state === name)!.html);
    expect(only(weaveStates('en'), 'with content')).toBe(1);
    expect(only(keepStates('en'), 'with content')).toBe(1);
    expect(only(scanStates('en', read), 'empty')).toBe(1);
    expect(only(scanStates('en', read), 'with content, a card read')).toBe(1);
    expect(only(codeStates('en'), 'compare panel, two designs chosen')).toBe(1);
  });
});
