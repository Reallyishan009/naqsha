import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import { paintToCanvas, browserScheduler } from '../../../simulator/index.ts';
import type { Player, Scheduler, SimResult } from '../../../simulator/index.ts';
import { simFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import { autoplay } from '../../platform/browser.ts';
import {
  buildReadyCloth,
  clothReducer,
  COLOURS,
  gapPickNumbers,
  MAX_REPEAT,
  MIN_REPEAT,
  viewportFor,
} from '../../state/cloth.ts';
import {
  canvasAltText,
  displayedPlayback,
  entryModeFor,
  entryPlayback,
  pickPositionText,
  riseFraction,
  riseLevel,
  riseReducer,
  focusAfterSkip,
  pickLabel,
  scrubTo,
  shownPick,
  SPEEDS,
  stepBack,
  stepForward,
} from '../../state/playback.ts';
import type { PlaybackAt } from '../../state/playback.ts';
import type { AppAction, AppState, ClothChoices, ClothView, ReadyCloth } from '../../types.ts';
import { ArtImage } from '../../components/ArtImage.tsx';
import { Button } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { CardDrawing } from '../../illustrations/CardDrawing.tsx';
import { Disclosure } from '../../components/Disclosure.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { Field } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { SectionHeader } from '../../components/SectionHeader.tsx';
import { generateSample } from '../../samples/sampleDesigns.ts';
import { ART } from '../../state/art.ts';
import { splitAtAccent } from '../../state/headline.ts';
import { ClothCanvas, createClothPlayer } from './ClothCanvas.tsx';
import { GapChip } from './GapChip.tsx';
import { RepairNotice } from './RepairNotice.tsx';
import { TryIt } from './TryIt.tsx';
import styles from './WeaveScreen.module.css';

const DEFAULT_SPEED_INDEX = 1;
const FALLBACK_WIDTH = 320;
/** Cloth height as a fraction of its width. */
const HEIGHT_RATIO = 0.6;

// buildReadyCloth lives in state/cloth.ts so Code view builds its cloth the same way; re-exported for the Weave tests.
export { buildReadyCloth };

function shownCloth(view: ClothView): ReadyCloth | null {
  switch (view.status) {
    case 'ready':
      return view.ready;
    case 'failed':
      return view.previous;
    case 'empty':
      return null;
    default: {
      const unreachable: never = view;
      return unreachable;
    }
  }
}

/** The skip control of the rise from darkness. Not shown unless the effect is running (R20.2, R20.4). */
export function RiseSkipControl({ running, t, onSkip }: { running: boolean; t: Translate; onSkip: () => void }) {
  if (!running) return null;
  return (
    <Button onClick={onSkip}>{t('weave.skipRise')}</Button>
  );
}

/**
 * What the Weave screen showed when it arrived: the design already loaded, the pick the other screen left, and
 * whether that design's cloth had been woven to the end.
 */
export type Arrival = { pattern: Pattern; pick: number; finished: boolean };

export type WeavePlayerProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  /** Taken once, when the Weave screen mounted; a design chosen later on the Landing is not an arrival (R4.2). */
  arrival: Arrival;
  /** Injected so tests can drive time; the browser uses requestAnimationFrame. */
  scheduler?: Scheduler;
};

