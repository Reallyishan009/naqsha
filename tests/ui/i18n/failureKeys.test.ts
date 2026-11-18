import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Violation } from '../../../src/codec/index.ts';
import type { SimFailure } from '../../../src/simulator/index.ts';
import { EN, HI, printFailureKey, profileFailureKey, simFailureKey } from '../../../src/ui/i18n/messages.ts';
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

  it('R2.12 the message says what to do next, in both languages', () => {
    expect(EN[simFailureKey({ reason: 'invalid-settings', setting: 'x', message: 'y' })]).toMatch(/try again/i);
    expect(HI[simFailureKey({ reason: 'invalid-settings', setting: 'x', message: 'y' })]!.text.length).toBeGreaterThan(10);
  });
});
