import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { NOTE_MAX, groupDesigns, saveDesign } from '../../../src/archive/index.ts';
import type { ArchiveFailure, DesignSummary, Metadata } from '../../../src/archive/index.ts';
import { DEFAULT_EXPORT_OPTIONS, bmpFileName, readPatternBmp } from '../../../src/exporter/index.ts';
import type { ExportOptions } from '../../../src/exporter/index.ts';
import { DICTIONARIES, EN, HI, archiveFailureKey, exportFailureKey, translator } from '../../../src/ui/i18n/messages.ts';
import {
  afterSaveFailure,
  canExport,
  canSave,
  compareTargets,
  continuesId,
  effectiveSaveMode,
  formatSavedAt,
  initialKeepForm,
  keepFormReducer,
  runExport,
  savedLabel,
  summaryRow,
  versionDetails,
  EMPTY_METADATA,
} from '../../../src/ui/state/keep.ts';
import type { KeepForm } from '../../../src/ui/state/keep.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import { FakeArchiveStore, FakeDownloadDeps } from '../../support/fakes.ts';
import { exportOptionsArbitrary, patternArbitrary } from '../../support/patterns.ts';
import { REMOVE, demoProfile, mutateProfile, profileArbitrary } from '../../support/profiles.ts';

const metadataArbitrary: fc.Arbitrary<Metadata> = fc.record({
  name: fc.oneof(fc.string(), fc.constantFrom('', ' ', '\t\n', '  Kota  ')),
  naqshband: fc.string(),
  weaver: fc.string(),
  place: fc.string(),
  date: fc.string(),
  notes: fc.string(),
});

const scenarioArbitrary = profileArbitrary.chain((profile) =>
  fc.record({ profile: fc.constant(profile), pattern: patternArbitrary(profile), options: exportOptionsArbitrary }),
);

