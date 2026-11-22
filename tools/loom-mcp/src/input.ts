import { readFileSync, statSync } from 'node:fs';
import { parseCardProfile } from '../../../src/codec/index.ts';
import type { CardProfile, Pattern, Violation } from '../../../src/codec/index.ts';
import { LIMITS } from './limits.ts';
import { repoGuard } from './paths.ts';
import type { PathGuard } from './paths.ts';
import { ToolError } from './result.ts';
/** The profile used when a tool is given none. */
export const DEFAULT_PROFILE_PATH = 'public/profiles/demo-12x16.json';
/** A violation as one sentence. The codec's messages already name the field at fault. */
export function violationSentence(violation: Violation): string {
  return violation.message;
}
function tooLarge(what: string, limit: number): ToolError {
  return new ToolError('too_large', `${what} is larger than the limit of ${limit} bytes.`, 'Send a smaller input, or give the path of a smaller file.');
}
/** Reads a file under the repository after its size is checked, so a large file is never read. */
export function readBoundedFile(guard: PathGuard, input: unknown, maxBytes: number, what: string): Buffer {
  const real = guard.readable(input);
  if (statSync(real).size > maxBytes) throw tooLarge(what, maxBytes);
  const bytes = readFileSync(real);
  if (bytes.length > maxBytes) throw tooLarge(what, maxBytes);
  return bytes;
}
/** A JSON file under the repository. A parse failure says only that the file is not JSON, never what it holds. */
export function loadJsonFile(input: unknown, guard: PathGuard = repoGuard): unknown {
  const bytes = readBoundedFile(guard, input, LIMITS.jsonFileBytes, 'The JSON file');
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new ToolError('not_json', 'The file is not valid JSON.', 'Give the path of a JSON file.');
  }
}
/** Inline JSON must stay within the inline limit, measured as it would be written. */
export function checkInline(value: unknown, what: string): void {
  const size = Buffer.byteLength(JSON.stringify(value) ?? '');
  if (size > LIMITS.inlineJsonBytes) throw tooLarge(`The inline ${what}`, LIMITS.inlineJsonBytes);
}
export type Source = { inline?: unknown; path?: unknown };
function chooseSource(source: Source, what: string, fallbackPath: string | null, guard: PathGuard): unknown {
  const hasInline = source.inline !== undefined;
  const hasPath = source.path !== undefined;
  if (hasInline && hasPath) {
    throw new ToolError('invalid_option', `Give the ${what} inline or as a path, not both.`, `Remove one of the two ${what} arguments.`);
  }
  if (hasInline) {
    checkInline(source.inline, what);
    return source.inline;
  }
  if (hasPath) return loadJsonFile(source.path, guard);
  if (fallbackPath !== null) return loadJsonFile(fallbackPath, guard);
  throw new ToolError('invalid_option', `No ${what} was given.`, `Give the ${what} inline or as a path under the repository.`);
}
/** The Card_Profile from an inline value, a path, or the demo profile when `useDefault` is set. */
export function resolveProfile(source: Source, useDefault: boolean, guard: PathGuard = repoGuard): CardProfile {
  const value = chooseSource(source, 'card profile', useDefault ? DEFAULT_PROFILE_PATH : null, guard);
  const parsed = parseCardProfile(value);
  if (!parsed.ok) {
    const first = parsed.violations[0];
    throw new ToolError(
      'invalid_profile',
      `The card profile is not valid (${parsed.violations.length} problem${parsed.violations.length === 1 ? '' : 's'}). ${first === undefined ? '' : violationSentence(first)}`.trim(),
      'Run validate_profile on it to see every problem.',
    );
  }
  return parsed.value;
}
/**
 * A Pattern from an inline array, or from a design file that holds an array of cards or an object with a `pattern`.
 * Only the shape of the list is checked here; a card that cannot be read is a gap, which render_cloth reports.
 */
export function resolvePattern(source: Source, what = 'pattern', guard: PathGuard = repoGuard): Pattern {
  const value = chooseSource(source, what, null, guard);
  const list = Array.isArray(value) ? value : typeof value === 'object' && value !== null ? (value as { pattern?: unknown }).pattern : undefined;
  if (!Array.isArray(list)) {
    throw new ToolError('invalid_pattern', `The ${what} must be a list of cards, or an object with a "pattern" list.`, 'Each card is a list of hook rows, each a list of true and false.');
  }
  if (list.length > LIMITS.picks) {
    throw new ToolError('too_large', `The ${what} has ${list.length} picks, more than the limit of ${LIMITS.picks}.`, 'Use a shorter design.');
  }
  return list as Pattern;
}
