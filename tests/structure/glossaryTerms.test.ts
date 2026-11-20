/**
 * Check A of the weave review, as a test (docs/WEAVE_REVIEW.md).
 *
 * `.kiro/steering/weaving-glossary.md` says every identifier and comment that refers to a
 * glossary concept must use the glossary term. The review found seven places where a synonym
 * named a punched hole value. This check scans the identifiers and the comments of `src` and
 * `scripts` for the review's word list and reports every use that no allowance below covers.
 *
 * **What it cannot find.**
 * 1. A synonym outside `WORDS`. "line", "grid", "square", "slot", "box", "dot" and any other
 *    word not listed is invisible to it, so a new synonym can still enter the code.
 * 2. A word unit it cannot see: `rowwise`, `holey` or `celled` do not match, because a word
 *    must be a whole word unit of an identifier or a whole word of a comment (a trailing "s"
 *    is the only inflection allowed).
 * 3. String literals. User-facing text, CSS class strings and message text are not scanned,
 *    so `t('scan.hole')` and a Hindi or English sentence are never reported.
 * 4. `tests/`. The check scans `src` and `scripts` only, so the four category A findings that
 *    were in test files (`tests/ui/printable/download.test.ts`,
 *    `tests/ui/screens/scan.test.tsx`) would not be seen by the repository scan if they came
 *    back. The unit tests below plant the exact text of all seven findings, so the detector is
 *    proved against every one of them; only the repository scan is narrower.
 * 5. What an allowance covers. Each allowance says which words and which files it covers, so a
 *    real misuse of that word in one of those files is hidden. Every allowance states the
 *    reason, and the last test fails if an allowance covers nothing, so a stale one cannot sit
 *    here unnoticed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { scanTerms, splitWords, type TermFinding } from '../support/termScan.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SCANNED = ['src', 'scripts'];

/** The review's category A word list, with the glossary term each one displaces. */
const WORDS: readonly { word: string; instead: string }[] = [
  { word: 'row', instead: 'pick (one row of the weave matrix) or hook row' },
  { word: 'column', instead: 'end (one warp thread) or hook column' },
  { word: 'col', instead: 'end or hook column' },
  { word: 'thread', instead: 'warp or weft' },
  { word: 'hole', instead: 'punched hole, peg hole or lacing hole' },
  { word: 'cell', instead: 'punched hole, end or hook position' },
  { word: 'overlap', instead: 'float' },
  { word: 'horizontal', instead: 'weft direction (across the warp)' },
  { word: 'vertical', instead: 'warp direction (along the cloth)' },
];

const WORD_LIST = WORDS.map(({ word }) => word);

/**
 * One acceptable class of use. A finding is accepted when its word is in `words`, its file is in
 * `files` (when `files` is given), and either `terms` matches the words around it or `tokens`
 * holds its identifier. With neither `terms` nor `tokens`, the whole class is the word in those
 * files. `files` entries are exact relative paths, except the three that end in `/`, which are
 * whole directories; a new file therefore inherits no allowance.
 */
type Allowance = {
  words: readonly string[];
  terms?: readonly (readonly string[])[];
  tokens?: readonly string[];
  files?: readonly string[];
  reason: string;
};

