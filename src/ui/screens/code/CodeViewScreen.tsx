import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, FormEvent } from 'react';
import type { ArchiveDeps } from '../../../archive/index.ts';
import { patternToLines } from '../../../codec-view/index.ts';
import type { Line, LineSet, LinesResult } from '../../../codec-view/index.ts';
import { browserScheduler, paintToCanvas } from '../../../simulator/index.ts';
import type { Player, Scheduler, SimFailure, SimImage, SimResult } from '../../../simulator/index.ts';
import { simFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import { pickControlOutcome } from '../../state/codeView.ts';
import type { PickControl } from '../../state/codeView.ts';
import { buildReadyCloth, viewportFor } from '../../state/cloth.ts';
import type { AppAction, AppState, ReadyCloth } from '../../types.ts';
import { ClothCanvas, createClothPlayer } from '../weave/ClothCanvas.tsx';
import { Button } from '../../components/Button.tsx';
import { Field } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ScreenIntro } from '../../components/ScreenIntro.tsx';
import { StateMessage } from '../../components/StateMessage.tsx';
import { NothingToCompareIllustration } from '../../illustrations/SpotIllustrations.tsx';
import styles from './CodeViewScreen.module.css';
import { DiffPanel } from './DiffPanel.tsx';
import type { DiffTextDeps } from './diffText.ts';
import { Listing } from './Listing.tsx';

/** The one string that only this chunk holds, used as the id of the listing (R9.9). */
export const CODE_VIEW_MARKER = 'naqsha-code-view-listing';

const NO_LINES: ReadonlyArray<Line> = [];

const FALLBACK_WIDTH = 320;
/** Cloth height as a fraction of its width, the same ratio the Weave_Screen uses. */
const HEIGHT_RATIO = 0.6;

/** The part of a Player that Code view uses. It has no `play`, so playback cannot be started from here (R4.3). */
export type StillPlayer = Pick<Player, 'seek' | 'pause' | 'current'>;

/**
 * The Weave_Screen's cloth player, narrowed to seeking. Its frame reports are ignored: Code view only seeks, and a
 * seek's own report must not come back as a `select-pick` (the Selected_Pick is already the pick that was sought).
 */
export function createStillPlayer(options: {
  ready: ReadyCloth;
  paint: (image: SimImage) => void;
  scheduler: Scheduler;
}): StillPlayer {
  const player = createClothPlayer({ ...options, onFrame: () => undefined });
  return { seek: (pick) => player.seek(pick), pause: () => player.pause(), current: () => player.current() };
}

/** Paints the still rest frame of the Selected_Pick; nothing happens while there is no cloth (R4.3). */
export function showSelectedPick(player: StillPlayer | null, selectedPick: number): void {
  player?.seek(selectedPick);
}

/**
 * The Line_Set the listing and the diff panel work from. It is null without a ready Card_Profile (no `LinesResult`),
 * when the Pattern cannot be read as cards, and for a Current_Pattern with no picks, so that an empty design has no
 * Lines and its diff controls are disabled (R7.1, R7.6).
 */
export function currentLineSetOf(linesResult: LinesResult | null, pickCount: number): LineSet | null {
  return linesResult !== null && linesResult.ok && pickCount > 0 ? linesResult.lineSet : null;
}

/** The message for a Sim_Failure, one text for each kind (R4.4). */
export function ClothFailure({ failure, t }: { failure: SimFailure; t: Translate }) {
  return (
    <Notice variant="error" word={t('notice.error')}>
      {t(simFailureKey(failure))}
    </Notice>
  );
}

export type CodeViewScreenProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  /** Injected so tests use a fake store, as the Keep screen already does. */
  archiveDeps?: ArchiveDeps;
  scheduler?: Scheduler;
  /** Injected so tests use fakes for the clipboard and the Diff_Text download; the browser's are the default. */
  diffTextDeps?: DiffTextDeps;
};

