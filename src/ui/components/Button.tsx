import type { ComponentPropsWithRef } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';

export type ButtonProps = Omit<ComponentPropsWithRef<'button'>, 'type'> & {
  variant?: ButtonVariant;
  type?: 'button' | 'submit';
};

/** The class names of a Button variant; ButtonLink and the Sample_Tiles use the same look. */
export function buttonClassName(variant: ButtonVariant = 'secondary', extra?: string): string {
  return [styles.button, styles[variant], extra].filter((name) => name !== undefined && name !== '').join(' ');
}

/** One `<button>`. The type is `button` unless the caller asks for `submit`, so it never submits a form by accident. */
export function Button({ variant = 'secondary', type = 'button', className, ...rest }: ButtonProps) {
  // `type` and `className` come first, then the other attributes, so the markup reads like a plain button's.
  return <button type={type} className={buttonClassName(variant, className)} {...rest} />;
}
