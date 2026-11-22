import type { Dispatch } from 'react';
import type { Translate } from '../../i18n/messages.ts';
import type { AppAction, Language, Screen } from '../../types.ts';
import { ArtImage } from '../../components/ArtImage.tsx';
import { Button } from '../../components/Button.tsx';
import { ButtonLink } from '../../components/ButtonLink.tsx';
import { Photo } from '../../components/Photo.tsx';
import { PhotoCredits } from '../../components/PhotoCredits.tsx';
import { Reveal } from '../../components/Reveal.tsx';
import { BrandMark } from '../../illustrations/BrandMark.tsx';
import { splitAtAccent } from '../../state/headline.ts';
import { ART } from '../../state/art.ts';
import { PHOTOS } from '../../state/photos.ts';
import { FONT_CREDITS, REPOSITORY_LICENCE, REPOSITORY_URL } from '../../state/siteCredits.ts';
import type { ThemeName } from '../../theme/contrast.ts';
import styles from './LandingEnd.module.css';

/** The heading of a closing section: its words, with the one accent word in an `em` (italic in Latin; in Hindi a change of colour only). */
function AccentHeading({ text, accent, language, id, className }: { text: string; accent: string; language: Language; id: string; className: string }) {
  const parts = splitAtAccent(text, accent);
  const accentClass = language === 'hi' ? styles.accent : `${styles.accent} ${styles.italic}`;
  return (
    <h3 id={id} className={className}>
      {parts === null ? (
        text
      ) : (
        <>
          {parts.before}
          <em className={accentClass}>{parts.accent}</em>
          {parts.after}
        </>
      )}
    </h3>
  );
}

export type NightSectionProps = {
  language: Language;
  t: Translate;
  /** The theme in use now; the button offers the other one. */
  theme: ThemeName;
  /** The handler the Night loom switch of the header calls (App stores the choice and applies it). */
  onThemeChosen?: (theme: ThemeName) => void;
};

/**
 * Section 5: the Kanchipuram photo under a dark tint, a few words, and a button that really switches the theme: to
 * night by day, back to day at night. The button is a secondary Button (the Landing has one primary Button, the
 * hero's "Scan a card"); on the dark tint it is a light button.
 */
export function NightSection({ language, t, theme, onThemeChosen }: NightSectionProps) {
  const photo = PHOTOS['kanchipuram-handloom'];
  const night = theme === 'night';
  return (
    <section aria-labelledby="landing-night-title" className={styles.night} data-landing-section="night">
      <div className={styles.nightMedia}>
        <Photo photo={photo} alt={t(photo.altKey)} lazy className={styles.nightPhoto} sizes="100vw" />
        <div className={styles.nightTint} aria-hidden="true" />
      </div>
      <Reveal className={styles.inner}>
        <p className={styles.eyebrow}>{t('landing.night.eyebrow')}</p>
        <AccentHeading
          text={t('landing.night.heading')}
          accent={t('landing.night.heading.accent')}
          language={language}
          id="landing-night-title"
          className={styles.heading}
        />
        <p className={styles.text}>{t('landing.night.text')}</p>
        <div className={styles.actions}>
          <Button data-theme-choice={night ? 'day' : 'night'} onClick={() => onThemeChosen?.(night ? 'day' : 'night')}>
            {t(night ? 'landing.night.actionBack' : 'landing.night.action')}
          </Button>
        </div>
      </Reveal>
    </section>
  );
}

export type BringBandProps = {
  language: Language;
  t: Translate;
  onScan: () => void;
  onTrySample: () => void;
};

/** Section 6: the deep-green band "Bring a card", with Scan and Sample (both secondary Buttons), one plain line about privacy and, beside the text (below it on a narrow screen), the chain of eight cards. */
export function BringBand({ language, t, onScan, onTrySample }: BringBandProps) {
  const chain = ART['chain-8'];
  return (
    <section aria-labelledby="landing-band-title" className={styles.band} data-landing-section="band">
      <Reveal className={styles.bandInner}>
        <div className={styles.bandText}>
          <AccentHeading
            text={t('landing.band.heading')}
            accent={t('landing.band.heading.accent')}
            language={language}
            id="landing-band-title"
            className={styles.heading}
          />
          <p className={styles.text}>{t('landing.band.text')}</p>
          <div className={styles.actions}>
            <Button onClick={onScan}>{t('nav.scanCard')}</Button>
            <Button onClick={onTrySample}>{t('landing.trySample')}</Button>
          </div>
          <p className={styles.privacy}>{t('landing.band.privacy')}</p>
        </div>
        {/* A calm picture the app made itself: a chain of eight cards laced together. It is already in the offline precache. */}
        <div className={styles.bandPicture}>
          <ArtImage art={chain} alt={t(chain.altKey)} lazy className={styles.bandArt} />
        </div>
      </Reveal>
    </section>
  );
}
/** The screens the footer links to, in the order of the header's navigation. */
const FOOTER_SCREENS: ReadonlyArray<Exclude<Screen, 'home'>> = ['weave', 'keep', 'scan', 'code'];

export type LandingFooterProps = {
  t: Translate;
  dispatch: Dispatch<AppAction>;
};

/**
 * Section 7: the cream footer. Everything in it is left-aligned running text: the mark and one line, the links to
 * the four screens, the licence, the source on GitHub, how the app was made, the font credits and the photo credits
 * (the last list is generated from docs/IMAGE_CREDITS.md).
 */
export function LandingFooter({ t, dispatch }: LandingFooterProps) {
  const base = import.meta.env.BASE_URL;
  return (
    <footer className={styles.footer} data-landing-section="footer">
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.brand}>
            <BrandMark className={styles.mark} />
            <span className={styles.brandName}>{t('app.title')}</span>
          </div>
          <p className={styles.footerLine}>{t('landing.footer.line')}</p>
          {/* A named list, not a second <nav>: the Shell keeps one navigation landmark (R4.9). */}
          <ul className={styles.links} aria-label={t('landing.footer.links')}>
            {FOOTER_SCREENS.map((screen) => (
              <li key={screen}>
                <ButtonLink
                  href={`#${screen}`}
                  variant="quiet"
                  onActivate={() => dispatch({ type: 'navigate', screen })}
                >
                  {t(`nav.${screen}`)}
                </ButtonLink>
              </li>
            ))}
          </ul>
        </div>
        <ul className={styles.facts} data-footer-facts="">
          <li>{t('landing.footer.licence', { licence: REPOSITORY_LICENCE })}</li>
          <li>
            <a className={styles.link} href={REPOSITORY_URL} target="_blank" rel="noopener">
              {t('landing.footer.github')}
            </a>
          </li>
          <li>{t('landing.footer.built')}</li>
        </ul>
        <section className={styles.credits} aria-labelledby="landing-fonts-title" data-font-credits="">
          <h3 id="landing-fonts-title" className={styles.creditsHeading}>
            {t('landing.footer.fonts.heading')}
          </h3>
          <ul className={styles.creditList}>
            {FONT_CREDITS.map((font) => (
              <li key={font.family} data-font-family={font.family}>
                {t('landing.footer.fonts.item', { family: font.family, foundry: font.foundry })}
                {' · '}
                <a className={styles.link} href={`${base}fonts/${font.licenceFile}`} target="_blank" rel="noopener">
                  {font.licence}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <div className={styles.photoCredits}>
          <PhotoCredits t={t} headingId="landing-photos-title" />
        </div>
      </div>
    </footer>
  );
}
