import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import styles from './Disclosure.module.css';

export type DisclosureProps = {
  /** The text of the control, already translated ("More", "Settings"). */
  label: string;
  children: ReactNode;
  /** Controlled use: when given, the caller owns the state and `onToggle` receives the state the weaver asks for. */
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  id?: string;
};

/**
 * A control that shows or hides a group of controls. It starts collapsed each time it mounts unless `expanded` is given.
 * The content stays mounted while collapsed (`hidden`), so it is out of the Tab order and the accessibility tree and
 * keeps the values already entered. Escape inside the content collapses it and returns focus to the control.
 */
export function Disclosure({ label, children, expanded, onToggle, id }: DisclosureProps) {
  const generatedId = useId();
  const panelId = id ?? `disclosure-${generatedId.replace(/:/g, '')}`;
  const [ownExpanded, setOwnExpanded] = useState(false);
  const controlRef = useRef<HTMLButtonElement>(null);
  const isExpanded = expanded ?? ownExpanded;

  const change = (next: boolean): void => {
    if (expanded === undefined) setOwnExpanded(next);
    onToggle?.(next);
  };

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Escape' || !isExpanded) return;
    event.stopPropagation();
    // Focus moves first, so it is never left on a control that is about to become hidden.
    controlRef.current?.focus();
    change(false);
  };

  return (
    <div className={styles.disclosure}>
      <button
        ref={controlRef}
        type="button"
        className={styles.control}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={() => change(!isExpanded)}
      >
        <svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-open={isExpanded}>
          <polyline points="6,9 12,16 18,9" />
        </svg>
        <span>{label}</span>
      </button>
      <div id={panelId} className={styles.panel} hidden={!isExpanded} onKeyDown={onPanelKeyDown}>
        {children}
      </div>
    </div>
  );
}
