import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  NOTE_MAX,
  deleteDesign,
  designIdOf,
  getDesign,
  groupDesigns,
  listDesigns,
  previousVersion,
  saveDesign,
} from '../../src/archive/index.ts';
import type { ArchiveDeps, DesignSummary, Metadata } from '../../src/archive/index.ts';
import { openIndexedDbStore } from '../../src/archive/idbStore.ts';
import type { Pattern } from '../../src/codec/index.ts';
import { createFakeIndexedDb } from '../support/fakeIndexedDb.ts';
import { FakeArchiveStore } from '../support/fakes.ts';
import { patternArbitrary } from '../support/patterns.ts';
import { profileArbitrary } from '../support/profiles.ts';
const emptyMetadata: Metadata = { name: '', naqshband: '', weaver: '', place: '', date: '', notes: '' };
const tiny: Pattern = [[[true, false], [false, true]]];
const wider: Pattern = [[[true, true], [false, true]], [[false, false], [true, true]]];
/** Deps over a fake store with counting ids and a clock that moves forward by one on every save. */
function makeDeps(store = new FakeArchiveStore()) {
  let counter = 0;
  let time = 100;
  const deps: ArchiveDeps = { store, now: () => time++, newId: () => `id-${String(++counter).padStart(4, '0')}` };
  return { deps, store };
}
function input(pattern: Pattern, extra: { continues?: string; note?: string; name?: string } = {}) {
  const { name = '', ...rest } = extra;
  return { pattern, profileName: 'demo', metadata: { ...emptyMetadata, name }, ...rest };
}
async function saved(result: ReturnType<typeof saveDesign>): Promise<string> {
  const done = await result;
  if (!done.ok) throw new Error(`save failed: ${done.failure.reason}`);
  return done.value;
}
function summary(id: string, createdAt: number, designId?: string): DesignSummary {
  return {
    id,
    profileName: 'demo',
    metadata: emptyMetadata,
    createdAt,
    pickCount: 1,
    ...(designId === undefined ? {} : { designId }),
  };
}
describe('version grouping (pure)', () => {
  it('R3.1 a summary with no design id is a design with one version', () => {
    expect(designIdOf({ id: 'a' })).toBe('a');
    expect(designIdOf({ id: 'b', designId: 'a' })).toBe('a');
    const groups = groupDesigns([summary('a', 1), summary('b', 2)]);
    expect(groups.map((g) => [g.designId, g.versionCount])).toEqual([['b', 1], ['a', 1]]);
  });
  it('R3.1 R3.2 one group per design, versions newest first, groups ordered by their newest version', () => {
    const groups = groupDesigns([
      summary('a1', 1),
      summary('b1', 2),
      summary('a2', 5, 'a1'),
      summary('a3', 3, 'a1'),
    ]);
    expect(groups.map((g) => g.designId)).toEqual(['a1', 'b1']);
    expect(groups[0]!.versions.map((v) => v.id)).toEqual(['a2', 'a3', 'a1']);
    expect(groups[0]!.newest.id).toBe('a2');
    expect(groups[0]!.versionCount).toBe(3);
    expect(groups[1]!.versionCount).toBe(1);
  });
  it('R3.2 versions made in the same millisecond are ordered by id, so the order is stable', () => {
    const [group] = groupDesigns([summary('b', 7, 'a'), summary('a', 7), summary('c', 7, 'a')]);
    expect(group!.versions.map((v) => v.id)).toEqual(['a', 'b', 'c']);
  });
  it('R4.1 previousVersion is the next older version, and null for the oldest or an unknown id', () => {
    const [group] = groupDesigns([summary('a1', 1), summary('a2', 2, 'a1'), summary('a3', 3, 'a1')]);
    expect(previousVersion(group!, 'a3')?.id).toBe('a2');
    expect(previousVersion(group!, 'a2')?.id).toBe('a1');
    expect(previousVersion(group!, 'a1')).toBeNull();
    expect(previousVersion(group!, 'nope')).toBeNull();
  });
  it('R3.1 grouping does not change its input', () => {
    const input = [summary('a1', 1), summary('a2', 2, 'a1')];
    const copy = structuredClone(input);
    groupDesigns(input);
    expect(input).toEqual(copy);
  });
});
describe('saving versions', () => {
  it('R2.2 the first version of a design stores no design id and no note', async () => {
    const { deps, store } = makeDeps();
    const id = await saved(saveDesign(input(tiny), deps));
    const [record] = store.snapshot().records;
    expect(record).toBeDefined();
    expect(Object.keys(record!).sort()).toEqual(['createdAt', 'id', 'metadata', 'pattern', 'profileName']);
    expect(designIdOf(record!)).toBe(id);
  });
  it('R2.1 a version stores the design id it continues, its note, and the metadata and pattern as before', async () => {
    const { deps, store } = makeDeps();
    const first = await saved(saveDesign(input(tiny, { name: 'Border' }), deps));
    const second = await saved(saveDesign(input(wider, { name: 'Border', continues: first, note: 'wider' }), deps));
    const snap = store.snapshot();
    const record = snap.records.find((r) => r.id === second)!;
    expect(record).toMatchObject({ designId: first, note: 'wider', pattern: wider, profileName: 'demo' });
    expect(record.metadata.name).toBe('Border');
    const summaryRow = snap.summaries.find((s) => s.id === second)!;
    expect(summaryRow).toMatchObject({ designId: first, note: 'wider', pickCount: 2 });
    expect('pattern' in summaryRow).toBe(false);
  });
  it('R2.1 continuing a later version keeps the original design id', async () => {
    const { deps } = makeDeps();
    const first = await saved(saveDesign(input(tiny), deps));
    const second = await saved(saveDesign(input(wider, { continues: first }), deps));
    const third = await saved(saveDesign(input(tiny, { continues: second }), deps));
    const got = await getDesign(third, deps);
    expect(got.ok && got.value.designId).toBe(first);
  });
  it('R2.1 a blank note is stored as no note; a note of exactly 200 characters is stored as entered', async () => {
    const { deps } = makeDeps();
    const first = await saved(saveDesign(input(tiny), deps));
    const blank = await saved(saveDesign(input(tiny, { continues: first, note: '   ' }), deps));
    const exact = await saved(saveDesign(input(tiny, { continues: first, note: 'x'.repeat(NOTE_MAX) }), deps));
    const blankGot = await getDesign(blank, deps);
    const exactGot = await getDesign(exact, deps);
    expect(blankGot.ok && 'note' in blankGot.value).toBe(false);
    expect(exactGot.ok && exactGot.value.note).toBe('x'.repeat(NOTE_MAX));
  });
  it('R2.1 a note over 200 characters stores nothing and returns write-failed', async () => {
    const { deps, store } = makeDeps();
    const first = await saved(saveDesign(input(tiny), deps));
    const before = store.snapshot();
    const result = await saveDesign(input(tiny, { continues: first, note: 'x'.repeat(NOTE_MAX + 1) }), deps);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.reason).toBe('write-failed');
      expect(result.failure).toMatchObject({ detail: expect.stringContaining('200') });
    }
    expect(store.snapshot()).toEqual(before);
  });
  it('R7.1 continuing a version that is not stored is not-found and stores nothing', async () => {
    const { deps, store } = makeDeps();
    const result = await saveDesign(input(tiny, { continues: 'gone' }), deps);
    expect(result).toEqual({ ok: false, failure: { reason: 'not-found', id: 'gone' } });
    expect(store.snapshot()).toEqual({ records: [], summaries: [] });
  });
  it('R7.1 an unopenable store is storage-unavailable and a failed write is write-failed, for a version', async () => {
    const { deps, store } = makeDeps();
    const first = await saved(saveDesign(input(tiny), deps));
    const before = store.snapshot();
    store.failOn('open');
    const unavailable = await saveDesign(input(tiny, { continues: first }), deps);
    expect(unavailable.ok === false && unavailable.failure.reason).toBe('storage-unavailable');
    store.clearFailures();
    store.failOn('put-after-staging');
    const writeFailed = await saveDesign(input(tiny, { continues: first }), deps);
    expect(writeFailed.ok === false && writeFailed.failure.reason).toBe('write-failed');
    store.clearFailures();
    expect(store.snapshot()).toEqual(before);
  });
});
describe('deleting within a lineage', () => {
  async function lineOfThree() {
    const { deps } = makeDeps();
    const a = await saved(saveDesign(input(tiny), deps));
    const b = await saved(saveDesign(input(wider, { continues: a }), deps));
    const c = await saved(saveDesign(input(tiny, { continues: b }), deps));
    return { deps, a, b, c };
  }
  async function groups(deps: ArchiveDeps) {
    const listed = await listDesigns(deps);
    if (!listed.ok) throw new Error('list failed');
    return groupDesigns(listed.value);
  }
  it('R5.1 deleting the newest version leaves the older versions as the history, next newest on top', async () => {
    const { deps, a, b, c } = await lineOfThree();
    expect(await deleteDesign(c, deps)).toEqual({ ok: true, value: null });
    const [group, ...rest] = await groups(deps);
    expect(rest).toEqual([]);
    expect(group!.versions.map((v) => v.id)).toEqual([b, a]);
    expect(group!.newest.id).toBe(b);
  });
  it('R4.3 R5.1 deleting the first version keeps the later versions in one design', async () => {
    const { deps, a, b, c } = await lineOfThree();
    await deleteDesign(a, deps);
    const [group, ...rest] = await groups(deps);
    expect(rest).toEqual([]);
    expect(group!.versions.map((v) => v.id)).toEqual([c, b]);
    const kept = await getDesign(c, deps);
    expect(kept.ok && kept.value.pattern).toEqual(tiny);
  });
  it('R5.2 deleting the last version removes the design from the list', async () => {
    const { deps, a, b, c } = await lineOfThree();
    for (const id of [c, b, a]) expect((await deleteDesign(id, deps)).ok).toBe(true);
    expect(await groups(deps)).toEqual([]);
  });
});
describe('an old version 1 archive', () => {
  const legacyRecords = [
    { id: 'old-1', profileName: 'demo', metadata: { ...emptyMetadata, name: 'First' }, createdAt: 10, pattern: tiny },
    { id: 'old-2', profileName: 'demo', metadata: { ...emptyMetadata, name: 'Second' }, createdAt: 20, pattern: wider },
  ];
  const legacySummaries = legacyRecords.map((r) => ({
    id: r.id,
    profileName: r.profileName,
    metadata: r.metadata,
    createdAt: r.createdAt,
    pickCount: r.pattern.length,
  }));
  function openLegacy() {
    const fake = createFakeIndexedDb({ legacy: { designs: legacyRecords, summaries: legacySummaries } });
    let counter = 0;
    let time = 1000;
    const deps: ArchiveDeps = {
      store: openIndexedDbStore(fake.factory),
      now: () => time++,
      newId: () => `new-${++counter}`,
    };
    return { fake, deps };
  }
  it('R6.1 the upgrade to version 2 adds the designId index and rewrites no record or summary', async () => {
    const { fake, deps } = openLegacy();
    expect((await listDesigns(deps)).ok).toBe(true);
    expect(fake.requestedVersions).toEqual([2]);
    expect(fake.indexNames('summaries')).toEqual(['createdAt', 'designId']);
    expect(fake.rows('designs')).toEqual(legacyRecords);
    expect(fake.rows('summaries')).toEqual(legacySummaries);
  });
  it('R6.1 every old record lists as a design with one version, opens with its own pattern, and deletes', async () => {
    const { deps } = openLegacy();
    const listed = await listDesigns(deps);
    expect(listed.ok && listed.value.map((s) => s.id)).toEqual(['old-2', 'old-1']);
    if (!listed.ok) return;
    const groups = groupDesigns(listed.value);
    expect(groups.map((g) => [g.designId, g.versionCount])).toEqual([['old-2', 1], ['old-1', 1]]);
    const opened = await getDesign('old-1', deps);
    expect(opened.ok && opened.value).toEqual(legacyRecords[0]);
    expect(await deleteDesign('old-2', deps)).toEqual({ ok: true, value: null });
    const after = await listDesigns(deps);
    expect(after.ok && after.value.map((s) => s.id)).toEqual(['old-1']);
  });
  it('R2.1 R6.1 a new version can continue an old record, which then has two versions', async () => {
    const { deps } = openLegacy();
    const id = await saved(saveDesign(input(wider, { continues: 'old-1', note: 'after upgrade' }), deps));
    const listed = await listDesigns(deps);
    if (!listed.ok) throw new Error('list failed');
    const group = groupDesigns(listed.value).find((g) => g.designId === 'old-1');
    expect(group?.versions.map((v) => v.id)).toEqual([id, 'old-1']);
  });
  it('R6.1 a new database is created at version 2 with both indexes', async () => {
    const fake = createFakeIndexedDb();
    const deps: ArchiveDeps = { store: openIndexedDbStore(fake.factory), now: () => 1, newId: () => 'x' };
    await listDesigns(deps);
    expect(fake.indexNames('summaries')).toEqual(['createdAt', 'designId']);
  });
});
describe('version history property', () => {
  const patternAny: fc.Arbitrary<Pattern> = profileArbitrary.chain((profile) => patternArbitrary(profile));
  it('R3.2 R4.2 saving versions then listing returns them newest first, and each one restores an equal pattern', async () => {
    // Feature: version-history, Property 1: Lineage listing and restore
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ pattern: patternAny, note: fc.string({ maxLength: NOTE_MAX }), from: fc.nat() }), {
          minLength: 1,
          maxLength: 6,
        }),
        async (versions) => {
          const { deps } = makeDeps();
          const ids: string[] = [];
          for (const [index, version] of versions.entries()) {
            // The first save starts the design; every later one continues an earlier version.
            const continues = index === 0 ? undefined : ids[version.from % ids.length]!;
            ids.push(await saved(saveDesign({ ...input(version.pattern, { note: version.note }), ...(continues === undefined ? {} : { continues }) }, deps)));
          }
          const listed = await listDesigns(deps);
          expect(listed.ok).toBe(true);
          if (!listed.ok) return;
          const groups = groupDesigns(listed.value);
          expect(groups).toHaveLength(1);
          expect(groups[0]!.designId).toBe(ids[0]);
          expect(groups[0]!.versions.map((v) => v.id)).toEqual([...ids].reverse());
          for (const [index, id] of ids.entries()) {
            const restored = await getDesign(id, deps);
            expect(restored.ok && restored.value.pattern).toEqual(versions[index]!.pattern);
          }
        },
      ),
      { seed: 20261120, numRuns: 100 },
    );
  });
});
