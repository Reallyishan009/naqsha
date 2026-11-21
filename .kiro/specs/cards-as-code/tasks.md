# Implementation Plan

## Overview

Code view is built in four phases, in this order:

1. **The pure module.** `src/codec-view`: types, Bit_Lines, the alignment, the Diff, `applyDiff`, the Diff_Text, each with its properties, and the boundary test early so the module cannot drift. Nothing in `src/ui` is touched.
2. **The shared Selected_Pick and the pure view logic.** `AppState.selectedPick` replaces the Weave_Screen's own pick value, `ClothChoices` moves into `AppState`, and `src/ui/state/codeView.ts` holds the Window, the breakpoints, the jump parse and the accessible names. **Existing Weave tests change in this phase** — see task 2.1.
3. **The Code_View_Screen.** The lazy fourth Screen, the listing, the controls, the cloth, the diff panel and the failure cases.
4. **Bundle, precache, browser checks and docs.**

Task 1.1 runs **before any code of this feature is written**, because it records the entry-chunk size the feature is measured against (R9.4). Once a line of Code view exists, that number is gone.

## How to read this plan

- **[demo-essential]** marks what the judges must see work: the bit-row listing, the step-through with breakpoints, the diff with its plain-text export, the pure module they rest on, and the demo-essential properties P1, P2, P3, P4, P5, P6, P7 and P10 (R12.5).
- **[cuttable]** marks what the demo survives without: the before-size capture (1.1), the boundary test (1.3), P8 (1.19), the focus-target helper (2.7), P9 (2.8), the reducer property (2.9), the R4.7 image property (3.9) and the listing timing test (3.10). Cutting one is reported to the user, never silent (R12.7, R12.11).
- "P*n*" is the numbered property in `design.md`. Each property task gives the test title, which starts with the criterion ID and then states the criterion in words (R12.2), and each runs through `fc.assert` with a `seed` written as a literal in the test file and `numRuns: 100` or more (R12.4, R12.9).
- No property takes a card dimension, an Ends_Per_Pick value or a punched-hole count as a numeric literal; every one comes from the generated Card_Profile (R12.3, `card-geometry.md`).
- Every task ends by running `npm run test:run` and `npm run typecheck`, and commits when both pass. If a property fails, report fast-check's shrunk counterexample with its `seed` and `path` and say whether the code or the property is wrong (R12.6); do not narrow an arbitrary, add a `filter`, lower `numRuns` or loosen a check (R12.7).
- Relative imports inside `src/codec-view` carry the `.ts` extension, so Node runs the module without a build step (`tech.md`).
- Identifiers and comments use the glossary terms: pick, end, card, hook, punched hole, naksha (R8.7).
- The bundle check is `npm run check-bundle` (`scripts/check_bundle.ts`); the requirements call it `check:bundle`. Same check.

## Tasks

