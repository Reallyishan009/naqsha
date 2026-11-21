import { photoSrcSet, photoUrl } from '../state/photos.ts';
import type { PhotoSpec } from '../state/photos.ts';
import styles from './Photo.module.css';

export type PhotoProps = {
  photo: PhotoSpec;
  /** The alt text, already translated (look it up with `photo.altKey`). */
  alt: string;
  /** Load the picture only when it is near the screen. Leave off for a picture at the top of the page. */
  lazy?: boolean;
  /** The `sizes` attribute for a photo with two files; the width the picture fills. Defaults to the whole screen width. */
  sizes?: string;
  /** Layout only (aspect ratio, object-fit, rounded frame); the placeholder colour comes from the module. */
  className?: string;
};

/**
 * One photograph from public/photos as an `<img>` with its width and height set (so the page does not move when it
 * loads), a solid placeholder colour behind it, and a `srcset` when the photo has two sizes.
 */
export function Photo({ photo, alt, lazy = false, sizes = '100vw', className }: PhotoProps) {
  const base = import.meta.env.BASE_URL;
  const smallest = photo.files[0];
  const largest = photo.files[photo.files.length - 1] ?? smallest;
  const srcSet = photoSrcSet(photo, base);
  const classes = className === undefined || className === '' ? styles.photo : `${styles.photo} ${className}`;
  return (
    <img
      className={classes}
      src={photoUrl(base, smallest.file)}
      srcSet={srcSet}
      sizes={srcSet === undefined ? undefined : sizes}
      width={largest.width}
      height={largest.height}
      alt={alt}
      loading={lazy ? 'lazy' : undefined}
      decoding="async"
      data-photo={photo.id}
    />
  );
}
