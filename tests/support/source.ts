/**
 * Removes // and /* *\/ comments with a one-pass scanner that tracks '...', "..." and `...`
 * literals, so comment markers inside strings are kept. Newlines are preserved so line
 * numbers stay valid. With blankStrings, string contents are replaced by spaces too.
 * Limits: no regex-literal awareness (a `/` or quote inside a regex literal can confuse it),
 * and `${...}` inside a template literal is treated as string text.
 */
export function stripComments(text: string, blankStrings: boolean): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        if (text[i] === '\n') out += '\n';
        i++;
      }
      i += 2;
    } else if (c === "'" || c === '"' || c === '`') {
      out += c;
      i++;
      while (i < text.length && text[i] !== c) {
        if (text[i] === '\\') {
          out += blankStrings ? '  ' : text.slice(i, i + 2);
          i += 2;
          continue;
        }
        if (c !== '`' && text[i] === '\n') break; // unterminated literal: stop at end of line
        out += blankStrings && text[i] !== '\n' ? ' ' : text[i];
        i++;
      }
      if (i < text.length && text[i] === c) {
        out += c;
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}
