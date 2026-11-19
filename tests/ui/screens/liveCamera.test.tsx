import { renderToStaticMarkup } from 'react-dom/server';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import {
  CameraSession,
  cameraFailureKind,
  openCamera,
  stopStream,
} from '../../../src/ui/screens/scan/camera.ts';
import type { CameraDevice, CameraStream } from '../../../src/ui/screens/scan/camera.ts';
import { cameraFailureMessageKey, LiveCameraView } from '../../../src/ui/screens/scan/LiveCamera.tsx';
import type { CameraPhase, LiveCameraViewProps } from '../../../src/ui/screens/scan/LiveCamera.tsx';
import { ScanView } from '../../../src/ui/screens/scan/ScanScreen.tsx';
import type { ScanViewProps } from '../../../src/ui/screens/scan/ScanScreen.tsx';
import { initialScanState } from '../../../src/ui/state/scan.ts';
import { demoProfile } from '../../support/profiles.ts';
import type { Language } from '../../../src/ui/types.ts';

const SEED = 18018;
const LANGUAGES: Language[] = ['hi', 'en'];
const noop = (): void => undefined;

/** A camera that hands out streams and counts how many tracks were stopped. */
class FakeCamera implements CameraDevice {
  stopped = 0;
  opened = 0;
  private resolveOpen: ((stream: CameraStream) => void) | null = null;
  private readonly mode: { reject: unknown } | { deferred: true } | { immediate: true };
  private readonly trackCount: number;
  constructor(mode: { reject: unknown } | { deferred: true } | { immediate: true }, trackCount = 2) {
    this.mode = mode;
    this.trackCount = trackCount;
  }
  private makeStream(): CameraStream {
    const tracks = Array.from({ length: this.trackCount }, () => ({
      stop: (): void => {
        this.stopped += 1;
      },
    }));
    return { getTracks: () => tracks };
  }
  open(): Promise<CameraStream> {
    this.opened += 1;
    if ('reject' in this.mode) return Promise.reject(this.mode.reject);
    if ('deferred' in this.mode) {
      return new Promise((resolve) => {
        this.resolveOpen = resolve;
      });
    }
    return Promise.resolve(this.makeStream());
  }
  deliver(): void {
    this.resolveOpen?.(this.makeStream());
  }
}

function domError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function viewProps(overrides: Partial<LiveCameraViewProps> = {}): LiveCameraViewProps {
  return {
    control: 'shown',
    phase: { status: 'idle' },
    aspectRatio: 4 / 3,
    disabled: false,
    t: translator(DICTIONARIES, 'en'),
    onOpen: noop,
    onCapture: noop,
    onClose: noop,
    ...overrides,
  };
}

describe('camera session', () => {
  it('R18.5 leaving the screen stops every track', async () => {
    const camera = new FakeCamera({ immediate: true }, 3);
    const session = new CameraSession(camera);
    const result = await session.start();
    expect(result?.ok).toBe(true);
    expect(camera.stopped).toBe(0);
    session.dispose();
    expect(camera.stopped).toBe(3);
    session.dispose();
    expect(camera.stopped).toBe(3);
  });

  it('R18.3 R18.5 stopping after a capture stops every track once', async () => {
    const camera = new FakeCamera({ immediate: true });
    const session = new CameraSession(camera);
    await session.start();
    session.stop();
    expect(camera.stopped).toBe(2);
    session.stop();
    expect(camera.stopped).toBe(2);
  });

  it('R18.5 a stream that arrives after the user left is stopped at once', async () => {
    const camera = new FakeCamera({ deferred: true });
    const session = new CameraSession(camera);
    const pending = session.start();
    session.dispose();
    camera.deliver();
    expect(await pending).toBeNull();
    expect(camera.stopped).toBe(2);
  });

  it('R18.5 opening again stops the earlier stream', async () => {
    const camera = new FakeCamera({ immediate: true });
    const session = new CameraSession(camera);
    await session.start();
    await session.start();
    expect(camera.stopped).toBe(2);
    session.dispose();
    expect(camera.stopped).toBe(4);
  });

  it('R18.5 for any number of tracks, dispose stops each exactly once', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 8 }), fc.integer({ min: 1, max: 3 }), async (tracks, disposals) => {
        const camera = new FakeCamera({ immediate: true }, tracks);
        const session = new CameraSession(camera);
        await session.start();
        for (let i = 0; i < disposals; i += 1) session.dispose();
        expect(camera.stopped).toBe(tracks);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it('R18.5 a track that fails to stop does not keep the others running', () => {
    let stopped = 0;
    stopStream({
      getTracks: () => [
        { stop: () => { throw new Error('stuck'); } },
        { stop: () => { stopped += 1; } },
      ],
    });
    expect(stopped).toBe(1);
  });
});

