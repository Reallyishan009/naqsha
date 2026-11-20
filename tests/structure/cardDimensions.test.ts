/**
 * Check B of the weave review, as a test (docs/WEAVE_REVIEW.md).
 *
 * `.kiro/steering/card-geometry.md` rule 4 says the card layout is a profile loaded at runtime
 * and is never hard-coded; the demo profile's values are ILLUSTRATIVE and UNVERIFIED, so a copy
 * of one in the code is wrong even while it happens to agree. The review found seven such
 * copies. This check reads `public/profiles/demo-12x16.json`, works out the numbers it gives,
 * and reports every numeric literal in `src` and `scripts` that holds one of them as card
 * geometry.
 *
 * **Three tiers, because the same digits mean different things.**
 * - Always reported: a value only a card produces (ends per pick, the card in pixels at the
 *   print resolution) and the profile's fractional millimetre values (7.5, 22.5, 2.5).
 * - Reported where the line names card geometry: the profile's whole-number values of 10 and
 *   above (12, 15, 16, 36, 43, 45, 57, 60), which are everyday numbers elsewhere.
 * - Reported beside its partner: the two numbers of the demo card written on one line
 *   (`720, 540`, `60 / 45`, `12x16`, `192` and `36`), whatever else the line says.
 *
 * **What it cannot find.**
 * 1. A value written in another form: `6 * 32`, `0x2d`, `1_2`, `Math.round(59.9)`, `48 + 12`.
 *    The digits must be the literal.
 * 2. A value inside a string literal. The two low-weight category B findings were the text
 *    "60 mm by 45 mm" in a manual instruction, and this check cannot see them; the test below
 *    pins that gap instead of hiding it.
 * 3. A one-digit profile value (2 mm hole diameter, 3 mm pitch, 6 mm first hole centre y)
 *    unless it is written with a decimal point. `/ 2` and `* 3` are divisors and multipliers
 *    far more often than card dimensions, and flagging every one of them would need an
 *    allowlist longer than the check.
 * 4. A whole-number value of 10 and above on a line that names nothing about a card, and whose
 *    partner is elsewhere: `const expected = 45;` alone is not reported.
 * 5. `tests/`. The scan covers `src` and `scripts`, so the demo-profile pins in test titles
 *    (tests/ui/printable/raster.test.ts, svg.test.ts, scripts/bmpHeader.test.ts), which the
 *    review classified acceptable, are outside it by construction and need no allowance.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PIXELS_PER_MM } from '../../src/ui/printable/raster.ts';
import { scanNumbers, type NumberFinding } from '../support/termScan.ts';
import { demoProfile } from '../support/profiles.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SCANNED = ['src', 'scripts'];
const profile = demoProfile();

/** Every card-geometry number of the demo profile, with what it is. */
const NUMBERS: readonly { value: number; meaning: string }[] = [
  { value: profile.cardWidthMm, meaning: 'cardWidthMm' },
  { value: profile.cardHeightMm, meaning: 'cardHeightMm' },
  { value: profile.hookRows, meaning: 'hookRows' },
  { value: profile.hookColumns, meaning: 'hookColumns' },
  { value: profile.hookRows * profile.hookColumns, meaning: 'ends per pick (hookRows * hookColumns)' },
  { value: 3 * profile.hookRows, meaning: 'the pick count of the demo Sample_Designs (3 * hookRows)' },
  { value: Math.round(profile.cardWidthMm * DEFAULT_PIXELS_PER_MM), meaning: 'the card width in pixels at DEFAULT_PIXELS_PER_MM' },
  { value: Math.round(profile.cardHeightMm * DEFAULT_PIXELS_PER_MM), meaning: 'the card height in pixels at DEFAULT_PIXELS_PER_MM' },
  { value: profile.holeDiameterMm, meaning: 'holeDiameterMm' },
  { value: profile.horizontalPitchMm, meaning: 'horizontalPitchMm' },
  { value: profile.verticalPitchMm, meaning: 'verticalPitchMm' },
  { value: profile.firstHoleCentreMm.x, meaning: 'firstHoleCentreMm.x' },
  { value: profile.firstHoleCentreMm.y, meaning: 'firstHoleCentreMm.y' },
  ...profile.pegHoles.flatMap((peg, index) => [
    { value: peg.positionMm.x, meaning: `pegHoles[${index}].positionMm.x` },
    { value: peg.positionMm.y, meaning: `pegHoles[${index}].positionMm.y` },
    { value: peg.diameterMm, meaning: `pegHoles[${index}].diameterMm` },
  ]),
  { value: profile.lacingHoles.diameterMm, meaning: 'lacingHoles.diameterMm' },
  ...profile.lacingHoles.positionsMm.flatMap((position, index) => [
    { value: position.x, meaning: `lacingHoles.positionsMm[${index}].x` },
    { value: position.y, meaning: `lacingHoles.positionsMm[${index}].y` },
  ]),
];

