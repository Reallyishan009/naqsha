import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Card } from '../../../src/ui/components/Card.tsx';
import { Chip } from '../../../src/ui/components/Chip.tsx';
import { Eyebrow } from '../../../src/ui/components/Eyebrow.tsx';
import { SectionHeader } from '../../../src/ui/components/SectionHeader.tsx';

const COMPONENTS = path.resolve(import.meta.dirname, '../../../src/ui/components');
const css = (name: string): string => readFileSync(path.join(COMPONENTS, `${name}.module.css`), 'utf8');

describe('Eyebrow', () => {
  it('the label is between two hairlines that are hidden from assistive technology', () => {
    const markup = renderToStaticMarkup(<Eyebrow>Jacquard card reader</Eyebrow>);
    const rules = markup.match(/<span class="[^"]*rule[^"]*" aria-hidden="true"><\/span>/g) ?? [];
    expect(rules).toHaveLength(2);
    expect(markup.indexOf(rules[0]!)).toBeLessThan(markup.indexOf('Jacquard card reader'));
    expect(markup.lastIndexOf(rules[1]!)).toBeGreaterThan(markup.indexOf('Jacquard card reader'));
    expect(markup.match(/aria-hidden/g)).toHaveLength(2);
  });
  it('the style spaces the letters for Latin only and has no letter spacing in Hindi', () => {
    expect(css('Eyebrow')).toMatch(/\.eyebrow\s*\{[^}]*letter-spacing:\s*0\.14em/);
    expect(css('Eyebrow')).toMatch(/\.eyebrow:lang\(hi\)\s*\{[^}]*letter-spacing:\s*0/);
  });
});

describe('Chip', () => {
  it('a chip is a plain span with its text and no role', () => {
    expect(renderToStaticMarkup(<Chip>Offline</Chip>)).toMatch(/^<span class="[^"]*quiet[^"]*">Offline<\/span>$/);
    expect(renderToStaticMarkup(<Chip tone="picture">Card</Chip>)).toMatch(/class="[^"]*picture[^"]*"/);
    expect(renderToStaticMarkup(<Chip>Offline</Chip>)).not.toContain('role=');
  });
  it('a chip over a picture has an opaque surface fill', () => {
    expect(css('Chip')).toMatch(/\.picture\s*\{[^}]*background:\s*var\(--surface\)/);
  });
});

describe('SectionHeader', () => {
  const props = { eyebrow: 'How it works', before: 'From a card to ', accent: 'cloth', after: ' in three steps', subtitle: 'Nothing leaves your device.' };
  it('has an eyebrow, a heading with the accent word in an em, and a subtitle, in that order', () => {
    const markup = renderToStaticMarkup(<SectionHeader language="en" {...props} />);
    expect(markup).toMatch(/<h2 [^>]*>From a card to <em class="[^"]*">cloth<\/em> in three steps<\/h2>/);
    expect(markup.indexOf('How it works')).toBeLessThan(markup.indexOf('<h2'));
    expect(markup.indexOf('<h2')).toBeLessThan(markup.indexOf('Nothing leaves your device.'));
  });
  it('the accent word is italic in English and a colour change only in Hindi', () => {
    const en = renderToStaticMarkup(<SectionHeader language="en" {...props} />);
    const hi = renderToStaticMarkup(<SectionHeader language="hi" {...props} />);
    expect(/<em class="([^"]*)"/.exec(en)![1]).toContain('italic');
    expect(/<em class="([^"]*)"/.exec(hi)![1]).not.toContain('italic');
    expect(css('SectionHeader')).toMatch(/\.accent\s*\{[^}]*color:\s*var\(--accent\)[^}]*font-style:\s*normal/);
    expect(css('SectionHeader')).toMatch(/\.italic\s*\{[^}]*font-style:\s*italic/);
  });
  it('takes a heading level and an id, and leaves out the subtitle when there is none', () => {
    const markup = renderToStaticMarkup(<SectionHeader language="en" {...props} subtitle={undefined} as="h3" headingId="how" />);
    expect(markup).toContain('<h3 id="how"');
    expect(markup).not.toContain('<p class="' + 'subtitle');
    expect(markup.match(/<p /g)).toHaveLength(1);
  });
});

describe('Card', () => {
  it('has the picture on top, then a serif title, the text, the chips and the action', () => {
    const markup = renderToStaticMarkup(
      <Card picture={<img src="a.avif" alt="A card" />} title="Read a card" chips={['Camera', 'Offline']} action={<button type="button">Open</button>}>
        <p>Point the camera at it.</p>
      </Card>,
    );
    const order = ['<img', '<h3', 'Point the camera', 'Camera', 'Offline', '<button'].map((part) => markup.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(markup.match(/<li[ >]/g)).toHaveLength(2);
  });
  it('leaves out the picture slot, the chips and the action when they are not given, and takes a heading level and a tag', () => {
    const markup = renderToStaticMarkup(
      <Card title="Keep" titleAs="h2" as="li">
        Saved on this device.
      </Card>,
    );
    expect(markup).toMatch(/^<li class="[^"]*"><div class="[^"]*"><h2 class="[^"]*">Keep<\/h2>/);
    expect(markup).not.toContain('<ul');
    expect(markup).not.toContain('picture');
  });
  it('is a 24 px rounded card with a soft shadow token and a picture slot', () => {
    expect(css('Card')).toMatch(/\.card\s*\{[^}]*border-radius:\s*var\(--radius-card\)[^}]*box-shadow:\s*var\(--shadow-lift\)/);
    expect(css('Card')).toMatch(/\.picture\s*\{[^}]*aspect-ratio/);
  });
});

describe('Button look', () => {
  it('is a pill, lifts 2 px on hover with the lift shadow and a motion token, and has no lift under reduced motion', () => {
    const source = css('Button');
    expect(source).toMatch(/\.button\s*\{[^}]*border-radius:\s*var\(--radius-pill\)/);
    expect(source).toMatch(/\.button:hover:not\(:disabled\)\s*\{[^}]*translate:\s*0 -2px/);
    expect(source).toMatch(/\.button:hover:not\(:disabled\):not\(\.quiet\)\s*\{[^}]*box-shadow:\s*var\(--shadow-lift\)/);
    expect(source).toMatch(/transition:[^;]*translate var\(--motion-medium\)/);
    expect(source).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*:hover:not\(:disabled\)[^}]*translate:\s*none/);
  });
  it('the secondary Button is the surface with a 1px hairline', () => {
    expect(css('Button')).toMatch(/\.secondary\s*\{[^}]*background:\s*var\(--surface\)[^}]*border:\s*1px solid var\(--ink-soft\)/);
  });
});
