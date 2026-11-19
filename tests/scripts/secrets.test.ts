import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  formatFinding,
  isScannable,
  maskSecret,
  scanText,
} from '../../scripts/checks/secrets.ts';
import type { AllowEntry } from '../../scripts/checks/secrets.ts';

const SEED = 20240611;
const NUM_RUNS = 200;

const chars = (alphabet: string, min: number, max: number) =>
  fc
    .array(fc.constantFrom(...alphabet.split('')), { minLength: min, maxLength: max })
    .map((list) => list.join(''));

const UPPER_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ALNUM = `${UPPER_DIGITS}abcdefghijklmnopqrstuvwxyz0123456789`;

/** Planted secrets by format. Each has the detector pattern name it must be reported under. */
const planted: Array<{ pattern: string; secret: fc.Arbitrary<string> }> = [
  { pattern: 'aws-access-key', secret: fc.tuple(fc.constantFrom('AKIA', 'ASIA'), chars(UPPER_DIGITS, 16, 16)).map(([a, b]) => a + b) },
  { pattern: 'github-token', secret: fc.tuple(fc.constantFrom('ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_'), chars(ALNUM, 36, 50)).map(([a, b]) => a + b) },
  { pattern: 'github-fine-grained-token', secret: chars(`${ALNUM}_`, 22, 60).map((body) => `github_pat_${body}`) },
  { pattern: 'sk-style-key', secret: chars(`${ALNUM}_-`, 20, 60).map((body) => `sk-${body}`) },
  {
    pattern: 'private-key-header',
    secret: fc.constantFrom('', 'RSA ', 'EC ', 'OPENSSH ', 'DSA ').map((kind) => `-----BEGIN ${kind}PRIVATE KEY-----`),
  },
];

const genericName = fc.constantFrom('api_key', 'api-key', 'apikey', 'API_KEY', 'secret', 'client_secret', 'token', 'access_token');
const genericSeparator = fc.constantFrom(' = ', ': ', '=', ': "', ' = \'');
const genericValue = chars(`${ALNUM}_-+/=`, 20, 60);

/** Text lines before and after the planted line; the planted text sits inside its line. */
const linesArb = fc.array(fc.string({ maxLength: 40 }), { maxLength: 6 });

describe('secret scan', () => {
  for (const { pattern, secret } of planted) {
    it(`R23.1 a planted ${pattern} at a random position is flagged at its line and masked`, () => {
      fc.assert(
        fc.property(linesArb, linesArb, fc.string({ maxLength: 20 }), fc.string({ maxLength: 20 }), secret, (before, after, left, right, key) => {
          const text = [...before, `${left} ${key} ${right}`, ...after].join('\n');
          const findings = scanText('file.txt', text, []);
          const hit = findings.find((finding) => finding.pattern === pattern && finding.line === before.length + 1);
          expect(hit).toBeDefined();
          expect(hit!.masked.includes(key)).toBe(false);
          expect(formatFinding(hit!).includes(key)).toBe(false);
        }),
        { seed: SEED, numRuns: NUM_RUNS },
      );
    });
  }

  it('R23.1 a planted generic key assignment is flagged at its line and its value is masked', () => {
    fc.assert(
      fc.property(linesArb, linesArb, genericName, genericSeparator, genericValue, (before, after, name, separator, value) => {
        const text = [...before, `const ${name}${separator}${value}`, ...after].join('\n');
        const findings = scanText('file.ts', text, []);
        const hit = findings.find((finding) => finding.pattern === 'generic-assignment' && finding.line === before.length + 1);
        expect(hit).toBeDefined();
        expect(formatFinding(hit!).includes(value)).toBe(false);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R23.1 clean generated text with none of the detected patterns gives no findings', () => {
    fc.assert(
      fc.property(chars('abcdefghijklmnopqrstuvwxyz0123456789 \n.,', 0, 400), (text) => {
        expect(scanText('clean.txt', text, [])).toEqual([]);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R23.1 masking keeps at most the first four characters of a secret', () => {
    fc.assert(
      fc.property(chars(ALNUM, 20, 80), (value) => {
        const masked = maskSecret(value);
        expect(masked.startsWith(value.slice(0, 4))).toBe(true);
        expect(masked.includes(value.slice(0, 8))).toBe(false);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('flags one example of each format with file and line', () => {
    const text = ['ok', `key ${'AKIA' + 'ABCDEFGHIJKLMNOP'}`, `x ${'ghp_' + 'a'.repeat(36)}`].join('\n');
    const findings = scanText('a.md', text, []);
    expect(findings.map((finding) => [finding.file, finding.line, finding.pattern])).toEqual([
      ['a.md', 2, 'aws-access-key'],
      ['a.md', 3, 'github-token'],
    ]);
  });

  it('does not flag short values, plain words like "task-list" or non-secret assignments', () => {
    const text = ['token: abc', 'a task-aaaaaaaaaaaaaaaaaaaaaaaa', 'secret = process.env.NAME', 'tokens: ["a", "b"]'].join('\n');
    expect(scanText('a.ts', text, [])).toEqual([]);
  });

  it('does not flag allowlisted text and flags the same text elsewhere', () => {
    const line = `const token = "${'a1'.repeat(15)}"`;
    const allowlist: AllowEntry[] = [{ file: 'tests/fake.ts', contains: 'const token', reason: 'a test fixture, not a real token' }];
    expect(scanText('tests/fake.ts', line, allowlist)).toEqual([]);
    expect(scanText('src/real.ts', line, allowlist)).toHaveLength(1);
  });

  it('skips binary files and unreadable files', () => {
    expect(isScannable('card.png', 'text')).toBe(false);
    expect(isScannable('a.ts', null)).toBe(false);
    expect(isScannable('a.ts', 'a\0b')).toBe(false);
    expect(isScannable('a.ts', 'text')).toBe(true);
  });
});
