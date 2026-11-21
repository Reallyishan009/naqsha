/** The photographs in public/photos: which file is which, how big it is, and the key of its alt text. */

export type PhotoId =
  | 'loom-hero'
  | 'sari-pattern-cards'
  | 'kanchipuram-handloom'
  | 'bradford-card-chain'
  | 'bradford-card-stack';

/** One file of a photo. `file` is a name inside public/photos, `width` and `height` are its pixels. */
export type PhotoFile = { file: string; width: number; height: number };

export type PhotoSpec = {
  id: PhotoId;
  /** The i18n key of the alt text (in en.json and hi.json). */
  altKey: string;
  /** The files of this photo, narrowest first. All have the same shape; a photo with two files is used as a srcset. */
  files: readonly [PhotoFile, ...PhotoFile[]];
};

export const PHOTOS: Readonly<Record<PhotoId, PhotoSpec>> = {
  'loom-hero': {
    id: 'loom-hero',
    altKey: 'photo.loomHero.alt',
    files: [
      { file: 'loom-hero-800.avif', width: 800, height: 450 },
      { file: 'loom-hero-1600.avif', width: 1600, height: 900 },
    ],
  },
  'sari-pattern-cards': {
    id: 'sari-pattern-cards',
    altKey: 'photo.sariPatternCards.alt',
    files: [{ file: 'sari-pattern-cards-900.avif', width: 900, height: 675 }],
  },
  'kanchipuram-handloom': {
    id: 'kanchipuram-handloom',
    altKey: 'photo.kanchipuramHandloom.alt',
    files: [{ file: 'kanchipuram-handloom-900.avif', width: 900, height: 675 }],
  },
  'bradford-card-chain': {
    id: 'bradford-card-chain',
    altKey: 'photo.bradfordCardChain.alt',
    files: [{ file: 'bradford-card-chain-900.avif', width: 675, height: 900 }],
  },
  'bradford-card-stack': {
    id: 'bradford-card-stack',
    altKey: 'photo.bradfordCardStack.alt',
    files: [{ file: 'bradford-card-stack-900.avif', width: 675, height: 900 }],
  },
};

/** Every photo, in a fixed order. */
export const PHOTO_LIST: readonly PhotoSpec[] = Object.values(PHOTOS);

/** The URL of a file in public/photos for a base such as `./` (Vite's BASE_URL). */
export function photoUrl(base: string, file: string): string {
  return `${base}photos/${file}`;
}

/** The `srcset` value of a photo (`<url> <width>w, ...`), or undefined when it has only one file. */
export function photoSrcSet(photo: PhotoSpec, base: string): string | undefined {
  if (photo.files.length < 2) return undefined;
  return photo.files.map((entry) => `${photoUrl(base, entry.file)} ${entry.width}w`).join(', ');
}
