import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { profileNotice } from '../../../src/ui/profile/notice.ts';
import { cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';

const SEED = 20240612;
const NUM_RUNS = 300;

/** Status text that may be absent, random, contain UNVERIFIED anywhere, or only look like it. */
const statusArbitrary: fc.Arbitrary<string | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.string(),
  fc.string({ unit: 'grapheme' }),
  fc.tuple(fc.string(), fc.string()).map(([before, after]) => `${before}UNVERIFIED${after}`),
  fc.tuple(fc.string(), fc.string()).map(([before, after]) => `${before}unverified${after}`),
  fc.tuple(fc.string(), fc.string()).map(([before, after]) => `${before}Unverified${after}`),
  fc.tuple(fc.string(), fc.string()).map(([before, after]) => `${before}UNVERIF IED${after}`),
  fc.tuple(fc.string(), fc.string(), fc.constantFrom('X', 'a', '_', '1')).map(
    ([before, after, glue]) => `${before}${glue}UNVERIFIED${glue}${after}`,
  ),
);

describe('profileNotice', () => {
  it('R22.13 the notice is shown if and only if the status contains UNVERIFIED, with the status text unchanged', () => {
    fc.assert(
      fc.property(cardProfileArbitrary, statusArbitrary, (base, status) => {
        const profile = status === undefined ? base : { ...base, status };
        const notice = profileNotice(profile);
        const contains = status !== undefined && /UNVERIFIED/.test(status);
        expect(notice !== null).toBe(contains);
        if (notice !== null) {
          expect(notice.statusText).toBe(status);
          expect(notice.name).toBe(profile.name);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R22.5 the demo profile gives a notice with the status text unchanged', () => {
    const profile = demoProfile();
    expect(profile.status).toContain('UNVERIFIED');
    expect(profileNotice(profile)).toEqual({ name: profile.name, statusText: profile.status });
  });

  it('R22.8 a profile with no status gives no notice', () => {
    const { status: _status, ...withoutStatus } = demoProfile();
    expect(profileNotice(withoutStatus)).toBeNull();
  });

  it('R22.3 lower-case, mixed-case and split spellings give no notice; UNVERIFIED inside another word does', () => {
    const base = demoProfile();
    expect(profileNotice({ ...base, status: 'unverified' })).toBeNull();
    expect(profileNotice({ ...base, status: 'Unverified' })).toBeNull();
    expect(profileNotice({ ...base, status: 'UN VERIFIED' })).toBeNull();
    expect(profileNotice({ ...base, status: '' })).toBeNull();
    expect(profileNotice({ ...base, status: 'NOTUNVERIFIEDYET' })?.statusText).toBe('NOTUNVERIFIEDYET');
  });
});
