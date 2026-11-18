import { useCallback, useLayoutEffect, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, Dispatch } from 'react';
import type { CardProfile } from '../../../codec/index.ts';
import type { ReadFailure as CardReadFailure } from '../../../reader/index.ts';
import { readFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
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
import { ProfileNotice } from '../../ProfileNotice.tsx';
import type { AppAction, AppState, HookPosition, ScanBatch, ScanState } from '../../types.ts';
import { BatchList } from './BatchList.tsx';
import { CardOverlay } from './CardOverlay.tsx';
import styles from './ScanScreen.module.css';

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
};

function FailureMessage({ failure, t }: { failure: CardReadFailure; t: Translate }) {
  return (
    <div role="alert" className={styles.failure}>
      <p>{t(readFailureKey(failure))}</p>
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
    </div>
  );
}

/** What Scan draws. No state of its own, so tests can render every case (R8, R9, R10, R11, R22). */
export function ScanView(props: ScanViewProps) {
  const { profile, scan, batch, t } = props;
  const readState = scan.status === 'read' ? scan : null;
  return (
    <section aria-labelledby="screen-title" className={styles.screen}>
      <h2 id="screen-title" className={styles.screenTitle}>
        {t('nav.scan')}
      </h2>
      {profile === null ? (
        <p className={styles.empty}>{t('scan.needsProfile')}</p>
      ) : (
        <>
          <ProfileNotice profile={profile} t={t} />
          <section aria-labelledby="scan-choose-title" className={styles.panel}>
            <h3 id="scan-choose-title" className={styles.sectionTitle}>
              {t('scan.choose.label')}
            </h3>
            <p>{t('scan.choose.hint')}</p>
            <input
              id="scan-file"
              type="file"
              accept="image/*"
              className={styles.file}
              aria-label={t('scan.choose.label')}
              disabled={scan.status === 'reading'}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (file !== undefined) props.onFile(file);
              }}
            />
            {props.replacingIndex === null ? null : (
              <div className={styles.row}>
                <p>{t('scan.replacing', { number: props.replacingIndex + 1 })}</p>
                <button type="button" className={styles.button} onClick={props.onCancelReplacing}>
                  {t('scan.replacing.cancel', { number: props.replacingIndex + 1 })}
                </button>
              </div>
            )}
            {scan.status === 'reading' ? (
              <p role="status" className={styles.busy}>
                {t('scan.reading', { name: scan.fileName })}
              </p>
            ) : null}
            {scan.status === 'failed' ? <FailureMessage failure={scan.failure} t={t} /> : null}
          </section>
          {readState === null ? null : (
            <ReadPanel {...props} profile={profile} readState={readState} />
          )}
        </>
      )}
      <section aria-labelledby="scan-batch-title" className={styles.panel}>
        <h3 id="scan-batch-title" className={styles.sectionTitle}>
          {t('scan.batch.heading')}
        </h3>
        <BatchList
          batch={batch}
          pendingRemove={props.pendingRemove}
          t={t}
          onRemoveRequest={props.onRemoveRequest}
          onRemoveConfirm={props.onRemoveConfirm}
          onRemoveCancel={props.onRemoveCancel}
          onMove={props.onMove}
          onScanAgain={props.onScanAgain}
        />
        <button type="button" className={styles.button} disabled={batch.length === 0} onClick={props.onDone}>
          {t('scan.done')}
        </button>
        {props.confirmingDone ? (
          <div role="group" aria-label={t('scan.done.question')} className={styles.confirm}>
            <p>{t('scan.done.question')}</p>
            <div className={styles.row}>
              <button type="button" className={styles.button} onClick={() => props.onCommit('replace')}>
                {t('scan.done.replace')}
              </button>
              <button type="button" className={styles.button} onClick={() => props.onCommit('append')}>
                {t('scan.done.append')}
              </button>
              <button type="button" className={styles.button} onClick={props.onDoneCancel}>
                {t('scan.done.cancel')}
              </button>
            </div>
          </div>
        ) : null}
      </section>
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
    <section aria-labelledby="scan-read-title" className={styles.panel}>
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
        <button type="button" className={styles.button} onClick={() => props.onZoom(zoom / ZOOM_STEP)}>
          {t('scan.zoom.out')}
        </button>
        <button type="button" className={styles.button} onClick={() => props.onZoom(zoom * ZOOM_STEP)}>
          {t('scan.zoom.in')}
        </button>
        <button type="button" className={styles.button} onClick={() => props.onZoom(initialZoom(spacing))}>
          {t('scan.zoom.fit')}
        </button>
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
        <button type="button" className={styles.button} disabled={corrected.length === 0} onClick={props.onUndo}>
          {t('scan.undo')}
        </button>
        <button type="button" className={styles.button} onClick={props.onAccept}>
          {t('scan.accept')}
        </button>
        <button type="button" className={styles.button} onClick={props.onDiscard}>
          {t('scan.discard')}
        </button>
      </div>
    </section>
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
  const counter = useRef(new RequestCounter());
  const rootRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const measure = (): void => {
      const width = rootRef.current?.clientWidth ?? 0;
      if (width > 0) setViewWidthPx(width);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const onFile = useCallback(
    (file: File): void => {
      if (profile === null) return;
      const request = counter.current.begin();
      dispatchScan({ type: 'start', fileName: file.name });
      void readPhoto(profile, file, loadPixels).then((outcome) => {
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
    [profile, loadPixels, dispatch, viewWidthPx, replacingIndex],
  );

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
      />
    </div>
  );
}

export default ScanScreen;
