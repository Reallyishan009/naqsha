# Measurements: Design and UX Pass

Numbers and records for the Build_Log. Each section is filled by the task named in `tasks.md`.

## Baseline bundle

Label: before Stage A. Printed by `npm run check-bundle` after `npm run build` (gzip level 9).

Entry_Chunk: `./assets/index-Cge58eUK.js`, 101075 bytes gzipped (limit 204800).

Every JavaScript chunk, as printed:

| File | Gzipped bytes |
|---|---|
| assets/CodeViewScreen-D-CiFXEJ.js | 9321 |
| assets/RepairPanel-BB_TRwHZ.js | 3119 |
| assets/ScanScreen-02MsZOA5.js | 9152 |
| assets/bits-DYr9iaPj.js | 510 |
| assets/download-C1mhc7Cf.js | 2227 |
| assets/index-Cge58eUK.js (Entry_Chunk) | 101075 |
| assets/style-iZjlxjtF.js | 538 |
| assets/validateCardGrid-Kwe0StTt.js | 2975 |

Scan chunk: `assets/ScanScreen-02MsZOA5.js`, 9152 bytes gzipped.

## Licence record

Task 2.2. Checked 2026-11-21. Pinned google/fonts commit SHA: `06bfe0d62a98375cb09c942fa18e68bd32cff057` (`FONTS_REF` in `scripts/fonts/subset.sh`). Each licence text was downloaded from that commit and the script confirmed that it contains "SIL OPEN FONT LICENSE Version 1.1". All three are SIL OFL 1.1, so all four fonts were copied.

| Font (files) | Licence | Source URL | Check date | Licence text |
|---|---|---|---|---|
| Rozha One (`RozhaOne-Regular.woff2`) | SIL Open Font License 1.1 | https://raw.githubusercontent.com/google/fonts/06bfe0d62a98375cb09c942fa18e68bd32cff057/ofl/rozhaone/ | 2026-11-21 | `RozhaOne-OFL.txt` (copyright Indian Type Foundry, no Reserved Font Name) |
| Hind (`Hind-Regular.woff2`, `Hind-Bold.woff2`) | SIL Open Font License 1.1 | https://raw.githubusercontent.com/google/fonts/06bfe0d62a98375cb09c942fa18e68bd32cff057/ofl/hind/ | 2026-11-21 | `Hind-OFL.txt` (copyright Indian Type Foundry, no Reserved Font Name) |
| IBM Plex Mono (`IBMPlexMono-Regular.woff2`) | SIL Open Font License 1.1 | https://raw.githubusercontent.com/google/fonts/06bfe0d62a98375cb09c942fa18e68bd32cff057/ofl/ibmplexmono/ | 2026-11-21 | `IBMPlexMono-OFL.txt` (copyright IBM Corp., Reserved Font Name "Plex") |

Note: the IBM Plex Mono licence reserves the name "Plex". The subset keeps the font's original family name table, as google/fonts distributes it; the file is not renamed or presented as a different font.

## Font_Weight_Report

Task 2.2. Typed from the output of `node scripts/fonts/report.ts`. "Before" is the source `.ttf`, "after" is the subsetted `.woff2`.

| File | Bytes before | Bytes after |
|---|---|---|
| RozhaOne-Regular.woff2 | 322828 | 41180 |
| Hind-Regular.woff2 | 299532 | 39500 |
| Hind-Bold.woff2 | 286604 | 36572 |
| IBMPlexMono-Regular.woff2 | 135580 | 6660 |
| Sum after subsetting | | 123912 |

The sum 123,912 is below the 307,200-byte limit and no file is above 51,200 bytes, so no range or weight has to go and the user need not be asked (Requirement 2.6).

## Contrast table

(Tasks 2.5 and 2.13.)
Final table, Task 2.13 (Stage A gate): printed by `npm run build && node scripts/contrast_report.ts` after the full gate; ratios truncated by `truncateRatio`, never rounded up. All 17 pairs in both themes meet their minimum, so nothing is flagged, and the ratios are the same as those of Task 2.5.

