import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { ArchiveFailure } from '../../../src/archive/index.ts';
import type { Violation } from '../../../src/codec/index.ts';
import type { ExportFailure, ReadFailure as BmpReadFailure } from '../../../src/exporter/index.ts';
import type { ReadFailure as CardReadFailure } from '../../../src/reader/index.ts';
import type { SimFailure } from '../../../src/simulator/index.ts';
import {
  EN,
  HI,
  archiveFailureKey,
  bmpReadFailureKey,
  exportFailureKey,
  printFailureKey,
  profileFailureKey,
  readFailureKey,
  simFailureKey,
} from '../../../src/ui/i18n/messages.ts';
import type { PrintFailure, ProfileFailure } from '../../../src/ui/index.ts';

const violation: fc.Arbitrary<Violation> = fc.record({
  kind: fc.constantFrom('missing-field', 'hole-outside-card', 'wrong-hook-row-count', 'not-a-boolean'),
  location: fc.string(),
  message: fc.string(),
});
const violations = fc.array(violation, { maxLength: 3 });

const simFailure: fc.Arbitrary<SimFailure> = fc.oneof(
  violations.map((v): SimFailure => ({ reason: 'invalid-profile', violations: v })),
  fc.record({ reason: fc.constant('invalid-settings' as const), setting: fc.string(), message: fc.string() }),
  fc.record({ reason: fc.constant('pick-out-of-range' as const), pick: fc.anything(), pickCount: fc.nat() }),
);
const profileFailure: fc.Arbitrary<ProfileFailure> = fc.oneof(
  fc.record({ reason: fc.constant('fetch-failed' as const), detail: fc.string() }),
  fc.constant<ProfileFailure>({ reason: 'not-json' }),
  violations.map((v): ProfileFailure => ({ reason: 'invalid-profile', violations: v })),
);
const printFailure: fc.Arbitrary<PrintFailure> = violations.map((v) => ({ reason: 'invalid-card' as const, violations: v }));

const exportFailure: fc.Arbitrary<ExportFailure> = fc.oneof(
  violations.map((v): ExportFailure => ({ reason: 'invalid-profile', violations: v })),
  fc.array(fc.record({ pick: fc.nat(), violations }), { maxLength: 3 }).map((picks): ExportFailure => ({ reason: 'invalid-card', picks })),
  fc.constant<ExportFailure>({ reason: 'empty-pattern' }),
  fc.record({ reason: fc.constant('invalid-options' as const), option: fc.string(), message: fc.string() }),
);
const bmpReadFailure: fc.Arbitrary<BmpReadFailure> = fc.oneof(
  violations.map((v): BmpReadFailure => ({ reason: 'invalid-profile', violations: v })),
  fc.record({ reason: fc.constant('invalid-options' as const), option: fc.string(), message: fc.string() }),
  fc.constant<BmpReadFailure>({ reason: 'not-a-bmp' }),
  fc.record({ reason: fc.constant('unsupported-bmp' as const), field: fc.string(), value: fc.integer() }),
  fc.record({ reason: fc.constant('inconsistent-size' as const), field: fc.string(), expected: fc.nat(), actual: fc.nat() }),
  fc.record({ reason: fc.constant('width-mismatch' as const), fileWidth: fc.nat(), profileWidth: fc.nat() }),
  fc.record({ reason: fc.constant('unknown-colour' as const), pick: fc.nat(), end: fc.nat() }),
);
const archiveFailure: fc.Arbitrary<ArchiveFailure> = fc.oneof(
  fc.record({ reason: fc.constant('not-found' as const), id: fc.string() }),
  fc.record({ reason: fc.constant('storage-unavailable' as const), detail: fc.string() }),
  fc.record({ reason: fc.constant('write-failed' as const), detail: fc.string() }),
);

const readFailure: fc.Arbitrary<CardReadFailure> = fc.oneof(
  violations.map((v): CardReadFailure => ({ reason: 'invalid-profile', violations: v })),
  fc.record({ reason: fc.constant('invalid-image' as const), detail: fc.string() }),
  fc.constant<CardReadFailure>({ reason: 'peg-holes-not-found' }),
  fc.record({ reason: fc.constant('ambiguous-orientation' as const), separation: fc.double({ noNaN: true }) }),
  fc.record({ reason: fc.constant('resolution-too-low' as const), holeDiameterPx: fc.double({ noNaN: true }), minimumPx: fc.double({ noNaN: true }) }),
  fc.constant<CardReadFailure>({ reason: 'card-outside-image' }),
);

