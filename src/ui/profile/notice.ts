import type { CardProfile } from '../../codec/index.ts';
import type { ProfileNotice } from '../types.ts';

/** The word that marks a Profile_Status as unverified (R22.9). The match is case-sensitive and plain substring. */
export const UNVERIFIED_WORD = 'UNVERIFIED';

/**
 * A notice exactly when the profile status contains UNVERIFIED, with the status text unchanged (R22.3, R22.5,
 * R22.8, R22.13). A profile with no status gives null; the screen still shows the name.
 */
export function profileNotice(profile: Pick<CardProfile, 'name' | 'status'>): ProfileNotice | null {
  const status = profile.status;
  if (typeof status !== 'string' || !status.includes(UNVERIFIED_WORD)) return null;
  return { name: profile.name, statusText: status };
}
