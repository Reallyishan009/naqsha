import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { CardProfile, Pattern } from '../../../codec/index.ts';
import { paintToCanvas, browserScheduler, parseRenderSettings, prepareCloth } from '../../../simulator/index.ts';
import type { Player, Scheduler, SimResult } from '../../../simulator/index.ts';
import { simFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import { autoplay } from '../../platform/browser.ts';
import {
  clothReducer,
  COLOURS,
  gapPickNumbers,
  MAX_REPEAT,
  MIN_REPEAT,
  settingsFromChoices,
  viewportFor,
} from '../../state/cloth.ts';
import {
  canvasAltText,
  displayedPlayback,
  entryModeFor,
  pickPositionText,
  riseFraction,
  riseLevel,
  riseReducer,
  focusAfterSkip,
  scrubTo,
  SPEEDS,
  stepBack,
  stepForward,
} from '../../state/playback.ts';
import type { PlaybackAt } from '../../state/playback.ts';
import type { AppAction, AppState, ClothChoices, ClothView, ReadyCloth } from '../../types.ts';
import { ClothCanvas, createClothPlayer } from './ClothCanvas.tsx';
import { TryIt } from './TryIt.tsx';
import styles from './WeaveScreen.module.css';

const DEFAULT_CHOICES: ClothChoices = {
  warpColour: COLOURS[1]?.hex ?? '#2b3a67',
  weftColour: COLOURS[3]?.hex ?? '#f1ead8',
  zari: { on: false },
  repeat: 1,
};
const DEFAULT_SPEED_INDEX = 1;
const FALLBACK_WIDTH = 320;
/** Cloth height as a fraction of its width. */
const HEIGHT_RATIO = 0.6;

/** Prepares the cloth and checks the settings. Never throws; either failure comes back as a value (R2.12). */
export function buildReadyCloth(
  profile: CardProfile,
  pattern: Pattern,
  choices: ClothChoices,
  availableWidth: number,
  availableHeight: number,
): SimResult<ReadyCloth> {
  const prepared = prepareCloth(profile, pattern);
  if (!prepared.ok) return prepared;
  const settings = parseRenderSettings(settingsFromChoices(choices, availableWidth, availableHeight));
  if (!settings.ok) return settings;
  return { ok: true, value: { cloth: prepared.value, settings: settings.value } };
}

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
    <button type="button" className={styles.button} onClick={onSkip}>
      {t('weave.skipRise')}
    </button>
  );
}

export type WeaveScreenProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  /** Injected so tests can drive time; the browser uses requestAnimationFrame. */
  scheduler?: Scheduler;
};

