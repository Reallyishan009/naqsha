import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { deleteDesign, getDesign, listDesigns, saveDesign } from '../../src/archive/index.ts';
import type { ArchiveDeps, Metadata } from '../../src/archive/index.ts';
import { openIndexedDbStore } from '../../src/archive/idbStore.ts';
import type { Pattern } from '../../src/codec/index.ts';
import { createFakeIndexedDb } from '../support/fakeIndexedDb.ts';
import type { FakeIdbOptions } from '../support/fakeIndexedDb.ts';
import { patternArbitrary } from '../support/patterns.ts';
import { profileArbitrary } from '../support/profiles.ts';

// These tests run the real src/archive/idbStore.ts over an in-memory IDBFactory (tests/support/fakeIndexedDb.ts).
// They do not prove that a browser's IndexedDB accepts the same calls; that is a manual check.

const NUM_RUNS = 100;
const metadataArbitrary: fc.Arbitrary<Metadata> = fc.record({
  name: fc.string(),
  naqshband: fc.string(),
  weaver: fc.string(),
  place: fc.string(),
  date: fc.string(),
  notes: fc.string(),
});
const patternAny: fc.Arbitrary<Pattern> = profileArbitrary.chain((profile) => patternArbitrary(profile));
const designInput = fc.record({ pattern: patternAny, profileName: fc.string(), metadata: metadataArbitrary });
const timeArbitrary = fc.integer({ min: 0, max: 1_000_000 });

function makeIdbDeps(options: FakeIdbOptions = {}) {
  const fake = createFakeIndexedDb(options);
  let counter = 0;
  let time = 0;
  const deps: ArchiveDeps = {
    store: openIndexedDbStore(fake.factory),
    now: () => time,
    newId: () => `id-${String(++counter).padStart(4, '0')}`,
  };
  return { fake, deps, setTime: (t: number) => void (time = t) };
}

const tiny: Pattern = [[[true, false], [false, true]]];
const input = { pattern: tiny, profileName: 'p', metadata: { name: 'n', naqshband: '', weaver: '', place: '', date: '', notes: '' } };

describe('archive over a fake IndexedDB: examples', () => {
  it('R6.11 the database has the stores designs and summaries, with createdAt and designId indexes on summaries, at version 2', async () => {
    const { fake, deps } = makeIdbDeps();
    expect((await listDesigns(deps)).ok).toBe(true);
    expect(fake.storeNames().sort()).toEqual(['designs', 'summaries']);
    expect(fake.indexNames('summaries')).toEqual(['createdAt', 'designId']);
    expect(fake.indexNames('designs')).toEqual([]);
    expect(fake.requestedVersions).toEqual([2]);
  });

  it('R6.8 saving uses one readwrite transaction over both stores', async () => {
    const { fake, deps } = makeIdbDeps();
    await saveDesign(input, deps);
    expect(fake.transactions).toEqual([
      { mode: 'readwrite', storeNames: ['designs', 'summaries'], outcome: 'complete' },
    ]);
  });

  it('R6.8 deleting uses one readwrite transaction over both stores', async () => {
    const { fake, deps } = makeIdbDeps();
    const saved = await saveDesign(input, deps);
    if (!saved.ok) throw new Error('save failed');
    fake.transactions.length = 0;
    expect((await deleteDesign(saved.value, deps)).ok).toBe(true);
    expect(fake.transactions).toEqual([
      { mode: 'readwrite', storeNames: ['designs', 'summaries'], outcome: 'complete' },
    ]);
  });

  it('R6.8 a failed write to summaries rolls back the write to designs', async () => {
    const { fake, deps } = makeIdbDeps({ failWrite: (store) => store === 'summaries' });
    const result = await saveDesign(input, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('write-failed');
    expect(fake.rows('designs')).toEqual([]);
    expect(fake.rows('summaries')).toEqual([]);
    expect(fake.transactions.map((t) => t.outcome)).toEqual(['abort']);
  });

  it('R6.9 a missing indexedDB gives storage-unavailable for every function', async () => {
    const deps: ArchiveDeps = { store: openIndexedDbStore(undefined), now: () => 0, newId: () => 'x' };
    const results = [
      await saveDesign(input, deps),
      await getDesign('x', deps),
      await listDesigns(deps),
      await deleteDesign('x', deps),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.reason).toBe('storage-unavailable');
    }
  });

  it('R6.9 an open that fails gives storage-unavailable for every function', async () => {
    const { deps } = makeIdbDeps({ openError: new Error('blocked by browser settings') });
    const results = [
      await saveDesign(input, deps),
      await getDesign('x', deps),
      await listDesigns(deps),
      await deleteDesign('x', deps),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failure.reason).toBe('storage-unavailable');
        expect(result.failure).toMatchObject({ detail: 'blocked by browser settings' });
      }
    }
  });

  it('R6.9 the database is opened once for many calls, and again after a failed open', async () => {
    const { fake, deps } = makeIdbDeps();
    await saveDesign(input, deps);
    await listDesigns(deps);
    await getDesign('id-0001', deps);
    expect(fake.opens).toBe(1);
    const failing = makeIdbDeps({ openError: new Error('no') });
    await listDesigns(failing.deps);
    await listDesigns(failing.deps);
    expect(failing.fake.opens).toBe(2);
  });

  it('R6.7 an unknown id is not-found for get and delete', async () => {
    const { deps } = makeIdbDeps();
    for (const result of [await getDesign('nope', deps), await deleteDesign('nope', deps)]) {
      expect(result).toEqual({ ok: false, failure: { reason: 'not-found', id: 'nope' } });
    }
  });
});

