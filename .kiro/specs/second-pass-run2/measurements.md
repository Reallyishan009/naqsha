# Second design pass, run 2: measurements

## Changed checks

Part 0 (header). Each change follows a real change of markup or label; the strength is kept.

| Check | Change | Why |
|---|---|---|
| tests/ui/components/themeSwitch.test.tsx R4.1, R4.2, R6.10 | The switch is icon-only: the visible "Night loom" and On/Off text are gone. The tests now check `role="switch"`, `aria-checked`, the accessible name ("Switch to night loom" / "Switch to day loom", both languages) and that no visible text is left. | Brief: icon-only theme button named by the action. |
| themeSwitch.test.tsx R23.5 | Dropped the `overflow-wrap: anywhere` / no `nowrap` assertions; the 48 px min-width and min-height stay. | There is no text left to wrap. |
| themeSwitch.test.tsx Selvedge | `.header { overflow: hidden }` became `.header > [data-selvedge] { left: var(--radius-card) }`. The Selvedge is still the header's first child. | The header no longer clips, so the menu sheet can hang below it; the Selvedge is a strip between the rounded corners. |
| shell.test.tsx menu-button test | Split into: narrow header (Scan pill, then menu button, then sheet with nav and switches; pill outside the sheet), wide header (no menu button; DOM order nav, pill, language, theme), pill hidden on Scan, language segments (EN / हि visible, full names as accessible names). Shell got a `compact` prop for these tests. | Header has two layouts chosen in JS at 1024 px. |
| shell.test.tsx | New: shrink is padding paired with equal margin, transitions use `--motion-short`. | Brief: no layout jump. |
| navigation.test.tsx R9.4 | "Code item alone shows the word Advanced" became "no nav item carries it" (the Code view screen shows an Advanced Chip instead). | Brief: no sub-label in the header. |
| navigation.test.tsx R9.3 | Current item fill is `var(--accent)` (was `--primary`); `.navButton` is `flex-direction: row` (was column); the `.bar { flex-wrap: wrap }` assertion became a `.sheet .navButton` 48 px target assertion. Weight 700, 3 px underline, 48 px targets, `.nav`/`.switches` wrap, no `@media` all kept. | The bar no longer wraps; two layouts instead. |
| tests/ui/state/stateMessages.test.ts | ADDED_KEYS: theme.toNight, theme.toDay, language.short.en, language.short.hi. | New Hindi keys. |
| scripts/check_browser.ts | Language segments are pressed by accessible name (`pressLanguage`, `clickName`), theme switch found by its two action names (EN and HI), menu opened before and closed after each press (the default 900 px viewport is now under 1024). Check 13 message names the new switch. New check 14: header shrinks after scrolling and `main` does not move (1280 and 390). | Labels changed; 900 px is now a narrow header. |
| scripts/screenshots.ts, scripts/checks/session.ts | Same: by accessible name (`byName`), menu thresholds under 1024. New mode `after-run2`. | As above. |

Part 1 (Weave). The Weave markup changed; no test needed a change except these.

| Check | Change | Why |
|---|---|---|
| tests/ui/state/stateMessages.test.ts | ADDED_KEYS: weave.heading, weave.heading.accent, weave.card.cloth, weave.card.controls. | New Hindi keys. |
| tests/scripts/screenshots.test.ts | The "stranger" file in the run 2 name test is now `stranger-day-1280.png` (was `weave-sample-day-1280.png`); new test names the Weave views. | `weave-sample` and `weave-lost` are now run 2 views, so the old stranger is a valid name. |
| scripts/screenshots.ts `leafMatching` | A leaf is an element whose child elements are all `svg` (was: no child elements). The text must still match the whole pattern. | The count of lost cards is now a Chip with a small `svg` mark before the words (GapChip). |
| scripts/checks/screenshots.ts | RUN2_VIEWS gained weave-sample and weave-lost at 1280 and 390. | Part 1 screenshots. |

check:browser check 12 (no horizontal scroll) failed on the first run of the gate and passed on the rerun with no change; the failing width was not printed. Reported, not explained.

Part 2 (Keep).

| Check | Change | Why |
|---|---|---|
| tests/ui/screens/keep.test.tsx R14 (48 px targets) | The rule is read from `.segment` (was `.choice`); still asserts `min-height: var(--touch-target)`. | The export choices are segmented controls; the label class was renamed. The radio inputs and labels keep the same markup, so the R5.4 regex test is unchanged. |
| tests/ui/state/stateMessages.test.ts | ADDED_KEYS: keep.heading, keep.heading.accent, keep.details.legend, credits.photos.caption. | New Hindi keys (review-list run). |
| tests/scripts/screenshots.test.ts | New test names the keep-versions view (1280, 390, both themes). | `keep-versions` is now also a run 2 view. |
| scripts/checks/screenshots.ts, scripts/screenshots.ts | RUN2_VIEWS gained keep-versions (design of 2 versions, history open). The full-page capture injects `header{position:static !important}` (script only, never the app) so the header sits at the top of the file. | Part 2 screenshots; orchestrator note. |
| scripts/check_browser.ts check 12 | A failure inside the width loop now names screen, width, language and theme (and the theme press). Strength unchanged. | Flake: step 12 failed once more with "timed out waiting for the header menu to open" and no width; the run's own retry passed. Cause not found; with the new message the next flake names it. |

Layout changes made to keep check 19 (primary Button inside the first 844 px at 390): the Keep intro is two short lines instead of a large subtitle, and band, container and surface padding are smaller under 900 px. The check was not touched; it first failed (871 to 919 px) and now passes.