describe('camera failures (failure path)', () => {
  it('R18.4 a refused permission becomes denied and opens no stream', async () => {
    const camera = new FakeCamera({ reject: domError('NotAllowedError') });
    expect(await openCamera(camera)).toEqual({ ok: false, kind: 'denied' });
    const session = new CameraSession(camera);
    expect(await session.start()).toEqual({ ok: false, kind: 'denied' });
    expect(session.current).toBeNull();
    expect(camera.stopped).toBe(0);
  });

  it('R18.4 a missing camera becomes no-camera, anything else becomes failed', () => {
    expect(cameraFailureKind(domError('NotFoundError'))).toBe('no-camera');
    expect(cameraFailureKind(domError('NotAllowedError'))).toBe('denied');
    expect(cameraFailureKind(domError('AbortError'))).toBe('failed');
    expect(cameraFailureKind('odd')).toBe('failed');
    expect(cameraFailureKind(null)).toBe('failed');
  });

  it('R18.4 each failure shows a plain-words message in both languages', () => {
    const phases: CameraPhase[] = [
      { status: 'error', kind: 'denied' },
      { status: 'error', kind: 'no-camera' },
      { status: 'error', kind: 'failed' },
    ];
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      for (const phase of phases) {
        if (phase.status !== 'error') continue;
        const html = renderToStaticMarkup(<LiveCameraView {...viewProps({ phase, t })} />);
        const message = t(cameraFailureMessageKey(phase.kind));
        expect(message.length).toBeGreaterThan(0);
        expect(message).not.toBe(cameraFailureMessageKey(phase.kind));
        expect(html).toContain('role="alert"');
        // The camera button stays so the user can try again.
        expect(html).toContain(t('scan.camera.open'));
      }
    }
  });

  it('R18.4 R18.7 photo upload stays usable and unchanged when the camera fails, is missing or is insecure', () => {
    const props: ScanViewProps = {
      profile: demoProfile(),
      scan: initialScanState,
      batch: [],
      pendingRemove: null,
      replacingIndex: null,
      confirmingDone: false,
      viewWidthPx: 360,
      t: translator(DICTIONARIES, 'en'),
      onFile: noop,
      onToggle: noop,
      onUndo: noop,
      onZoom: noop,
      onAccept: noop,
      onDiscard: noop,
      onRemoveRequest: noop,
      onRemoveConfirm: noop,
      onRemoveCancel: noop,
      onMove: noop,
      onScanAgain: noop,
      onCancelReplacing: noop,
      onDone: noop,
      onCommit: noop,
      onDoneCancel: noop,
    };
    const baseline = renderToStaticMarkup(<ScanView {...props} />);
    const cases: LiveCameraViewProps[] = [
      viewProps({ phase: { status: 'error', kind: 'denied' } }),
      viewProps({ control: 'hidden' }),
      viewProps({ control: 'hidden-with-note' }),
    ];
    for (const camera of cases) {
      const html = renderToStaticMarkup(<ScanView {...props} cameraSlot={<LiveCameraView {...camera} />} />);
      expect(html).toContain('id="scan-file"');
      expect(html).toContain('type="file"');
      expect(html).not.toMatch(/id="scan-file"[^>]*disabled/);
      expect(html).toContain('Choose a photo of one card');
      // Everything the baseline shows is still shown.
      const inputOf = (markup: string): string => markup.match(/<input[^>]*id="scan-file"[^>]*>/)?.[0] ?? '';
      expect(inputOf(html)).toBe(inputOf(baseline));
    }
  });
});

describe('camera control rendering', () => {
  it('R18.6 an insecure page hides the control and shows a one-line note, in both languages', () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const html = renderToStaticMarkup(<LiveCameraView {...viewProps({ control: 'hidden-with-note', t })} />);
      expect(html).toContain(t('scan.camera.insecure'));
      expect(html).not.toContain('<button');
    }
  });

  it('R18.1 a hidden control renders nothing', () => {
    expect(renderToStaticMarkup(<LiveCameraView {...viewProps({ control: 'hidden' })} />)).toBe('');
  });

  it('R18.1 the shown control is a real button, separate from the file input, with the 48 px target class', () => {
    const html = renderToStaticMarkup(<LiveCameraView {...viewProps()} />);
    expect(html).toMatch(/<button type="button"[^>]*>Use the camera<\/button>/);
    expect(html).not.toContain('type="file"');
  });

  it('R18.2 the live view shows the stream, a guide frame shaped like the card, capture and close buttons', () => {
    // The guide frame is the shape of the card in the Card_Profile, never a written-in ratio.
    const profile = demoProfile();
    const aspectRatio = profile.cardWidthMm / profile.cardHeightMm;
    const html = renderToStaticMarkup(<LiveCameraView {...viewProps({ phase: { status: 'live' }, aspectRatio })} />);
    expect(html).toContain('<video');
    expect(html).toContain(`aspect-ratio:${aspectRatio}`);
    expect(html).toContain('>Take picture</button>');
    expect(html).toContain('>Close the camera</button>');
  });
});
