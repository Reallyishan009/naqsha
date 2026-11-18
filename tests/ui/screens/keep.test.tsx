import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ArchiveDeps, DesignSummary, Metadata } from '../../../src/archive/index.ts';
import { listDesigns } from '../../../src/archive/index.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { KeepView, runDelete, runOpen, runSave } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import type { KeepViewProps } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { EMPTY_METADATA, initialKeepForm } from '../../../src/ui/state/keep.ts';
import type { Language } from '../../../src/ui/types.ts';
import { FakeArchiveStore } from '../../support/fakes.ts';
import { demoProfile } from '../../support/profiles.ts';

const SEED = 20240614;
const NUM_RUNS = 100;
const LANGUAGES: Language[] = ['hi', 'en'];

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function summary(id: string, metadata: Partial<Metadata>, profileName = demoProfile().name): DesignSummary {
  return { id, profileName, metadata: { ...EMPTY_METADATA, ...metadata }, createdAt: 1, pickCount: 7 };
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

describe('keep screen', () => {
  it('R7.5 the record-not-legal-protection sentence is next to the save control in both languages', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = view(language);
      const sentence = escape(t('keep.save.legal'));
      expect(html).toContain(sentence);
      const saveButton = html.indexOf(`>${escape(t('keep.save.button'))}</button>`);
      expect(saveButton).toBeGreaterThan(-1);
      expect(Math.abs(html.indexOf(sentence) - saveButton)).toBeLessThan(200);
    }
    expect(translator(DICTIONARIES, 'en')('keep.save.legal')).toBe(
      'This is a record of the design. It is not legal protection.',
    );
  });

  it('R5.2 R5.9 the export options, the loom button and the untested sentence are shown', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = view(language);
      for (const key of [
        'keep.export.bitDepth.1',
        'keep.export.bitDepth.8',
        'keep.export.liftColour.black',
        'keep.export.liftColour.white',
        'keep.export.pickOrder.first-at-top',
        'keep.export.pickOrder.first-at-bottom',
        'keep.export.endOrder.first-at-left',
        'keep.export.endOrder.first-at-right',
        'keep.export.button',
        'keep.export.untested',
      ]) {
        expect(html, `${language} ${key}`).toContain(escape(t(key)));
      }
    }
  });

  it('R5.3 the form starts on the default export options', () => {
    const html = view('en');
    const checked = html.match(/<input[^>]*checked=""[^>]*>/g) ?? [];
    expect(checked.map((input) => /value="([^"]*)"/.exec(input)?.[1])).toEqual([
      '1',
      'black',
      'first-at-top',
      'first-at-left',
    ]);
  });

  it('R22.1 R22.4 R22.6 R22.7 the notice shows next to both the export and the save control, and neither is disabled', () => {
    const t = translator(DICTIONARIES, 'en');
    const html = view('en');
    const sentence = escape(t('notice.unverifiedProfile'));
    expect(html.split(sentence).length - 1).toBe(2);
    expect(html).toContain(escape(demoProfile().status as string));
    expect(html).toContain(escape(demoProfile().name));
    for (const key of ['keep.export.button', 'keep.save.button']) {
      expect(html).toMatch(new RegExp(`<button(?![^>]*disabled)[^>]*>${escape(t(key))}</button>`));
    }
    // Each notice comes before its control (R22.7).
    const first = html.indexOf(sentence);
    const second = html.indexOf(sentence, first + 1);
    expect(first).toBeLessThan(html.indexOf(escape(t('keep.export.button'))));
    expect(second).toBeLessThan(html.indexOf(`>${escape(t('keep.save.button'))}</button>`));
    expect(second).toBeGreaterThan(html.indexOf(escape(t('keep.export.button'))));
  });

  it('R22.8 a profile with no status shows the name and no notice', () => {
    const { status: _status, ...withoutStatus } = demoProfile();
    const t = translator(DICTIONARIES, 'en');
    const html = view('en', { profile: withoutStatus });
    expect(html).toContain(escape(withoutStatus.name));
    expect(html).not.toContain(escape(t('notice.unverifiedProfile')));
  });

  it('R5.6 R7.2 an empty pattern disables export and save and names Try it or Scan', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = view(language, { pattern: [] });
      expect(html).toContain(escape(t('keep.empty')));
      for (const key of ['keep.export.button', 'keep.save.button']) {
        expect(html).toMatch(new RegExp(`<button[^>]*disabled[^>]*>${escape(t(key))}</button>`));
      }
    }
  });

  it('R7.9 an empty archive shows the empty-list message', () => {
    const t = translator(DICTIONARIES, 'en');
    expect(view('en', { designs: [] })).toContain(escape(t('keep.list.empty')));
    expect(view('en', { designs: [summary('a', { name: 'Saree' })] })).not.toContain(escape(t('keep.list.empty')));
  });

  it('R7.6 R22.12 a row shows name, place, date, pick count, and the profile name only when it differs', () => {
    const t = translator(DICTIONARIES, 'en');
    const html = view('en', {
      designs: [
        summary('a', { name: 'Saree', place: 'Varanasi', date: '2024-05-01' }),
        summary('b', {}, 'Other profile'),
      ],
    });
    expect(html).toContain('Saree');
    expect(html).toContain('Varanasi');
    expect(html).toContain('2024-05-01');
    expect(html).toContain(escape(t('keep.list.picks', { count: 7 })));
    expect(html).toContain(escape(t('keep.untitled')));
    expect(html).toContain(escape(t('keep.list.profile', { name: 'Other profile' })));
    expect(html).not.toContain(escape(t('keep.list.profile', { name: demoProfile().name })));
  });

  it('R7.10 markup in a name appears escaped', () => {
    const name = '<img src=x onerror=alert(1)>';
    const html = view('en', { designs: [summary('a', { name })] });
    expect(html).not.toContain(name);
    expect(html).toContain(escape(name));
  });

  it('R7.10 any metadata text is rendered as text, never as markup', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 40 }), (name) => {
        const html = view('en', { designs: [summary('a', { name })] });
        expect(html).toContain(escape(name.trim() === '' ? 'untitled' : name.trim()));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R7.8 a delete request shows the confirmation for that row only', () => {
    const t = translator(DICTIONARIES, 'en');
    const designs = [summary('a', { name: 'One' }), summary('b', { name: 'Two' })];
    const html = view('en', { designs, pendingDeleteId: 'b' });
    expect(html.split(escape(t('keep.list.deleteConfirm'))).length - 1).toBe(2); // label and text, once
    expect(view('en', { designs })).not.toContain(escape(t('keep.list.deleteConfirm')));
  });

  it('R7.4 a failed save shows its message and the form keeps what was typed', () => {
    const t = translator(DICTIONARIES, 'en');
    const form = { ...initialKeepForm, metadata: { ...EMPTY_METADATA, name: 'Kept name' } };
    const html = view('en', { form, failureKey: 'error.archive.write-failed' });
    expect(html).toContain(escape(t('error.archive.write-failed')));
    expect(html).toContain('value="Kept name"');
  });

  it('R14 every control is a native control and every target is at least 48 px', () => {
    const html = view('en', { designs: [summary('a', { name: 'One' })], pendingDeleteId: 'a' });
    expect(html).not.toMatch(/<div[^>]*onclick/i);
    expect(html).not.toMatch(/tabindex="[1-9]/i);
    const css = readFileSync('src/ui/screens/keep/KeepScreen.module.css', 'utf8');
    const tokens = readFileSync('src/ui/theme/tokens.css', 'utf8');
    expect(tokens).toMatch(/--touch-target:\s*48px/);
    for (const rule of ['.button', '.input', '.choice']) {
      const block = new RegExp(`\\${rule}\\s*{[^}]*}`).exec(css)?.[0] ?? '';
      expect(block, rule).toContain('min-height: var(--touch-target)');
    }
  });
});

