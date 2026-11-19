import { describe, expect, it } from 'vitest';
import {
  checkKiroDirs,
  checkKiroNotIgnored,
  checkLicense,
  checkNoSecrets,
  checkReadmeNoComing,
  findSpecValidator,
  reportGitState,
} from '../../scripts/checks/hygiene.ts';
import type { RepoFacts } from '../../scripts/checks/hygiene.ts';

/** A fake repository: files by path, directories, ignored paths and a status text. */
function fakeRepo(
  options: {
    files?: Record<string, string>;
    dirs?: string[];
    ignored?: string[];
    status?: string;
  } = {},
): RepoFacts {
  const files = options.files ?? { LICENSE: 'MIT', 'README.md': 'Naqsha reads cards.' };
  const dirs = options.dirs ?? ['.kiro/specs', '.kiro/hooks', '.kiro/settings'];
  const ignored = options.ignored ?? [];
  return {
    exists: (path) => path in files || dirs.includes(path),
    readText: (path) => files[path] ?? null,
    trackedFiles: Object.keys(files),
    isIgnored: (path) => ignored.includes(path),
    statusPorcelain: options.status ?? '',
  };
}

describe('hygiene checks', () => {
  it('LICENSE passes when present and fails when missing', () => {
    expect(checkLicense(fakeRepo()).status).toBe('PASS');
    expect(checkLicense(fakeRepo({ files: { 'README.md': 'x' } })).status).toBe('FAIL');
  });

  it('.kiro not ignored passes, and fails when .kiro or a subdirectory is ignored', () => {
    expect(checkKiroNotIgnored(fakeRepo()).status).toBe('PASS');
    expect(checkKiroNotIgnored(fakeRepo({ ignored: ['.kiro'] })).status).toBe('FAIL');
    const failed = checkKiroNotIgnored(fakeRepo({ ignored: ['.kiro/hooks'] }));
    expect(failed.status).toBe('FAIL');
    expect(failed.detail).toContain('.kiro/hooks');
  });

  it('.kiro directories pass when all exist and name the missing one otherwise', () => {
    expect(checkKiroDirs(fakeRepo()).status).toBe('PASS');
    const failed = checkKiroDirs(fakeRepo({ dirs: ['.kiro/specs', '.kiro/settings'] }));
    expect(failed.status).toBe('FAIL');
    expect(failed.detail).toContain('.kiro/hooks');
  });

  it('secret check passes on clean files and fails with file, line and a masked value', () => {
    expect(checkNoSecrets(fakeRepo()).status).toBe('PASS');
    const key = 'AKIA' + 'ABCDEFGHIJKLMNOP';
    const failed = checkNoSecrets(fakeRepo({ files: { 'src/a.ts': `line one\nconst k = "${key}"` } }));
    expect(failed.status).toBe('FAIL');
    expect(failed.output).toContain('src/a.ts:2 aws-access-key');
    expect(failed.output).not.toContain(key);
    expect(JSON.stringify(failed)).not.toContain(key);
  });

  it('secret check does not flag an allowlisted line and ignores binary and unreadable files', () => {
    const line = `const token = "${'a1'.repeat(15)}"`;
    const repo = fakeRepo({ files: { 'tests/fake.ts': line, 'media/a.png': line } });
    expect(checkNoSecrets(repo, [{ file: 'tests/fake.ts', reason: 'a test fixture, not a real token' }]).status).toBe('PASS');
    const unreadable: RepoFacts = { ...repo, trackedFiles: ['gone.ts'], readText: () => null };
    expect(checkNoSecrets(unreadable).status).toBe('PASS');
  });

  it('README check fails on "coming" in any letter case with its line, and passes on "becoming"', () => {
    expect(checkReadmeNoComing(fakeRepo()).status).toBe('PASS');
    expect(checkReadmeNoComing(fakeRepo({ files: { 'README.md': 'Becoming a weaver' } })).status).toBe('PASS');
    const failed = checkReadmeNoComing(fakeRepo({ files: { 'README.md': 'ok\nCOMING soon' } }));
    expect(failed.status).toBe('FAIL');
    expect(failed.output).toContain('README.md:2');
    expect(checkReadmeNoComing(fakeRepo({ files: {} })).status).toBe('FAIL');
  });

  it('git state is INFO for a clean and for a dirty tree, never FAIL', () => {
    expect(reportGitState(fakeRepo()).status).toBe('INFO');
    const dirty = reportGitState(fakeRepo({ status: ' M a.ts\n?? b.ts\n' }));
    expect(dirty.status).toBe('INFO');
    expect(dirty.detail).toContain('2');
  });

  it('spec validator lookup returns null when nothing matches and finds a script or file when present', () => {
    expect(findSpecValidator(['test', 'build', 'review-list'], ['check_all.ts', 'make_fixtures.ts'])).toBeNull();
    expect(findSpecValidator(['validate-specs'], [])).toEqual({ command: 'npm', args: ['run', 'validate-specs'] });
    expect(findSpecValidator([], ['spec_format.ts'])).toEqual({ command: 'node', args: ['scripts/spec_format.ts'] });
  });
});