const VALUES = [...new Set(NUMBERS.map(({ value }) => value))];
const ALWAYS = VALUES.filter(
  (value) =>
    !Number.isInteger(value) ||
    value === profile.hookRows * profile.hookColumns ||
    value === Math.round(profile.cardWidthMm * DEFAULT_PIXELS_PER_MM) ||
    value === Math.round(profile.cardHeightMm * DEFAULT_PIXELS_PER_MM),
);
const IN_CONTEXT = VALUES.filter((value) => Number.isInteger(value) && value >= 10 && !ALWAYS.includes(value));
/** The two numbers of the demo card, which name it together even where the line says nothing. */
const PAIRS: readonly (readonly [number, number])[] = [
  [profile.cardWidthMm, profile.cardHeightMm],
  [profile.hookRows, profile.hookColumns],
  [Math.round(profile.cardWidthMm * DEFAULT_PIXELS_PER_MM), Math.round(profile.cardHeightMm * DEFAULT_PIXELS_PER_MM)],
  [profile.hookRows * profile.hookColumns, 3 * profile.hookRows],
];
/** Names that say the line is about a card: the profile's own field names, and the two scales. */
const GEOMETRY =
  /card(Width|Height)|hook(Rows|Columns|Row|Column)|holeDiameter|(horizontal|vertical)Pitch|firstHoleCentre|pegHole|lacingHole|endOrder|pixelsPerMm|PIXELS_PER_MM|[Mm]m\b|12x16|profile|card\b/i;

/**
 * One line that may hold a card number. `line` is matched against the code of that line with
 * strings and comments blanked, so an allowance holds for that one line and nothing else: move
 * the value to another line, or write a second copy, and the check reports it.
 */
type Allowance = { file: string; line: string; values: readonly number[]; reason: string };

const ALLOWED: readonly Allowance[] = [
  {
    file: 'src/ui/printable/raster.ts',
    line: 'export const DEFAULT_PIXELS_PER_MM = 12',
    values: [12],
    reason:
      'the rendering resolution of the printable card in pixels per millimetre, about 305 dpi, which the file states in the comment above it. It is a resolution, not a card dimension: the card in pixels is this times cardWidthMm. It equals hookRows of the demo profile by coincidence.',
  },
  {
    file: 'scripts/check_browser.ts',
    line: 'if (widthPx !== 720 || heightPx !== 540) problems.push(',
    values: [720, 540],
    reason:
      'the deliberate demo-profile pin of step 9, which the review classified acceptable and task 8.2 part 1 kept: it asserts that the demo profile still gives a 720x540 print at DEFAULT_PIXELS_PER_MM, and it is meant to fail if the profile file changes. The lines above it compute widthPx and heightPx from the profile, and the downloaded image is compared with those, not with these numbers.',
  },
  {
    file: 'scripts/make_icons.ts',
    line: 'export const ICON_SIZES = [192, 512] as const',
    values: [192],
    reason:
      'the two app icon sizes in pixels that the web manifest asks for (R24.6). 192 is an icon edge in pixels and equals the demo profile ends per pick by coincidence; the 512 beside it shows the list is about icons.',
  },
];

type Finding = NumberFinding & { file: string; tier: 'always' | 'decimal' | 'context' | 'pair' };

function sourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir).sort()) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name)) found.push(full);
    }
  };
  for (const dir of SCANNED) walk(path.join(ROOT, dir));
  return found;
}

/** The tier a literal falls in, or null when it is not reported. */
function tierOf(finding: NumberFinding): Finding['tier'] | null {
  if (ALWAYS.includes(finding.value)) return 'always';
  if (finding.literal.includes('.') && VALUES.includes(finding.value)) return 'decimal';
  const partnered = PAIRS.some(
    ([first, second]) =>
      (finding.value === first || finding.value === second) &&
      new RegExp(`(?<![\\w$.])${first}(?![\\w$.])`).test(finding.lineText) &&
      new RegExp(`(?<![\\w$.])${second}(?![\\w$.])`).test(finding.lineText),
  );
  if (partnered) return 'pair';
  if (IN_CONTEXT.includes(finding.value) && GEOMETRY.test(finding.lineText)) return 'context';
  return null;
}

function findingsIn(file: string, text: string): Finding[] {
  const found: Finding[] = [];
  for (const finding of scanNumbers(text, VALUES)) {
    const tier = tierOf(finding);
    if (tier !== null) found.push({ ...finding, file, tier });
  }
  return found;
}

