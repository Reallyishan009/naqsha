import { getDesign, groupDesigns, listDesigns, saveDesign } from '../../archive/index.ts';
import type { ArchiveDeps, ArchiveFailure, DesignGroup, Metadata } from '../../archive/index.ts';
import type { CardGrid, CardProfile, Pattern } from '../../codec/index.ts';
import { generateSample } from '../samples/sampleDesigns.ts';

/**
 * The saved demo design of the judges' kit: the Diamond sample under a fixed name, weaver and place. The words are
 * data of the saved design, not screen text, so they stay the same in both languages and the design can be found again.
 */
export const DEMO_METADATA: Metadata = {
  name: 'Demo Diamond',
  naqshband: '',
  weaver: 'Demo weaver',
  place: 'Demo workshop',
  date: '',
  notes: 'Saved by the Demo card of the Keep screen.',
};

/** The loom files in public/demo/loom-files, made with the export of Naqsha. They are not the Diamond sample. */
export const DEMO_LOOM_FILES: ReadonlyArray<{ path: string; fileName: string }> = [
  { path: 'demo/loom-files/diamond-1bit.bmp', fileName: 'diamond-1bit.bmp' },
  { path: 'demo/loom-files/diamond-8bit.bmp', fileName: 'diamond-8bit.bmp' },
];

/** How many hook positions of one card each demo edit flips, and how many cards (picks) it touches. */
const EDIT_PICKS = 2;
const EDIT_ENDS = 2;

/**
 * A copy of the pattern with a few punched holes changed. Version `count` (1 for the first edit) flips the first
 * `EDIT_ENDS` hook positions of hook row 0 on `EDIT_PICKS` picks that no earlier edit touched, so every edit gives a
 * different pattern than the version it continues. Picks that are not cards are left alone. Pure.
 */
export function editDemoPattern(pattern: Pattern, count: number): Pattern {
  const copy: Pattern = pattern.map((card) => (Array.isArray(card) ? card.map((hookRow) => [...hookRow]) : card));
  if (copy.length === 0) return copy;
  for (let step = 0; step < EDIT_PICKS; step++) {
    const pick = (Math.max(1, count) * EDIT_PICKS + step) % copy.length;
    const card: CardGrid | undefined = copy[pick];
    const hookRow = card?.[0];
    if (hookRow === undefined) continue;
    for (let hookColumn = 0; hookColumn < Math.min(EDIT_ENDS, hookRow.length); hookColumn++) {
      hookRow[hookColumn] = !hookRow[hookColumn];
    }
  }
  return copy;
}

/** The group of the demo design in a list of saved designs: the one whose first version has the demo name. */
export function findDemoGroup(groups: ReadonlyArray<DesignGroup>): DesignGroup | null {
  return groups.find((group) => group.versions.some((version) => version.metadata.name === DEMO_METADATA.name)) ?? null;
}

export type DemoOutcome<T> = { ok: true; value: T } | { ok: false; failure: ArchiveFailure };
/** The ids of the version written and the version it continues (null for the first version of the design). */
export type DemoSaved = { id: string; continues: string | null; versionCount: number };

/** Saves the Diamond sample as a new design with the demo Metadata. */
export async function saveDemoDesign(profile: CardProfile, deps?: ArchiveDeps): Promise<DemoOutcome<DemoSaved>> {
  const saved = await saveDesign(
    { pattern: generateSample(profile, 'diamond'), profileName: profile.name, metadata: DEMO_METADATA },
    deps,
  );
  return saved.ok ? { ok: true, value: { id: saved.value, continues: null, versionCount: 1 } } : saved;
}

/**
 * Saves a new version of the demo design with a few punched holes changed, through `saveDesign` with `continues`, the same
 * path as "save as a new version". When there is no demo design yet, it is saved first. `note` is the version note.
 */
export async function saveDemoEdit(
  profile: CardProfile,
  note: (count: number) => string,
  deps?: ArchiveDeps,
): Promise<DemoOutcome<DemoSaved>> {
  const listed = await listDesigns(deps);
  if (!listed.ok) return listed;
  let group = findDemoGroup(groupDesigns(listed.value));
  if (group === null) {
    const first = await saveDemoDesign(profile, deps);
    if (!first.ok) return first;
    const relisted = await listDesigns(deps);
    if (!relisted.ok) return relisted;
    group = findDemoGroup(groupDesigns(relisted.value));
    if (group === null) return { ok: true, value: first.value };
  }
  const newest = await getDesign(group.newest.id, deps);
  if (!newest.ok) return newest;
  const count = group.versionCount;
  const saved = await saveDesign(
    {
      pattern: editDemoPattern(newest.value.pattern, count),
      profileName: newest.value.profileName,
      metadata: newest.value.metadata,
      continues: group.newest.id,
      note: note(count),
    },
    deps,
  );
  return saved.ok ? { ok: true, value: { id: saved.value, continues: group.newest.id, versionCount: count + 1 } } : saved;
}
