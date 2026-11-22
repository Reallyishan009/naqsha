import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { themeScriptProblems } from '../../../scripts/check_bundle.ts';
import type { ThemeName } from '../../../src/ui/theme/contrast.ts';
import { THEME_STORAGE_KEY, applyTheme, chooseTheme } from '../../../src/ui/theme/theme.ts';
import { browserPrefersDark, readStoredTheme, storeTheme } from '../../../src/ui/platform/browser.ts';
import type { KeyValueStorage } from '../../../src/ui/platform/browser.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const INDEX_HTML = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/** The one classic script of index.html: the text of the file its `src` names, in public/. */
function themeScript(html: string): string {
  const match = /<script\s+src="\.\/([^"]+)"\s*><\/script>/i.exec(html);
  if (match === null) throw new Error('index.html has no classic theme script with a src');
  return readFileSync(path.join(ROOT, 'public', match[1]!), 'utf8');
}

type Environment = {
  /** What localStorage holds under the theme key; 'throws' makes localStorage refuse. */
  stored: string | null | 'throws';
  /** Whether the dark preference is on; 'none' = matchMedia reports no match; 'throws' = matchMedia throws. */
  dark: boolean | 'throws';
};

/** Runs the theme script of index.html in a fresh context and returns the `data-theme` it set (null if none). */
function runInlineScript(environment: Environment): string | null {
  let applied: string | null = null;
  const localStorage = {
    getItem(key: string): string | null {
      if (environment.stored === 'throws') throw new Error('storage blocked');
      return key === THEME_STORAGE_KEY ? environment.stored : null;
    },
  };
  const window = {
    matchMedia(query: string): { matches: boolean } {
      if (environment.dark === 'throws') throw new Error('matchMedia failed');
      return { matches: query === '(prefers-color-scheme: dark)' && environment.dark };
    },
  };
  const document = {
    documentElement: {
      setAttribute(name: string, value: string): void {
        if (name === 'data-theme') applied = value;
      },
    },
  };
  vm.runInNewContext(themeScript(INDEX_HTML), { localStorage, window, document });
  return applied;
}

class FakeStorage implements KeyValueStorage {
  readonly items = new Map<string, string>();
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }
}

const THROWING_STORAGE: KeyValueStorage = {
  getItem(): string | null {
    throw new Error('blocked');
  },
  setItem(): void {
    throw new Error('blocked');
  },
};

describe('chooseTheme', () => {
  it('R4.5 a stored day or night wins over the colour preference', () => {
    for (const dark of [true, false]) {
      expect(chooseTheme('day', dark)).toBe('day');
      expect(chooseTheme('night', dark)).toBe('night');
    }
  });

  it('R4.6 without a stored choice, a dark preference gives night', () => {
    expect(chooseTheme(null, true)).toBe('night');
  });

  it('R4.7 without a stored choice and without a dark preference, the theme is day', () => {
    expect(chooseTheme(null, false)).toBe('day');
  });
});

describe('applyTheme', () => {
  it('R4.3 sets data-theme on the root element', () => {
    const set: Array<[string, string]> = [];
    applyTheme({ setAttribute: (name, value) => void set.push([name, value]) }, 'night');
    expect(set).toEqual([['data-theme', 'night']]);
  });

  it('R4.3 does nothing when there is no root', () => {
    expect(() => applyTheme(null, 'day')).not.toThrow();
  });
});

describe('theme storage in platform/browser', () => {
  it('R4.4 a stored theme is read back, and a bad value reads as null', () => {
    const storage = new FakeStorage();
    expect(readStoredTheme(storage)).toBeNull();
    expect(storeTheme(storage, 'night')).toBe(true);
    expect(storage.items.get(THEME_STORAGE_KEY)).toBe('night');
    expect(readStoredTheme(storage)).toBe('night');
    storage.setItem(THEME_STORAGE_KEY, 'dusk');
    expect(readStoredTheme(storage)).toBeNull();
  });

  it('R4.8 a missing or refusing storage never throws', () => {
    expect(readStoredTheme(null)).toBeNull();
    expect(readStoredTheme(THROWING_STORAGE)).toBeNull();
    expect(storeTheme(null, 'day')).toBe(false);
    expect(storeTheme(THROWING_STORAGE, 'day')).toBe(false);
  });

  it('R4.8 browserPrefersDark is false when matchMedia is missing here or throws', () => {
    expect(browserPrefersDark()).toBe(false);
    const original = globalThis.matchMedia;
    try {
      globalThis.matchMedia = (() => {
        throw new Error('matchMedia failed');
      }) as unknown as typeof matchMedia;
      expect(browserPrefersDark()).toBe(false);
      globalThis.matchMedia = ((query: string) => ({ matches: query.includes('dark') })) as unknown as typeof matchMedia;
      expect(browserPrefersDark()).toBe(true);
    } finally {
      if (original === undefined) delete (globalThis as { matchMedia?: unknown }).matchMedia;
      else globalThis.matchMedia = original;
    }
  });
});

