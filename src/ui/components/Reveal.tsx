import { createContext, createElement, useContext, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { browserObserveReveal, startReveal } from '../state/reveal.ts';
import type { ObserveReveal, RevealPhase } from '../state/reveal.ts';
import styles from './Reveal.module.css';

export type RevealContextValue = {
  /** True under Reduced_Motion: nothing is hidden and nothing moves. */
  reducedMotion: boolean;
  /** Tells when a block comes into view; a test gives its own. */
  observe: ObserveReveal;
};

/** What a Reveal uses when no provider is above it: motion allowed, the browser's own observer. */
export const RevealContext = createContext<RevealContextValue>({ reducedMotion: false, observe: browserObserveReveal });

export type RevealProps = {
  /** The tag drawn: `div` by default, or `li` for a list item. */
  as?: 'div' | 'li';
  /** Layout only. */
  className?: string;
  /** Extra data attributes of the element (`data-step`). */
  data?: Readonly<Record<`data-${string}`, string>>;
  children: ReactNode;
};

/**
 * A block that fades in and rises 12 px once, the first time it comes into view. It is drawn visible. Only after the
 * page has measured it and the browser's observer has been set up does a block that is below the first screen
 * become hidden, and it is shown again when it is reached; under Reduced_Motion, without IntersectionObserver, and for
 * a block that is on screen at the start it is never hidden. The hiding and the movement are in the module's CSS, inside
 * the no-preference media query, so a browser that asks for no motion never hides it either.
 */
export function Reveal({ as: tag = 'div', className, data, children }: RevealProps) {
  const { reducedMotion, observe } = useContext(RevealContext);
  const elementRef = useRef<HTMLElement | null>(null);
  const [phase, setPhase] = useState<RevealPhase>('visible');
  // Before the first paint, so a block that is going to be hidden is never seen for a frame.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (element === null) return undefined;
    return startReveal({ element, reducedMotion, viewportHeight: window.innerHeight, observe, setPhase: (update) => setPhase(update) });
  }, [reducedMotion, observe]);
  const classes = className === undefined || className === '' ? styles.reveal : `${styles.reveal} ${className}`;
  return createElement(
    tag,
    {
      ref: (node: HTMLElement | null) => {
        elementRef.current = node;
      },
      className: classes,
      'data-reveal': phase === 'visible' ? undefined : phase,
      ...data,
    },
    children,
  );
}
