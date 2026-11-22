/** A heading cut into the words before, the accent word and the words after. */
export type AccentParts = { before: string; accent: string; after: string };

/** The heading cut around its accent word (the last place the word occurs); null when the word is empty or not in the heading. */
export function splitAtAccent(heading: string, accent: string): AccentParts | null {
  const at = accent === '' ? -1 : heading.lastIndexOf(accent);
  if (at < 0) return null;
  return { before: heading.slice(0, at), accent, after: heading.slice(at + accent.length) };
}