function covered(finding: Finding): boolean {
  return ALLOWED.some(
    (allowance) => allowance.file === finding.file && allowance.values.includes(finding.value) && finding.lineText.includes(allowance.line),
  );
}

function report(finding: Finding): string {
  const meanings = NUMBERS.filter(({ value }) => value === finding.value)
    .map(({ meaning }) => meaning)
    .join(', ');
  return `${finding.file}:${finding.line} literal ${finding.literal} (${finding.tier}) is ${meanings} of the demo profile\n    ${finding.lineText.trim()}`;
}

const all = sourceFiles().flatMap((file) => findingsIn(path.relative(ROOT, file).split(path.sep).join('/'), readFileSync(file, 'utf8')));
const unexplained = all.filter((finding) => !covered(finding));

describe('card geometry numbers in src and scripts', () => {
  it('the profile gives the numbers the scan looks for, so an empty number set cannot pass', () => {
    expect(VALUES.length).toBeGreaterThan(10);
    expect(ALWAYS).toContain(profile.hookRows * profile.hookColumns);
    expect(ALWAYS).toContain(profile.firstHoleCentreMm.x);
    expect(IN_CONTEXT).toEqual(expect.arrayContaining([profile.cardWidthMm, profile.cardHeightMm, profile.hookRows, profile.hookColumns]));
    expect(sourceFiles().length).toBeGreaterThan(50);
  });

  it('R14.2, R10.4, R12.5 and R21.3 no card geometry number of the demo profile is hard-coded in src or scripts', () => {
    expect(unexplained, `${unexplained.length} hard-coded card number(s):\n${unexplained.map(report).join('\n')}`).toEqual([]);
  });

  it('R14.2 every allowance covers a line that exists, and states a reason', () => {
    for (const allowance of ALLOWED) {
      const hit = all.filter((finding) => covered(finding) && finding.file === allowance.file && finding.lineText.includes(allowance.line));
      expect(hit.length, `allowance covers nothing: ${allowance.file} ${allowance.line}`).toBeGreaterThan(0);
      expect(allowance.reason.split(/\s+/).length).toBeGreaterThan(8);
    }
  });

  // The seven category B findings of docs/WEAVE_REVIEW.md as they were written before part 1.
  const CATEGORY_B: readonly { file: string; text: string; findable: boolean }[] = [
    { file: 'scripts/check_browser.ts', text: 'const widthPx = Math.round(profile.cardWidthMm * 12);', findable: true },
    { file: 'scripts/check_browser.ts', text: 'const heightPx = Math.round(profile.cardHeightMm * 12);', findable: true },
    { file: 'scripts/check_browser.ts', text: 'if (info.width !== 720 || info.height !== 540) problems.push(message);', findable: true },
    { file: 'scripts/check_browser.ts', text: 'encodePngRgba(720, 540, new Uint8Array(720 * 540 * 4).fill(255))', findable: true },
    { file: 'tests/ui/screens/liveCamera.test.tsx', text: 'expect(style).toEqual({ aspectRatio: 60 / 45 });', findable: true },
    // Both low-weight findings were instruction text inside a string literal, which the scan
    // does not read (limit 2 in the header).
    { file: 'scripts/checks/manualSteps.ts', text: "'4. Expect 60 mm by 45 mm. Allow a ruler reading error of about 1 mm.',", findable: false },
    { file: 'scripts/checks/manualSteps.ts', text: "expected: 'The printed card measures 60 mm x 45 mm.',", findable: false },
  ];

  it('R14.2 the check flags the five category B findings that are code', () => {
    for (const { file, text } of CATEGORY_B.filter((entry) => entry.findable)) {
      const found = findingsIn(file, text).filter((finding) => !covered(finding));
      expect(found.map((finding) => finding.literal), `not flagged: ${file} ${text}`).not.toEqual([]);
    }
  });

  it('R14.2 the two category B findings in instruction text are not reported, because strings are not read', () => {
    for (const { file, text } of CATEGORY_B.filter((entry) => !entry.findable)) {
      expect(findingsIn(file, text).map(report), `unexpectedly flagged: ${text}`).toEqual([]);
    }
    // The same numbers outside the quotes are reported, so it is the quoting that hides them.
    expect(findingsIn('scripts/checks/manualSteps.ts', 'const size = [60, 45];').map((finding) => finding.tier)).toEqual(['pair', 'pair']);
  });

  it('R14.2 code that takes every number from the profile is not reported', () => {
    const clean = [
      'const widthPx = Math.round(profile.cardWidthMm * DEFAULT_PIXELS_PER_MM);',
      'const ends = profile.hookRows * profile.hookColumns;',
      'const radiusMm = profile.holeDiameterMm / 2;',
      'const centre = { x: profile.firstHoleCentreMm.x, y: profile.firstHoleCentreMm.y };',
      'const aspect = profile.cardWidthMm / profile.cardHeightMm;',
      'for (let pickIndex = 0; pickIndex < pattern.length; pickIndex++) lift(pickIndex);',
      'const budgetMs = 16;',
      'const touchTargetPx = 48;',
    ].join('\n');
    expect(findingsIn('src/ui/state/example.ts', clean).map(report)).toEqual([]);
  });

  it('R14.2 a value in another form is not found, and the check says so', () => {
    expect(findingsIn('src/ui/state/example.ts', 'const widthPx = 6 * 120;').map(report)).toEqual([]);
    expect(findingsIn('src/ui/state/example.ts', 'const ends = 0xc0;').map(report)).toEqual([]);
    expect(findingsIn('src/ui/state/example.ts', 'const ends = 192;').map((finding) => finding.tier)).toEqual(['always']);
  });

  const geometryLine = fc.constantFrom(
    'const widthPx = Math.round(profile.cardWidthMm * VALUE);',
    'const heightMm = VALUE; // cardHeightMm',
    'const pitch = VALUE * profile.horizontalPitchMm;',
    'const pegHoleX = VALUE;',
  );
  const plainLine = fc.constantFrom(
    'const total = pattern.length;',
    'const label = t("weave.play");',
    'const budget = 16;',
    'return { ok: true };',
  );

  it('R14.2 a planted card number is reported wherever it sits, on a line about a card', () => {
    // **Validates: Requirements 14.2**
    fc.assert(
      fc.property(fc.array(plainLine, { maxLength: 12 }), fc.constantFrom(...VALUES), geometryLine, fc.nat(), (lines, value, shape, offset) => {
        const at = lines.length === 0 ? 0 : offset % (lines.length + 1);
        const planted = shape.replace('VALUE', value === Math.trunc(value) && value < 10 ? `${value}.0` : `${value}`);
        const text = [...lines.slice(0, at), planted, ...lines.slice(at)].join('\n');
        const found = findingsIn('src/ui/state/planted.ts', text).filter((finding) => !covered(finding));
        expect(found.map((finding) => finding.value)).toContain(value);
        expect(found.map((finding) => finding.line)).toContain(at + 1);
      }),
      { seed: 80215, numRuns: 200 },
    );
  });

  it('R14.2 the two numbers of the demo card on one line are reported whatever the line says', () => {
    // **Validates: Requirements 14.2**
    fc.assert(
      fc.property(fc.constantFrom(...PAIRS), fc.constantFrom('f(A, B)', 'const x = A / B;', '[A, B]', 'resize(A, B, 4)'), (pair, shape) => {
        const text = shape.replace('A', `${pair[0]}`).replace('B', `${pair[1]}`);
        const found = findingsIn('src/ui/state/planted.ts', text).filter((finding) => !covered(finding));
        expect(found.map((finding) => finding.value).sort()).toEqual([...pair].sort());
      }),
      { seed: 80216, numRuns: 100 },
    );
  });

  it('R14.2 code that derives its numbers from the profile is never reported', () => {
    // **Validates: Requirements 14.2**
    fc.assert(
      fc.property(fc.array(plainLine, { minLength: 1, maxLength: 20 }), fc.constantFrom('src/codec/x.ts', 'src/ui/printable/x.ts', 'scripts/x.ts'), (lines, file) => {
        expect(findingsIn(file, lines.join('\n')).map(report)).toEqual([]);
      }),
      { seed: 80217, numRuns: 200 },
    );
  });

  it('R14.2 no allowance hides the same number on another line or in another file', () => {
    // **Validates: Requirements 14.2**
    fc.assert(
      fc.property(
        fc.constantFrom(...ALLOWED),
        fc.constantFrom('const cardWidthPx = VALUE;', 'if (profile.cardWidthMm !== VALUE) fail();', 'resize(VALUE, profile.cardHeightMm);'),
        (allowance, shape) => {
          for (const value of allowance.values) {
            const planted = shape.replace('VALUE', `${value}`);
            // The line is about a card, so the value is reported...
            expect(findingsIn(allowance.file, planted).map((finding) => finding.value)).toContain(value);
            // ...and being in the allowed file does not take it away, because the line differs.
            expect(
              findingsIn(allowance.file, planted)
                .filter((finding) => !covered(finding))
                .map((finding) => finding.value),
            ).toContain(value);
            // The allowed line copied into another file is reported too.
            const elsewhere = findingsIn('src/ui/state/planted.ts', `${allowance.line};`);
            expect(elsewhere.filter((finding) => !covered(finding)).length).toBeGreaterThan(0);
          }
        },
      ),
      { seed: 80218, numRuns: 100 },
    );
  });
});