describe('archive over a fake IndexedDB: properties', () => {
  it('R6.10 a saved design round-trips through IndexedDB: get returns it, the list is newest first, delete removes exactly it', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(designInput, timeArbitrary), { minLength: 1, maxLength: 4 }),
        fc.nat(),
        async (entries, pick) => {
          const { fake, deps, setTime } = makeIdbDeps();
          const ids: string[] = [];
          for (const [design, time] of entries) {
            setTime(time);
            const saved = await saveDesign(design, deps);
            expect(saved.ok).toBe(true);
            if (saved.ok) ids.push(saved.value);
          }
          expect(ids.length).toBe(entries.length);
          for (const [index, id] of ids.entries()) {
            const [design, time] = entries[index]!;
            const got = await getDesign(id, deps);
            expect(got).toEqual({
              ok: true,
              value: {
                id,
                profileName: design.profileName,
                metadata: design.metadata,
                createdAt: time,
                pattern: design.pattern,
              },
            });
          }
          const listed = await listDesigns(deps);
          expect(listed.ok).toBe(true);
          if (!listed.ok) return;
          const expectedOrder = ids
            .map((id, index) => ({ id, createdAt: entries[index]![1] }))
            .sort((a, b) => (a.createdAt !== b.createdAt ? b.createdAt - a.createdAt : a.id < b.id ? -1 : 1))
            .map((entry) => entry.id);
          expect(listed.value.map((summary) => summary.id)).toEqual(expectedOrder);
          for (const summary of listed.value) {
            expect(Object.keys(summary)).not.toContain('pattern');
            const index = ids.indexOf(summary.id);
            expect(summary.pickCount).toBe(entries[index]![0].pattern.length);
          }
          const victim = ids[pick % ids.length]!;
          expect((await deleteDesign(victim, deps)).ok).toBe(true);
          expect((await getDesign(victim, deps)).ok).toBe(false);
          const remaining = await listDesigns(deps);
          expect(remaining.ok && remaining.value.map((s) => s.id)).toEqual(expectedOrder.filter((id) => id !== victim));
          expect(fake.rows('designs').length).toBe(ids.length - 1);
          expect(fake.rows('summaries').length).toBe(ids.length - 1);
        },
      ),
      { seed: 2201, numRuns: NUM_RUNS },
    );
  });

  it('R6.8 a write that fails in either store leaves both stores as they were', async () => {
    await fc.assert(
      fc.asyncProperty(
        designInput,
        designInput,
        fc.constantFrom('designs', 'summaries'),
        fc.constantFrom('save', 'delete'),
        async (first, second, failingStore, operation) => {
          let armed = false;
          const { fake, deps } = makeIdbDeps({ failWrite: (store) => armed && store === failingStore });
          const saved = await saveDesign(first, deps);
          expect(saved.ok).toBe(true);
          if (!saved.ok) return;
          const before = { designs: fake.rows('designs'), summaries: fake.rows('summaries') };
          armed = true;
          const result = operation === 'save' ? await saveDesign(second, deps) : await deleteDesign(saved.value, deps);
          expect(result.ok).toBe(false);
          if (!result.ok) expect(result.failure.reason).toBe('write-failed');
          expect({ designs: fake.rows('designs'), summaries: fake.rows('summaries') }).toEqual(before);
        },
      ),
      { seed: 2202, numRuns: NUM_RUNS },
    );
  });
});
