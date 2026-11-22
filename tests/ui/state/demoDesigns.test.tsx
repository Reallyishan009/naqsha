import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { ArchiveDeps } from '../../../src/archive/index.ts';
import { getDesign, groupDesigns, listDesigns } from '../../../src/archive/index.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { KeepView } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import type { KeepViewProps } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import { DemoCard as CodeDemoCard } from '../../../src/ui/screens/code/DemoCard.tsx';
import { compareDesigns } from '../../../src/ui/screens/code/DiffPanel.tsx';
import { patternToLines } from '../../../src/codec-view/index.ts';
import { appReducer, initialAppState } from '../../../src/ui/state/appState.ts';
import {
  DEMO_BREAKPOINT_PICK,
  DEMO_LOOM_FILES,
  DEMO_METADATA,
  demoBreakpointActions,
  editDemoPattern,
  ensureDemoPair,
  loadDiamondActions,
  saveDemoDesign,
  saveDemoEdit,
} from '../../../src/ui/state/demoDesigns.ts';
import { initialKeepForm, runExport } from '../../../src/ui/state/keep.ts';
import type { AppAction, AppState, Language } from '../../../src/ui/types.ts';
import { FakeArchiveStore } from '../../support/fakes.ts';
import { demoProfile } from '../../support/profiles.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const profile = demoProfile();

function fakeDeps(): { deps: ArchiveDeps; store: FakeArchiveStore } {
  const store = new FakeArchiveStore();
  let counter = 0;
  let clock = 1000;
  return { store, deps: { store, now: () => clock++, newId: () => `id-${counter++}` } };
}

function changedHoles(a: boolean[][][], b: boolean[][][]): number {
  let count = 0;
  a.forEach((card, pick) =>
    card.forEach((row, hookRow) =>
      row.forEach((value, hookColumn) => {
        if (b[pick]?.[hookRow]?.[hookColumn] !== value) count += 1;
      }),
    ),
  );
  return count;
}

describe('the demo edit of the Keep Demo card', () => {
  const diamond = generateSample(profile, 'diamond');

  it('changes a few holes, keeps every card the same size and leaves the pattern it was given alone', () => {
    const before = structuredClone(diamond);
    const edited = editDemoPattern(diamond, 1);
    expect(diamond).toEqual(before);
    expect(edited).toHaveLength(diamond.length);
    const changed = changedHoles(diamond, edited);
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThanOrEqual(8);
    for (const card of edited) {
      expect(card).toHaveLength(profile.hookRows);
      for (const row of card) expect(row).toHaveLength(profile.hookColumns);
    }
  });

  it('gives a different pattern for each version number', () => {
    expect(editDemoPattern(diamond, 1)).not.toEqual(editDemoPattern(diamond, 2));
  });

  it('leaves a pick that is not a card alone and handles an empty pattern', () => {
    expect(editDemoPattern([], 1)).toEqual([]);
    const gapped = diamond.map((card, pick) => (pick === 2 ? ([] as boolean[][]) : card));
    expect(editDemoPattern(gapped, 1)[2]).toEqual([]);
  });
});