/** The cloth, the playback controls and Try it: what the Weave screen shows once the Current_Pattern has a pick. */
export function WeavePlayer({ state, dispatch, t, arrival, scheduler = browserScheduler }: WeavePlayerProps) {
  const profile: CardProfile | null = state.profile.status === 'ready' ? state.profile.profile : null;
  const pattern = state.current.pattern;

  const choices = state.clothChoices;
  const setChoices = (next: ClothChoices): void => dispatch({ type: 'set-cloth-choices', choices: next });
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [view, dispatchCloth] = useReducer(clothReducer, { status: 'empty' } satisfies ClothView);
  const [playback, setPlayback] = useState<PlaybackAt<ReadyCloth>>({ cloth: null, state: { status: 'idle' } });
  const [rise, dispatchRise] = useReducer(riseReducer, 'off');
  const [availableWidth, setAvailableWidth] = useState(FALLBACK_WIDTH);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playButtonRef = useRef<HTMLButtonElement | null>(null);
  const pauseButtonRef = useRef<HTMLButtonElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const speedRef = useRef(SPEEDS[speedIndex] ?? SPEEDS[1]);
  speedRef.current = SPEEDS[speedIndex] ?? SPEEDS[1];
  /** The design that was already loaded when the screen arrived, and the one the player was last entered with. */
  const mountPatternRef = useRef<Pattern>(arrival.pattern);
  /** The pick the other screen left in `AppState.selectedPick` when this screen arrived (R4.2). */
  const mountPickRef = useRef<number>(arrival.pick);
  /** Whether the cloth of the design already loaded had been woven to the end when this screen arrived (R18.1). */
  const mountFinishedRef = useRef<boolean>(arrival.finished);
  const enteredPatternRef = useRef<Pattern | null>(null);
  const patternRef = useRef<Pattern>(pattern);
  patternRef.current = pattern;
  const reducedMotionRef = useRef(state.prefersReducedMotion);
  reducedMotionRef.current = state.prefersReducedMotion;

  // Follow the available width (R2.4).
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper === null) return;
    const measure = (): void => {
      const width = Math.floor(wrapper.clientWidth);
      if (width > 0) setAvailableWidth((previous) => (previous === width ? previous : width));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const availableHeight = Math.round(availableWidth * HEIGHT_RATIO);
  const viewport = viewportFor(availableWidth, availableHeight);

  // The cloth is built in the render that first shows it, not in an effect, so no commit ever pairs a new cloth
  // with the pick counter of the one before it (R2.10).
  const result = useMemo<SimResult<ReadyCloth> | null>(
    () =>
      profile === null || pattern.length === 0
        ? null
        : buildReadyCloth(profile, pattern, choices, viewport.width, viewport.height),
    [profile, pattern, choices, viewport.width, viewport.height],
  );

  // Adjusting state during the render that has the new cloth: React renders again before it commits, so `view`
  // below is the new cloth already. A failed build keeps the previous cloth (R2.12).
  const [shownResult, setShownResult] = useState<SimResult<ReadyCloth> | null>(null);
  if (shownResult !== result) {
    setShownResult(result);
    dispatchCloth(result === null ? { type: 'cloth-cleared' } : { type: 'cloth-updated', result });
  }

  // A failed build is announced once, after the render that shows the failure.
  useEffect(() => {
    if (result !== null && !result.ok) {
      dispatch({ type: 'announce', kind: 'error', messageKey: simFailureKey(result.failure) });
    }
  }, [result, dispatch]);

  const shown = shownCloth(view);
  const pickCount = shown === null ? 0 : shown.cloth.picks.length;
  const mode = entryModeFor(
    pattern,
    enteredPatternRef.current,
    mountPatternRef.current,
    mountPickRef.current,
    mountFinishedRef.current,
  );
  const autoplays = autoplay(state.prefersReducedMotion);
  // The status shown: the player's own last word while it is about the cloth on screen, and otherwise the entry
  // status that the effect below puts the player in. The pick shown is `state.selectedPick`, or the last pick woven
  // once finished. One source for each, so the counter and the player cannot disagree.
  const { status } = displayedPlayback(shown, playback, mode, state.selectedPick, pickCount, autoplays);
  const pick = shownPick(status, state.selectedPick, pickCount);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const entryRef = useRef(entryPlayback(mode, playback.state, state.selectedPick, pickCount, autoplays));
  entryRef.current = entryPlayback(mode, playback.state, state.selectedPick, pickCount, autoplays);

  // One player per cloth, entered at the position the screen is already showing.
  useEffect(() => {
    if (shown === null) {
      playerRef.current = null;
      dispatchRise({ type: 'cleared' });
      return;
    }
    const context = canvasRef.current?.getContext('2d') ?? null;
    if (context === null) {
      dispatch({ type: 'announce', kind: 'error', messageKey: 'error.generic' });
      return;
    }
    const cloth = shown;
    // The last finished fact sent for this player, so each change is sent once (R18.1, R18.3).
    let reportedFinished: boolean | null = null;
    const player = createClothPlayer({
      ready: cloth,
      paint: paintToCanvas(context),
      scheduler,
      onFrame: (report) => {
        // Every frame shown is one `select-pick`; the reducer clamps the finished frame to the last pick index, so
        // `finishedPattern` is what remembers that the cloth ended (R18.7).
        dispatch({ type: 'select-pick', pick: report.frame.pick });
        if (reportedFinished !== report.atEnd) {
          reportedFinished = report.atEnd;
          dispatch({ type: report.atEnd ? 'cloth-finished' : 'cloth-unfinished' });
        }
        if (report.atEnd) {
          dispatchRise({ type: 'finished' });
          setPlayback({ cloth, state: { status: 'finished' } });
        } else if (report.kind === 'tick') {
          setPlayback({ cloth, state: { status: 'playing' } });
        } else {
          setPlayback({ cloth, state: { status: 'idle' } });
        }
      },
    });
    playerRef.current = player;
    const count = cloth.cloth.picks.length;
    const entryMode = modeRef.current;
    enteredPatternRef.current = patternRef.current;
    if (entryMode === 'autoplay') {
      dispatchRise({ type: 'design-loaded', reducedMotion: reducedMotionRef.current });
    } else if (entryMode === 'show-finished' || entryMode === 'show-selected') {
      dispatchRise({ type: 'cleared' });
    }
    const entry = entryRef.current;
    // The entry pick is dispatched once; a finished cloth is entered one past the last pick index.
    dispatch({ type: 'select-pick', pick: entry.pick });
    if (entry.status === 'playing') player.play(entry.pick, count, speedRef.current ?? 4);
    else player.seek(shownPick(entry.status, entry.pick, count));
    // Last, so that the status the screen shows survives what the seek above reported.
    setPlayback({ cloth, state: { status: entry.status } });
    return () => {
      player.pause();
      if (playerRef.current === player) playerRef.current = null;
    };
  }, [shown, scheduler, dispatch]);

  const empty = shown === null;
  const disabled = empty;
  const rate = SPEEDS[speedIndex] ?? SPEEDS[1];

  const onPlay = (): void => {
    const player = playerRef.current;
    if (player === null || shown === null) return;
    if (status === 'paused') {
      player.resume();
      setPlayback({ cloth: shown, state: { status: 'playing' } });
      return;
    }
    const start = pick >= pickCount ? 0 : pick;
    dispatch({ type: 'select-pick', pick: start });
    player.play(start, pickCount, rate);
    setPlayback({ cloth: shown, state: { status: 'playing' } });
  };
  const onPause = (): void => {
    playerRef.current?.pause();
    if (shown !== null) setPlayback({ cloth: shown, state: { status: 'paused' } });
  };
  // The skip control disappears when used, so focus moves to the next control while it is still enabled.
  const onSkip = (): void => {
    focusAfterSkip(status, { pause: pauseButtonRef.current, play: playButtonRef.current });
    dispatchRise({ type: 'skip' });
  };
  const seekTo = (pick: number): void => {
    dispatchRise({ type: 'seek' });
    playerRef.current?.seek(pick);
  };
  const onSpeed = (index: number): void => {
    setSpeedIndex(index);
    if (status === 'playing') {
      playerRef.current?.play(pick, pickCount, SPEEDS[index] ?? rate);
    }
  };

  const gapText = shown === null ? '' : gapPickNumbers(shown.cloth.gaps).join(', ');
  const playing = status === 'playing';
  const playLabel = status === 'paused' ? t('weave.resume') : t('weave.play');
  const riseRunning = rise === 'running' && !state.prefersReducedMotion;
  const level = riseRunning ? riseLevel(riseFraction(pick, pickCount), false, false) : 1;
  const canvasSize = shown?.settings.viewport ?? viewport;
  // The card of the pick shown (the last card once finished), drawn with its lost state when the pick is a gap.
  const cardNumber = pickLabel(pick, pickCount).current;
  const cardGap = shown?.cloth.gaps.find((gap) => gap.pick === cardNumber - 1);
  const colourOptions = COLOURS.map((colour) => (
    <option key={colour.hex} value={colour.hex}>
      {t(colour.key)}
    </option>
  ));
  const zariValue = choices.zari.on ? choices.zari.tone : 'off';

  const heading = t('weave.heading');
  const headingParts = splitAtAccent(heading, t('weave.heading.accent'));
  const clothArt = ART['cloth-diamond'];

  return (
    <section aria-labelledby="screen-title" className={styles.screen}>
      {/* The Screen's heading is for assistive technology and the keyboard order; the section header below is what is read first. */}
      <h2 id="screen-title" className={styles.screenTitle}>
        {t('nav.weave')}
      </h2>
      <div className={styles.band}>
        <div className={styles.container}>
          <SectionHeader
            language={state.language}
            eyebrow={t('nav.weave')}
            before={headingParts === null ? heading : headingParts.before}
            accent={headingParts === null ? '' : headingParts.accent}
            after={headingParts === null ? '' : headingParts.after}
            subtitle={t('weave.purpose')}
            as="h3"
          />

          <div className={styles.work}>
            <Card title={t('weave.card.cloth')} className={styles.workCard}>
              <div className={styles.stack}>
                <div ref={wrapperRef} className={styles.clothArea}>
                  {empty ? (
                    <EmptyState
                      illustration={<ArtImage art={clothArt} alt="" className={styles.emptyArt} />}
                      message={t('weave.empty')}
                      next={t('tryit.intro')}
                      action={
                        <Button
                          disabled={profile === null}
                          onClick={() => {
                            if (profile === null) return;
                            dispatch({ type: 'request-sample', design: 'diamond', pattern: generateSample(profile, 'diamond') });
                          }}
                        >
                          {t('landing.trySample')}
                        </Button>
                      }
                    />
                  ) : null}
                  <div
                    className={empty ? styles.hidden : riseRunning ? styles.rise : undefined}
                    style={riseRunning ? { filter: `brightness(${level})` } : undefined}
                  >
                    <ClothCanvas
                      canvasRef={canvasRef}
                      width={canvasSize.width}
                      height={canvasSize.height}
                      altText={canvasAltText(t, pick, pickCount)}
                    />
                  </div>
                  {view.status === 'failed' ? (
                    <Notice variant="error" word={t('notice.error')}>
                      {t(simFailureKey(view.failure))}
                    </Notice>
                  ) : null}
                  {gapText === '' ? null : (
                    <p className={styles.gaps}>
                      <GapChip>{t('weave.gaps', { picks: gapText })}</GapChip>
                    </p>
                  )}
                </div>
                <p className={styles.position} data-tabular>
                  {pickPositionText(t, pick, pickCount)}
                </p>
                <div className={styles.strip}>
                  <Button ref={playButtonRef} variant="primary" disabled={disabled || playing} onClick={onPlay}>
                    {playLabel}
                  </Button>
                  <Button ref={pauseButtonRef} disabled={disabled || !playing} onClick={onPause}>
                    {t('weave.pause')}
                  </Button>
                  <Button disabled={disabled} onClick={() => seekTo(stepBack(pick, pickCount))}>
                    {t('weave.stepBack')}
                  </Button>
                  <Button disabled={disabled} onClick={() => seekTo(stepForward(pick, pickCount))}>
                    {t('weave.stepForward')}
                  </Button>
                  <RiseSkipControl running={riseRunning} t={t} onSkip={onSkip} />
                </div>
                <Field label={t('weave.scrubber')} className={styles.scrubberField}>
                  <input
                    type="range"
                    className={styles.scrubber}
                    min={0}
                    max={pickCount}
                    step={1}
                    value={Math.min(pick, pickCount)}
                    disabled={disabled}
                    onChange={(event) => seekTo(scrubTo(Number(event.currentTarget.value), pickCount))}
                  />
                </Field>
              </div>
            </Card>

            <Card title={t('weave.card.controls')} className={styles.workCard}>
              <div className={styles.stack}>
                <p className={styles.nextStep}>{t('weave.nextStep')}</p>
                {empty ? null : (
                  <div className={styles.card}>
                    <CardDrawing
                      profile={profile}
                      grid={pattern[cardNumber - 1] ?? null}
                      state={cardGap?.kind ?? 'ok'}
                      pickNumber={cardNumber}
                      t={t}
                    />
                  </div>
                )}
                <div className={styles.controls}>
                  <Field label={t('weave.speed')} className={styles.field}>
                    <select value={speedIndex} disabled={disabled} onChange={(event) => onSpeed(Number(event.currentTarget.value))}>
                      <option value={0}>{t('weave.speed.slow')}</option>
                      <option value={1}>{t('weave.speed.normal')}</option>
                      <option value={2}>{t('weave.speed.fast')}</option>
                    </select>
                  </Field>
                </div>
                {/* Repeat count, warp and weft colours and zari: collapsed on arrival so the playback controls stay in view. */}
                <Disclosure label={t('disclosure.settings')}>
                  <div className={styles.controls}>
                    <Field label={t('weave.warpColour')} className={styles.field}>
                      <select
                        value={choices.warpColour}
                        disabled={disabled}
                        onChange={(event) => setChoices({ ...choices, warpColour: event.currentTarget.value })}
                      >
                        {colourOptions}
                      </select>
                    </Field>
                    <Field label={t('weave.weftColour')} className={styles.field}>
                      <select
                        value={choices.weftColour}
                        disabled={disabled}
                        onChange={(event) => setChoices({ ...choices, weftColour: event.currentTarget.value })}
                      >
                        {colourOptions}
                      </select>
                    </Field>
                    <Field label={t('weave.zari')} className={styles.field}>
                      <select
                        value={zariValue}
                        disabled={disabled}
                        onChange={(event) => {
                          const value = event.currentTarget.value;
                          setChoices({
                            ...choices,
                            zari: value === 'gold' || value === 'silver' ? { on: true, tone: value } : { on: false },
                          });
                        }}
                      >
                        <option value="off">{t('weave.zari.off')}</option>
                        <option value="gold">{t('weave.zari.gold')}</option>
                        <option value="silver">{t('weave.zari.silver')}</option>
                      </select>
                    </Field>
                    <Field label={t('weave.repeat')} className={styles.field}>
                      <select
                        value={choices.repeat}
                        disabled={disabled}
                        onChange={(event) => setChoices({ ...choices, repeat: Number(event.currentTarget.value) })}
                      >
                        {Array.from({ length: MAX_REPEAT - MIN_REPEAT + 1 }, (_, index) => MIN_REPEAT + index).map((value) => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </Disclosure>
              </div>
            </Card>
          </div>

          <div className={styles.notice}>
            <RepairNotice
              gapCount={shown === null ? 0 : shown.cloth.gaps.length}
              repairedPicks={state.repairs.picks}
              canUndo={state.repairs.history.length > 0}
              profile={profile}
              pattern={state.current.pattern}
              t={t}
              dispatch={dispatch}
            />
          </div>

          <TryIt profile={profile} confirm={state.confirm} dispatch={dispatch} t={t} />
        </div>
      </div>
    </section>
  );
}