describe('keep examples', () => {
  it('the Keep form starts with the default export options and empty Metadata', () => {
    expect(initialKeepForm.options).toEqual(DEFAULT_EXPORT_OPTIONS);
    expect(Object.values(initialKeepForm.metadata).every((value) => value === '')).toBe(true);
  });

  it('an empty pattern disables both controls and a non-empty one enables them', () => {
    const profile = demoProfile();
    const pattern = generateSample(profile, 'diamond');
    expect(canExport([])).toBe(false);
    expect(canSave([])).toBe(false);
    expect(canExport(pattern)).toBe(true);
    expect(canSave(pattern)).toBe(true);
  });

  it('runExport offers one download named by bmpFileName', () => {
    const profile = demoProfile();
    const deps = new FakeDownloadDeps();
    const options: ExportOptions = { ...DEFAULT_EXPORT_OPTIONS, bitDepth: 8 };
    expect(runExport(profile, generateSample(profile, 'border'), options, deps)).toEqual({ ok: true });
    expect(deps.downloads).toHaveLength(1);
    expect(deps.downloads[0]!.fileName).toBe(bmpFileName(profile.name, 8));
    expect(deps.downloads[0]!.type).toBe('image/bmp');
  });

  it('R5.8 every Sample_Design of the demo profile exports and reads back to the same pattern', () => {
    const profile = demoProfile();
    for (const design of ['diamond', 'border', 'floral'] as const) {
      const pattern = generateSample(profile, design);
      for (const bitDepth of [1, 8] as const) {
        const deps = new FakeDownloadDeps();
        const options = { ...DEFAULT_EXPORT_OPTIONS, bitDepth };
        expect(runExport(profile, pattern, options, deps).ok).toBe(true);
        expect(readPatternBmp(deps.downloads[0]!.bytes, profile, options)).toEqual({ ok: true, pattern });
      }
    }
  });

  it('savedLabel uses the untitled text of each language for an empty name', () => {
    const metadata = { ...initialKeepForm.metadata, name: '   ' };
    expect(savedLabel(metadata, translator(DICTIONARIES, 'en')('keep.untitled'))).toBe(EN['keep.untitled']);
    expect(savedLabel(metadata, translator(DICTIONARIES, 'hi')('keep.untitled'))).toBe(HI['keep.untitled']!.text);
  });

  it('a failed save over a store that fails keeps the form and names the failure', async () => {
    const store = new FakeArchiveStore();
    store.failOn('put');
    const form: KeepForm = keepFormReducer(initialKeepForm, { type: 'set-field', field: 'name', value: 'Kota' });
    const result = await saveDesign(
      { pattern: [], profileName: 'p', metadata: form.metadata },
      { store, now: () => 1, newId: () => 'a' },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const after = afterSaveFailure(form, result.failure);
    expect(after.form).toEqual(form);
    expect(after.announce).toEqual({ type: 'announce', kind: 'error', messageKey: archiveFailureKey(result.failure) });
  });
});

describe('keep properties', () => {
  it('R5.8 an exported bitmap read back through runExport bytes is the same pattern', () => {
    // Feature: app, Property 13: Exported BMP reads back to the same pattern
    fc.assert(
      fc.property(scenarioArbitrary, ({ profile, pattern, options }) => {
        const deps = new FakeDownloadDeps();
        expect(runExport(profile, pattern, options, deps)).toEqual({ ok: true });
        expect(deps.downloadCount).toBe(1);
        expect(deps.downloads[0]!.fileName).toBe(bmpFileName(profile.name, options.bitDepth));
        expect(readPatternBmp(deps.downloads[0]!.bytes, profile, options)).toEqual({ ok: true, pattern });
      }),
    );
  });

  it('R5.7 a failed export never starts a download and the failure has a message key', () => {
    // Feature: app, Property 14: A failed export or print never starts a download
    const invalidOptions = fc.constantFrom<unknown>(null, 3, 'black', [], { bitDepth: 3 }, { liftColour: 'red' }, { pickOrder: 1 });
    const failing = scenarioArbitrary.chain(({ profile, pattern, options }) =>
      fc.oneof(
        fc.constantFrom(...([[['hookRows'], 0], [['name'], REMOVE], [[], null], [['cardWidthMm'], -1]] as const)).map(
          ([path, replacement]) => ({ profile: mutateProfile(profile, path, replacement) as unknown, pattern: pattern as unknown, options: options as unknown }),
        ),
        fc.constant({ profile: profile as unknown, pattern: [] as unknown, options: options as unknown }),
        fc.constantFrom<unknown>(null, 'x', [null], [[]], [[['x']]]).map((damaged) => ({
          profile: profile as unknown,
          pattern: [...pattern, damaged] as unknown,
          options: options as unknown,
        })),
        invalidOptions.map((bad) => ({ profile: profile as unknown, pattern: pattern as unknown, options: bad })),
      ),
    );
    fc.assert(
      fc.property(failing, ({ profile, pattern, options }) => {
        const deps = new FakeDownloadDeps();
        const outcome = runExport(profile, pattern, options, deps);
        expect(outcome.ok).toBe(false);
        expect(deps.downloadCount).toBe(0);
        expect(deps.revoked).toEqual([]);
        if (!outcome.ok) {
          const key = exportFailureKey(outcome.failure);
          expect(Object.hasOwn(EN, key)).toBe(true);
          expect(Object.hasOwn(HI, key)).toBe(true);
        }
      }),
    );
  });

  it('R7.4 a failed save keeps the entered Metadata and sets an error announcement', () => {
    // Feature: app, Property 20: A failed save keeps the entered Metadata
    const failure: fc.Arbitrary<ArchiveFailure> = fc.oneof(
      fc.record({ reason: fc.constant('not-found' as const), id: fc.string() }),
      fc.record({ reason: fc.constant('storage-unavailable' as const), detail: fc.string() }),
      fc.record({ reason: fc.constant('write-failed' as const), detail: fc.string() }),
    );
    fc.assert(
      fc.property(metadataArbitrary, exportOptionsArbitrary, failure, (metadata, options, archiveFailure) => {
        const form: KeepForm = { metadata, options, note: '', saveMode: 'version' };
        const before = structuredClone(form);
        const after = afterSaveFailure(form, archiveFailure);
        expect(after.form).toEqual(before);
        expect(after.announce.type).toBe('announce');
        expect(after.announce.kind).toBe('error');
        expect(after.announce.messageKey).toBe(archiveFailureKey(archiveFailure));
      }),
    );
  });

  it('R7.3 the saved label shows the trimmed name or the untitled text', () => {
    // Feature: app, Property 19: The saved label shows the name or "untitled"
    fc.assert(
      fc.property(metadataArbitrary, fc.constantFrom<'hi' | 'en'>('hi', 'en'), (metadata, language) => {
        const untitled = translator(DICTIONARIES, language)('keep.untitled');
        const label = savedLabel(metadata, untitled);
        const trimmed = metadata.name.trim();
        if (trimmed === '') expect(label).toBe(untitled);
        else expect(label).toBe(trimmed);
        expect(label).toContain(trimmed === '' ? untitled : trimmed);
      }),
    );
  });

  it('R7.6 and R22.12 a list row shows name, place, date and pick count, and the profile name only when it differs', () => {
    // Feature: app, Property 21: List rows show the required fields and a differing profile name
    const summary: fc.Arbitrary<DesignSummary> = fc.record({
      id: fc.string(),
      profileName: fc.string(),
      metadata: metadataArbitrary,
      createdAt: fc.nat(),
      pickCount: fc.nat(),
    });
    fc.assert(
      fc.property(summary, fc.string(), fc.boolean(), (design, otherName, same) => {
        const current = same ? design.profileName : otherName;
        const row = summaryRow(design, current, 'untitled');
        const trimmed = design.metadata.name.trim();
        expect(row.name).toBe(trimmed === '' ? 'untitled' : trimmed);
        expect(row.place).toBe(design.metadata.place);
        expect(row.date).toBe(design.metadata.date);
        expect(row.pickCount).toBe(design.pickCount);
        if (design.profileName === current) expect(row.profileName).toBeNull();
        else expect(row.profileName).toBe(design.profileName);
      }),
    );
  });
});
describe('version history helpers', () => {
  const origin = { kind: 'archive', id: 'v2' } as const;
  const summary = (id: string, createdAt: number, designId?: string, note?: string): DesignSummary => ({
    id,
    profileName: 'demo',
    metadata: { name: '', naqshband: '', weaver: '', place: '', date: '', notes: '' },
    createdAt,
    pickCount: 4,
    ...(designId === undefined ? {} : { designId }),
    ...(note === undefined ? {} : { note }),
  });
  it('R1.1 the save choice defaults to a new version and applies only to a design from the archive', () => {
    expect(initialKeepForm.saveMode).toBe('version');
    expect(effectiveSaveMode(initialKeepForm, origin)).toBe('version');
    expect(effectiveSaveMode({ ...initialKeepForm, saveMode: 'design' }, origin)).toBe('design');
    expect(effectiveSaveMode(initialKeepForm, { kind: 'scanned', saved: false })).toBe('design');
    expect(effectiveSaveMode(initialKeepForm, { kind: 'none' })).toBe('design');
  });
  it('R1.1 R1.2 a save continues the open version only for "new version" from the archive', () => {
    expect(continuesId(initialKeepForm, origin)).toBe('v2');
    expect(continuesId({ ...initialKeepForm, saveMode: 'design' }, origin)).toBeUndefined();
    expect(continuesId(initialKeepForm, { kind: 'sample', design: 'diamond' })).toBeUndefined();
  });
  it('R2.1 the note field holds at most 200 characters', () => {
    const typed = keepFormReducer(initialKeepForm, { type: 'set-note', value: 'x'.repeat(250) });
    expect(typed.note).toHaveLength(NOTE_MAX);
  });
  it('R4.2 set-metadata fills the form from the restored version and clears the note', () => {
    const typed = keepFormReducer(initialKeepForm, { type: 'set-note', value: 'old' });
    const filled = keepFormReducer(typed, { type: 'set-metadata', metadata: { ...EMPTY_METADATA, name: 'Border' } });
    expect(filled.metadata.name).toBe('Border');
    expect(filled.note).toBe('');
  });
  it('R3.2 a version row shows the date in the language in use, the note and the pick count', () => {
    const row = versionDetails(summary('a', Date.UTC(2026, 10, 20, 12, 0), undefined, 'wider border'), 'en', 'untitled');
    expect(row).toMatchObject({ name: 'untitled', note: 'wider border', pickCount: 4 });
    expect(row.savedAt).toContain('2026');
    expect(versionDetails(summary('a', 0), 'hi', 'untitled').note).toBe('');
    expect(formatSavedAt(Number.NaN, 'en')).toBe('');
  });
  it('R4.1 Compare offers the previous version and, unless it is the open one, the open design', () => {
    const [group] = groupDesigns([summary('v1', 1), summary('v2', 2, 'v1'), summary('v3', 3, 'v1')]);
    expect(compareTargets(group!, 'v3', origin)).toEqual({ previous: group!.versions[1], openDesignId: 'v2' });
    expect(compareTargets(group!, 'v2', origin).openDesignId).toBeNull();
    expect(compareTargets(group!, 'v1', { kind: 'none' })).toEqual({ previous: null, openDesignId: null });
  });
});