describe('saving the demo design and its edits over the fake archive store', () => {
  it('saves the Diamond sample with the demo name, weaver and place', async () => {
    const { deps } = fakeDeps();
    const saved = await saveDemoDesign(profile, deps);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    const stored = await getDesign(saved.value.id, deps);
    if (!stored.ok) throw new Error('not stored');
    expect(stored.value.metadata).toEqual(DEMO_METADATA);
    expect(DEMO_METADATA.weaver).not.toBe('');
    expect(DEMO_METADATA.place).not.toBe('');
    expect(stored.value.pattern).toEqual(generateSample(profile, 'diamond'));
    expect(stored.value.designId).toBeUndefined();
  });

  it('a demo edit saves a new version that continues the demo design, and a second edit continues the first', async () => {
    const { deps, store } = fakeDeps();
    const note = (count: number): string => `edit ${count}`;
    const first = await saveDemoEdit(profile, note, deps);
    const second = await saveDemoEdit(profile, note, deps);
    if (!first.ok || !second.ok) throw new Error('save failed');
    // No demo design existed, so the first press saved it and then its first edit: two versions, then three.
    expect(store.snapshot().records).toHaveLength(3);
    const listed = await listDesigns(deps);
    if (!listed.ok) throw new Error('list failed');
    const groups = groupDesigns(listed.value);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.versionCount).toBe(3);
    expect(groups[0]?.newest.id).toBe(second.value.id);
    expect(second.value.continues).toBe(first.value.id);
    const newest = await getDesign(second.value.id, deps);
    const middle = await getDesign(first.value.id, deps);
    if (!newest.ok || !middle.ok) throw new Error('read failed');
    expect(newest.value.note).toBe('edit 2');
    expect(newest.value.metadata).toEqual(DEMO_METADATA);
    expect(newest.value.pattern).not.toEqual(middle.value.pattern);
    expect(changedHoles(middle.value.pattern, newest.value.pattern)).toBeGreaterThan(0);
  });

  it('a demo edit after a saved demo design adds one version to that design and no new design', async () => {
    const { deps } = fakeDeps();
    await saveDemoDesign(profile, deps);
    const edit = await saveDemoEdit(profile, (count) => `edit ${count}`, deps);
    expect(edit).toMatchObject({ ok: true, value: { versionCount: 2 } });
    const listed = await listDesigns(deps);
    if (!listed.ok) throw new Error('list failed');
    expect(groupDesigns(listed.value).map((group) => group.versionCount)).toEqual([2]);
  });

  it('a failing store gives a failure value and stores nothing', async () => {
    const { deps, store } = fakeDeps();
    store.failOn('put');
    expect(await saveDemoDesign(profile, deps)).toMatchObject({ ok: false, failure: { reason: 'write-failed' } });
    expect(await saveDemoEdit(profile, () => 'x', deps)).toMatchObject({ ok: false });
    expect(store.snapshot().records).toHaveLength(0);
  });
});

function view(language: Language, overrides: Partial<KeepViewProps> = {}): string {
  const noop = (): void => undefined;
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
    ...overrides,
  };
  return renderToStaticMarkup(<KeepView {...props} />);
}

describe('the Keep Demo card', () => {
  const noop = (): void => undefined;
  it('shows two buttons, a Demo chip and a link to each loom file, in both languages', () => {
    for (const language of ['en', 'hi'] as const) {
      const t = translator(DICTIONARIES, language);
      const html = view(language, { onDemoSave: noop, onDemoEdit: noop, demoBase: '/app/' });
      expect(html).toContain(`>${t('keep.demo.save')}</button>`);
      expect(html).toContain(`>${t('keep.demo.edit')}</button>`);
      expect(html).toContain(`>${t('demo.chip')}<`);
      for (const file of DEMO_LOOM_FILES) {
        expect(html).toContain(`href="/app/${file.path}"`);
        expect(html).toContain(`download="${file.fileName}"`);
      }
    }
  });
  it('is not drawn when the screen gives it no actions, and its buttons wait without a Card_Profile', () => {
    expect(view('en')).not.toContain('data-demo="save"');
    const html = view('en', { profile: null, onDemoSave: noop, onDemoEdit: noop });
    expect(html).toMatch(/<button[^>]*disabled[^>]*data-demo="save"/);
  });
  it('the normal export button is still there beside it', () => {
    const t = translator(DICTIONARIES, 'en');
    expect(view('en', { onDemoSave: noop, onDemoEdit: noop })).toContain(`>${t('keep.export.button')}</button>`);
  });
  it('gives the demo buttons and links the 48 px target of every Button', () => {
    const css = readFileSync(path.join(ROOT, 'src/ui/components/Button.module.css'), 'utf8');
    expect(/\.button\s*{[^}]*}/.exec(css)?.[0] ?? '').toContain('min-height: var(--touch-target)');
    expect(readFileSync(path.join(ROOT, 'src/ui/screens/keep/DemoCard.tsx'), 'utf8')).toContain("buttonClassName('secondary')");
  });
});

