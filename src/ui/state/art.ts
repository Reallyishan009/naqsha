/**
 * The pictures the app makes itself, in public/art: which file is which, how big it is in pixels and the key of its alt text.
 * `scripts/make_art.ts` writes exactly these files (node scripts/make_art.ts), so this list is the one place that names them.
 */

export type ArtId =
  | 'card-diamond'
  | 'card-border'
  | 'card-floral'
  | 'grid-diamond'
  | 'cloth-diamond'
  | 'cloth-border'
  | 'cloth-floral'
  | 'cloth-lost'
  | 'chain-8';

export type ArtSpec = {
  id: ArtId;
  /** A name inside public/art. */
  file: string;
  width: number;
  height: number;
  /** The i18n key of the alt text (in en.json and hi.json). */
  altKey: string;
};

/** One shape for every picture that goes on top of a card: 4 by 3. The chain is the same shape, drawn larger so its small punched holes stay clear. */
export const ART_WIDTH = 768;
export const ART_HEIGHT = 576;
export const CHAIN_WIDTH = 1152;
export const CHAIN_HEIGHT = 864;

const picture = (id: ArtId, altKey: string, width = ART_WIDTH, height = ART_HEIGHT): ArtSpec => ({
  id,
  file: `${id}.avif`,
  width,
  height,
  altKey,
});

export const ART: Readonly<Record<ArtId, ArtSpec>> = {
  'card-diamond': picture('card-diamond', 'art.cardDiamond.alt'),
  'card-border': picture('card-border', 'art.cardBorder.alt'),
  'card-floral': picture('card-floral', 'art.cardFloral.alt'),
  'grid-diamond': picture('grid-diamond', 'art.gridDiamond.alt'),
  'cloth-diamond': picture('cloth-diamond', 'art.clothDiamond.alt'),
  'cloth-border': picture('cloth-border', 'art.clothBorder.alt'),
  'cloth-floral': picture('cloth-floral', 'art.clothFloral.alt'),
  'cloth-lost': picture('cloth-lost', 'art.clothLost.alt'),
  'chain-8': picture('chain-8', 'art.chain8.alt', CHAIN_WIDTH, CHAIN_HEIGHT),
};

/** Every picture, in a fixed order. */
export const ART_LIST: readonly ArtSpec[] = Object.values(ART);

/** The URL of a file in public/art for a base such as `./` (Vite's BASE_URL). */
export function artUrl(base: string, file: string): string {
  return `${base}art/${file}`;
}