const ALLOWED: readonly Allowance[] = [
  {
    words: ['row', 'column'],
    terms: [
      ['hook', 'row'],
      ['hook', 'column'],
      ['hook', 'row', 'and', 'column'],
    ],
    reason:
      'the glossary term itself: a hook row and a hook column of one card, named as card-geometry.md and the profile name them (hookRows, hookColumns, endOrder[hookRow][hookColumn]).',
  },
  {
    words: ['hole'],
    terms: [
      ['punched', 'hole'],
      ['peg', 'hole'],
      ['lacing', 'hole'],
      ['hole', 'diameter'],
      ['first', 'hole', 'centre'],
      ['hole', 'grid'],
      ['hole', 'position'],
    ],
    reason:
      'the glossary term itself (punched hole, peg hole, lacing hole), a profile field name from card-geometry.md (holeDiameterMm, firstHoleCentreMm), or the wording of card-geometry.md rule 1 ("the hole grid on a card", "every hole position is an end").',
  },
  {
    words: ['horizontal', 'vertical'],
    terms: [
      ['horizontal', 'pitch'],
      ['vertical', 'pitch'],
    ],
    reason: 'a profile field name from card-geometry.md: horizontalPitchMm and verticalPitchMm, a direction on the card, not a direction in the cloth.',
  },
  {
    words: ['thread'],
    terms: [
      ['warp', 'thread'],
      ['weft', 'thread'],
      ['thread', 'size'],
      ['thread', 'colour'],
    ],
    reason:
      'the glossary defines warp and weft as threads, so "warp thread" and "weft thread" are glossary terms; "thread size" and "thread colour" are the warp and the weft together, which the glossary has no single word for (docs/WEAVE_REVIEW.md, Notes on A).',
  },
  {
    words: ['row'],
    terms: [['pick', 'row']],
    reason: 'PickRow (src/simulator/types.ts): the glossary defines a pick as one row of the weave matrix, so the pick is what the row is.',
  },
  {
    words: ['row', 'column'],
    terms: [
      ['pixel', 'row'],
      ['pixel', 'column'],
      ['image', 'row'],
      ['row', 'major'],
      ['table', 'row'],
      ['list', 'row'],
    ],
    reason:
      'a row or column of an image, of an array layout, of a markdown table or of the saved-design list: one pixel row is not one pick (a pick is t pixel rows tall in the simulator), and "row-major" is the standard name for an array order.',
  },
  {
    words: ['row', 'column', 'col'],
    tokens: ['row', 'rows', 'column', 'columns', 'col', 'rowLocation', 'endOrderRow', 'centresInRow'],
    files: [
      'src/codec/endsCodec.ts',
      'src/codec/validateCardGrid.ts',
      'src/codec/validateCardProfile.ts',
      'src/reader/sampling.ts',
      'src/ui/state/corrections.ts',
      'src/ui/state/scan.ts',
      'scripts/check_browser.ts',
      'scripts/time_read_card.ts',
    ],
    reason:
      'a hook row or hook column of one card grid, written short inside a loop over that grid (`for (let row = 0; row < hookRows; row++)`), which the review accepted as the short form of hookRow and hookColumn (docs/WEAVE_REVIEW.md check A).',
  },
  {
    words: ['row'],
    tokens: ['row', 'rows', 'summaryRow', 'SummaryRow', 'styles.row'],
    files: [
      'src/ui/screens/keep/KeepScreen.tsx',
      'src/ui/screens/scan/BatchList.tsx',
      'src/ui/screens/scan/LiveCamera.tsx',
      'src/ui/screens/scan/ScanScreen.tsx',
      'src/ui/screens/weave/TryIt.tsx',
      'src/ui/screens/weave/WeaveScreen.tsx',
      'src/ui/state/keep.ts',
    ],
    reason:
      'one row of the saved-design list (summaryRow in src/ui/state/keep.ts), or the `.row` CSS class, which is `display: flex` in ScanScreen.module.css and KeepScreen.module.css. No weave matrix is held in a screen component; the cloth is drawn by src/simulator.',
  },
  {
    words: ['row'],
    files: ['src/exporter/', 'scripts/png_rgba.ts', 'scripts/checks/bmpHeader.ts'],
    reason:
      'a stored pixel row of the BMP or PNG byte layout. The format defines rows (padded to 4 bytes in BMP), `rowStride` is a field of BmpLayout, and the exporter states the mapping in src/exporter/exportBmp.ts: one pixel per end and one row per pick.',
  },
  {
    words: ['row', 'column'],
    tokens: [
      'rowStart',
      'rowIndex',
      'lastRowIndex',
      'withinRow',
      'centreRow',
      'drawWarpRow',
      'warpByColumn',
      'raisedByColumn',
      'columns',
      'ZARI_HIGHLIGHT_COLUMN_STEP',
    ],
    files: ['src/simulator/'],
    reason:
      'a pixel row or pixel column of the rendered image: in src/simulator/render.ts one end is `t` pixels wide and one pick is `t` pixel rows tall, so these index pixels, not picks or ends.',
  },
  {
    words: ['hole'],
    files: [
      'src/codec/validateCardProfile.ts',
      'src/reader/layout.ts',
      'src/ui/printable/raster.ts',
      'src/ui/printable/style.ts',
      'src/ui/printable/svg.ts',
      'src/ui/screens/scan/BatchList.tsx',
      'src/ui/theme/contrast.ts',
      'scripts/make_fixtures.ts',
    ],
    reason:
      'the punched holes, the peg holes and the lacing holes together, which the glossary has no word for (docs/WEAVE_REVIEW.md, Notes on A). These eight files treat the three kinds alike: the overlap rule (violation kind `holes-overlap`), the layout check of the predicted fixed holes, the fixture renderer, and the printable card and its thumbnail, which fill all three with one ink whose colour token is named `--hole`. The word is given up in these files; a punched hole value called `hole` elsewhere, as in the category A findings, is still reported.',
  },
  {
    words: ['overlap'],
    files: ['src/codec/types.ts', 'src/codec/validateCardProfile.ts'],
    reason:
      'two hole discs overlapping on the surface of the card (violation kind `holes-overlap`, R2.7), which is geometry of the card and not a float of the cloth.',
  },
  {
    words: ['horizontal', 'vertical'],
    files: ['src/codec/validateCardProfile.ts'],
    reason:
      'the horizontal and vertical neighbours of a position in the hook grid, the same two directions on the card that horizontalPitchMm and verticalPitchMm name; neither is a warp or weft direction.',
  },
  {
    words: ['cell'],
    files: ['src/ui/i18n/reviewList.ts'],
    reason: 'a cell of the markdown table written into docs/HINDI_REVIEW.md; `cell()` escapes a pipe and a newline so the table row stays whole.',
  },
  {
    words: ['cell'],
    files: ['src/ui/samples/sampleDesigns.ts'],
    reason:
      'a motif tile of the naksha. The re-check (docs/WEAVE_REVIEW.md, task 8.2 part 1) reclassified these: the floral tile is two repeats wide, so it is not a repeat, the glossary has no term for it, and the last rule of the glossary allows a precise plain word.',
  },
];