describe('keep screen actions over the fake archive store', () => {
  const profile = demoProfile();
  const pattern = generateSample(profile, 'border');

  it('R7.3 save stores the pattern and metadata and the label is the trimmed name or untitled', async () => {
    const { deps, store } = fakeDeps();
    const form = { ...initialKeepForm, metadata: { ...EMPTY_METADATA, name: '  Saree  ', place: 'Kota' } };
    const saved = await runSave(profile, pattern, form, 'untitled', deps);
    expect(saved).toMatchObject({ ok: true, label: 'Saree' });
    expect(store.snapshot().records).toHaveLength(1);
    const untitled = await runSave(profile, pattern, initialKeepForm, 'untitled', deps);
    expect(untitled).toMatchObject({ ok: true, label: 'untitled' });
  });

  it('R7.4 a failing store gives a failure value, stores nothing, and the form is unchanged', async () => {
    const { deps, store } = fakeDeps();
    store.failOn('put');
    const form = { ...initialKeepForm, metadata: { ...EMPTY_METADATA, name: 'Keep me' } };
    const before = structuredClone(form);
    const saved = await runSave(profile, pattern, form, 'untitled', deps);
    expect(saved).toMatchObject({ ok: false, failure: { reason: 'write-failed' } });
    expect(form).toEqual(before);
    expect(store.snapshot().records).toHaveLength(0);
  });

  it('R7.7 opening a saved design returns its pattern; an unknown id is not-found', async () => {
    const { deps } = fakeDeps();
    const saved = await runSave(profile, pattern, initialKeepForm, 'untitled', deps);
    if (!saved.ok) throw new Error('save failed');
    const opened = await runOpen(saved.id, deps);
    expect(opened).toEqual({ ok: true, id: saved.id, pattern });
    expect(await runOpen('missing', deps)).toMatchObject({ ok: false, failure: { reason: 'not-found' } });
  });

  it('R7.8 delete removes exactly that design and returns the fresh list', async () => {
    const { deps } = fakeDeps();
    const first = await runSave(profile, pattern, initialKeepForm, 'untitled', deps);
    const second = await runSave(profile, pattern, initialKeepForm, 'untitled', deps);
    if (!first.ok || !second.ok) throw new Error('save failed');
    const result = await runDelete(first.id, deps);
    expect(result.failure).toBeNull();
    expect(result.designs?.map((design) => design.id)).toEqual([second.id]);
    const listed = await listDesigns(deps);
    expect(listed.ok && listed.value.map((design) => design.id)).toEqual([second.id]);
    const again = await runDelete(first.id, deps);
    expect(again.failure).toMatchObject({ reason: 'not-found' });
  });

  it('R7.8 a failing remove keeps the design and reports the failure', async () => {
    const { deps, store } = fakeDeps();
    const saved = await runSave(profile, pattern, initialKeepForm, 'untitled', deps);
    if (!saved.ok) throw new Error('save failed');
    store.failOn('remove');
    const result = await runDelete(saved.id, deps);
    expect(result.failure).toMatchObject({ reason: 'write-failed' });
    expect(result.designs).toHaveLength(1);
  });
});
