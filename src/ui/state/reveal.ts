/**
 * The logic of the scroll reveal of the Landing: a block below the first screen fades in and rises a few pixels once,
 * the first time it comes into view. No React and no DOM here, so a fake observer can drive it in a test.
 *
 * The rule that matters most: a block is visible until the browser has confirmed that it can tell when the block
 * comes into view. Without IntersectionObserver, under Reduced_Motion, and for any block that is already on screen or
 * above it, nothing is ever hidden.
 */

/** `visible`: never hidden, no data attribute. `pending`: hidden, waiting for the block to come into view. `revealed`: shown, and it moved in. */
export type RevealPhase = 'visible' | 'pending' | 'revealed';

/** What an observer says about a block: whether it is on screen now, and where its bottom edge is relative to the top of the screen. */
export type Reach = { isIntersecting: boolean; bottom: number };

/**
 * Watches one element and calls back with what it sees. Gives back the function that stops watching, or null when
 * the browser cannot watch (no IntersectionObserver), in which case nothing was set up.
 */
export type ObserveReveal = (element: Element, onReach: (reach: Reach) => void) => (() => void) | null;

/** `pending` only for a block that starts below the bottom edge of the screen and only when motion is allowed. */
export function revealStart(input: { reducedMotion: boolean; top: number; viewportHeight: number }): 'visible' | 'pending' {
  if (input.reducedMotion) return 'visible';
  return input.top >= input.viewportHeight ? 'pending' : 'visible';
}

/** True once the block is on screen, or has been scrolled past (its bottom edge is at or above the top of the screen). */
export function hasReached(reach: Reach): boolean {
  return reach.isIntersecting || reach.bottom <= 0;
}

export type RevealDeps = {
  element: Element;
  reducedMotion: boolean;
  /** The height of the screen in CSS pixels. */
  viewportHeight: number;
  observe: ObserveReveal;
  /** Sets the phase of the block from the phase it has. */
  setPhase: (update: (phase: RevealPhase) => RevealPhase) => void;
};

/**
 * Decides the starting phase of a block and, for a block that starts hidden, watches it until it is reached, once.
 * Gives back the function that stops watching (safe to call twice).
 */
export function startReveal(deps: RevealDeps): () => void {
  const { element, reducedMotion, viewportHeight, observe, setPhase } = deps;
  const start = revealStart({ reducedMotion, top: element.getBoundingClientRect().top, viewportHeight });
  if (start === 'visible') {
    // A block that was waiting and now must stay shown (motion was switched off) is shown at once.
    setPhase((phase) => (phase === 'pending' ? 'visible' : phase));
    return () => undefined;
  }
  let reached = false;
  let stop: (() => void) | null = null;
  const stopWatching = (): void => {
    const current = stop;
    stop = null;
    current?.();
  };
  const watching = observe(element, (reach) => {
    if (reached || !hasReached(reach)) return;
    reached = true;
    setPhase(() => 'revealed');
    stopWatching();
  });
  // No observer: the block stays visible. Hiding it would be the one mistake that cannot be undone.
  if (watching === null) return () => undefined;
  stop = watching;
  // The observer may have answered before it was handed back; then the block is already shown.
  if (reached) {
    stopWatching();
    return () => undefined;
  }
  setPhase((phase) => (phase === 'revealed' ? phase : 'pending'));
  return stopWatching;
}

/** The browser's observer: one IntersectionObserver for the element, or null when the browser has none. */
export const browserObserveReveal: ObserveReveal = (element, onReach) => {
  if (typeof IntersectionObserver === 'undefined') return null;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) onReach({ isIntersecting: entry.isIntersecting, bottom: entry.boundingClientRect.bottom });
  });
  observer.observe(element);
  return () => observer.disconnect();
};
