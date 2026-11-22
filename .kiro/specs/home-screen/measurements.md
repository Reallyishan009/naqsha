# Measurements: home page as its own screen

## Changed tests and checks

None was loosened. Each was re-aimed at the same strength.

Part 1 (`home: its own screen`):

- tests/ui/state/appState.test.ts, `R1.2 ... starts on ...`: the first screen is now 'home'.
- tests/ui/state/appState.test.ts, go-home: the three tests assumed go-home empties the design and asks first over unsaved scanned cards. go-home now only sets the screen to 'home'. They now check that the whole state is otherwise unchanged (design, pick, breakpoints, finished, cloth choices, language, profile), that it never asks, and that a waiting question is closed. Added two tests for a sample chosen on home (navigate to weave first, then request-sample; the unsaved-cards question is drawn on Weave).
- tests/ui/state/stateMessages.test.ts: `home.confirm` and `home.confirmYes` left ADDED_KEYS, because the keys are removed from en.json and hi.json (only go-home used them). docs/HINDI_REVIEW.md regenerated (the checked-in copy must equal the generated one); the two rows removed from docs/hindi-review-sheet.csv.
- tests/ui/screens/weave.test.tsx: the TryIt `go-home` question case is removed (the confirm kind no longer exists); the failed-profile test now checks the failure and no sample tile on HomeScreen, and the Weave tool with Try it disabled on Weave.
- tests/ui/screens/landing.test.tsx, R8.1 R8.12: the Landing is HomeScreen; Weave with no design shows the Weave tool (Try it title, empty message) and no headline.
- tests/ui/screens/shell.test.tsx, R1.1 and R1.2: Weave with no design shows the tool, not the Landing; home shows the Landing under the heading "Naqsha, home"; the first screen is home with no aria-current, Weave has it.
- tests/ui/screens/navigation.test.tsx: added "no item has aria-current on home"; SCREENS typed without 'home'.
- tests/ui/accessibility.test.tsx, R14.4: the Shell page named "weave" now sets screen: 'weave' (the initial screen is home); same names checked.
- scripts/check_browser.ts, steps 1, 2, 16, and the offline Landing check: the first screen and the Landing are the home screen (heading "Naqsha, home" in the page language, hero present); a new goHome helper presses the Naqsha mark. Every assertion on the Landing (844 px limit, one primary Button, three secondary tiles, hero loom drawn offline, pictures decoded) is unchanged.

## Bytes

- Entry chunk: 131,255 bytes gzipped (limit 150,000). Scan chunk 11,502; Code view chunk 10,720.

## Not checked by eye

- No screenshot was opened in Part 1.
- The Landing heading is now "Naqsha, home" (nav.home) instead of "Weave"; Hindi "नक्शा, मुखपृष्ठ" is the existing string.

## Part 2 (`home: checks, screenshots, docs`)
- scripts/check_browser.ts: new step "home and Weave" (nothing removed, nothing loosened). Steps 1, 2, 16, the home-button step and the offline Landing checks were re-aimed in Part 1 and are unchanged here.
- scripts/screenshots.ts: `freshPage` now waits for the home screen heading (`nav.home`) instead of the Weave heading, because a fresh app opens on home; the older modes' views are otherwise unchanged (`weave-landing` is the home screen). New mode `after-run4` with `RUN4_NAMES` and `run4Problems` in scripts/checks/screenshots.ts; tests added in tests/scripts/screenshots.test.ts.
- The empty Weave capture starts from a fresh page: after a full-page capture at 390 px the header menu can no longer be clicked.
## Not checked by eye (Part 2)
- Opened: weave-empty-day-390, weave-empty-night-1280. Not opened: home-day-390, home-day-1280, weave-empty-day-1280, weave-empty-night-390.
## Bytes (Part 2)
- Entry chunk 132.63 kB gzipped by vite (limit 150,000 bytes); check-bundle passed. No source file under src/ changed in Part 2.
