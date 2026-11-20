/**
 * Word scanning for the structure checks in tests/structure/.
 *
 * `scanTerms` finds a listed word used as a word unit inside an identifier or inside a comment.
 * It holds no word list and no allowlist of its own: the caller passes the words and decides
 * which findings are acceptable, so this module stays a detector and the policy stays with the
 * check that applies it (tests/structure/glossaryTerms.test.ts).
 *
 * `scanNumbers` finds a listed number written as a numeric literal in code.
 *
 * Limits, in both functions:
 * - String literal contents are not scanned. User-facing text and CSS strings are not identifiers
 *   or comments, and the glossary's naming rule is about identifiers and comments.
 * - A word unit must match exactly, apart from a trailing "s" (so "rows" matches "row" but
 *   "rowwise" and "overlapping" do not).
 * - Regular-expression literals are read as code by the comment stripper, so a quote or a slash
 *   inside one can confuse the scan of that line (the limit is `stripComments`').
 */
import { stripComments } from './source.ts';

export type TermContext = 'identifier' | 'comment';

export type TermFinding = {
  /** 1-based line of the matched word. */
  line: number;
  /** The listed word that matched, as listed (lower case, singular). */
  word: string;
  /** The identifier as written, or the comment word as written. */
  token: string;
  /** `qualifier.token` when the identifier follows a dot, otherwise the token. */
  path: string;
  /** The word units of the identifier, or of the comment sentence, lower case. */
  words: string[];
  /** Index in `words` of the word that matched. */
  at: number;
  /** A short piece of the source around the match, for the failure message. */
  context: string;
  kind: TermContext;
};

export type NumberFinding = {
  /** 1-based line of the literal. */
  line: number;
  /** The number as listed. */
  value: number;
  /** The literal as written. */
  literal: string;
  /** The whole code line the literal sits on, comments and strings blanked. */
  lineText: string;
  /** A short piece of the source around the literal, for the failure message. */
  context: string;
};

/** Splits an identifier into lower-case word units: hookRows -> [hook, rows], HTMLRow -> [html, row]. */
export function splitWords(identifier: string): string[] {
  return (identifier.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+/g) ?? []).map((part) => part.toLowerCase());
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === '\n') line++;
  return line;
}

function around(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 30);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/** Every `// ...` and block comment of the text, with the index where its content starts. */
export function extractComments(text: string): { index: number; text: string }[] {
  const comments: { index: number; text: string }[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      const stop = end === -1 ? text.length : end;
      comments.push({ index: i + 2, text: text.slice(i + 2, stop) });
      i = stop;
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end;
      comments.push({ index: i + 2, text: text.slice(i + 2, stop) });
      i = stop + 2;
    } else if (c === "'" || c === '"' || c === '`') {
      i++;
      while (i < text.length && text[i] !== c) {
        if (text[i] === '\\') i += 2;
        else if (c !== '`' && text[i] === '\n') break;
        else i++;
      }
      i++;
    } else {
      i++;
    }
  }
  return comments;
}

/** Identifiers of the code, with the identifier before a dot kept as the qualifier. */
export function identifierTokens(code: string): { index: number; token: string; path: string }[] {
  const tokens: { index: number; token: string; path: string }[] = [];
  const pattern = /[A-Za-z_$][\w$]*/g;
  let previous: { token: string; end: number } | null = null;
  for (const m of code.matchAll(pattern)) {
    const token = m[0];
    const before = code.slice(previous?.end ?? 0, m.index);
    const dotted = previous !== null && /^\s*[.?]?\.\s*$/.test(before);
    tokens.push({ index: m.index, token, path: dotted ? `${previous!.token}.${token}` : token });
    previous = { token, end: m.index + token.length };
  }
  return tokens;
}

function matches(unit: string, word: string): boolean {
  return unit === word || (unit.endsWith('s') && unit.slice(0, -1) === word);
}

/**
 * Every use of a listed word as a word unit of an identifier, or as a word of a comment.
 * Words are compared lower case, with a trailing "s" allowed.
 */
export function scanTerms(text: string, words: readonly string[]): TermFinding[] {
  const findings: TermFinding[] = [];
  const code = stripComments(text, true);
  for (const { index, token, path } of identifierTokens(code)) {
    const units = splitWords(token);
    units.forEach((unit, at) => {
      for (const word of words) {
        if (!matches(unit, word)) continue;
        findings.push({
          line: lineOf(code, index),
          word,
          token,
          path,
          words: units,
          at,
          context: around(code, index, token.length),
          kind: 'identifier',
        });
      }
    });
  }
  for (const comment of extractComments(text)) {
    const units: { unit: string; index: number }[] = [];
    for (const m of comment.text.matchAll(/[A-Za-z]+/g)) units.push({ unit: m[0].toLowerCase(), index: m.index });
    units.forEach(({ unit, index }, at) => {
      for (const word of words) {
        if (!matches(unit, word)) continue;
        const absolute = comment.index + index;
        findings.push({
          line: lineOf(text, absolute),
          word,
          token: comment.text.slice(index, index + unit.length),
          path: comment.text.slice(index, index + unit.length),
          words: units.map((u) => u.unit),
          at,
          context: around(text, absolute, unit.length),
          kind: 'comment',
        });
      }
    });
  }
  return findings.sort((a, b) => a.line - b.line || a.at - b.at);
}

/**
 * Every numeric literal of the code (comments and strings blanked) whose value is one of the
 * listed numbers. A value written in another form (6 * 32, 0x2d, 1_2, `60 - 15`) is not found;
 * the digits must be the literal. A number that is part of an identifier (`demo12x16`) or of a
 * property path (`a.12`) is not a literal and is not returned.
 */
export function scanNumbers(text: string, values: readonly number[]): NumberFinding[] {
  const findings: NumberFinding[] = [];
  const code = stripComments(text, true);
  const lines = code.split('\n');
  const pattern = /(?<![\w$.])\d+(?:\.\d+)?(?![\w$.])/g;
  for (const m of code.matchAll(pattern)) {
    const value = Number(m[0]);
    if (!values.includes(value)) continue;
    const line = lineOf(code, m.index);
    findings.push({
      line,
      value,
      literal: m[0],
      lineText: lines[line - 1] ?? '',
      context: around(code, m.index, m[0].length),
    });
  }
  return findings;
}
