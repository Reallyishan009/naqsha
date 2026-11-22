import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { OUT_DIRECTORY, createPathGuard, repoGuard } from '../src/paths.ts';
import { ToolError } from '../src/result.ts';
/** What a call to the guard threw, or null when it did not throw. */
function thrown(call: () => unknown): ToolError | null {
  try {
    call();
    return null;
  } catch (error) {
    assert.ok(error instanceof ToolError, 'the guard throws only ToolError');
    return error;
  }
}
const base = mkdtempSync(path.join(tmpdir(), 'loom-mcp-paths-'));
const outside = path.join(base, 'outside');
const root = path.join(base, 'repo');
mkdirSync(outside);
mkdirSync(path.join(root, 'designs'), { recursive: true });
writeFileSync(path.join(outside, 'secret.json'), '{"secret":true}');
writeFileSync(path.join(root, 'designs', 'a.json'), '[]');
symlinkSync(path.join(outside, 'secret.json'), path.join(root, 'designs', 'link-out.json'));
symlinkSync(outside, path.join(root, 'designs', 'dir-link'));
symlinkSync(path.join(root, 'designs', 'a.json'), path.join(root, 'designs', 'link-in.json'));
const guard = createPathGuard(root);
after(() => rmSync(base, { recursive: true, force: true }));
describe('path guard: reads', () => {
  it('R8.1 a file inside the repository, by a relative path or an absolute one, is allowed', () => {
    assert.equal(guard.readable('designs/a.json'), path.join(guard.root, 'designs', 'a.json'));
    assert.equal(guard.readable(path.join(root, 'designs', 'a.json')), path.join(guard.root, 'designs', 'a.json'));
  });
  it('R8.1 a link that stays inside the repository is allowed', () => {
    assert.equal(guard.readable('designs/link-in.json'), path.join(guard.root, 'designs', 'a.json'));
  });
  for (const input of ['../outside/secret.json', 'designs/../../outside/secret.json', 'designs/..\\x', '..', 'a/../b.json']) {
    it(`R8.1 "${input}" has a ".." segment and is refused`, () => {
      assert.equal(thrown(() => guard.readable(input))?.reason, 'path_not_allowed');
    });
  }
  it('R8.1 an absolute path outside the repository is refused, whether or not the file exists', () => {
    assert.equal(thrown(() => guard.readable(path.join(outside, 'secret.json')))?.reason, 'path_not_allowed');
    assert.equal(thrown(() => guard.readable('/etc/passwd'))?.reason, 'path_not_allowed');
    assert.equal(thrown(() => guard.readable('/no/such/place'))?.reason, 'path_not_allowed');
  });
  it('R8.1 a link to a file outside, and a link to a directory outside, are refused', () => {
    assert.equal(thrown(() => guard.readable('designs/link-out.json'))?.reason, 'path_not_allowed');
    assert.equal(thrown(() => guard.readable('designs/dir-link/secret.json'))?.reason, 'path_not_allowed');
  });
  it('R8.1 a directory, an empty text, a NUL byte, a very long path and a non-text are refused', () => {
    for (const input of ['designs', '', 'a\0b', 'x'.repeat(5000), 5, null, undefined, {}]) {
      assert.equal(thrown(() => guard.readable(input))?.reason, 'path_not_allowed', String(input).slice(0, 20));
    }
  });
  it('R8.1 a path inside the repository that does not exist is not_found, not allowed-or-refused confusion', () => {
    assert.equal(thrown(() => guard.readable('designs/missing.json'))?.reason, 'not_found');
  });
  it('R8.1 the guard for this repository reads a fixture and refuses the system files', () => {
    assert.ok(repoGuard.readable('tests/fixtures/pick0-clean.png').endsWith('pick0-clean.png'));
    assert.equal(thrown(() => repoGuard.readable('../../../../etc/passwd'))?.reason, 'path_not_allowed');
  });
});
describe('path guard: writes', () => {
  it('R7.1 R8.1 a bare .bmp name is written inside the out directory, which is created', () => {
    const target = guard.writable('design.bmp');
    assert.equal(target.relative, `${OUT_DIRECTORY}/design.bmp`);
    assert.equal(target.absolute, path.join(guard.root, 'tools', 'loom-mcp', 'out', 'design.bmp'));
    writeFileSync(target.absolute, 'x');
    assert.equal(readFileSync(target.absolute, 'utf8'), 'x');
    assert.equal(guard.writable('design.bmp').relative, target.relative); // overwriting a plain file is fine
  });
  for (const name of ['../x.bmp', 'a/b.bmp', 'a\\b.bmp', '/abs.bmp', '.hidden.bmp', 'x.png', 'x.bmp.exe', '', 'a..b.bmp', 'x'.repeat(61) + '.bmp', 'has space.bmp']) {
    it(`R8.1 the file name "${name.slice(0, 20)}" is refused`, () => {
      assert.equal(thrown(() => guard.writable(name))?.reason, 'path_not_allowed');
    });
  }
  it('R8.1 a name that is not text is refused', () => {
    for (const name of [5, null, undefined, {}]) assert.equal(thrown(() => guard.writable(name))?.reason, 'path_not_allowed');
  });
  it('R8.1 an existing link in the out directory, even one that points inside, is not written through', () => {
    const out = path.join(guard.root, 'tools', 'loom-mcp', 'out');
    symlinkSync(path.join(outside, 'secret.json'), path.join(out, 'evil.bmp'));
    assert.equal(thrown(() => guard.writable('evil.bmp'))?.reason, 'path_not_allowed');
    assert.equal(readFileSync(path.join(outside, 'secret.json'), 'utf8'), '{"secret":true}');
  });
  it('R8.1 an out directory that is itself a link out of the repository is refused', () => {
    const other = path.join(base, 'repo2');
    mkdirSync(path.join(other, 'tools', 'loom-mcp'), { recursive: true });
    symlinkSync(outside, path.join(other, 'tools', 'loom-mcp', 'out'));
    assert.equal(thrown(() => createPathGuard(other).writable('a.bmp'))?.reason, 'path_not_allowed');
  });
});