type Finding = TermFinding & { file: string };

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

/** True when the word unit at `at` and its neighbours spell out `term`. */
function termMatches(words: readonly string[], at: number, word: string, term: readonly string[]): boolean {
  const offset = term.indexOf(word);
  if (offset === -1) return false;
  return term.every((part, i) => {
    const unit = words[at - offset + i];
    return unit !== undefined && (unit === part || (unit.endsWith('s') && unit.slice(0, -1) === part));
  });
}

function covers(allowance: Allowance, finding: Finding): boolean {
  if (!allowance.words.includes(finding.word)) return false;
  if (allowance.files !== undefined) {
    const inFiles = allowance.files.some((entry) => (entry.endsWith('/') ? finding.file.startsWith(entry) : finding.file === entry));
    if (!inFiles) return false;
  }
  if (allowance.terms !== undefined && allowance.terms.some((term) => termMatches(finding.words, finding.at, finding.word, term))) return true;
  if (allowance.tokens !== undefined && finding.kind === 'identifier' && (allowance.tokens.includes(finding.token) || allowance.tokens.includes(finding.path)))
    return true;
  return allowance.terms === undefined && allowance.tokens === undefined;
}

/** Every use of a word in WORDS in the scanned text, with the file it is in. */
function scanRepository(): Finding[] {
  const all: Finding[] = [];
  for (const file of sourceFiles()) {
    const relative = path.relative(ROOT, file).split(path.sep).join('/');
    for (const finding of scanTerms(readFileSync(file, 'utf8'), WORD_LIST)) all.push({ ...finding, file: relative });
  }
  return all;
}

function report(finding: Finding): string {
  const instead = WORDS.find(({ word }) => word === finding.word)!.instead;
  return `${finding.file}:${finding.line} "${finding.token}" (${finding.kind}) uses "${finding.word}" where the glossary has ${instead}\n    ${finding.context}`;
}

const all = scanRepository();
const unexplained = all.filter((finding) => !ALLOWED.some((allowance) => covers(allowance, finding)));

