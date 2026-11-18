import { parseCardProfile } from '../../codec/index.ts';
import type { ProfileState } from '../types.ts';

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Loads and checks the Card_Profile. Never throws: a rejected fetch gives `fetch-failed`, text that is not
 * JSON gives `not-json`, and JSON that `parseCardProfile` rejects gives `invalid-profile` with the violations.
 */
export async function loadProfile(fetchText: () => Promise<string>): Promise<ProfileState> {
  let text: string;
  try {
    text = await fetchText();
  } catch (error) {
    return { status: 'failed', failure: { reason: 'fetch-failed', detail: describe(error) } };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { status: 'failed', failure: { reason: 'not-json' } };
  }
  const parsed = parseCardProfile(json);
  if (!parsed.ok) {
    return { status: 'failed', failure: { reason: 'invalid-profile', violations: parsed.violations } };
  }
  return { status: 'ready', profile: parsed.value };
}