describe('the loom files of the Keep Demo card', () => {
  const readFile = (name: string): Uint8Array => new Uint8Array(readFileSync(path.join(ROOT, 'public/demo/loom-files', name)));
  const diamond = generateSample(profile, 'diamond');
  const header = (bytes: Uint8Array): { width: number; height: number; bitDepth: number } => {
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    return { width: view.getInt32(18, true), height: view.getInt32(22, true), bitDepth: view.getUint16(28, true) };
  };

  /** The bytes the normal export button offers for a pattern, taken from the download it starts. */
  function exportedBytes(pattern: typeof diamond, bitDepth: 1 | 8): Uint8Array {
    let bytes: Uint8Array | null = null;
    const outcome = runExport(profile, pattern, { bitDepth }, {
      makeBlob: (data) => {
        bytes = data;
        return new Blob();
      },
      createObjectURL: () => 'blob:x',
      revokeObjectURL: () => undefined,
      createAnchor: () => ({ href: '', download: '', click: () => undefined }),
      defer: (fn) => fn(),
    });
    expect(outcome.ok).toBe(true);
    if (bytes === null) throw new Error('nothing was offered for download');
    return bytes;
  }

  it('link to files that exist in public/demo/loom-files', () => {
    for (const file of DEMO_LOOM_FILES) expect(readFile(file.fileName).length).toBeGreaterThan(0);
  });

  it('are byte for byte what the normal export gives for the Diamond sample at 1 and 8 bit', () => {
    expect(exportedBytes(diamond, 1)).toEqual(readFile('diamond-1bit.bmp'));
    expect(exportedBytes(diamond, 8)).toEqual(readFile('diamond-8bit.bmp'));
  });

  it('are 926 and 7,990 bytes, 192 ends wide and 36 picks long, read back from the BMP header', () => {
    const oneBit = readFile('diamond-1bit.bmp');
    const eightBit = readFile('diamond-8bit.bmp');
    expect(oneBit.length).toBe(926);
    expect(eightBit.length).toBe(7990);
    expect(header(oneBit)).toEqual({ width: 192, height: 36, bitDepth: 1 });
    expect(header(eightBit)).toEqual({ width: 192, height: 36, bitDepth: 8 });
  });
});

function reduce(state: AppState, actions: AppAction[]): AppState {
  return actions.reduce(appReducer, state);
}
const ready: AppState = { ...initialAppState, profile: { status: 'ready', profile } };

