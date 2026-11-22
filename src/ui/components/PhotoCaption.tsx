import { IMAGE_CREDITS } from '../state/imageCredits.ts';
import type { ImageCredit } from '../state/imageCredits.ts';
import type { PhotoSpec } from '../state/photos.ts';
import type { Translate } from '../i18n/messages.ts';
import styles from './PhotoCaption.module.css';

export type PhotoCaptionProps = {
  photo: PhotoSpec;
  t: Translate;
  /** The credits to look in; defaults to those read from docs/IMAGE_CREDITS.md at build time. */
  credits?: readonly ImageCredit[];
};

/** The short credit under a photo shown on a screen: "Photo: author, licence", a link to the source page. Nothing when the photo has no credit line. */
export function PhotoCaption({ photo, t, credits = IMAGE_CREDITS }: PhotoCaptionProps) {
  const credit = credits.find((entry) => photo.files.some((file) => entry.files.includes(file.file)));
  if (credit === undefined) return null;
  return (
    <p className={styles.caption} data-photo-caption={photo.id}>
      <a className={styles.link} href={credit.sourceUrl} target="_blank" rel="noreferrer">
        {t('credits.photos.caption', { author: credit.author, licence: credit.licenceName })}
      </a>
    </p>
  );
}
