import { readFileSync } from 'node:fs';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { GroundTruth } from '../../scripts/make_fixtures.ts';
import type { CardGrid } from '../../src/codec/index.ts';
import { loadPixelData } from '../../src/reader/index.ts';
import type { ImageSource, PixelData, ReadFailure as CardReadFailure } from '../../src/reader/index.ts';
import { DICTIONARIES, readFailureKey, translator } from '../../src/ui/i18n/messages.ts';
import { appReducer, initialAppState } from '../../src/ui/state/appState.ts';
import { hookMarkers } from '../../src/ui/state/corrections.ts';
import { readPhoto } from '../../src/ui/state/scan.ts';
import type { LoadPixels } from '../../src/ui/state/scan.ts';
import type { AppState, Language } from '../../src/ui/types.ts';
import { decodePng } from '../support/png.ts';
import { demoProfile } from '../support/profiles.ts';

const SEED = 20240614;
const NUM_RUNS = 100;
const LANGUAGES: Language[] = ['hi', 'en'];
const CONDITIONS = ['pick0-clean', 'pick0-noisy', 'pick0-tilted', 'pick0-noisy-tilted'] as const;

/** A fake canvas: hands back the pixels it was given, so `loadPixelData` runs its real code on them. */
function fakeLoadPixels(decode: (bytes: Uint8Array) => PixelData): LoadPixels {
  return async (file) => {
    const pixels = decode(new Uint8Array(await file.arrayBuffer()));
    const fakeImage = { naturalWidth: pixels.width, naturalHeight: pixels.height };
    const createCanvas = () => ({
      getContext: () => ({
        drawImage: () => undefined,
        getImageData: () => ({ width: pixels.width, height: pixels.height, data: pixels.data }),
      }),
    });
    return loadPixelData(fakeImage as unknown as ImageSource, createCanvas);
  };
}

const loadFixturePixels = fakeLoadPixels((bytes) => decodePng(bytes));

function fixtureFile(name: string): Blob {
  return new Blob([new Uint8Array(readFileSync(`tests/fixtures/${name}.png`))], { type: 'image/png' });
}
function groundTruth(name: string): GroundTruth {
  return JSON.parse(readFileSync(`tests/fixtures/${name}.json`, 'utf8')) as GroundTruth;
}
/** A blank white greyscale "photo" as PNG-less pixel data: the decode function ignores the bytes. */
function blankPixels(width: number, height: number): PixelData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
}
const blankFile = new Blob([new Uint8Array([0])]);

describe('scan screen read path on the synthetic fixtures', () => {
  for (const name of CONDITIONS) {
    it(`R8.1 R8.2 R8.3 R17.5 R17.6 ${name}: the screen's read equals the ground-truth card and the markers match it`, async () => {
      const truth = groundTruth(name);
      const outcome = await readPhoto(demoProfile(), fixtureFile(name), loadFixturePixels);
      expect(outcome.kind).toBe('read');
      if (outcome.kind !== 'read') return;
      expect(outcome.grid).toEqual(truth.card);
      const markers = hookMarkers(demoProfile(), outcome.pose, outcome.grid, []);
      expect(markers).toHaveLength(truth.hookRows * truth.hookColumns);
      for (const marker of markers) {
        expect(marker.shape).toBe(truth.card[marker.hookRow]![marker.hookColumn] ? 'filled' : 'ring');
        expect(marker.corrected).toBe(false);
        expect(marker.centrePx.x).toBeGreaterThanOrEqual(0);
        expect(marker.centrePx.x).toBeLessThanOrEqual(outcome.image.width);
        expect(marker.centrePx.y).toBeGreaterThanOrEqual(0);
        expect(marker.centrePx.y).toBeLessThanOrEqual(outcome.image.height);
      }
    });
  }
});

