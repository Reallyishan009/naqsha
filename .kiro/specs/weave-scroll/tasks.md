# Implementation Plan: Weave Try it scroll landing

## Overview

One small fix on Weave. Keep the gate green. Credit cap 8. No new dependencies, colours or fonts. Never loosen an assertion; log any re-aim in `.kiro/specs/weave-scroll/measurements.md`. One commit, push to auto/build.

## Tasks

- [ ] 1. Try it scroll landing
  - [-] 1.1 Land the cloth card just below the sticky header
    - Problem: on Weave, every "Try it" button (Diamond, Border, Floral, the lost-cards design, Show a lost card, Show a torn card, and the other buttons in that section) loads a design and scrolls up to the cloth. It lands badly: the "The cloth" card sits tight under the sticky header and a clipped strip of page text shows above the header.
    - Fix: after a Try it button loads a design, scroll so the "The cloth" card heading sits just below the sticky header with a small gap; the cloth picture, the pick counter and the Play/Pause row are all fully in view. Use `scroll-margin-top` on the cloth card (its CSS) set from the REAL header height, not a magic number: read the header's height at runtime (e.g. the sticky header element's offsetHeight or a ResizeObserver/`--header-height` custom property set on scroll/resize) and set the cloth card's scroll-margin-top to header height + a small gap (e.g. var(--space-*)); or set a `--header-height` CSS var on :root/the shell from the header's measured height and use `scroll-margin-top: calc(var(--header-height) + var(--space-4))`. Then `element.scrollIntoView({ block: 'start' })` on the cloth card lands correctly.
    - Nothing may show above the header after the scroll. If the clipped strip comes from the sticky header offset (html scroll-padding-top in tokens.css was set to 144px earlier; or the header's own top offset), fix that offset to match the real header height too, so the sticky header fully covers the top.
    - Use ONE shared helper for every Try it button (the Weave Try it section / TryIt.tsx and the demo strip and the lost/torn buttons all call the same scroll helper after loading). Do not copy the logic. Keep it null-safe.
    - prefers-reduced-motion: instant scroll (behavior 'auto'); smooth otherwise. Reuse the reduced-motion signal already used by the Scan scroll fix (scrollResultIntoView in ScanScreen) so both behave the same.
    - Do NOT change what the buttons load, and do NOT change the unsaved-scan confirm.
    - Test: a unit/component test that pressing a Try it button scrolls the cloth card into view via the shared helper (fake/spy), instant under reduced motion, smooth otherwise, null-safe. check:browser step at 390 and 1280 px: after pressing Diamond from the Try it section, assert the cloth heading's top is at or below the header's bottom (getBoundingClientRect: clothHeading.top >= header.bottom - small epsilon) and nothing is above the header; at 1280 also assert the Play row's bottom <= innerHeight; at 390 assert only the cloth heading is visible below the header. Do not loosen other checks.
    - Screenshots: one at 1280 and one at 390 after the scroll, into media/design/after-run4/ (names weave-tryit-landing-day-1280.png, weave-tryit-landing-day-390.png); capture with a temporary patch if the screenshots mode doesn't fit, revert the patch, and still commit the PNGs. The orchestrator opens them.
    - Gate: typecheck, test:run, build, check-bundle (entry under 150,000 gz), check:browser, contrast report. Commit `weave: land the cloth below the header after Try it` including `.kiro/specs/weave-scroll/` and any uncommitted `.kiro` status files; push. Report changed tests/checks and why, entry chunk bytes, commit hash. Credit cap 8: be very efficient, do not re-read big files; if near the cap before the gate is green, write docs/STUCK.md and stop.

## Notes

- Stop after this task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] }
  ]
}
```
