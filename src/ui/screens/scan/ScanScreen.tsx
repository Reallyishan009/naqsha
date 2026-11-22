import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch, ReactNode } from 'react';
import type { CardProfile } from '../../../codec/index.ts';
import type { PixelData, ReadFailure as CardReadFailure } from '../../../reader/index.ts';
import { readFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import { ART } from '../../state/art.ts';
import { hookMarkers } from '../../state/corrections.ts';
import {
  hookSpacingCssPx,
  initialScanState,
  initialZoom,
  markerHitPx,
  readPhoto,
  RequestCounter,
  scanReducer,
  ZOOM_STEP,
} from '../../state/scan.ts';
import type { LoadPixels } from '../../state/scan.ts';
import { browserIsOnline, cameraControl, fetchDemoImageFile } from '../../platform/browser.ts';
import { ProfileNotice } from '../../ProfileNotice.tsx';
import { ArtImage } from '../../components/ArtImage.tsx';
import { Button } from '../../components/Button.tsx';
import { useAfterDelay } from '../../components/delay.ts';
import { Disclosure } from '../../components/Disclosure.tsx';
import { Field } from '../../components/Field.tsx';
import { Panel } from '../../components/Panel.tsx';
import { ScreenIntro } from '../../components/ScreenIntro.tsx';
import { StateMessage } from '../../components/StateMessage.tsx';
import { NoCardsScannedIllustration } from '../../illustrations/SpotIllustrations.tsx';
import { WeftProgress } from '../../components/WeftProgress.tsx';
import type { AppAction, AppState, HookPosition, ScanBatch, ScanState } from '../../types.ts';
import { BatchList } from './BatchList.tsx';
import { DemoCards } from './DemoCards.tsx';
import type { DemoNotice } from './DemoCards.tsx';
import { demoFileName, fetchDemoImage } from '../../state/demoCards.ts';
import type { DemoImage } from '../../state/demoCards.ts';
import { browserCameraDevice, browserCameraEnv } from './camera.ts';
import { CardOverlay } from './CardOverlay.tsx';
import { LiveCamera } from './LiveCamera.tsx';
import styles from './ScanScreen.module.css';

const noopDemo = (): void => undefined;

/** Width in CSS pixels assumed for the photo before the real width is measured. */
const DEFAULT_VIEW_WIDTH_PX = 320;

export type ScanViewProps = {
  profile: CardProfile | null;
  scan: ScanState;
  batch: ScanBatch;
  pendingRemove: number | null;
  /** Index of the card the next photo replaces, or null. */
  replacingIndex: number | null;
  confirmingDone: boolean;
  viewWidthPx: number;
  t: Translate;
  onFile: (file: File) => void;
  /** A demo card was pressed. Absent in tests that do not press one. */
  onDemo?: (image: DemoImage) => void;
  /** What the last demo press could not load, or null. */
  demoNotice?: DemoNotice | null;
  onToggle: (position: HookPosition) => void;
  onUndo: () => void;
  onZoom: (zoom: number) => void;
  onAccept: () => void;
  onDiscard: () => void;
  onRemoveRequest: (index: number) => void;
  onRemoveConfirm: () => void;
  onRemoveCancel: () => void;
  onMove: (index: number, by: -1 | 1) => void;
  onScanAgain: (index: number) => void;
  onCancelReplacing: () => void;
  onDone: () => void;
  onCommit: (mode: 'replace' | 'append') => void;
  onDoneCancel: () => void;
  /** The live camera control, drawn below photo upload. Absent when there is none. */
  cameraSlot?: ReactNode;
  /** The "More" Disclosure is controlled by the screen, which opens it when a read completes. Absent: it keeps its own state. */
  moreExpanded?: boolean;
  onMoreToggle?: (expanded: boolean) => void;
  /** Decides when a started read has run long enough to show progress. Tests pass one driven by a fake clock; the screen uses `useAfterDelay`. */
  afterDelay?: (active: boolean) => boolean;
};

/**
 * A card that cannot be read, for that card only. The failed read is already announced through the Shell's live
 * region (`read-failed` dispatches `announce`), so the message has no role of its own and is read out once.
 */
function FailureMessage({ failure, t }: { failure: CardReadFailure; t: Translate }) {
  return (
    <>
      <StateMessage variant="error" role={null} message={t(readFailureKey(failure))} t={t} />
      {failure.reason === 'invalid-profile' ? (
        <details open className={styles.details}>
          <summary>{t('error.read.details')}</summary>
          <ul>
            {failure.violations.map((violation, index) => (
              <li key={index}>
                <code>{violation.location}</code>: {violation.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

/** The three steps of the screen, in order: the first is the photo, the second the marks of a read card, the third the batch ready to weave. */
const STEP_KEYS = ['scan.step.photograph', 'scan.step.check', 'scan.step.weave'] as const;
/** The step the screen is at: checking the marks while a card is read, weaving once cards are accepted, else photographing. */
export function currentStepIndex(readCard: boolean, batchLength: number): 0 | 1 | 2 {
  if (readCard) return 1;
  return batchLength > 0 ? 2 : 0;
}
/** What Scan draws. No state of its own, so tests can render every case (R8, R9, R10, R11, R22). */
export function ScanView(props: ScanViewProps) {
  const { profile, scan, batch, t } = props;
  const readState = scan.status === 'read' ? scan : null;
  // A WeftProgress shows only once the read has run for 300 ms; the reading text above it is the live announcement.
  const afterDelay = props.afterDelay ?? useAfterDelay;
  const showReading = afterDelay(scan.status === 'reading');
  // Choose-a-photo is the one primary control until a card is read; Accept takes over after a read.
  const choosePrimary = readState === null;
  return (
    <section aria-labelledby="screen-title" className={styles.screen}>
      <h2 id="screen-title" className={styles.screenTitle}>
        {t('nav.scan')}
      </h2>
      <ScreenIntro purpose={t('scan.purpose')} next={t('scan.nextStep')} />
      {/* The step the weaver is at is marked by a filled dot and bold text, and named to a screen reader by aria-current; the others have an open dot. */}
      <ol className={styles.steps} aria-label={t('scan.steps.label')}>
        {STEP_KEYS.map((key, index) => {
          const current = index === currentStepIndex(readState !== null, batch.length);
          return (
            <li key={key} className={styles.step} data-current={current} aria-current={current ? 'step' : undefined}>
              <span aria-hidden="true" className={styles.stepDot} />
              {t(key)}
            </li>
          );
        })}
      </ol>
      {/* From 1024 px the controls sit on the left and the Demo cards on the right. The DOM order is the tab order and the narrow-screen order. */}
      <div className={styles.layout}>
      <div className={styles.main}>
      {profile === null ? (
        <Panel>
          <p className={styles.emptyText}>{t('scan.needsProfile')}</p>
        </Panel>
      ) : (
        <>
          {/* Choose-a-photo is the first control, outside the Disclosure. The Demo cards come last in the DOM and sit on the right. */}
          <Panel as="section" aria-labelledby="scan-choose-title" className={`${styles.panel} ${styles.zone}`}>
            {/* A hint of what to photograph: a card drawn by the app. */}
            <ArtImage art={ART['card-diamond']} alt={t(ART['card-diamond'].altKey)} className={styles.zoneArt} />
            <div className={styles.zoneBody}>
            <h3 id="scan-choose-title" className={styles.sectionTitle}>
              {t('scan.choose.label')}
            </h3>
            <Field label={t('scan.choose.hint')} emphasis={choosePrimary ? 'primary' : undefined}>
              <input
                id="scan-file"
                type="file"
                accept="image/*"
                aria-label={t('scan.choose.label')}
                disabled={scan.status === 'reading'}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file !== undefined) props.onFile(file);
                }}
              />
            </Field>
            {props.replacingIndex === null ? null : <p>{t('scan.replacing', { number: props.replacingIndex + 1 })}</p>}
            {scan.status === 'reading' ? (
              <p role="status" className={styles.busy}>
                {t('scan.reading', { name: scan.fileName })}
              </p>
            ) : null}
            {showReading ? <WeftProgress text={t('progress.reading')} /> : null}
            {scan.status === 'failed' ? <FailureMessage failure={scan.failure} t={t} /> : null}
            </div>
          </Panel>
          <ProfileNotice profile={profile} t={t} />
          {batch.length === 0 ? (
            <StateMessage variant="empty" illustration={<NoCardsScannedIllustration />} message={t('scan.batch.empty')} next={t('scan.batch.empty.next')} t={t} />
          ) : null}
        </>
      )}
      {/* Everything else is behind "More": it starts collapsed and the screen opens it when a read completes. */}
      <div className={styles.more}>
      <Disclosure label={t('disclosure.more')} expanded={props.moreExpanded} onToggle={props.onMoreToggle}>
        {props.replacingIndex === null ? null : (
          <div className={styles.row}>
            <Button onClick={props.onCancelReplacing}>{t('scan.replacing.cancel', { number: props.replacingIndex + 1 })}</Button>
          </div>
        )}
        {props.cameraSlot ?? null}
        {profile !== null && readState !== null ? (
          <ReadPanel {...props} profile={profile} readState={readState} />
        ) : null}
        <Panel as="section" aria-labelledby="scan-batch-title" className={styles.panel}>
          <h3 id="scan-batch-title" className={styles.sectionTitle}>
            {t('scan.batch.heading')}
          </h3>
          <BatchList
            batch={batch}
            profile={profile}
            pendingRemove={props.pendingRemove}
            t={t}
            onRemoveRequest={props.onRemoveRequest}
            onRemoveConfirm={props.onRemoveConfirm}
            onRemoveCancel={props.onRemoveCancel}
            onMove={props.onMove}
            onScanAgain={props.onScanAgain}
          />
          <Button disabled={batch.length === 0} onClick={props.onDone}>
            {t('scan.done')}
          </Button>
          {props.confirmingDone ? (
            <Panel role="group" aria-label={t('scan.done.question')} className={styles.confirm}>
              <p>{t('scan.done.question')}</p>
              <div className={styles.row}>
                <Button onClick={() => props.onCommit('replace')}>{t('scan.done.replace')}</Button>
                <Button onClick={() => props.onCommit('append')}>{t('scan.done.append')}</Button>
                <Button onClick={props.onDoneCancel}>{t('scan.done.cancel')}</Button>
              </div>
            </Panel>
          ) : null}
        </Panel>
      </Disclosure>
      </div>
      </div>
      {profile === null ? null : (
        <div className={styles.side}>
          <DemoCards
            t={t}
            base={import.meta.env.BASE_URL}
            busy={scan.status === 'reading'}
            notice={props.demoNotice ?? null}
            onDemo={props.onDemo ?? noopDemo}
          />
        </div>
      )}
      </div>
    </section>
  );
}

type ReadPanelProps = ScanViewProps & { profile: CardProfile; readState: Extract<ScanState, { status: 'read' }> };

function ReadPanel(props: ReadPanelProps) {
  const { profile, readState, t, viewWidthPx } = props;
  const { image, pose, grid, corrected, zoom } = readState;
  const markers = hookMarkers(profile, pose, grid, corrected);
  const spacing = hookSpacingCssPx(profile, pose, image.width, viewWidthPx);
  return (
    <Panel as="section" aria-labelledby="scan-read-title" className={styles.panel}>
      <h3 id="scan-read-title" className={styles.sectionTitle}>
        {t('scan.legend.heading')}
      </h3>
      <ul className={styles.legend}>
        <li>
          <span aria-hidden="true" className={styles.legendFilled} /> {t('scan.legend.punched')}
        </li>
        <li>
          <span aria-hidden="true" className={styles.legendRing} /> {t('scan.legend.unpunched')}
        </li>
        <li>
          <span aria-hidden="true" className={styles.legendBadge} /> {t('scan.legend.corrected')}
        </li>
      </ul>
      <p>{t('scan.legend.tap')}</p>
      <div role="group" aria-label={t('scan.zoom.heading')} className={styles.row}>
        <Button onClick={() => props.onZoom(zoom / ZOOM_STEP)}>{t('scan.zoom.out')}</Button>
        <Button onClick={() => props.onZoom(zoom * ZOOM_STEP)}>{t('scan.zoom.in')}</Button>
        <Button onClick={() => props.onZoom(initialZoom(spacing))}>{t('scan.zoom.fit')}</Button>
        <span>{t('scan.zoom.value', { percent: Math.round(zoom * 100) })}</span>
      </div>
      <CardOverlay
        image={image}
        markers={markers}
        hookRows={profile.hookRows}
        hookColumns={profile.hookColumns}
        zoom={zoom}
        hitPx={markerHitPx(spacing, zoom)}
        onToggle={props.onToggle}
        t={t}
      />
      <p>{t('scan.corrections', { count: corrected.length })}</p>
      <div className={styles.row}>
        <Button disabled={corrected.length === 0} onClick={props.onUndo}>
          {t('scan.undo')}
        </Button>
        <Button variant="primary" onClick={props.onAccept}>
          {t('scan.accept')}
        </Button>
        <Button onClick={props.onDiscard}>{t('scan.discard')}</Button>
      </div>
    </Panel>
  );
}

export type ScanScreenProps = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  t: Translate;
  /** Injected so tests read fixtures without a browser; the browser decodes the photo with `loadPixelData`. */
  loadPixels?: LoadPixels;
};

export function ScanScreen({ state, dispatch, t, loadPixels }: ScanScreenProps) {
  const profile = state.profile.status === 'ready' ? state.profile.profile : null;
  const [scan, dispatchScan] = useReducer(scanReducer, initialScanState);
  const [pendingRemove, setPendingRemove] = useState<number | null>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);
  const [confirmingDone, setConfirmingDone] = useState(false);
  const [viewWidthPx, setViewWidthPx] = useState(DEFAULT_VIEW_WIDTH_PX);
  const [moreOpen, setMoreOpen] = useState(false);
  const [demoNotice, setDemoNotice] = useState<DemoNotice | null>(null);
  const counter = useRef(new RequestCounter());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [cameraEnv] = useState(browserCameraEnv);
  const [cameraDevice] = useState(browserCameraDevice);

  useLayoutEffect(() => {
    const measure = (): void => {
      const width = rootRef.current?.clientWidth ?? 0;
      if (width > 0) setViewWidthPx(width);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // A finished read opens "More", where the marks, Accept and Discard are. Focus is not moved.
  const hasRead = scan.status === 'read';
  useEffect(() => {
    if (hasRead) setMoreOpen(true);
  }, [hasRead]);

  const startRead = useCallback(
    (name: string, file: Blob, load: LoadPixels | undefined): void => {
      if (profile === null) return;
      const request = counter.current.begin();
      dispatchScan({ type: 'start', fileName: name });
      void readPhoto(profile, file, load).then((outcome) => {
        // A newer photo was chosen, or this one was discarded: ignore the late result.
        if (!counter.current.isLatest(request)) return;
        if (outcome.kind === 'failed') {
          dispatch({ type: 'read-failed', failure: outcome.failure });
        }
        const zoom =
          outcome.kind === 'read'
            ? initialZoom(hookSpacingCssPx(profile, outcome.pose, outcome.image.width, viewWidthPx))
            : 1;
        dispatchScan({ type: 'finish', outcome, zoom, replacing: replacingIndex });
      });
    },
    [profile, dispatch, viewWidthPx, replacingIndex],
  );

  const onFile = useCallback((file: File): void => startRead(file.name, file, loadPixels), [startRead, loadPixels]);

  /**
   * A demo card takes the path of a chosen photo: the image is fetched and wrapped in a File, then `onFile` reads it.
   * An image that cannot be fetched (the noisy cards and the real photos are not kept for offline use) shows a message
   * and starts no read.
   */
  const onDemo = useCallback(
    (image: DemoImage): void => {
      setDemoNotice(null);
      void fetchDemoImage(
        `${import.meta.env.BASE_URL}${image.path}`,
        demoFileName(image.path),
        fetchDemoImageFile,
        browserIsOnline,
      ).then((result) => {
        if (result.kind === 'file') onFile(result.file);
        else setDemoNotice(result.kind);
      });
    },
    [onFile],
  );

  /** A camera frame takes the same path as a photo: `readPhoto` with the frame as the pixels. */
  const onFrame = useCallback(
    (pixels: PixelData): void => startRead(t('scan.camera.frameName'), new Blob(), () => Promise.resolve(pixels)),
    [startRead, t],
  );

  const control = cameraControl(cameraEnv);

  const reset = (): void => {
    counter.current.begin();
    dispatchScan({ type: 'reset' });
  };

  const onAccept = (): void => {
    if (scan.status !== 'read') return;
    const { replacing } = scan;
    if (replacing !== null && replacing < state.batch.length) {
      dispatch({ type: 'batch-replace', index: replacing, grid: scan.grid });
      dispatch({
        type: 'announce',
        kind: 'confirmation',
        messageKey: 'scan.replaced',
        params: { number: replacing + 1 },
      });
    } else {
      dispatch({ type: 'batch-accept', grid: scan.grid });
      dispatch({
        type: 'announce',
        kind: 'confirmation',
        messageKey: 'scan.accepted',
        params: { number: state.batch.length + 1 },
      });
    }
    setReplacingIndex(null);
    reset();
  };

  const onScanAgain = (index: number): void => {
    setReplacingIndex(index);
    document.getElementById('scan-file')?.focus();
  };

  const onDone = (): void => {
    if (state.batch.length === 0) return;
    if (state.current.pattern.length === 0) {
      dispatch({ type: 'batch-commit', mode: 'replace' });
    } else {
      setConfirmingDone(true);
    }
  };

  return (
    <div ref={rootRef}>
      <ScanView
        profile={profile}
        scan={scan}
        batch={state.batch}
        pendingRemove={pendingRemove}
        replacingIndex={replacingIndex}
        confirmingDone={confirmingDone}
        viewWidthPx={viewWidthPx}
        t={t}
        onFile={onFile}
        onDemo={onDemo}
        demoNotice={demoNotice}
        onToggle={(position) => dispatchScan({ type: 'toggle', position })}
        onUndo={() => dispatchScan({ type: 'undo' })}
        onZoom={(zoom) => dispatchScan({ type: 'set-zoom', zoom })}
        onAccept={onAccept}
        onDiscard={reset}
        onRemoveRequest={setPendingRemove}
        onRemoveConfirm={() => {
          if (pendingRemove !== null) dispatch({ type: 'batch-remove', index: pendingRemove });
          setPendingRemove(null);
        }}
        onRemoveCancel={() => setPendingRemove(null)}
        onMove={(index, by) => dispatch({ type: 'batch-move', index, by })}
        onScanAgain={onScanAgain}
        onCancelReplacing={() => setReplacingIndex(null)}
        onDone={onDone}
        onCommit={(mode) => {
          setConfirmingDone(false);
          dispatch({ type: 'batch-commit', mode });
        }}
        onDoneCancel={() => setConfirmingDone(false)}
        moreExpanded={moreOpen}
        onMoreToggle={setMoreOpen}
        cameraSlot={
          profile === null ? null : (
            <LiveCamera
              control={control}
              device={cameraDevice}
              aspectRatio={profile.cardWidthMm / profile.cardHeightMm}
              disabled={scan.status === 'reading'}
              t={t}
              onFrame={onFrame}
            />
          )
        }
      />
    </div>
  );
}

export default ScanScreen;