describe('scan screen failure path', () => {
  const batchCard: CardGrid = [[true, false]];
  const startState: AppState = {
    ...initialAppState,
    screen: 'scan',
    batch: [batchCard, batchCard],
    current: { pattern: [batchCard], origin: { kind: 'scanned', saved: true } },
  };

  it('R9.2 R9.8 a blank photo gives the peg-holes-not-found message in both languages', async () => {
    const outcome = await readPhoto(
      demoProfile(),
      blankFile,
      fakeLoadPixels(() => blankPixels(400, 300)),
    );
    expect(outcome).toEqual({ kind: 'failed', failure: { reason: 'peg-holes-not-found' } });
    if (outcome.kind !== 'failed') return;
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const text = t(readFailureKey(outcome.failure));
      expect(text).not.toBe('error.read.peg-holes-not-found');
      expect(text.length).toBeGreaterThan(20);
    }
    expect(translator(DICTIONARIES, 'en')(readFailureKey(outcome.failure))).toMatch(/alignment holes/);
  });

  it('R9.2 R9.8 a one-pixel photo gives a read failure with a message in both languages', async () => {
    const outcome = await readPhoto(
      demoProfile(),
      blankFile,
      fakeLoadPixels(() => blankPixels(1, 1)),
    );
    expect(outcome.kind).toBe('failed');
    if (outcome.kind !== 'failed') return;
    for (const language of LANGUAGES) {
      const text = translator(DICTIONARIES, language)(readFailureKey(outcome.failure));
      expect(text).not.toBe(`error.read.${outcome.failure.reason}`);
    }
  });

  it('R9.3 a file that cannot be decoded gives invalid-image and does not throw', async () => {
    const outcome = await readPhoto(demoProfile(), blankFile, () => Promise.reject(new Error('not an image')));
    expect(outcome).toEqual({ kind: 'failed', failure: { reason: 'invalid-image', detail: 'not an image' } });
  });

  it('R9.7 an invalid card profile gives invalid-profile with the violation locations', async () => {
    const outcome = await readPhoto(
      { ...demoProfile(), hookRows: -1 } as never,
      blankFile,
      fakeLoadPixels(() => blankPixels(50, 50)),
    );
    expect(outcome.kind).toBe('failed');
    if (outcome.kind !== 'failed' || outcome.failure.reason !== 'invalid-profile') throw new Error('expected invalid-profile');
    expect(outcome.failure.violations.map((violation) => violation.location)).toContain('hookRows');
  });

  it('R9.1 R11.10 a failed read leaves the batch and the current pattern unchanged and announces the message', async () => {
    const outcome = await readPhoto(
      demoProfile(),
      blankFile,
      fakeLoadPixels(() => blankPixels(400, 300)),
    );
    if (outcome.kind !== 'failed') throw new Error('expected a failure');
    const next = appReducer(startState, { type: 'read-failed', failure: outcome.failure });
    expect(next.batch).toBe(startState.batch);
    expect(next.current).toBe(startState.current);
    expect(next.announcement?.kind).toBe('error');
    expect(next.announcement?.messageKey).toBe(readFailureKey(outcome.failure));
  });

  it('R9.1 R9.8 every kind of read failure leaves the batch and current pattern unchanged and has a message in both languages', () => {
    // Feature: app, Property 23: A failed read leaves the Scan_Batch unchanged
    const failures: fc.Arbitrary<CardReadFailure> = fc.oneof(
      fc.constant<CardReadFailure>({ reason: 'peg-holes-not-found' }),
      fc.constant<CardReadFailure>({ reason: 'card-outside-image' }),
      fc.string().map<CardReadFailure>((detail) => ({ reason: 'invalid-image', detail })),
      fc.double({ min: 0, max: 1, noNaN: true }).map<CardReadFailure>((separation) => ({ reason: 'ambiguous-orientation', separation })),
      fc
        .double({ min: 0, max: 10, noNaN: true })
        .map<CardReadFailure>((holeDiameterPx) => ({ reason: 'resolution-too-low', holeDiameterPx, minimumPx: 11 })),
      fc.constant<CardReadFailure>({ reason: 'invalid-profile', violations: [] }),
    );
    fc.assert(
      fc.property(failures, (failure) => {
        const next = appReducer(startState, { type: 'read-failed', failure });
        expect(next.batch).toBe(startState.batch);
        expect(next.current).toBe(startState.current);
        for (const language of LANGUAGES) {
          const text = translator(DICTIONARIES, language)(readFailureKey(failure));
          expect(text).not.toBe(`error.read.${failure.reason}`);
        }
      }),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });
});
