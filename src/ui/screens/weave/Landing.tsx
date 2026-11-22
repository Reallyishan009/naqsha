import { useMemo } from 'react';
import type { Dispatch } from 'react';
import { endsPerPick } from '../../../codec/index.ts';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import { profileFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import { generateSample } from '../../samples/sampleDesigns.ts';
import type { AppAction, AppState, SampleDesign } from '../../types.ts';
import { Button, buttonClassName } from '../../components/Button.tsx';
import { ArtImage } from '../../components/ArtImage.tsx';
import { ButtonLink } from '../../components/ButtonLink.tsx';
import { Card } from '../../components/Card.tsx';
import { CurvedDivider } from '../../components/CurvedDivider.tsx';
import { LoadingState } from '../../components/LoadingState.tsx';
import { Reveal, RevealContext } from '../../components/Reveal.tsx';
import { StateMessage } from '../../components/StateMessage.tsx';
import { ProcessLoop } from '../../illustrations/ProcessLoop.tsx';
import { Photo } from '../../components/Photo.tsx';
import { ART } from '../../state/art.ts';
import { splitAtAccent } from '../../state/headline.ts';
import { PHOTOS } from '../../state/photos.ts';
import { browserObserveReveal } from '../../state/reveal.ts';
import type { ObserveReveal } from '../../state/reveal.ts';
import type { ThemeName } from '../../theme/contrast.ts';
import { BringBand, LandingFooter, NightSection } from './LandingEnd.tsx';
import { HowItWorks, SectionHeading, WhatYouCanDo } from './LandingSections.tsx';
import { SAMPLE_DESIGNS } from './TryIt.tsx';
import styles from './Landing.module.css';

/** The id of the Try a sample section (its header and its cards): the target of the hero's "Try a sample" button. */
const SAMPLES_ID = 'landing-samples';

export type SampleTileProps = {
  design: SampleDesign;
  profile: CardProfile;
  /** The design's own Pattern; its pick count is shown on the card. */
  pattern: Pattern;
  /** True for the primary Button look. The Landing's one primary Button is the hero's "Scan a card", so its tiles are all secondary. */
  primary: boolean;
  t: Translate;
  onChoose: () => void;
};

/**
 * One Sample_Design as a card: the cloth it weaves with its punch card laid on the corner, the design's name, a line
 * about it, chips with its pick and end counts, and the button "Try it". The button is the one control; its
 * invisible layer covers the whole card, so a press anywhere on the card starts the design. `data-sample` is the
 * same hook the Try it buttons carry.
 */
export function SampleTile({ design, profile, pattern, primary, t, onChoose }: SampleTileProps) {
  const cloth = ART[`cloth-${design}`];
  const card = ART[`card-${design}`];
  const picks = pattern.length;
  const ends = endsPerPick(profile);
  const chips = [
    ...(picks > 0 ? [t('keep.list.picks', { count: picks })] : []),
    ...(Number.isInteger(ends) && ends > 0 ? [t('landing.sample.ends', { count: ends })] : []),
  ];
  const name = t(`tryit.${design}`);
  return (
    <Reveal className={styles.tileItem}>
      <Card
        className={styles.sampleCard}
        titleAs="h4"
        title={name}
        chips={chips}
        picture={
          <div className={styles.samplePicture}>
            <ArtImage art={cloth} alt={t(cloth.altKey)} lazy className={styles.sampleCloth} />
            <ArtImage art={card} alt={t(card.altKey)} lazy className={styles.sampleCardArt} />
          </div>
        }
        action={
          <button
            type="button"
            data-sample={design}
            className={buttonClassName(primary ? 'primary' : 'secondary', styles.tileButton)}
            aria-label={t('landing.tile.try.name', { design: name })}
            onClick={onChoose}
          >
            {t('landing.tile.try')}
          </button>
        }
      >
        <p>{t(`landing.sample.${design}`)}</p>
      </Card>
    </Reveal>
  );
}

/** A Sample_Design with its own Pattern, which the tile draws as its Cloth_Preview. */
export type SamplePreview = { design: SampleDesign; pattern: Pattern };

export type SampleTilesProps = {
  profile: AppState['profile'];
  /** One per Sample_Design once the profile is ready, otherwise null. */
  previews: ReadonlyArray<SamplePreview> | null;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  onRetryProfile?: () => void;
};

/** The three tiles, or the loading message or the failure in their place while there is no Card_Profile (R8.11, R8.13). */
export function SampleTiles({ profile, previews, dispatch, t, onRetryProfile }: SampleTilesProps) {
  if (profile.status === 'loading') return <LoadingState text={t('status.loading')} />;
  if (profile.status === 'failed') {
    return (
      <StateMessage
        variant="error"
        // The Shell already announced the failure, so this copy of it has no role.
        role={null}
        message={t(profileFailureKey(profile.failure))}
        retry={onRetryProfile === undefined ? undefined : { label: t('state.retry'), onRetry: onRetryProfile }}
        t={t}
      />
    );
  }
  if (previews === null) return null;
  const ready = profile.profile;
  return (
    <div className={styles.tiles}>
      {previews.map(({ design, pattern }) => (
        <SampleTile
          key={design}
          design={design}
          profile={ready}
          pattern={pattern}
          primary={false}
          t={t}
          onChoose={() => dispatch({ type: 'request-sample', design, pattern: generateSample(ready, design) })}
        />
      ))}
    </div>
  );
}

export type LandingProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  onRetryProfile?: () => void;
  /** The theme in use; the Night section's button offers the other one. Day when the caller gives none. */
  theme?: ThemeName;
  /** The handler of the header's Night loom switch; the Night section's button calls it with the theme it switches to. */
  onThemeChosen?: (theme: ThemeName) => void;
  /** Tells when a block comes into view, for the scroll reveal. The browser's IntersectionObserver when the caller gives none; a test gives a fake. */
  observeReveal?: ObserveReveal;
};

