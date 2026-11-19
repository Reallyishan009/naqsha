import type { PixelData } from '../../../reader/index.ts';
import type { CameraEnv } from '../../platform/browser.ts';

/** One track of a camera stream. A fake in tests. */
export type CameraTrack = { stop(): void };
/** The part of a MediaStream the app uses. */
export type CameraStream = { getTracks(): CameraTrack[] };
/** Opens the camera. Injected: the browser uses getUserMedia, tests use a fake. */
export type CameraDevice = { open(): Promise<CameraStream> };

export type CameraFailureKind = 'denied' | 'no-camera' | 'failed';

/** Maps the error getUserMedia rejects with to a kind the screen can explain in plain words (R18.4). */
export function cameraFailureKind(error: unknown): CameraFailureKind {
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') return 'no-camera';
  return 'failed';
}

/** Stops every track. Never throws; a track that fails to stop does not keep the others running. */
export function stopStream(stream: CameraStream | null): void {
  if (stream === null) return;
  let tracks: CameraTrack[] = [];
  try {
    tracks = stream.getTracks();
  } catch {
    return;
  }
  for (const track of tracks) {
    try {
      track.stop();
    } catch {
      // keep stopping the rest
    }
  }
}

export type OpenResult = { ok: true; stream: CameraStream } | { ok: false; kind: CameraFailureKind };

/** Opens the camera. Never throws. */
export async function openCamera(device: CameraDevice): Promise<OpenResult> {
  try {
    return { ok: true, stream: await device.open() };
  } catch (error) {
    return { ok: false, kind: cameraFailureKind(error) };
  }
}

/**
 * Owns the stream of one camera. Every way out (capture, error, leaving the screen) goes through `stop` or
 * `dispose`, so the tracks are always stopped (R18.5). A stream that arrives after `dispose` is stopped at once.
 */
export class CameraSession {
  private stream: CameraStream | null = null;
  private disposed = false;
  private attempt = 0;
  private readonly device: CameraDevice;

  constructor(device: CameraDevice) {
    this.device = device;
  }

  /** Opens the camera. Returns null when the session was stopped or disposed while waiting. */
  async start(): Promise<OpenResult | null> {
    this.stop();
    const attempt = ++this.attempt;
    const result = await openCamera(this.device);
    if (this.disposed || attempt !== this.attempt) {
      if (result.ok) stopStream(result.stream);
      return null;
    }
    if (result.ok) this.stream = result.stream;
    return result;
  }

  get current(): CameraStream | null {
    return this.stream;
  }

  /** Stops all tracks. Safe to call at any time and more than once. */
  stop(): void {
    this.attempt += 1;
    stopStream(this.stream);
    this.stream = null;
  }

  /** Stops all tracks for good: the screen is gone. */
  dispose(): void {
    this.disposed = true;
    this.stop();
  }
}

/** The browser's camera: the rear camera when there is one. Null when getUserMedia is missing. */
export function browserCameraDevice(): CameraDevice | null {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
  return {
    open: () =>
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }),
  };
}

/** Draws the current video frame to a canvas and returns its pixels, or null when the video has no frame yet. */
export function captureFrame(video: HTMLVideoElement): PixelData | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!(width > 0) || !(height > 0)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.drawImage(video, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  return { width, height, data };
}

/** Reads the secure-page flag and getUserMedia once. Never throws. */
export function browserCameraEnv(): CameraEnv {
  try {
    return {
      isSecureContext: typeof isSecureContext === 'boolean' && isSecureContext,
      hasGetUserMedia:
        typeof navigator !== 'undefined' &&
        typeof navigator.mediaDevices === 'object' &&
        navigator.mediaDevices !== null &&
        typeof navigator.mediaDevices.getUserMedia === 'function',
    };
  } catch {
    return { isSecureContext: false, hasGetUserMedia: false };
  }
}
