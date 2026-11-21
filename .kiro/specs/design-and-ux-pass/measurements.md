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
## Hindi wrapping fixes

## After inspection

## Keys with equal Hindi one and other text

## Disclosure check changes

## Notes for the final report

Task 2.2, code points that a source font lacks (from `scripts/fonts/missing-glyphs.json`):

- Of the code points used in `en.json` and `hi.json`, only U+25CF `●` and U+25CB `○` (in `repair.legend`) are missing, and all four source fonts lack them. The browser draws them from the fallback family.
- Every Devanagari code point used in `hi.json` is present in Rozha One, Hind Regular and Hind Bold.
- The Devanagari block range (U+0900 to U+097F) is subsetted whole, so the source fonts also lack some unused code points of it. These are listed in `missing-glyphs.json` and none appears in a string:
  - Rozha One: U+0900, U+0904, U+093A, U+093B, U+094E, U+094F, U+0955 to U+0957, U+0962, U+0963, U+0971, U+0973 to U+097C, U+097E, U+097F.
  - Hind Regular and Hind Bold: U+0900, U+0904, U+090E, U+0912, U+0929, U+0934, U+093A, U+093B, U+0946, U+094A, U+094E, U+094F, U+0951 to U+0957, U+095F, U+0971, U+0973 to U+097F.
  - IBM Plex Mono: U+25CB, U+25CF only.
