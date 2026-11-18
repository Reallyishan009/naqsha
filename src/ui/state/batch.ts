import type { CardGrid, Pattern } from '../../codec/index.ts';
import type { ScanBatch } from '../types.ts';

function inRange(batch: ScanBatch, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < batch.length;
}

/** Adds the card at the end of the Scan_Batch as the next pick (R11.1). */
export function appendCard(batch: ScanBatch, card: CardGrid): ScanBatch {
  return [...batch, card];
}

/** Removes the card at `index`; an index out of range returns the batch unchanged (R11.3). */
export function removeCard(batch: ScanBatch, index: number): ScanBatch {
  if (!inRange(batch, index)) return batch;
  return [...batch.slice(0, index), ...batch.slice(index + 1)];
}

/** Swaps the card at `index` with its neighbour one position earlier (-1) or later (1) (R11.4). At an edge or out of range the batch is unchanged. */
export function moveCard(batch: ScanBatch, index: number, by: -1 | 1): ScanBatch {
  if (!inRange(batch, index)) return batch;
  const target = index + by;
  if (!inRange(batch, target)) return batch;
  const next = [...batch];
  next[index] = batch[target]!;
  next[target] = batch[index]!;
  return next;
}

/** Puts `card` in place of the card at `index`; an index out of range returns the batch unchanged (R11.5). */
export function replaceCard(batch: ScanBatch, index: number, card: CardGrid): ScanBatch {
  if (!inRange(batch, index)) return batch;
  return batch.map((existing, position) => (position === index ? card : existing));
}

/** The Current_Pattern made by "Done": the batch alone, or the current pattern followed by the batch (R11.6, R11.8, R11.9). */
export function commitBatch(batch: ScanBatch, current: Pattern, mode: 'replace' | 'append'): Pattern {
  return mode === 'replace' ? [...batch] : [...current, ...batch];
}
