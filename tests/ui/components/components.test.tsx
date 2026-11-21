import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from '../../../src/ui/components/Button.tsx';
import { ButtonLink } from '../../../src/ui/components/ButtonLink.tsx';
import { Field } from '../../../src/ui/components/Field.tsx';
import { Notice } from '../../../src/ui/components/Notice.tsx';
import type { NoticeVariant } from '../../../src/ui/components/Notice.tsx';
import { Panel } from '../../../src/ui/components/Panel.tsx';
import { Tabs } from '../../../src/ui/components/Tabs.tsx';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { reviewList } from '../../../src/ui/i18n/reviewList.ts';

const COMPONENTS = path.resolve(import.meta.dirname, '../../../src/ui/components');
const VARIANTS: NoticeVariant[] = ['information', 'success', 'warning', 'error'];
const noop = (): void => undefined;

function css(name: string): string {
  return readFileSync(path.join(COMPONENTS, `${name}.module.css`), 'utf8');
}

function rule(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule for ${selector}`);
  return source.slice(start, source.indexOf('}', start));
}

describe('Button', () => {
  it('R6.1 a Button is a native button of type button unless asked for submit', () => {
    expect(renderToStaticMarkup(<Button>Save</Button>)).toMatch(/^<button [^>]*type="button"/);
    expect(renderToStaticMarkup(<Button type="submit">Save</Button>)).toContain('type="submit"');
  });

  it('R6.1 a Button takes its variant from the variant prop, secondary by default', () => {
    const classes = (variant?: 'primary' | 'secondary' | 'quiet'): string =>
      /class="([^"]*)"/.exec(renderToStaticMarkup(<Button variant={variant}>x</Button>))?.[1] ?? '';
    expect(classes('primary')).toContain('primary');
    expect(classes('quiet')).toContain('quiet');
    expect(classes()).toContain('secondary');
    expect(new Set([classes('primary'), classes('secondary'), classes('quiet')]).size).toBe(3);
  });

  it('R6.2 a disabled Button uses the native disabled attribute', () => {
    const markup = renderToStaticMarkup(<Button disabled>Save</Button>);
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('aria-disabled');
  });

  it('R6.2 a disabled Button has a dashed border and no fill', () => {
    const disabled = rule(css('Button'), '.button:disabled');
    expect(disabled).toContain('border: 2px dashed var(--ink-soft)');
    expect(disabled).toContain('background: none');
  });

  it('R5.7 the primary Button is --on-zari text on --zari in every state', () => {
    const source = css('Button');
    const primary = rule(source, '.primary');
    expect(primary).toContain('color: var(--on-zari)');
    expect(primary).toContain('background: var(--zari)');
    expect(source).not.toContain('data-theme');
    expect(source).not.toMatch(/\.primary:[a-z-]+/);
  });

  it('R6.3 a Button is at least 48 px by 48 px through the touch target token', () => {
    const base = rule(css('Button'), '.button');
    expect(base).toContain('min-width: var(--touch-target)');
    expect(base).toContain('min-height: var(--touch-target)');
  });

  it('R6.4 a ButtonLink is an anchor with the Button look and the href given', () => {
    const markup = renderToStaticMarkup(
      <ButtonLink href="#scan" onActivate={noop} variant="secondary">
        Scan
      </ButtonLink>,
    );
    expect(markup).toMatch(/^<a href="#scan" class="[^"]*secondary[^"]*">Scan<\/a>$/);
  });
});

describe('Panel', () => {
  it('R7.2 a Panel is opaque --surface with a 1px --line border and the panel radius', () => {
    const panel = rule(css('Panel'), '.panel');
    expect(panel).toContain('background: var(--surface)');
    expect(panel).toContain('border: 1px solid var(--line)');
    expect(panel).toContain('border-radius: var(--radius-panel)');
    expect(panel).not.toMatch(/rgba?\(|opacity|transparent/);
  });

  it('R7.2 a Panel renders a div or a section around its content', () => {
    expect(renderToStaticMarkup(<Panel>text</Panel>)).toMatch(/^<div class="[^"]*">text<\/div>$/);
    expect(renderToStaticMarkup(<Panel as="section" aria-labelledby="h">text</Panel>)).toMatch(
      /^<section class="[^"]*" aria-labelledby="h">text<\/section>$/,
    );
  });
});

describe('Field', () => {
  it('R6.8 a Field renders a label that wraps a span with the label text and then the control', () => {
    const markup = renderToStaticMarkup(
      <Field label="Name">
        <input name="name" />
      </Field>,
    );
    expect(markup).toMatch(/^<label class="[^"]*"><span>Name<\/span><input name="name"\/><\/label>$/);
  });

  it('R6.8 a Field control is 48 px high with an --ink-soft border', () => {
    const source = css('Field');
    expect(source).toContain('min-height: var(--touch-target)');
    expect(source).toContain('border: 1px solid var(--ink-soft)');
    expect(source).not.toContain('var(--line)');
  });
});

describe('Tabs', () => {
  const items = [
    { key: 'hi', label: 'हिन्दी', lang: 'hi' },
    { key: 'en', label: 'English', lang: 'en' },
  ];

  it('R6.9 the current Tabs item has aria-pressed true, the others false', () => {
    const markup = renderToStaticMarkup(<Tabs label="Language" items={items} current="en" onChoose={noop} />);
    expect(markup).toContain('role="group" aria-label="Language"');
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(markup.match(/aria-pressed="false"/g)).toHaveLength(1);
    expect(markup).toMatch(/lang="en"[^>]*aria-pressed="true"/);
  });

  it('R6.9 only the current Tabs item has a drawn check mark and bold text', () => {
    const markup = renderToStaticMarkup(<Tabs label="Language" items={items} current="hi" onChoose={noop} />);
    expect(markup.match(/<svg/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-pressed="true"[^>]*><svg[^>]*aria-hidden="true"[^>]*data-mark="check"/);
    expect(rule(css('Tabs'), '.current')).toContain('font-weight: 700');
  });
});

describe('Notice', () => {
  const render = (variant: NoticeVariant, extra?: { role?: 'alert' | 'status' | null }): string =>
    renderToStaticMarkup(
      <Notice variant={variant} word={variant.toUpperCase()} {...extra}>
        Message
      </Notice>,
    );

  it('R6.10 each Notice variant has a different word and a different drawn icon', () => {
    const words = VARIANTS.map((variant) => translator(DICTIONARIES, 'en')(`notice.${variant}`));
    expect(new Set(words).size).toBe(4);
    const icons = VARIANTS.map((variant) => /<svg.*?<\/svg>/.exec(render(variant))?.[0] ?? '');
    expect(icons.every((icon) => icon.includes('aria-hidden="true"'))).toBe(true);
    expect(new Set(icons).size).toBe(4);
  });

  it('R6.10 each Notice shows its word and its text', () => {
    const markup = render('warning');
    expect(markup).toContain('WARNING');
    expect(markup).toContain('Message');
  });

  it('R6.10 only an error Notice has role alert by default', () => {
    expect(render('error')).toContain('role="alert"');
    for (const variant of ['information', 'success', 'warning'] as const) {
      expect(render(variant)).not.toContain('role=');
    }
  });

  it('R6.10 a Notice takes an explicit role, or none with null', () => {
    expect(render('information', { role: 'status' })).toContain('role="status"');
    expect(render('error', { role: null })).not.toContain('role=');
  });

  it('R6.10 a Notice shows an action after its text when one is given', () => {
    const markup = renderToStaticMarkup(
      <Notice variant="error" word="Problem" action={<Button>Retry</Button>}>
        Failed
      </Notice>,
    );
    expect(markup.indexOf('Failed')).toBeLessThan(markup.indexOf('Retry'));
  });

  it('R6.10 a Notice has a 2px border and an opaque --surface fill', () => {
    const notice = rule(css('Notice'), '.notice');
    expect(notice).toContain('border: 2px solid var(--notice-colour)');
    expect(notice).toContain('background: var(--surface)');
  });

  it('R6.10 the four word keys exist in both Translation_Files and Hindi is marked not reviewed', () => {
    const keys = VARIANTS.map((variant) => `notice.${variant}`);
    for (const key of keys) {
      expect(Object.hasOwn(DICTIONARIES.en, key)).toBe(true);
      expect(DICTIONARIES.hi[key]?.text).toBeTruthy();
      expect(DICTIONARIES.hi[key]?.reviewed).toBe(false);
    }
    const listed = reviewList(DICTIONARIES.hi, DICTIONARIES.en).map((entry) => entry.key);
    for (const key of keys) expect(listed).toContain(key);
  });
});