Shadow: the brief asked for a softer shadow once scrolled. tests/ui/theme/styles.test.ts pins the three shadow tokens and bans literals, so the header uses `--shadow-float` at the top and `--shadow-lift` once scrolled (smaller, softer). No test was changed for this.

Part 3 (Scan and Code, and the check:browser flake).

| Check | Change | Why |
|---|---|---|
| tests/ui/state/stateMessages.test.ts | ADDED_KEYS: scan.steps.label, scan.step.photograph, scan.step.check, scan.step.weave. | New Hindi keys. |
| tests/scripts/screenshots.test.ts | New test names scan, scan-read and code-diff (1280 and 390, both themes). | New run 2 views. |
| scripts/screenshots.ts `parseArguments` | A view name the run 2 set shares with the old 24-file set (keep-versions, scan, code-diff) now goes to the old set in the older modes instead of being refused. | `--view scan` with `before` or `after` had become an error. |
| scripts/check_browser.ts, the Code view open offline (steps 20, groups A and B) | Was: the one marked Line has data-pick "0", then "1" after a step. Now: exactly one marked Line, a pick of the design (0 to length - 2), and one step forward moves it to the next pick. | The sample plays on Weave and the Selected_Pick moves with each frame, so the pick Code view opens at depends on how long the page took to get there. It showed "1" once clicks took about 80 ms longer (see below). Not a weaker claim about Code view: still one Line, in range, and the step moves it by exactly one. |
| scripts/checks/session.ts `Page.click` | Waits until the box of the target is the same at three reads 40 ms apart before the mouse goes down. | See the flake below. |
| scripts/checks/session.ts `Page.setViewport` | After the size is set it waits until `header[data-narrow]` matches the width (under 1024 px narrow). A page with no header is not waited for. HEADER_WIDE_FROM_PX is tested equal to WIDE_QUERY in App.tsx. | The flake below. |
| scripts/checks/session.ts `openHeaderMenu` | On a menu that does not open, the error adds scrollY, width, aria-expanded, the button box and the element at its centre. | A future miss names itself. |
| tests/scripts/session.test.ts, report.test.ts | Three example tests: click waits for a still box before pressing; setViewport waits for the header layout; the FAIL lines, the failed count and the exit code agree. | Tests for the fixes above. |
| src/ui/components/Disclosure.module.css | The toggle is a pill with a hairline, the secondary Button look. Markup and names unchanged. | Orchestrator note (a). |

The check:browser flake (step 12 "timed out waiting for the header menu to open", and a FAIL line above a summary of 20 passed 0 failed):

- Cause of the timeout: a width change races React. The header chooses its layout in JS from a media query, so right after `setViewport` the page still draws the old layout for a moment. Going from 390 to 1280 (or 1280 to 900) the next step either saw the old Menu button, clicked it, and then watched it vanish when the wide layout arrived (menu "never opens"), or saw no button, skipped the menu, and found the language button hidden when the narrow layout arrived. Not a sticky or scroll race: 80 open and close rounds at 5 scroll depths did not miss once. Reproduced the second form on this run ("timed out waiting for button named English" after the width loop), fixed by waiting for `data-narrow` in `setViewport`; the full run then passed. The stable-box wait in `click` is extra hardening for the header changing size while it shrinks.
- The FAIL line was not a failed step. The runner has no retry and counts its summary from the same results it prints (a new test checks the FAIL lines, the failed count and the exit code agree). The text is the PASS line of "the page reloads offline": its detail lists the probe request `never-cached-....txt -> net::ERR_FAILED`, which contains FAIL in capitals. Nothing was changed there.

Layout notes: the Scan screen now sits its panels in rounded cards and the photo chooser in a dashed rounded zone with the drawn Diamond card; the Code view photo is a 3.4:1 crop (min height 8 rem). No `@media` in those modules (a test bans all but reduced-motion).

## Bytes

Part 3: entry chunk 127,821 B gzipped (check-bundle), Scan chunk 9,351 B, Code view chunk 10,253 B.

Part 2: entry chunk 127,720 B gzipped (limit for this run 150,000; 204,800 untouched).

Part 1: entry chunk 126,914 B gzipped (check-bundle). Part 0: entry chunk (gzip) 127.84 kB (limit for this run 150,000 B; the 204,800 B limit untouched). Code view chunk 10,086 B gzipped.

## Contrast

New pair on-primary on accent (the current link): day 5.09:1, night 9.74:1 (minimum 4.5). The frost alpha stays 0.95 (test: at least 0.85). `node scripts/contrast_report.ts`: every pair meets its minimum.

## Screenshots

Part 3: scan, scan-read (a card read from tests/fixtures/pick0-clean.png) and code-diff, day and night, 1280 and 390 (full page, reduced motion).

Part 2: keep-versions, day and night, 1280 and 390 (full page, reduced motion, header made static for the capture).

media/design/after-run2/: weave-sample and weave-lost, day and night, 1280 and 390 (full page, reduced motion). Header views: header-closed, header-closed-hi (1280, 1024, 768, 390, 320), header-menu, header-menu-hi (768, 390, 320), each day and night, cropped to the top 700 px. 1024 is an extra width, to check Hindi fits where the wide layout starts.

## Not checked by eye

Everything except a glance at header-closed-hi-day-1024 and header-menu-hi-night-320. The orchestrator opens the rest.

## Skipped

Nothing in Part 0.
