import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseCardProfile } from '../../../src/codec/index.ts';
import { loadProfile } from '../../../src/ui/profile/loadProfile.ts';
import { profileUrl } from '../../../src/ui/profile/profileUrl.ts';
import { cardProfileArbitrary, demoProfile, mutateProfile } from '../../support/profiles.ts';

const SEED = 20240513;
const NUM_RUNS = 100;

describe('loadProfile', () => {
  it('R1.6 a valid profile text gives ready with that profile', async () => {
    const profile = demoProfile();
    const state = await loadProfile(async () => JSON.stringify(profile));
    expect(state).toEqual({ status: 'ready', profile });
  });

  it('R1.7 a rejected fetch gives fetch-failed with the error message', async () => {
    const state = await loadProfile(() => Promise.reject(new Error('offline')));
    expect(state).toEqual({ status: 'failed', failure: { reason: 'fetch-failed', detail: 'offline' } });
  });

  it('R1.7 text that is not JSON gives not-json', async () => {
    const state = await loadProfile(async () => '<html>');
    expect(state).toEqual({ status: 'failed', failure: { reason: 'not-json' } });
  });

  it('R1.7 a profile with a missing field gives invalid-profile with violations', async () => {
    const broken = mutateProfile(demoProfile(), ['hookRows'], undefined);
    const state = await loadProfile(async () => JSON.stringify(broken));
    expect(state.status).toBe('failed');
    if (state.status === 'failed') {
      expect(state.failure.reason).toBe('invalid-profile');
    }
  });

  it('R23.3 the profile URL is relative to the base path', () => {
    expect(profileUrl()).toBe(`${import.meta.env.BASE_URL}profiles/demo-12x16.json`);
  });
});

describe('loadProfile properties', () => {
  it('R1.7 every fetch outcome maps to ready or the matching failure', async () => {
    // Feature: app, Property 2: Profile loading maps every outcome to a state
    const outcome = fc.oneof(
      fc.json().map((text) => ({ kind: 'text' as const, text })),
      fc.string().map((text) => ({ kind: 'text' as const, text })),
      fc.jsonValue().map((value) => ({ kind: 'text' as const, text: JSON.stringify(value) })),
      cardProfileArbitrary.map((profile) => ({ kind: 'text' as const, text: JSON.stringify(profile) })),
      fc.string().map((message) => ({ kind: 'reject' as const, message })),
    );
    await fc.assert(
      fc.asyncProperty(outcome, async (item) => {
        const state = await loadProfile(() =>
          item.kind === 'text' ? Promise.resolve(item.text) : Promise.reject(new Error(item.message)),
        );
        if (item.kind === 'reject') {
          expect(state).toEqual({ status: 'failed', failure: { reason: 'fetch-failed', detail: item.message } });
          return;
        }
        let json: unknown;
        try {
          json = JSON.parse(item.text);
        } catch {
          expect(state).toEqual({ status: 'failed', failure: { reason: 'not-json' } });
          return;
        }
        const parsed = parseCardProfile(json);
        if (parsed.ok) {
          expect(state).toEqual({ status: 'ready', profile: parsed.value });
        } else {
          expect(state).toEqual({
            status: 'failed',
            failure: { reason: 'invalid-profile', violations: parsed.violations },
          });
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R1.6 every generated valid profile loads as ready', async () => {
    // Feature: app, Property 2: Profile loading maps every outcome to a state
    await fc.assert(
      fc.asyncProperty(cardProfileArbitrary, async (profile) => {
        const state = await loadProfile(async () => JSON.stringify(profile));
        expect(state.status).toBe('ready');
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
