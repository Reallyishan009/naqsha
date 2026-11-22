import { useEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { PixelData } from '../../../reader/index.ts';
import type { Translate } from '../../i18n/messages.ts';
import type { CameraControl } from '../../platform/browser.ts';
import { CameraSession, captureFrame } from './camera.ts';
import type { CameraDevice, CameraFailureKind } from './camera.ts';
import { Button } from '../../components/Button.tsx';
import { Notice } from '../../components/Notice.tsx';
import styles from './ScanScreen.module.css';

export type CameraPhase =
  | { status: 'idle' }
  | { status: 'opening' }
  | { status: 'live' }
  | { status: 'error'; kind: CameraFailureKind };

/** The message key for each failure, in plain words (R18.4). */
export function cameraFailureMessageKey(kind: CameraFailureKind): string {
  switch (kind) {
    case 'denied':
      return 'scan.camera.denied';
    case 'no-camera':
      return 'scan.camera.none';
    default:
      return 'scan.camera.failed';
  }
}

export type LiveCameraViewProps = {
  control: CameraControl;
  phase: CameraPhase;
  /** Card width divided by card height, for the guide frame. */
  aspectRatio: number;
  disabled: boolean;
  t: Translate;
  videoRef?: Ref<HTMLVideoElement>;
  onOpen: () => void;
  onCapture: () => void;
  onClose: () => void;
};

/** What the live camera part draws. No state, so tests can render every case. */
export function LiveCameraView(props: LiveCameraViewProps) {
  const { control, phase, t } = props;
  if (control === 'hidden') return null;
  if (control === 'hidden-with-note') {
    return <p className={styles.note}>{t('scan.camera.insecure')}</p>;
  }
  return (
    <div className={styles.camera}>
      {phase.status === 'live' || phase.status === 'opening' ? null : (
        <Button disabled={props.disabled} onClick={props.onOpen}>
          {t('scan.camera.open')}
        </Button>
      )}
      {phase.status === 'opening' ? (
        <p role="status" className={styles.busy}>
          {t('scan.camera.opening')}
        </p>
      ) : null}
      {phase.status === 'live' ? (
        <>
          <p>{t('scan.camera.hint')}</p>
          <div className={styles.cameraStage} style={{ aspectRatio: String(props.aspectRatio) }}>
            <video ref={props.videoRef} className={styles.video} autoPlay playsInline muted aria-label={t('scan.camera.view')} />
            <div aria-hidden="true" className={styles.guide} style={{ aspectRatio: String(props.aspectRatio) }} />
          </div>
          <div className={styles.row}>
            <Button onClick={props.onCapture}>{t('scan.camera.capture')}</Button>
            <Button onClick={props.onClose}>{t('scan.camera.close')}</Button>
          </div>
        </>
      ) : null}
      {phase.status === 'error' ? (
        <Notice variant="error" word={t('notice.error')}>
          {t(cameraFailureMessageKey(phase.kind))}
        </Notice>
      ) : null}
    </div>
  );
}

export type LiveCameraProps = {
  control: CameraControl;
  /** Null when the browser has no camera API. */
  device: CameraDevice | null;
  aspectRatio: number;
  disabled: boolean;
  t: Translate;
  /** One captured frame, to be read the same way as an uploaded photo. */
  onFrame: (pixels: PixelData) => void;
  /** Injected so tests need no video element. */
  capture?: (video: HTMLVideoElement) => PixelData | null;
};

export function LiveCamera({ control, device, aspectRatio, disabled, t, onFrame, capture = captureFrame }: LiveCameraProps) {
  const [phase, setPhase] = useState<CameraPhase>({ status: 'idle' });
  const sessionRef = useRef<CameraSession | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Leaving the screen stops every track (R18.5).
  useEffect(() => {
    return () => {
      sessionRef.current?.dispose();
      sessionRef.current = null;
    };
  }, []);

  // Attach the stream once the video element exists.
  useEffect(() => {
    const stream = sessionRef.current?.current;
    if (phase.status === 'live' && videoRef.current !== null && stream) {
      (videoRef.current as { srcObject: unknown }).srcObject = stream;
    }
  }, [phase]);

  const close = (): void => {
    sessionRef.current?.stop();
    setPhase({ status: 'idle' });
  };

  const open = (): void => {
    if (device === null) {
      setPhase({ status: 'error', kind: 'no-camera' });
      return;
    }
    sessionRef.current?.dispose();
    const session = new CameraSession(device);
    sessionRef.current = session;
    setPhase({ status: 'opening' });
    void session.start().then((result) => {
      if (result === null || sessionRef.current !== session) return;
      setPhase(result.ok ? { status: 'live' } : { status: 'error', kind: result.kind });
    });
  };

  const takeFrame = (): void => {
    const video = videoRef.current;
    let pixels: PixelData | null = null;
    try {
      pixels = video === null ? null : capture(video);
    } catch {
      pixels = null;
    }
    // The stream stops on capture and on error, whatever the frame turned out to be.
    sessionRef.current?.stop();
    if (pixels === null) {
      setPhase({ status: 'error', kind: 'failed' });
      return;
    }
    setPhase({ status: 'idle' });
    onFrame(pixels);
  };

  return (
    <LiveCameraView
      control={control}
      phase={phase}
      aspectRatio={aspectRatio}
      disabled={disabled}
      t={t}
      videoRef={videoRef}
      onOpen={open}
      onCapture={takeFrame}
      onClose={close}
    />
  );
}
