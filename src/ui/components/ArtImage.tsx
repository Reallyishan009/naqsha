import { artUrl } from '../state/art.ts';
import type { ArtSpec } from '../state/art.ts';
import styles from './ArtImage.module.css';

export type ArtImageProps = {
  art: ArtSpec;
  /** The alt text, already translated (look it up with `art.altKey`). */
  alt: string;
  /** Load the picture only when it is near the screen. Leave off for a picture at the top of the page. */
  lazy?: boolean;
  /** Layout only (aspect ratio, object-fit, rounded frame); the placeholder colour comes from the module. */
  className?: string;
};

/**
 * One picture the app made itself (public/art) as an `<img>` with its width and height set, so the page does not
 * move when it loads, and a solid placeholder colour behind it.
 */
export function ArtImage({ art, alt, lazy = false, className }: ArtImageProps) {
  const classes = className === undefined || className === '' ? styles.art : `${styles.art} ${className}`;
  return (
    <img
      className={classes}
      src={artUrl(import.meta.env.BASE_URL, art.file)}
      width={art.width}
      height={art.height}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      decoding="async"
      data-art={art.id}
    />
  );
}
