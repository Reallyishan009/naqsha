import { Eyebrow } from './Eyebrow.tsx';
import styles from './SectionHeader.module.css';

export type SectionHeaderProps = {
  /** The language of the text. The accent word is italic only when it is not Hindi (Devanagari has no italic), so it is a colour change only in Hindi. */
  language: 'en' | 'hi';
  eyebrow: string;
  /** The heading is `before`, then the accent word, then `after`. The accent word is passed apart so a translation can place it anywhere. */
  before: string;
  accent: string;
  after?: string;
  subtitle?: string;
  /** The heading level; a section of the page is `h2` unless it sits under another heading. */
  as?: 'h1' | 'h2' | 'h3';
  /** The id of the heading, for an `aria-labelledby` on the section. */
  headingId?: string;
};

/** An eyebrow, a large serif heading of about two lines with one accent word in the tan accent, and a centred subtitle. */
export function SectionHeader({ language, eyebrow, before, accent, after = '', subtitle, as: Heading = 'h2', headingId }: SectionHeaderProps) {
  const accentClass = language === 'hi' ? styles.accent : `${styles.accent} ${styles.italic}`;
  return (
    <header className={styles.header}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Heading id={headingId} className={styles.heading}>
        {before}
        <em className={accentClass}>{accent}</em>
        {after}
      </Heading>
      {subtitle === undefined || subtitle === '' ? null : <p className={styles.subtitle}>{subtitle}</p>}
    </header>
  );
}
