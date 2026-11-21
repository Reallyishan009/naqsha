import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '../../..');
const css = readFileSync(path.join(ROOT, 'src/ui/theme/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

/** The value of one custom property in the first :root block. */
function tokenValue(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(rootBlock)?.[1]?.trim();
}

/** Every custom property in the :root block whose name starts with the prefix, as name and value. */
function group(prefix: string): [string, string][] {
  return [...rootBlock.matchAll(new RegExp(`--(${prefix}[\\w-]*):\\s*([^;]+);`, 'g'))].map((m) => [m[1]!, m[2]!.trim()]);
}

describe('tokens.css', () => {
  it('R1.2 six @font-face rules set family, weight and font-display swap, with a relative woff2 src that exists', () => {
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]!);
    expect(faces).toHaveLength(6);
    const seen = faces.map((face) => {
      const family = /font-family:\s*'([^']+)'/.exec(face)?.[1];
      const weight = /font-weight:\s*(\d+)/.exec(face)?.[1];
      expect(face).toMatch(/font-display:\s*swap/);
      expect(face).not.toMatch(/unicode-range/);
      const src = /src:\s*url\('([^']+)'\)\s*format\('woff2'\)/.exec(face)?.[1];
      expect(src, 'a woff2 src').toBeDefined();
      expect(src).not.toMatch(/^[a-z][a-z0-9+.-]*:|\/\//i);
      expect(existsSync(path.join(ROOT, 'public', src!)), `public${src}`).toBe(true);
      const style = /font-style:\s*(\w+)/.exec(face)?.[1];
      return `${family} ${weight}${style === 'italic' ? ' italic' : ''} ${path.basename(src!)}`;
    });
    expect(seen).toEqual([
      'Rozha One 400 RozhaOne-Regular.woff2',
      'Hind 400 Hind-Regular.woff2',
      'Hind 700 Hind-Bold.woff2',
      'IBM Plex Mono 400 IBMPlexMono-Regular.woff2',
      'Newsreader 400 Newsreader-Regular.woff2',
      'Newsreader 400 italic Newsreader-Italic.woff2',
    ]);
  });

  it('R1.3 the three font tokens are exactly the required stacks', () => {
    expect(tokenValue('font-display')).toBe("'Newsreader', 'Rozha One', Georgia, serif");
    expect(tokenValue('font-body')).toBe('Hind, system-ui, sans-serif');
    expect(tokenValue('font-data')).toBe("'IBM Plex Mono', ui-monospace, monospace");
    expect(group('font-')).toHaveLength(3);
  });

  it('R3.1 there are exactly six type scale tokens of 14, 16, 18, 22, 28 and 36 px, and the root is 18 px', () => {
    expect(group('text-').map(([, v]) => v)).toEqual(['14px', '16px', '18px', '22px', '28px', '36px']);
    expect(/(?:^|\n)html\s*\{([^}]*)\}/.exec(css)?.[1]).toMatch(/font-size:\s*18px/);
  });

  it('R3.2 the spacing scale is 4, 8, 12, 16, 24, 32 and 48 px, and 64, 96 and 128 px for page sections (second pass)', () => {
    expect(group('space-').map(([, v]) => v)).toEqual(['4px', '8px', '12px', '16px', '24px', '32px', '48px', '64px', '96px', '128px']);
  });

  it('R3.3 the radius scale is 4 px for controls, 8 px for panels, 16 px for media, 24 px for cards and a pill (second pass)', () => {
    expect(group('radius-')).toEqual([
      ['radius-control', '4px'],
      ['radius-panel', '8px'],
      ['radius-media', '16px'],
      ['radius-card', '24px'],
      ['radius-pill', '999px'],
    ]);
  });

  it('R3.5 there are exactly three shadow tokens: the original card shadow, a lift and a float (second pass)', () => {
    expect(group('shadow-')).toEqual([
      ['shadow-card', '0 2px 6px rgb(0 0 0 / 0.25)'],
      ['shadow-lift', expect.stringMatching(/^0 2px 6px rgb\([\d ]+ \/ [\d.]+\), 0 10px 24px rgb\(/)],
      ['shadow-float', expect.stringMatching(/^0 4px 12px rgb\([\d ]+ \/ [\d.]+\), 0 24px 48px rgb\(/)],
    ]);
  });

  it('second pass the palette tokens exist in both themes and the Night block overrides every one of them', () => {
    const palette = ['primary', 'on-primary', 'accent', 'eyebrow', 'tint', 'band', 'on-band', 'band-accent', 'frost'];
    const night = /\[data-theme='night'\]\s*\{([^}]*--on-zari[^}]*)\}/.exec(css)?.[1] ?? '';
    for (const name of palette) {
      expect(tokenValue(name), `:root --${name}`).toBeDefined();
      expect(night, `night --${name}`).toMatch(new RegExp(`--${name}:`));
    }
  });

  it('R3.7 there are exactly three motion tokens of 120, 200 and 320 ms', () => {
    expect(group('motion-').map(([, v]) => v)).toEqual(['120ms', '200ms', '320ms']);
  });

  it('R3.9 body line height is 1.5, and 1.7 where the language is hi', () => {
    expect(tokenValue('leading-body')).toBe('1.5');
    expect(tokenValue('leading-hindi')).toBe('1.7');
    expect(/(?:^|\n)body\s*\{([^}]*)\}/.exec(css)?.[1]).toMatch(/line-height:\s*var\(--leading-body\)/);
    expect(/html\[lang='hi'\]\s+body\s*\{([^}]*)\}/.exec(css)?.[1]).toMatch(/line-height:\s*var\(--leading-hindi\)/);
  });

  it('R3.10 table cells and the pick counter use tabular numerals', () => {
    const rule = /([^{}]*)\{[^}]*font-variant-numeric:\s*tabular-nums[^}]*\}/.exec(css)?.[1] ?? '';
    for (const selector of ['td', 'th', '[data-tabular]']) expect(rule).toContain(selector);
  });

  it('R3.12 the touch target is 48 px and Day zari keeps its value', () => {
    expect(tokenValue('touch-target')).toBe('48px');
    expect(tokenValue('zari')).toBe('#B0800A');
    expect(tokenValue('on-zari')).toBeDefined();
    expect(tokenValue('on-hole')).toBeDefined();
    expect(/\[data-theme='night'\]\s*\{([^}]*--on-zari[^}]*)\}/.exec(css)).not.toBeNull();
    expect(/\[data-theme='night'\]\s*\{([^}]*--on-hole[^}]*)\}/.exec(css)).not.toBeNull();
  });

  it('R6.3 the focus ring is 3 px in zari with a 2 px offset', () => {
    expect(/:focus-visible\s*\{([^}]*)\}/.exec(css)?.[1]).toMatch(/outline:\s*3px solid var\(--zari\);\s*outline-offset:\s*2px/);
  });

  it('R3.12 the night theme asks native controls for dark colours', () => {
    expect(css).toMatch(/\[data-theme='night'\]\s*\{\s*color-scheme:\s*dark;\s*\}/);
  });

  it('R7.1 the Graph_Paper_Ground is two hard-stop line layers every 8 px in --line on body, and the only gradient', () => {
    const body = /(?:^|\n)body\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(body).toMatch(/background-color:\s*var\(--ground\)/);
    expect(body).toMatch(
      /background-image:\s*linear-gradient\(var\(--line\) 1px, transparent 1px\),\s*linear-gradient\(90deg, var\(--line\) 1px, transparent 1px\);/,
    );
    expect(body).toMatch(/background-size:\s*8px 8px/);
    expect(css.match(/gradient\(/g)).toHaveLength(2);
  });

  it('R15.2 no font is preloaded and the file names no other origin', () => {
    expect(css).not.toMatch(/https?:|\/\//);
    expect(readFileSync(path.join(ROOT, 'index.html'), 'utf8')).not.toMatch(/rel=["']preload["']/);
  });

  it('R23.3 the reduced-motion rule is kept', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*transition: none !important[\s\S]*animation: none !important/);
  });
});
