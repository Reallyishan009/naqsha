import { describe, expect, it } from 'vitest';
import { hasReached, revealStart, startReveal } from '../../../src/ui/state/reveal.ts';
import type { ObserveReveal, Reach, RevealPhase } from '../../../src/ui/state/reveal.ts';

/** An element that only knows where its top edge is. */
const elementAt = (top: number): Element => ({ getBoundingClientRect: () => ({ top }) }) as unknown as Element;

/** A fake observer: it records what is watched and lets the test say when a block is reached. */
function fakeObserver(): { observe: ObserveReveal; watched: () => number; stopped: () => number; report: (reach: Reach) => void } {
  const callbacks: Array<(reach: Reach) => void> = [];
  let stops = 0;
  return {
    observe: (_element, onReach) => {
      callbacks.push(onReach);
      return () => {
        stops++;
      };
    },
    watched: () => callbacks.length,
    stopped: () => stops,
    report: (reach) => callbacks.forEach((callback) => callback(reach)),
  };
}

/** The phase a block has, driven by the same update function the component hands over. */
function phaseHolder(initial: RevealPhase = 'visible'): { phase: () => RevealPhase; setPhase: (update: (phase: RevealPhase) => RevealPhase) => void } {
  let phase = initial;
  return {
    phase: () => phase,
    setPhase: (update) => {
      phase = update(phase);
    },
  };
}

const VIEWPORT = 800;

describe('scroll reveal logic', () => {
  it('a block below the first screen starts pending, and one on or above it starts visible', () => {
    expect(revealStart({ reducedMotion: false, top: 900, viewportHeight: VIEWPORT })).toBe('pending');
    expect(revealStart({ reducedMotion: false, top: VIEWPORT, viewportHeight: VIEWPORT })).toBe('pending');
    expect(revealStart({ reducedMotion: false, top: VIEWPORT - 1, viewportHeight: VIEWPORT })).toBe('visible');
    expect(revealStart({ reducedMotion: false, top: -300, viewportHeight: VIEWPORT })).toBe('visible');
  });

  it('under reduced motion every block starts visible, however far down it is', () => {
    expect(revealStart({ reducedMotion: true, top: 5000, viewportHeight: VIEWPORT })).toBe('visible');
  });

  it('a block is reached when it is on screen or has been scrolled past', () => {
    expect(hasReached({ isIntersecting: true, bottom: 900 })).toBe(true);
    expect(hasReached({ isIntersecting: false, bottom: -1 })).toBe(true);
    expect(hasReached({ isIntersecting: false, bottom: 0 })).toBe(true);
    expect(hasReached({ isIntersecting: false, bottom: 1400 })).toBe(false);
  });

  it('a block below the first screen is hidden, watched, shown once it is reached, and then no longer watched', () => {
    const observer = fakeObserver();
    const holder = phaseHolder();
    startReveal({ element: elementAt(1200), reducedMotion: false, viewportHeight: VIEWPORT, observe: observer.observe, setPhase: holder.setPhase });
    expect(holder.phase()).toBe('pending');
    expect(observer.watched()).toBe(1);
    // The observer's first report for a block far below: not reached, still hidden.
    observer.report({ isIntersecting: false, bottom: 1500 });
    expect(holder.phase()).toBe('pending');
    observer.report({ isIntersecting: true, bottom: 700 });
    expect(holder.phase()).toBe('revealed');
    expect(observer.stopped()).toBe(1);
    // It happens once: leaving the screen again changes nothing.
    observer.report({ isIntersecting: false, bottom: -20 });
    expect(holder.phase()).toBe('revealed');
    expect(observer.stopped()).toBe(1);
  });

  it('a block that is scrolled past before it was ever seen is shown', () => {
    const observer = fakeObserver();
    const holder = phaseHolder();
    startReveal({ element: elementAt(2000), reducedMotion: false, viewportHeight: VIEWPORT, observe: observer.observe, setPhase: holder.setPhase });
    observer.report({ isIntersecting: false, bottom: -100 });
    expect(holder.phase()).toBe('revealed');
  });

  it('a block on the first screen is never hidden and never watched', () => {
    const observer = fakeObserver();
    const holder = phaseHolder();
    startReveal({ element: elementAt(200), reducedMotion: false, viewportHeight: VIEWPORT, observe: observer.observe, setPhase: holder.setPhase });
    expect(holder.phase()).toBe('visible');
    expect(observer.watched()).toBe(0);
  });

  it('under reduced motion a block far below stays visible and nothing is watched', () => {
    const observer = fakeObserver();
    const holder = phaseHolder();
    startReveal({ element: elementAt(3000), reducedMotion: true, viewportHeight: VIEWPORT, observe: observer.observe, setPhase: holder.setPhase });
    expect(holder.phase()).toBe('visible');
    expect(observer.watched()).toBe(0);
  });

  it('when the browser has no observer the block stays visible', () => {
    const holder = phaseHolder();
    const stop = startReveal({ element: elementAt(3000), reducedMotion: false, viewportHeight: VIEWPORT, observe: () => null, setPhase: holder.setPhase });
    expect(holder.phase()).toBe('visible');
    expect(() => stop()).not.toThrow();
  });

  it('a hidden block is shown at once when motion is switched off', () => {
    const observer = fakeObserver();
    const holder = phaseHolder();
    startReveal({ element: elementAt(1500), reducedMotion: false, viewportHeight: VIEWPORT, observe: observer.observe, setPhase: holder.setPhase });
    expect(holder.phase()).toBe('pending');
    startReveal({ element: elementAt(1500), reducedMotion: true, viewportHeight: VIEWPORT, observe: observer.observe, setPhase: holder.setPhase });
    expect(holder.phase()).toBe('visible');
  });

  it('an observer that answers before it is handed back leaves the block revealed, not hidden', () => {
    const holder = phaseHolder();
    let stops = 0;
    const eager: ObserveReveal = (_element, onReach) => {
      onReach({ isIntersecting: true, bottom: 500 });
      return () => {
        stops++;
      };
    };
    startReveal({ element: elementAt(1500), reducedMotion: false, viewportHeight: VIEWPORT, observe: eager, setPhase: holder.setPhase });
    expect(holder.phase()).toBe('revealed');
    expect(stops).toBe(1);
  });

  it('stopping before the block is reached stops the observer, and stopping twice does it once', () => {
    const observer = fakeObserver();
    const holder = phaseHolder();
    const stop = startReveal({ element: elementAt(1500), reducedMotion: false, viewportHeight: VIEWPORT, observe: observer.observe, setPhase: holder.setPhase });
    stop();
    stop();
    expect(observer.stopped()).toBe(1);
  });
});
