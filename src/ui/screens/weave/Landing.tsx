import { useMemo } from 'react';
import type { Dispatch } from 'react';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import { profileFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import { generateSample } from '../../samples/sampleDesigns.ts';
import type { AppAction, AppState, SampleDesign } from '../../types.ts';
import { buttonClassName } from '../../components/Button.tsx';
import { ButtonLink } from '../../components/ButtonLink.tsx';
import { LoadingState } from '../../components/LoadingState.tsx';
import { ScreenIntro } from '../../components/ScreenIntro.tsx';
import { StateMessage } from '../../components/StateMessage.tsx';
import { ClothPreview } from './ClothPreview.tsx';
import { SAMPLE_DESIGNS } from './TryIt.tsx';
import styles from './Landing.module.css';

const STEP_KEYS: ReadonlyArray<string> = ['landing.step.scan', 'landing.step.weave', 'landing.step.keep'];

export type SampleTileProps = {
  design: SampleDesign;
  profile: CardProfile;
  /** The design's own Pattern, drawn as the Cloth_Preview. */
  pattern: Pattern;
  /** The first tile is styled as the primary Button and the others as the secondary Button (R8.5). */
  primary: boolean;
  t: Translate;
  onChoose: () => void;
};

/**
 * One Sample_Design as one control: its name, a picture of its cloth and the label "Try it". The whole area is the
 * button, so a press anywhere on it starts the design. `data-sample` is the same hook the Try it buttons carry.
 */
export function SampleTile({ design, profile, pattern, primary, t, onChoose }: SampleTileProps) {
  return (
    <button
      type="button"
      data-sample={design}
      className={buttonClassName(primary ? 'primary' : 'secondary', styles.tile)}
      onClick={onChoose}
    >
      <span className={styles.tileBody}>
        <span className={styles.tileName}>{t(`tryit.${design}`)}</span>
        <ClothPreview profile={profile} pattern={pattern} />
        <span className={styles.tileTry}>{t('landing.tile.try')}</span>
      </span>
    </button>
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
      {previews.map(({ design, pattern }, index) => (
        <SampleTile
          key={design}
          design={design}
          profile={ready}
          pattern={pattern}
          primary={index === 0}
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
};

/**
 * The first Screen: what Naqsha does, in three steps, and three designs to try. Shown while the Current_Pattern has
 * no pick. In reading order: heading, headline, two intro lines, the place for the Hero_Loom, the three steps, the
 * tiles and the link to Scan. The Hero_Loom holds nothing to focus, so CSS may place it elsewhere.
 */
export function Landing({ state, dispatch, t, onRetryProfile }: LandingProps) {
  const ready: CardProfile | null = state.profile.status === 'ready' ? state.profile.profile : null;
  const previews = useMemo<ReadonlyArray<SamplePreview> | null>(
    () => (ready === null ? null : SAMPLE_DESIGNS.map((design) => ({ design, pattern: generateSample(ready, design) }))),
    [ready],
  );
  return (
    <section aria-labelledby="screen-title" className={styles.screen}>
      <div className={styles.landing}>
        <h2 id="screen-title" className={styles.screenTitle}>
          {t('nav.weave')}
        </h2>
        <h3 className={styles.headline}>{t('landing.headline')}</h3>
        <div className={styles.intro}>
          <ScreenIntro purpose={t('weave.purpose')} next={t('weave.empty')} />
        </div>
        {/* Reserved for the Hero_Loom, at the size it will have, so the page does not move when it arrives. */}
        <div className={styles.heroSlot} data-hero-slot="" aria-hidden="true" />
        <ol className={styles.steps} aria-label={t('landing.steps.name')}>
          {STEP_KEYS.map((key) => (
            <li key={key} className={styles.step}>
              {/* The place of the Step_Icon; until it is drawn, the number of the step fills it. */}
              <span className={styles.stepMark} aria-hidden="true" />
              <span className={styles.stepLabel}>{t(key)}</span>
            </li>
          ))}
        </ol>
        <div className={styles.tilesArea}>
          <SampleTiles profile={state.profile} previews={previews} dispatch={dispatch} t={t} onRetryProfile={onRetryProfile} />
        </div>
        <div className={styles.scanLink}>
          <ButtonLink href="#scan" variant="quiet" onActivate={() => dispatch({ type: 'navigate', screen: 'scan' })}>
            {t('landing.scanLink')}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