describe('the theme script of index.html', () => {
  const cases: Array<{ name: string; environment: Environment; stored: ThemeName | null; prefersDark: boolean }> = [
    { name: 'stored day, dark preference', environment: { stored: 'day', dark: true }, stored: 'day', prefersDark: true },
    { name: 'stored night, light preference', environment: { stored: 'night', dark: false }, stored: 'night', prefersDark: false },
    { name: 'a bad stored value, dark preference', environment: { stored: 'dusk', dark: true }, stored: null, prefersDark: true },
    { name: 'a bad stored value, light preference', environment: { stored: 'dusk', dark: false }, stored: null, prefersDark: false },
    { name: 'nothing stored, dark preference', environment: { stored: null, dark: true }, stored: null, prefersDark: true },
    { name: 'nothing stored, light preference', environment: { stored: null, dark: false }, stored: null, prefersDark: false },
    { name: 'nothing stored, no preference', environment: { stored: null, dark: false }, stored: null, prefersDark: false },
    { name: 'a throwing matchMedia', environment: { stored: null, dark: 'throws' }, stored: null, prefersDark: false },
    { name: 'a throwing localStorage, dark preference', environment: { stored: 'throws', dark: true }, stored: null, prefersDark: true },
    { name: 'a throwing localStorage, light preference', environment: { stored: 'throws', dark: false }, stored: null, prefersDark: false },
  ];

  for (const { name, environment, stored, prefersDark } of cases) {
    it(`R4.5 R4.6 R4.7 R4.8 agrees with chooseTheme: ${name}`, () => {
      expect(runInlineScript(environment)).toBe(chooseTheme(stored, prefersDark));
    });
  }

  it('R4.12 sits in the head before the module script', () => {
    const scriptAt = INDEX_HTML.indexOf('<script src="./theme-init.js">');
    const moduleAt = INDEX_HTML.indexOf('<script type="module"');
    expect(scriptAt).toBeGreaterThan(INDEX_HTML.indexOf('<head>'));
    expect(scriptAt).toBeLessThan(INDEX_HTML.indexOf('</head>'));
    expect(moduleAt).toBeGreaterThan(scriptAt);
  });

  it('deploy: index.html has no inline script, because script-src is \'self\'', () => {
    const inline = [...INDEX_HTML.matchAll(/<script\b([^>]*)>/gi)].filter((match) => !/\bsrc\s*=/i.test(match[1]!));
    expect(inline).toEqual([]);
  });
});

describe('themeScriptProblems (the check-bundle rule)', () => {
  const script = '<script src="./theme-init.js"></script>';
  const module = '<script type="module" crossorigin src="./assets/index-a.js"></script>';
  const sheet = '<link rel="stylesheet" crossorigin href="./assets/index-a.css">';
  const themeText = "localStorage.getItem('naqsha.theme');document.documentElement.setAttribute('data-theme','day')";
  const read = (src: string): string | null => (src === './theme-init.js' ? themeText : null);

  it('R4.12 passes when the script comes before the module script and the stylesheet link', () => {
    expect(themeScriptProblems(`<head>${script}${module}${sheet}</head>`, read)).toEqual([]);
  });

  it('R4.12 names the module script when the theme script follows it', () => {
    expect(themeScriptProblems(`<head>${module}${script}${sheet}</head>`, read)).toEqual([
      'the theme script in dist/index.html comes after the module script',
    ]);
  });

  it('R4.12 names the stylesheet link when the theme script follows it', () => {
    expect(themeScriptProblems(`<head>${sheet}${script}${module}</head>`, read)).toEqual([
      'the theme script in dist/index.html comes after the stylesheet link',
    ]);
  });

  it('R4.12 fails when the theme script is missing', () => {
    expect(themeScriptProblems(`<head>${module}${sheet}</head>`, read)).toEqual(['dist/index.html has no classic theme script']);
  });

  it('R4.12 fails when the script file is missing or is not the theme script', () => {
    expect(themeScriptProblems(`<head>${script}${module}${sheet}</head>`, () => null)).toEqual(['dist/index.html has no classic theme script']);
    expect(themeScriptProblems(`<head>${script}${module}${sheet}</head>`, () => 'alert(1)')).toEqual(['dist/index.html has no classic theme script']);
  });

  it('deploy: an inline script is a problem, because script-src is \'self\'', () => {
    const inline = '<script>document.title="x"</script>';
    expect(themeScriptProblems(`<head>${inline}${script}${module}${sheet}</head>`, read)).toEqual([
      "dist/index.html has an inline script, which script-src 'self' blocks",
    ]);
  });

  it('R4.12 the source index.html has the script before its module script', () => {
    expect(themeScriptProblems(`${INDEX_HTML}<link rel="stylesheet" href="./a.css">`, (src) => (src === './theme-init.js' ? themeScript(INDEX_HTML) : null))).toEqual([]);
  });
});
