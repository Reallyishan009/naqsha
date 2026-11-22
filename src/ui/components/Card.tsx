import type { ReactNode } from 'react';
import { Chip } from './Chip.tsx';
import styles from './Card.module.css';

export type CardProps = {
  /** The picture on top (a Photo, an `<img>` or a drawing). It fills the width at the aspect ratio of the module and is cropped to it. Leave out for a card with no picture. */
  picture?: ReactNode;
  /** The serif title, already translated. */
  title: string;
  /** The heading level of the title. */
  titleAs?: 'h2' | 'h3' | 'h4';
  /** Short chips under the text, already translated. */
  chips?: readonly string[];
  /** The tag the card is drawn with: `article` by default, or `li` inside a list. */
  as?: 'article' | 'li' | 'div';
  /** A control or link under the chips (a Button or ButtonLink). */
  action?: ReactNode;
  /** Layout only (margin, width). */
  className?: string;
  /** The element id, for a scroll target. */
  id?: string;
  /** The short text. */
  children?: ReactNode;
};

/** A rounded card: a picture on top, a serif title, a short text, small chips and an optional action. */
export function Card({ picture, title, titleAs: Title = 'h3', chips, as: Element = 'article', action, className, id, children }: CardProps) {
  const classes = className === undefined || className === '' ? styles.card : `${styles.card} ${className}`;
  return (
    <Element id={id} className={classes}>
      {picture === undefined || picture === null ? null : <div className={styles.picture}>{picture}</div>}
      <div className={styles.body}>
        <Title className={styles.title}>{title}</Title>
        {children === undefined || children === null ? null : <div className={styles.text}>{children}</div>}
        {chips === undefined || chips.length === 0 ? null : (
          <ul className={styles.chips}>
            {chips.map((chip) => (
              <li key={chip}>
                <Chip>{chip}</Chip>
              </li>
            ))}
          </ul>
        )}
        {action === undefined || action === null ? null : <div className={styles.action}>{action}</div>}
      </div>
    </Element>
  );
}
