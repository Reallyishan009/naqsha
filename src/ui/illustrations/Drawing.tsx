import { useId } from 'react';
import type { ReactNode } from 'react';
import { STROKE } from './strokes.ts';
import styles from './Drawings.module.css';

type Common = {
  className?: string;
};

/**
 * A drawing is decoration unless the caller says otherwise (R14.5). A drawing that is not decoration states what it
 * shows in a title and a description, both in the current language, which the caller passes in.
 */
export type DrawingProps =
  | (Common & { decorative?: true })
  | (Common & { decorative: false; title: string; desc: string });

type FrameProps = {
  /** `step` is a small icon beside a label; `spot` is a picture in an empty state. */
  kind: 'step' | 'spot';
  viewBox: string;
  children: ReactNode;
  props: DrawingProps;
  /** Names the drawing in `data-drawing`, so a test or a screenshot can tell the drawings apart. */
  name: string;
};

/** The one `<svg>` element all six drawings share: viewBox, round pen, accessible name or `aria-hidden`. */
export function Frame({ kind, viewBox, children, props, name }: FrameProps) {
  const id = useId();
  const className = [kind === 'step' ? styles.step : styles.spot, props.className].filter(Boolean).join(' ');
  const common = {
    className,
    viewBox,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: STROKE.line,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    focusable: 'false' as const,
    'data-drawing': name,
  };
  if (props.decorative === false) {
    return (
      <svg {...common} role="img" aria-labelledby={`${id}-title ${id}-desc`}>
        <title id={`${id}-title`}>{props.title}</title>
        <desc id={`${id}-desc`}>{props.desc}</desc>
        {children}
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      {children}
    </svg>
  );
}
