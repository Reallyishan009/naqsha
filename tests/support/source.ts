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

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

/**
 * The module specifiers of `import ... from '...'`, `export ... from '...'`, a bare
 * `import '...'` and a dynamic `import('...')`, each with the 1-based line it sits on.
 * Pass code that has been through `stripComments`, so a specifier inside a comment is not a hit.
 * Limit: the three patterns read the text, not a parse tree, so a specifier built at run time
 * (`import(base + name)`) is not found.
 */
export function importSpecifiers(code: string): { specifier: string; line: number }[] {
  const found: { specifier: string; line: number }[] = [];
  const patterns = [
    /\b(?:import|export)\b[^;'"`]*?\bfrom\s*(['"])([^'"]+)\1/g,
    /\bimport\s*(['"])([^'"]+)\1/g,
    /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const m of code.matchAll(pattern)) found.push({ specifier: m[2], line: lineOf(code, m.index) });
  }
  return found;
}
