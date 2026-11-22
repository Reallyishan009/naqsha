import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardOverlay, readNumberOf } from '../../../src/ui/screens/scan/CardOverlay.tsx';
import type { PixelData } from '../../../src/reader/index.ts';

const UI = path.resolve(import.meta.dirname, '../../../src/ui');
const read = (file: string): string => readFileSync(path.join(UI, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const shell = read('Shell.module.css');
const scan = read('screens/scan/ScanScreen.module.css');
const tokens = readFileSync(path.join(UI, 'theme/tokens.css'), 'utf8');

/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) if (match[1]!.trim() === selector) return match[2]!;
  return '';
}
const photo = (): PixelData => ({ width: 2, height: 2, data: new Uint8ClampedArray(16) });

describe('screen change fade', () => {
  it('each screen has its own animation of --motion-short (120 ms, under 200 ms), so a change of screen starts it again', () => {
    expect(tokens).toMatch(/--motion-short:\s*120ms;/);
    const names = new Set<string>();
    for (const screen of ['weave', 'keep', 'scan', 'code']) {
      const body = rule(shell, `.main[data-screen='${screen}']`);
      expect(body, screen).toMatch(/animation:\s*\w+ var\(--motion-short\) ease-out;/);
      names.add(/animation:\s*(\w+)/.exec(body)![1]!);
    }
    expect(names.size).toBe(4);
  });

  it('the fade changes opacity only, so nothing moves', () => {
    for (const name of ['fadeWeave', 'fadeKeep', 'fadeScan', 'fadeCode']) {
      const body = new RegExp(`@keyframes ${name}\\s*\\{([\\s\\S]*?\\}\\s*)\\}`).exec(shell)![1]!;
      expect(body).toMatch(/opacity:\s*0/);
      expect(body).not.toMatch(/transform|translate|margin|padding|width|height|top|left/);
    }
  });

  it('reduced motion gets no fade: the sheet has no media query, and the global reduced-motion rule ends every animation', () => {
    expect(shell).not.toContain('@media');
    const reduce = /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/.exec(tokens)![1]!;
    expect(reduce).toMatch(/animation:\s*none !important/);
  });
});

describe('Scan highlight sweep', () => {
  it('is one decorative element in the photo stage, drawn once for a read', () => {
    const image = photo();
    const html = renderToStaticMarkup(
      <CardOverlay image={image} markers={[]} hookRows={1} hookColumns={1} zoom={1} hitPx={48} onToggle={() => undefined} t={(key) => key} />,
    );
    expect(html.match(/data-sweep/g)).toHaveLength(1);
    expect(html).toMatch(/<span[^>]*aria-hidden="true"[^>]*data-sweep/);
  });

  it('a read has one number, kept for the same photo and new for another, so the sweep plays once per read', () => {
    const first = photo();
    expect(readNumberOf(first)).toBe(readNumberOf(first));
    expect(readNumberOf(photo())).not.toBe(readNumberOf(first));
  });

  it('crosses the photo once with a transform, in under 800 ms, from tokens', () => {
    const band = rule(scan, '.sweep::after');
    expect(band).toMatch(/animation:\s*sweepAcross calc\(var\(--motion-long\) \* 2\) ease-in-out 1 both;/);
    expect(320 * 2).toBeLessThan(800);
    const frames = /@keyframes sweepAcross\s*\{([\s\S]*?\}\s*)\}/.exec(scan)![1]!;
    expect(frames).toMatch(/transform:\s*translateX/);
    expect(frames).not.toMatch(/left|right|width|margin|opacity/);
    expect(rule(scan, '.sweep')).toMatch(/overflow:\s*hidden/);
    expect(rule(scan, '.sweep')).toMatch(/pointer-events:\s*none/);
  });

  it('is not drawn under reduced motion', () => {
    expect(scan).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.sweep\s*\{\s*display:\s*none;/);
  });
});
