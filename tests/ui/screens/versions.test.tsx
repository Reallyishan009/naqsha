import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NOTE_MAX, getDesign, listDesigns, saveDesign } from '../../../src/archive/index.ts';
import type { ArchiveDeps, DesignSummary, Metadata } from '../../../src/archive/index.ts';
import type { Pattern } from '../../../src/codec/index.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { KeepView, runDelete, runRestore, runSave } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import type { KeepViewProps } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import { compareDesigns } from '../../../src/ui/screens/code/DiffPanel.tsx';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { EMPTY_METADATA, initialKeepForm } from '../../../src/ui/state/keep.ts';
import type { Language, PatternOrigin } from '../../../src/ui/types.ts';
import { FakeArchiveStore } from '../../support/fakes.ts';
import { demoProfile } from '../../support/profiles.ts';
function escape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
}
function summary(id: string, createdAt: number, extra: Partial<DesignSummary> & { name?: string } = {}): DesignSummary {
  const { name = '', ...rest } = extra;
  return { id, profileName: demoProfile().name, metadata: { ...EMPTY_METADATA, name }, createdAt, pickCount: 7, ...rest };
}
function view(language: Language, overrides: Partial<KeepViewProps> = {}): string {
  const noop = (): void => undefined;
  const props: KeepViewProps = {
    profile: demoProfile(),
    pattern: generateSample(demoProfile(), 'diamond'),
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
}
function fakeDeps(): { deps: ArchiveDeps; store: FakeArchiveStore } {
  const store = new FakeArchiveStore();
  let counter = 0;
  let clock = 1000;
  return { store, deps: { store, now: () => clock++, newId: () => `id-${counter++}` } };
}
const archived: PatternOrigin = { kind: 'archive', id: 'b2' };
// Design "Saree" has three versions (a1 oldest); design "Shawl" has one.
const designs: DesignSummary[] = [
  summary('a1', 100, { name: 'Saree' }),
  summary('a2', 200, { name: 'Saree', designId: 'a1', note: 'wider border' }),
  summary('a3', 300, { name: 'Saree', designId: 'a1' }),
  summary('s1', 250, { name: 'Shawl' }),
];
describe('R1 the save choice', () => {
  const t = translator(DICTIONARIES, 'en');
  it('R1.1 a design from the archive offers both choices, the new version checked, in a fieldset with a legend', () => {
    const html = view('en', { origin: archived });
    expect(html).toContain('<legend');
    expect(html).toContain(escape(t('keep.save.mode.legend')));
    expect(html).toContain(escape(t('keep.save.mode.version')));
    expect(html).toContain(escape(t('keep.save.mode.design')));
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="version"/);
    expect(html).not.toMatch(/<input[^>]*checked=""[^>]*value="design"/);
  });
  it('R1.1 choosing "a new design" checks that radio', () => {
    const html = view('en', { origin: archived, form: { ...initialKeepForm, saveMode: 'design' } });
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="design"/);
  });
  it('R1.2 a design with no archive origin shows no choice', () => {
    for (const origin of [{ kind: 'none' }, { kind: 'scanned', saved: false }, { kind: 'sample', design: 'diamond' }] as const) {
      const html = view('en', { origin });
      expect(html).not.toContain(escape(t('keep.save.mode.version')));
      expect(html).not.toContain('keep-save-mode');
    }
  });
  it('R2.1 the note field stops at 200 characters', () => {
    expect(view('en')).toContain(`maxLength="${NOTE_MAX}"`);
  });
});
describe('R3 the grouped list', () => {
  const t = translator(DICTIONARIES, 'en');
  it('R3.1 one entry per design with the newest name and the version count', () => {
    const html = view('en', { designs, origin: archived });
    expect(html.split('Saree').length - 1).toBeGreaterThanOrEqual(1);
    expect(html).toContain(escape(t('keep.list.versionCount.other', { count: 3 })));
    expect(html).toContain(escape(t('keep.list.versionCount.one')));
    expect(html.indexOf('Saree')).toBeLessThan(html.indexOf('Shawl')); // newest version on top
  });
  it('R3.1 a design with several versions is closed until its entry is opened, and the button says so', () => {
    const closed = view('en', { designs });
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).toContain(escape(t('keep.list.showVersions')));
    expect(closed).not.toContain(escape(t('keep.version.newest')));
    const open = view('en', { designs, expandedDesignId: 'a1' });
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain(escape(t('keep.list.hideVersions')));
  });
  it('R3.2 an opened entry lists its versions newest first with date, note and pick count', () => {
    const html = view('en', { designs, expandedDesignId: 'a1' });
    expect(html).toContain('<ol');
    const newest = html.indexOf(escape(t('keep.version.newest')));
    expect(newest).toBeGreaterThan(-1);
    expect(html.indexOf('wider border')).toBeGreaterThan(newest); // a3 has no note, a2 has
    expect(html).toContain(escape(t('keep.version.note', { note: 'wider border' })));
    expect(html).toContain(escape(t('keep.version.noNote')));
    expect(html.split(escape(t('keep.list.picks', { count: 7 }))).length - 1).toBeGreaterThanOrEqual(3);
    // Each version names its date, so the three "Open: Saree" buttons are told apart.
    expect(html.match(/aria-label="Open: Saree, /g)).toHaveLength(3);
  });
  it('R3.2 the version list reads in Hindi from the translation file', () => {
    const hi = translator(DICTIONARIES, 'hi');
    const html = view('hi', { designs, expandedDesignId: 'a1', origin: archived });
    for (const key of ['keep.version.newest', 'keep.version.restore', 'keep.version.comparePrevious', 'keep.version.compareOpen']) {
      expect(html).toContain(escape(hi(key)));
      expect(hi(key)).not.toBe(translator(DICTIONARIES, 'en')(key));
    }
  });
  it('R7.10 a note is rendered as text, never as markup', () => {
    const note = '<b onmouseover=x>hi</b>';
    const html = view('en', { designs: [summary('a1', 1), summary('a2', 2, { designId: 'a1', note })], expandedDesignId: 'a1' });
    expect(html).not.toContain(note);
    expect(html).toContain(escape(note));
  });
});
describe('R4 version actions', () => {
  const t = translator(DICTIONARIES, 'en');
  const open = (overrides: Partial<KeepViewProps> = {}) => view('en', { designs, expandedDesignId: 'a1', origin: archived, ...overrides });
  it('R4.1 Compare with the previous version is offered for every version but the oldest', () => {
    expect(open().split(escape(t('keep.version.comparePrevious'))).length - 1).toBe(4); // two buttons, label and text each
  });
  it('R4.1 Compare with the open design is offered when the open design came from the archive', () => {
    // Three versions of Saree and the one version of Shawl: the open design is version b2, none of these.
    expect(open().split(`>${escape(t('keep.version.compareOpen'))}<`).length - 1).toBe(4);
    expect(open({ origin: { kind: 'none' } })).not.toContain(escape(t('keep.version.compareOpen')));
  });
  it('R4.2 every version has Restore, and a single design has its actions without opening', () => {
    expect(open().split(`>${escape(t('keep.version.restore'))}<`).length - 1).toBe(4);
    const single = view('en', { designs: [summary('s1', 1, { name: 'Shawl' })] });
    for (const key of ['keep.list.open', 'keep.version.restore', 'keep.list.delete']) {
      expect(single).toContain(`>${escape(t(key))}<`);
    }
  });
  it('R4.3 Delete asks first, for that version only, with the existing wording', () => {
    const html = open({ pendingDeleteId: 'a2' });
    expect(html.split(escape(t('keep.list.deleteConfirm'))).length - 1).toBe(2);
    expect(html).toContain(escape(t('keep.list.deleteNo')));
    expect(open()).not.toContain(escape(t('keep.list.deleteConfirm')));
  });
  it('R8.1 every button is a native button with a text name, and no state is colour only', () => {
    const html = open({ pendingDeleteId: 'a2' });
    expect(html).not.toMatch(/<div[^>]*onclick/i);
    for (const match of html.matchAll(/<button[^>]*>(.*?)<\/button>/gs)) expect(match[1]!.replace(/<[^>]*>/g, '').trim()).not.toBe('');
    expect(html).toContain(escape(t('keep.version.newest'))); // the newest version is a word, not a colour
  });
});
describe('version history actions over the fake archive store', () => {
  const profile = demoProfile();
  const pattern = generateSample(profile, 'diamond');
  const changed: Pattern = pattern.map((grid, pick) =>
    pick === 0 ? grid.map((hookRow, r) => (r === 0 ? hookRow.map((hole, c) => (c === 0 ? !hole : hole)) : hookRow)) : grid,
  );
  const form = { ...initialKeepForm, metadata: { ...EMPTY_METADATA, name: 'Border' } as Metadata };
  async function twoVersions() {
    const { deps, store } = fakeDeps();
    const first = await runSave(profile, pattern, form, 'untitled', deps);
    if (!first.ok) throw new Error('first save failed');
    const second = await runSave(profile, changed, { ...form, note: 'one hole moved' }, 'untitled', deps, first.id);
    if (!second.ok) throw new Error('second save failed');
    return { deps, store, first: first.id, second: second.id };
  }
  it('R1.1 R2.1 saving a version stores the design id and the note and keeps the old design as it was', async () => {
    const { deps, first, second } = await twoVersions();
    const old = await getDesign(first, deps);
    const next = await getDesign(second, deps);
    expect(old.ok && old.value.pattern).toEqual(pattern);
    expect(old.ok && 'designId' in old.value).toBe(false);
    expect(next.ok && next.value).toMatchObject({ designId: first, note: 'one hole moved', pattern: changed });
  });
  it('R1.2 a save with no source version starts a new design', async () => {
    const { deps, store } = fakeDeps();
    await runSave(profile, pattern, form, 'untitled', deps);
    await runSave(profile, pattern, form, 'untitled', deps);
    expect(store.snapshot().records.some((record) => 'designId' in record)).toBe(false);
  });
  it('R7.1 saving a version of a source that was deleted is not-found and stores nothing', async () => {
    const { deps, store, first, second } = await twoVersions();
    await runDelete(first, deps);
    const before = store.snapshot();
    const outcome = await runSave(profile, pattern, form, 'untitled', deps, first);
    expect(outcome).toEqual({ ok: false, failure: { reason: 'not-found', id: first } });
    expect(store.snapshot()).toEqual(before);
    expect(before.records.map((r) => r.id)).toEqual([second]);
  });
  it('R4.2 restore returns the version pattern and metadata and writes nothing', async () => {
    const { deps, store, first } = await twoVersions();
    const before = store.snapshot();
    const outcome = await runRestore(first, deps);
    expect(outcome).toMatchObject({ ok: true, id: first, pattern, metadata: { name: 'Border' } });
    expect(store.snapshot()).toEqual(before);
    expect(await runRestore('gone', deps)).toEqual({ ok: false, failure: { reason: 'not-found', id: 'gone' } });
  });
  it('R4.2 after a restore the next save is a new version and the restored one is not overwritten', async () => {
    const { deps, first, second } = await twoVersions();
    const restored = await runRestore(first, deps);
    if (!restored.ok) throw new Error('restore failed');
    const third = await runSave(profile, restored.pattern, form, 'untitled', deps, restored.id);
    expect(third.ok).toBe(true);
    const listed = await listDesigns(deps);
    expect(listed.ok && listed.value).toHaveLength(3);
    const got = await getDesign(second, deps);
    expect(got.ok && got.value.pattern).toEqual(changed);
  });
  it('R4.3 R5.1 deleting one version removes only it and returns the fresh list', async () => {
    const { deps, first, second } = await twoVersions();
    const { failure, designs: next } = await runDelete(second, deps);
    expect(failure).toBeNull();
    expect(next?.map((s) => s.id)).toEqual([first]);
  });
  it('R4.1 Compare uses the existing diff: the first side is the previous version, the second is the newer one', async () => {
    const { deps, first, second } = await twoVersions();
    const result = await compareDesigns(
      { first: { kind: 'saved', id: first }, second: { kind: 'saved', id: second }, profile, current: null, untitled: 'untitled' },
      deps,
    );
    expect(result.status).toBe('ready');
    if (result.status === 'ready' && result.diff.ok) {
      expect(result.diff.counts).toEqual({ changedHoles: 1, addedCards: 0, removedCards: 0 });
    }
  });
  it('R7.1 an unavailable store gives a failure value and the form is not touched', async () => {
    const { deps, store, first } = await twoVersions();
    store.failOn('open');
    const outcome = await runSave(profile, pattern, form, 'untitled', deps, first);
    expect(outcome.ok === false && outcome.failure.reason).toBe('storage-unavailable');
    expect(form.metadata.name).toBe('Border');
  });
});