/** Scrolls the Try a sample section into view and puts keyboard focus on the first sample (or on the section while it holds a message). */
function showSamples(smooth: boolean): void {
  const area = document.getElementById(SAMPLES_ID);
  if (area === null) return;
  area.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  const target = area.querySelector<HTMLElement>('[data-sample]') ?? area;
  target.focus({ preventScroll: true });
}

/**
 * The first Screen, a scrolling page. The hero comes first: a loom photo under a deep-green tint, the headline, one
 * line of what the app does, "Scan a card" and "Try a sample", three facts, and the live Process_Loop on a tilted
 * card; a curved divider hands over to the page below. Seven sections in all: the hero, how it works, what you can do,
 * the samples, the Night section, the "Bring a card" band and the footer, all in one container with the hero's text, so every
 * left edge is the same. Shown as the 'home' screen. The hero's text comes before the photo in the
 * markup, so the headline is read first.
 */
export function Landing({ state, dispatch, t, onRetryProfile, theme = 'day', onThemeChosen, observeReveal = browserObserveReveal }: LandingProps) {
  const ready: CardProfile | null = state.profile.status === 'ready' ? state.profile.profile : null;
  const previews = useMemo<ReadonlyArray<SamplePreview> | null>(
    () => (ready === null ? null : SAMPLE_DESIGNS.map((design) => ({ design, pattern: generateSample(ready, design) }))),
    [ready],
  );
  // The pick count of the Diamond sample is read from the Pattern that was generated, never written down.
  const diamond = previews?.find((preview) => preview.design === 'diamond') ?? null;
  const headline = t('landing.headline');
  const parts = splitAtAccent(headline, t('landing.headline.accent'));
  const accentClass = state.language === 'hi' ? styles.accent : `${styles.accent} ${styles.italic}`;
  const reveal = useMemo(() => ({ reducedMotion: state.prefersReducedMotion, observe: observeReveal }), [state.prefersReducedMotion, observeReveal]);
  return (
    <RevealContext value={reveal}>
      <section aria-labelledby="screen-title" className={styles.screen}>
        <div className={styles.landing}>
          <h2 id="screen-title" className={styles.screenTitle}>
            {t('nav.home')}
          </h2>
          <div className={styles.hero} data-landing-section="hero">
            <div className={styles.heroInner}>
              <div className={styles.heroText}>
                <p className={styles.pill}>{t('landing.eyebrow')}</p>
                <h3 className={styles.headline}>
                  {parts === null ? (
                    headline
                  ) : (
                    <>
                      {parts.before}
                      <em className={accentClass}>{parts.accent}</em>
                      {parts.after}
                    </>
                  )}
                </h3>
                <p className={styles.lead}>{t('landing.lead')}</p>
                <div className={styles.actions}>
                  <Button variant="primary" onClick={() => dispatch({ type: 'navigate', screen: 'scan' })}>
                    {t('nav.scanCard')}
                  </Button>
                  <Button onClick={() => showSamples(!state.prefersReducedMotion)}>{t('landing.trySample')}</Button>
                </div>
                <ul className={styles.facts} aria-label={t('landing.facts.name')}>
                  <li className={styles.fact}>
                    <strong className={styles.factValue}>{t('landing.fact.uploads.value')}</strong>
                    <span className={styles.factLabel}>{t('landing.fact.uploads.label')}</span>
                  </li>
                  <li className={styles.fact}>
                    <strong className={styles.factValue}>{t('landing.fact.offline.value')}</strong>
                    <span className={styles.factLabel}>{t('landing.fact.offline.label')}</span>
                  </li>
                  {diamond === null ? null : (
                    <li className={styles.fact}>
                      <strong className={styles.factValue}>{diamond.pattern.length}</strong>
                      <span className={styles.factLabel}>{t('landing.fact.picks.label')}</span>
                    </li>
                  )}
                </ul>
              </div>
              {/* The live Process_Loop on a slightly tilted card. Its slot keeps its place from the first paint. */}
              <div className={styles.mediaSlot} data-hero-slot="">
                <div className={styles.mediaCard}>
                  {ready !== null && diamond !== null ? (
                    <ProcessLoop profile={ready} pattern={diamond.pattern} reducedMotion={state.prefersReducedMotion} t={t} />
                  ) : null}
                </div>
              </div>
            </div>
            {/* The photo and its tint sit behind the text. The tint is what keeps the text at AA (HERO_TINT in contrast.ts). */}
            <div className={styles.heroMedia}>
              <Photo photo={PHOTOS['loom-hero']} alt={t(PHOTOS['loom-hero'].altKey)} className={styles.heroPhoto} sizes="100vw" />
              <div className={styles.tint} aria-hidden="true" />
              <div className={styles.shade} aria-hidden="true" />
            </div>
            <CurvedDivider className={styles.divider} />
          </div>
          <HowItWorks language={state.language} t={t} />
          <WhatYouCanDo language={state.language} t={t} profile={ready} dispatch={dispatch} />
          <section className={styles.samplesBand} data-landing-section="samples">
            <div
              id={SAMPLES_ID}
              className={styles.samples}
              tabIndex={-1}
              role="group"
              aria-labelledby="landing-try-title"
            >
              <SectionHeading language={state.language} t={t} prefix="landing.try" headingId="landing-try-title" />
              <SampleTiles profile={state.profile} previews={previews} dispatch={dispatch} t={t} onRetryProfile={onRetryProfile} />
              <div className={styles.scanLink}>
                <ButtonLink href="#scan" variant="quiet" onActivate={() => dispatch({ type: 'navigate', screen: 'scan' })}>
                  {t('landing.scanLink')}
                </ButtonLink>
              </div>
            </div>
          </section>
          <NightSection language={state.language} t={t} theme={theme} onThemeChosen={onThemeChosen} />
          <BringBand
            language={state.language}
            t={t}
            onScan={() => dispatch({ type: 'navigate', screen: 'scan' })}
            onTrySample={() => showSamples(!state.prefersReducedMotion)}
          />
          <LandingFooter t={t} dispatch={dispatch} />
        </div>
      </section>
    </RevealContext>
  );
}
