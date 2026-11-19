/**
 * Finding an installed Chrome for `npm run check:browser`. Pure: the platform, the environment and the
 * file system are injected.
 */
export type Platform = 'darwin' | 'linux' | 'win32' | (string & {});
export type ChromeEnv = Record<string, string | undefined>;

const LINUX_NAMES = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome'];
const LINUX_DIRS = ['/usr/bin', '/usr/local/bin', '/snap/bin', '/opt/google/chrome'];

function joinWindows(base: string, tail: string): string {
  return `${base.replace(/[\\/]+$/, '')}\\${tail}`;
}

/** The paths to try, in order, for one platform. A `CHROME_PATH` override is always first. */
export function chromeCandidates(platform: Platform, env: ChromeEnv): string[] {
  const override = env.CHROME_PATH?.trim();
  const found: string[] = override ? [override] : [];
  if (platform === 'darwin') {
    const home = env.HOME;
    const apps = ['Google Chrome', 'Google Chrome Canary', 'Chromium'];
    for (const app of apps) found.push(`/Applications/${app}.app/Contents/MacOS/${app}`);
    if (home) for (const app of apps) found.push(`${home}/Applications/${app}.app/Contents/MacOS/${app}`);
  } else if (platform === 'win32') {
    const roots = [env.PROGRAMFILES, env['PROGRAMFILES(X86)'], env.LOCALAPPDATA].filter(
      (root): root is string => typeof root === 'string' && root !== '',
    );
    for (const root of roots) found.push(joinWindows(root, 'Google\\Chrome\\Application\\chrome.exe'));
    for (const root of roots) found.push(joinWindows(root, 'Chromium\\Application\\chrome.exe'));
  } else {
    for (const dir of LINUX_DIRS) for (const name of LINUX_NAMES) found.push(`${dir}/${name}`);
  }
  return found;
}

export type ChromeLookup = { ok: true; path: string } | { ok: false; message: string; tried: string[] };

/** The first candidate that exists. The failure message names every path tried and the override. */
export function findChrome(platform: Platform, env: ChromeEnv, exists: (path: string) => boolean): ChromeLookup {
  const tried = chromeCandidates(platform, env);
  for (const path of tried) if (exists(path)) return { ok: true, path };
  const override = env.CHROME_PATH?.trim();
  const lines = [
    override
      ? `CHROME_PATH is set to "${override}" but nothing is there, and no other Chrome was found.`
      : 'Chrome was not found.',
    'Install Google Chrome or Chromium, or set CHROME_PATH to the browser executable.',
    `Paths tried:${tried.length === 0 ? ' (none)' : ''}`,
    ...tried.map((path) => `  ${path}`),
  ];
  return { ok: false, message: lines.join('\n'), tried };
}

/** The command-line flags for a headless Chrome that opens a DevTools port of its choice (read back from DevToolsActivePort). */
export function chromeArgs(userDataDir: string): string[] {
  return [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-background-networking',
    '--window-size=900,1000',
    'about:blank',
  ];
}

/** Reads the `DevToolsActivePort` file: the port on the first line, the browser path on the second. Null if not ready. */
export function parseDevToolsActivePort(text: string): { port: number; browserPath: string } | null {
  const [portLine, pathLine] = text.split(/\r?\n/);
  const port = Number(portLine?.trim());
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  const browserPath = pathLine?.trim() ?? '';
  return { port, browserPath };
}
