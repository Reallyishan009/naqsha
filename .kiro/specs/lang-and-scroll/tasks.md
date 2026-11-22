# Implementation Plan: default language and Scan scroll

## Overview

Two small fixes. Keep the gate green. Credit cap 15. Stop and write docs/STUCK.md if blocked. No new dependencies, colours or fonts. Never loosen an assertion; log every re-aim in `.kiro/specs/lang-and-scroll/measurements.md`. One commit at the end, push to auto/build, explicit paths.

## Tasks

- [ ] 1. Both fixes
  - [-] 1.1 Default language (approved R12.2 change) and Scan scroll-into-view
    - FIX A, default language. The user approved changing requirement R12.2.
      - Edit `.kiro/specs/app/requirements.md` R12.2 (line 238) from "WHEN the App starts without a stored language choice, THE App SHALL use Hindi." to: "WHEN the App starts without a stored language choice, THE App SHALL use Hindi if `navigator.language` starts with \"hi\", and English otherwise." Also update the user story (line 232/233) from "in Hindi by default" to "in the browser's language when it is Hindi, and English otherwise" (keep "English on request"). Update `.kiro/specs/app/design.md` line 126 ("Hindi is the default") to match. If docs/STUCK.md holds the earlier "default language needs a decision" note, append a line that it is now resolved and implemented (do not delete the history).
      - Implement: add a pure function in `src/ui/platform/browser.ts` next to `readStoredLanguage`, e.g. `chooseLanguage(stored, navigatorLanguage)` or `preferredLanguage(navigatorLanguage)`: a stored 'hi' or 'en' wins; otherwise 'hi' when navigatorLanguage (string, may be undefined) starts with "hi" (case-insensitive), else 'en'. Never throws. A `browserLanguage()` reads navigator.language inside try/catch and returns undefined on throw/missing. Wire it where the app picks the initial language today (App.tsx reads readStoredLanguage and falls back to initialAppState.language): compute the initial language from chooseLanguage(readStoredLanguage(store), browserLanguage()) and pass it in, rather than relying on initialAppState.language. Keep initialAppState.language as a sane constant; if a test pins it to 'hi', keep it 'hi' (the runtime choice is what matters) OR change it and re-aim the test, logging it. Follow how the theme does chooseTheme/applyTheme for the shape.
      - Tests (pure, no browser): chooseLanguage: hi-IN -> hi, en-US -> en, en-IN -> en, HI -> hi, stored 'en' beats navigator 'hi-IN', stored 'hi' beats navigator 'en-US', undefined navigator -> en, '' -> en, a throwing navigator getter via browserLanguage -> en. Re-aim any existing test or check:browser step that assumed Hindi on a fresh start (the check:browser freshPage/home steps may assert the Hindi or English heading; the screenshots script freshPage; any appState test asserting initial language). Note: the headless Chrome used by check:browser has its own Accept-Language; find what navigator.language it reports and set expectations to match, OR force the context language if the session helper can (scripts/checks/session.ts startChrome / the CDP Emulation.setLocaleOverride or --lang). If you cannot force it, assert the heading matches chooseLanguage(undefined, <the browser's navigator.language>) computed in the step, so it is correct whatever the CI locale. Log the approach.
    - FIX B, scroll the Scan result into view on a narrow screen.
      - On Scan, after the user presses a demo card or a real-photo button (the onDemo path in ScanScreen that calls onFile), on a narrow viewport scroll the result region into view. The result region is the main column's read panel / the "More" disclosure area that shows the sweep, tap-to-fix and the read outcome (find the element that appears after a read; scroll the drop-zone's following content or a ref on the read panel into view). Use element.scrollIntoView({ block: 'start' }); behavior 'smooth' normally, 'auto' (instant) under prefers-reduced-motion (read the existing reduced-motion signal, e.g. state.prefersReducedMotion or a matchMedia helper already in the repo). Narrow = the same breakpoint the Scan layout uses for one column (under 1024px). Do not scroll on wide screens. Do it only for the demo/real-photo buttons (the file input is user-initiated from the same spot, but include it only if trivial and safe). Keep it from throwing when the ref is null.
      - Test: a component/unit test that pressing a demo button on a narrow layout calls scrollIntoView (inject a fake, or spy on the element) with instant behavior under reduced motion and smooth otherwise; guard against null. A check:browser step at 390px: open Scan, press the "Noisy and tilted" demo card, assert the result/read region is within the viewport (its bounding rect top is >= 0 and < innerHeight) after the scroll. Do not loosen other assertions.
    - Finish: run the full gate (typecheck, test:run, build, check-bundle (entry under 150,000 gz), check:browser, contrast report). Create measurements.md with the changed tests/checks and the bytes. Commit `app: browser default language and Scan scroll-into-view` including `.kiro/specs/lang-and-scroll/`, `.kiro/specs/app/requirements.md`, `.kiro/specs/app/design.md`, and any other `.kiro` status files left uncommitted; push. Report: changed tests/checks and why, entry chunk bytes, commit hash. Be very efficient; if the credit cap (15) is near before the gate is green, write docs/STUCK.md with exactly what remains and stop.

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
