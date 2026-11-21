# Implementation Plan: Design and UX Pass

## Overview

The language is TypeScript (React, CSS Modules, inline SVG), as in the design. Work runs on the branch `auto/build` in this order: Stage 0, Stage A, Stage B, Stage C, Stage D, then the final tasks. Each of the five stages ends with one gate task that runs `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run check-bundle` and `npm run check:browser`, and then makes one commit. If any of those commands fails, the stage is not committed, the cause is fixed, and the commands run again. No check or test is edited so that it passes.

The design has no Correctness Properties section, and you asked for no new property tests. Every test in this plan is an example test. No existing property test is touched or weakened.

Rules that apply to every task:

- Follow the glossary and the naming rules in the design: `WeftProgress` (not a "thread" name), class `punchedHole` (never `hole` alone), `strip` or `group` (never `row`), and "side by side" and "stacked" in comments (never horizontal or vertical). `tests/structure/glossaryTerms.test.ts` and `tests/structure/cardDimensions.test.ts` run in every gate.
- No card dimension, hole count, pitch or hole position is written as a literal in any drawing, layout or style. Every such value comes from the Card_Profile.
- No new runtime or dev dependency. Each new Hindi key in `hi.json` carries `"reviewed": false`, and `npm run review-list` regenerates `docs/HINDI_REVIEW.md` before the gate.
- When an existing test or check has to be re-aimed, the assertion keeps the same strength, and the old selector, the new selector and the reason are added to `.kiro/specs/design-and-ux-pass/measurements.md` for the Build_Log (Requirements 22.1 to 22.3).
- Stage commits add only the files this pass changed, by name. Never `git add -A`. `media/loom-mcp-connected.png` and `media/loom-mcp-validate-profile.png` stay untracked unless task 5.7 says otherwise.

## Tasks

- [ ] 1. Stage 0: screenshot tooling, "before" screenshots and baseline numbers
  - [x] 1.1 Move the Check_Browser plumbing into `scripts/checks/session.ts`
    - Move `Page`, `freePort`, `startPreview`, `startChrome`, `openPage`, `Cleanup` and `sleep` out of `scripts/check_browser.ts` into `scripts/checks/session.ts` with no change of behaviour. `check_browser.ts` imports them and changes in no other way, so its 13 steps run exactly as before.
    - Add `tests/scripts/session.test.ts`: an example test that reads the source of `session.ts` and `check_browser.ts` and checks that `session.ts` exports each moved name and `check_browser.ts` no longer declares them.
    - _Requirements: 22.1, 22.3, 24.1_
  - [x] 1.2 Add the pure screenshot helpers in `scripts/checks/screenshots.ts`
    - Export `SCREENSHOT_VIEWS` (`weave-landing`, `weave-sample`, `weave-lost`, `keep-versions`, `scan`, `code-diff`, in that order), `SCREENSHOT_THEMES` (`day`, `night`), `SCREENSHOT_WIDTHS` (320, 1280), `screenshotNames()` (the 24 names `<view>-<theme>-<width>.png`) and `setProblems(files)`.
    - `setProblems` returns one text for each missing file, each extra file, each file that is not a PNG (check the 8-byte signature) and each file whose IHDR width differs from its `<width>`.
    - Add `tests/scripts/screenshots.test.ts` with example tests: the 24 names in order, a missing file, an extra file, a non-PNG, a wrong width, and a valid set returning no problem.
    - _Requirements: 24.3, 24.10, 24.11_
  - [x] 1.3 Add the `npm run screenshots` command in `scripts/screenshots.ts`
    - Add the script entry `"screenshots": "node scripts/screenshots.ts"` to `package.json` (no dependency). The command takes `before` or `after` and writes under `media/design/before/` or `media/design/after/`.
    - For each width call `Emulation.setDeviceMetricsOverride({ width, height: 800, deviceScaleFactor: 1, mobile: false })` and capture the full page with `Page.captureScreenshot({ captureBeyondViewport: true, clip })`, with the height from `Page.getLayoutMetrics`. Language is English. Emulate `prefers-reduced-motion: reduce` before the first navigation.
    - Mode `before` sets `data-theme` to `night` for the Night_Loom files and leaves it unset for Day_Loom. Mode `after` chooses the theme only by activating the Theme_Switch (found by its accessible name) and never sets the attribute itself. Selectors must work in both modes: find a sample control by its visible name when `[data-sample]` is absent, and open a Disclosure by its accessible name only when one is present.
    - Prepare each view and end each preparation by waiting for a named element, never a fixed sleep: Weave landing (fresh load), Weave with the diamond sample, Weave with lost cards (the lost-cards sample, then the repair suggestion button, then the `repair.heading` text), Keep with versions (save a design, then save a second version with a note, so one design has 2 versions), Scan (no card), Code view with a diff (two versions chosen, Compare pressed, changed picks not 0).
    - Write each file as soon as it is taken. At the end run `setProblems` over the directory, name each missing or failed file, keep every file already saved, and exit non-zero when there is any problem.
    - _Requirements: 24.1, 24.3, 24.4, 24.5, 24.6, 24.9, 24.10, 24.11_
  - [x] 1.4 Make `scripts/check_bundle.ts` print every JavaScript chunk
    - Print one line for every JavaScript file in `dist/assets` with its file name and gzipped size in bytes (level 9), then keep the existing Entry_Chunk limit of 204,800 bytes with the `>=` test, the failure message that names the file, its size and the limit, and the Scan-only marker checks. Change no existing assertion.
    - Put the line formatting in a small pure function and add an example test for it in `tests/scripts/`.
    - _Requirements: 15.1, 15.3, 15.5, 15.6_
  - [x] 1.5 Record the baseline numbers in `.kiro/specs/design-and-ux-pass/measurements.md`
    - Create the file with these headings: Baseline bundle, Licence record, Font_Weight_Report, Contrast table, Benchmark, Changed selectors, Hindi wrapping fixes, After inspection, Keys with equal Hindi one and other text, Disclosure check changes, Notes for the final report.
    - Run `npm run build` and `npm run check-bundle`. Under "Baseline bundle" write the file name and gzipped bytes of the Entry_Chunk and of every other JavaScript chunk, as printed, labelled "before Stage A".
    - _Requirements: 15.3_
  - [x] 1.6 Take the 24 "before" screenshots
    - Run `npm run build`, then `npm run screenshots -- before`. Check that `media/design/before/` holds exactly the 24 valid files, and that `weave-lost-*` show at least 1 lost card and the repair panel, `keep-versions-*` show a design with 2 or more versions, and `code-diff-*` show at least 1 changed pick.
    - If a capture fails, fix `scripts/screenshots.ts` and run again. No file under `src/`, `public/` or `index.html` may change before this task passes.
    - _Requirements: 24.1, 24.3, 24.4, 24.5, 24.9, 24.10, 24.11_
  - [-] 1.7 Stage 0 gate and commit
    - Run `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run check-bundle` and `npm run check:browser`; all must exit 0 with no test newly skipped.
    - Commit on `auto/build` with the message `Stage 0: screenshot tooling and before screenshots`, adding by name: `scripts/checks/session.ts`, `scripts/checks/screenshots.ts`, `scripts/screenshots.ts`, `scripts/check_browser.ts`, `scripts/check_bundle.ts`, `package.json`, the new files under `tests/scripts/`, `media/design/before/`, and `.kiro/specs/design-and-ux-pass/` (the three spec files and `measurements.md`).
    - _Requirements: 22.6, 22.7, 22.8, 24.1, 24.10, 25.2_

