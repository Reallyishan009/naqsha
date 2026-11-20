import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { deleteDesign, getDesign, listDesigns, saveDesign } from '../../src/archive/index.ts';
import type { ArchiveDeps, Metadata, SavedDesign } from '../../src/archive/index.ts';
import type { Pattern } from '../../src/codec/index.ts';
import { FakeArchiveStore } from '../support/fakes.ts';
import type { ArchiveFailurePoint } from '../support/fakes.ts';
import { patternArbitrary } from '../support/patterns.ts';
import { profileArbitrary } from '../support/profiles.ts';

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

/** Deps over a fresh fake, with a counter for ids and a settable clock. */
function makeDeps(store = new FakeArchiveStore()) {
  let counter = 0;
  let time = 0;
  const deps: ArchiveDeps = { store, now: () => time, newId: () => `id-${String(++counter).padStart(4, '0')}` };
  return { deps, store, setTime: (t: number) => void (time = t) };
}

const emptyMetadata: Metadata = { name: '', naqshband: '', weaver: '', place: '', date: '', notes: '' };
const tinyPattern: Pattern = [[[true, false], [false, true]]];

describe('archive example tests', () => {
  it('R6.2 R6.3 a saved design stores pattern, profile name, metadata and creation time', async () => {
    const { deps, store, setTime } = makeDeps();
    setTime(1234);
    const metadata = { ...emptyMetadata, name: 'Border', notes: 'two lines\nof notes' };
    const saved = await saveDesign({ pattern: tinyPattern, profileName: 'demo', metadata }, deps);
    expect(saved).toEqual({ ok: true, value: 'id-0001' });
    const snap = store.snapshot();
    expect(snap.records).toEqual([
      { id: 'id-0001', profileName: 'demo', metadata, createdAt: 1234, pattern: tinyPattern },
    ]);
    expect(snap.summaries).toEqual([
      { id: 'id-0001', profileName: 'demo', metadata, createdAt: 1234, pickCount: 1 },
    ]);
  });

  it('R6.1 index.ts exports the four functions and the SavedDesign type; each function returns a promise of a result object and none throws', async () => {
    expect([saveDesign, getDesign, listDesigns, deleteDesign].map((fn) => typeof fn)).toEqual(Array(4).fill('function'));
    // A SavedDesign has exactly these fields. Changed on purpose by version-history: designId and note are
    // two new optional fields, so a version carries seven; a design's first version still carries five.
    const version: SavedDesign = {
      id: 'a',
      profileName: 'demo',
      metadata: emptyMetadata,
      createdAt: 1,
      pattern: tinyPattern,
      designId: 'root',
      note: 'wider border',
    };
    expect(Object.keys(version).sort()).toEqual(['createdAt', 'designId', 'id', 'metadata', 'note', 'pattern', 'profileName']);
    // Every function reports a failed store as a value, not as a throw.
    const { deps, store } = makeDeps();
    store.failOn('open');
    const calls = [
      saveDesign({ pattern: tinyPattern, profileName: 'demo', metadata: emptyMetadata }, deps),
      getDesign('x', deps),
      listDesigns(deps),
      deleteDesign('x', deps),
    ];
    for (const call of calls) expect(call).toBeInstanceOf(Promise);
    const results = await Promise.all(calls);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(typeof result.failure.reason).toBe('string');
    }
    // And a good store gives ok results.
    const good = makeDeps();
    const saved = await saveDesign({ pattern: tinyPattern, profileName: 'demo', metadata: emptyMetadata }, good.deps);
    expect(saved.ok).toBe(true);
  });

  it('R6.4 getDesign returns a pattern equal to the stored one', async () => {
    const { deps } = makeDeps();
    const pattern: Pattern = [
      [[true, false], [false, true]],
      [[false, false], [true, true]],
    ];
    const saved = await saveDesign({ pattern, profileName: 'demo', metadata: emptyMetadata }, deps);
    if (!saved.ok) throw new Error('save failed');
    const got = await getDesign(saved.value, deps);
    expect(got).toMatchObject({ ok: true, value: { id: saved.value } });
    if (got.ok) expect(got.value.pattern).toEqual(pattern);
  });

  it('R6.5 an empty archive lists no designs', async () => {
    expect(await listDesigns(makeDeps().deps)).toEqual({ ok: true, value: [] });
  });

  it('R6.8 a put that fails after staging leaves no record and no summary', async () => {
    const { deps, store } = makeDeps();
    store.failOn('put-after-staging');
    const result = await saveDesign({ pattern: tinyPattern, profileName: 'demo', metadata: emptyMetadata }, deps);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.reason).toBe('write-failed');
    expect(store.snapshot()).toEqual({ records: [], summaries: [] });
  });

  it('R6.8 a failure to open is storage-unavailable for every function', async () => {
    const { deps, store } = makeDeps();
    store.failOn('open');
    const results = [
      await saveDesign({ pattern: tinyPattern, profileName: 'demo', metadata: emptyMetadata }, deps),
      await getDesign('x', deps),
      await listDesigns(deps),
      await deleteDesign('x', deps),
    ];
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.failure.reason).toBe('storage-unavailable');
    }
  });

  it('R6.7 an unknown id is not-found and names the id', async () => {
    const { deps } = makeDeps();
    expect(await getDesign('nope', deps)).toEqual({ ok: false, failure: { reason: 'not-found', id: 'nope' } });
    expect(await deleteDesign('nope', deps)).toEqual({ ok: false, failure: { reason: 'not-found', id: 'nope' } });
  });
});

