import type { DesignSummary } from './types.ts';
/** The design a version belongs to: the stored design id, or its own id for the first version of a design. */
export function designIdOf(item: { id: string; designId?: string }): string {
  return item.designId ?? item.id;
}
/** All versions of one design, newest first. */
export type DesignGroup = {
  designId: string;
  versions: DesignSummary[];
  newest: DesignSummary;
  versionCount: number;
};
/** Newest first; equal creation times are ordered by id, as listDesigns does. */
function newestFirst(a: DesignSummary, b: DesignSummary): number {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
/**
 * Groups summaries into one entry per design. Versions inside a group, and groups by their newest version,
 * are newest first. A summary with no design id is a design with one version. Pure; the input is not changed.
 */
export function groupDesigns(summaries: ReadonlyArray<DesignSummary>): DesignGroup[] {
  const byDesign = new Map<string, DesignSummary[]>();
  for (const summary of summaries) {
    const key = designIdOf(summary);
    const versions = byDesign.get(key);
    if (versions === undefined) byDesign.set(key, [summary]);
    else versions.push(summary);
  }
  const groups: DesignGroup[] = [];
  for (const [designId, versions] of byDesign) {
    versions.sort(newestFirst);
    const newest = versions[0]!;
    groups.push({ designId, versions, newest, versionCount: versions.length });
  }
  return groups.sort((a, b) => newestFirst(a.newest, b.newest) || (a.designId < b.designId ? -1 : 1));
}
/** The next older version of the one with this id in the group, or null when it is the oldest or not in the group. */
export function previousVersion(group: DesignGroup, id: string): DesignSummary | null {
  const index = group.versions.findIndex((version) => version.id === id);
  if (index < 0) return null;
  return group.versions[index + 1] ?? null;
}
