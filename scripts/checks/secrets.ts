/**
 * Secret scan over the text of tracked files. Pure: takes file paths and text, returns findings.
 * A finding never carries the full secret; `masked` keeps the first four characters only.
 *
 * Detected formats (each one is a pattern below):
 * - aws-access-key: `AKIA` or `ASIA` followed by 16 upper-case letters or digits.
 * - github-token: `ghp_`, `gho_`, `ghu_`, `ghs_` or `ghr_` followed by 36 or more letters or digits.
 * - github-fine-grained-token: `github_pat_` followed by 22 or more letters, digits or `_`.
 * - sk-style-key: `sk-` (not preceded by a letter or digit) followed by 20 or more letters, digits, `_` or `-`.
 * - generic-assignment: a name containing `api_key`, `api-key`, `apikey`, `secret` or `token`, then `:` or `=`,
 *   then a value of 20 or more letters, digits or `_-+/=` (optionally quoted).
 * - private-key-header: `-----BEGIN ... PRIVATE KEY-----`.
 */

export type SecretPattern = { name: string; regex: RegExp; group: number };

export const SECRET_PATTERNS: readonly SecretPattern[] = [
  { name: 'aws-access-key', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, group: 0 },
  { name: 'github-token', regex: /\bgh[pousr]_[A-Za-z0-9]{36,}/g, group: 0 },
  { name: 'github-fine-grained-token', regex: /\bgithub_pat_[A-Za-z0-9_]{22,}/g, group: 0 },
  { name: 'sk-style-key', regex: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{20,}/g, group: 0 },
  {
    name: 'generic-assignment',
    regex: /(?:api[_-]?key|secret|token)[\w-]*["']?\s*[:=]\s*["']?([A-Za-z0-9_\-+/=]{20,})/gi,
    group: 1,
  },
  { name: 'private-key-header', regex: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g, group: 0 },
];

/** An allowlist entry. `contains`, when given, narrows it to lines that include that text. */
export type AllowEntry = { file: string; contains?: string; reason: string };

/**
 * The allowlist is empty: the scan over this repository needs no exceptions.
 * Add an entry only with a reason, and keep `contains` as narrow as possible.
 */
export const SECRET_ALLOWLIST: readonly AllowEntry[] = [];

export type Finding = { file: string; line: number; pattern: string; masked: string };

/** First four characters, then asterisks and the length. Never the full value. */
export function maskSecret(value: string): string {
  return `${value.slice(0, 4)}**** (${value.length} chars)`;
}

function isAllowed(file: string, lineText: string, allowlist: readonly AllowEntry[]): boolean {
  return allowlist.some(
    (entry) => entry.file === file && (entry.contains === undefined || lineText.includes(entry.contains)),
  );
}

export function scanText(
  file: string,
  text: string,
  allowlist: readonly AllowEntry[] = SECRET_ALLOWLIST,
): Finding[] {
  const findings: Finding[] = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const lineText = lines[index]!;
    if (isAllowed(file, lineText, allowlist)) continue;
    for (const pattern of SECRET_PATTERNS) {
      for (const match of lineText.matchAll(pattern.regex)) {
        const secret = match[pattern.group];
        if (secret === undefined) continue;
        findings.push({ file, line: index + 1, pattern: pattern.name, masked: maskSecret(secret) });
      }
    }
  }
  return findings;
}

/** Files that are binary by extension; they are not scanned. */
const BINARY_EXTENSION = /\.(?:png|jpe?g|gif|webp|bmp|ico|woff2?|ttf|otf|pdf|zip|gz)$/i;

export function isScannable(file: string, text: string | null): text is string {
  return text !== null && !BINARY_EXTENSION.test(file) && !text.includes('\0');
}

export function formatFinding(finding: Finding): string {
  return `${finding.file}:${finding.line} ${finding.pattern} ${finding.masked}`;
}
