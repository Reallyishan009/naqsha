# Implementation Plan: home page as its own screen

## Overview

Make the home page its own screen. Credit cap about 40, stop at about 35 and write what is left in docs/STUCK.md. No new dependencies, colours or fonts. Never loosen a check; change one only with the reason logged in `.kiro/specs/home-screen/measurements.md` (create it: sections Changed tests and checks, Bytes, Not checked by eye). Commit and push (plain push, explicit paths, never git add -A) after each part. Be very efficient: do not re-read big files, keep reports short.

PROBLEM: The Landing (long home page) and "Weave with no design loaded" are one screen: src/ui/App.tsx shows the Landing when state.screen === 'weave' and current.pattern is empty. Pressing Weave in the header on a fresh app shows the whole Landing instead of the Weave tool.

TARGET
- A new screen id 'home' = the Landing (hero, how it works, what you can do, try a sample, Night section, green band, footer). It is the first screen on a fresh start and it is what the "Naqsha" mark (header, wide and narrow) opens.
- 'weave' is only the Weave tool. With no design loaded it shows the existing Weave empty state (the Weave section header, the cloth card with the app-made cloth picture, the Controls card, the Try it samples, the Demo strip, the printable cards), and never the Landing. With a design loaded it is exactly as today.
- Header navigation stays Weave, Keep, Scan, Code. On 'home' no navigation item is current (no aria-current). On the others the current item is as today. Pressing Weave while a design is loaded keeps that design.

## Tasks

- [x] 1. Part 1: state and routing
  - [x] 1.1 Screen 'home', go-home, Landing buttons, commit `home: its own screen`
    - (1) Add 'home' to the Screen type (src/ui/types.ts) and make it the initial screen. Replace every "showsLanding" and "landingShowsProfile" condition (state.screen === 'weave' && pattern is empty) with state.screen === 'home' (grep App.tsx, WeaveScreen.tsx, Shell, scroll effect, live-region class, main class). The profile loading, failure and retry text that the Landing shows must still show on 'home'; on 'weave' it now behaves like on the other screens (the Shell banner and loading state). The Weave screen with no design loaded must render the existing Weave empty state/tool (what the player shows when the cloth is not ready: check WeavePlayer/EmptyState) and never the Landing: if WeaveScreen currently returns the Landing for an empty pattern, move that to a new HomeScreen (lazy not needed; keep it in the entry chunk as today) and make WeaveScreen always render the player.
    - (2) 'go-home' only sets screen = 'home' and closes the Menu sheet. It no longer clears the design, pick, breakpoints or cloth state, so there is no unsaved-work confirm any more. Remove the confirm path that only go-home used (the `{ kind: 'go-home' }` confirm, hasUnsavedWork if only used by it, the strings home.confirm / home.confirmYes if now unused: remove the keys from en.json, hi.json, ADDED_KEYS and regenerate HINDI_REVIEW only if no test needs them; if removing keys breaks a key-set test, keep consistent in both files), but KEEP the confirm that request-sample uses when a sample replaces a scanned, unsaved design. Update its tests.
    - (3) On the Landing, "Try a sample" tiles and the hero "Try a sample" button (which currently scrolls to #landing-samples: keep that scroll behaviour for the hero button since it points at the section, unless the brief meant loading; keep it) load the sample (same request-sample path, same confirm rule) and then set the screen to 'weave' so the person sees the cloth. "Scan a card" and "Open Scan" go to 'scan', "Open Keep" to 'keep', "Open Code view" to 'code', "Weave a sample" to 'weave' after loading Diamond; the other Landing cards' buttons (repair guesses etc.) likewise go to the screen they name. Reuse the existing actions and add a navigate step (dispatch request-sample then navigate 'weave'; mind the confirm: if request-sample raises a confirm, the confirm is drawn on the Weave screen (existing behaviour) so navigate to 'weave' in that case too). Do not duplicate logic.
    - (4) Scroll to top on every screen change (the existing effect), focus handling as today. No navigation item has aria-current on 'home'.
    - Update every test that assumed Landing = weave + empty pattern as needed at the same assertion strength (reducer, App, Shell, Landing, navigation, accessibility) and log which and why in measurements.md. Add tests: fresh app opens on 'home'; the Weave screen with an empty pattern renders the Weave tool (Try it samples present, no hero), not the Landing; the mark from each of the four screens opens 'home' and keeps a loaded design; choosing a Landing sample ends on 'weave' with the cloth; no navigation item has aria-current on 'home'.
    - Run: typecheck, test:run, build, check-bundle (entry under 150,000 gz). Run check:browser too; steps that rely on the Landing at the Weave screen may fail until Part 2: in that case do NOT commit them failing: do the Part 2 browser step updates in this same task as needed to keep the gate green, then commit. Commit message `home: its own screen`; push. Report: what changed, tests changed and why, bytes, commit hash.

- [ ] 2. Part 2: checks, screenshots, docs
  - [ ] 2.1 check:browser, screenshots, docs, commit `home: checks, screenshots, docs`
    - (6) Review every check:browser step that relied on the Landing at the Weave screen (the 390x844 first-view check, the home-button step, the Landing hero checks, the CSP step, the offline Landing steps in both groups, the screenshots script modes and their view preparation in scripts/screenshots.ts which load the site and expect the Landing): make them load the site and see the hero (home); press Weave and see the Weave tool (Try it samples, no hero); press the mark and see the hero again; choose Diamond on the Landing and land on the cloth. Do not loosen any assertion. If Part 1 already updated some, keep them.
    - (7) Screenshots into media/design/after-run4/: home full page at 390 and 1280 (day), and the Weave empty state at 390 and 1280 (day and night): names home-day-390.png, home-day-1280.png, weave-empty-day-390.png, weave-empty-day-1280.png, weave-empty-night-390.png, weave-empty-night-1280.png; add a mode `after-run4` to scripts/screenshots.ts with a validator and tests like earlier modes. Open the images yourself and fix what looks wrong (e.g. the Weave empty state: the cloth card with the app-made cloth picture, Controls card, samples).
    - (8) Update the README sentence that says the Weave screen opens on the Landing, docs/JUDGES.md (step 1 starts from Home, then Weave), and the keep/scan/code docs only where they mention the Landing. Hindi strings stay as they are; add none unless a label changed. One entry in docs/BUILD_LOG.md (short).
    - Run the full gate (typecheck, test:run, build, check-bundle, check:browser, contrast report) once. Commit `home: checks, screenshots, docs` and push. Report: the screenshot list with one-line notes of anything wrong (the orchestrator opens them), checks changed and why, bytes, commit hash.

## Notes

- Stop after Part 2.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] }
  ]
}
```
