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
  it('a click waits until the box of its target has held still before the mouse goes down', () => {
    const click = /async click\([\s\S]*?\n  \}\n/.exec(sessionSource)?.[0] ?? '';
    expect(click).toMatch(/same>=2/);
    expect(click.indexOf('same>=2')).toBeLessThan(click.indexOf('mousePressed'));
  });
  it('a header menu that does not open reports where the button was and what lay over it', () => {
    expect(sessionSource).toMatch(/the page then:/);
  });
  it('setViewport waits for the header to draw the layout of the new width, and the width is the one the app uses', () => {
    const appSource = readFileSync(path.join(root, 'src', 'ui', 'App.tsx'), 'utf8');
    const appWidth = /WIDE_QUERY = '\(min-width: (\d+)px\)'/.exec(appSource)?.[1];
    const scriptWidth = /HEADER_WIDE_FROM_PX = (\d+)/.exec(sessionSource)?.[1];
    expect(appWidth).toBeDefined();
    expect(scriptWidth).toBe(appWidth);
    const setViewport = /async setViewport\([\s\S]*?\n  \}\n/.exec(sessionSource)?.[0] ?? '';
    expect(setViewport).toMatch(/data-narrow/);
    expect(setViewport.indexOf('data-narrow')).toBeGreaterThan(setViewport.indexOf('setDeviceMetricsOverride'));
  });
});
