/**
 * Pure parts of step 13 of `npm run check:browser` (works with the network off, R13.1): the parameters sent to
 * `Network.emulateNetworkConditions`, and the pass or fail decision from what the page was observed to do.
 * No I/O here: the caller drives Chrome and passes in what it saw.
 * A check that was not run is never a pass: a group passes only when it has at least one check and every check passed.
 */
export type CheckStatus = 'pass' | 'fail' | 'not-run';
export type OfflineCheck = { name: string; status: CheckStatus; note: string };
export type OfflineGroup = { title: string; checks: readonly OfflineCheck[] };
export type OfflineVerdict = { ok: boolean; notPassed: string[] };

export type NetworkConditions = {
  offline: boolean;
  latency: number;
  downloadThroughput: number;
  uploadThroughput: number;
};

/** Parameters for `Network.emulateNetworkConditions`: no extra latency, no throttling (-1), only the offline flag differs. */
export function offlineConditions(offline: boolean): NetworkConditions {
  return { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
}

export const groupPasses = (group: OfflineGroup): boolean => group.checks.length > 0 && group.checks.every((check) => check.status === 'pass');

/** The step passes only when every group passes. Lists every check that did not pass, with its group. */
export function decideOffline(groups: readonly OfflineGroup[]): OfflineVerdict {
  const notPassed: string[] = [];
  for (const group of groups) {
    if (group.checks.length === 0) notPassed.push(`${group.title}: no check was run`);
    for (const check of group.checks) if (check.status !== 'pass') notPassed.push(`${group.title}: ${check.name} (${check.status})`);
  }
  return { ok: groups.length > 0 && notPassed.length === 0, notPassed };
}

/** The step detail: one block per group, one line per check, with the status in capitals. */
export function formatOffline(groups: readonly OfflineGroup[]): string {
  const lines: string[] = [];
  for (const group of groups) {
    lines.push(`${groupPasses(group) ? 'PASS' : 'FAIL'} ${group.title}`);
    for (const check of group.checks) lines.push(`  ${check.status === 'pass' ? 'PASS' : check.status === 'fail' ? 'FAIL' : 'NOT RUN'} ${check.name}: ${check.note}`);
  }
  return lines.join('\n');
}