describe('the Code Demo card', () => {
  const diamond = generateSample(profile, 'diamond');

  it('"Load the Diamond card as code" makes the Diamond sample the Current_Pattern and opens the Code view', () => {
    const next = reduce({ ...ready, screen: 'weave' }, loadDiamondActions(ready, profile));
    expect(next.screen).toBe('code');
    expect(next.current.pattern).toEqual(diamond);
    expect(next.current.origin).toEqual({ kind: 'sample', design: 'diamond' });
    expect(next.breakpoints).toEqual([]);
    expect(next.selectedPick).toBe(0);
  });

  it('with scanned cards that are not saved it asks first, on Weave, and replaces nothing', () => {
    const scanned: AppState = { ...ready, screen: 'code', current: { pattern: diamond.slice(0, 2), origin: { kind: 'scanned', saved: false } } };
    const next = reduce(scanned, loadDiamondActions(scanned, profile));
    expect(next.screen).toBe('weave');
    expect(next.confirm).toMatchObject({ kind: 'replace-with-sample', design: 'diamond' });
    expect(next.current.pattern).toEqual(scanned.current.pattern);
  });

  it('"Add a breakpoint on pick 3" sets a breakpoint on the pick the Code view shows as pick 3, and a second press keeps it', () => {
    const loaded = reduce(ready, loadDiamondActions(ready, profile));
    const once = reduce(loaded, demoBreakpointActions(loaded));
    expect(once.breakpoints).toEqual([3]);
    expect(DEMO_BREAKPOINT_PICK).toBe(3);
    expect(reduce(once, demoBreakpointActions(once)).breakpoints).toEqual([3]);
    // The Code view numbers picks from 0: the line it labels "pick 3" is card index 3.
    const lines = patternToLines(profile, loaded.current.pattern);
    expect(lines.ok && lines.lineSet.lines[DEMO_BREAKPOINT_PICK]?.pick).toBe(DEMO_BREAKPOINT_PICK);
  });

  it('a breakpoint needs a design with a pick 3: none is set on an empty or short design', () => {
    expect(demoBreakpointActions(ready)).toEqual([]);
    const short: AppState = { ...ready, current: { pattern: diamond.slice(0, 3), origin: { kind: 'sample', design: 'diamond' } } };
    expect(demoBreakpointActions(short)).toEqual([]);
  });

  it('"Compare with an edited version" saves the demo design and an edit once, and the two differ', async () => {
    const { deps, store } = fakeDeps();
    const note = (count: number): string => `edit ${count}`;
    const pair = await ensureDemoPair(profile, note, deps);
    if (!pair.ok) throw new Error('no pair');
    expect(store.snapshot().records).toHaveLength(2);
    const again = await ensureDemoPair(profile, note, deps);
    expect(again).toEqual(pair);
    expect(store.snapshot().records).toHaveLength(2);
    const compared = await compareDesigns(
      { first: { kind: 'saved', id: pair.value.first }, second: { kind: 'saved', id: pair.value.second }, profile, current: null, untitled: 'untitled' },
      deps,
    );
    expect(compared.status).toBe('ready');
    if (compared.status !== 'ready' || !compared.diff.ok) throw new Error('not compared');
    expect(compared.diff.counts.changedHoles).toBeGreaterThan(0);
  });

  it('compares the oldest with the newest version when the demo design has several', async () => {
    const { deps } = fakeDeps();
    const saved = await saveDemoDesign(profile, deps);
    if (!saved.ok) throw new Error('save failed');
    await saveDemoEdit(profile, () => 'a', deps);
    const last = await saveDemoEdit(profile, () => 'b', deps);
    if (!last.ok) throw new Error('save failed');
    const pair = await ensureDemoPair(profile, () => 'c', deps);
    expect(pair).toEqual({ ok: true, value: { first: saved.value.id, second: last.value.id } });
  });

  it('a failing store gives a failure value and no pair', async () => {
    const { deps, store } = fakeDeps();
    store.failOn('list');
    expect(await ensureDemoPair(profile, () => 'x', deps)).toMatchObject({ ok: false, failure: { reason: 'storage-unavailable' } });
  });

  it('the card shows three buttons and a Demo chip in both languages, and says why the breakpoint waits', () => {
    const noop = (): void => undefined;
    const draw = (language: Language, pickCount: number, profileReady = true): string =>
      renderToStaticMarkup(
        <CodeDemoCard t={translator(DICTIONARIES, language)} profileReady={profileReady} pickCount={pickCount} busy={false} onLoad={noop} onBreakpoint={noop} onCompare={noop} />,
      );
    for (const language of ['en', 'hi'] as const) {
      const t = translator(DICTIONARIES, language);
      const html = draw(language, 36);
      expect(html).toContain(`>${t('codeview.demo.load')}</button>`);
      expect(html).toContain(`>${t('codeview.demo.breakpoint', { pick: 3 })}</button>`);
      expect(html).toContain(`>${t('codeview.demo.compare')}</button>`);
      expect(html).toContain(`>${t('demo.chip')}<`);
      expect(html).not.toContain(t('codeview.demo.needDesign', { count: 4 }));
      expect(draw(language, 0)).toContain(t('codeview.demo.needDesign', { count: 4 }));
    }
    expect(draw('en', 36, false).match(/<button[^>]*disabled/g)).toHaveLength(3);
  });
});
