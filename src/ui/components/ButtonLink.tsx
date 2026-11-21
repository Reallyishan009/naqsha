import type { MouseEvent, ReactNode } from 'react';
import { buttonClassName } from './Button.tsx';
import type { ButtonVariant } from './Button.tsx';

export type ButtonLinkProps = {
  href: string;
  onActivate: () => void;
  variant?: ButtonVariant;
  children: ReactNode;
};

/**
 * An `<a>` with the look of a Button. A plain click calls `onActivate` and stops the browser following `href`;
 * a click with a modifier key or a non-primary button is left to the browser.
 */
export function ButtonLink({ href, onActivate, variant = 'secondary', children }: ButtonLinkProps) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onActivate();
  };
  return (
    <a href={href} className={buttonClassName(variant)} onClick={onClick}>
      {children}
    </a>
  );
}
