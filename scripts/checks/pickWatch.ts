/**
 * Pure part of the wait for the Weave pick counter to reach the last pick, used by `npm run check:browser`.
 * No I/O here: the caller reads the counter text and passes it in.
 */
export type PickReading = { pick: number; total: number };
export type PickWatch = { seen: number[] };

export const newPickWatch = (): PickWatch => ({ seen: [] });

/** Feeds one reading of the counter (null when the counter is not on the page). */
export function stepPickWatch(watch: PickWatch, reading: PickReading | null, total: number): { watch: PickWatch; done: boolean } {
  const seen = [...watch.seen];
  if (reading !== null && reading.total === total) {
    if (seen.length === 0 || seen[seen.length - 1] !== reading.pick) seen.push(reading.pick);
    // Done on the last pick whatever came before: a finished cloth can show the last pick on the first read,
    // and waiting for an earlier value first made the wait hang (the step 11 flake).
    if (reading.pick === total) return { watch: { seen }, done: true };
  }
  return { watch: { seen }, done: false };
}
