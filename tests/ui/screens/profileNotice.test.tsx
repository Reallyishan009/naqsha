import { renderToStaticMarkup } from 'react-dom/server';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { ProfileNotice } from '../../../src/ui/ProfileNotice.tsx';
import type { Language } from '../../../src/ui/types.ts';
import { cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';

const SEED = 20240613;
const NUM_RUNS = 100;

function render(language: Language, profile = demoProfile()): string {
  return renderToStaticMarkup(<ProfileNotice profile={profile} t={translator(DICTIONARIES, language)} />);
}

function escape(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#x27;');
}

describe('ProfileNotice', () => {
  it('R22.1 R22.5 the demo profile shows its name, the sentence and the status text unchanged', () => {
    const profile = demoProfile();
    const html = render('en');
    const t = translator(DICTIONARIES, 'en');
    expect(html).toContain(escape(profile.name));
    expect(html).toContain(escape(t('notice.unverifiedProfile')));
    expect(html).toContain(escape(profile.status as string));
  });

  it('R22.11 switching language changes the sentence and keeps the status text', () => {
    const profile = demoProfile();
    const en = render('en');
    const hi = render('hi');
    const tEn = translator(DICTIONARIES, 'en');
    const tHi = translator(DICTIONARIES, 'hi');
    expect(tEn('notice.unverifiedProfile')).not.toBe(tHi('notice.unverifiedProfile'));
    expect(hi).toContain(escape(tHi('notice.unverifiedProfile')));
    expect(hi).not.toContain(escape(tEn('notice.unverifiedProfile')));
    expect(en).toContain(escape(profile.status as string));
    expect(hi).toContain(escape(profile.status as string));
  });

  it('R22.10 the notice has a word and an icon, and no live region', () => {
    for (const language of ['en', 'hi'] as const) {
      const html = render(language);
      expect(html).toContain(escape(translator(DICTIONARIES, language)('notice.badge')));
      expect(html).toContain('aria-hidden="true"');
      expect(html).not.toContain('aria-live');
      expect(html).not.toContain('role=');
    }
  });

  it('R22.8 a profile with no status shows the name and no notice', () => {
    const { status: _status, ...withoutStatus } = demoProfile();
    const html = render('en', withoutStatus);
    const t = translator(DICTIONARIES, 'en');
    expect(html).toContain(escape(withoutStatus.name));
    expect(html).not.toContain(escape(t('notice.unverifiedProfile')));
    expect(html).not.toContain(escape(t('notice.badge')));
  });

  it('R22.9 the name and status shown come from the profile at runtime', () => {
    fc.assert(
      fc.property(
        cardProfileArbitrary,
        fc.stringMatching(/^[A-Za-z0-9 ]{1,20}$/),
        fc.stringMatching(/^[A-Za-z0-9 ]{0,20}$/),
        fc.constantFrom<Language>('en', 'hi'),
        (base, name, extra, language) => {
          const status = `${extra}UNVERIFIED`;
          const html = render(language, { ...base, name, status });
          expect(html).toContain(escape(name));
          expect(html).toContain(escape(status));
          expect(html).toContain(escape(translator(DICTIONARIES, language)('notice.unverifiedProfile')));
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
