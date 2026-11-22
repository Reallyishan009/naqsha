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

Shadow: the brief asked for a softer shadow once scrolled. tests/ui/theme/styles.test.ts pins the three shadow tokens and bans literals, so the header uses `--shadow-float` at the top and `--shadow-lift` once scrolled (smaller, softer). No test was changed for this.

## Bytes

Part 1: entry chunk 126,914 B gzipped (check-bundle). Part 0: entry chunk (gzip) 127.84 kB (limit for this run 150,000 B; the 204,800 B limit untouched). Code view chunk 10,086 B gzipped.

## Contrast

New pair on-primary on accent (the current link): day 5.09:1, night 9.74:1 (minimum 4.5). The frost alpha stays 0.95 (test: at least 0.85). `node scripts/contrast_report.ts`: every pair meets its minimum.

## Screenshots

media/design/after-run2/: weave-sample and weave-lost, day and night, 1280 and 390 (full page, reduced motion). Header views: header-closed, header-closed-hi (1280, 1024, 768, 390, 320), header-menu, header-menu-hi (768, 390, 320), each day and night, cropped to the top 700 px. 1024 is an extra width, to check Hindi fits where the wide layout starts.

## Not checked by eye

Everything except a glance at header-closed-hi-day-1024 and header-menu-hi-night-320. The orchestrator opens the rest.

## Skipped

Nothing in Part 0.
