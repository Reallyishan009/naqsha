import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../support/source.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
// The app tests: UI, archive and the integration tests that read photos.
const APP_TEST_DIRS = ['tests/ui', 'tests/archive', 'tests/integration'];
const MOCKING = /\bvi\s*\.\s*(mock|doMock|fn|spyOn|stubGlobal|stubEnv|hoisted)\b|\bjest\s*\./;

function testFiles(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(relative);
    return /\.test\.tsx?$/.test(entry.name) ? [relative] : [];
  });
}

function code(relative: string): string {
  return stripComments(readFileSync(path.join(ROOT, relative), 'utf8'), true);
}

describe('app tests use fakes, not mocks', () => {
  it('R17.4 no app test mocks, spies on or stubs anything', () => {
    const files = APP_TEST_DIRS.flatMap(testFiles);
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter((file) => MOCKING.test(code(file)))).toEqual([]);
    // A test file that imports vi would be the first step to a mock.
    const importsVi = files.filter((file) => /import\s*\{[^}]*\bvi\b[^}]*\}\s*from\s*'vitest'/.test(readFileSync(path.join(ROOT, file), 'utf8')));
    expect(importsVi).toEqual([]);
  });

  it('R17.4 the IndexedDB, file picker and scheduler stand-ins are classes or factories written for the tests, and the tests use them', () => {
    expect(code('tests/support/fakeIndexedDb.ts')).toMatch(/export function createFakeIndexedDb/);
    expect(code('tests/support/fakes.ts')).toMatch(/export class FakeArchiveStore implements ArchiveStore/);
    expect(code('tests/support/fakes.ts')).toMatch(/export class FakeScheduler implements Scheduler/);
    expect(code('tests/support/fakes.ts')).toMatch(/export class FakeDownloadDeps implements DownloadDeps/);
    expect(code('tests/archive/idbStore.test.ts')).toContain('createFakeIndexedDb');
    expect(code('tests/archive/designs.test.ts')).toContain('FakeArchiveStore');
    // The file picker is a Blob handed to readPhoto with a loader that returns pixels. No camera screen exists yet.
    expect(code('tests/integration/scanFixtures.test.ts')).toMatch(/new Blob\(/);
    expect(code('tests/integration/scanFixtures.test.ts')).toContain('fakeLoadPixels');
  });
});
