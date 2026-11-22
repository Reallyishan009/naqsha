import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Disclosure } from '../../../src/ui/components/Disclosure.tsx';
import { EmptyState } from '../../../src/ui/components/EmptyState.tsx';
import { LoadingState } from '../../../src/ui/components/LoadingState.tsx';
import { ScreenIntro } from '../../../src/ui/components/ScreenIntro.tsx';
import { StateMessage } from '../../../src/ui/components/StateMessage.tsx';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';

const COMPONENTS = path.resolve(import.meta.dirname, '../../../src/ui/components');
const t = translator(DICTIONARIES, 'en');
const noop = (): void => undefined;

describe('Disclosure', () => {
  it('R10.6 a Disclosure is collapsed on mount, with aria-expanded false and its content still present but hidden', () => {
    const markup = renderToStaticMarkup(
      <Disclosure label="More">
        <input defaultValue="kept" />
      </Disclosure>,
    );
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toMatch(/<div id="[^"]+" class="[^"]*" hidden="">/);
    expect(markup).toContain('value="kept"');
  });

  it('R10.6 a Disclosure given expanded true is expanded and its content is not hidden', () => {
    const markup = renderToStaticMarkup(
      <Disclosure label="More" expanded onToggle={noop}>
        <input />
      </Disclosure>,
    );
    expect(markup).toContain('aria-expanded="true"');
    expect(markup).not.toContain('hidden=""');
  });

  it('R10.9 the control comes before its content and aria-controls names the content', () => {
    const markup = renderToStaticMarkup(
      <Disclosure label="Settings" id="settings-panel">
        <p>inside</p>
      </Disclosure>,
    );
    expect(markup).toContain('aria-controls="settings-panel"');
    expect(markup).toContain('id="settings-panel"');
    expect(markup.indexOf('<button')).toBeLessThan(markup.indexOf('inside'));
    expect(markup).toMatch(/<button [^>]*type="button"/);
  });

  it('R10.12 an Escape inside the content collapses it and moves focus to the control', () => {
    const source = readFileSync(path.join(COMPONENTS, 'Disclosure.tsx'), 'utf8');
    expect(source).toContain("event.key !== 'Escape'");
    expect(source.indexOf('controlRef.current?.focus()')).toBeLessThan(source.indexOf('change(false)'));
  });
});

describe('StateMessage', () => {
  it('R11.10 a retry is a secondary Button of the shared Button look', () => {
    const markup = renderToStaticMarkup(
      <StateMessage variant="error" message="The card profile could not be used." next="Try again." retry={{ label: t('state.retry'), onRetry: noop }} t={t} />,
    );
    expect(markup).toContain('>Try again</button>');
    expect(markup).toMatch(/<button [^>]*type="button"/);
    expect(/<button [^>]*class="([^"]*)"/.exec(markup)?.[1]).toContain('secondary');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('>Problem<');
  });

  it('R11.4 a non-error Notice has no role and no retry when none is given', () => {
    const markup = renderToStaticMarkup(<StateMessage variant="information" message="Nothing here." t={t} />);
    expect(markup).not.toContain('role=');
    expect(markup).not.toContain('<button');
    expect(markup).toContain('>Note<');
  });

  it('R11.4 the empty variant renders an empty state Panel with the message and the next step', () => {
    const markup = renderToStaticMarkup(
      <StateMessage variant="empty" message={t('keep.list.empty')} next={t('keep.list.empty.next')} t={t} />,
    );
    expect(markup).toContain('data-empty-state=""');
    expect(markup).toContain(t('keep.list.empty'));
    expect(markup).toContain(t('keep.list.empty.next'));
  });
});

describe('EmptyState', () => {
  it('R11.5 an illustration is shown only when given, and the message and the next step are text', () => {
    const plain = renderToStaticMarkup(<EmptyState message="No cards yet." next="Choose a photo." />);
    expect(plain).toContain('No cards yet.');
    expect(plain).toContain('Choose a photo.');
    expect(plain).not.toContain('<svg');
    const drawn = renderToStaticMarkup(
      <EmptyState illustration={<svg aria-hidden="true" />} message="No cards yet." next="Choose a photo." />,
    );
    expect(drawn).toContain('<svg aria-hidden="true"');
  });
});

describe('LoadingState', () => {
  it('R11.9 a LoadingState is one role="status" region with the text', () => {
    const markup = renderToStaticMarkup(<LoadingState text={t('status.screen')} />);
    expect(markup.match(/role="status"/g)).toHaveLength(1);
    expect(markup).toContain(t('status.screen'));
  });
});

describe('ScreenIntro', () => {
  it('R10.1 a ScreenIntro renders the purpose line and then the next-step line as two paragraphs', () => {
    const markup = renderToStaticMarkup(<ScreenIntro purpose="See the cloth." next="Press Play." />);
    expect(markup.match(/<p /g)).toHaveLength(2);
    expect(markup.indexOf('See the cloth.')).toBeLessThan(markup.indexOf('Press Play.'));
  });
});

describe('new keys', () => {
  it('R11.6 each key added by this task is in both Translation_Files, and the Hindi text is not yet reviewed', () => {
    for (const key of ['disclosure.more', 'disclosure.settings', 'state.retry', 'status.screen', 'keep.list.empty.next', 'scan.batch.empty.next']) {
      expect(DICTIONARIES.en[key], key).toBeTypeOf('string');
      expect(DICTIONARIES.hi[key]?.text, key).toBeTypeOf('string');
      expect(DICTIONARIES.hi[key]?.reviewed, key).toBe(false);
    }
  });
});
