import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chromeArgs, chromeCandidates, findChrome, parseDevToolsActivePort } from '../../scripts/checks/chrome.ts';

const SEED = 60302;
const NUM_RUNS = 100;
const platformArb = fc.constantFrom('darwin', 'linux', 'win32', 'freebsd');
const envArb = fc.record(
  {
    CHROME_PATH: fc.oneof(fc.constant(''), fc.constant('   '), fc.stringMatching(/^\/[a-z]{1,8}\/[a-z]{1,8}$/)),
    HOME: fc.constant('/home/user'),
    PROGRAMFILES: fc.constant('C:\\Program Files'),
    LOCALAPPDATA: fc.constant('C:\\Users\\u\\AppData\\Local'),
  },
  { requiredKeys: [] },
);

describe('chromeCandidates', () => {
  it('lists the standard macOS, Windows and Linux locations', () => {
    expect(chromeCandidates('darwin', {})).toContain('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
    expect(chromeCandidates('darwin', { HOME: '/Users/a' })).toContain(
      '/Users/a/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    );
    expect(chromeCandidates('win32', { PROGRAMFILES: 'C:\\Program Files' })).toContain(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    );
    expect(chromeCandidates('linux', {})).toContain('/usr/bin/google-chrome');
    expect(chromeCandidates('linux', {})).toContain('/usr/bin/chromium');
  });

  it('puts CHROME_PATH first, and ignores a blank one', () => {
    expect(chromeCandidates('linux', { CHROME_PATH: '/opt/mine/chrome' })[0]).toBe('/opt/mine/chrome');
    expect(chromeCandidates('linux', { CHROME_PATH: '  ' })).toEqual(chromeCandidates('linux', {}));
  });
});

describe('findChrome', () => {
  it('returns the first existing candidate', () => {
    const fs = new Set(['/usr/bin/chromium', '/usr/bin/google-chrome']);
    const found = findChrome('linux', {}, (path) => fs.has(path));
    expect(found).toEqual({ ok: true, path: '/usr/bin/google-chrome' });
  });

  it('prefers CHROME_PATH when it exists', () => {
    const found = findChrome('darwin', { CHROME_PATH: '/x/chrome' }, (path) => path === '/x/chrome' || path.startsWith('/Applications'));
    expect(found).toEqual({ ok: true, path: '/x/chrome' });
  });

  it('falls back to the standard paths when CHROME_PATH points at nothing, and says so when none exist', () => {
    const fallback = findChrome('linux', { CHROME_PATH: '/nope' }, (path) => path === '/usr/bin/chromium');
    expect(fallback).toEqual({ ok: true, path: '/usr/bin/chromium' });
    const none = findChrome('linux', { CHROME_PATH: '/nope' }, () => false);
    expect(none.ok).toBe(false);
    if (none.ok) return;
    expect(none.message).toContain('CHROME_PATH is set to "/nope"');
    expect(none.message).toContain('/usr/bin/google-chrome');
  });

  it('R23.1 the search over an injected file system finds exactly the first listed path that exists, or fails naming every path', () => {
    fc.assert(
      fc.property(platformArb, envArb, fc.array(fc.nat(40), { maxLength: 6 }), (platform, env, picks) => {
        const candidates = chromeCandidates(platform, env);
        const existing = new Set(picks.map((pick) => candidates[pick % Math.max(1, candidates.length)]).filter((path): path is string => path !== undefined));
        const result = findChrome(platform, env, (path) => existing.has(path));
        const expected = candidates.find((path) => existing.has(path));
        if (expected === undefined) {
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.tried).toEqual(candidates);
          for (const path of candidates) expect(result.message).toContain(path);
          expect(result.message).toContain('CHROME_PATH');
        } else {
          expect(result).toEqual({ ok: true, path: expected });
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('chromeArgs and parseDevToolsActivePort', () => {
  it('starts headless on a port of Chrome\'s choice with the given profile directory', () => {
    const args = chromeArgs('/tmp/profile');
    expect(args).toContain('--headless=new');
    expect(args).toContain('--remote-debugging-port=0');
    expect(args).toContain('--user-data-dir=/tmp/profile');
  });

  it('reads the port and the browser path, and returns null until the file is complete', () => {
    expect(parseDevToolsActivePort('9222\n/devtools/browser/abc\n')).toEqual({ port: 9222, browserPath: '/devtools/browser/abc' });
    expect(parseDevToolsActivePort('')).toBeNull();
    expect(parseDevToolsActivePort('abc\n/x')).toBeNull();
    expect(parseDevToolsActivePort('70000\n/x')).toBeNull();
  });

  it('R23.1 any port from 1 to 65535 is read back', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 65535 }), fc.stringMatching(/^[a-z0-9-]{1,20}$/), (port, id) => {
        expect(parseDevToolsActivePort(`${port}\r\n/devtools/browser/${id}`)).toEqual({ port, browserPath: `/devtools/browser/${id}` });
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
