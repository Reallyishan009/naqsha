import type { CardProfile, Pattern } from '../../codec/index.ts';
import { parseRenderSettings, prepareCloth } from '../../simulator/index.ts';
import type { GapReport, RenderSettings, SimResult, Weft } from '../../simulator/index.ts';
import type { ClothChoices, ClothView, PlaybackState, ReadyCloth } from '../types.ts';

/** Thread colours the user can choose; `key` is a translation key and `hex` is accepted by parseColour. */
export const COLOURS: ReadonlyArray<{ key: string; hex: string }> = [
  { key: 'colour.madder', hex: '#9b2d30' },
  { key: 'colour.indigo', hex: '#2b3a67' },
  { key: 'colour.leaf', hex: '#4f7942' },
  { key: 'colour.ivory', hex: '#f1ead8' },
  { key: 'colour.charcoal', hex: '#36454f' },
  { key: 'colour.ochre', hex: '#cc7722' },
];

export const MIN_REPEAT = 1;
export const MAX_REPEAT = 8;
/** Thread size in pixels; fixed because the thread size control is hidden (R2.13). */
export const THREAD_SIZE_PX = 6;
const MAX_VIEWPORT = 4096;

/** The weft plan: [plain] without zari, [plain, zari] with zari, so zari lands on every second pick (R3.3, R3.4). */
export function weftPlan(choices: ClothChoices): Weft[] {
  const plain: Weft = { kind: 'plain', colour: choices.weftColour };
  return choices.zari.on ? [plain, { kind: 'zari', tone: choices.zari.tone }] : [plain];
}

function clampSide(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(MAX_VIEWPORT, Math.max(1, Math.floor(value)));
}

/** The viewport for the available size: integers within 1..4096, whatever the input (R2.4). */
export function viewportFor(availableWidth: number, availableHeight: number): { width: number; height: number } {
  return { width: clampSide(availableWidth), height: clampSide(availableHeight) };
}

function clampRepeat(value: number): number {
  if (Number.isNaN(value)) return MIN_REPEAT;
  return Math.min(MAX_REPEAT, Math.max(MIN_REPEAT, Math.round(value)));
}

/** Render settings for the choices, as a value for parseRenderSettings to check. */
export function settingsFromChoices(choices: ClothChoices, availableWidth: number, availableHeight: number): unknown {
  return {
    warpColour: choices.warpColour,
    weftPlan: weftPlan(choices),
    threadSizePx: THREAD_SIZE_PX,
    repeat: clampRepeat(choices.repeat),
    viewport: viewportFor(availableWidth, availableHeight),
    floatHighlight: null,
  } satisfies Record<keyof RenderSettings, unknown>;
}

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

/** The one-based pick numbers of the gaps, in increasing order (R2.11). */
export function gapPickNumbers(gaps: ReadonlyArray<GapReport>): number[] {
  return gaps.map((gap) => gap.pick + 1).sort((a, b) => a - b);
}

export type ClothAction =
  | { type: 'cloth-updated'; result: SimResult<ReadyCloth> }
  | { type: 'cloth-cleared' };

function lastReady(view: ClothView): ReadyCloth | null {
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

/** A failed update keeps the last cloth as `previous` and shows the failure (R2.12). */
export function clothReducer(view: ClothView, action: ClothAction): ClothView {
  switch (action.type) {
    case 'cloth-updated':
      if (action.result.ok) return { status: 'ready', ready: action.result.value };
      return { status: 'failed', failure: action.result.failure, previous: lastReady(view) };
    case 'cloth-cleared':
      return { status: 'empty' };
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

/**
 * A choice change rebuilds the cloth and keeps the play state (R3.6). The current pick is not part of the play state:
 * it is `AppState.selectedPick`, which `set-cloth-choices` leaves alone.
 */
export function playbackAfterChoice(playback: PlaybackState, _pickCount: number): PlaybackState {
  return playback;
}
