import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..', '..');
const sessionSource = readFileSync(path.join(root, 'scripts', 'checks', 'session.ts'), 'utf8');
const checkBrowserSource = readFileSync(path.join(root, 'scripts', 'check_browser.ts'), 'utf8');

const MOVED_NAMES = ['Page', 'freePort', 'startPreview', 'startChrome', 'openPage', 'Cleanup', 'sleep'] as const;

const exportsName = (source: string, name: string): boolean =>
  new RegExp(`^export\\s+(?:async\\s+)?(?:class|function|const|type)\\s+${name}\\b`, 'm').test(source);

const declaresName = (source: string, name: string): boolean =>
  new RegExp(`^(?:export\\s+)?(?:async\\s+)?(?:class|function|const|type|let|var)\\s+${name}\\b`, 'm').test(source);

describe('Check_Browser plumbing in scripts/checks/session.ts', () => {
  it.each(MOVED_NAMES)('R22.3 session.ts exports %s', (name) => {
    expect(exportsName(sessionSource, name)).toBe(true);
  });

  it.each(MOVED_NAMES)('R22.3 check_browser.ts no longer declares %s', (name) => {
    expect(declaresName(checkBrowserSource, name)).toBe(false);
  });

  it('R22.3 check_browser.ts imports the moved names from session.ts', () => {
    expect(checkBrowserSource).toMatch(/from '\.\/checks\/session\.ts'/);
  });
});