- [ ] 2. Stage A: foundation (fonts, tokens, theme switch, contrast, base components, signature details)
  - [~] 2.1 Write the font tooling under `scripts/fonts/`
    - Add `codepoints.ts` (reads every string value of `en.json` and `hi.json` and the three Sample_Design names; writes the Latin-and-symbols list and the Devanagari list; adds U+0900 to U+097F, U+200C, U+200D and U+25CC for Rozha One and Hind only), `woff2Cmap.ts` (parses the woff2 table directory, inflates the Brotli stream with `node:zlib`, reads the `cmap` table formats 4 and 12 and returns the covered code points), `report.ts` (bytes before and after for each file, the sum, and the code points each source font lacks, written to `missing-glyphs.json`), `subset.sh` and `README.md`.
    - `subset.sh` downloads the four `.ttf` files and three `OFL.txt` files from `raw.githubusercontent.com/google/fonts/<ref>/ofl/{rozhaone,hind,ibmplexmono}/` into `scripts/fonts/source/` with a pinned commit SHA, then runs `pyftsubset` with `--flavor=woff2 --layout-features='*' --no-hinting` into `public/fonts/`. `README.md` gives the one-time `python3 -m venv /tmp/naqsha-fonts` and `pip install fonttools brotli` setup. Add `scripts/fonts/source/` to `.gitignore`. Nothing here is part of `npm run build`.
    - Names in code follow the glossary (no "column" or "row" in identifiers or comments).
    - _Requirements: 1.5, 1.6, 2.3, 2.5_
  - [~] 2.2 Subset the fonts, check the licences and record the report
    - Run the setup and `scripts/fonts/subset.sh`. Commit exactly four woff2 files (`RozhaOne-Regular`, `Hind-Regular`, `Hind-Bold`, `IBMPlexMono-Regular`) and three licence texts (`RozhaOne-OFL.txt`, `Hind-OFL.txt`, `IBMPlexMono-OFL.txt`) under `public/fonts/`, plus `scripts/fonts/missing-glyphs.json`.
    - Under "Licence record" in `measurements.md`, write for each font the licence name, the source URL and the check date (YYYY-MM-DD), and the pinned commit SHA. If a licence is not SIL OFL 1.1 or equivalent, do not copy that font, record it, and ask the user.
    - Under "Font_Weight_Report", write each file's size before and after subsetting and the sum after, typed from the `report.ts` output. If the sum is above 307,200 bytes, list each file above 51,200 bytes and the ranges and weights that could go, and ask the user whether to accept the total before continuing.
    - Record each code point a source font lacks (expected: `●` and `○` in `repair.legend`) under "Notes for the final report".
    - _Requirements: 1.1, 1.5, 1.6, 2.1, 2.2, 2.3, 2.5, 2.6_
  - [~] 2.3 Check the fonts in the Precache and in the files
    - Add `scripts/checks/fonts.ts` with `FONT_FILES` (the four `./fonts/*.woff2` entries) and `fontPrecacheProblems(entries)`, which names each missing file. Call it in `scripts/check_bundle.ts` next to the unchanged `precacheProblems`, so a missing Font_File exits non-zero and is named.
    - Add `tests/scripts/fonts.test.ts`: `woff2Cmap` on the four committed files covers every Devanagari code point of `hi.json` in the two Hind files and in Rozha One; the other required code points are covered unless listed in `missing-glyphs.json`; there are exactly four woff2 files; each licence text is non-empty; `fontPrecacheProblems` names a missing file and returns nothing for a full list.
    - Confirm the existing `tests/scripts/precache.test.ts` and Offline_Check tests pass unchanged.
    - _Requirements: 1.1, 1.5, 1.6, 1.7, 1.8, 1.12, 2.3_
  - [~] 2.4 Write the complete tokens in `src/ui/theme/tokens.css`
    - Keep the file the only non-module style sheet. In this order: four `@font-face` rules (family, weight, `font-display: swap`, `src: url('/fonts/<file>') format('woff2')`, no `unicode-range`, no preload), the `:root` block, the `[data-theme='night']` block, base element rules, the focus ring, the Graph_Paper_Ground, and the existing reduced-motion rule. Keep no `}` inside comments or values of the two token blocks.
    - Tokens: `--font-display`, `--font-body`, `--font-data` with exactly the strings of Requirement 1.3; six `--text-*` (14, 16, 18, 22, 28, 36 px); seven `--space-*` (4, 8, 12, 16, 24, 32, 48 px); `--radius-control` 4px and `--radius-panel` 8px; one `--shadow-card`; three `--motion-*` (120, 200, 320 ms); `--touch-target: 48px`, `--leading-body: 1.5`, `--leading-hindi: 1.7`; `--on-zari` and `--on-hole` in both themes. Keep Day `--zari` at `#B0800A`. No other token uses the prefixes `--text-`, `--space-`, `--radius-`, `--shadow-` or `--motion-`.
    - Base rules: `html { font-size: 18px }`; body font, line height and `html[lang='hi']` line height; `td, th, [data-tabular] { font-variant-numeric: tabular-nums }`; `:focus-visible` with a 3px `--zari` outline and 2px offset; `[data-theme='night'] { color-scheme: dark }`; the Graph_Paper_Ground as two hard-stop `linear-gradient` layers on `body` at 8px spacing in `--line` (the only gradient in the App).
    - Add `tests/ui/theme/tokens.test.ts`: the four `@font-face` rules and their relative `src` files exist in `public/fonts`; the three `--font-*` strings; the counts and values of the five token groups; root size 18px; both line heights; `tabular-nums`; the focus ring; the grid rule. The existing tokens-versus-`THEME_TOKENS` test must pass unchanged.
    - _Requirements: 1.2, 1.3, 1.9, 3.1, 3.2, 3.3, 3.5, 3.7, 3.9, 3.10, 3.12, 6.3, 7.1, 15.2, 23.3_
  - [~] 2.5 Extend the Contrast_Table in `src/ui/theme/contrast.ts`
    - Add `on-zari` and `on-hole` to `TokenName` and to `THEME_TOKENS` for both themes, with the same values as `tokens.css`. In `TOKEN_PAIRS`, replace the `ink`/`hole`-on-`zari` pair by `on-zari` on `zari`, and add `hole` on `card` (3:1), `on-hole` on `hole` (4.5) and `ink-soft` on `ground` and on `surface` (3:1), so every pair named in Requirement 5.1 is listed for both themes.
    - Export `truncateRatio(ratio)`, which gives two decimals, truncated and never rounded up.
    - Add `scripts/contrast_report.ts`, which prints every pair in both themes with `truncateRatio`, and flags any pair below its minimum. If a pair is below its minimum, record the pair, the two colours, the ratio and a proposed value under "Contrast table" in `measurements.md`, and use the new value in `tokens.css` and `THEME_TOKENS` together.
    - Add `tests/ui/theme/truncate.test.ts` with examples: 4.55 gives "4.55", 4.499 gives "4.49", 4.5 gives "4.50". The existing contrast test runs unchanged and names the pair, theme and ratio on failure.
    - _Requirements: 3.11, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 6.8_
  - [~] 2.6 Apply the theme before the first paint
    - Add `src/ui/theme/theme.ts` with `THEME_STORAGE_KEY = 'naqsha.theme'`, `chooseTheme(stored, prefersDark)` (a stored `day` or `night` wins; otherwise dark gives `night`; otherwise `day`) and `applyTheme(root, theme)` (no-op when `root` is null).
    - In `src/ui/platform/browser.ts` add `readStoredTheme(storage)`, `storeTheme(storage, theme)` (follow `readStoredLanguage` and `storeLanguage`; never throw) and `browserPrefersDark()` (false when `matchMedia` is missing or throws).
    - Add the one inline classic script from the design to `index.html` `<head>`, before the module script. Make `scripts/check_bundle.ts` fail unless `dist/index.html` has that script before the module script and the stylesheet link.
    - Add `tests/ui/theme/theme.test.ts`: `chooseTheme` for every stored and unstored case; the script from `index.html` run in `node:vm` with fake `localStorage` and `matchMedia` agrees with `chooseTheme` for stored `day`, stored `night`, a bad stored value, dark, light, no preference, a throwing `matchMedia` and a throwing `localStorage`; the script sits before the module script.
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.12_
  - [~] 2.7 Build Button, ButtonLink, Panel, Field, Tabs and Notice
    - Create `src/ui/components/` with one `.tsx` and one `.module.css` for each, as in the design: `Button` (variants primary, secondary, quiet; default `type="button"`; native `disabled` with a dashed border and no fill; 48 by 48 px minimum; text `--on-zari` on `--zari` in every state), `ButtonLink` (an `<a>` with the Button look and `onActivate`), `Panel` (opaque `--surface`, 1px `--line`, `--radius-panel`), `Field` (renders `<label><span>{label}</span>{children}</label>`; control borders `--ink-soft`; 48px height), `Tabs` (toggle buttons with `aria-pressed`, bold text and a drawn check mark on the current choice) and `Notice` (four variants, a different word and a different drawn icon in each, 2px variant border, `role="alert"` by default for `error` only, optional `action`).
    - Every colour is a token, every duration is a motion token, and the only shadow is `var(--shadow-card)`. Add keys `notice.information`, `notice.success`, `notice.warning` and `notice.error` to `en.json` and `hi.json`.
    - Add `tests/ui/components/components.test.tsx` with server-rendered example tests: Button variants and disabled markup; Notice variants differ by word and icon and only `error` has `role="alert"`; Tabs `aria-pressed` and mark; Field markup `<label><span>`; Panel is opaque.
    - _Requirements: 4.10, 5.1, 5.7, 6.1, 6.2, 6.3, 6.4, 6.8, 6.9, 6.10, 7.2_
  - [~] 2.8 Build WeftProgress and the delayed-progress helper
    - Add `components/WeftProgress.tsx` and its module: visible text and a drawn thread on a `--line` track in an `<svg>`; the thread draws across with an animation of `calc(var(--motion-long) * 4)`; reduced motion shows it fully drawn; no role (the text states the progress).
    - Add `components/delay.ts` with `startDelay(ms, onElapsed, timers)` that returns a cancel function, and the hook `useAfterDelay(active, 300)` that uses it with injected timers. Add keys `progress.reading`, `progress.exporting` and `progress.saving` to both Translation_Files.
    - Add `tests/ui/components/weftProgress.test.tsx`: the markup has visible text and no role; `startDelay` with a fake clock fires once at 300 ms and not at 299 ms, and cancels; the module has no animation outside a motion token.
    - _Requirements: 7.4, 7.5, 23.4_
  - [~] 2.9 Build ThemeSwitch and Selvedge, and wire them into the Shell
    - Add `components/ThemeSwitch.tsx` (`<button role="switch" aria-checked>`; a drawn sun or moon with different shapes, `aria-hidden`; visible `theme.label` text and `theme.on` or `theme.off`; at least 48 by 48 px; text may wrap) and `components/Selvedge.tsx` (an inline `<svg>` 6 px high, a `<pattern>` of `<rect>`s alternating `--zari` and `--madder`, no gradient, no image, `overflow: hidden` on the header). Add keys `theme.label`, `theme.on` and `theme.off` to both files.
    - In `src/ui/App.tsx` keep `theme` in `useState` from `chooseTheme(readStoredTheme(...), browserPrefersDark())` and apply it with `useLayoutEffect(() => applyTheme(document.documentElement, theme), [theme])`. The theme is not in the `AppState` reducer. `Shell` gets `theme` and `onThemeChosen`; the handler calls `storeTheme` and then sets state, and a refused store shows nothing.
    - Put the Selvedge as the first child of `<header>`, replace the language switch by `Tabs`, put the ThemeSwitch beside it, and make the header wrap into stacked groups at 320 px. Keep the `<nav aria-label>`, the four nav buttons and the one `role="status"` live region as they are. Update `Shell.module.css`.
    - Add `tests/ui/components/themeSwitch.test.tsx`: `role="switch"`, `aria-checked` follows the theme, visible state text, and a reducer test showing the theme change touches no `AppState` field.
    - _Requirements: 4.1, 4.2, 4.9, 4.11, 6.10, 7.3, 7.7, 9.5, 23.5, 23.6_
  - [~] 2.10 Move the four Screens onto the shared components
    - Replace every raw `<button>`, field, panel and message block in the Weave, Keep, Scan and Code view Screens, and the Shell banner, by `Button`, `Field`, `Panel`, `Tabs` and `Notice`. Remove every colour, background, border and radius declaration for a button element or button class from the four Screen `.module.css` files.
    - Choose the one primary Button of each Screen in every state: Weave "Play" (or "Resume"), Keep the export button (Save is secondary), Scan choose-a-photo (Accept after a read), Code view "Compare". Where a Screen has no such control in a state, it shows no primary Button.
    - Keep every accessible name, role, `aria-*` attribute, data attribute and test id that a test under `tests/` or a script under `scripts/` uses, with the same value. Where one must change, re-aim the test or check at the same strength and note the old selector, new selector and reason under "Changed selectors" in `measurements.md`.
    - _Requirements: 6.5, 6.6, 6.7, 22.1, 22.2, 22.3_
  - [~] 2.11 Add the style and primary-Button example tests
    - Add `tests/ui/theme/styles.test.ts`, which reads every `src/ui/**/*.module.css` and the illustration and component sources: no `gradient(`, `backdrop-filter` or `blur(`; every `box-shadow`, `text-shadow` and `drop-shadow(` value is `var(--shadow-card)`; every `transition` and `animation` duration is `var(--motion-*)` or a `calc()` whose operands are only such `var()`s and bare numbers; no colour literal (hexadecimal, `rgb()`, `hsl()` or colour keyword) outside `tokens.css`; no emoji; no button selector or `.button` class that sets colour, background, border or radius in the four Screen modules.
    - Add `tests/ui/screens/primaryButton.test.tsx`: render each of the four Screens in its empty, loading, error and with-content states (the states that exist today) and check that no Screen shows more than one primary Button.
    - _Requirements: 3.6, 3.8, 3.13, 4.10, 6.5, 6.6, 7.6, 7.8, 14.8_
  - [~] 2.12 Extend `scripts/check_browser.ts` with the Stage A steps
    - Add steps, all additive: switch the theme through the Theme_Switch, reload, and check `data-theme` and the `localStorage` text; record every request origin through `Network.requestWillBeSent` while the four Screens load in both languages and both themes, and expect only the page's own origin and no image request except the favicon and manifest icons; in the offline step read `document.fonts` and expect `loaded` for every family and weight the shown Screens use; extend the no-horizontal-scroll step to the Code view, to Hindi and to the Night_Loom.
    - Remove, skip or loosen no existing assertion.
    - _Requirements: 1.4, 1.10, 4.3, 4.5, 7.7, 14.10, 22.3, 23.2_
  - [~] 2.13 Stage A gate and commit
    - Run `npm run review-list`, then `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run check-bundle` and `npm run check:browser`; all must exit 0 with no test newly skipped. Run `npm run build && node scripts/contrast_report.ts` and write the table under "Contrast table" in `measurements.md`.
    - Commit with the message `Stage A: fonts, tokens, theme switch and base components`, adding the changed files by name (`src/ui`, `public/fonts`, `index.html`, `scripts`, `tests`, `docs/HINDI_REVIEW.md`, `.gitignore`, `measurements.md`).
    - _Requirements: 22.6, 22.7, 22.8, 25.1, 25.2_

