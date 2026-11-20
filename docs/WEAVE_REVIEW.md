# Weave review

Review of the app work against the weaving glossary, the card layout rules and the property test rule.

## How this was run

**The custom agent `weave-reviewer` was NOT run.** A sub-agent cannot start another custom agent, and this session could not open the Kiro chat to select it. The checklist in `.kiro/agents/weave-reviewer.md` was executed by hand (by one author, in one session) with `git`, `grep`, Node scripts and reading. The Node scripts were throwaway files in /tmp and are not committed. The results below are therefore a manual review, not an output of the agent.

- **Base:** `a9830f0` ("chore(spec): mark exporter phase 3 complete"), the commit before `f2a61a7` ("Add app shared types, test support fakes and ui structure checks (task 1.1)"), the first commit of the app spec. Chosen from `git log --oneline`.
- **Head:** `HEAD` at the time of the review (the working tree had uncommitted spec status files only, under `.kiro/specs`; they are outside the reviewed paths).
- **Diff:** `git diff a9830f0..HEAD -- src scripts tests`: 136 files, 17215 added lines. Only added lines were examined, at their line number in HEAD.
- **Check A (terms):** all added lines of `.ts` and `.tsx` files were scanned for the words row, column, col, thread, hole, cell, horizontal, vertical (and compound forms such as `fooRow`). Hits that become empty after removing glossary-conformant tokens (`hookRows`, `hookColumns`, `hookRow`, `hookColumn`, `pegHoles`, `lacingHoles`, `holeDiameterMm`, `punched hole`, `peg hole`, `lacing hole`, `firstHoleCentre*`, `pitch*`) were not counted: 184 further lines. The remaining 242 lines were classified by regular-expression rules and I checked the lists by reading them; ten were corrected by hand. Words outside this list (for example "line", "grid", "design") were not searched, so a synonym that is not in the list is not found.
- **Check B (layout values):** all added lines of `.ts`, `.tsx` and `.css` files were scanned for 192, 720, 540, 7.5, 22.5, 57, 45.0, "12x16", `hookRows: <number>`, `hookColumns: <number>`, and the numbers 36, 12, 16, 60, 45; each match was read. The scan does not find a layout value that is written in another form (for example a computed 6 * 32).
- **Check C (property tests):** for each export of the three index files, a function-like export is found with the same three regular expressions as `tests/structure/propertyNames.test.ts`; the test files are split at each `it(` or `test(` line, and the function counts as covered when a segment that contains `fc.assert` names it as a whole word.

## Counts

| Check | Real issue | Acceptable | False positive | Total |
|---|---|---|---|---|
| A. Weaving terms (lines) | 7 | 155 | 80 | 242 |
| B. Hard-coded layout (entries, some cover several lines) | 7 | 13 | 3 | 23 |
| C. Exported functions with no property test naming them | 1 (downloadBmp) | | | 33 functions checked |

Real issues in A: 7 lines in 4 places (src/ui/state/scan.ts:162,164; scripts/time_read_card.ts:68; tests/ui/printable/download.test.ts:43,57,59; tests/ui/screens/scan.test.tsx:287).
Real issues in B: 4 entries (scripts/check_browser.ts:612, 613, 615, 667) and 3 of low weight (scripts/checks/manualSteps.ts:50, 52; tests/ui/screens/liveCamera.test.tsx:252). Listed as 7 entries below.
Real issue in C: `downloadBmp` (src/exporter/download.ts).

## Check A: weaving terms

The classification is mine. "Acceptable" means the word matches how card-geometry.md and the profile name it (hook row, hook column), is a plain user-facing word, or has no glossary term. "False positive" means the word is not about the weave (UI list rows, CSS, database rows, page scroll, markdown cells, motif tiles).

