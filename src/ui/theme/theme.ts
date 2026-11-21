import type { ThemeName } from './contrast.ts';

/** The localStorage key of the chosen theme. The inline script of index.html reads the same key. */
export const THEME_STORAGE_KEY = 'naqsha.theme';

/** A stored choice wins. Without one, a dark preference gives `night` and anything else gives `day`. */
export function chooseTheme(stored: ThemeName | null, prefersDark: boolean): ThemeName {
  if (stored === 'day' || stored === 'night') return stored;
  return prefersDark ? 'night' : 'day';
}

/** Sets `data-theme` on the root element. Does nothing when there is no root. */
export function applyTheme(root: Pick<Element, 'setAttribute'> | null, theme: ThemeName): void {
  if (root === null) return;
  root.setAttribute('data-theme', theme);
}