export function WeaveScreen({ state, dispatch, t, scheduler = browserScheduler }: WeaveScreenProps) {
  const profile: CardProfile | null = state.profile.status === 'ready' ? state.profile.profile : null;
  const pattern = state.current.pattern;

  const [choices, setChoices] = useState<ClothChoices>(DEFAULT_CHOICES);
  const [speedIndex, setSpeedIndex] = useState(DEFAULT_SPEED_INDEX);
  const [view, dispatchCloth] = useReducer(clothReducer, { status: 'empty' } satisfies ClothView);
  const [playback, setPlayback] = useState<PlaybackAt<ReadyCloth>>({ cloth: null, state: { status: 'idle', pick: 0 } });
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
  const mountPatternRef = useRef<Pattern>(pattern);
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
  const mode = entryModeFor(pattern, enteredPatternRef.current, mountPatternRef.current);
  // The position shown: the player's own last word while it is about the cloth on screen, and otherwise the entry
  // state that the effect below puts the player in. One value, so the counter and the player cannot disagree.
  const current = displayedPlayback(shown, playback, mode, pickCount, autoplay(state.prefersReducedMotion));
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const currentRef = useRef(current);
  currentRef.current = current;

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
    const player = createClothPlayer({
      ready: cloth,
      paint: paintToCanvas(context),
      scheduler,
      onFrame: (report) => {
        if (report.atEnd) {
          dispatchRise({ type: 'finished' });
          setPlayback({ cloth, state: { status: 'finished', pick: report.frame.pick } });
        } else if (report.kind === 'tick') {
          setPlayback({ cloth, state: { status: 'playing', pick: report.frame.pick } });
        } else {
          setPlayback({ cloth, state: { status: 'idle', pick: report.frame.pick } });
        }
      },
    });
    playerRef.current = player;
    const count = cloth.cloth.picks.length;
    const entryMode = modeRef.current;
    enteredPatternRef.current = patternRef.current;
    if (entryMode === 'autoplay') {
      dispatchRise({ type: 'design-loaded', reducedMotion: reducedMotionRef.current });
    } else if (entryMode === 'show-finished') {
      dispatchRise({ type: 'cleared' });
    }
    const entry = currentRef.current;
    if (entry.status === 'playing') player.play(entry.pick, count, speedRef.current ?? 4);
    else player.seek(entry.pick);
    // Last, so that the state the screen shows survives what the seek above reported.
    setPlayback({ cloth, state: entry });
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
    if (current.status === 'paused') {
      player.resume();
      setPlayback({ cloth: shown, state: { status: 'playing', pick: current.pick } });
      return;
    }
    const start = current.status === 'finished' || current.pick >= pickCount ? 0 : current.pick;
    player.play(start, pickCount, rate);
    setPlayback({ cloth: shown, state: { status: 'playing', pick: start } });
  };
  const onPause = (): void => {
    playerRef.current?.pause();
    if (shown !== null) setPlayback({ cloth: shown, state: { status: 'paused', pick: current.pick } });
  };
  // The skip control disappears when used, so focus moves to the next control while it is still enabled.
  const onSkip = (): void => {
    focusAfterSkip(current.status, { pause: pauseButtonRef.current, play: playButtonRef.current });
    dispatchRise({ type: 'skip' });
  };
  const seekTo = (pick: number): void => {
    dispatchRise({ type: 'seek' });
    playerRef.current?.seek(pick);
  };
  const onSpeed = (index: number): void => {
    setSpeedIndex(index);
    if (current.status === 'playing') {
      playerRef.current?.play(current.pick, pickCount, SPEEDS[index] ?? rate);
    }
  };

  const gapText = shown === null ? '' : gapPickNumbers(shown.cloth.gaps).join(', ');
  const playing = current.status === 'playing';
  const playLabel = current.status === 'paused' ? t('weave.resume') : t('weave.play');
  const riseRunning = rise === 'running' && !state.prefersReducedMotion;
  const level = riseRunning ? riseLevel(riseFraction(current.pick, pickCount), false, false) : 1;
  const canvasSize = shown?.settings.viewport ?? viewport;
  const colourOptions = COLOURS.map((colour) => (
    <option key={colour.hex} value={colour.hex}>
      {t(colour.key)}
    </option>
  ));
  const zariValue = choices.zari.on ? choices.zari.tone : 'off';

  return (
    <section aria-labelledby="screen-title" className={styles.screen}>
      <h2 id="screen-title" className={styles.screenTitle}>
        {t('nav.weave')}
      </h2>

      <div ref={wrapperRef} className={styles.clothArea}>
        {empty ? <p className={styles.empty}>{t('weave.empty')}</p> : null}
        <div
          className={empty ? styles.hidden : riseRunning ? styles.rise : undefined}
          style={riseRunning ? { filter: `brightness(${level})` } : undefined}
        >
          <ClothCanvas
            canvasRef={canvasRef}
            width={canvasSize.width}
            height={canvasSize.height}
            altText={canvasAltText(t, current.pick, pickCount)}
          />
        </div>
        {view.status === 'failed' ? (
          <p role="alert" className={styles.failure}>
            {t(simFailureKey(view.failure))}
          </p>
        ) : null}
        {gapText === '' ? null : <p className={styles.gaps}>{t('weave.gaps', { picks: gapText })}</p>}
      </div>

      <p className={styles.position}>{pickPositionText(t, current.pick, pickCount)}</p>

      <div className={styles.row}>
        <button ref={playButtonRef} type="button" className={styles.button} disabled={disabled || playing} onClick={onPlay}>
          {playLabel}
        </button>
        <button ref={pauseButtonRef} type="button" className={styles.button} disabled={disabled || !playing} onClick={onPause}>
          {t('weave.pause')}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={disabled}
          onClick={() => seekTo(stepBack(current.pick, pickCount))}
        >
          {t('weave.stepBack')}
        </button>
        <button
          type="button"
          className={styles.button}
          disabled={disabled}
          onClick={() => seekTo(stepForward(current.pick, pickCount))}
        >
          {t('weave.stepForward')}
        </button>
        <RiseSkipControl running={riseRunning} t={t} onSkip={onSkip} />
      </div>

      <label className={styles.field}>
        <span>{t('weave.scrubber')}</span>
        <input
          type="range"
          className={styles.scrubber}
          min={0}
          max={pickCount}
          step={1}
          value={Math.min(current.pick, pickCount)}
          disabled={disabled}
          onChange={(event) => seekTo(scrubTo(Number(event.currentTarget.value), pickCount))}
        />
      </label>

      <div className={styles.controls}>
        <label className={styles.field}>
          <span>{t('weave.speed')}</span>
          <select
            className={styles.select}
            value={speedIndex}
            disabled={disabled}
            onChange={(event) => onSpeed(Number(event.currentTarget.value))}
          >
            <option value={0}>{t('weave.speed.slow')}</option>
            <option value={1}>{t('weave.speed.normal')}</option>
            <option value={2}>{t('weave.speed.fast')}</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('weave.warpColour')}</span>
          <select
            className={styles.select}
            value={choices.warpColour}
            disabled={disabled}
            onChange={(event) => setChoices({ ...choices, warpColour: event.currentTarget.value })}
          >
            {colourOptions}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('weave.weftColour')}</span>
          <select
            className={styles.select}
            value={choices.weftColour}
            disabled={disabled}
            onChange={(event) => setChoices({ ...choices, weftColour: event.currentTarget.value })}
          >
            {colourOptions}
          </select>
        </label>
        <label className={styles.field}>
          <span>{t('weave.zari')}</span>
          <select
            className={styles.select}
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
        </label>
        <label className={styles.field}>
          <span>{t('weave.repeat')}</span>
          <select
            className={styles.select}
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
        </label>
      </div>

      <TryIt profile={profile} confirm={state.confirm} dispatch={dispatch} t={t} />
    </section>
  );
}