- [ ] 3. Stage B: understanding (Landing, navigation, disclosure, states, translations)
  - [~] 3.1 Build Disclosure, ScreenIntro, EmptyState, StateMessage and LoadingState
    - Add `components/Disclosure.tsx`: a `<button aria-expanded aria-controls>` followed by `<div id hidden={!expanded}>`; collapsed on mount unless `expanded` is given; controlled use through `expanded` and `onToggle`; the content stays mounted so entered values are kept; Escape inside the panel collapses it and focuses the button.
    - Add `ScreenIntro({ purpose, next })` (two `<p>` lines), `EmptyState` (a Panel with an optional decorative illustration, a message and a next-step sentence), `StateMessage` (a Notice or an EmptyState, with an optional retry that is a secondary Button of at least 48 px) and `LoadingState` (`<div role="status">` with text and a WeftProgress, mounted only while loading).
    - Add keys `disclosure.more`, `disclosure.settings`, `state.retry`, `status.screen`, `keep.list.empty.next` and `scan.batch.empty.next` to both Translation_Files.
    - Add example tests to `tests/ui/components/` for: Disclosure collapsed by default with `aria-expanded="false"` and `hidden` content still present; expanded when given; the retry Button markup; LoadingState has `role="status"`.
    - _Requirements: 6.1, 10.1, 10.6, 10.9, 10.10, 10.11, 10.12, 11.4, 11.9, 11.10_
  - [~] 3.2 Add the navigation icons and the "Advanced" word
    - Add `src/ui/illustrations/NavIcons.tsx` with four different `aria-hidden` icons. In the Shell each nav button renders the label first, then the icon (moved in front by CSS `order: -1`), and for Code view only a `<span>` with the new key `nav.advanced` (added to both files; `nav.code` unchanged).
    - The current item has `aria-current="page"` and no other item has `aria-current`; it differs by bold text, a 3px underline and a filled `--zari` background with `--on-zari` text. Every item is at least 48 by 48 px, always in the DOM, never inside a menu.
    - Add `tests/ui/screens/navigation.test.tsx`: four items, one `aria-current`, icons `aria-hidden`, `nav.advanced` on Code view only, the label is the first text of each button, and `tests/ui/screens/shell.test.tsx` still passes unchanged.
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6, 9.7, 9.8, 9.9, 9.10, 9.11_
  - [~] 3.3 Split the Weave screen and build the Landing
    - Split `WeaveScreen.tsx`: the outer `WeaveScreen` chooses between `Landing` (no pick in the Current_Pattern) and a new `WeavePlayer.tsx` that holds today's body unchanged. The player's cloth-measuring effect stays in `WeavePlayer`.
    - Add `Landing.tsx` (and its module) in DOM order: `<h2 id="screen-title">` with `nav.weave`; the headline `landing.headline` in `--font-display`; `ScreenIntro` with `weave.purpose` and `weave.empty`; a slot for the Hero_Loom (empty until Stage C); the Step_Strip as an `<ol>` of three labelled steps (icons are added in Stage C); the Sample_Tiles; the `ButtonLink` to Scan after the last tile. While the profile is loading show `LoadingState`; when it failed show an error `StateMessage` with retry in place of the tiles.
    - A Sample_Tile is one `<button type="button" data-sample="diamond">` (the name, a `ClothPreview`, and a "Try it" span from `landing.tile.try`). The first tile uses the primary Button classes, the other two the secondary ones. Activation dispatches `{ type: 'request-sample', design, pattern: generateSample(profile, design) }`. Add `data-sample` to the sample buttons in `TryIt.tsx`.
    - Add `ClothPreview.tsx`: a small `<canvas>` that runs `prepareCloth`, `parseRenderSettings`, `renderFrame` and `paintToCanvas` from the tile's own Pattern; on any failure it renders nothing and the tile keeps its name, its "Try it" label and its activation, with no Notice.
    - Add keys `landing.headline`, `landing.step.scan`, `landing.step.weave`, `landing.step.keep`, `landing.steps.name`, `landing.tile.try` and `landing.scanLink` to both files.
    - Re-aim the four existing assertions in `tests/ui/screens/weave.test.tsx` (R2.8, R3.8: render `arrivedWith('diamond')`; R4.1, R2.12: check the sample buttons on `<TryIt>` rendered alone) at the same strength, and log them under "Changed selectors".
    - Add `tests/ui/screens/landing.test.tsx`: headline, three steps in order, three tiles with `data-sample`, one primary and two secondary, the scan link last, no forbidden word ("bitmap", "matrix", "decode", "threshold", "grid detection", "Canvas", and the Hindi equivalents in `hi.json`) in text or accessible names in both languages, the loading and failed-profile states, a tile dispatches `request-sample` with the sample's own Pattern, and a failing preview keeps the tile.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.11, 8.12, 8.13, 8.14, 22.1, 22.2_
  - [~] 3.4 Structure the Weave player with an intro and a Settings Disclosure
    - In `WeavePlayer.tsx` add `ScreenIntro` (`weave.purpose`, `weave.nextStep`). Keep the cloth, the current card slot, the pick counter, the playback controls, the scrubber and the speed control outside a Disclosure. Put the repeat count, warp colour, weft colour and zari inside one Disclosure labelled `disclosure.settings`. Play (or Resume) is the one primary Button.
    - Add the two keys to both Translation_Files. Keep the pick counter markup with `data-tabular`.
    - _Requirements: 6.5, 10.1, 10.2, 10.6, 10.9_
  - [~] 3.5 Structure the Keep screen
    - In `KeepScreen.tsx` add `ScreenIntro` (`keep.purpose`, `keep.nextStep`). Keep the name field, Save and the export panel with its primary export button outside a Disclosure. Put the export options (bit depth, lift colour, order of picks, order of ends) and the other metadata fields in one Disclosure labelled "More".
    - Show the empty list as an `EmptyState` (`keep.list.empty` and `keep.list.empty.next`), without an illustration until Stage C. Show an Archive failure as an error `StateMessage` with a 48 px retry that repeats the same handler (list refresh, or Save with the form as it is) and leaves every saved design unchanged.
    - Add `keep.purpose` and `keep.nextStep` to both Translation_Files.
    - _Requirements: 6.5, 10.1, 10.3, 10.6, 11.1, 11.10_
  - [~] 3.6 Structure the Scan screen
    - In `ScanScreen.tsx` add `ScreenIntro` (`scan.purpose`, `scan.nextStep`). Put choose-a-photo first in reading order and outside a Disclosure; put zoom, undo, accept, discard, the batch controls and the camera in one controlled `Disclosure` that starts collapsed and is opened by the screen when a read completes. Choose-a-photo is the primary Button while no card is read; Accept is the primary Button after a read, and choose-a-photo is then secondary.
    - Show the empty batch as an `EmptyState` (`scan.batch.empty`, `scan.batch.empty.next`). Show a card that cannot be read as an error `StateMessage` for that card only: the other cards in the batch and the Current_Pattern are unchanged and choose-a-photo stays usable. Where the code already dispatches `announce` for the failure, render the message with no role; otherwise use `role="alert"`. Never move focus to the message.
    - Add `scan.purpose` and `scan.nextStep` to both files.
    - _Requirements: 6.5, 10.1, 10.5, 10.6, 11.1, 11.11, 11.12_
  - [~] 3.7 Structure the Code view
    - In `CodeViewScreen.tsx` add `ScreenIntro` (`codeview.purpose`, `codeview.nextStep`), place the compare panel directly under the intro and above the pick controls, and make Compare the one primary Button. Show nothing-to-compare as an `EmptyState` (`codeview.empty`). Show an Archive failure as an error `StateMessage` with a 48 px retry. Add `codeview.purpose` and `codeview.nextStep` to both files.
    - _Requirements: 6.5, 10.1, 11.1, 11.10, 23.7_
  - [~] 3.8 Move the Shell and App states onto StateMessage and LoadingState
    - In `src/ui/ProfileNotice.tsx` keep the Card_Profile name and the UNVERIFIED status notice outside a Disclosure and put the Card_Profile details inside one.
    - In `App.tsx` replace the failed-profile banner by an error `StateMessage` and the loading text by `LoadingState`. Add `profileAttempt` in `useState` as a dependency of the effect that calls `loadProfile`; the retry dispatches `{ type: 'profile-loaded', state: { status: 'loading' } }` and increments it. Replace the two `lazy()` calls by `useLazyScreen(importer, attempt)` (a new `lazy` component per attempt through `useMemo`), give `ScreenBoundary` an `onRetry` that increments the attempt and remounts the Screen, and use `LoadingState` (`status.screen`) as the `Suspense` fallback. A retry changes none of the Shell navigation, the Current_Pattern, the Scan_Batch or any saved design. Keep exactly one persistent Shell `role="status"` region.
    - Add example tests in `tests/ui/screens/` that render the failed-profile, loading and screen-failed states and check the retry control and the navigation.
    - _Requirements: 8.11, 8.13, 10.4, 11.1, 11.9, 11.10, 11.12, 23.6_
  - [~] 3.9 Wire the delayed Thread_Progress
    - Use `useAfterDelay(active, 300)` in the Scan read, the export and the save so a `WeftProgress` with `progress.reading`, `progress.exporting` or `progress.saving` shows only after the operation has run for 300 ms.
    - Add example tests with a fake clock: nothing shows before 300 ms, the text shows after, and it is gone when the operation ends.
    - _Requirements: 7.4, 7.5_
  - [~] 3.10 Check state messages, intro lines and Hindi keys with an example test
    - Add `tests/ui/state/stateMessages.test.ts` with a named list `STATE_MESSAGE_KEYS` (every state-message key in the design table): each English text is at most 160 characters, has one to three sentences, and contains none of "bitmap", "matrix", "decode", "decoded" or "decoding" (any letter case) outside the Code view; each key is in both files; each `hi.json` key added by this pass has `"reviewed": false`; both files have the same keys. Shorten any message over the limit with its meaning kept.
    - In the same file check each of the eight intro keys (`weave`, `keep`, `scan`, `codeview` purpose and next step) is one sentence of at most 100 characters in both languages.
    - _Requirements: 10.1, 11.1, 11.2, 11.3, 11.6, 11.7, 11.8_
  - [~] 3.11 Update `scripts/check_browser.ts` for the Disclosures and the Landing
    - Add `openDisclosure(page, name)`: find the button by its accessible name, click it when `aria-expanded` is `false`, and otherwise throw `the Disclosure "<name>" was not found`. Make `chooseSample` click `[data-sample="<design>"]`. Open "More" before the Keep steps that fill the place field or choose export options, and open "Settings" before the Weave steps that change the colours or the repeat.
    - Add one step that reads `getBoundingClientRect().bottom` of the headline, the Step_Strip and the first tile at 390 by 844 in English and in Hindi and expects them within 700 px, and that starts a sample from a tile; add a step that checks the primary Button of each Screen is within the first 844 px at 390 by 844.
    - List each changed step under "Disclosure check changes" in `measurements.md` with the old selector, the new selector and the reason. No existing assertion is removed or loosened.
    - _Requirements: 8.10, 10.7, 10.8, 22.2, 22.3, 23.7_
  - [~] 3.12 Stage B gate and commit
    - Run `npm run review-list`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run check-bundle` and `npm run check:browser`; all must exit 0 with no test newly skipped.
    - Commit with the message `Stage B: landing, navigation, disclosure and states`, adding the changed files by name.
    - _Requirements: 22.6, 22.7, 22.8, 25.1, 25.2_

- [ ] 4. Stage C: illustrations, bundle numbers, "after" screenshots and inspection
  - [~] 4.1 Add `cardGeometry` in `src/ui/illustrations/cardGeometry.ts`
    - Export the `CardGeometry` type and `cardGeometry(profile)`, which calls `validateCardProfile` from `src/codec` and returns `{ ok: false }` for an invalid profile. Build the hook centres with the exported `hookCentreMm` from `printable/layout.ts`. The punched positions come from `validateCardGrid(profile, grid)` returning no violation. No card dimension is written as a literal.
    - Add `tests/ui/illustrations/cardGeometry.test.ts`: the demo profile's size, hook centres, hole diameter, the two peg holes with their own diameters and the lacing holes come from the profile; a second profile with other values gives other numbers; an invalid profile returns `{ ok: false }`.
    - _Requirements: 12.2, 12.3, 12.5, 12.12_
  - [~] 4.2 Add `heroLayout` and `heroPose`
    - In `heroLayout.ts` export `heroLayout(profile)` returning the viewBox size, the card box and the x of each end (`MARGIN_UNITS + i * END_PITCH_UNITS`), with `LIFT_UNITS`, `PRESS_UNITS` and `END_PITCH_UNITS` as drawing units.
    - In `heroPose.ts` export `heroPose(profile, pattern)`: the first pick with at least one punched hook position, checked with `validateCardGrid`, encoded with `encodeCardGrid`, returning `{ kind: 'lifted', pickIndex, grid, liftedEnds, endsPerPick }`, or `{ kind: 'plain' }` when no pick qualifies, the grid does not match, or encoding fails. Each lifted end is the end its hook position maps to.
    - Add `tests/ui/illustrations/heroPose.test.ts`: the first pick with a punched hook position is chosen; the lifted-end count equals that pick's punched count and each sits at its encoded end; a Pattern with no usable pick, a mismatching grid and an empty Pattern return `plain`; the layout has one x per end.
    - _Requirements: 13.2, 13.10_
  - [~] 4.3 Build CardDrawing, CardFace and the CardThumb wrapper
    - Add `CardDrawing.tsx`, `CardFace` (the part shared with the Hero_Loom) and `CardDrawing.module.css` with the props in the design. The `<svg>` has `viewBox` from the profile size and `width: 100%`. It draws the stock `<rect>` (no `rx`, corner radius 0, 1px `--ink-soft` outline with `vector-effect: non-scaling-stroke`), one `<circle class="punchedHole">` per punched hook position, the two peg holes, the lacing holes, and with `marks="rings"` an `unpunchedMark` circle per unpunched position. The shadow is `box-shadow: var(--shadow-card)` on the `<figure>`. Wrap in `React.memo`.
    - Cases: invalid profile draws no card and shows `card.cannotDraw`; a grid that does not match draws stock, peg holes and lacing holes with `card.mismatch` in `<desc>`; `damaged` or `missing` draws a `--madder` hatch gap and a `<figcaption>` with `card.damaged` or `card.missing`; `adjacentText` false gives `role="img"` with `<title>` and `<desc>`; `adjacentText` true gives `aria-hidden="true"` with neither. Keep `CardThumb` as a thin wrapper so existing imports work.
    - Add keys `card.title`, `card.desc`, `card.damaged`, `card.missing`, `card.mismatch` and `card.cannotDraw` to both files.
    - Add `tests/ui/illustrations/cardDrawing.test.tsx`: the number of `punchedHole` circles equals the punched count; centres and radius equal the geometry for the demo profile and for a second profile; corner radius 0; the mismatch and invalid-profile cases do not throw; the `aria-hidden` and `role="img"` cases; the damaged and missing text; no colour literal in the module. `tests/ui/screens/cardDrawing.test.tsx` still passes unchanged.
    - _Requirements: 3.4, 4.11, 12.1, 12.2, 12.3, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12_
  - [~] 4.4 Replace every earlier card picture with CardDrawing
    - In `WeavePlayer.tsx` draw the current card of the shown pick with `CardDrawing` beside the cloth from 720 px and below the playback strip on narrow screens (`adjacentText` false; the last card while finished). In `scan/BatchList.tsx` use `CardThumb` with `label` set to the existing `scan.batch.thumb.alt` text. In `RepairPanel.tsx` remove the old `CardDrawing` and use the new one with `marks="rings"` and `label` set to the existing `repair.draw` text. Show a lost card with `state="missing"` or `"damaged"`. `CardOverlay` stays, because it marks sampled positions on a photograph.
    - Re-aim `tests/ui/screens/repair.test.tsx` R3.2 from `fill="currentColor"` and `fill="none"` to: `punchedHole` circles equal the punched count, `unpunchedMark` circles equal the unpunched count, and the `aria-label` and the legend are unchanged. Log the old and new selector under "Changed selectors".
    - Add an example test that no old card picture remains in `src/ui` (the old drawing's name or markup is not found outside the new component).
    - _Requirements: 12.4, 12.10, 12.11, 22.1, 22.2, 22.3_
  - [~] 4.5 Build the HeroLoom and add it to the Landing
    - Add `HeroLoom.tsx` and `HeroLoom.module.css`: a Jacquard head frame, the card through `CardFace`, a needle, a hook and a warp line for each end, and a weft bar. Hooks and ends of the lifted pose get `hookRaised` and `endLifted`, translated up by `--lift` from `LIFT_UNITS`, so raised and resting differ by position, and also by colour (`--zari` against `--indigo`).
    - One Lift_Cycle with `animation-iteration-count: 1` and duration `calc(var(--motion-long) * 6)`: the card presses by `PRESS_UNITS`, the raised hooks and lifted ends rise, the weft bar passes, everything returns to rest. The element is never remounted by a re-render or a language change. Under reduced motion (`data-motion="still"` from `AppState.prefersReducedMotion`, and the `@media` rule) the base transform is the lifted pose and nothing animates.
    - `role="img"` with `aria-labelledby` pointing at `<title>` (`hero.title`) and `<desc>` (`hero.desc`) in the current language. It scales to its container and causes no horizontal overflow at 320 and 1280 px. Add `hero.title` and `hero.desc` to both files. Place it in the Landing slot, after the scan link on narrow screens by CSS `order`, with no focusable element.
    - Add `tests/ui/illustrations/hero.test.tsx`: raised-hook count and lifted-end count each equal the punched count of the chosen pick, at the encoded indices; the `plain` pose draws no raised hook and no lifted end; `data-motion="still"` under reduced motion; title and desc change with the language; one animation with one iteration; no colour literal.
    - _Requirements: 4.11, 13.1, 13.2, 13.3, 13.4, 13.5, 13.7, 13.8, 13.10, 23.4_
  - [~] 4.6 Build Step_Icons and Spot_Illustrations and wire them in
    - Add `StepIcons.tsx` (scan: a frame with corner brackets; weave: a cloth with one weft passing; keep: a folder tab with a tick) and `SpotIllustrations.tsx` (no saved designs: an empty shelf; no cards scanned: an empty camera frame; nothing to compare: two sheets side by side with a gap). Each has a `viewBox`, `width: 100%` up to a CSS `max-width`, colours only from `currentColor` or token classes, `decorative` defaulting to `true` (`aria-hidden`, no `<title>`), and drawing content different from the others. No gradient, `<filter>`, emoji, religious symbol, deity, skull or blood.
    - Put a Step_Icon in each Step_Strip item of the Landing, and the matching Spot_Illustration in the `EmptyState` of Keep, Scan and Code view, each beside its text message.
    - Add `tests/ui/illustrations/illustrations.test.tsx`: the three icons differ and the three illustrations differ; each has a `viewBox`; no colour literal, `<filter>`, `linearGradient`, `radialGradient` or emoji in the source; the non-decorative form has `role="img"`, a `<title>` and a `<desc>`; the repository holds no svg, png, jpg, jpeg, gif, webp, ico, woff, woff2, ttf or otf file added for an illustration (outside `public/fonts`); `package.json` has the same `dependencies` and `devDependencies` as in the Stage 0 commit.
    - _Requirements: 8.3, 11.5, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 23.8, 25.10_
  - [~] 4.7 Measure the bundle after Stage C
    - Run `npm run build` and `npm run check-bundle`. Under "Baseline bundle" in `measurements.md` add the file name and gzipped bytes of the Entry_Chunk and of every other JavaScript chunk, labelled "after Stage C".
    - If the Entry_Chunk is 204,800 bytes or more, change only `HeroLoom.tsx` to be loaded with `lazy` and a `Suspense` fallback of the same size built from `heroLayout`, add an error boundary that keeps the fallback if the chunk fails, name each Illustration moved in `measurements.md`, and add an example test for the fallback size. If it is under the limit, keep the static import and say so in the notes.
    - _Requirements: 13.6, 13.9, 15.1, 15.3, 15.4, 15.5, 15.6_
  - [~] 4.8 Take the 24 "after" screenshots
    - Add to `scripts/screenshots.ts` the automatic hints for each view (`scrollWidth <= clientWidth`, and the bounding boxes of text elements that overlap), printed per file. They are hints only.
    - Run `npm run build`, then `npm run screenshots -- after`. Check `media/design/after/` holds exactly 24 valid files, taken with the theme chosen only through the Theme_Switch, and that the lost, versions and diff views show the content Requirement 24.9 names.
    - _Requirements: 24.2, 24.3, 24.4, 24.6, 24.9, 24.10, 24.11_
  - [~] 4.9 Inspect the 24 "after" files and fix every defect
    - Open each of the 24 files with the file reader and look for these defects: overlapping text or control boxes, text cut off by its container, a horizontal scrollbar, text below 4.5:1 or a meaningful graphic below 3:1, and two adjacent controls less than 8 px apart. Fix each defect in `src/ui` (a Hindi string that cannot fit at 320 px wraps and grows its control; record its key and the fix under "Hindi wrapping fixes"), rebuild, and retake each file that changed with `npm run screenshots -- after`. Do at most 3 rounds.
    - Under "After inspection" in `measurements.md` list each defect with its file name and how it was fixed, or state that none were found. List any defect left after round 3 as unfixed with its file name.
    - _Requirements: 5.3, 23.2, 23.9, 23.10, 24.7, 24.8_
  - [~] 4.10 Stage C gate and commit
    - Run `npm run review-list`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run check-bundle`, `npm run check:browser` and `node scripts/contrast_report.ts` (update the "Contrast table" notes if a value changed); all commands must exit 0 with no test newly skipped.
    - Commit with the message `Stage C: card drawing, hero loom and illustrations`, adding the changed files by name, including `media/design/after/`.
    - _Requirements: 22.6, 22.7, 22.8, 25.1, 25.2_

