import { IMAGE_CREDITS } from '../state/imageCredits.ts';
import type { ImageCredit } from '../state/imageCredits.ts';
import type { Translate } from '../i18n/messages.ts';
import styles from './PhotoCredits.module.css';

export type PhotoCreditsProps = {
  t: Translate;
  /** The credits to list; defaults to those read from docs/IMAGE_CREDITS.md at build time. */
  credits?: readonly ImageCredit[];
  /** The element id of the heading, so a parent can name the region by it. */
  headingId?: string;
};

/**
 * The photo credits: for each photo its title and author, the licence (a link to the licence), a link to the source
 * page, and the change made ("resized, converted"). The list comes from docs/IMAGE_CREDITS.md, not from this file.
 */
export function PhotoCredits({ t, credits = IMAGE_CREDITS, headingId }: PhotoCreditsProps) {
  return (
    <section className={styles.credits} aria-labelledby={headingId} data-photo-credits="">
      <h3 id={headingId} className={styles.heading}>
        {t('credits.photos.heading')}
      </h3>
      <ul className={styles.list}>
        {credits.map((credit) => (
          <li key={credit.files.join(',')} className={styles.entry} data-credit-files={credit.files.join(' ')}>
            {t('credits.photos.item', { title: credit.title, author: credit.author })}{' '}
            <a className={styles.link} href={credit.licenceUrl} target="_blank" rel="noreferrer">
              {credit.licenceName}
            </a>
            {' · '}
            <a className={styles.link} href={credit.sourceUrl} target="_blank" rel="noreferrer">
              {t('credits.photos.source')}
            </a>
            {' · '}
            {t('credits.photos.change')}
          </li>
        ))}
      </ul>
    </section>
  );
}
