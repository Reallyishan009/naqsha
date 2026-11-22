# Implementation Plan: Home button fix

## Overview

Small fix: no way back to the Landing after a sample is chosen. One task; the full brief is in this file's task text.

## Tasks

- [x] 1. Home button
  - [x] 1.1 Make the Naqsha mark and name a home button, add the go-home action, tests, screenshot, commit
    - Bug: the Landing shows only when state.screen === 'weave' and current.pattern is empty, and nothing can empty it again except a reload.
    - (1) Make the "Naqsha" name and mark at the top left of the header ONE button styled like a link, accessible name "Naqsha, home" (add the Hindi string, hi reviewed false, ADDED_KEYS, review-list). Works in the wide header, the narrow header (under 420 px, where only the mark shows), from any screen; keeps a 44 px touch target and a visible focus ring; hover = soft tint like the other header links. Clicking takes the user to the Landing.
    - (2) Reducer action 'go-home': screen = 'weave', current = empty (pattern [], origin none), selection and cloth state reset like a fresh start (selectedPick, finishedPattern, breakpoints as the app's initial state does; keep language, theme, archive, profile); the existing effect for showsLanding scrolls to top. If the Menu sheet is open, close it.
    - (3) Unsaved work: if the current design has changes not saved to the archive, reuse the existing confirm flow (the one used when a sample replaces a design; find it in the Weave screen/state) before going home. Never lose a design silently. Define what 'unsaved' means from the existing state (look at how Keep tracks saved/origin; if there is no reliable signal, treat a design opened from the archive or just saved as saved and anything else as unsaved, and say so).
    - (4) While already on the Landing the button does nothing visible but stays focusable.
    - (5) Tests: reducer test for go-home; component tests for the button (click from each of the four screens, the confirm with unsaved work, the Hindi name); a check:browser step: load Diamond, press the mark, see the Landing hero again. Do not loosen any existing check; where a test finds the brand by the old accessible name (the h1 / name text) keep it working or re-aim by accessible name at the same strength and say so.
    - (6) Screenshot of the Landing after returning, at 390 and 1280 (day), saved to media/design/after-run2/home-after-return-day-390.png and -1280.png; the orchestrator opens them.
    - Gate: typecheck, test:run, build, check-bundle (entry under 150,000 gz), check:browser, contrast report all exit 0; commit with message `header: home button and go-home action`, adding by explicit path (never git add -A), plain push to origin auto/build. Credit cap: be efficient; short report with files changed, tests added, the unsaved-work rule used, gate results and the commit hash.

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