- [x] 1. The pure module `src/codec-view`
  - _Requirements: R1.1, R1.2, R1.3, R1.4, R1.5, R1.6, R1.7, R1.8, R1.9, R1.10, R5.1, R5.2, R5.3, R5.4, R5.5, R5.6, R5.7, R5.8, R5.9, R5.10, R6.1, R6.2, R6.3, R6.4, R6.5, R6.9, R6.10, R6.11, R6.14, R6.15, R8.1, R8.2, R8.3, R8.4, R8.5, R8.6, R8.7, R8.8, R8.9, R8.11, R8.12_

  - [x] 1.1 Record the entry-chunk size before this feature
    - **[cuttable]** — but it must run **first**, before any file of this feature is written.
    - Files: `docs/BUILD_LOG.md`.
    - Run `npm run build`, then `npm run check-bundle` on the current build. Record in a new `docs/BUILD_LOG.md` entry, as the "before" row, the entry chunk file name and its gzipped byte count exactly as the check prints it, with the 204,800-byte limit beside it. Say that the "after" rows are filled in by task 4.4.
    - Do not write, edit or stub any file of this feature in this task.
    - _Requirements: R9.4_

  - [x] 1.2 Module files, types, the `structure.md` entry and the test arbitraries
    - **[demo-essential]**
    - Files: `src/codec-view/types.ts`, `src/codec-view/bits.ts`, `src/codec-view/align.ts`, `src/codec-view/diff.ts`, `src/codec-view/diffText.ts`, `src/codec-view/index.ts`, `.kiro/steering/structure.md`, `tests/support/patterns.ts`, `tests/support/lineSets.ts`.
    - Write every type of this feature in `types.ts`: `BitLine`, `BitsLine`, `DamagedLine`, `Line`, `LineSetHeader`, `LineSet`, `BitsResult`, `LinesFailure`, `LinesResult`, `DiffEntry`, `DiffCounts`, `DiffRefusal`, `Diff`, `ApplyFailure`, `ApplyResult`, `Alignment`. Import `CardProfile` and `Violation` from `src/codec` only.
    - Write `index.ts` complete: `export * from './types.ts'` and the named re-exports of `GROUP_SEPARATOR`, `cardToBits`, `patternToLines`, `groupBits`, `lineKey`, `alignLines`, `DIFF_PICK_LIMIT`, `diffPatterns`, `applyDiff`, `DIFF_MARKERS`, `diffToText`. Give each of the four implementation files a stub body of the right return type that returns a value and throws nothing. **No later task edits `index.ts`.**
    - Set the two constants to the values the design chose: `DIFF_PICK_LIMIT = 2000` in `diff.ts` (R6.12's minimum; the quadratic alignment at 2,000 per side is 23 MB and about 20 ms on the development machine).
    - `.kiro/steering/structure.md`: add the `src/codec-view` section after `src/codec` with its responsibilities and its five key exports plus `groupBits`, `lineKey`, `alignLines`, `GROUP_SEPARATOR`, `DIFF_MARKERS`, `DIFF_PICK_LIMIT` and the types; add `codec-view → codec` and `codec-view` to the `ui →` line of the dependency block; add the Code view files to the `src/ui` entry and `tests/codec-view/` to the `tests/` entry. The boundary test of task 1.3 reads this file, so it is written here and not at the end.
    - `tests/support/patterns.ts`: give `patternArbitrary(profile)` an optional second parameter `{ minPicks?: number; maxPicks?: number }` defaulting to the present 1 and 40, so the exporter tests that call it today are untouched and this feature can ask for pick counts that include 0 and 1 (R12.3).
    - `tests/support/lineSets.ts` (new): `lineSetArbitrary(profile)` built through `patternToLines`, and `diffArbitrary` (two Patterns through `patternToLines` and `diffPatterns`, plus a refusal arbitrary over the three reasons).
    - No `any`, no `as any`, no `@ts-ignore`, no `@ts-expect-error` anywhere in the feature; glossary terms only.
    - _Requirements: R8.1, R8.6, R8.7, R8.9, R6.12, R12.3_

  - [x] 1.3 The boundary test
    - **[cuttable]** — but written here, early, so the module cannot drift.
    - Files: `tests/codec-view/boundaries.test.ts`, `tests/support/source.ts`, `tests/structure/modules.test.ts`.
    - Move `importSpecifiers(code)` into `tests/support/source.ts` beside the existing `stripComments` (the three regexes for `import … from`, `export … from`, bare `import '…'` and `import('…')`) and have `tests/structure/modules.test.ts` import it from there. The other existing scans keep their own copies; nothing else moves.
    - `tests/codec-view/boundaries.test.ts` loads three file sets — every `.ts` in `src/codec-view`, every file of this feature in `src/ui` (`src/ui/screens/code/**`, `src/ui/state/codeView.ts`), and every `.ts` in `src/codec`, `src/reader`, `src/simulator`, `src/exporter`, `src/archive` — and asserts the eleven rows of the design's boundary-test table: specifiers in `src/codec-view` resolve inside `src/codec-view` or `src/codec` and none is bare (R8.2); no `react`, `window`, `document`, `navigator`, `localStorage`, `indexedDB`, `fetch`, `OffscreenCanvas`, `CanvasRenderingContext2D`, `ImageData` or `requestAnimationFrame` in `src/codec-view` with strings and comments blanked (R8.3); `archive`, `simulator` and `react` specifiers only under `src/ui`, and no `src/ui` specifier outside `src/ui` (R8.4); no `codec-view` specifier in the five downstream modules (R8.12); no demo profile name and no card dimension as a literal in `src/codec-view` (R8.5); no `any`, `as any`, `@ts-ignore` or `@ts-expect-error` in either feature file set (R8.6); no canvas drawing API named in a Code view file (R4.1); every test file of this feature under `tests/codec-view/` or `tests/ui/` (R8.8); and `.kiro/steering/structure.md` naming `src/codec-view`, its five key exports and both dependency lines (R8.9).
    - The `src/ui` file set is empty until Phase 3; the test must pass on an empty set and pick the files up when they arrive.
    - Each failure message reads `<file>:<line>: '<specifier or API name>' breaks R8.x`. Add one example test that plants a bad specifier in a string and asserts the message shape, so the test cannot pass by finding nothing (R8.11).
    - _Requirements: R8.2, R8.3, R8.4, R8.5, R8.6, R8.8, R8.9, R8.11, R8.12, R4.1_

  - [x] 1.4 `cardToBits` and `groupBits`
    - **[demo-essential]**
    - Files: `src/codec-view/bits.ts`, `tests/codec-view/bits.test.ts`.
    - `cardToBits(profile, card)`: call `encodeCardGrid` and map each lifted end to `1` and each other end to `0`, joined into a string of `endsPerPick(profile)` characters. The ends list from `encodeCardGrid` is the only mapping: never read `endOrder`, never compute an end index from `hookRows` or `hookColumns` (R1.3). On failure return the violations `src/codec` returned, unchanged and in order, with no Bit_Line and no partial Bit_Line (R1.4). Leave the profile and the card unchanged (R1.7).
    - `groupBits(bits, hookColumns)` and `GROUP_SEPARATOR = '|'`: one separator between each group of `hookColumns` ends, none before the first group and none after the last (R2.2).
    - Example tests: a 2 × 2 profile with a permuted `endOrder` whose Bit_Line is written out by hand in the test; a card that fails `validateCardGrid` returning the violations; `groupBits` on a known Bit_Line.
    - _Requirements: R1.1, R1.2, R1.3, R1.4, R1.7, R2.2, R8.5_

  - [x] 1.5 `patternToLines`
    - **[demo-essential]**
    - Files: `src/codec-view/bits.ts`, `tests/codec-view/bits.test.ts`.
    - Return a Line_Set holding the profile name, `hookRows`, `hookColumns`, `endsPerPick(profile)` and one Line per card, Line `p` carrying pick index `p`, ordered ascending from 0 with no gap and no repeat (R1.5, R1.6). A card that fails `validateCardGrid` becomes a `damaged` Line holding its violations at that pick, with every other pick unaffected (R1.9). A Pattern that is not an array fails `not-a-pattern` with location `pattern` and returns no Line_Set and no Lines (R1.10). Both inputs are left unchanged and two calls with equal inputs return equal results (R1.7).
    - Example tests: 0 picks gives no Lines; 1 pick gives one Line; a Pattern with a damaged card at pick 1 keeps the Bit_Lines of picks 0 and 2.
    - _Requirements: R1.5, R1.6, R1.7, R1.9, R1.10_

  - [x] 1.6 `lineKey` and `alignLines`
    - **[demo-essential]**
    - Files: `src/codec-view/align.ts`, `tests/codec-view/align.test.ts`.
    - `lineKey(line)`: the Bit_Line for a `bits` Line; `x` followed by the violation kinds and locations for a `damaged` Line.
    - `alignLines(first, second)`: the three steps of "The tie-breaking rule" — canonicalise the pair by a total order that reads only the two sequences (count first, then `lineKey` by `lineKey` as strings), run the two-key dynamic program (longest common subsequence, then least total index displacement `Σ|i − j|`, residual ties settled by a fixed backtrack order), then mirror the matched pairs back if the canonical pair is not the caller's pair. Intern `lineKey` values into `Int32Array` ids; `len` is a `Uint16Array` and `disp` a `Uint32Array` over `(m+1) × (n+1)`.
    - No common prefix or suffix trimming: it is not proved to preserve the least-displacement choice, and P5 and P7 rest on that choice.
    - Example tests: the design's `["00","11","00"]` against `["00","00","00"]` matches picks 0 and 2 and leaves pick 1 unmatched on both sides, displacement 0; one insertion leaves every later Line matched; `alignLines(a, b)` and `alignLines(b, a)` give mirrored pairs.
    - _Requirements: R5.2_

  - [x] 1.7 P1: a Bit_Line holds one character per end and agrees with `encodeCardGrid`
    - **[demo-essential]** — Property 1, criterion R1.1.
    - Files: `tests/codec-view/bits.test.ts`.
    - `it('R1.1 a Bit_Line holds one character per end and agrees with encodeCardGrid', …)`. Over `profileArbitrary` (with a permuted `endOrder`, so a non-row-major profile is covered) and `cardGridArbitrary(profile)`: the result is a string of `endsPerPick(profile)` characters, every character is `0` or `1`, and character `e` is `1` exactly when the ends list from `encodeCardGrid` lifts end `e`.
    - **Validates: Requirements R1.1, R1.2, R1.3**
    - _Requirements: R1.1, R1.2, R1.3, R12.1, R12.2, R12.4_

  - [x] 1.8 P2: reading a Bit_Line back through `decodeEnds` returns the original card
    - **[demo-essential]** — Property 2, criterion R1.2.
    - Files: `tests/codec-view/bits.test.ts`.
    - `it('R1.2 reading a Bit_Line back through decodeEnds returns the original card', …)`. Over the same arbitraries: turning the Bit_Line back into an ends list and passing it through `decodeEnds` gives a card deep-equal to the original.
    - **Validates: Requirements R1.2**
    - _Requirements: R1.2, R12.1, R12.2, R12.4_

  - [x] 1.9 `diffPatterns`: entries and counts
    - **[demo-essential]**
    - Files: `src/codec-view/diff.ts`, `tests/codec-view/diff.test.ts`.
    - From the Alignment to Diff_Entries, exactly as "From the Alignment to Diff_Entries" sets out: matched pairs split both sides into blocks; within each block pair the `k`-th unmatched Line of the first side with the `k`-th of the second for `k` up to the smaller count; a pair of `bits` Lines with differing Bit_Lines is `changed` with its Changed_Holes as the ascending end positions where they differ; a pair where only one side is damaged becomes a separate `removed` and `added` entry; the leftovers of the longer side are `removed` on the first side and `added` on the second; no pair crosses a block (R5.3, R5.4, R5.5). Entries are listed in Alignment order, so first-side and second-side pick indices each strictly increase across the entries that carry them (R5.6). The same two Line_Sets always give the same Diff and both inputs are left unchanged (R5.7). Diff_Counts are the Changed_Holes summed over `changed` entries, the number of `added` entries and the number of `removed` entries; no punched hole of an `added` or `removed` card counts as a Changed_Hole (R6.1, R6.3).
    - Example tests: one flipped hole; one inserted card; one deleted card; a block holding both a `changed` and an `added` entry; two identically damaged Lines coming out `unchanged`.
    - _Requirements: R5.1, R5.3, R5.4, R5.5, R5.6, R5.7, R6.1, R6.3_

  - [x] 1.10 The three refusals
    - **[demo-essential]**
    - Files: `src/codec-view/diff.ts`, `tests/codec-view/diff.test.ts`.
    - Check before any work, in this order: `profile-mismatch` carrying both Card_Profile names (R6.10); `dimension-mismatch` carrying the `hookRows` and `hookColumns` of both Line_Sets (R6.9); `too-many-picks` carrying `DIFF_PICK_LIMIT` and the pick count of both sides (R6.11). Each returns no Diff_Entries and no Diff_Counts. `DIFF_PICK_LIMIT` is 2,000, a module constant, the same on every run (R6.12).
    - Example tests: one per reason, each asserting the carried values and that no entries and no counts came back.
    - _Requirements: R6.9, R6.10, R6.11, R6.12_

  - [x] 1.11 `applyDiff`
    - **[demo-essential]**
    - Files: `src/codec-view/diff.ts`, `tests/codec-view/diff.test.ts`.
    - Reject a refusal as `refused-diff`; a header that differs from the given Line_Set's as `header-mismatch`; `unchanged`, `changed` and `removed` entries that do not name, in ascending pick index order, exactly the Lines of the given Line_Set as `lines-mismatch` with the pick index (R5.10). Otherwise build the Lines (`unchanged`, `changed` and `added` take the second Line, `removed` takes nothing), renumber 0..n−1, and return a Line_Set with the Diff's second header. The given Line_Set is never written to (R5.8, R5.10).
    - Example tests: one per failure reason; a Diff over the Line_Set it was built from returning the second Line_Set.
    - _Requirements: R5.8, R5.10_

  - [x] 1.12 `diffToText`
    - **[demo-essential]**
    - Files: `src/codec-view/diffText.ts`, `tests/codec-view/diffText.test.ts`.
    - `DIFF_MARKERS = { unchanged: ' ', changed: '~', added: '+', removed: '-' }`. One line per Diff_Entry as `<marker> <firstPick>/<secondPick> <grouped Bit_Line>`, a side the entry has no index on written `-`, the Bit_Line being the second side's for `added` and `changed` and the first side's for `unchanged` and `removed`, carrying Group_Separators from `groupBits`, pick fields unpadded (R6.4, R6.14). Lines joined with a single `\n`, no trailing newline, and a last line starting `#` holding the three Diff_Counts as decimal numerals separated by single spaces in the order changed holes, added cards, removed cards; a Diff with no entries is that summary line alone (R6.5). A damaged Line has no Bit_Line, so the `lineKey` text (`x` and the violation kinds) is written in its place. A refused Diff gives exactly one line starting `!` naming the reason and its values, with no entry line and no summary line (R6.15).
    - Example tests: a hand-written Diff_Text for a three-pick change, compared character for character; the three refusal lines; an empty Diff giving `# 0 0 0`.
    - _Requirements: R6.4, R6.5, R6.14, R6.15_

  - [x] 1.13 P3: a design compared with itself reports no change
    - **[demo-essential]** — Property 3, criteria R5.1 and R7.5.
    - Files: `tests/codec-view/diff.test.ts`.
    - `it('R5.1 a design compared with itself reports no change', …)`. Over `lineSetArbitrary(profile)`, including a Line_Set with damaged Lines and one with no Lines: `diffPatterns(a, a)` has no `changed`, `added` or `removed` entry, one `unchanged` entry per Line, and Diff_Counts of zero, zero, zero.
    - **Validates: Requirements R5.1, R7.5**
    - _Requirements: R5.1, R7.5, R12.1, R12.2, R12.4_

  - [x] 1.14 P4: applying a diff to the first design gives the second
    - **[demo-essential]** — Property 4, criterion R5.8.
    - Files: `tests/codec-view/diff.test.ts`.
    - `it('R5.8 applying a diff to the first design gives the second', …)`. Over two Patterns on one generated Card_Profile with `patternArbitrary(profile, { minPicks: 0, maxPicks: 24 })`: `applyDiff(a, diffPatterns(a, b))` returns a Line_Set equal to `b` by the Line_Set equality of the Glossary, and `a` is unchanged.
    - **Validates: Requirements R5.8**
    - _Requirements: R5.8, R12.1, R12.2, R12.4_

  - [x] 1.15 P5: flipping one hole gives one changed card and one changed hole
    - **[demo-essential]** — Property 5, criteria R6.1 and R6.3.
    - Files: `tests/codec-view/diff.test.ts`.
    - `it('R6.1 flipping one hole gives one changed card and one changed hole', …)`. Over a Pattern of at least one pick, a pick and a hook position: flipping that one punched hole gives exactly one `changed` entry, no `added` and no `removed` entry, Diff_Counts of one changed hole, zero added and zero removed, and that entry's Changed_Holes is the single end index `encodeCardGrid` maps the flipped hook position to.
    - If this fails, the alignment's least-displacement tie-break is the first thing to look at; report the counterexample, do not relax the property.
    - **Validates: Requirements R6.1, R6.3**
    - _Requirements: R6.1, R6.3, R12.1, R12.2, R12.4_

  - [x] 1.16 P6: inserting one card gives one added card and nothing else
    - **[demo-essential]** — Property 6, criterion R5.2.
    - Files: `tests/codec-view/diff.test.ts`.
    - `it('R5.2 inserting one card gives one added card and nothing else', …)`. Over a Pattern and an insertion position: exactly one `added` entry, no `changed` and no `removed` entry, and every Line of the first Line_Set appears in an `unchanged` entry.
    - **Validates: Requirements R5.2**
    - _Requirements: R5.2, R12.1, R12.2, R12.4_

  - [x] 1.17 P7: the diff of two designs is the mirror of the diff the other way round
    - **[demo-essential]** — Property 7, criteria R5.9 and R6.2.
    - Files: `tests/codec-view/diff.test.ts`.
    - `it('R5.9 the diff of two designs is the mirror of the diff the other way round', …)`. Over two Line_Sets that `diffPatterns` refuses in neither direction: `diffPatterns(b, a)` has the same number of entries in the same order as `diffPatterns(a, b)`; each `unchanged` and each `changed` entry holds the same two Lines, and a `changed` entry the same Changed_Holes; each `added` entry of the one is the `removed` entry of the other for the same Line; and the changed-hole counts of the two Diffs are equal.
    - This is the property the canonicalisation of task 1.6 exists for. If it fails, the tie-breaking rule is wrong; bring the counterexample back rather than dropping R6.2.
    - **Validates: Requirements R5.9, R6.2**
    - _Requirements: R5.9, R6.2, R12.1, R12.2, R12.4_

  - [x] 1.18 Well-formedness property: every Diff is well formed
    - **[demo-essential]** — the design's folded-in R5.5 property.
    - Files: `tests/codec-view/diff.test.ts`.
    - `it('R5.5 every diff entry names the holes that differ and the picks never go backwards', …)`. Over any two Line_Sets on one profile: each `changed` entry's Changed_Holes is non-empty, strictly ascending and exactly the end positions where its two Bit_Lines differ; first-side and second-side pick indices each strictly increase across the entries that carry them; no block holds both leftover `added` and leftover `removed` entries; and the Diff_Counts equal the totals derived from the entries.
    - **Validates: Requirements R5.3, R5.4, R5.5, R5.6, R6.1**
    - _Requirements: R5.3, R5.4, R5.5, R5.6, R6.1, R12.2, R12.4_

  - [x] 1.19 P8: the Diff_Text holds one line per entry, one summary line, and never goes backwards
    - **[cuttable]** — Property 8, criterion R6.4.
    - Files: `tests/codec-view/diffText.test.ts`.
    - `it('R6.4 the diff text holds one line per entry, one summary line, and never goes backwards', …)`. Over `diffArbitrary`: one line per Diff_Entry followed by one summary line starting `#`; every entry line starts with exactly one of the four markers; first-side and second-side pick indices each never decrease down the text; and a refused Diff gives exactly one line, starting `!`, naming the reason and its values.
    - **Validates: Requirements R6.4, R6.5, R6.14, R6.15**
    - _Requirements: R6.4, R6.5, R6.14, R6.15, R12.1, R12.2, R12.4_

  - [x] 1.20 P10: every exported function returns a value and throws nothing
    - **[demo-essential]** — Property 10, criterion R1.8.
    - Files: `tests/codec-view/totality.test.ts`.
    - `it('R1.8 every exported function returns a value and throws nothing', …)`. Over `fc.anything()`, cards that are not arrays, cards with the wrong number of hook rows or hook columns, non-boolean hook positions, Patterns that are not arrays, Line_Sets with mismatched profile names or dimensions, and Line_Sets longer than `DIFF_PICK_LIMIT`: each of `cardToBits`, `patternToLines`, `groupBits`, `diffPatterns`, `applyDiff` and `diffToText` returns a value and throws nothing, and a refusal carries the values R6.9 to R6.11 name with no entries and no counts.
    - **Validates: Requirements R1.8, R6.9, R6.10, R6.11**
    - _Requirements: R1.8, R6.9, R6.10, R6.11, R12.1, R12.2, R12.4_

  - [x] 1.21 Checkpoint - the pure module
    - Ensure all tests pass, ask the user if questions arise.
    - Confirm each of the five exported functions has at least one property and at least one example-based test (R12.1), and that P1 to P7 and P10 all exist (R12.5). Add a test that runs a 2,000 × 2,000 diff and reports its measured time, so a regression in the alignment is visible. Report the measured number.
    - _Requirements: R12.1, R12.5, R12.9_

- [ ] 2. The shared Selected_Pick and the pure view logic
  - _Requirements: R2.3, R2.4, R2.5, R2.7, R2.11, R3.1, R3.2, R3.4, R3.5, R3.6, R3.8, R3.9, R3.10, R4.1, R4.2, R4.6, R10.1, R10.2, R10.3, R10.4, R10.5, R10.6, R10.7, R10.8, R11.3, R11.4, R11.5, R11.12, R11.13_

  - [x] 2.1 `AppState.selectedPick`, `select-pick`, breakpoints and cloth choices
    - **[demo-essential]**
    - **Existing tests change in this task. Nobody should be surprised: four test files are edited.**
    - Files: `src/ui/types.ts`, `src/ui/state/appState.ts`, `src/ui/state/playback.ts`, `src/ui/screens/weave/WeaveScreen.tsx`, `src/ui/screens/weave/ClothCanvas.tsx`, `tests/ui/state/appState.test.ts`, `tests/ui/state/playback.test.ts`, `tests/ui/screens/weave.test.tsx`, `tests/ui/screens/weaveWiring.test.ts`.
    - `AppState` gains `selectedPick: number`, `breakpoints: ReadonlyArray<number>` and `clothChoices: ClothChoices`; `Screen` gains `'code'`. `AppAction` gains `{ type: 'select-pick'; pick: number }`, `{ type: 'toggle-breakpoint'; pick: number }` and `{ type: 'set-cloth-choices'; choices: ClothChoices }`. `select-pick` clamps to `0 .. max(0, current.pattern.length - 1)`, so no Selected_Pick outside the design can exist (R4.2). One new reducer helper handles every action that replaces the Current_Pattern — `request-sample`, `confirm-accepted` for a sample, `open-saved`, `batch-commit` — setting `selectedPick: 0` and `breakpoints: []` (R3.10, R4.6). Breakpoints stay ascending without repeats and survive navigating away and back within the page load; nothing writes them to the Archive or an exported file (R3.10).
    - `PlaybackState` becomes `{ status: 'idle' | 'playing' | 'paused' | 'finished' }`. The Weave_Screen's own pick value goes away: the pick it shows is `state.selectedPick`; `createClothPlayer`'s frame report dispatches `select-pick` with the frame's pick; `entryPlayback` and `displayedPlayback` return a status and an entry pick, dispatched once when a cloth is entered; the places that read `pick === pickCount` read `status === 'finished'`, and `pickLabel`/`canvasAltText` are given `status === 'finished' ? pickCount : state.selectedPick`. Every deliberate move on Weave — step, scrub, seek — is one `select-pick` dispatch (R3.1, R3.2, R4.2).
    - The four existing test files are updated to the new state shape. Keep every assertion they make about Weave behaviour, including that a settings change keeps the current pick and that the pick counter never shows a value from a previous render; do not weaken a test to fit the refactor. Report any test whose assertion genuinely has to change, and why.
    - _Requirements: R3.1, R3.2, R3.10, R4.2, R4.6_

  - [x] 2.2 `buildReadyCloth` moved into `src/ui/state/cloth.ts`
    - **[demo-essential]**
    - Files: `src/ui/state/cloth.ts`, `src/ui/screens/weave/WeaveScreen.tsx`, `tests/ui/state/cloth.test.ts`.
    - Move `buildReadyCloth` from `WeaveScreen.tsx` into `src/ui/state/cloth.ts` unchanged and re-export it from `WeaveScreen.tsx`, so the existing Weave tests keep their import. It takes the profile, the Pattern, the `ClothChoices` now in `AppState` and the viewport, which stays each screen's own. This is what lets Code view paint with the user's Weave choices and add no second renderer (R4.1).
    - _Requirements: R4.1_

  - [x] 2.3 Translation keys, English and Hindi
    - **[demo-essential]**
    - Files: `src/ui/i18n/en.json`, `src/ui/i18n/hi.json`, `docs/HINDI_REVIEW.md`, `tests/ui/i18n/messages.test.ts`.
    - Add every key of the design's table to both files: `nav.code`, `codeview.listing.name`, `codeview.line.name`, `codeview.line.nameEmpty`, `codeview.line.nameDamaged`, `codeview.line.damagedLabel`, `codeview.bitline.name`, `codeview.breakpoint.name`, `codeview.pickCount`, `codeview.announce.pick`, `codeview.announce.noBreakpoint`, `codeview.jump.range`, the four `codeview.diff.kind.*`, the four `codeview.diff.name.*`, the three `codeview.refusal.*` (each naming the values the refusal carries and one action the user can take next), `error.codeview.load`, and the labels and messages the screen needs for the step, jump, breakpoint and diff controls, the empty-design message naming Scan and the Weave samples, the Archive failure messages, the "the two designs are the same" message and the "no saved design to compare against" message.
    - Every Hindi entry is written with `reviewed: false`, so `npm run review-list` names it with its Hindi and English text until a native speaker marks it reviewed (R10.4). Regenerate `docs/HINDI_REVIEW.md`.
    - The Hindi text of a key uses the same placeholder names as the English text (R10.2), and uses exactly पिक, एंड, कार्ड, छेद, नक्शा and नक्शबंद for those six concepts and no other word (R10.3). Numbers go in through placeholders as the digits `0` to `9`, identical in both languages, with every word around them from the Translation_File (R10.5). The Bit_Line characters, the Group_Separator and the four Diff_Entry markers are **not** keys: they come from the module (R10.6, R10.7).
    - Assert in `tests/ui/i18n/messages.test.ts` that the two files hold the same key set with the same placeholders, that every new `hi` entry is unreviewed, and that `codeview.line.name` and `codeview.line.nameEmpty` read exactly `Pick {pick}: punched at ends {ends}` and `Pick {pick}: no end punched` in `en` (R11.3, R11.4).
    - _Requirements: R10.1, R10.2, R10.3, R10.4, R10.5, R10.6, R10.7_

  - [x] 2.4 `windowFor` and `pickNumberWidth`
    - **[demo-essential]**
    - Files: `src/ui/state/codeView.ts`, `tests/ui/state/codeView.test.ts`.
    - `WINDOW_SIZE = 80` and `WINDOW_MARGIN = 10`, at the values the design chose: 48 px rows mean a 1920 px viewport shows 40 rows, so 80 is twice the most that can be visible and leaves 20 rows of headroom at each edge, inside R2.5's 40 to 200, and varying with nothing (R2.5).
    - `windowFor(previous, pickCount, selectedPick, firstVisiblePick, visiblePicks)`, pure and total, in the design's five steps: no picks gives `{ from: 0, count: 0 }`; `count = min(WINDOW_SIZE, pickCount)`; the wanted span is the visible span together with `selectedPick`, clamped into the pattern, and where it is wider than `count` the part holding `selectedPick` is kept; an unchanged `previous` is returned when the wanted span sits at least `WINDOW_MARGIN` rows inside both of its edges; otherwise the Window is centred on the wanted span and clamped to `0..pickCount - count` (R2.4, R2.7, R2.11).
    - `pickNumberWidth(pickCount)`: the character width of the largest pick index, so every Bit_Line starts at the same horizontal offset (R2.3).
    - Example tests: the invariants at 0, 1 and 10,000 picks; a scroll inside the margin returning the same Window object; a Selected_Pick outside the Window moving it.
    - _Requirements: R2.3, R2.4, R2.5, R2.7, R2.11_

  - [x] 2.5 Breakpoints and the jump parse
    - **[demo-essential]**
    - Files: `src/ui/state/codeView.ts`, `tests/ui/state/codeView.test.ts`.
    - `toggleBreakpoint(breakpoints, pick)`: sets a Breakpoint where the pick index has none and removes it where it has one, at most one per pick index, kept ascending without repeats (R3.6). `nextBreakpoint(breakpoints, pick, lastPick)`: the lowest Breakpoint above `pick` with `found` true, or `lastPick` with `found` false, so the screen can jump straight there without making the intervening pick indices the Selected_Pick on the way (R3.8, R3.9). `parseJump(text, lastPick)`: a whole number from 0 to `lastPick` succeeds, and a blank value, a non-whole number or a value outside the range fails so the screen can name 0 and the last pick index as the allowed range (R3.4, R3.5).
    - Example tests: a double toggle restores the set; `nextBreakpoint` with no Breakpoint above; `parseJump` on blank, `'3.5'`, `'-1'`, `lastPick + 1` and `'0'`.
    - _Requirements: R3.4, R3.5, R3.6, R3.8, R3.9_

  - [x] 2.6 Accessible-name builders, and the property on them
    - **[demo-essential]** — the design's folded-in R11.3 property.
    - Files: `src/ui/state/codeView.ts`, `tests/ui/state/codeView.test.ts`.
    - `lineAccessibleName(t, line)` builds the R11.3, R11.4 and R11.12 names from one Line and the `Translate` function: the pick number, then the end indices of the punched holes in ascending order separated by a comma and a space with no Group_Separator; the no-end-punched text where the Line has none; the damaged-card text, listing no end index, for a `damaged` Line. `diffEntryAccessibleName(t, entry)` builds the R11.5 name: the kind word in the current language, the pick number or both pick numbers, and for a `changed` entry the differing end indices in ascending order — so the marker character is never the only statement of the kind.
    - `it('R11.3 a Line accessible name names its pick and its punched ends', …)` over `lineArbitrary(profile)` across both Line kinds and both dictionaries: the name holds the pick number as digits; a `bits` Line with punched holes lists exactly those end indices in ascending order, comma and space separated, with no Group_Separator; a Line with none is the no-end-punched text; a `damaged` Line is the damaged-card text and lists no end index. The Hindi run hears पिक and एंड and no English word (R10.8).
    - Example tests: the two exact English strings of R11.3 and R11.4 for pick 5 punched at ends 0, 3 and 7.
    - **Validates: Requirements R10.8, R11.3, R11.4, R11.12**
    - _Requirements: R10.8, R11.3, R11.4, R11.5, R11.12, R12.2, R12.4_

  - [~] 2.7 `focusTargetAfterWindowMove`
    - **[cuttable]**
    - Files: `src/ui/state/codeView.ts`, `tests/ui/state/codeView.test.ts`.
    - Given the kind and pick of the control that had focus, the new Window and the Selected_Pick, return the same kind of control on the Selected_Pick's Line, or `'step-forward'` where that Line has no such control, or `null` where focus did not leave the document. Pure, so it is tested without a DOM; the screen wires it in task 3.8 (R11.13).
    - Example tests: a breakpoint control whose Line left the Window; a Bit_Line region still in the Window; a damaged Selected_Pick Line, which has no Bit_Line region.
    - _Requirements: R11.13_

  - [~] 2.8 P9: the Window holds at most Window_Size Lines and always holds the Selected_Pick
    - **[cuttable]** — Property 9, criterion R2.4.
    - Files: `tests/ui/state/codeView.test.ts`.
    - `it('R2.4 the window holds at most Window_Size lines and always holds the selected pick', …)` over `fc.integer({ min: 0, max: 10_000 })` pick counts, a Selected_Pick in range, any scroll position and `visiblePicks` from 1 to `WINDOW_SIZE`: the Window holds at most `WINDOW_SIZE` Lines, lies inside the pattern, holds the Line of the Selected_Pick, and holds every visible Line whenever `visiblePicks <= count`.
    - **Validates: Requirements R2.4, R2.6, R2.7, R2.11**
    - _Requirements: R2.4, R2.6, R2.7, R2.11, R12.2, R12.4_

  - [~] 2.9 Reducer property: one pick and one breakpoint set
    - **[cuttable]** — the design's folded-in R3.1 property.
    - Files: `tests/ui/state/codeView.test.ts`.
    - `it('R3.1 the reducer keeps one selected pick and one breakpoint set', …)` over an action-sequence arbitrary across `select-pick`, `toggle-breakpoint`, `navigate` and the pattern-replacing actions: the Selected_Pick stays within `0..lastPick`, the breakpoints stay ascending without repeats, a double toggle restores the set, `navigate` changes neither, and every pattern-replacing action sets the Selected_Pick to 0 and empties the breakpoints.
    - **Validates: Requirements R3.1, R3.2, R3.4, R3.6, R3.10, R4.6**
    - _Requirements: R3.1, R3.2, R3.4, R3.6, R3.10, R4.6, R12.2, R12.4_

  - [x] 2.10 Checkpoint - state and view logic
    - Ensure all tests pass, ask the user if questions arise.
    - The whole existing suite must pass after the `selectedPick` refactor, not only the new tests. Report every existing test that changed and what changed in it.
    - _Requirements: R4.2, R12.9_

- [ ] 3. The Code_View_Screen
  - _Requirements: R2.1, R2.2, R2.3, R2.6, R2.8, R2.9, R2.10, R2.11, R3.3, R3.7, R3.11, R3.12, R3.13, R4.1, R4.3, R4.4, R4.5, R4.7, R6.6, R6.7, R6.8, R6.12, R6.13, R6.16, R7.1, R7.2, R7.3, R7.4, R7.5, R7.6, R7.7, R7.8, R8.4, R9.1, R9.9, R9.10, R10.8, R11.1, R11.2, R11.5, R11.6, R11.7, R11.8, R11.9, R11.10, R11.11, R12.8_

  - [x] 3.1 The lazy fourth Screen, its navigation entry and the marker
    - **[demo-essential]**
    - Files: `src/ui/App.tsx`, `src/ui/screens/code/CodeViewScreen.tsx`, `src/ui/screens/code/CodeViewScreen.module.css`, `tests/ui/screens/code.test.tsx`.
    - `SCREENS` becomes `['weave', 'keep', 'scan', 'code']`, so a fourth navigation control sits beside Weave, Keep and Scan and activating it shows the Code_View_Screen (R2.1). `const CodeViewScreen = lazy(() => import('./screens/code/CodeViewScreen.tsx'))`, inside the same `<Suspense>` shape the Scan screen uses, so the chunk is requested only on the first open of Code view in a page session (R9.1). `ScreenBoundary` takes `t('error.codeview.load')` while the screen is `'code'`, so a failed import leaves the navigation and the other Screens usable and the Current_Pattern untouched (R9.10).
    - `export const CODE_VIEW_MARKER = 'naqsha-code-view-listing'` in `CodeViewScreen.tsx`, used as the `id` of the listing element: a string literal of the screen's own code, not an identifier, so it survives minification (R9.9).
    - The screen takes `state`, `dispatch`, `t`, an optional `archiveDeps` and an optional `scheduler`, so tests use a fake store the way the Keep screen already does. Only files under `src/ui` import from `src/archive`, `src/simulator` or `react` (R8.4).
    - The `.module.css` sits beside the component with the component's name, per `structure.md`. Define `--code-line-height: var(--touch-target)` here.
    - Example tests: the fourth navigation control is present on every screen; activating it renders the screen; a rejecting lazy import shows `error.codeview.load` with the navigation still operable.
    - _Requirements: R2.1, R8.4, R9.1, R9.9, R9.10_

  - [x] 3.2 The listing and one Line
    - **[demo-essential]**
    - Files: `src/ui/screens/code/Listing.tsx`, `src/ui/screens/code/Listing.module.css`, `src/ui/screens/code/LineRow.tsx`, `src/ui/screens/code/LineRow.module.css`, `src/ui/screens/code/CodeViewScreen.tsx`, `tests/ui/screens/code.test.tsx`.
    - `Listing` is the scroller: a spacer of `pickCount × rowHeight`, the Window `<ol id={CODE_VIEW_MARKER}>` offset by `transform: translateY(from × rowHeight)`, `firstVisiblePick = floor(scrollTop / rowHeight)` from the one CSS custom property, and `windowFor` deciding the Window — so at most `WINDOW_SIZE` Line elements are in the document whatever the length of the Current_Pattern, the Window moves when the Selected_Pick leaves it, and every Line inside the viewport is in the document while scrolling (R2.4, R2.7, R2.11).
    - `LineRow` renders the DOM of the design's "The DOM of one Line": the breakpoint `button` with `aria-pressed`, the `aria-hidden` marks column (`●` for a Breakpoint, `▶` for the Selected_Pick, both shown when the Selected_Pick has one), the pick number padded to `pickNumberWidth` in fixed-width text, and the Bit_Line in its own `role="group"` `tabindex="0"` region with `overflow-x: auto`, its own accessible name and a `keydown` handler moving `scrollLeft` by one character cell on `ArrowLeft`/`ArrowRight` and to `0`/`scrollWidth` on `Home`/`End` (R2.2, R2.3, R3.7, R3.11, R11.11). The Bit_Line text is `groupBits(bits, hookColumns)`, so it carries `Ends_Per_Pick` bit characters and `(Ends_Per_Pick / hookColumns) - 1` Group_Separators and never wraps onto a second visual row (R2.2, R11.8). `aria-current="true"` marks the Selected_Pick's Line. A `damaged` Line replaces the Bit_Line region with the damaged-card label, shows no Bit_Line, and leaves the other Lines of the Window with theirs (R2.9).
    - The screen header shows the total number of picks as a numeral and the Card_Profile name while any Line is on screen (R2.8).
    - A Breakpoint on a pick index whose Line left the Window is kept, and its marker is shown again when the Line returns (R3.13).
    - Example tests: the rendered row and its Group_Separators; padded pick numbers at 9, 10 and 10,000 picks; a damaged Line; the pick count and profile name; `Home`/`End` scrolling of a Bit_Line region; a Breakpoint surviving a Window move.
    - _Requirements: R2.2, R2.3, R2.4, R2.7, R2.8, R2.9, R2.11, R3.7, R3.11, R3.13, R11.8, R11.11_

  - [x] 3.3 Step, jump and run-to-next-breakpoint, and the live region
    - **[demo-essential]**
    - Files: `src/ui/screens/code/CodeViewScreen.tsx`, `src/ui/screens/code/CodeViewScreen.module.css`, `tests/ui/screens/code.test.tsx`.
    - Step forward and step back dispatch `select-pick` with one more and one less, leaving the Current_Pattern and the Breakpoints unchanged (R3.1, R3.2). Step forward is disabled on the last pick index and step back on pick 0, and activating a disabled control changes nothing and shows no error message (R3.3, R3.12). The jump control takes a pick number from 0 to the last pick index through `parseJump`; a blank, non-whole or out-of-range value leaves the Selected_Pick and the Breakpoints alone and shows `codeview.jump.range` naming 0 and the last pick index, which goes away on the next valid application (R3.4, R3.5). The per-Line breakpoint control dispatches `toggle-breakpoint` (R3.6). "Run to next breakpoint" dispatches one `select-pick` straight to `nextBreakpoint`, with no intervening pick becoming the Selected_Pick; with none above it stops at the last pick index, shows the no-further-breakpoint message and announces it in the App's live region (R3.8, R3.9).
    - `announce` is dispatched with `codeview.announce.pick` once in each handler that moves the Selected_Pick deliberately — step forward, step back, jump, run to next breakpoint — and nothing is dispatched when the Window moves or when the Weave_Screen's playback moves the pick (R11.6).
    - Example tests: step and jump disabled at the ends; the invalid-jump message appearing and going; run-to-next-breakpoint with and without a Breakpoint above; the live region counting one announcement per deliberate move and none on a Window move.
    - _Requirements: R3.1, R3.2, R3.3, R3.4, R3.5, R3.6, R3.8, R3.9, R3.12, R11.6_

  - [x] 3.4 The cloth beside the current card
    - **[demo-essential]**
    - Files: `src/ui/screens/code/CodeViewScreen.tsx`, `src/ui/screens/code/CodeViewScreen.module.css`, `tests/ui/screens/code.test.tsx`.
    - One `ClothCanvas` and one `createClothPlayer`, built from `buildReadyCloth(profile, pattern, state.clothChoices, viewport.width, viewport.height)` — the Weave_Screen's own simulator calls and the user's own cloth choices, with only the viewport from this screen's layout. No pixel-drawing code and no canvas drawing call of its own (R4.1). Only `player.seek(state.selectedPick)` is ever called, never `play`, so the still rest frame of the new Selected_Pick is painted within 100 ms of the change and no playback starts (R4.3).
    - A Sim_Failure shows the message for its kind from `simFailureKey`, distinct for `invalid-profile`, `invalid-settings` and `pick-out-of-range`, paints no cloth, and leaves the Lines, their pick numbers and the step, jump and breakpoint controls shown and operable (R4.4). A Current_Pattern with no picks shows the R7.1 empty-design message in place of the cloth and paints nothing (R4.5).
    - Example tests: the three Sim_Failure messages with the controls still operable; a seek on every Selected_Pick change and no `play` call, with a `FakeScheduler` and a fake paint.
    - _Requirements: R4.1, R4.3, R4.4, R4.5_

  - [x] 3.5 The diff panel: choosers, counts and entries
    - **[demo-essential]**
    - Files: `src/ui/screens/code/DiffPanel.tsx`, `src/ui/screens/code/DiffPanel.module.css`, `src/ui/screens/code/CodeViewScreen.tsx`, `tests/ui/screens/code.test.tsx`.
    - `listDesigns(archiveDeps)` once on mount. The user compares the Current_Pattern against one Saved_Design, or two Saved_Designs against each other, from the list the Archive returns; the design chosen first is the first Line_Set and the Current_Pattern or the design chosen second is the second, so `added` always means present only in the second (R6.6). `getDesign` is called once per chosen Saved_Design when the compare control is applied; each fetched Pattern goes straight through `patternToLines` and only the Line_Set is kept. The Current_Pattern's Line_Set is `useMemo(() => patternToLines(profile, pattern), [profile, pattern])`.
    - Each Diff_Entry in view shows the R6.4 marker character, the translated kind word as visible text, and for a `changed` entry the second side's Bit_Line with a marker row of `^` directly beneath each differing end in the same fixed-width grid — a text marker, never colour alone (R6.7, R11.7). The marker row is `aria-hidden`; the entry's accessible name comes from `diffEntryAccessibleName` and carries the kind word and the end indices (R11.5). The three Diff_Counts are shown as numerals through placeholders.
    - While the Archive list holds no Saved_Design, the controls that choose a design are disabled and the no-saved-design message is shown (R6.16).
    - Example tests: one entry of each of the four kinds with its marker, kind word and `^` row; the counts; an empty archive disabling the compare controls.
    - _Requirements: R6.6, R6.7, R6.16, R11.5, R11.7_

  - [x] 3.6 The Diff_Text: copy and download
    - **[demo-essential]**
    - Files: `src/ui/screens/code/DiffPanel.tsx`, `tests/ui/screens/code.test.tsx`.
    - Offer `diffToText(diff)` both as text the user can select and copy and as a file to download, the downloaded bytes holding the same characters as the text shown with no line added, removed or reordered (R6.8). The download goes through injected dependencies, as the exporter's already does, so a test uses a fake and not a mock. Every label, heading and message around the Diff_Text comes from the Translation_File; the Diff_Text itself comes from the module and is the same in both languages (R10.7).
    - Example tests: the copy text equal to the downloaded bytes, character for character; one download call with the right file name.
    - _Requirements: R6.8, R10.7_

  - [x] 3.7 Refusals, empty, missing and failing inputs
    - **[demo-essential]**
    - Files: `src/ui/screens/code/CodeViewScreen.tsx`, `src/ui/screens/code/DiffPanel.tsx`, `tests/ui/screens/code.test.tsx`.
    - Each of the three refusal reasons has its own plain-language message naming the values the refusal carries and one action the user can take next; both chosen designs stay listed and selectable, no Diff_Entries and no Diff_Counts are shown, and no Diff_Text is offered to copy or download (R6.12, R6.13).
    - A Current_Pattern with no picks shows the message naming the Scan_Screen and the Weave_Screen's Sample_Designs, shows no Lines, and shows the step, jump, breakpoint and diff controls present and disabled rather than absent (R7.1). `storage-unavailable` shows its message from `archiveFailureKey`, keeps the listing, disables the controls that choose or compare a Saved_Design, and keeps the step, jump and breakpoint controls enabled (R7.2). Before calling `diffPatterns`, both Line_Sets are scanned for the lowest `damaged` Line; either one blocks the comparison with a message naming the design and that pick index, shows no entries and no counts, and keeps the listing (R7.3) — a `not-an-array` failure is reported with the same message at pick 0. `not-found` shows its message, calls `listDesigns` again so the list the user sees is fresh, and keeps the listing (R7.4). Two equal Line_Sets report zero, zero, zero, show every entry as `unchanged`, show the designs-are-the-same message, and show no refusal and no error (R7.5). A Current_Pattern longer than the Diff_Pick_Limit still shows its listing with the step, jump and breakpoint controls enabled (R7.7), and a comparison of it shows the `too-many-picks` message naming the limit and its pick count, with no counts and the listing kept (R7.8). A Card_Profile that failed to load shows the App's profile message in place of the listing, shows no Lines, disables the step, jump, breakpoint and diff controls, and keeps every navigation control operable (R7.6).
    - Add the six example-based tests R12.8 names, one per criterion — R7.1, R7.2, R7.3, R7.4, R7.5 and R7.8 — each with a fake `ArchiveStore`, not a mock.
    - _Requirements: R6.12, R6.13, R7.1, R7.2, R7.3, R7.4, R7.5, R7.6, R7.7, R7.8, R12.8_

  - [x] 3.8 Keyboard, focus, colour and motion
    - **[demo-essential]**
    - Files: `src/ui/screens/code/CodeViewScreen.module.css`, `Listing.module.css`, `LineRow.module.css`, `DiffPanel.module.css`, `src/ui/screens/code/CodeViewScreen.tsx`, `tests/ui/screens/code.test.tsx`, `tests/ui/accessibility.test.tsx`.
    - Every step, jump, breakpoint and diff control is a `button`, reachable and operable with the keyboard alone, in a tab order that follows the visual order — screen controls, then each Line's breakpoint control and Bit_Line region, then the diff panel — with no control reachable only by pointer, and focus able to leave the listing and reach the App navigation without a pointer (R11.1). The focus indicator has a contrast ratio of at least 3:1 against its neighbours and the focused control is brought into view so no part of the indicator is hidden by the edge of a Bit_Line region or of the listing (R11.2). Every control, including the per-Line breakpoint control, meets the App's Touch_Target at every viewport width from 320 to 1920 CSS pixels; the row height is `--touch-target`, so the Line controls already do (R11.10). The page never scrolls horizontally at 320, 390 and 1280 CSS pixels: only the Bit_Line region scrolls sideways, and it never widens its row (R11.8).
    - Breakpoint, Selected_Pick and each Diff_Entry kind are told apart by a text label or shape marker in addition to any colour, using `●`, `▶` and the four R6.4 markers, so the screen reads without colour (R11.7).
    - Every transition and every `scroll-behavior: smooth` in these CSS modules sits inside `@media (prefers-reduced-motion: no-preference)`, and the screen calls `scrollIntoView({ block: 'nearest', behavior: 'auto' })` while `state.prefersReducedMotion`, so the new Window and the new Selected_Pick marker appear in one step with the Selected_Pick's Line in view (R11.9).
    - Wire `focusTargetAfterWindowMove` in a `useLayoutEffect` after the commit: record the focused control's kind and pick before a Window move, and when that element has left the document move focus to the same kind of control on the Selected_Pick's Line, or to the step forward control, never leaving the document body focused (R11.13).
    - Example tests: the tab order; reduced motion placing the Window in one step; focus following a Window move; the accessible names of R11.3 to R11.5 and the live-region text taken from the Translation_File in both languages (R10.8).
    - _Requirements: R10.8, R11.1, R11.2, R11.7, R11.8, R11.9, R11.10, R11.13_

  - [~] 3.9 R4.7: both screens derive one image from one `renderFrame` call
    - **[cuttable]**
    - Files: `tests/ui/screens/code.test.tsx`.
    - `it('R4.7 Code view paints the same image as the Weave screen for the same pick', …)` over `profileArbitrary`, `patternArbitrary`, `clothChoicesArbitrary` and a pick: both screens derive their image from one call of `renderFrame` with the same PreparedCloth, the same RenderSettings and the same pick. State in the test what it does not check: `paintToCanvas` is one `putImageData`, and only `check:browser`, which hashes the canvas, checks that the canvas really holds those pixels.
    - **Validates: Requirements R4.7**
    - _Requirements: R4.7, R12.2, R12.4_

  - [~] 3.10 Listing timing at 10,000 picks
    - **[cuttable]**
    - Files: `tests/ui/screens/code.test.tsx`.
    - One test renders a 10,000-pick listing and asserts the Lines of the Window are in the document, with at most `WINDOW_SIZE` `li.line` elements, inside a generous ceiling; one moves the Selected_Pick and asserts the moved Window is in the document inside a generous ceiling (R2.6, R2.10). Record the measured numbers and say in the test that jsdom timing is not phone timing: the number that matters is in `check:browser`.
    - _Requirements: R2.6, R2.10_

  - [x] 3.11 Checkpoint - the screen
    - Ensure all tests pass, ask the user if questions arise.
    - The boundary test of task 1.3 now has a non-empty `src/ui` file set; confirm it passes and reports on the real Code view files.
    - _Requirements: R8.4, R12.9_

- [ ] 4. Bundle, precache, browser checks and docs
  - _Requirements: R8.6, R8.10, R9.2, R9.3, R9.4, R9.5, R9.6, R9.7, R9.8, R9.9, R11.8, R12.5, R12.6, R12.7, R12.9, R12.10, R12.11_

  - [x] 4.1 Parameterise `check_bundle` over chunk markers
    - **[demo-essential]**
    - Files: `scripts/check_bundle.ts`, `tests/ui/deploy.test.ts`.
    - Replace the single `SCAN_ONLY_MARKER` with `CHUNK_MARKERS = [{ name: 'Scan', marker: 'width and height must be positive integers' }, { name: 'Code view', marker: 'naqsha-code-view-listing' }]`, keeping `SCAN_ONLY_MARKER = CHUNK_MARKERS[0].marker` so nothing that imports it breaks. `BundleReport.scanChunks` becomes `markerChunks: Array<{ name: string; file: string; gzippedBytes: number }>`, and the entry-chunk and other-chunk checks loop over `CHUNK_MARKERS`: a marker found in the entry chunk is a problem naming that marker, and a marker found in no other `.js` chunk of `dist/assets` is a problem naming that marker (R9.3). The check prints the file name and gzipped size of every chunk holding a marker (R9.9), and the gzipped entry chunk must stay below 204,800 bytes with this feature built (R9.2).
    - `tests/ui/deploy.test.ts` reads `problems`, not `scanChunks`, so it needs no change for the rename; add an assertion that both markers are in the list and that each is found in exactly one non-entry chunk.
    - Run `npm run build` then `npm run check-bundle` and report the real numbers.
    - _Requirements: R9.2, R9.3, R9.9_

  - [x] 4.2 The precache test for the Code view chunk
    - **[demo-essential]**
    - Files: `tests/scripts/precache.test.ts`.
    - Identify the Code view chunk as the `.js` file of `dist/assets` containing `naqsha-code-view-listing`, and assert that an entry of the generated precache list in `dist/sw.js` names that file; fail naming the chunk it looked for (R9.6). `scripts/build_precache.ts` needs no change, because it lists every file of `dist/` — confirm that in the test and that the list omits no file of the Built_Site and names no file that is not one (R9.5).
    - _Requirements: R9.5, R9.6_

  - [x] 4.3 `check:browser`: the offline Code view checks and the width sweep
    - **[demo-essential]**
    - Files: `scripts/check_browser.ts`.
    - Add `'code'` to the `SCREENS` constant, so step 12 measures the Code view screen at 320, 390 and 1280 CSS pixels and fails if the document is wider than the viewport at any of them (R11.8).
    - Step 13 gains one check named `the first Code view open works offline`, in **both** group A (offline, no reload) and group B (offline, then reload), by one shared function: assert `document.getElementById('naqsha-code-view-listing')` is absent, so this is the first open of Code view in the page session; choose the Diamond sample on Weave so the pick count is known from `generateSample`; click the Code navigation control; wait for the listing element, which with Chrome offline and the preview server stopped can only have come from the Precache; assert the screen shows `codeview.pickCount` with that sample's pick count and that the number of `li.line` elements is at most `WINDOW_SIZE`; read the `data-pick` of the `li` with `aria-current="true"`, assert it is `0`, click the step forward control once, and assert it is then `1` (R9.7). Add the check to group B's `afterReload` name list, so a reload that failed reports it `not-run` rather than passed; `decideOffline` already refuses to count a `not-run` check as a pass (R9.8).
    - Run `npm run check:browser` and report the real step 12 and step 13 output. Do not weaken what the step asserts; if something does not work offline, report exactly what fails.
    - _Requirements: R9.7, R9.8, R11.8_

  - [x] 4.4 The bundle numbers and the documentation
    - **[demo-essential]**
    - Files: `docs/BUILD_LOG.md`, `docs/KIRO_USAGE.md`, `README.md`.
    - `docs/BUILD_LOG.md`: fill in the entry started by task 1.1 with the four byte counts R9.4 names, all measured by `check-bundle` — the gzipped entry chunk **before** this feature (recorded in task 1.1), the gzipped entry chunk **after**, the gzipped size of the Code view chunk, and the 204,800-byte limit. Add what was built, the measured 2,000 × 2,000 diff time from task 1.21, the listing timings from task 3.10, every existing Weave test changed by task 2.1, any cuttable task dropped, and the manual checks left open. Confirm that `package.json` `dependencies` holds exactly the entries it held before this feature (R8.10).
    - `docs/KIRO_USAGE.md`: an entry for Code view, the `src/codec-view` module, the boundary test and the parameterised bundle check. Only what is true, each statement checked against the repo or a real run; anything unverified marked as such.
    - `README.md`: one line describing Code view — a naksha read as one line of bits per pick, stepped through with breakpoints, and diffed against a saved design with a plain-text export.
    - Regenerate `docs/HINDI_REVIEW.md` so the unreviewed Code view strings are listed.
    - _Requirements: R8.10, R9.4_

  - [~] 4.5 Final checkpoint
    - Ensure all tests pass, ask the user if questions arise.
    - Run `npm run test:run`, `npm run typecheck`, `npm run build`, `npm run check-bundle` and `npm run check:all`, and report the exact output of every failure. Zero typecheck errors with `"strict": true`, and no `any`, `as any`, `@ts-ignore` or `@ts-expect-error` anywhere in the feature (R8.6).
    - Confirm all eight demo-essential properties exist and pass: P1, P2, P3, P4, P5, P6, P7, P10 (R12.5). Name every cuttable task that was dropped and what it leaves unchecked (R12.7).
    - For every property that failed during this feature: report the shrunk counterexample with its `seed` and `path`, say whether the code or the property was wrong (R12.6), and keep each fixed counterexample as a permanent regression case through that property's `examples` option (R12.10). A property was never weakened to make a test pass, and any change that reduced what a property covers was stated and agreed with the user first (R12.11).
    - _Requirements: R8.6, R8.10, R12.5, R12.6, R12.7, R12.9, R12.10, R12.11_

## Notes

- **Order.** Task 1.1 runs before every other task, because the "before" entry-chunk number cannot be measured once a file of this feature exists. Phase 1 touches no file in `src/ui`; Phase 2 touches no file in `src/codec-view`.
- **Tasks that share a file run in separate waves.** `src/codec-view/diff.ts` and `tests/codec-view/diff.test.ts` are shared by tasks 1.9 to 1.11 and 1.13 to 1.18; `src/ui/state/codeView.ts` by 2.4 to 2.7; `tests/ui/screens/code.test.tsx` by 3.1 to 3.10. Those chains are sequential by necessity, not by choice.
- **`index.ts` is written once,** complete, in task 1.2. No later task edits it.
- **Constants at the design's values.** `WINDOW_SIZE = 80` (R2.5 allows 40 to 200), `WINDOW_MARGIN = 10`, `DIFF_PICK_LIMIT = 2000` (R6.12's minimum).
- **Existing tests change in task 2.1:** `tests/ui/state/playback.test.ts`, `tests/ui/state/cloth.test.ts`, `tests/ui/screens/weave.test.tsx` and `tests/ui/screens/weaveWiring.test.ts`, because `AppState.selectedPick` replaces the Weave_Screen's own pick value and `PlaybackState` keeps only its status. That is the price of R4.2's one value. No assertion about Weave behaviour is dropped.
- **Demo-essential path.** 1.2, 1.4, 1.5, 1.6, 1.9, 1.10, 1.11, 1.12 and the properties 1.7, 1.8, 1.13 to 1.18, 1.20; then 2.1, 2.2, 2.3, 2.4, 2.5, 2.6; then 3.1 to 3.8; then 4.1 to 4.4. That chain is the demo: the bit-row listing, the step-through with breakpoints, the diff with its plain-text export, and the bundle, precache, browser and documentation work that ships them.
- **Cuttable.** 1.1, 1.3, 1.19 (P8), 2.7, 2.8 (P9), 2.9 (the reducer property), 3.9 (R4.7) and 3.10. Phase 4 is not cuttable: the bundle, precache and browser checks and the documentation are all demo-essential. Dropping any cuttable task is reported to the user with what it leaves unchecked. Nothing on this list is a round trip or a failure path: P2 and P4 are the round trips and P10 is the failure path, and all three are demo-essential.
- **Not covered by any task.** The phone timings: the 100 to 300 ms estimate for a 2,000 × 2,000 diff, and R2.10's 1,000 ms and 100 ms on real hardware, are unmeasured on a phone. Only the development-machine numbers are measured. The Hindi wording stays unreviewed until a native speaker marks it so.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.6"] },
    { "id": 3, "tasks": ["1.5"] },
    { "id": 4, "tasks": ["1.7", "1.9"] },
    { "id": 5, "tasks": ["1.8", "1.10"] },
    { "id": 6, "tasks": ["1.11", "1.12"] },
    { "id": 7, "tasks": ["1.13", "1.19", "1.20"] },
    { "id": 8, "tasks": ["1.14"] },
    { "id": 9, "tasks": ["1.15"] },
    { "id": 10, "tasks": ["1.16"] },
    { "id": 11, "tasks": ["1.17"] },
    { "id": 12, "tasks": ["1.18"] },
    { "id": 13, "tasks": ["1.21"] },
    { "id": 14, "tasks": ["2.1", "2.3", "2.4"] },
    { "id": 15, "tasks": ["2.2", "2.5"] },
    { "id": 16, "tasks": ["2.6"] },
    { "id": 17, "tasks": ["2.7"] },
    { "id": 18, "tasks": ["2.8"] },
    { "id": 19, "tasks": ["2.9"] },
    { "id": 20, "tasks": ["2.10"] },
    { "id": 21, "tasks": ["3.1"] },
    { "id": 22, "tasks": ["3.2"] },
    { "id": 23, "tasks": ["3.3"] },
    { "id": 24, "tasks": ["3.4"] },
    { "id": 25, "tasks": ["3.5"] },
    { "id": 26, "tasks": ["3.6"] },
    { "id": 27, "tasks": ["3.7"] },
    { "id": 28, "tasks": ["3.8"] },
    { "id": 29, "tasks": ["3.9"] },
    { "id": 30, "tasks": ["3.10"] },
    { "id": 31, "tasks": ["3.11"] },
    { "id": 32, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 33, "tasks": ["4.4"] },
    { "id": 34, "tasks": ["4.5"] }
  ]
}
```
