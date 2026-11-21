import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Reveal, RevealContext } from '../../../src/ui/components/Reveal.tsx';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('Reveal', () => {
  it('is drawn visible: before the page has measured it there is no data-reveal attribute, so no content is hidden', () => {
    const html = renderToStaticMarkup(<Reveal>text</Reveal>);
    expect(html).toContain('text');
    expect(html).not.toContain('data-reveal');
  });

  it('draws the tag it is given, with its class and data attributes', () => {
    const html = renderToStaticMarkup(
      <ul>
        <Reveal as="li" className="mine" data={{ 'data-step': 'card' }}>
          one
        </Reveal>
      </ul>,
    );
    expect(html).toMatch(/<li [^>]*class="[^"]*mine[^"]*"/);
    expect(html).toContain('data-step="card"');
  });

  it('is drawn visible with a provider that has no observer and under reduced motion', () => {
    for (const reducedMotion of [false, true]) {
      const html = renderToStaticMarkup(
        <RevealContext value={{ reducedMotion, observe: () => null }}>
          <Reveal>text</Reveal>
        </RevealContext>,
      );
      expect(html).not.toContain('data-reveal');
    }
  });
});

describe('Reveal styles', () => {
  const css = readFileSync(path.join(ROOT, 'src/ui/components/Reveal.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const tokens = readFileSync(path.join(ROOT, 'src/ui/theme/tokens.css'), 'utf8');

  it('under reduced motion a rule shows every block, after the rule that hides it, so reduced motion never gets a hidden block', () => {
    const hide = css.indexOf("[data-reveal='pending']");
    const media = css.indexOf('@media (prefers-reduced-motion: reduce)');
    expect(hide).toBeGreaterThanOrEqual(0);
    expect(media).toBeGreaterThan(hide);
    const shown = /\.reveal\[data-reveal\]\s*\{([^}]*)\}/.exec(css.slice(media))?.[1] ?? '';
    expect(shown).toMatch(/opacity:\s*1/);
    expect(shown).toMatch(/translate:\s*none/);
  });

  it('the block rises 12 px and settles in at most 320 ms, both from tokens', () => {
    expect(tokens).toMatch(/--reveal-rise:\s*12px;/);
    expect(tokens).toMatch(/--motion-long:\s*320ms;/);
    expect(css).toContain('translate: 0 var(--reveal-rise)');
    expect(css).toMatch(/transition:\s*opacity var\(--motion-long\)/);
  });
});