describe('glossary terms in src and scripts', () => {
  it('the scan reads the source and finds the words, so a silent empty scan cannot pass', () => {
    expect(sourceFiles().length).toBeGreaterThan(50);
    expect(all.length).toBeGreaterThan(100);
    expect(all.some((finding) => finding.kind === 'comment')).toBe(true);
    expect(all.some((finding) => finding.kind === 'identifier')).toBe(true);
  });

  it('R15.4, R10.2 and R12.3 the code and comments of src and scripts use the glossary term, not a synonym', () => {
    expect(unexplained, `${unexplained.length} use(s) of a non-glossary word:\n${unexplained.map(report).join('\n')}`).toEqual([]);
  });

  it('R15.4 every allowance covers something, so none can sit here stale', () => {
    const dead = ALLOWED.filter((allowance) => !all.some((finding) => covers(allowance, finding))).map((allowance) => allowance.reason);
    expect(dead, `allowance(s) that cover nothing:\n${dead.join('\n')}`).toEqual([]);
  });

  it('R15.4 every allowance states a reason', () => {
    for (const allowance of ALLOWED) expect(allowance.reason.split(/\s+/).length).toBeGreaterThan(8);
  });

  // The seven category A findings of docs/WEAVE_REVIEW.md, as they were written before part 1
  // fixed them: lines 162 and 164 of src/ui/state/scan.ts, one line of scripts/time_read_card.ts,
  // and four in test files, which the repository scan does not read. All are planted here with
  // the file they were in, so the detector is proved against every one of them.
  const CATEGORY_A: readonly { file: string; text: string; findable: boolean }[] = [
    {
      file: 'src/ui/state/scan.ts',
      text: ['for (const hole of row) {', '  total += 1;', '  if (hole) punched += 1;', '}'].join('\n'),
      findable: true,
    },
    { file: 'scripts/time_read_card.ts', text: 'const same = row.every((cell, c) => cell === card[r]![c]);', findable: true },
    { file: 'tests/ui/printable/download.test.ts', text: '// a cell that is not a boolean', findable: true },
    { file: 'tests/ui/printable/download.test.ts', text: 'const [row, column, cell] = change;', findable: true },
    { file: 'tests/ui/printable/download.test.ts', text: 'grid[row]![column] = cell;', findable: true },
    // The seventh was the wording of a test title, which is a string literal. This check does
    // not read string literals (limit 3 in the header), so it cannot find this one. The test
    // below pins that: it asserts the word is NOT reported, so the gap stays visible here.
    { file: 'tests/ui/screens/scan.test.tsx', text: "it('R10.6 toggling keeps the grid size and changes one cell', () => {});", findable: false },
  ];

  it('R15.4 the check flags the six category A findings that are code or comment text', () => {
    for (const { file, text, findable } of CATEGORY_A.filter((entry) => entry.findable)) {
      expect(findable).toBe(true);
      const findings = scanTerms(text, WORD_LIST)
        .map((finding) => ({ ...finding, file }))
        .filter((finding) => !ALLOWED.some((allowance) => covers(allowance, finding)));
      expect(findings.map((finding) => finding.word), `not flagged: ${file} ${text}`).not.toEqual([]);
      expect(findings.some((finding) => finding.word === 'hole' || finding.word === 'cell'), `the hole or cell use was not flagged: ${text}`).toBe(true);
    }
  });

  it('R15.4 the seventh category A finding sat in a string literal, which this check cannot read', () => {
    const { file, text } = CATEGORY_A.find((entry) => !entry.findable)!;
    const findings = scanTerms(text, WORD_LIST)
      .map((finding) => ({ ...finding, file }))
      .filter((finding) => !ALLOWED.some((allowance) => covers(allowance, finding)));
    expect(findings.map(report)).toEqual([]);
    // The same words outside the quotes are reported, so it is the quoting that hides them.
    expect(scanTerms('const cell = toggleOneCell(grid);', WORD_LIST).map((finding) => finding.word)).toContain('cell');
  });

  it('R15.4 glossary-conformant text is not flagged', () => {
    const clean = [
      'const punchedHole = grid[hookRow]![hookColumn];',
      '/** The punched holes of one pick, in end order. */',
      'const end = profile.endOrder[hookRow]![hookColumn];',
      'const lift = picks[pickIndex]!.lift;',
      'for (const pegHole of profile.pegHoles) checkLacingHoles(pegHole);',
      '// One pixel row per pick and one pixel per end.',
      'const warpThread = shadeTable(threadSizePx);',
    ].join('\n');
    const findings = scanTerms(clean, WORD_LIST)
      .map((finding) => ({ ...finding, file: 'src/codec/endsCodec.ts' }))
      .filter((finding) => !ALLOWED.some((allowance) => covers(allowance, finding)));
    expect(findings.map(report)).toEqual([]);
  });

  it('R15.4 a word unit, not a substring, is what matches', () => {
    expect(scanTerms('const rowwise = 1; const threshold = 2; const colour = 3;', WORD_LIST)).toEqual([]);
    expect(scanTerms('const rows = 1;', WORD_LIST).map((f) => f.word)).toEqual(['row']);
    expect(splitWords('HOLE_RGB')).toEqual(['hole', 'rgb']);
    expect(splitWords('hookRowIndex')).toEqual(['hook', 'row', 'index']);
  });

  it('R15.4 a string literal is not scanned and a comment is', () => {
    expect(scanTerms("const label = 'no horizontal scroll at 320 px';", WORD_LIST)).toEqual([]);
    expect(scanTerms('// no horizontal scroll\n', WORD_LIST).map((f) => f.word)).toEqual(['horizontal']);
  });

  // Property arbitraries: clean lines built from glossary terms only, and a planted synonym.
  const cleanLine = fc.constantFrom(
    'const punchedHole = grid[hookRow]![hookColumn];',
    'const end = profile.endOrder[hookRow]![hookColumn];',
    '/** The lift of one pick. */',
    'const lift = pick.lift.slice();',
    'const warp = weftPlan.length;',
    '// Every punched hole raises its hook.',
  );
  const plantedWord = fc.constantFrom(...WORD_LIST);
  const plantedShape = fc.constantFrom<(word: string) => string>(
    (word) => `const ${word} = value;`,
    (word) => `const first${word[0]!.toUpperCase()}${word.slice(1)} = value;`,
    (word) => `// the ${word} of the card`,
    (word) => `/* a ${word} per pick */`,
    (word) => `function readThe${word[0]!.toUpperCase()}${word.slice(1)}() {}`,
  );

  it('R15.4 a planted synonym is reported wherever it sits in the file', () => {
    // **Validates: Requirements 15.4**
    fc.assert(
      fc.property(fc.array(cleanLine, { maxLength: 12 }), plantedWord, plantedShape, fc.nat(), (lines, word, shape, offset) => {
        const at = lines.length === 0 ? 0 : offset % (lines.length + 1);
        const text = [...lines.slice(0, at), shape(word), ...lines.slice(at)].join('\n');
        const findings = scanTerms(text, WORD_LIST)
          .map((finding) => ({ ...finding, file: 'src/ui/state/planted.ts' }))
          .filter((finding) => !ALLOWED.some((allowance) => covers(allowance, finding)));
        expect(findings.map((finding) => finding.word)).toContain(word);
        expect(findings.map((finding) => finding.line)).toContain(at + 1);
      }),
      { seed: 80212, numRuns: 200 },
    );
  });

  it('R15.4 text built from glossary terms alone is never reported', () => {
    // **Validates: Requirements 15.4**
    fc.assert(
      fc.property(fc.array(cleanLine, { minLength: 1, maxLength: 20 }), fc.constantFrom('src/codec/endsCodec.ts', 'src/simulator/render.ts', 'scripts/make_fixtures.ts'), (lines, file) => {
        const findings = scanTerms(lines.join('\n'), WORD_LIST)
          .map((finding) => ({ ...finding, file }))
          .filter((finding) => !ALLOWED.some((allowance) => covers(allowance, finding)));
        expect(findings.map(report)).toEqual([]);
      }),
      { seed: 80213, numRuns: 200 },
    );
  });

  it('R15.4 no allowance hides a planted synonym in a file it does not name', () => {
    // **Validates: Requirements 15.4**
    const named = new Set(ALLOWED.flatMap((allowance) => allowance.files ?? []));
    fc.assert(
      fc.property(plantedWord, plantedShape, fc.constantFrom('src/ui/state/planted.ts', 'scripts/planted.ts', 'src/archive/planted.ts'), (word, shape, file) => {
        expect(named.has(file)).toBe(false);
        const findings = scanTerms(shape(word), WORD_LIST)
          .map((finding) => ({ ...finding, file }))
          .filter((finding) => !ALLOWED.some((allowance) => covers(allowance, finding)));
        expect(findings.map((finding) => finding.word)).toContain(word);
      }),
      { seed: 80214, numRuns: 200 },
    );
  });
});
