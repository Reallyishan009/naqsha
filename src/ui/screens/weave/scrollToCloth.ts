/** The id of the "The cloth" card on the Weave screen: the target of every Try it button. */
export const CLOTH_CARD_ID = 'weave-cloth-card';

/** What the helper needs from the page; a test gives fakes. */
export type ClothScrollDeps = {
  /** The element with this id, or null. */
  byId: (id: string) => Pick<Element, 'scrollIntoView'> | null;
  /** The bottom edge of the sticky header in px (its height plus its top offset), or null when there is none. */
  headerBottomPx: () => number | null;
  /** Receives the measured header bottom, in px, for the `--header-height` custom property. */
  setHeaderHeight: (px: number) => void;
};

const browserDeps: ClothScrollDeps = {
  byId: (id) => document.getElementById(id),
  headerBottomPx: () => {
    const header = document.querySelector('header');
    return header === null ? null : header.getBoundingClientRect().bottom;
  },
  setHeaderHeight: (px) => document.documentElement.style.setProperty('--header-height', `${Math.ceil(px)}px`),
};

/**
 * Scrolls the cloth card to just below the sticky header after a Try it button loaded a design: instantly under
 * reduced motion, smoothly otherwise. The header height is measured now and written to `--header-height`, which the
 * card's `scroll-margin-top` reads. A missing card or any failure does nothing. Never throws.
 */
export function scrollClothIntoView(reducedMotion: boolean, deps: ClothScrollDeps = browserDeps): boolean {
  try {
    const target = deps.byId(CLOTH_CARD_ID);
    if (target === null) return false;
    const bottom = deps.headerBottomPx();
    if (bottom !== null && Number.isFinite(bottom)) deps.setHeaderHeight(bottom);
    target.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    return true;
  } catch {
    return false;
  }
}
