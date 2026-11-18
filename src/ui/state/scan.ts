import type { CardGrid, CardProfile } from '../../codec/index.ts';
import { loadPixelData, readCard } from '../../reader/index.ts';
import type { PixelData, Pose, ReadFailure as CardReadFailure } from '../../reader/index.ts';
import type { Translate } from '../i18n/messages.ts';
import type { HookMarker, HookPosition, ScanState } from '../types.ts';
import { hitSizePx, minimumZoom, toggleHook, undoCorrection } from './corrections.ts';

/** Turns a chosen photo file into pixel data. Injected so tests can use a fake; the browser uses `loadPixelData`. */
export type LoadPixels = (file: Blob) => Promise<PixelData>;

export type ReadOutcome =
  | { kind: 'read'; image: PixelData; pose: Pose; grid: CardGrid }
  | { kind: 'failed'; failure: CardReadFailure };

/**
 * Loads the photo and reads the card. This is the one code path the Scan screen uses to read a photo (R8.1, R9.1).
 * Never throws: a file that cannot be decoded becomes an `invalid-image` failure.
 */
export async function readPhoto(
  profile: CardProfile,
  file: Blob,
  loadPixels: LoadPixels = (blob) => loadPixelData(blob),
): Promise<ReadOutcome> {
  let image: PixelData;
  try {
    image = await loadPixels(file);
  } catch (error) {
    return {
      kind: 'failed',
      failure: { reason: 'invalid-image', detail: error instanceof Error ? error.message : String(error) },
    };
  }
  const result = readCard(profile, image);
  if (!result.ok) return { kind: 'failed', failure: result.failure };
  return { kind: 'read', image, pose: result.pose, grid: result.grid };
}

/** Hands out request numbers so a late result from an older photo never replaces a newer one (design, Scan screen). */
export class RequestCounter {
  private latest = 0;
  begin(): number {
    this.latest += 1;
    return this.latest;
  }
  isLatest(request: number): boolean {
    return request === this.latest;
  }
}

/** Largest zoom the screen offers. */
export const MAX_ZOOM = 16;
/** Zoom step for the zoom in and zoom out buttons. */
export const ZOOM_STEP = 1.5;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(1, zoom));
}

/** Distance in CSS pixels between neighbouring hooks at zoom 1, when the photo is shown `viewWidthPx` wide. */
export function hookSpacingCssPx(profile: CardProfile, pose: Pose, imageWidthPx: number, viewWidthPx: number): number {
  const spacingImagePx = Math.min(profile.horizontalPitchMm, profile.verticalPitchMm) * pose.pixelsPerMm;
  if (!(imageWidthPx > 0)) return 0;
  return (spacingImagePx * viewWidthPx) / imageWidthPx;
}

/** The zoom at which hit areas reach the touch target size, within the screen's zoom range (R10.3). */
export function initialZoom(spacingCssPx: number): number {
  return clampZoom(minimumZoom(spacingCssPx));
}

/** Side in CSS pixels of a marker's hit area (R10.2). */
export function markerHitPx(spacingCssPx: number, zoom: number): number {
  return hitSizePx(spacingCssPx, zoom);
}

export type ScanAction =
  | { type: 'start'; fileName: string }
  | { type: 'finish'; outcome: ReadOutcome; zoom: number; replacing: number | null }
  | { type: 'toggle'; position: HookPosition }
  | { type: 'undo' }
  | { type: 'set-zoom'; zoom: number }
  | { type: 'reset' };

export const initialScanState: ScanState = { status: 'idle' };

/** Pure reducer of the Scan screen's own state. */
export function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case 'start':
      return { status: 'reading', fileName: action.fileName };
    case 'finish': {
      const { outcome } = action;
      if (outcome.kind === 'failed') return { status: 'failed', failure: outcome.failure };
      return {
        status: 'read',
        image: outcome.image,
        pose: outcome.pose,
        grid: outcome.grid,
        readGrid: outcome.grid,
        corrected: [],
        zoom: clampZoom(action.zoom),
        replacing: action.replacing,
      };
    }
    case 'toggle':
      if (state.status !== 'read') return state;
      return {
        ...state,
        grid: toggleHook(state.grid, action.position),
        corrected: [...state.corrected, action.position],
      };
    case 'undo': {
      if (state.status !== 'read') return state;
      const undone = undoCorrection(state.grid, state.corrected);
      return { ...state, grid: undone.grid, corrected: undone.corrected };
    }
    case 'set-zoom':
      if (state.status !== 'read') return state;
      return { ...state, zoom: clampZoom(action.zoom) };
    case 'reset':
      return initialScanState;
    default:
      return state;
  }
}

/** The marker to focus after an arrow key, Home or End, or null for any other key (R10.8). Hook positions are row-major. */
export function nextMarkerIndex(key: string, index: number, hookRows: number, hookColumns: number): number | null {
  const row = Math.floor(index / hookColumns);
  const column = index % hookColumns;
  switch (key) {
    case 'ArrowLeft':
      return column > 0 ? index - 1 : index;
    case 'ArrowRight':
      return column < hookColumns - 1 ? index + 1 : index;
    case 'ArrowUp':
      return row > 0 ? index - hookColumns : index;
    case 'ArrowDown':
      return row < hookRows - 1 ? index + hookColumns : index;
    case 'Home':
      return row * hookColumns;
    case 'End':
      return row * hookColumns + hookColumns - 1;
    default:
      return null;
  }
}

/** The accessible name of a marker: its hook row and column (numbered from 1), its state and whether it was changed (R10.4). */
export function markerLabel(t: Translate, marker: HookMarker): string {
  const state = t(marker.shape === 'filled' ? 'scan.marker.punched' : 'scan.marker.unpunched');
  const name = t('scan.marker.name', { row: marker.hookRow + 1, column: marker.hookColumn + 1, state });
  return marker.corrected ? `${name}, ${t('scan.marker.corrected')}` : name;
}

/** Counts of punched holes and hook positions, for a thumbnail's text. */
export function punchedCount(grid: CardGrid): { punched: number; total: number } {
  let punched = 0;
  let total = 0;
  for (const row of grid) {
    for (const hole of row) {
      total += 1;
      if (hole) punched += 1;
    }
  }
  return { punched, total };
}