- [ ] 5. Stage D: small fixes (version labels, plurals, finished cloth, benchmark, loom-mcp design, media)
  - [~] 5.1 Build the Version_Labels and use them in the Version_Chooser
    - Add `src/ui/state/versionLabels.ts` (types only imported) with `NOTE_EXCERPT_MAX = 40`, `noteExcerpt(note, ellipsis)` and `versionLabels(summaries, language, t)`. The excerpt trims, collapses each run of whitespace (line breaks included) to one space, counts Unicode code points with `Array.from`, shows 40 or fewer in full, otherwise cuts at the last space within the first 40 (or at exactly 40 without a space) and appends one "…" that does not count. A label is `t('codeview.diff.option', { name, count })`, then the separator and `formatSavedAt(createdAt, language)` when it is not empty, then the separator and the excerpt when there is one. The name comes from `savedLabel(metadata, t('keep.untitled'))`. Equal labels get `t('codeview.diff.duplicate', { k })` in order of `createdAt` then archive id.
    - In `DiffPanel.tsx` call `versionLabels` once per list in `ChoiceSelect` and read each option text from the map; the `<label>` and `<select>` accessible names do not change. Add `codeview.diff.separator`, `codeview.diff.duplicate` and `codeview.diff.ellipsis` to both files (Hindi `reviewed: false`).
    - Add `tests/ui/state/versionLabels.test.ts` with example tests: a note of exactly 40, of 41 with a space and without a space, with line breaks, empty, whitespace-only, and a code point above U+FFFF; no empty brackets and no doubled or trailing separator; a missing or invalid date; an untitled name; two equal labels get `#1` and `#2` in saved-time then id order and no two labels are equal afterwards. Use pick counts of 2 or more in these tests, so they do not depend on task 5.2.
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9_
  - [~] 5.2 Choose singular and plural pick texts
    - In `src/ui/i18n/messages.ts` add `pluralKey(en, key, params)` (`key.one` for a count of 1 and `key.other` otherwise, only when the English file has `key.one` and no `key`; the count is `params.count`, or `params.period` for the repeat evidence) and call it first in `translator`. Callers keep passing the base keys.
    - In `en.json` and `hi.json` replace `keep.list.picks`, `codeview.pickCount` and `codeview.diff.option` by their `.one` and `.other` forms, and add `repair.evidence.repeat.one` and `.other` (keeping the placeholders). English count 1 reads "1 pick" and "{name} (1 pick)"; counts 0 and 2 or more read "picks". Hindi has a one and an other text for each; where they are the same word, add the key under "Keys with equal Hindi one and other text" in `measurements.md`.
    - Re-aim `tests/ui/i18n/messages.test.ts` `DESIGN_TABLE_KEYS` from `codeview.pickCount` to `codeview.pickCount.one` and `.other`, and `scripts/check_browser.ts` from `EN['keep.list.picks']` to `EN['keep.list.picks.other']`, at the same strength. Log both under "Changed selectors".
    - Add `tests/ui/i18n/plural.test.ts` with example tests for the exact English text of each of the three keys for counts 0, 1 and 2 ("1 pick", "0 picks", "2 picks", "{name} (1 pick)", "{name} (0 picks)", "{name} (2 picks)"), each of which fails against the old "1 picks"; `repair.evidence.repeat` for 1 and 12; both files have the same keys.
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7, 22.2_
  - [~] 5.3 Fix the finished cloth on return to Weave
    - In `src/ui/types.ts` add `finishedPattern: Pattern | null` to `AppState` and the actions `{ type: 'cloth-finished' }` and `{ type: 'cloth-unfinished' }`. In `state/appState.ts` set `finishedPattern: null` in `initialAppState`, make `cloth-finished` set it to `state.current.pattern` when that has at least one pick, make `cloth-unfinished` set it to `null`, return the same state object when nothing changes, and set it to `null` in `withNewPattern`, `accept-repairs` and `undo-repair`.
    - In `state/playback.ts` give `entryModeFor(pattern, entered, mounted, mountedPick = 0, mountedFinished = false)` a fifth parameter: for `entered === null` and the same Pattern it returns `show-finished` when `mountedFinished`, before the `mountedPick > 0` test. Every other branch is unchanged.
    - In `WeaveScreen.tsx` read `{ pattern, pick: state.selectedPick, finished: state.finishedPattern === pattern }` once on mount and pass it to `WeavePlayer` as `arrival`. In `WeavePlayer.tsx` make `onFrame` dispatch `cloth-finished` when `report.atEnd` and `cloth-unfinished` otherwise, at most once per change. `selectedPick` stays between 0 and the pick count minus 1.
    - Add one example test in `tests/ui/state/finishedCloth.test.ts` of the sequence: weave to the end, navigate to Code view, navigate back to Weave, then render `WeaveScreen` and check that the finished status text shows, the paused status text does not show, and the number of picks woven and the current pick shown equal the number of picks of the Current_Pattern. The existing playback and Weave tests must pass unchanged.
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_
  - [~] 5.4 Record the benchmark times before the change
    - Without changing `tests/codec-view/benchmark.test.ts`, run `npm run test:run` three times in a row and write, under "Benchmark" in `measurements.md`, the alignment time of each run as the test prints it or as measured with a temporary log line that is removed afterwards.
    - _Requirements: 19.5_
  - [~] 5.5 Make the benchmark steady
    - In `tests/codec-view/benchmark.test.ts` decide by the ratio of the alignment time to a baseline measured in the same run: a plain integer LCS length table (two `Int32Array` lines) over the same two interned key arrays, which calls neither `diffPatterns` nor `alignLines`. Run the baseline before and after the timed alignment and use the larger one. Keep `DIFF_PICK_LIMIT` against `DIFF_PICK_LIMIT`, the smaller warm-up sizes, the seed `20_931`, the number of timed repetitions and every case the test checks today.
    - Set the bound to 1.5 times the highest ratio of three consecutive full-suite runs, rounded up to one decimal, and keep it under 2.0 times today's ratio. Fail with `expect(ratio, message).toBeLessThan(bound)` where the message prints the alignment time, the baseline time, the ratio and the bound. Add a comment with the decision.
    - Run `npm run test:run` three times in a row and record the three ratios and times under "Benchmark". Then temporarily make `alignLines` run its dynamic program twice, confirm the benchmark fails, restore `alignLines` exactly (check with `git diff` that no change is left in `src/codec-view`), and record both facts and the reason for the choice.
    - _Requirements: 19.1, 19.2, 19.3, 19.5, 19.6, 19.7, 19.8_
  - [~] 5.6 Correct the Tool_Error entry in `.kiro/specs/loom-mcp/design.md`
    - Replace the Tool_Error entry in Data Models (the line that says an error carries `structuredContent: {ok: false, ...}`) with the text in the design: `{isError: true, content: [text "reason: message. Hint: hint"], _meta: {reason, hint}}`, exactly one text block, `_meta` with exactly the two keys, no `structuredContent` and no `ok`, the reason an MCP client checks `structuredContent` against `outputSchema`, `message` and `hint` each one sentence, the reason in `_meta.reason`, the hint in `_meta.hint`, and `message` only in the text block. Do not change the success-result entry.
    - Search the file for any other sentence that says or implies an error carries `structuredContent` or `{ok: false, ...}` and correct it. Check that a search for `ok: false` returns nothing and that `git diff --name-only` for this step lists only `.kiro/specs/loom-mcp/design.md`. No file under `tools/loom-mcp` or `src` changes in this task.
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_
  - [~] 5.7 Handle the loom-mcp screenshots in `media/kiro/`
    - Check whether `media/kiro/` exists and holds `.png` files. If it does, stage exactly its `.png` files and nothing else from that directory, and write each path under "Notes for the final report". If it does not (it is absent today), leave `media/loom-mcp-connected.png` and `media/loom-mcp-validate-profile.png` untracked, and write under "Notes for the final report": no screenshots were found in `media/kiro/`, and the two named files are present in `media/` (or name each one that is absent). The commit adds no loom-mcp screenshot in that case.
    - _Requirements: 21.1, 21.2, 21.4, 21.5_
  - [~] 5.8 Stage D gate and commit
    - Run `npm run review-list`, `npm run typecheck`, `npm run test:run`, `npm run build`, `npm run check-bundle` and `npm run check:browser`; all must exit 0 with no test newly skipped.
    - Commit with the message `Stage D: version labels, plurals, finished cloth, benchmark and loom-mcp design`, adding by name only the fixes of this stage, `.kiro/specs/loom-mcp/design.md`, `.kiro/specs/design-and-ux-pass/measurements.md`, `docs/HINDI_REVIEW.md` and any `media/kiro/*.png` from task 5.7.
    - _Requirements: 21.3, 22.6, 22.7, 22.8, 25.1, 25.2_