/** The Code view screen: the Current_Pattern as one line of bits for each pick. */
export function CodeViewScreen({
  state,
  dispatch,
  t,
  archiveDeps,
  scheduler = browserScheduler,
  diffTextDeps,
}: CodeViewScreenProps) {
  const profile = state.profile.status === 'ready' ? state.profile.profile : null;
  const pattern = state.current.pattern;
  const pickCount = pattern.length;
  const lastPick = Math.max(0, pickCount - 1);
  const selectedPick = state.selectedPick;

  // The one `patternToLines` call for the Current_Pattern: the listing takes its Lines and the diff panel its Line_Set.
  const linesResult = useMemo(() => (profile === null ? null : patternToLines(profile, pattern)), [profile, pattern]);
  // Without a ready Card_Profile, or when the Pattern cannot be read as cards, there are no Lines to show.
  const currentLineSet = currentLineSetOf(linesResult, pickCount);
  const lines = currentLineSet === null ? NO_LINES : currentLineSet.lines;

  // The cloth: the Weave_Screen's own preparation and settings from the user's own choices, with only the viewport
  // taken from this screen's layout (R4.1).
  // A Card_Profile that failed to load gives no Lines and no cloth; the App's profile message takes their place (R7.6).
  const profileFailed = state.profile.status === 'failed';
  const bodyShown = pickCount > 0 && !profileFailed;
  const clothAreaRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<StillPlayer | null>(null);
  const [availableWidth, setAvailableWidth] = useState(FALLBACK_WIDTH);

  useLayoutEffect(() => {
    const area = clothAreaRef.current;
    if (area === null) return;
    const measure = (): void => {
      const width = Math.floor(area.clientWidth);
      if (width > 0) setAvailableWidth((previous) => (previous === width ? previous : width));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    return () => observer.disconnect();
  }, [bodyShown]);

  const viewport = viewportFor(availableWidth, Math.round(availableWidth * HEIGHT_RATIO));
  const clothChoices = state.clothChoices;
  const result = useMemo<SimResult<ReadyCloth> | null>(
    () =>
      profile === null || pickCount === 0
        ? null
        : buildReadyCloth(profile, pattern, clothChoices, viewport.width, viewport.height),
    [profile, pattern, pickCount, clothChoices, viewport.width, viewport.height],
  );
  const ready = result !== null && result.ok ? result.value : null;
  const failure = result !== null && !result.ok ? result.failure : null;

  // One player for each cloth, painting into the canvas through the simulator's own paint function.
  useEffect(() => {
    if (ready === null) {
      playerRef.current = null;
      return;
    }
    const context = canvasRef.current?.getContext('2d') ?? null;
    if (context === null) {
      dispatch({ type: 'announce', kind: 'error', messageKey: 'error.generic' });
      return;
    }
    const player = createStillPlayer({ ready, paint: paintToCanvas(context), scheduler });
    playerRef.current = player;
    return () => {
      player.pause();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [ready, scheduler, dispatch]);

  // Declared after the effect above, so on a new cloth the player exists by the time this runs. Seek only, never play.
  useEffect(() => {
    showSelectedPick(playerRef.current, selectedPick);
  }, [selectedPick, ready, scheduler]);

  // The step forward control, where focus goes after a Window move when the Selected_Pick's Line has no control of the
  // kind that had focus (R11.13). The Listing owns the Window, so it does the moving; the screen owns this button.
  const stepForwardRef = useRef<HTMLButtonElement | null>(null);

  const clothHeadingId = useId();
  const jumpFieldId = useId();
  const jumpErrorId = useId();
  const [jumpText, setJumpText] = useState('');
  const [jumpRejected, setJumpRejected] = useState(false);
  // The pick "run to next breakpoint" stopped on with none above; the message holds while that pick stays selected.
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);

  // Present and disabled, not absent, while there is nothing to move over (R7.1, R7.6).
  const controlsDisabled = pickCount === 0 || profile === null;
  const backDisabled = controlsDisabled || selectedPick <= 0;
  const forwardDisabled = controlsDisabled || selectedPick >= lastPick;

  const activate = (control: PickControl, text?: string): void => {
    const outcome = pickControlOutcome({
      control,
      selectedPick,
      pickCount,
      breakpoints: state.breakpoints,
      ...(text === undefined ? {} : { jumpText: text }),
    });
    for (const action of outcome.actions) dispatch(action);
    if (control === 'jump') setJumpRejected(outcome.jumpRejected);
    setStoppedAt(outcome.noFurtherBreakpoint ? lastPick : null);
  };

  const onJumpSubmit = (event: FormEvent<HTMLFormElement>): void => {
    // Enter applies the jump; it must not submit the page.
    event.preventDefault();
    activate('jump', jumpText);
  };

  return (
    <section aria-labelledby="screen-title" className={styles.screen}>
      <div className={styles.titleLine}>
        <h2 id="screen-title" className={styles.screenTitle}>
          {t('codeview.title')}
        </h2>
        <Chip>{t('nav.advanced')}</Chip>
      </div>

      <ScreenIntro purpose={t('codeview.purpose')} next={t('codeview.nextStep')} />

      {/* The compare panel comes first so its one primary Button is in view without scrolling (R23.7). */}
      <DiffPanel
        profile={profile}
        currentLineSet={currentLineSet}
        language={state.language}
        t={t}
        archiveDeps={archiveDeps}
        diffTextDeps={diffTextDeps}
        request={state.compare}
      />

      <div role="group" aria-label={t('codeview.controls.name')} className={styles.controls}>
        {pickCount === 0 ? null : (
          <p className={styles.selected}>{t('codeview.selected', { pick: selectedPick })}</p>
        )}
        <div className={styles.controls}>
          <Button disabled={backDisabled} onClick={() => activate('step-back')}>
            {t('codeview.step.back')}
          </Button>
          <Button ref={stepForwardRef} disabled={forwardDisabled} onClick={() => activate('step-forward')}>
            {t('codeview.step.forward')}
          </Button>
          <Button disabled={controlsDisabled} onClick={() => activate('run-to-next-breakpoint')}>
            {t('codeview.run.next')}
          </Button>
        </div>
        <form className={`${styles.controls} ${styles.jumpForm}`} onSubmit={onJumpSubmit} noValidate>
          <Field label={t('codeview.jump.label')} className={styles.jumpField}>
            <input
              id={jumpFieldId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={jumpText}
              disabled={controlsDisabled}
              aria-invalid={jumpRejected}
              aria-describedby={jumpRejected ? jumpErrorId : undefined}
              onChange={(event) => setJumpText(event.target.value)}
            />
          </Field>
          <Button type="submit" disabled={controlsDisabled}>
            {t('codeview.jump.button')}
          </Button>
        </form>
        {jumpRejected ? (
          <Notice variant="error" word={t('notice.error')}>
            <p id={jumpErrorId} className={styles.noticeText}>
              {t('codeview.jump.range', { first: 0, last: lastPick })}
            </p>
          </Notice>
        ) : null}
        {stoppedAt !== null && stoppedAt === selectedPick ? (
          <Notice variant="information" word={t('notice.information')}>
            {t('codeview.announce.noBreakpoint')}
          </Notice>
        ) : null}
      </div>

      {profileFailed ? (
        <Notice variant="error" word={t('notice.error')}>
          {t('error.profile.banner')}
        </Notice>
      ) : null}

      {pickCount === 0 ? (
        <StateMessage variant="empty" illustration={<NothingToCompareIllustration />} message={t('codeview.empty')} next={t('codeview.nextStep')} t={t} />
      ) : !bodyShown ? null : (
        <>
          <p className={styles.summary}>
            {profile === null ? null : <span>{t('codeview.profile', { name: profile.name })} </span>}
            <span>{t('codeview.pickCount', { count: pickCount })}</span>
          </p>
          <div className={styles.body}>
            <div className={styles.listingPane}>
              {lines.length === 0 ? null : <p className={styles.scrollHint}>{t('codeview.scrollHint')}</p>}
              {/* A Listing given no Lines for a pattern with picks would ask for a new empty Window on every render. */}
              {lines.length === 0 ? null : (
                <Listing
                  lines={lines}
                  hookColumns={profile === null ? 1 : profile.hookColumns}
                  selectedPick={selectedPick}
                  breakpoints={state.breakpoints}
                  listingId={CODE_VIEW_MARKER}
                  t={t}
                  dispatch={dispatch}
                  stepForwardRef={stepForwardRef}
                  repairedPicks={state.repairs.picks}
                />
              )}
            </div>
            <section aria-labelledby={clothHeadingId} className={styles.clothPane}>
              <h3 id={clothHeadingId} className={styles.sectionTitle}>
                {t('codeview.cloth.heading')}
              </h3>
              <div ref={clothAreaRef} className={styles.clothArea}>
                {failure === null ? null : <ClothFailure failure={failure} t={t} />}
                {ready === null ? null : (
                  <ClothCanvas
                    canvasRef={canvasRef}
                    width={ready.settings.viewport.width}
                    height={ready.settings.viewport.height}
                    altText={t('codeview.cloth.alt', { pick: selectedPick })}
                  />
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export default CodeViewScreen;