describe('archive properties', () => {
  it('R6.10 saving then getting a design returns an equal pattern and metadata, the same profile name and creation time', async () => {
    // Feature: app, Property 15: Saving then getting returns the same design
    await fc.assert(
      fc.asyncProperty(designInput, timeArbitrary, async (input, time) => {
        const { deps, setTime } = makeDeps();
        setTime(time);
        const saved = await saveDesign(input, deps);
        expect(saved.ok).toBe(true);
        if (!saved.ok) return;
        const got = await getDesign(saved.value, deps);
        expect(got.ok).toBe(true);
        if (!got.ok) return;
        expect(got.value.id).toBe(saved.value);
        expect(got.value.pattern).toEqual(input.pattern);
        expect(got.value.metadata).toEqual(input.metadata);
        expect(got.value.profileName).toBe(input.profileName);
        expect(got.value.createdAt).toBe(time);
      }),
      { seed: 1501, numRuns: NUM_RUNS },
    );
  });

  it('R6.5 lists are newest first, then by id, and carry no pattern', async () => {
    // Feature: app, Property 16: Lists are newest first and carry no Pattern
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(designInput, fc.integer({ min: 0, max: 5 })), { minLength: 0, maxLength: 8 }),
        async (entries) => {
          const { deps, setTime } = makeDeps();
          const saved: { id: string; time: number; pickCount: number }[] = [];
          for (const [input, time] of entries) {
            setTime(time);
            const result = await saveDesign(input, deps);
            expect(result.ok).toBe(true);
            if (result.ok) saved.push({ id: result.value, time, pickCount: input.pattern.length });
          }
          const listed = await listDesigns(deps);
          expect(listed.ok).toBe(true);
          if (!listed.ok) return;
          const expected = [...saved].sort((a, b) => b.time - a.time || (a.id < b.id ? -1 : 1));
          expect(listed.value.map((s) => s.id)).toEqual(expected.map((s) => s.id));
          expect(listed.value.map((s) => s.pickCount)).toEqual(expected.map((s) => s.pickCount));
          for (const summary of listed.value) expect('pattern' in summary).toBe(false);
        },
      ),
      { seed: 1601, numRuns: NUM_RUNS },
    );
  });

  it('R6.6 and R6.7 delete removes exactly one design and unknown ids are not-found', async () => {
    // Feature: app, Property 17: Delete removes exactly one design, unknown ids are not found
    await fc.assert(
      fc.asyncProperty(
        fc.array(designInput, { minLength: 1, maxLength: 6 }),
        fc.nat(),
        async (inputs, pick) => {
          const { deps } = makeDeps();
          const ids: string[] = [];
          for (const input of inputs) {
            const result = await saveDesign(input, deps);
            expect(result.ok).toBe(true);
            if (result.ok) ids.push(result.value);
          }
          const target = ids[pick % ids.length]!;
          const deleted = await deleteDesign(target, deps);
          expect(deleted).toEqual({ ok: true, value: null });
          expect(await getDesign(target, deps)).toEqual({ ok: false, failure: { reason: 'not-found', id: target } });
          expect(await deleteDesign(target, deps)).toEqual({ ok: false, failure: { reason: 'not-found', id: target } });
          for (const [index, id] of ids.entries()) {
            if (id === target) continue;
            const got = await getDesign(id, deps);
            expect(got.ok && got.value.pattern).toEqual(inputs[index]!.pattern);
          }
          const listed = await listDesigns(deps);
          expect(listed.ok && listed.value.length).toBe(ids.length - 1);
          expect(await getDesign('unknown-id', deps)).toEqual({ ok: false, failure: { reason: 'not-found', id: 'unknown-id' } });
          expect(await deleteDesign('unknown-id', deps)).toEqual({ ok: false, failure: { reason: 'not-found', id: 'unknown-id' } });
        },
      ),
      { seed: 1701, numRuns: NUM_RUNS },
    );
  });

  it('R6.8 an injected failure gives storage-unavailable or write-failed, does not throw and leaves the store unchanged', async () => {
    // Feature: app, Property 18: A failed write leaves no partial record
    const points = fc.constantFrom<ArchiveFailurePoint>('open', 'put', 'put-after-staging', 'remove', 'get', 'list');
    await fc.assert(
      fc.asyncProperty(
        fc.array(designInput, { minLength: 0, maxLength: 3 }),
        designInput,
        points,
        async (existing, extra, point) => {
          const { deps, store } = makeDeps();
          const ids: string[] = [];
          for (const input of existing) {
            const result = await saveDesign(input, deps);
            if (result.ok) ids.push(result.value);
          }
          store.failOn(point);
          const target = ids[0] ?? 'x';
          const operations = [
            () => saveDesign(extra, deps),
            () => getDesign(target, deps),
            () => listDesigns(deps),
            () => deleteDesign(target, deps),
          ];
          const results = [];
          for (const operation of operations) {
            const before = store.snapshot();
            const result = await operation();
            results.push(result);
            // A call that failed leaves the store as it was. A call the injected point does not touch may succeed.
            if (!result.ok) expect(store.snapshot()).toEqual(before);
          }
          // not-found is the right answer for a get or delete of an id the store does not hold (empty store).
          for (const [index, result] of results.entries()) {
            if (result.ok) continue;
            const allowed = ids.length === 0 && (index === 1 || index === 3)
              ? ['storage-unavailable', 'write-failed', 'not-found']
              : ['storage-unavailable', 'write-failed'];
            expect(allowed).toContain(result.failure.reason);
          }
          // The write-type points must fail the function that uses them.
          if (point === 'put' || point === 'put-after-staging') {
            expect(results[0]!.ok).toBe(false);
            if (!results[0]!.ok) expect(results[0]!.failure.reason).toBe('write-failed');
          }
          if (point === 'remove') {
            expect(results[3]!.ok).toBe(false);
            if (!results[3]!.ok) expect(results[3]!.failure.reason).toBe('write-failed');
          }
          if (point === 'open') {
            for (const result of results) {
              expect(result.ok).toBe(false);
              if (!result.ok) expect(result.failure.reason).toBe('storage-unavailable');
            }
          }
        },
      ),
      { seed: 1801, numRuns: NUM_RUNS },
    );
  });
});
