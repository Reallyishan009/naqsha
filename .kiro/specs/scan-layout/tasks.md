# Implementation Plan: Scan layout fix

## Overview

Small layout fix on the Scan screen. Credit target under 15, stop after about 12.

## Tasks

- [ ] 1. Scan two-column layout
  - [-] 1.1 Two columns at 1024 px and wider, one column below, screenshots, commit
    - Problem: on Scan the Demo cards panel (src/ui/screens/scan/DemoCards.tsx, placed in `.chooseBand` beside the drop zone) is very tall and pushes everything after the drop zone far down: the Unverified notice, the Card profile control, the "No cards yet. Each card you accept is one pick." text, "Choose a photo of a card to begin." and the "More" section.
    - At 1024 px and wider, two columns. Left column top to bottom: the "Choose a photo of one card" Card (drop zone), then directly below it the Unverified notice, the Card profile control, the "No cards yet" text and "Choose a photo of a card to begin.", and the "More" section. Right column: the Demo cards panel at the top, content unchanged. The panel may be position: sticky below the header only if that covers nothing (the header is itself sticky; the sticky top offset must clear it, with the panel's own height possibly taller than the viewport: then leave it static); otherwise static.
    - Under 1024 px: one column in this order: the drop zone Card, the Unverified notice and the rest of the left column, then the Demo cards panel last. The Demo cards panel must not come before the controls at narrow widths.
    - DOM order must give the tab order that follows the visual order in both layouts: the DOM order is drop zone, notice/profile/empty/More, then Demo cards; use CSS grid placement (grid-template-areas or grid-column/row) for the two-column layout, not DOM reordering. Keep 44 px (48 preferred) targets, English and Hindi strings unchanged, every accessible name and test. Use a container query or the existing patterns (the style tests forbid width @media except the allowed ones: read tests/ui/accessibility.test.tsx R14.11; a `min-width` media query is allowed there; container queries are fine).
    - Update a test only if its order assertion really changed, and say which (the Scan source-order tests in tests/ui/screens/scan.test.tsx may pin the order of DemoCards vs the other panels).
    - Check: check:browser passes; no horizontal scroll at 320, 390 and 1280 (the existing step 12 covers it). Take Scan screenshots (`npm run screenshots -- after-run3 --view scan-demo` or the existing option) at 390 and 1280, day, into media/design/after-run3/ (replace scan-demo-day-390.png and scan-demo-day-1280.png), and also capture one at 1280 viewport top-of-page WITHOUT full page (viewport 1280x800) as media/design/after-run3/scan-first-screen-day-1280.png so the orchestrator can confirm that the notice, Card profile and "More" are visible within the first screen at 1280. Add that view to the screenshots script/validator/test only if cheap; otherwise capture it with a temporary script and still commit the PNG.
    - Gate: typecheck, test:run, build, check-bundle (entry under 150,000 gz), check:browser, contrast report all exit 0. Commit `scan: two-column layout, demo cards on the right` with the screenshots and the status files of .kiro/specs/scan-layout/ and .kiro/specs/bmp-fix/, explicit paths, plain push to origin auto/build. Short report: what changed, which test (if any) changed, gate results, the screenshot list, the commit hash. Credit cap: about 12, be very efficient (do not re-read big files).

## Notes

- Stop after this fix.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] }
  ]
}
```