- [ ] 6. Final tasks: documents, last checks, push and report
  - [~] 6.1 Write the one Build_Log entry in `docs/BUILD_LOG.md`
    - Add exactly one new entry for this pass, built from `measurements.md`: the licence record and Font_Weight_Report; the bundle sizes before Stage A and after Stage C (every chunk, with file names); the contrast table of every pair in both themes (ratios from `truncateRatio`) and any pair below its minimum with its proposed value; the benchmark decision, the three before and three after runs and the 2.0 times slowdown check; the "after" inspection; each changed selector and check (old selector, new selector, reason); each Hindi wrapping fix; the keys whose Hindi one and other texts are the same; the Disclosure check changes; the Day `--zari` `#B0800A` note; the five-commit order including Stage 0.
    - _Requirements: 2.1, 2.5, 2.6, 5.3, 5.5, 5.6, 10.8, 15.3, 17.5, 19.5, 22.2, 23.10, 24.8, 25.7_
  - [~] 6.2 Update `docs/KIRO_USAGE.md`
    - Add at least one sentence for each of Stages A, B, C and D on how Kiro was used in this pass.
    - _Requirements: 25.8_
  - [~] 6.3 Add the font credits to `README.md` and the new directories to the structure steering
    - In the "Prior work and credits" part of `README.md` list Rozha One, Hind and IBM Plex Mono, each with its designer or foundry, its licence name and the URL it was obtained from, and reword "No other credits are listed." so it stays true. The number of listed fonts equals the number of font families in `public/fonts` (three). `tests/ui/readme.test.ts` must pass.
    - In `.kiro/steering/structure.md` add one line under `src/ui` that names `components/` and `illustrations/`.
    - _Requirements: 2.4, 25.9_
  - [~] 6.4 Run `npm run check:browser` once
    - Run it once on the final tree (documents written, nothing else changed since Stage D). Write its exit status and the names of any failing checks under "Notes for the final report" in `measurements.md`. If a check fails, list it with its fix or under "anything not done"; do not edit a check to make it pass.
    - _Requirements: 25.5, 25.6_
  - [~] 6.5 Run `npm run check:all` once
    - Run it once. Write its exit status and the names of any failing checks under "Notes for the final report". Do not edit a check to make it pass.
    - _Requirements: 25.5, 25.6_
  - [~] 6.6 Fold the documents into the Stage D commit
    - The branch must hold five commits (Stage 0, A, B, C, D). Check with `git log` that the Stage D commit is `HEAD`, that it is not on the remote (`git status -sb` shows `ahead`), and that only `docs/BUILD_LOG.md`, `docs/KIRO_USAGE.md`, `README.md`, `.kiro/steering/structure.md` and `.kiro/specs/design-and-ux-pass/measurements.md` have changed. Stage those files by name and run `git commit --amend --no-edit`. Do not rewrite any commit that has been pushed, and do not force-push.
    - _Requirements: 25.1, 25.4_
  - [~] 6.7 Push `auto/build`
    - Run a plain `git push` of `auto/build`. Check that the remote branch head equals `HEAD`. If the push fails, keep the local commits unchanged, do not force-push, and write the reason under "Notes for the final report".
    - _Requirements: 25.3, 25.4_
  - [~] 6.8 Write the final report and stop
    - The report lists: the path of every screenshot file (`media/design/before/` and `media/design/after/`) and of every file added from `media/kiro/` or the statement that none was added, with the two named untracked files when `media/kiro/` is absent; the Entry_Chunk size in bytes before and after; each contrast failure with its fix; the exit status and failing check names of `check:browser` and `check:all`; the push result; any failing test with its file, name, what changed and why (and any fast-check counterexample, seed and path); anything not done; the one item to look at first; the credits used; and the note that Stage 0 made the branch hold five commits and that the documents were folded into the Stage D commit.
    - Make no further commit on `auto/build` and start no second pass.
    - _Requirements: 21.2, 21.4, 21.5, 22.4, 25.4, 25.6, 25.11, 25.12_