function expectMessage(key: string, reason: string): void {
  expect(key).not.toBe(reason);
  expect(Object.hasOwn(EN, key), `en ${key}`).toBe(true);
  expect(Object.hasOwn(HI, key), `hi ${key}`).toBe(true);
  expect(EN[key]!.length).toBeGreaterThan(0);
  expect(HI[key]!.text.length).toBeGreaterThan(0);
}

describe('failure messages (Phase 1 failure types)', () => {
  const options = { numRuns: 200, seed: 2802 };

  it('R2.12 every SimFailure reason has a message in both languages', () => {
    // Feature: app, Property 6: Every failure has a message in both languages
    fc.assert(fc.property(simFailure, (failure) => expectMessage(simFailureKey(failure), failure.reason)), options);
  });

  it('R1.7 every ProfileFailure reason has a message in both languages', () => {
    // Feature: app, Property 6: Every failure has a message in both languages
    fc.assert(fc.property(profileFailure, (failure) => expectMessage(profileFailureKey(failure), failure.reason)), options);
  });

  it('R21.17 every printable-card failure has a message in both languages', () => {
    // Feature: app, Property 6: Every failure has a message in both languages
    fc.assert(fc.property(printFailure, (failure) => expectMessage(printFailureKey(failure), failure.reason)), options);
  });

  it('R5.7 every ExportFailure reason has a message in both languages', () => {
    // Feature: app, Property 6: Every failure has a message in both languages
    fc.assert(fc.property(exportFailure, (failure) => expectMessage(exportFailureKey(failure), failure.reason)), options);
  });

  it('R5.8 every BMP ReadFailure reason has a message in both languages', () => {
    // Feature: app, Property 6: Every failure has a message in both languages
    fc.assert(fc.property(bmpReadFailure, (failure) => expectMessage(bmpReadFailureKey(failure), failure.reason)), options);
  });

  it('R7.4 every ArchiveFailure reason has a message in both languages', () => {
    // Feature: app, Property 6: Every failure has a message in both languages
    fc.assert(fc.property(archiveFailure, (failure) => expectMessage(archiveFailureKey(failure), failure.reason)), options);
  });

  it('R9.8 every reader ReadFailure kind has a message in both languages, under error.read.<reason>', () => {
    // Feature: app, Property 6: Every failure has a message in both languages
    fc.assert(
      fc.property(readFailure, (failure) => {
        expectMessage(readFailureKey(failure), failure.reason);
        expect(readFailureKey(failure)).toBe(`error.read.${failure.reason}`);
      }),
      options,
    );
  });

  it('R9.2 to R9.6 read failure texts state the cause and the next step in both languages', () => {
    const text = (reason: CardReadFailure['reason'], hi: boolean): string => {
      const key = `error.read.${reason}`;
      return hi ? HI[key]!.text : EN[key]!;
    };
    expect(text('peg-holes-not-found', false)).toMatch(/alignment holes were not found.*whole card.*plain background/i);
    expect(text('ambiguous-orientation', false)).toMatch(/direction.*could not be decided.*again.*flat.*evenly/i);
    expect(text('resolution-too-low', false)).toMatch(/too small.*closer.*larger photo/i);
    expect(text('card-outside-image', false)).toMatch(/outside the photo.*back/i);
    expect(text('invalid-image', false)).toMatch(/could not be used as an image.*try again/i);
    expect(EN['error.read.invalid-profile']).toMatch(/not valid.*details/i);
    for (const reason of ['peg-holes-not-found', 'ambiguous-orientation', 'resolution-too-low', 'card-outside-image', 'invalid-image'] as const) {
      expect(text(reason, true)).toMatch(/\p{Script=Devanagari}/u);
      expect(text(reason, true)).toContain('फिर');
      expect(text(reason, true)).not.toContain(reason);
    }
  });

  it('R2.12 the message says what to do next, in both languages', () => {
    expect(EN[simFailureKey({ reason: 'invalid-settings', setting: 'x', message: 'y' })]).toMatch(/try again/i);
    expect(HI[simFailureKey({ reason: 'invalid-settings', setting: 'x', message: 'y' })]!.text.length).toBeGreaterThan(10);
  });
});
