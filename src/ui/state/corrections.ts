import type { CardGrid, CardProfile } from '../../codec/index.ts';
import { cardToImage } from '../../reader/index.ts';
import type { Pose } from '../../reader/index.ts';
import { hookCentreMm } from '../printable/layout.ts';
import type { HookMarker, HookPosition } from '../types.ts';

/** Smallest Touch_Target side in CSS pixels (R10.2). */
const MIN_TOUCH_TARGET_PX = 48;

function inGrid(grid: CardGrid, position: HookPosition): boolean {
  const { hookRow, hookColumn } = position;
  if (!Number.isInteger(hookRow) || !Number.isInteger(hookColumn)) return false;
  const row = grid[hookRow];
  return hookRow >= 0 && row !== undefined && hookColumn >= 0 && hookColumn < row.length;
}

/**
 * Flips one hook position between punched and unpunched and returns a new grid of the same size (R10.1, R10.6).
 * A position outside the grid returns the grid unchanged.
 */
export function toggleHook(grid: CardGrid, position: HookPosition): CardGrid {
  if (!inGrid(grid, position)) return grid;
  return grid.map((row, hookRow) =>
    hookRow === position.hookRow
      ? row.map((punched, hookColumn) => (hookColumn === position.hookColumn ? !punched : punched))
      : row,
  );
}

/**
 * Reverts the most recent correction by toggling its position again (R10.5).
 * With no correction left, returns the grid and the list unchanged.
 */
export function undoCorrection(
  grid: CardGrid,
  corrected: ReadonlyArray<HookPosition>,
): { grid: CardGrid; corrected: ReadonlyArray<HookPosition> } {
  const last = corrected[corrected.length - 1];
  if (last === undefined) return { grid, corrected };
  return { grid: toggleHook(grid, last), corrected: corrected.slice(0, -1) };
}

/** One marker per hook position, placed with the pose, with a shape for each state (R8.3, R8.4, R10.4). */
export function hookMarkers(
  profile: CardProfile,
  pose: Pose,
  grid: CardGrid,
  corrected: ReadonlyArray<HookPosition>,
): HookMarker[] {
  const markers: HookMarker[] = [];
  for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
    for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
      const toggles = corrected.filter((entry) => entry.hookRow === hookRow && entry.hookColumn === hookColumn).length;
      markers.push({
        hookRow,
        hookColumn,
        centrePx: cardToImage(pose, hookCentreMm(profile, hookRow, hookColumn)),
        shape: grid[hookRow]?.[hookColumn] === true ? 'filled' : 'ring',
        corrected: toggles % 2 === 1,
      });
    }
  }
  return markers;
}

/** Side in CSS pixels of the hit area of a marker whose neighbours are `spacingPx` apart at `zoom` (R10.2). */
export function hitSizePx(spacingPx: number, zoom: number): number {
  return spacingPx * zoom;
}

/** Smallest zoom, never below 1, at which `hitSizePx` reaches 48 CSS pixels (R10.3). */
export function minimumZoom(spacingPx: number): number {
  if (!(spacingPx > 0)) return 1;
  let zoom = Math.max(1, MIN_TOUCH_TARGET_PX / spacingPx);
  while (hitSizePx(spacingPx, zoom) < MIN_TOUCH_TARGET_PX) zoom *= 1 + Number.EPSILON;
  return zoom;
}
