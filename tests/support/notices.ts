/**
 * The text of every Notice that is an alert, in the order it appears in server-rendered markup. A Notice puts its
 * word in a paragraph and its text in the block after it: `<div ... role="alert" ...><p>...word...</p><div>TEXT</div>`.
 * The text is returned as it is in the markup (HTML escaped, tags of its children kept).
 */
export function alertTexts(html: string): string[] {
  return noticeTexts(html, 'alert');
}

/** The text of every Notice with the given role (`alert` or `status`), as `alertTexts` does. */
export function noticeTexts(html: string, role: 'alert' | 'status'): string[] {
  const pattern = new RegExp(`<div class="[^"]*" role="${role}"[^>]*>.*?</p><div class="[^"]*">(.*?)</div>`, 'gs');
  return [...html.matchAll(pattern)].map((match) => match[1] ?? '');
}