| file:line | text | verdict | reason |
|---|---|---|---|
| scripts/check_browser.ts:501 | `expect(list.includes(place) && list.includes(format(EN['keep.list.picks']!, { count: picks })), 'the list row lacks the place or "${picks} picks":\n${` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| scripts/check_browser.ts:514 | `expect(list.includes(saved.place), 'after the reload the row lost its place:\n${list}');` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| scripts/check_browser.ts:647 | `for (let row = 0; row < hookRows; row++) {` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| scripts/check_browser.ts:648 | `for (let column = 0; column < hookColumns; column++) {` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| scripts/check_browser.ts:649 | `const read = shapes[row * hookColumns + column] === 'filled';` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| scripts/check_browser.ts:650 | `if (read !== expected[row]![column]) wrong.push('row ${row + 1} column ${column + 1} read ${read ? 'punched' : 'unpunched'}');` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| scripts/check_browser.ts:692 | `name: 'no horizontal scroll at 320, 390 and 1280 px',` | false positive | page scrolling direction, not weaving |
| scripts/checks/bmpHeader.ts:53 | `* The size of an uncompressed BMP with a colour table, from the format alone: rows padded to 4 bytes,` | acceptable | row of the BMP file format (one pixel row is one pick; the file format defines rows) |
| scripts/checks/bmpHeader.ts:58 | `const paddedRow = Math.ceil(rowBytes / 4) * 4;` | acceptable | row of the BMP file format (one pixel row is one pick; the file format defines rows) |
| scripts/checks/bmpHeader.ts:60 | `return HEADERS_BYTES + 4 * entries + paddedRow * height;` | acceptable | row of the BMP file format (one pixel row is one pick; the file format defines rows) |
| scripts/checks/manualResults.ts:52 | `/** One line: the note is reduced to a single line and "\|" is escaped so the table row stays whole. */` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| scripts/checks/manualSteps.ts:68 | `'Reading a real photo (not a generated fixture) fails or gives wrong holes, or tap correction does not work on a touch screen. Write how many marks we` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| scripts/checks/manualSteps.ts:150 | `failMeans: 'The hole detection budget in tech.md is missed on a real phone. Write the measured time in the note.',` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| scripts/checks/manualSteps.ts:154 | `title: 'No horizontal page scroll from 320 to 1920 CSS pixels (R14.12)',` | false positive | page scrolling direction, not weaving |
| scripts/checks/manualSteps.ts:156 | `"**14.12 No horizontal page scroll from 320 to 1920 CSS pixels.** Open the deployed site in a desktop browser, open the device toolbar, set the width ` | false positive | page scrolling direction, not weaving |
| scripts/checks/manualSteps.ts:157 | `expected: 'No horizontal scrollbar and no clipped control at any width, in English and Hindi.',` | false positive | page scrolling direction, not weaving |
| scripts/checks/summary.ts:87 | `/** A markdown-style table with a header, a separator and one row per result, then a totals line. */` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| scripts/time_read_card.ts:68 | `const matches = first.grid.every((row, r) => row.every((cell, c) => cell === card[r]![c]));` | real issue | real issue (minor): `cell` names a punched hole value; use punched |
| src/codec/types.ts:44 | `\| 'wrong-ends-length' \| 'holes-overlap';` | acceptable | ViolationKind or message name covering punched, peg and lacing holes together; the glossary has no word for "any hole" (a glossary gap, see Notes) |
| src/codec/validateCardProfile.ts:41 | `horizontalPitchMm: number;` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:42 | `verticalPitchMm: number;` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:78 | `x: grid!.firstHoleCentreMm.x + hookColumn * grid!.horizontalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:79 | `y: grid!.firstHoleCentreMm.y + hookRow * grid!.verticalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:83 | `// Hook against hook: the nearest pairs of a regular grid are horizontal or vertical neighbours.` | acceptable | refers to a glossary hole kind in the same line |
| src/codec/validateCardProfile.ts:91 | `if (grid.hookColumns >= 2) addNeighbours(grid.horizontalPitchMm, hookDisc(0, 1));` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:92 | `if (grid.hookRows >= 2) addNeighbours(grid.verticalPitchMm, hookDisc(1, 0));` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:109 | `// Lacing against lacing: sweep in x order. All lacing holes have one radius, so a hole only needs the holes` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| src/codec/validateCardProfile.ts:126 | `// Peg or lacing hole against the hook grid: test only the grid cells within reach of the disc.` | acceptable | refers to a glossary hole kind in the same line |
| src/codec/validateCardProfile.ts:136 | `const [firstColumn, lastColumn] = cellRange(disc.centre.x, grid.firstHoleCentreMm.x, grid.horizontalPitchMm, grid.hookColumns);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:137 | `const [firstRow, lastRow] = cellRange(disc.centre.y, grid.firstHoleCentreMm.y, grid.verticalPitchMm, grid.hookRows);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:138 | `for (let hookRow = firstRow; hookRow <= lastRow && remaining > 0; hookRow++) {` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/codec/validateCardProfile.ts:139 | `for (let hookColumn = firstColumn; hookColumn <= lastColumn && remaining > 0; hookColumn++) {` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/codec/validateCardProfile.ts:452 | `// Rule 9: no two holes may overlap or touch (R2.11).` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| src/codec/validateCardProfile.ts:466 | `horizontalPitchMm !== undefined &&` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:467 | `verticalPitchMm !== undefined &&` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:469 | `? { hookRows, hookColumns, holeDiameterMm, horizontalPitchMm, verticalPitchMm, firstHoleCentreMm }` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/codec/validateCardProfile.ts:480 | `kind: 'holes-overlap',` | acceptable | ViolationKind or message name covering punched, peg and lacing holes together; the glossary has no word for "any hole" (a glossary gap, see Notes) |
| src/codec/validateCardProfile.ts:482 | `message: 'The holes ${overlap.first} and ${overlap.second} overlap or touch: their centres are ${overlap.distanceMm} mm apart and their radii add up t` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| src/ui/i18n/reviewList.ts:10 | `function cell(text: string): string {` | false positive | a motif tile or markdown table cell, not a card position |
| src/ui/i18n/reviewList.ts:27 | `for (const entry of entries) lines.push('\| \'${cell(entry.key)}\' \| ${cell(entry.hi)} \| ${cell(entry.en)} \|');` | false positive | a motif tile or markdown table cell, not a card position |
| src/ui/printable/layout.ts:9 | `hookMarks: HookMark[]; // hookRows * hookColumns, row by row` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/printable/layout.ts:20 | `x: profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/ui/printable/layout.ts:21 | `y: profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/ui/printable/style.ts:3 | `/** Hole ink: the Day loom --hole token. */` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| src/ui/printable/svg.ts:15 | `const hole = rgbHex(HOLE_RGB);` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| src/ui/printable/svg.ts:21 | `'<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(diameterMm / 2)}" fill="${hole}"/>';` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| src/ui/samples/sampleDesigns.ts:15 | `* so the petals stand apart from the centre and from each other. Flowers sit in cells twice as wide as a repeat, and a` | false positive | a motif tile or markdown table cell, not a card position |
| src/ui/samples/sampleDesigns.ts:30 | `* Where an end and a pick sit in the motif. The cloth is made of square threads, so the diamond and the floral are` | acceptable | "thread" for warp and weft together (the cloth thread size control covers both); not used for one of them |
| src/ui/samples/sampleDesigns.ts:31 | `* tiled along the ends in cells that are 'period' ends wide, the same size as one repeat along the picks.` | false positive | a motif tile or markdown table cell, not a card position |
| src/ui/samples/sampleDesigns.ts:32 | `* 'u' and 'v' run from -1 to 1 across a cell; 'floralU' runs from -2 to 2 across a floral cell, which is two repeats` | false positive | a motif tile or markdown table cell, not a card position |
| src/ui/screens/keep/KeepScreen.tsx:17 | `summaryRow,` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:110 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:185 | `rows={3}` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:220 | `const row = summaryRow(summary, profileName, untitled);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:224 | `<p className={styles.itemName}>{row.name}</p>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:226 | `{[row.place, row.date, t('keep.list.picks', { count: row.pickCount })]` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:230 | `{row.profileName === null ? null : (` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:231 | `<p className={styles.itemDetail}>{t('keep.list.profile', { name: row.profileName })}</p>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:233 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:237 | `aria-label={'${t('keep.list.open')}: ${row.name}'}` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:246 | `aria-label={'${t('keep.list.delete')}: ${row.name}'}` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/keep/KeepScreen.tsx:298 | `// Focus follows the action: the saved text after a save, the row's Delete button or the list heading after a confirmation closes.` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/scan/BatchList.tsx:14 | `* holes, peg holes and lacing holes, all from the Card_Profile (R15.6). Unpunched positions get no mark: the` | acceptable | refers to a glossary hole kind in the same line |
| src/ui/screens/scan/BatchList.tsx:15 | `* ring of the printable card is a tenth of a hole wide, which is under a pixel at thumbnail size.` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| src/ui/screens/scan/BatchList.tsx:48 | `const hole = rgbHex(HOLE_RGB);` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| src/ui/screens/scan/BatchList.tsx:50 | `<circle key={key} cx={centreMm.x} cy={centreMm.y} r={diameterMm / 2} fill={hole} />` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| src/ui/screens/scan/BatchList.tsx:94 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/scan/BatchList.tsx:119 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/scan/LiveCamera.tsx:67 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/scan/ScanScreen.tsx:114 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/scan/ScanScreen.tsx:154 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/scan/ScanScreen.tsx:196 | `<div role="group" aria-label={t('scan.zoom.heading')} className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/scan/ScanScreen.tsx:219 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/weave/TryIt.tsx:94 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/weave/TryIt.tsx:126 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/weave/TryIt.tsx:150 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/screens/weave/WeaveScreen.tsx:298 | `<div className={styles.row}>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/state/cloth.ts:16 | `/** Thread size in pixels; fixed because the thread size control is hidden (R2.13). */` | acceptable | "thread" for warp and weft together (the cloth thread size control covers both); not used for one of them |
| src/ui/state/corrections.ts:13 | `const row = grid[hookRow];` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/corrections.ts:14 | `return hookRow >= 0 && row !== undefined && hookColumn >= 0 && hookColumn < row.length;` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/corrections.ts:23 | `return grid.map((row, hookRow) =>` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/corrections.ts:25 | `? row.map((punched, hookColumn) => (hookColumn === position.hookColumn ? !punched : punched))` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/corrections.ts:26 | `: row,` | acceptable | hook row of one card grid |
| src/ui/state/keep.ts:23 | `export type SummaryRow = {` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/state/keep.ts:32 | `export function summaryRow(summary: DesignSummary, currentProfileName: string, untitled: string): SummaryRow {` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| src/ui/state/scan.ts:62 | `const spacingImagePx = Math.min(profile.horizontalPitchMm, profile.verticalPitchMm) * pose.pixelsPerMm;` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| src/ui/state/scan.ts:128 | `/** The marker to focus after an arrow key, Home or End, or null for any other key (R10.8). Hook positions are row-major. */` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:130 | `const row = Math.floor(index / hookColumns);` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:131 | `const column = index % hookColumns;` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:134 | `return column > 0 ? index - 1 : index;` | acceptable | hook column of one card grid |
| src/ui/state/scan.ts:136 | `return column < hookColumns - 1 ? index + 1 : index;` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:138 | `return row > 0 ? index - hookColumns : index;` | acceptable | refers to a glossary hole kind in the same line |
| src/ui/state/scan.ts:140 | `return row < hookRows - 1 ? index + hookColumns : index;` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:142 | `return row * hookColumns;` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:144 | `return row * hookColumns + hookColumns - 1;` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:150 | `/** The accessible name of a marker: its hook row and column (numbered from 1), its state and whether it was changed (R10.4). */` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:153 | `const name = t('scan.marker.name', { row: marker.hookRow + 1, column: marker.hookColumn + 1, state });` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:161 | `for (const row of grid) {` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| src/ui/state/scan.ts:162 | `for (const hole of row) {` | real issue | real issue: `hole` names a boolean that is a punched hole; the glossary term is punchedHole or punched |
| src/ui/state/scan.ts:164 | `if (hole) punched += 1;` | real issue | real issue: `hole` names a boolean that is a punched hole; the glossary term is punchedHole or punched |
| src/ui/theme/contrast.ts:10 | `\| 'hole'` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| src/ui/theme/contrast.ts:25 | `hole: '#1B140C',` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| src/ui/theme/contrast.ts:38 | `hole: '#07061A',` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| src/ui/theme/contrast.ts:68 | `/** Text pairs (4.5) and the focus pairs (3) for both themes. Text on a zari button is ink (day) or hole (night). */` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| src/ui/theme/contrast.ts:69 | `export const TOKEN_PAIRS: ReadonlyArray<TokenPair> = [...pairsFor('day', 'ink'), ...pairsFor('night', 'hole')];` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| tests/archive/idbStore.test.ts:77 | `expect(fake.rows('designs')).toEqual([]);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/archive/idbStore.test.ts:78 | `expect(fake.rows('summaries')).toEqual([]);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/archive/idbStore.test.ts:181 | `expect(fake.rows('designs').length).toBe(ids.length - 1);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/archive/idbStore.test.ts:182 | `expect(fake.rows('summaries').length).toBe(ids.length - 1);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/archive/idbStore.test.ts:202 | `const before = { designs: fake.rows('designs'), summaries: fake.rows('summaries') };` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/archive/idbStore.test.ts:207 | `expect({ designs: fake.rows('designs'), summaries: fake.rows('summaries') }).toEqual(before);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/codec/validateCardProfile.test.ts:78 | `// punched hole diameter. Since R2.11, a peg hole of up to 20 mm would overlap other holes, so the two peg` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:79 | `// holes are moved far from the card (validation does not check where a peg hole lies) and the diameter range` | acceptable | refers to a glossary hole kind in the same line |
| tests/codec/validateCardProfile.test.ts:290 | `describe('R2.11 holes that overlap or touch', () => {` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:292 | `validateCardProfile(candidate).filter((violation) => violation.kind === 'holes-overlap');` | acceptable | ViolationKind or message name covering punched, peg and lacing holes together; the glossary has no word for "any hole" (a glossary gap, see Notes) |
| tests/codec/validateCardProfile.test.ts:296 | `it('R2.11 the demo profile has no overlapping holes', () => {` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:319 | `it('R2.11 a horizontal pitch equal to the hole diameter is reported and one slightly larger is accepted', () => {` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| tests/codec/validateCardProfile.test.ts:320 | `const touching = mutateProfile(demoProfile, ['horizontalPitchMm'], demoProfile.holeDiameterMm);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:322 | `const clear = mutateProfile(demoProfile, ['horizontalPitchMm'], demoProfile.holeDiameterMm + 0.001);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:325 | `it('R2.11 a vertical pitch equal to the hole diameter is reported naming the vertical neighbours', () => {` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| tests/codec/validateCardProfile.test.ts:326 | `const touching = mutateProfile(demoProfile, ['verticalPitchMm'], demoProfile.holeDiameterMm);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:330 | `it('R2.11 a profile with two overlapping or touching holes is reported with both hole names', () => {` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:342 | `// One hole sits at x = 0 so that the offset t * (sum of radii) is stored exactly and the centre distance` | acceptable | "hole" in a geometry comment covering all hole kinds |
| tests/codec/validateCardProfile.test.ts:356 | `candidate = mutateProfile(profile, ['horizontalPitchMm'], t * d);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:365 | `it('R2.11 a profile with a lacing hole moved onto another hole is rejected', () => {` | acceptable | refers to a glossary hole kind in the same line |
| tests/codec/validateCardProfile.test.ts:381 | `x: profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:382 | `y: profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:407 | `horizontalPitchMm: quarter(0.5, 4),` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:408 | `verticalPitchMm: quarter(0.5, 4),` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:422 | `horizontalPitchMm: draft.horizontalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:423 | `verticalPitchMm: draft.verticalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:433 | `const allHoles = (profile: CardProfile): Hole[] => {` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:434 | `const holes: Hole[] = [];` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:435 | `for (let row = 0; row < profile.hookRows; row++) {` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/codec/validateCardProfile.test.ts:436 | `for (let column = 0; column < profile.hookColumns; column++) {` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/codec/validateCardProfile.test.ts:437 | `holes.push({` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:438 | `name: 'hook[${row}][${column}]',` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/codec/validateCardProfile.test.ts:440 | `x: profile.firstHoleCentreMm.x + column * profile.horizontalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:441 | `y: profile.firstHoleCentreMm.y + row * profile.verticalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/codec/validateCardProfile.test.ts:447 | `holes.push({ name: 'lacing[${index}]', hook: false, x: centre.x, y: centre.y, r: profile.lacingHoles.diameterMm / 2 }),` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:450 | `holes.push({ name: 'pegHoles[${index}]', hook: false, x: peg.positionMm.x, y: peg.positionMm.y, r: peg.diameterMm / 2 }),` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:452 | `return holes;` | acceptable | list of all holes (punched, peg, lacing) in a geometry helper |
| tests/codec/validateCardProfile.test.ts:457 | `const holes = allHoles(profile);` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:460 | `for (let i = 0; i < holes.length; i++) {` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:461 | `for (let j = i + 1; j < holes.length; j++) {` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:462 | `const a = holes[i]!;` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:463 | `const b = holes[j]!;` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/codec/validateCardProfile.test.ts:469 | `const reported = validateCardProfile(profile).filter((violation) => violation.kind === 'holes-overlap');` | acceptable | ViolationKind or message name covering punched, peg and lacing holes together; the glossary has no word for "any hole" (a glossary gap, see Notes) |
| tests/integration/scanFixtures.test.ts:96 | `expect(translator(DICTIONARIES, 'en')(readFailureKey(outcome.failure))).toMatch(/alignment holes/);` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| tests/reader/resolution.test.ts:26 | `// Counterexample 2 of the same property (seed -791670624), rebuilt explicitly. Lacing hole x values moved apart after R2.11 (overlapping holes are no` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/reader/resolution.test.ts:27 | `const eightByFive = parseProfile({"name": "generated-profile", "cardWidthMm": 30.306600000000003, "cardHeightMm": 40.5, "hookRows": 8, "hookColumns": ` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/reader/resolution.test.ts:28 | `// A 5.9 px sparse card that the peg hole pair selection read as a wrong grid (measured in task 5.17). The second lacing hole moved from x 16.8972 to ` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/reader/resolution.test.ts:29 | `const nineByNine = parseProfile({"name": "generated-profile", "cardWidthMm": 47.9536, "cardHeightMm": 45.00000000000001, "hookRows": 9, "hookColumns":` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/scripts/bmpHeader.test.ts:19 | `const pattern = Array.from({ length: 36 }, () => profile.endOrder.map((row) => row.map((end) => end % 2 === 0)));` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/scripts/bmpHeader.test.ts:33 | `const pattern = [profile.endOrder.map((row) => row.map(() => true))];` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/scripts/bmpHeader.test.ts:46 | `const exported = exportPatternBmp(profile, [profile.endOrder.map((row) => row.map(() => false))]);` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/scripts/everything.test.ts:119 | `it('R16.7 the summary has one row per stage with its result and exit code', () => {` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/scripts/summary.test.ts:55 | `it('R16.7 without --bail every step runs and the table has one row per step', () => {` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/scripts/summary.test.ts:60 | `const tableRows = formatSummary(results).split('\n').filter((line) => line.startsWith('\|'));` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/scripts/summary.test.ts:61 | `expect(tableRows.length - 2).toBe(steps.length);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/scripts/summary.test.ts:114 | `it('R16.7 table cells stay on one row for any name and detail text', () => {` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/scripts/summary.test.ts:116 | `fc.property(fc.array(fc.tuple(word, fc.string(), statusArb), { maxLength: 8 }), (rows) => {` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/scripts/summary.test.ts:117 | `const results = rows.map(([name, detail, status]): StepResult => ({ name, detail, status }));` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/scripts/summary.test.ts:118 | `const tableRows = formatSummary(results).split('\n').filter((line) => line.startsWith('\|'));` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/scripts/summary.test.ts:119 | `expect(tableRows.length - 2).toBe(rows.length);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:9 | `type StoreData = { keyPath: string; indexes: Set<string>; rows: Map<string, Row> };` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:21 | `/** Copies of the committed rows, by store name. */` | false positive | database rows of a fake store |
| tests/support/fakeIndexedDb.ts:22 | `rows(storeName: string): Row[];` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:77 | `this.work.set(name, { ...data, rows: new Map(data.rows) });` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:154 | `this.tx.data(this.name).rows.set(key, stored);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:165 | `this.tx.data(this.name).rows.delete(key);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:174 | `const row = this.tx.data(this.name).rows.get(key);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:175 | `request.result = row === undefined ? undefined : structuredClone(row);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:184 | `const keys = [...this.tx.data(this.name).rows.keys()].sort();` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:185 | `request.result = keys.map((key) => structuredClone(this.tx.data(this.name).rows.get(key)) as Row);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:194 | `request.result = this.tx.data(this.name).rows.has(key) ? 1 : 0;` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:219 | `const data: StoreData = { keyPath: parameters.keyPath, indexes: new Set(), rows: new Map() };` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:239 | `rows: (storeName) =>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:240 | `[...(databases.get('naqsha-archive')?.stores.get(storeName)?.rows.values() ?? [])].map((row) =>` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/fakeIndexedDb.ts:241 | `structuredClone(row),` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/support/profiles.ts:25 | `* Minimum clear gap between the edges of any two holes, as a fraction of the punched hole diameter (R2.11 only` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| tests/support/profiles.ts:26 | `* rejects overlapping or touching holes; the generator keeps a margin so a printed card reads reliably).` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/support/profiles.ts:76 | `const horizontalPitchMm = Math.max(draft.horizontalPitchMm, minCentreSpacingMm);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/support/profiles.ts:77 | `const verticalPitchMm = Math.max(draft.verticalPitchMm, minCentreSpacingMm);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/support/profiles.ts:85 | `const gridRightMm = firstHoleX + (draft.hookColumns - 1) * horizontalPitchMm + holeRadiusMm;` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/support/profiles.ts:86 | `const gridBottomMm = firstHoleY + (draft.hookRows - 1) * verticalPitchMm + holeRadiusMm;` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/support/profiles.ts:109 | `horizontalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/support/profiles.ts:110 | `verticalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/support/profiles.ts:164 | `/** Valid profiles: 2 to 10 hook rows, 2 to 12 hook columns, pitches 2.5 to 4 mm, a permuted endOrder. */` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/i18n/failureKeys.test.ts:22 | `kind: fc.constantFrom('missing-field', 'hole-outside-card', 'wrong-hook-row-count', 'not-a-boolean'),` | acceptable | ViolationKind or message name covering punched, peg and lacing holes together; the glossary has no word for "any hole" (a glossary gap, see Notes) |
| tests/ui/i18n/failureKeys.test.ts:127 | `expect(text('peg-holes-not-found', false)).toMatch(/alignment holes were not found.*whole card.*plain background/i);` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| tests/ui/printable/download.test.ts:43 | `/** Grids of the wrong size or with a cell that is not a boolean, for a profile. */` | real issue | real issue (minor): `cell` for a punched hole value or a hook position |
| tests/ui/printable/download.test.ts:49 | `.filter(([rows, columns]) => rows !== hookRows \|\| columns !== hookColumns)` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/printable/download.test.ts:50 | `.map(([rows, columns]) => emptyGrid(rows, columns)),` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/printable/download.test.ts:57 | `.map(([row, column, cell]) => {` | real issue | real issue (minor): `cell` for a punched hole value or a hook position |
| tests/ui/printable/download.test.ts:59 | `grid[row]![column] = cell;` | real issue | real issue (minor): `cell` for a punched hole value or a hook position |
| tests/ui/printable/layout.test.ts:13 | `it('hookCentreMm of the demo profile follows the first hole centre and the pitches', () => {` | acceptable | refers to a glossary hole kind in the same line |
| tests/ui/printable/layout.test.ts:17 | `expect(centre.x).toBeCloseTo(profile.firstHoleCentreMm.x + 3 * profile.horizontalPitchMm);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/ui/printable/layout.test.ts:18 | `expect(centre.y).toBeCloseTo(profile.firstHoleCentreMm.y + 2 * profile.verticalPitchMm);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/ui/printable/layout.test.ts:37 | `expect(mark.centreMm.x).toBeCloseTo(profile.firstHoleCentreMm.x + mark.hookColumn * profile.horizontalPitchMm, 9);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/ui/printable/layout.test.ts:38 | `expect(mark.centreMm.y).toBeCloseTo(profile.firstHoleCentreMm.y + mark.hookRow * profile.verticalPitchMm, 9);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/ui/printable/layout.test.ts:43 | `expect(layout.lacingHoles.map((hole) => hole.centreMm)).toEqual(profile.lacingHoles.positionsMm);` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/ui/printable/layout.test.ts:44 | `expect(layout.lacingHoles.map((hole) => hole.diameterMm)).toEqual(` | acceptable | geometry check over all hole kinds (punched, peg, lacing); no glossary term for "any hole" |
| tests/ui/printable/layout.test.ts:52 | `const grid = Array.from({ length: profile.hookRows }, (_, row) =>` | acceptable | hook row index of one card grid |
| tests/ui/printable/layout.test.ts:53 | `Array.from({ length: profile.hookColumns }, (_, column) => (row + column) % 2 === 0),` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/printable/layout.test.ts:95 | `// Invalid grid: one row too few.` | acceptable | "row" for a hook row of one card grid |
| tests/ui/printable/raster.test.ts:13 | `/** Resolutions that give a hole diameter above the reader minimum, with 10% to spare. */` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| tests/ui/printable/raster.test.ts:23 | `it('R21.4 the raster has manila stock, hole ink at punched hooks, peg holes and lacing holes, and a different ring at unpunched hooks', () => {` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| tests/ui/printable/raster.test.ts:25 | `const grid = Array.from({ length: profile.hookRows }, (_, row) =>` | acceptable | hook row index of one card grid |
| tests/ui/printable/raster.test.ts:26 | `Array.from({ length: profile.hookColumns }, (_, column) => (row + column) % 2 === 0),` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/printable/raster.test.ts:40 | `const x = profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm;` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/ui/printable/raster.test.ts:41 | `const y = profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm;` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/ui/printable/sameLayout.test.ts:50 | `// The raster has the size of the layout, hole ink at every ink disc and stock inside every ring.` | acceptable | colour token named hole (the ink of a punched, peg or lacing hole in the design tokens) |
| tests/ui/printable/sameLayout.test.ts:72 | `expect(read(name), name).not.toMatch(/firstHoleCentreMm\|horizontalPitchMm\|verticalPitchMm/);` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/ui/printable/svg.test.ts:17 | `const grid = Array.from({ length: profile.hookRows }, (_, row) =>` | acceptable | hook row index of one card grid |
| tests/ui/printable/svg.test.ts:18 | `Array.from({ length: profile.hookColumns }, (_, column) => (row + column) % 2 === 0),` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/screens/cardDrawing.test.tsx:10 | `it('R15.6 a card thumbnail in the batch list has round holes, peg holes and lacing holes from the Card_Profile', () => {` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| tests/ui/screens/cardDrawing.test.tsx:19 | `it('R15.6 a thumbnail draws one round hole per punched hook, peg hole and lacing hole for any Card_Profile and grid', () => {` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| tests/ui/screens/keep.test.tsx:217 | `it('R7.6 R22.12 a row shows name, place, date, pick count, and the profile name only when it differs', () => {` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/screens/keep.test.tsx:251 | `it('R7.8 a delete request shows the confirmation for that row only', () => {` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/screens/scan.test.tsx:151 | `expect(peg).toContain('two large alignment holes');` | acceptable | user-facing wording or tech.md term ("hole detection"); plain words for low-literacy users |
| tests/ui/screens/scan.test.tsx:287 | `it('R10.6 toggling keeps the grid size and changes one cell', () => {` | real issue | real issue (minor): `cell` for a punched hole value or a hook position |
| tests/ui/screens/weave.test.tsx:32 | `it('R3.8 thread size, float highlight and the other preview controls are absent', () => {` | acceptable | "thread" for warp and weft together (the cloth thread size control covers both); not used for one of them |
| tests/ui/screens/weave.test.tsx:34 | `for (const word of ['thread size', 'Thread size', 'float', 'Float', 'highlight', 'Highlight']) {` | acceptable | "thread" for warp and weft together (the cloth thread size control covers both); not used for one of them |
| tests/ui/screens/weave.test.tsx:53 | `it('R3.8 the screen has only the controls of Requirements 2 and 3: no number entry, no thread size, no float highlight', () => {` | acceptable | "thread" for warp and weft together (the cloth thread size control covers both); not used for one of them |
| tests/ui/screens/weave.test.tsx:72 | `expect(en).not.toMatch(/picks per second\|thread size\|float\|highlight/i);` | acceptable | "thread" for warp and weft together (the cloth thread size control covers both); not used for one of them |
| tests/ui/state/appState.test.ts:61 | `const sample = [grid.map((row) => row.map(() => false))];` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/state/appState.test.ts:113 | `const off = on.map((row) => row.map(() => false));` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/state/corrections.test.ts:101 | `x: profile.firstHoleCentreMm.x + marker.hookColumn * profile.horizontalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/ui/state/corrections.test.ts:102 | `y: profile.firstHoleCentreMm.y + marker.hookRow * profile.verticalPitchMm,` | acceptable | profile field name from card-geometry.md (a direction on the card, not a weave direction) |
| tests/ui/state/corrections.test.ts:131 | `grid.forEach((row, hookRow) =>` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/state/corrections.test.ts:132 | `row.forEach((punched, hookColumn) => {` | acceptable | a hook row or hook column of one card grid (card-geometry.md and the profile use hookRows and hookColumns); local names row and column are shortened forms |
| tests/ui/state/keep.test.ts:16 | `summaryRow,` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/state/keep.test.ts:178 | `it('R7.6 and R22.12 a list row shows name, place, date and pick count, and the profile name only when it differs', () => {` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/state/keep.test.ts:179 | `// Feature: app, Property 21: List rows show the required fields and a differing profile name` | false positive | rows of the saved design list |
| tests/ui/state/keep.test.ts:190 | `const row = summaryRow(design, current, 'untitled');` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/state/keep.test.ts:192 | `expect(row.name).toBe(trimmed === '' ? 'untitled' : trimmed);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/state/keep.test.ts:193 | `expect(row.place).toBe(design.metadata.place);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/state/keep.test.ts:194 | `expect(row.date).toBe(design.metadata.date);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/state/keep.test.ts:195 | `expect(row.pickCount).toBe(design.pickCount);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/state/keep.test.ts:196 | `if (design.profileName === current) expect(row.profileName).toBeNull();` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |
| tests/ui/state/keep.test.ts:197 | `else expect(row.profileName).toBe(design.profileName);` | false positive | a row of a UI list, table, CSS layout class or fake database store, not a row of a weave |

### Notes on A

- The 7 real issues are small: `hole` and `cell` used as the name of a punched hole value. None changes behaviour.
- The glossary has no word for "any hole" (punched, peg or lacing). Code uses "holes" for the three together in `holes-overlap` (src/codec/types.ts:44), validateCardProfile.ts messages and helpers. This is a glossary gap and is not counted as an error.
- `row` and `column` as local names for a hook row and hook column of one card are used throughout. They follow `hookRows` and `hookColumns` of the profile. Where they are not prefixed with "hook" a stricter reviewer could ask for `hookRow` and `hookColumn`; I counted them acceptable.
- `thread` appears for "thread size" and "square threads", meaning warp and weft together. I counted these acceptable; they would be real issues if they meant only one of the two.
- `check_browser.ts:647-650` computes an end index as `row * hookColumns + column`. That is not a word issue; card-geometry.md rule 5 says the end index must come from `endOrder`, never from a formula. I did not count it in A or B because it is a different rule, but it is a finding against that rule (the demo profile is row-major, so the result is correct for it).

## Check B: hard-coded card layout values

| file:line | text | verdict | reason |
|---|---|---|---|
| scripts/check_browser.ts:612 | `const widthPx = Math.round(profile.cardWidthMm * 12);` | real issue | 12 pixels per millimetre written again; the value is `DEFAULT_PIXELS_PER_MM` in src/ui/printable/raster.ts, which the script does not import. |
| scripts/check_browser.ts:613 | `const heightPx = Math.round(profile.cardHeightMm * 12);` | real issue | Same as line 612. |
| scripts/check_browser.ts:615 | `if (info.width !== 720 \|\| info.height !== 540) problems.push(`size is ...expected 720x540`);` | real issue | Expected pixel size written as the demo card size; the line above computes `widthPx` and `heightPx` from the profile and the check should compare with those. |
| scripts/check_browser.ts:616 | `if (widthPx !== 720 \|\| heightPx !== 540) problems.push(`profile gives ... not 720x540`);` | acceptable | A deliberate pin that the demo profile gives 720x540 at 12 px/mm; it fails if the profile file changes. It is the demo profile check, not a generic claim. |
| scripts/check_browser.ts:667 | `encodePngRgba(720, 540, new Uint8Array(720 * 540 * 4).fill(255))` | real issue | Blank image of the demo card size; should come from the profile (cardWidthMm x pixels per millimetre). |
| scripts/checks/manualSteps.ts:50 | `'4. Expect 60 mm by 45 mm. Allow a ruler reading error of about 1 mm.'` | real issue (low) | Demo card size in the instruction text. It goes stale when the profile changes. Fixed text for a person, not code that computes with it. |
| scripts/checks/manualSteps.ts:52 | `expected: 'The printed card measures 60 mm x 45 mm.'` | real issue (low) | Same as line 50. |
| tests/ui/screens/liveCamera.test.tsx:252 | `aspectRatio: 60 / 45` | real issue (low) | Demo card width and height written as a ratio; should be `profile.cardWidthMm / profile.cardHeightMm`. |
| tests/scripts/manualSteps.test.ts:52-55 | `expect(text).toContain('60 mm by 45 mm')` | acceptable | Test that pins the text of the manual step (see manualSteps.ts:50). It would change together with that text. |
| tests/scripts/bmpHeader.test.ts:17-50 (lines 17, 19, 26, 28, 38, 39, 50) | `192 ends, 36 picks in titles and expectations` | acceptable | The test is titled as an export of the demo profile, which it reads from public/profiles. Line 19 builds 36 picks and the expectations repeat 192 and 36; they could be `profile.hookRows * profile.hookColumns` and the pick count, so this is a candidate for a later clean-up. |
| tests/scripts/bmpHeader.test.ts:96-100 | `blankPngFor(720, 540) and width: 720, height: 540` | acceptable | Fixture image of the demo card size with its own header expectation; both sides are the same literal, so a profile change does not make it fail wrongly. |
| tests/ui/printable/raster.test.ts:62-64 | `720, 540, 720 * 540 * 4` | acceptable | Title says "the demo card at 12 pixels per millimetre is 720 by 540": a demo profile pin. |
| tests/ui/printable/raster.test.ts:28,33,59,69 and tests/ui/printable/sameLayout.test.ts:12 | `12 pixels per millimetre` | acceptable | Render scale, not card layout. |
| tests/ui/printable/svg.test.ts:23,41 | `width="60" height="45", viewBox="0 0 60 45"` | acceptable | Title says "the demo card is 60 mm by 45 mm": a demo profile pin. |
| tests/ui/printable/png.test.ts:110, download.test.ts:116 | `12 * 1000, 12000` | acceptable | Pixel density for 12 px/mm, render scale. |
| tests/scripts/pickWatch.test.ts:21-37 | `total: 36, max: 36` | acceptable | Totals of a pick counter used as plain numbers; no profile is involved. (36 equals the demo sample pick count.) |
| tests/ui/state/playback.test.ts:30,31 and src/ui/state/playback.ts:34 | `Pick 3 of 36` | acceptable | Example number in a test or in a comment. |
| tests/reader/resolution.test.ts:27,29 | `profile JSON with "hookRows": 8, "hookColumns": 5 and 9 x 9` | acceptable | Profile data rebuilt from a recorded counterexample; it is the profile. |
| scripts/checks/deployed.ts:12, src/ui/profile/profileUrl.ts:3, scripts/check_browser.ts:358,751, scripts/time_read_card.ts:34, tests/scripts/deployed.test.ts, tests/ui/deploy.test.ts, tests/ui/profile/loadProfile.test.ts, tests/support/profiles.ts:173-175 | `the file name demo-12x16.json` | acceptable | A path to the profile file, not a layout value. Naming the demo profile by its dimensions is a pre-existing choice. |
| src/ui/printable/raster.ts:8 | `DEFAULT_PIXELS_PER_MM = 12` | acceptable | Render scale constant, not card layout. |
| scripts/time_read_card.ts:28,40 | `1920 x 1080` | false positive | Camera frame size for the timing budget, not the card. |
| tests/ui/screens/weaveWiring.test.ts:23 | `buildReadyCloth(..., 320, 192)` | false positive | Viewport width and height in pixels. |
| other matches of 12, 16, 36, 45, 60 (PNG chunk offsets, byte lengths, secret patterns, maximum array lengths, R-numbers such as R2.12, CSS percentages, MAX_ZOOM, SPEEDS) | `` | false positive | Not card layout. |

## Check C: exported functions and property tests

What the existing structure test checks (`tests/structure/propertyNames.test.ts`, the last test): it lists every exported function of src/codec, src/reader, src/simulator and src/exporter that matches one of three patterns (`export function`, `export const x = (…) =>`, `export const x = function`), removes four names in `EXCLUDED_FROM_COVERAGE` (`loadPixelData`, `paintToCanvas`, `browserScheduler`, `downloadBmp`), and requires each remaining name to appear as a whole word in at least one test file that contains the text `fc.assert` anywhere. It does not require the name to be inside the property test. This review used a stricter check: the name must appear in the same `it(...)` as an `fc.assert`.

Exported functions of the three index files (`export *` files were followed to their source files; `browserScheduler` is an object with two methods, listed with the functions):

| module | function | source | named in a file with fc.assert (existing check) | named in the same test as fc.assert (this review) | example test using it as property |
|---|---|---|---|---|---|
| codec | validateCardProfile | src/codec/validateCardProfile.ts | yes | yes | tests/codec/validateCardProfile.test.ts |
| codec | parseCardProfile | src/codec/validateCardProfile.ts | yes | yes | tests/codec/validateCardProfile.test.ts |
| codec | validateCardGrid | src/codec/validateCardGrid.ts | yes | yes | tests/codec/endsCodec.test.ts |
| codec | endsPerPick | src/codec/endsCodec.ts | yes | yes | tests/codec/endsCodec.test.ts |
| codec | encodeCardGrid | src/codec/endsCodec.ts | yes | yes | tests/codec/endsCodec.test.ts |
| codec | decodeEnds | src/codec/endsCodec.ts | yes | yes | tests/codec/endsCodec.test.ts |
| exporter | parseExportOptions | src/exporter/options.ts | yes | yes | tests/exporter/options.test.ts |
| exporter | bmpLayout | src/exporter/layout.ts | yes | yes | tests/exporter/exportBmp.test.ts |
| exporter | exportPatternBmp | src/exporter/exportBmp.ts | yes | yes | tests/exporter/exportBmp.test.ts |
| exporter | readPatternBmp | src/exporter/readBmp.ts | yes | yes | tests/exporter/exportBmp.test.ts |
| exporter | bmpFileName | src/exporter/download.ts | yes | yes | tests/exporter/download.test.ts |
| exporter | downloadBmp | src/exporter/download.ts | yes | **no** | tests/exporter/download.test.ts (examples only) |
| simulator | isPreparedCloth | src/simulator/prepare.ts | yes | yes | tests/simulator/prepare.test.ts |
| simulator | prepareCloth | src/simulator/prepare.ts | yes | yes | tests/simulator/floats.test.ts |
| simulator | parseColour | src/simulator/settings.ts | yes | yes | tests/simulator/render.test.ts |
| simulator | parseRenderSettings | src/simulator/settings.ts | yes | yes | tests/simulator/prepare.test.ts |
| simulator | blendHalfway | src/simulator/style.ts | yes | yes | tests/simulator/style.test.ts |
| simulator | positiveModulo | src/simulator/style.ts | yes | yes | tests/simulator/style.test.ts |
| simulator | isSlashInk | src/simulator/style.ts | yes | yes | tests/simulator/style.test.ts |
| simulator | isCrossInk | src/simulator/style.ts | yes | yes | tests/simulator/style.test.ts |
| simulator | shadeTable | src/simulator/style.ts | yes | yes | tests/simulator/render.test.ts |
| simulator | shadeChannel | src/simulator/style.ts | yes | yes | tests/simulator/style.test.ts |
| simulator | packRgb | src/simulator/style.ts | yes | yes | tests/simulator/style.test.ts |
| simulator | packRaised | src/simulator/style.ts | yes | yes | tests/simulator/style.test.ts |
| simulator | packShaded | src/simulator/style.ts | yes | yes | tests/simulator/style.test.ts |
| simulator | renderFrame | src/simulator/render.ts | yes | yes | tests/simulator/prepare.test.ts |
| simulator | floatLengthAt | src/simulator/floats.ts | yes | yes | tests/simulator/floats.test.ts |
| simulator | computeFloats | src/simulator/floats.ts | yes | yes | tests/simulator/floats.test.ts |
| simulator | framesForPick | src/simulator/frames.ts | yes | yes | tests/simulator/frames.test.ts |
| simulator | frameAt | src/simulator/frames.ts | yes | yes | tests/simulator/frames.test.ts |
| simulator | createPlayer | src/simulator/player.ts | yes | yes | tests/simulator/player.test.ts |
| simulator | paintToCanvas | src/simulator/canvas.ts | yes | yes | tests/simulator/canvas.test.ts |
| simulator | browserScheduler (object with request and cancel) | src/simulator/canvas.ts | yes | yes | tests/simulator/canvas.test.ts ("R10.3 for any timestamp, the callback receives exactly that timestamp") |

Result: 33 functions checked. 32 of the 33 are named inside a test that calls `fc.assert`. **`downloadBmp` is not**: tests/exporter/download.test.ts uses it only in three example tests (lines 42, 81, 99), and the property test in that file (line 18) covers `bmpFileName`. The structure test hides this because `downloadBmp` is in `EXCLUDED_FROM_COVERAGE`, with the comment that it has an example test with fakes.

Also seen: `paintToCanvas` and `browserScheduler` are in `EXCLUDED_FROM_COVERAGE` but do have property tests (tests/simulator/canvas.test.ts:33 and :71), so the exclusion is no longer needed for them. This is a finding about the structure test, not about the code.

Data exports (`DEFAULT_EXPORT_OPTIONS`, `PASS_STEPS`, colour constants, `MIN_PEG_DIAMETER_DIFFERENCE`) are not functions and were not checked.

## Not done

Nothing was fixed. The custom agent was not invoked. Findings were classified by one reviewer, with regular-expression help for the 250 lines of check A; no second reader checked them.

## Re-check and fixes (task 8.2, part 1)

Everything above is the review as first written. This section is the second reading of the classes, the fixes made, and what was left. It was done in one session by reading the code at each line, not by the regular-expression rules of the first pass.

### Re-check of the category A false positives (80) and acceptable lines (155)

The 80 false positives fall into four classes. Each class was checked against the code, not against the first pass's reason text:

| class | lines | checked | verdict |
|---|---|---|---|
| A row of a UI list, an HTML table, a CSS flex class or the fake IndexedDB store | 68 | `.row` is `display: flex` in `src/ui/screens/scan/ScanScreen.module.css:43` and `src/ui/screens/keep/KeepScreen.module.css:91`; `summaryRow` (`src/ui/state/keep.ts:32`) builds one line of the saved-design list; `rows` in `tests/support/fakeIndexedDb.ts` is a `Map` of store records; `scripts/checks/summary.ts:87` and `scripts/checks/manualResults.ts:52` are markdown table rows | unchanged |
| Page scrolling direction | 4 | `scripts/check_browser.ts:692` and `scripts/checks/manualSteps.ts:154,156,157` all measure `scrollWidth` against `innerWidth`, a viewport property | unchanged |
| A markdown table cell | 2 | `cell()` in `src/ui/i18n/reviewList.ts:10` escapes `\|` and newlines so a row of `docs/HINDI_REVIEW.md` stays whole | unchanged |
| A motif tile | 3 | see below | **reclassified** |

**Reclassified, false positive -> acceptable:** `src/ui/samples/sampleDesigns.ts:15, 31, 32` ("Flowers sit in cells twice as wide as a repeat", "tiled along the ends in cells that are `period` ends wide", "`u` and `v` run from -1 to 1 across a cell"). Calling these a false positive was wrong: a motif tile is part of the naksha, so the word is about the weave and the glossary's naming rule applies to it. It is still not a real issue: the tile is not a *repeat*. The diamond tile is one repeat, but the floral tile is two repeats wide, and the glossary has no term for it, so the last rule of the glossary ("choose the most precise plain-English name") allows a plain word. Nothing was renamed for these three lines.

The 155 acceptable lines were read again by class as well: profile field names from `card-geometry.md` (`horizontalPitchMm`, `verticalPitchMm`, `firstHoleCentreMm`), `row`/`column` as short forms of a hook row and hook column, "holes" for punched, peg and lacing holes together where the glossary has no word, the `hole` colour token, BMP format rows, and "thread" for warp and weft together. None changed.

**Counts after the re-check.** A: 7 real issues, 158 acceptable, 77 false positives (242 lines, unchanged total). B: 7 real issues, 13 acceptable, 3 false positives.

### Re-check of the category B false positives (3) and acceptable entries (13)

- `scripts/time_read_card.ts:28,40` — `WIDTH_PX = 1920`, `HEIGHT_PX = 1080` is the camera frame of the R8.8 budget; the card inside it is scaled from `profile.cardHeightMm`. Still a false positive.
- `tests/ui/screens/weaveWiring.test.ts:23` — `buildReadyCloth(profile, pattern, choices, 320, 192)` passes a viewport width and height in CSS pixels (`WeaveScreen.tsx:151` passes `viewport.width`, `viewport.height` there). Still a false positive.
- The catch-all row (PNG chunk offsets, byte lengths, R-numbers, CSS percentages) was not re-read entry by entry; it is a class, not a list of lines, and nothing in it is a card dimension.
- The 13 acceptable entries were read again. They stay acceptable: the demo-profile pins name the demo profile in their test title, and `DEFAULT_PIXELS_PER_MM` is a render resolution, not a card dimension. `tests/scripts/bmpHeader.test.ts` (192 and 36 written by hand) remains the strongest candidate for a later clean-up, as the first pass said.

### Category A: the 7 real findings, all fixed

| was | now | file |
|---|---|---|
| `for (const hole of row)`, `if (hole) punched += 1` | `punchedHole` | `src/ui/state/scan.ts:162,164` |
| `row.every((cell, c) => cell === card[r]![c])` | `punched` | `scripts/time_read_card.ts:68` |
| "a cell that is not a boolean"; `.map(([row, column, cell])`; `grid[row]![column] = cell` | "a punched hole value that is not a boolean"; `punchedHole` | `tests/ui/printable/download.test.ts:43,57,59` |
| `it('R10.6 toggling keeps the grid size and changes one cell')` | "... changes one punched hole" | `tests/ui/screens/scan.test.tsx:287` |

The test title keeps its `R10.6` prefix, its seed, its `numRuns` and every assertion; only the words changed.

### Category B: the 7 real findings, all fixed

- `scripts/check_browser.ts:612,613` — `profile.cardWidthMm * 12` is now `profile.cardWidthMm * DEFAULT_PIXELS_PER_MM`, imported from `src/ui/printable/raster.ts`, the constant the app itself renders with.
- `scripts/check_browser.ts:615` — the downloaded PNG's size is now compared with `widthPx`/`heightPx` from the profile instead of with `720x540`. The pHYs density expectation became `DEFAULT_PIXELS_PER_MM * 1000` as well (the first pass called the literal `12000` acceptable; deriving it keeps the same value and the same strength).
- `scripts/check_browser.ts:616` — the deliberate demo-profile pin (`profile gives ... not 720x540`) is unchanged, as the first pass classified it acceptable.
- `scripts/check_browser.ts:667` — the blank PNG of step 11 is now `round(cardWidthMm * DEFAULT_PIXELS_PER_MM)` by `round(cardHeightMm * DEFAULT_PIXELS_PER_MM)`.
- `scripts/checks/manualSteps.ts:50,52` — the print step text is generated: the module reads `public/profiles/demo-12x16.json` through `parseCardProfile` and exports `CARD_SIZE_BY` ("60 mm by 45 mm") and `CARD_SIZE_X` ("60 mm x 45 mm"). The module is no longer data only, and its header comment says so.
- `tests/scripts/manualSteps.test.ts` — the test that pinned the text now builds the same two strings from `demoProfile()` (the same profile file) and checks both the instructions and the `expected` field, so neither side has the size written by hand. It still fails if the text drifts. The step text is not one of the five that `BUILD_LOG_STEP_IDS` ties to `docs/BUILD_LOG.md`, so no log text had to change with it.
- `tests/ui/screens/liveCamera.test.tsx:252` — `aspectRatio: 60 / 45` is now `profile.cardWidthMm / profile.cardHeightMm`, and the expected `aspect-ratio:` string is built from the same number instead of being written as `1.3333333333333333`.

### The `endOrder` finding, `scripts/check_browser.ts:647-650`

The first pass read `shapes[row * hookColumns + column]` as an end index. On a second reading it is not: `shapes` was the list of `button[data-shape]` elements in document order, and that order comes from `hookMarkers` (`src/ui/state/corrections.ts:50-62`), which walks hook rows then hook columns. The formula therefore matched the marker order, not `endOrder`. Indexing that list with `endOrder[hookRow][hookColumn]` would have been wrong for any profile whose `endOrder` is not row-major, so that is not what the fix does.

What was wrong is still real: the step decided which hook a marker belonged to from an unstated assumption about document order, and it reported mismatches as "row R column C", with no end anywhere. The step now:

1. reads each marker's `aria-label` as well as its shape, and finds the marker for a hook position by the accessible name the app itself builds (`Hook row R, column C: punched hole`), so no formula decides which marker is which hook;
2. checks that the name and the drawn shape agree for every hook;
3. names each mismatch by its end, taken from `profile.endOrder[hookRow][hookColumn]` (card-geometry.md rule 5);
4. then asserts separately that the document order of the markers is hook row-major, which is what the arrow keys of R10.8 (`nextMarkerIndex`) depend on. That assumption used to be implicit in the formula; it is now a check of its own with its own message.

**Was step 10 passing for the wrong reason before?** It was passing for a weaker reason than it claimed. Its result was right for the demo profile, whose marker order is row-major, and the formula would have kept agreeing with the markers for any profile, because both sides are built row-major. It never checked an end, so its old failure message could not name one. After the fix it passes with the end range reported from the profile: `all 192 hooks (ends 0 to 191 from the profile's endOrder) equal Diamond pick 6 (96 punched, 96 not); card accepted into the batch`.

A related spot was left: the offline sub-check of step 13 (`scripts/check_browser.ts:864-866`) compares `expected.flat()` with the markers by document index. It carries the same implicit row-major assumption but computes no end index. It is not one of the findings; it is listed here so it is not lost.

### Check C: the `downloadBmp` property test

Added in `tests/exporter/download.test.ts`: `R8.1 downloadBmp offers the exported bytes once under the name of bmpFileName, and a failed export has nothing to offer`, seed 80211, 100 runs, over generated profiles, Patterns and export options (and the four ways an export fails), with `FakeDownloadDeps`. A successful export downloads exactly once, with the identical `Uint8Array` of `exportPatternBmp`, the name of `bmpFileName`, type `image/bmp`, one revoked URL, and the bytes read back by `readPatternBmp` to the same Pattern. A failed export carries no `bytes` field, so nothing can be offered: zero downloads, nothing revoked. The property counts both branches and fails if either never happened, so it cannot pass vacuously.

That `runExport` itself never calls `downloadBmp` after a failed export is Property 14 in `tests/ui/state/keep.test.ts`; the new property does not restate it.

### Not done in part 1

`tests/structure/glossaryTerms.test.ts`, `tests/structure/cardDimensions.test.ts` and the strengthening of `tests/structure/propertyNames.test.ts` (removing `paintToCanvas`, `browserScheduler` and `downloadBmp` from `EXCLUDED_FROM_COVERAGE` and requiring the name inside the same `it(...)` as the `fc.assert`) are the rest of task 8.2 and were not written here.

## The three checks (task 8.2, part 2)

Part 1 fixed the findings. Part 2 adds the checks that would have caught each class, and a shared
detector, `tests/support/termScan.ts` (`scanTerms`, `scanNumbers`, `splitWords`,
`identifierTokens`, `extractComments`), which holds no word list and no allowlist of its own: the
words, the numbers and the policy stay with each check.

### `tests/structure/glossaryTerms.test.ts` (check A)

Scans the identifiers and the comments of `src` and `scripts` for the review's word list (row,
column, col, thread, hole, cell, overlap, horizontal, vertical) and reports every use no allowance
covers. 888 uses of these words exist; 16 allowances explain them, each with a reason, in two
kinds: word sequences that are the glossary term, a profile field name or a documented
non-weaving term (`hook row`, `punched hole`, `hole diameter`, `pixel row`, `row major`, `table
row`, `pick row`, `warp thread`, `thread size`), and word-and-file classes (the `.row` CSS class
and the saved-design list row in the screens, the BMP and PNG byte-layout rows in `src/exporter`,
the pixel rows and columns of the renderer, the three hole kinds together in the eight files that
treat them alike, hole-disc overlap in the profile checker, the markdown table cell of
`reviewList.ts`, the motif tile of `sampleDesigns.ts`). The file states what the check cannot
find: a synonym outside the word list, an inflected form, anything inside a string literal, the
`tests/` tree, and whatever an allowance covers. A test fails if an allowance covers nothing, so a
stale one cannot stay.

**It reported 105 uses on first run. Nine were real and are fixed; none was in the review's 242
lines, because the review read only the lines the app spec added and these are older code.**

| was | now | file |
|---|---|---|
| `const cell: unknown = endOrder[r][c]`, `cellLocation`, `firstCell` | `endIndex`, `endLocation`, `endIndexSeen` (the value is an end index, which the next loop in the same file already called `endIndex`) | `src/codec/validateCardProfile.ts:332,350-373` |
| `cellRange`, `firstRow`/`lastRow`/`firstColumn`/`lastColumn`, "the grid cells within reach" | `hookRange`, `firstHookRow`/`lastHookRow`/`firstHookColumn`/`lastHookColumn`, "the hook positions within reach" | `src/codec/validateCardProfile.ts:126-139` |
| `for (let cell = 0, ...)` indexing ends across the drawn width (twice), "cells of one woven pick", "per-cell scan", "every cell is drawn", "every pixel of a cell" | `end`, "intersections", "per-intersection scan" (the glossary uses "intersection" in its `face` entry) | `src/simulator/render.ts:71-91,178,195-197,267-280` |
| `weftByRow` (indexed by pick), `shedRow` (a pick), `weftRow`, `warpMaskRow` (an offset), `row = cloth.picks[pick]` | `weftByPick`, `shedPick`, `weftInk`, `warpMaskStart`, `pickRow` | `src/simulator/render.ts:156-280` |
| `row = picks[pick]` (a `PickRow`) | `pickRow` | `src/simulator/floats.ts:31-95` |
| "a run of at least 2 adjacent threads", "the woven cell at (pick, end)" | "adjacent warp threads, or weft threads", "the woven intersection" | `src/simulator/floats.ts:3-20` |
| "A zari weft cell ... centre row ... every column", "A highlighted cell", "Gap row colours", "x the column", "across a thread t px wide" | "intersection", "centre pixel row", "pixel column", "Gap pick colours", "a warp or weft thread" | `src/simulator/style.ts:8,16,22,35,46` |
| "A fixed alignment hole" (the `PegHole` doc), "Fraction of the hole radius" | "A peg hole: fixed alignment ...", "Fraction of the punched hole radius" | `src/codec/types.ts:3`, `src/reader/sampling.ts:5` |
| "row by row", "square threads", "the row's Delete button", "one row per result" | "hook row by hook row", "square warp and weft threads", "the list row's Delete button", "one table row per result" | `src/ui/printable/layout.ts:9`, `src/ui/samples/sampleDesigns.ts:30`, `src/ui/screens/keep/KeepScreen.tsx:298`, `scripts/checks/summary.ts:87` |

No behaviour changed: every edit is a local name or a comment, and the 790 tests pass unchanged.

**Proof that it catches category A.** `src/ui/state/scan.ts:162,164` were put back as they were
before part 1 (`for (const hole of row) ... if (hole)`). The check failed with exactly those two
lines, then passed again after the revert:

```
AssertionError: 2 use(s) of a non-glossary word:
src/ui/state/scan.ts:162 "hole" (identifier) uses "hole" where the glossary has punched hole, peg hole or lacing hole
src/ui/state/scan.ts:164 "hole" (identifier) uses "hole" where the glossary has punched hole, peg hole or lacing hole
 Tests  1 failed | 11 passed (12)
```

Six of the seven category A findings are pinned as planted text in the test file and are all
flagged. The seventh was the wording of a test title, which is a string literal: the check cannot
read it, and a test asserts that it is *not* reported, so the gap stays visible.

### `tests/structure/cardDimensions.test.ts` (check B)

Reads `public/profiles/demo-12x16.json`, works out every number it gives (60, 45, 12, 16, 192, 36,
720, 540 and the millimetre values) and reports numeric literals in `src` and `scripts` that hold
one of them as card geometry, in three tiers: always (a value only a card produces, or a
fractional millimetre value), on a line that names card geometry (whole numbers of 10 and above),
and beside its partner (`720, 540`, `60 / 45`, `12` and `16`, `192` and `36`). Nothing in the
check is written by hand from the card: the numbers come from the profile and the print resolution
from `DEFAULT_PIXELS_PER_MM`.

**It reports four literals in the current tree, all explained by three allowances, each tied to
one line of one file so that a second copy anywhere is still reported:**
`DEFAULT_PIXELS_PER_MM = 12` (a print resolution, not a card dimension), the deliberate
demo-profile pin at `scripts/check_browser.ts:628` that part 1 kept, and `ICON_SIZES = [192, 512]`
in `scripts/make_icons.ts` (icon pixels; 192 equals the ends per pick by coincidence).

**Proof that it catches category B.** `scripts/check_browser.ts:621` was put back to
`profile.cardWidthMm * 12`:

```
AssertionError: 1 hard-coded card number(s):
scripts/check_browser.ts:621 literal 12 (context) is hookRows of the demo profile
    const widthPx = Math.round(profile.cardWidthMm * 12);
 Tests  1 failed | 10 passed (11)
```

Five of the seven category B findings are pinned as planted text and all flagged. The two
low-weight ones were "60 mm by 45 mm" inside instruction strings; strings are not scanned, and a
test pins that gap too.

### `tests/structure/propertyNames.test.ts` (check C), strengthened

The coverage rule now requires the function to be named inside the same `it(...)` as the property
runner, plus the declarations of the same file that the test body names, followed through (a
property written as a named helper is still a property of the function). `paintToCanvas`,
`browserScheduler` and `downloadBmp` are out of `EXCLUDED_FROM_COVERAGE`; only `loadPixelData`
remains, with the reason beside it (it is the browser boundary: `createImageBitmap`,
`OffscreenCanvas`, `getImageData`, no pure rule to state).

Run before the helper rule existed, the strict text reported four functions:

```
AssertionError: not named inside any test that calls the property runner:
src/reader/layout.ts: layoutMatches
src/reader/pegHoles.ts: rankPegHolePairs
src/reader/sampling.ts: decidePunched
src/reader/selectPegHoles.ts: selectPegHolePair
```

Three of the four are covered by properties whose body sits in a named helper
(`checkTrueBeatsDecoys` in `tests/reader/layout.test.ts`, `notMistakenProperty` and
`notMistakenForPegHoles` in `tests/reader/pegHoles.test.ts`), which is what the helper rule
follows; this agrees with the review's own by-hand result that only `downloadBmp` was missing.
`decidePunched` (`src/reader/sampling.ts`) genuinely had example tests only, so a property was
written for it: `R11.1 a hook position is punched exactly when more than half of its sampling
pixels are dark`, seed 80219, 300 runs (majority rule, scale invariance, no tie counted as
punched, dark and light swapped). Nothing was added to the exclusion list.

Two more points of the strengthened rule: a name only counts when it stands on its own, not after
a dot, so `fc.nat` is no longer read as a use of a function called `nat`; and the rule itself now
has a property (seed 80220, 200 runs) over generated test files, which checks that a name counts
from inside a property, from a helper it names and from a helper of that helper, and does not
count when it appears in an example test beside a property about another function. The rule still
cannot tell whether a property says anything worth saying about the function it names.