Task 2.5 note: no pair is below its minimum, so no token value changed. Day `--zari` stays `#B0800A` (the brief's `#B8860B` gives 2.84:1 on ground). `--on-zari` and `--on-hole` were added to `THEME_TOKENS` and `tokens.css` together.

| Pair (foreground on background) | Minimum | Day | Night |
|---|---|---|---|
| ink on ground | 4.5 | 14.05 | 14.97 |
| ink on surface | 4.5 | 15.58 | 13.47 |
| ink-soft on ground | 4.5 | 5.70 | 8.20 |
| ink-soft on surface | 4.5 | 6.32 | 7.38 |
| madder on ground | 4.5 | 6.56 | 5.26 |
| madder on surface | 4.5 | 7.27 | 4.73 |
| indigo on ground | 4.5 | 10.65 | 7.68 |
| indigo on surface | 4.5 | 11.81 | 6.91 |
| leaf on ground | 4.5 | 5.49 | 9.62 |
| leaf on surface | 4.5 | 6.09 | 8.65 |
| on-zari on zari | 4.5 | 4.55 | 10.27 |
| on-hole on hole | 4.5 | 14.96 | 16.42 |
| zari on ground | 3 | 3.08 | 9.37 |
| zari on surface | 3 | 3.42 | 8.43 |
| hole on card | 3 | 9.45 | 8.53 |
| ink-soft on ground | 3 | 5.70 | 8.20 |
| ink-soft on surface | 3 | 6.32 | 7.38 |

Note: design.md quotes `hole` on `card` as 9.46 (Day) and 8.54 (Night), which are rounded values; the truncated ratios are 9.45 and 8.53.

## Benchmark

## Changed selectors

(Old selector, new selector and reason for each existing test or check that is re-aimed.)

- `tests/ui/deploy.test.ts` "R13.5": old assertion, no `@font-face` or `@import` in any `src/**/*.css`. New assertion: `@import` is still banned everywhere; `@font-face` is banned in every file except `src/ui/theme/tokens.css`, where each `src` must be a `fonts/*.woff2` path with no scheme or host; the `font-family` check (generic family or `var(--font-*)`) runs on the CSS with the `@font-face` blocks removed. Reason: Requirement 1.2 requires four `@font-face` rules in the Token_File. Strength kept: the same files are still checked, and a font declared anywhere else still fails.

Task 2.10 (the four Screens moved onto Button, Field, Panel and Notice). Strength is kept in every row: the same text, element or property is asserted, in the element that now carries it.
- A Notice replaces every `<p role="alert" class=...>TEXT</p>`. It renders `<div class="..." role="alert" data-variant="error"><p>icon and word</p><div class="...">TEXT</div></div>`. A new helper `tests/support/notices.ts` (`alertTexts`, `noticeTexts`) returns the text blocks of the alerts (or `status` Notices) so a test asserts the same text inside the same role.
  - `tests/ui/accessibility.test.tsx`, "R14.6 ... statuses": old `/<p role="alert"[^>]*>TEXT</p>/`; new `alertTexts(html)` contains TEXT.
  - `tests/ui/screens/keep.test.tsx`, "R15.7 each Keep failure message ... in a visible alert": old `html` contains `<p role="alert" class="` and the text; new `alertTexts(html)` contains the text (the role and the text are now asserted together, which is stricter).
  - `tests/ui/screens/repair.test.tsx`, "R1.2 a gap with no suggestion says why, and an invalid input is an alert": old `/role="alert"[^>]*>The card profile is not valid/`; new an alert text starts with "The card profile is not valid".
  - `tests/ui/screens/code.test.tsx`, four tests (R7.2 "Saved designs cannot be reached", R7.3 "Kota cannot be compared...", R7.8 "These designs are too long to compare", R7.6 "The card profile could not be used."): old `/<p role="alert"[^>]*>TEXT/`; new an alert text starts with TEXT. R6.12 R6.13: old `/<p role="alert"/` (one or more); new `alertTexts(html).length >= 1`. R7.5: old `/<p role="status"[^>]*>The two designs are the same\.<\/p>/`; new `noticeTexts(html, 'status')` contains "The two designs are the same.".
- A Field renders `<label><span>TEXT</span>CONTROL</label>`, so the label wraps its control and has no `for`. The `<span>` has no class (the Field module styles `.field > span`), so the existing `<span>Speed</span>` and `<label[^>]*><span>` tests pass unchanged.
  - `tests/ui/screens/code.test.tsx`, "R3.4 R3.5 the jump control ...": old `<label for=ID>Go to pick number</label><input ...inputMode="numeric".../>` and `id="ID"` on the input; new `<label><span>Go to pick number</span><input ...inputMode="numeric".../></label>`. The label names the input by wrapping it. Reason: the shared Field wraps its control.
  - `tests/ui/screens/code.test.tsx`, "R6.16 an empty Archive ..." and "R7.1 an empty Current_Pattern ...": old `<label for=ID>Earlier design</label>` (and Later), and `>Earlier design</label>`; new `<label><span>Earlier design</span><select` (and Later). Same reason.
  - `tests/ui/components/components.test.tsx`, "R6.8 a Field renders a label ...": old `<span class="...">Name</span>`; new `<span>Name</span>`. This is the design's own markup (`<label><span>{label}</span>{children}</label>`), which the 2.7 version had drawn with a class on the span.
- Style tests that read a Screen module for a button or field rule now read the shared module, because the Screens no longer declare these rules.
  - `tests/ui/accessibility.test.tsx`, "R14.11 ... form controls inherit it": old `KeepScreen.module.css` `.input { font: inherit }`; new `components/Field.module.css` `.field textarea { font: inherit }`.
  - `tests/ui/accessibility.test.tsx`, "R11.10 every button, field, select, breakpoint control and Bit_Line region is at least the Touch_Target tall": old `min-height: var(--touch-target)` in `CodeViewScreen.module.css` `.button` and `.input`, `DiffPanel.module.css` `.button` and `.select`, `LineRow.module.css` `.breakpoint`; new the same declaration in `components/Button.module.css` `.button` and in the `components/Field.module.css` control rule, plus a check that `CodeViewScreen.tsx`, `DiffPanel.tsx` and `LineRow.tsx` use `<Button` (and `<Field` in the first two) and contain no raw `<button`. The `.bits` rule is still read in `LineRow.module.css`.
  - `tests/ui/screens/keep.test.tsx`, "R14 every control is a native control and every target is at least 48 px": old `.button`, `.input`, `.choice` in `KeepScreen.module.css`; new `.button` in `Button.module.css`, the Field control rule in `Field.module.css`, and `.choice` still in `KeepScreen.module.css`.
  - `tests/ui/screens/repair.test.tsx`, "R6.1 the panel styles wrap long text ...": old `.button { min-height: var(--touch-target) }` in `Repair.module.css`; new the same in `Button.module.css`.
- `scripts/check_browser.ts`, Scan steps "read the card", "a blank image" and the Offline step (three places): old `document.querySelector('[role="alert"]')?.textContent.trim()`; new `document.querySelector('[role="alert"] > div')?.textContent.trim()`. The alert now also holds the Notice word ("Problem") and its icon; the selector reads the text block, so the equality with `EN['error.read.peg-holes-not-found']` is unchanged. Not run in 2.10 (it runs at the Stage A gate).
- Other selectors the scripts use are unchanged: `#screen-title`, `#scan-file`, `#keep-saved`, `keep-delete-ID`, `button[data-shape]`, `button[data-corrected]`, `button[aria-label=...]`, `[role="group"][aria-label=...]`, `label span`, `#scan-batch-title ~ ol > li`, `closest('section')` on `#keep-list-title`.

Task 2.11 (the style test found two violations in `src/ui`; the source was fixed, not the test).
- `src/ui/screens/code/LineRow.module.css` `.line`: old `box-shadow: inset 0 -1px 0 var(--line)` (Requirement 3.6 allows only `var(--shadow-card)`); new a 1px `.line::after` strip in `--line` at the bottom edge, so the row keeps its full height for the controls (R11.10).
- `src/ui/screens/code/LineRow.tsx` `SELECTED_MARK`: old `▶` (U+25B6, Extended_Pictographic, so an emoji under Requirement 7.6); new `►` (U+25BA, not Extended_Pictographic). `tests/ui/screens/code.test.tsx` (three expectations: the marks list, the marks list, and the hidden span) re-aimed from `▶` to `►` with the same strength.
Task 3.2 (the Code view navigation item now holds the word "Advanced", so its text is "CodeAdvanced" and not "Code").
- `scripts/check_browser.ts`, `goTo` and `showScreen`: old `page.clickText('nav button', LABEL)` (exact `textContent.trim() === LABEL`); new a `clickNavItem` helper that clicks the `nav button` whose `textContent.trim()` starts with LABEL. Same approach as `scripts/screenshots.ts`. Strength kept: the same four items are found by their label, and the next step still waits for the Screen heading to equal the same text. Not run in 3.2 beyond the gate below.
Task 3.3 (the Weave screen with no pick is the Landing, so the sample buttons of Try it are only on the player; each Sample_Tile also holds the "Try it" label, so its text is "DiamondTry it" and not "Diamond"). Strength is kept in every row.
- `tests/ui/screens/weave.test.tsx`: "R2.8 the speed control", "R3.8 thread size, float ..." and "R3.8 the screen has only the controls" (and its last `en` check): old `render({ ...initialAppState, ... })` (empty Weave screen); new `render(arrivedWith('diamond', { language }))`. The same markup is asserted on the screen that now shows these controls.
- same file, "R2.1 with no design the screen shows the empty text and the play controls are disabled": old `render(empty state)`; new `renderPlayer(empty state)`, the weave player rendered alone with the same states, and the same assertions. Reason: the Weave screen shows the Landing for an empty pattern; the player keeps its empty-state markup. (Not in the task's list of four; same strength.)
- same file, "R4.1 Try it offers three Sample_Designs" and "R2.12 a failed profile leaves Try it disabled": old `render(state)` and a regex over the Weave screen; new `renderTryIt(state)` (the `<TryIt>` section rendered alone) with the same regexes. R2.12 also asserts that the Landing shows the profile error and no `data-sample` control.
- `tests/ui/screens/shell.test.tsx` "R14.10 exactly one live region", `tests/ui/components/themeSwitch.test.tsx` "R4.9 ... one live region", `tests/ui/screens/announce.test.tsx` `liveRegionText`: old state had the profile loading; new the same state with a ready profile (`demoProfile()`). Reason: while the profile loads, the Landing shows a `LoadingState` (a transient `role="status"`, Requirement 11.9), so the count of `role="status"` was 2 and the first match was not the live region. The assertions (one `role="status"`, the text inside it) are unchanged.
- `scripts/check_browser.ts` `chooseSample`: old `page.clickText('button', EN['tryit.<design>'])`; new `page.click(document.querySelector('[data-sample="<design>"]'))`. Steps "app loads" and the Offline step "online load": old a `button` whose text is the Diamond name (English or Hindi) and not disabled; new `[data-sample="diamond"]` not disabled. Reason: the tile's text also holds "Try it". Strength kept: the same control is found and must be enabled. (Task 3.11 plans the `chooseSample` change; it is done here because the Landing needs it now.)
- No glossary allowance moved: the `.row` CSS class of `WeaveScreen.module.css` was renamed `.strip` (in `WeavePlayer.tsx` and `TryIt.tsx`), so `tests/structure/glossaryTerms.test.ts` is unchanged.
- No width media query in a module style sheet is allowed (`tests/ui/accessibility.test.tsx` R14.11), so the Landing asks its own width with a container query (`@container (min-width: 40rem)` on `Landing.module.css`) and sizes the headline with `clamp()`.
Task 3.6 (Scan screen: the read failure message has no role of its own because `read-failed` already dispatches `announce` and the Shell live region announces it once).
- `scripts/check_browser.ts`, Scan steps "read the card", "a blank image" and the Offline step (three places): old `document.querySelector('[role="alert"] > div')?.textContent.trim()`; new `document.querySelector('[data-variant="error"] > div')?.textContent.trim()`. Same text block (the Notice text), found by the Notice's error variant instead of its role. The checked equality with `EN['error.read.peg-holes-not-found']` is unchanged.
- Other selectors the scripts use on Scan are unchanged and still match: `#scan-file`, `button[data-shape]`, `button[data-corrected]`, `#scan-batch-title ~ ol > li` (the heading and the list are still siblings, now inside "More"), `#screen-title`.
- No test selector changed. The empty batch is no longer drawn by `BatchList` (it returns nothing for an empty batch); `ScanView` draws the empty state, outside "More", so it is in view without opening anything. `Done` is still in the markup, disabled, for an empty batch.

Task 3.7 (Code view: the compare panel moves under the intro and above the pick controls; no Disclosure is added on this screen, as the task and design say). Strength is kept in each row; no assertion was weakened.
- `tests/ui/screens/code.test.tsx`, "R6.6 R6.16 the screen shows the panel ...": old the panel heading is after `CODE_VIEW_MARKER`, after the cloth heading and after the last `data-pick=`; new the panel heading is after the `codeview.nextStep` line and before the step-back control, `CODE_VIEW_MARKER`, the cloth heading and the first `data-pick=`. Reason: the panel now comes first (R23.7). Same number of order checks.
- same file, "R11.1 Tab visits ...": old `html.indexOf('<select')` greater than the last `data-pick=`; new it is less than the step-back control and less than the first `data-pick=`. The `tabStops` list is unchanged (the choosers and Compare are disabled until the Archive answers).
- `DiffPanel`: the `codeview.diff.hint` paragraph moved from under the heading into the Diff result (it explains Added and Removed, so it shows with a result, not before one), and the loading, no-saved and failed-list notices moved below the choosers and Compare. Reason: with them above, Compare ended at 886 px (en) and 945 px (hi) at 390 by 844; now 728 px and 777 px (the Shell's "newer Naqsha" update notice removed from the page; with it shown they are 886 and 945, so it pushes them down). No selector or accessible name changed: "Earlier design", "Later design", "Compare", the `<select>` order and `aria-labelledby` are as before.
- The empty design is `StateMessage variant="empty"` with `codeview.empty` and `codeview.nextStep` as the next-step line (no new key; the same sentence is also the intro's second line). `tests` that read `codeview.empty` as text still pass unchanged.
- Archive failures in the panel are error `StateMessage`s with the 48 px retry (`state.retry`): a failed list retries `listDesigns`; a failed comparison (storage unavailable or write failed) repeats Compare with the same two choices. `not-found` has no retry because the missing design is removed from the choices.
## Hindi wrapping fixes

## After inspection

## Keys with equal Hindi one and other text

## Disclosure check changes

Task 3.4 (Weave Settings Disclosure and the Card_Profile details Disclosure): no test or `check:browser` step had to open a Disclosure. No step in `scripts/check_browser.ts` and no assertion in `tests/` uses the warp colour, weft colour, zari or repeat controls through a browser, and the unit tests render the server markup, where the collapsed content is still present (`hidden`). The Card_Profile status text is also still in the markup, collapsed. Nothing was weakened.
- `ProfileNotice` (Keep and Scan): the one-line notice (word, icon and sentence) stays visible; the status text is inside a Disclosure that is named by the profile name (the label "Card profile:" stands above it), not "More", so a script that opens "More" on Keep or Scan never opens the profile one by mistake. The two `ProfileNotice` tests that count the sentence and check its order (`tests/ui/screens/keep.test.tsx` R22.1 ...) pass unchanged.
- `scripts/checks/manualSteps.ts` (step "Media were captured from the running Built_Site") still says the status text is visible on every Scan and Keep frame. It describes the GIFs recorded before this pass, and was not edited; those GIFs show the old layout.

Task 3.5 (Keep "More" Disclosure: the export choices and every Metadata field except the name, the version note and the save mode are inside it; the name, Save and the export button stay outside). Strength is kept in each row; no assertion was weakened.
- `scripts/check_browser.ts`: new helper `openMore(page)` (finds the Disclosure button by the exact text of `disclosure.more`, clicks it when `aria-expanded` is `false`, waits for `true`). Called in three places: step 4 "Keep: save a design with a name and place" (after the name is filled and before the place field is filled; `fillField` focuses the field and would not reach a hidden one), step 8 "export 1-bit and 8-bit BMP, parse the header" (before `label span` "1 bit ..." is clicked) and the Offline step "a BMP export works offline" (same click). The checked outcomes are unchanged.
- `scripts/screenshots.ts`: no change; `saveCurrent` already opens "More" by name for `keep.save.note` through `fillShownField`/`reveal`.
- `tests/`: no test had to open the Disclosure. The unit tests render server markup, where the collapsed content is still present (`hidden`), so the option radios, the five Metadata inputs, the note input and the save-mode radios are still found. The input count in `tests/ui/screens/keep.test.tsx` R7.1 is still six text inputs and one textarea.

Task 3.6 (Scan "More" Disclosure, controlled by the screen: collapsed on arrival, opened by `ScanScreen` when a read completes; it never moves focus). Inside it: cancel-replacing, the camera, the read panel (legend, zoom, the hook markers, undo, accept, discard) and the batch panel (list, Done and its confirmation). Outside it: the choose-a-photo input, the reading text, the read failure, the profile notice and the empty batch state. Strength is kept in each row; no assertion was weakened.
- `scripts/check_browser.ts`: no `openMore` call is needed on Scan. Every Scan control the checks use after a read (`button[data-shape]`, "Accept this card", the batch list) is inside the Disclosure, and the screen has opened it by the time the markers exist. The step that reads a blank image reads only the failure text, which is outside it. Offline, the same two reads use the same path.
- `tests/`: no test had to open the Disclosure. The unit tests render server markup, where the collapsed content is still present (`hidden`).
- `ProfileNotice` now comes after the choose-a-photo panel, so the choose-a-photo input is the first control in reading order (its Disclosure control was first before).

Task 3.11 (`scripts/check_browser.ts`). No existing step, selector or assertion was removed, skipped or loosened. The new steps come after step 14 and before "works with the network off", so steps 1 to 14 keep their numbers; the offline step moves from 15 to 19.
- `openMore` now calls the new `openDisclosure(page, name)`. Old selector: a `button[aria-expanded][aria-controls]` whose `textContent.trim()` equals the text of `disclosure.more`; new selector: the same button, found by its accessible name (`aria-label`, else the text), with the name given by the caller. Reason: one helper for every Disclosure, as Requirement 10.8 asks. Strength kept: `openMore` still waits for the Disclosure, clicks it only when `aria-expanded` is `false`, and waits for `true`. New: when no Disclosure has that name the step fails with `the Disclosure "<name>" was not found`.
- `chooseSample` (`[data-sample="<design>"]`) and the "app loads" and offline "online load" selectors were re-aimed in 3.3; they are unchanged here.
- No Weave step changes the colours, zari or repeat, so no step needs `openDisclosure(page, "Settings")`; the new Disclosure step opens "Settings" by itself.
- New steps (additive, no old selector): 15 "Landing: headline, steps and first tile within 700 px at 390 by 844, one primary Button, a tile starts a sample" (English and Hindi; the headline is the heading whose text is `landing.headline`, the strip is `ol[aria-label=landing.steps.name]`, the tile is the first `main [data-sample]`; exactly one `[class*="_primary_"]` and it is the first tile; the other two tiles are `_secondary_`); 16 "Disclosures ..." (every `main button[aria-expanded][aria-controls]` of Weave, Keep and Scan at 390 by 844: collapsed on arrival, panel `hidden` and its controls not drawn, a real Tab from the control does not enter the panel, Enter and Space toggle `aria-expanded` both ways, the first Tab from an open control enters the panel, Escape from an inner control collapses it and puts focus on the control, and opening it leaves the scroll position unchanged and the primary Button fully inside the viewport); 17 "navigation ..." (`aria-current="page"` on exactly the current item of 4, on each Screen; at 320 px in English and Hindi, in both themes, the 7 header controls have no text outside its control, no scroll overflow in the control and no overlap); 18 "the primary Button of each Screen is within the first 844 px at 390 by 844" (four Screens, English and Hindi; Scan's primary is the choose-a-photo input, `label[data-emphasis="primary"] input`).
- Defects found by the new steps in `src/` and fixed: on Keep the one-line profile notice, the "Card profile:" label and the profile Disclosure sat above the export button. Opening that Disclosure moved the primary Button from 776 to 824 px to 842 to 890 px, out of the 844 px viewport (R10.7), and in Hindi the button ended at 860 px (R23.7). `ProfileNotice` takes `part` (`all` by default, `notice`, `details`); the export panel draws the one-line notice above the button (so "each notice comes before its control", R22.7, still holds) and the name and Disclosure at the end of the panel. `tests/ui/screens/keep.test.tsx` and `profileNotice.test.tsx` pass unchanged.

## Shell state changes
Task 3.8 (Shell and App states on `StateMessage` and `LoadingState`). Strength is kept in each row; no assertion was weakened.
- `src/ui/App.tsx`: the failed-profile banner is an error `StateMessage` (no role, as before: the Shell live region announces it), the profile loading text is a `LoadingState`, the two `Suspense` fallbacks are `LoadingState` (`status.screen`), `ScreenBoundary` shows an error `StateMessage` (`role="alert"`, announced once, focus not moved) with a 48 px Try again that raises a Shell `screenAttempt`. The attempt is in the `ScreenBoundary` key and in `useLazyScreen(importer, attempt)`, so the Screen remounts and a new `lazy` component asks for the chunk again. Navigation, the Current_Pattern, the Scan batch and saved designs live outside the boundary and are untouched. The Card_Profile retry (`profileAttempt`) was done in 3.3.
- The Landing already shows the profile loading and failure with its own retry, so the Shell shows its own loading text, and the retry beside its banner, only on the other Screens. The banner text stays on every Screen (`tests/ui/screens/shell.test.tsx` R1.7 passes unchanged).
- `tests/ui/screens/code.test.tsx` R9.10: only the constructor call of `ScreenBoundary` changed (it now takes `t` and `onRetry`); the assertions are the same.
- `tests/ui/screens/scan.test.tsx` R13.1 R16.10: the source check `lazy(() => import('./screens/scan/ScanScreen.tsx'))` is re-aimed at the same fact (a dynamic import of the Scan chunk, no static import) as `importScanScreen = () => import(...)` plus `useLazyScreen(importScanScreen, ...)`; the `not.toMatch(/^import .*screens\/scan/m)` line is unchanged.
- `src/ui/Shell.module.css`: removed `.loading`, `.noticeLine` and `.screenError`, which nothing uses any more.
- New `tests/ui/screens/shellStates.test.tsx` (failed profile, loading, chunk fallback, failed Screen).
- Update notice on a first visit (defect). Cause: `registerServiceWorker` listened to `updatefound` and treated every worker that reached `installed` as "a newer version is waiting". On a first visit the first worker also fires `updatefound` and `installed` (it then activates and claims the page by itself), so the Shell showed "A newer Naqsha is ready" and pushed the content down. The cache name is a hash of file contents (`scripts/build_precache.ts`), so it does not change between loads; that was ruled out. Fix: `ContainerLike` has `controller`; the `updatefound` handler reads `container.controller !== null` before the worker installs and only an update of a controlled page reaches `new-worker-waiting`. The existing R24.5 tests pass unchanged (`FakeServiceWorkerContainer.changeController` now sets `controller`); one test was added for the first install followed by a genuine update.

Task 3.9 (delayed Thread_Progress). No selector, accessible name or test id changed, and no existing assertion was touched.
- Scan: `ScanView` shows `WeftProgress` (`progress.reading`) under the existing reading line once `useAfterDelay(scan.status === 'reading')` is true. The reading line keeps its `role="status"`, as before; the progress adds no role.
- Keep: `KeepScreen` has `exporting` and `saving` state and passes them to `KeepView`, which shows `WeftProgress` (`progress.exporting`, `progress.saving`) in the export and save panels after 300 ms. A second click while one is running is ignored.
- Behaviour change in Keep export: `onExport` now waits one `setTimeout(0)` before it builds and downloads the file, so the browser can paint the progress; before, it ran in the click handler. `runExport` is unchanged. `check:browser` steps 8 and 15 (BMP export, online and offline) still pass.
- `KeepView` and `ScanView` take an optional `afterDelay` prop (default `useAfterDelay`). Reason: tests render on the server, where effects never run, and the project forbids `vi.mock`; the new `tests/ui/screens/delayedProgress.test.tsx` passes a rule driven by a fake clock and the real `startDelay`.

## Notes for the final report

Task 2.2, code points that a source font lacks (from `scripts/fonts/missing-glyphs.json`):

- Of the code points used in `en.json` and `hi.json`, only U+25CF `●` and U+25CB `○` (in `repair.legend`) are missing, and all four source fonts lack them. The browser draws them from the fallback family.
- Every Devanagari code point used in `hi.json` is present in Rozha One, Hind Regular and Hind Bold.
- The Devanagari block range (U+0900 to U+097F) is subsetted whole, so the source fonts also lack some unused code points of it. These are listed in `missing-glyphs.json` and none appears in a string:
  - Rozha One: U+0900, U+0904, U+093A, U+093B, U+094E, U+094F, U+0955 to U+0957, U+0962, U+0963, U+0971, U+0973 to U+097C, U+097E, U+097F.
  - Hind Regular and Hind Bold: U+0900, U+0904, U+090E, U+0912, U+0929, U+0934, U+093A, U+093B, U+0946, U+094A, U+094E, U+094F, U+0951 to U+0957, U+095F, U+0971, U+0973 to U+097F.
  - IBM Plex Mono: U+25CB, U+25CF only.
