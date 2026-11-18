import { encodeCardGrid, endsPerPick, parseCardProfile, validateCardGrid } from '../codec/index.ts';
import type { CardProfile } from '../codec/index.ts';
import type { GapReport, PickRow, PreparedCloth, SimResult } from './types.ts';

/** Every cloth prepareCloth returned; lets renderFrame reject any other value in O(1). */
const preparedCloths = new WeakSet<object>();

/** True only for a cloth that prepareCloth made. */
export function isPreparedCloth(value: unknown): value is PreparedCloth {
  return typeof value === 'object' && value !== null && preparedCloths.has(value);
}

/**
 * Checks the profile, classifies every slot as woven, missing or damaged, and gets each woven pick's lift set
 * from encodeCardGrid (R1.1 to R1.4, R2.2). Never throws (R11.1). Copies what it keeps, so the inputs are not changed (R1.6).
 * A slots value that is not an array has no slot list to read, so it fails with invalid-settings naming "slots".
 */
export function prepareCloth(profile: unknown, slots: unknown): SimResult<PreparedCloth> {
  try {
    const parsed = parseCardProfile(profile);
    if (!parsed.ok) return { ok: false, failure: { reason: 'invalid-profile', violations: parsed.violations } };
    if (!Array.isArray(slots)) {
      return {
        ok: false,
        failure: { reason: 'invalid-settings', setting: 'slots', message: 'slots must be an array of card slots' },
      };
    }
    const keptProfile: CardProfile = structuredClone(parsed.value);
    const picks: PickRow[] = [];
    const gaps: GapReport[] = [];
    for (let pick = 0; pick < slots.length; pick++) {
      const slot: unknown = slots[pick];
      if (slot === null || slot === undefined) {
        picks.push({ kind: 'missing' });
        gaps.push({ pick, kind: 'missing', violations: [] });
        continue;
      }
      const violations = validateCardGrid(keptProfile, slot);
      if (violations.length > 0) {
        picks.push({ kind: 'damaged', violations });
        gaps.push({ pick, kind: 'damaged', violations });
        continue;
      }
      const encoded = encodeCardGrid(keptProfile, slot);
      if (!encoded.ok) {
        picks.push({ kind: 'damaged', violations: encoded.violations });
        gaps.push({ pick, kind: 'damaged', violations: encoded.violations });
        continue;
      }
      picks.push({ kind: 'woven', lift: Uint8Array.from(encoded.value, (lifted) => (lifted ? 1 : 0)) });
    }
    const cloth: PreparedCloth = { profile: keptProfile, baseEnds: endsPerPick(keptProfile), picks, gaps };
    preparedCloths.add(cloth);
    return { ok: true, value: cloth };
  } catch (error) {
    return {
      ok: false,
      failure: {
        reason: 'invalid-settings',
        setting: 'slots',
        message: `slots could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
      },
    };
  }
}
