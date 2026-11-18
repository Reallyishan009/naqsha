import type { Frame, PreparedCloth } from './types.ts';

/** Number of weft pass steps in one woven pick (R9.1). */
export const PASS_STEPS = 8;

const rest = (pick: number): Frame => ({ pick, phase: 'rest' });

function isWoven(cloth: PreparedCloth, pick: number): boolean {
  return cloth.picks[pick]?.kind === 'woven';
}

/**
 * The frames that lie between rest(pick) and rest(pick + 1), neither rest frame included (R9.1, R9.3).
 * A woven pick gives lift(pick) then pass(pick, 0..PASS_STEPS-1). A gap pick gives an empty list.
 * A pick outside 0..slotCount-1 also gives an empty list. Never throws.
 */
export function framesForPick(cloth: PreparedCloth, pick: number): Frame[] {
  if (!Number.isInteger(pick) || pick < 0 || pick >= cloth.picks.length || !isWoven(cloth, pick)) return [];
  const frames: Frame[] = [{ pick, phase: 'lift' }];
  for (let step = 0; step < PASS_STEPS; step++) frames.push({ pick, phase: 'pass', step });
  return frames;
}

/**
 * The frame to show after elapsedMs of playing picks startPick..endPick-1 at picksPerSecond (R10.3).
 * Each pick has a slot of 1000 / picksPerSecond ms. A woven pick's slot is split evenly over rest, lift and the
 * PASS_STEPS pass frames. A gap pick shows rest for its whole slot. The frame depends only on elapsedMs, so a slow
 * renderer skips frames and does not slow the play. After the end pick it returns rest(endPick).
 *
 * Edge cases: startPick and endPick are clamped to 0..slotCount (a non-integer or non-finite value counts as 0),
 * and endPick below startPick is treated as endPick = startPick. A negative or non-finite elapsedMs, or a
 * picksPerSecond that is not finite or not above 0, returns rest(startPick). Never throws.
 */
export function frameAt(
  cloth: PreparedCloth,
  startPick: number,
  endPick: number,
  picksPerSecond: number,
  elapsedMs: number,
): Frame {
  const count = cloth.picks.length;
  const clamp = (value: number): number =>
    Number.isFinite(value) ? Math.min(count, Math.max(0, Math.floor(value))) : 0;
  const start = clamp(startPick);
  const end = Math.max(start, clamp(endPick));
  if (!Number.isFinite(picksPerSecond) || picksPerSecond <= 0) return rest(start);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return rest(start);
  const offset = (elapsedMs * picksPerSecond) / 1000;
  if (!Number.isFinite(offset)) return rest(end);
  const whole = Math.floor(offset);
  if (start + whole >= end) return rest(end);
  const pick = start + whole;
  if (!isWoven(cloth, pick)) return rest(pick);
  const index = Math.min(PASS_STEPS + 1, Math.floor((offset - whole) * (PASS_STEPS + 2)));
  if (index === 0) return rest(pick);
  if (index === 1) return { pick, phase: 'lift' };
  return { pick, phase: 'pass', step: index - 2 };
}
