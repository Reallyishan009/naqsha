/**
 * Repo hygiene checks, each a pure function over injected file and git data.
 */
import { formatFinding, isScannable, scanText, SECRET_ALLOWLIST } from './secrets.ts';
import type { AllowEntry } from './secrets.ts';
import type { Outcome } from './summary.ts';

export type RepoFacts = {
  exists: (path: string) => boolean;
  /** Text of a file, or null if it cannot be read. */
  readText: (path: string) => string | null;
  /** Output of `git ls-files`, one path per entry. */
  trackedFiles: readonly string[];
  /** True when `git check-ignore` says the path is ignored. */
  isIgnored: (path: string) => boolean;
  /** Output of `git status --porcelain`. */
  statusPorcelain: string;
};

export const REQUIRED_KIRO_DIRS = ['.kiro/specs', '.kiro/hooks', '.kiro/settings'] as const;

export function checkLicense(facts: RepoFacts): Outcome {
  return facts.exists('LICENSE')
    ? { status: 'PASS', detail: 'LICENSE present' }
    : { status: 'FAIL', detail: 'LICENSE is missing' };
}

export function checkKiroNotIgnored(facts: RepoFacts): Outcome {
  const ignored = ['.kiro', ...REQUIRED_KIRO_DIRS].filter((path) => facts.isIgnored(path));
  return ignored.length === 0
    ? { status: 'PASS', detail: '.kiro is not git-ignored' }
    : { status: 'FAIL', detail: `git-ignored: ${ignored.join(', ')}` };
}

export function checkKiroDirs(facts: RepoFacts): Outcome {
  const missing = REQUIRED_KIRO_DIRS.filter((path) => !facts.exists(path));
  return missing.length === 0
    ? { status: 'PASS', detail: `${REQUIRED_KIRO_DIRS.join(', ')} exist` }
    : { status: 'FAIL', detail: `missing: ${missing.join(', ')}` };
}

export function checkNoSecrets(facts: RepoFacts, allowlist: readonly AllowEntry[] = SECRET_ALLOWLIST): Outcome {
  const lines: string[] = [];
  let scanned = 0;
  for (const file of facts.trackedFiles) {
    const text = facts.readText(file);
    if (!isScannable(file, text)) continue;
    scanned += 1;
    for (const finding of scanText(file, text, allowlist)) lines.push(formatFinding(finding));
  }
  if (lines.length === 0) return { status: 'PASS', detail: `no secrets found in ${scanned} tracked text files` };
  return {
    status: 'FAIL',
    detail: `${lines.length} possible secret(s) found`,
    output: lines.join('\n'),
  };
}

/** The word "coming", any letter case, as a whole word. */
const COMING = /\bcoming\b/i;

export function checkReadmeNoComing(facts: RepoFacts): Outcome {
  const text = facts.readText('README.md');
  if (text === null) return { status: 'FAIL', detail: 'README.md is missing or unreadable' };
  const hits = text
    .split('\n')
    .flatMap((line, index) => (COMING.test(line) ? [`README.md:${index + 1} ${line.trim()}`] : []));
  return hits.length === 0
    ? { status: 'PASS', detail: 'README.md has no "coming"' }
    : { status: 'FAIL', detail: `"coming" found on ${hits.length} line(s)`, output: hits.join('\n') };
}

/** Information only. Never a failure. */
export function reportGitState(facts: RepoFacts): Outcome {
  const entries = facts.statusPorcelain.split('\n').filter((line) => line.trim().length > 0);
  if (entries.length === 0) return { status: 'INFO', detail: 'git working tree is clean' };
  return { status: 'INFO', detail: `git working tree has ${entries.length} changed or untracked path(s)` };
}

/**
 * Looks for an existing spec format validator command: a package.json script or a file under
 * scripts/ whose name mentions both a validator word and "spec". Returns what to run, or null.
 */
export function findSpecValidator(
  packageScripts: readonly string[],
  scriptFiles: readonly string[],
): { command: string; args: string[] } | null {
  const looksLikeValidator = (name: string): boolean =>
    /spec/i.test(name) && /(valid|format|lint)/i.test(name);
  const script = packageScripts.find(looksLikeValidator);
  if (script !== undefined) return { command: 'npm', args: ['run', script] };
  const file = scriptFiles.find(looksLikeValidator);
  if (file !== undefined) return { command: 'node', args: [`scripts/${file}`] };
  return null;
}