## Notes

- No task is marked optional. The design has no Correctness Properties section and no property test is added; the example tests are not optional because Requirements 17.7 and 18.6 require them and every stage gate runs `npm run test:run`.
- Task 5.3 adds the one example test you asked for. The design's longer list of reducer and `entryModeFor` tests for Requirement 18 is not written; the one sequence test covers Requirements 18.1, 18.2, 18.6 and 18.7, and the existing playback tests cover the paused and replaced cases.
- Stage 0 is a fifth commit before Stage A, so the "before" screenshots are committed before any Stage A change (Requirement 24.1). The Stage A to D commits are the four Stage commits of Requirement 25.1.
- `.kiro/specs/design-and-ux-pass/measurements.md` holds the numbers each stage collects. The Build_Log entry in task 6.1 is typed from it.
- The docs of tasks 6.1 to 6.3 come after the Stage D commit because you listed them as final tasks. Task 6.6 folds them into the unpushed Stage D commit so the branch keeps five commits and the remote head is the Stage D commit. If you prefer a sixth docs commit, change 6.6 to a normal commit.
- The tokens, the Graph_Paper_Ground gradient in `tokens.css` only, the `calc(var(--motion-long) * 6)` Lift_Cycle, the missing-glyph fallback and the re-aimed tests follow the design's defaults, as you decided.
- Tasks 1.5, 4.7, 5.4 and 5.5 run measurements and tasks 1.6, 4.8 and 6.4 to 6.5 run the browser checks, because you asked for those results to be recorded. They produce files and numbers and change no behaviour.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.4"] },
    { "id": 1, "tasks": ["1.3", "1.5"] },
    { "id": 2, "tasks": ["1.6"] },
    { "id": 3, "tasks": ["1.7"] },
    { "id": 4, "tasks": ["2.1", "2.5"] },
    { "id": 5, "tasks": ["2.2", "2.6"] },
    { "id": 6, "tasks": ["2.3", "2.4"] },
    { "id": 7, "tasks": ["2.7"] },
    { "id": 8, "tasks": ["2.8"] },
    { "id": 9, "tasks": ["2.9"] },
    { "id": 10, "tasks": ["2.10"] },
    { "id": 11, "tasks": ["2.11", "2.12"] },
    { "id": 12, "tasks": ["2.13"] },
    { "id": 13, "tasks": ["3.1"] },
    { "id": 14, "tasks": ["3.2"] },
    { "id": 15, "tasks": ["3.3"] },
    { "id": 16, "tasks": ["3.4"] },
    { "id": 17, "tasks": ["3.5"] },
    { "id": 18, "tasks": ["3.6"] },
    { "id": 19, "tasks": ["3.7"] },
    { "id": 20, "tasks": ["3.8"] },
    { "id": 21, "tasks": ["3.9"] },
    { "id": 22, "tasks": ["3.10", "3.11"] },
    { "id": 23, "tasks": ["3.12"] },
    { "id": 24, "tasks": ["4.1", "4.2"] },
    { "id": 25, "tasks": ["4.3"] },
    { "id": 26, "tasks": ["4.4", "4.5"] },
    { "id": 27, "tasks": ["4.6"] },
    { "id": 28, "tasks": ["4.7"] },
    { "id": 29, "tasks": ["4.8"] },
    { "id": 30, "tasks": ["4.9"] },
    { "id": 31, "tasks": ["4.10"] },
    { "id": 32, "tasks": ["5.1"] },
    { "id": 33, "tasks": ["5.2", "5.3"] },
    { "id": 34, "tasks": ["5.4"] },
    { "id": 35, "tasks": ["5.5"] },
    { "id": 36, "tasks": ["5.6", "5.7"] },
    { "id": 37, "tasks": ["5.8"] },
    { "id": 38, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 39, "tasks": ["6.4"] },
    { "id": 40, "tasks": ["6.5"] },
    { "id": 41, "tasks": ["6.6"] },
    { "id": 42, "tasks": ["6.7"] },
    { "id": 43, "tasks": ["6.8"] }
  ]
}
```
