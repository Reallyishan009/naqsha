# Implementation Plan

## Overview

The plan has exactly four phases, in this order, followed by one final documentation task. Each phase ends with a push task; the final task commits and pushes itself.

1. **Phase 1: Weave, Try it, printable sample card, deployment.** App foundations, shell, Weave screen with Try it, the printable sample card inside Try it (Requirement 21), the deploy configuration (Requirement 23: `base: './'`, `vercel.json`, README Vercel steps) and a build-log entry.
2. **Phase 2: Keep and the archive.** Archive module, BMP export, save and list, and the Card_Profile notice on Keep (Requirement 22).
3. **Phase 3: Scan.** Photo read, tap-to-correct, Scan_Batch, the Card_Profile notice on Scan (Requirement 22), and the README media (Requirement 23).
4. **Phase 4: CUT-LAST, trimmed by the user.** Live camera (Requirement 18) and one animation extra from Requirement 20: the first weave of a design rises out of darkness, with a skip control, reduced motion respected. Self-hosted fonts only if the app actually loads web fonts. Hindi voice prompts (Requirement 19), the Night loom theme and the other Requirement 20 extras (hole pop, thread-drawn progress) are not built; the first two are DROPPED BY CHOICE of the user.
5. **Final task: `docs/KIRO_USAGE.md`**, written from the real contents of `.kiro` and `docs/BUILD_LOG.md`.
6. **Phase 6: fixes and verification scripts**, added after task 5.1: four fixes, then `check:all`, `check:browser`, `check:deployed`, `check:manual` and `check:everything`, then a real run, commit and push.
7. **Phase 7: flake, hooks evidence, prerelease steering, reviewer agent**, added after task 6.7: the `check:browser` step 11 flake, hook log evidence and `check:hooks`, the manual `prerelease-check` steering file with an offline step, the `weave-reviewer` agent with a real review, then the `KIRO_USAGE.md` update, commit and push.

## How to read this plan

- **Demo-essential** marks a task needed for the guaranteed demo: Weave with Try it, a public deployment, and Keep export and save. If time runs short, finish these first.
- **Cuttable property** marks a single property test that may be dropped under time pressure. Dropping one is reported to the user, never silent. A property without this mark must not be cut.
- **Never cuttable**: every round-trip property (BMP export then read back, archive save then get, printable card draw then `readCard`, PNG density insertion, toggle twice) and every failure-path property (each failure kind has a message in both languages, a failed export, print or save changes nothing, a failed or unaccepted read leaves the Scan_Batch unchanged).
- "Property N" refers to the numbered properties in `design.md`. Each test title starts with the requirement ID and a plain statement of the requirement, carries the comment `Feature: app, Property N: <text>`, uses `fc.assert` with at least 100 runs and a fixed recorded seed, and takes the Card_Profile as a parameter (`testing.md`, `card-geometry.md`).
- Every task ends by running `npm run test:run` and `npm run typecheck`, and committing when both pass. If either fails, fix the cause without weakening a test, or stop and report the shrunk counterexample, seed and path. Narrowing an arbitrary, adding a filter, lowering `numRuns` or loosening a check needs the user's agreement first.
- `src/ui` imports other modules only through their `index.ts`. Relative imports use the `.ts` extension. No `any`. Dependencies stay `react` and `react-dom`; any other dependency needs a bundle-size evaluation recorded in `docs/BUILD_LOG.md` first.
- Identifiers use the glossary terms: pick, end, card, hook, punched hole, zari, naksha.
- Hindi text is written as a first draft with `reviewed: false`.

## Tasks

- [x] 1. Phase 1: Weave, Try it, printable sample card and deployment
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 14.11, 14.12, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 17.7, 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7, 21.8, 21.9, 21.10, 21.11, 21.12, 21.13, 21.14, 21.15, 21.16, 21.17, 21.18, 21.19, 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.10, 23.12, 23.14_

  - [x] 1.1 Build config, shared types and test support
    - **Demo-essential.**
    - Files: `vite.config.ts`, `src/ui/types.ts`, `src/ui/index.ts`, `tests/support/profiles.ts`, `tests/support/fakes.ts`, `tests/ui/structure.test.ts`.
    - Add `tests/**/*.test.tsx` to the test `include`. Write the types of `design.md` in `src/ui/types.ts`.
    - `tests/support/profiles.ts`: `cardProfileArbitrary` (valid profiles of varied size, pitch and `endOrder` permutation; peg hole diameters at least 20% away from each other and from the hole diameter) and `demoProfile()` read from `public/profiles/demo-12x16.json`. `tests/support/fakes.ts`: `FakeScheduler`, `FakeDownloadDeps`, `FakeStorage`.
    - `tests/ui/structure.test.ts`: source scan that `src/ui` imports other modules only via `index.ts` and nothing from `scripts/`, that no `src` file uses `any`, that no module other than `src/ui` imports `src/ui`, and that `package.json` dependencies are exactly `react` and `react-dom`.
    - _Requirements: 13.2, 13.7, 16.2, 16.3, 16.4, 16.6, 16.8_

  - [x] 1.2 Translations, lookup, review list and Phase 1 failure messages
    - **Demo-essential.**
    - Files: `src/ui/i18n/en.json`, `src/ui/i18n/hi.json`, `src/ui/i18n/messages.ts`, `src/ui/i18n/reviewList.ts`, `scripts/review_list.ts`, `docs/HINDI_REVIEW.md`, `package.json`, `tests/ui/i18n/messages.test.ts`, `tests/ui/i18n/failureKeys.test.ts`, `tests/ui/i18n/reviewList.test.ts`.
    - `en.json` flat key-to-text map. `hi.json` key-to-`{ text, reviewed }`, every entry `reviewed: false`. This task adds the keys for the shell, navigation, language, Weave, Try it, printable card and generic errors. Later phases add their own keys.
    - `lookup` (language, then `en`, then the key). `t(key, params)` with `{name}` placeholders.
    - Failure-to-key functions for this phase: `simFailureKey`, `profileFailureKey`, `printFailureKey`, each an exhaustive `switch` ending in a `never` check so a new kind without a message is a compile error (R9.8 pattern). Phases 2 and 3 add the other failure types to the same file.
    - `reviewList`, and `scripts/review_list.ts` writing `docs/HINDI_REVIEW.md` (a `review-list` npm script). Test that the checked-in file equals the generated output.
    - **Property 6 (this phase's failure types)**: generate every `reason` of `SimFailure`, `ProfileFailure` and the printable-card failure; the key exists in both files and is not the raw reason. Failure-path property, never cuttable.
    - **Property 28**: `hi` and `en` have the same keys and the same placeholders.
    - **Property 29** (Cuttable property): lookup falls back to `en`, then to the key.
    - **Property 30** (Cuttable property): the review list is exactly the unreviewed Hindi entries.
    - Example tests: no "bitmap", "matrix", "decode" or their Devanagari forms in `hi.json` outside keys for the cards-as-code view; every `hi` entry has a `reviewed` flag.
    - _Requirements: 2.12, 12.1, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12, 21.17_

  - [x] 1.3 Profile loading
    - **Demo-essential.**
    - Files: `src/ui/profile/loadProfile.ts`, `src/ui/profile/profileUrl.ts`, `tests/ui/profile/loadProfile.test.ts`.
    - `loadProfile(fetchText)` never throws. `profileUrl()` returns `${import.meta.env.BASE_URL}profiles/demo-12x16.json`.
    - **Property 2**: generated JSON texts, a rejected fetch, non-JSON text and valid profiles from `cardProfileArbitrary` map to `ready` or the matching `failed` reason. Failure-path property, never cuttable.
    - _Requirements: 1.6, 1.7, 13.4, 23.3_

  - [x] 1.4 App state and reducer
    - **Demo-essential.**
    - Files: `src/ui/state/appState.ts`, `tests/ui/state/appState.test.ts`.
    - `initialAppState` (screen `weave`, language `hi`, empty pattern) and `appReducer` for the actions of this phase: `navigate`, `profile-loaded`, `set-language`, `request-sample`, `confirm-accepted`, `confirm-dismissed`, `announce`. Phases 2 and 3 extend the reducer with the saved-design and Scan_Batch actions.
    - **Property 1**: navigation keeps the Current_Pattern and the Scan_Batch.
    - **Property 12**: replacing a scanned, unsaved, non-empty pattern with a sample asks first; otherwise the sample replaces it at once.
    - Example tests for the confirmation flow.
    - _Requirements: 1.2, 1.4, 1.5, 4.2, 4.7_

  - [x] 1.5 Shell, language switch, theme tokens and live region
    - **Demo-essential.**
    - Files: `src/ui/App.tsx`, `src/ui/platform/browser.ts`, `src/ui/theme/tokens.css`, `src/ui/theme/contrast.ts`, `src/ui/Shell.module.css`, `src/main.tsx`, `tests/ui/theme/contrast.test.ts`, `tests/ui/platform/browser.test.ts`, `tests/ui/screens/shell.test.tsx`.
    - `App` holds `useReducer(appReducer)`, loads the profile once with `loadProfile`, shows the profile error banner with navigation still usable, and renders three visible navigation controls, the language switch (48 px targets), an error boundary per screen and one `role="status"` live region. Language is stored under `naqsha.language` through an injected storage and sets `document.documentElement.lang`. Keep and Scan are placeholder screens until Phases 2 and 3.
    - Day loom tokens as CSS custom properties, Night loom tokens under `[data-theme='night']` defined but not switchable yet. Fallback font stacks only. Reduced-motion media query turns off transitions and animations. Visible focus outline. Every interactive control has a 48 px minimum size.
    - `contrastRatio` and `TOKEN_PAIRS`. Check each text pair against 4.5 (3 for the focus pair) and record any failing pair with a proposed value in `docs/BUILD_LOG.md`, then change the token.
    - **Property 31** (Cuttable property): the contrast ratio is symmetric, between 1 and 21, equal to 1 for equal colours, and every token pair passes.
    - **Property 32** (Cuttable property): `autoplay(flag)` is true exactly when reduced motion is off.
    - Render-to-string examples: three navigation controls on every screen, the Weave screen is first, a profile error keeps navigation.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.7, 12.2, 12.3, 12.4, 12.5, 13.5, 14.1, 14.2, 14.3, 14.4, 14.6, 14.7, 14.8, 14.10, 14.11, 14.12, 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 1.6 Sample designs
    - **Demo-essential.**
    - Files: `src/ui/samples/sampleDesigns.ts`, `tests/ui/samples/sampleDesigns.test.ts`.
    - `generateSample(profile, design)` for diamond, border and floral as in the design: ends-space formulas, `decodeEnds` for the grid, `3 * P` picks with `P = max(2, hookRows)`. No hard-coded dimension.
    - **Property 10**: every card of every Sample_Design is valid for any valid profile.
    - **Property 11**: the pattern repeats with period `P`, has at least two repeats, and is deterministic.
    - **Property 13 (Sample_Design half)**: for each Sample_Design, `readPatternBmp(exportPatternBmp(...))` with default and generated options returns the same pattern. Round-trip property, never cuttable; this also covers R17.7.
    - Example tests with the demo profile: the three designs differ. Print the three designs as text grids in the test output once, so the user can check the shapes by eye.
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 5.8, 17.7_

  - [x] 1.7 Cloth settings, playback model and gap list
    - **Demo-essential.**
    - Files: `src/ui/state/cloth.ts`, `src/ui/state/playback.ts`, `tests/ui/state/cloth.test.ts`, `tests/ui/state/playback.test.ts`.
    - `weftPlan`, `settingsFromChoices`, `viewportFor`, `gapPickNumbers`, the `COLOURS` list (at least six, all accepted by `parseColour`), `SPEEDS` (three), the cloth reducer that keeps `previous` on failure, `stepForward`, `stepBack`, `scrubTo`, `pickLabel`, `canvasAltText`.
    - **Property 3**: playback positions stay in range and step back undoes step forward.
    - **Property 4** (Cuttable property): position text contains the pick and the total in both languages.
    - **Property 5**: the gap list names exactly the affected picks.
    - **Property 7**: a failed cloth update keeps the previous cloth. Failure-path property, never cuttable.
    - **Property 8**: zari lands on every second pick.
    - **Property 9**: chosen settings are always accepted by `parseRenderSettings`, and a change keeps the current pick.
    - _Requirements: 2.5, 2.6, 2.7, 2.8, 2.10, 2.11, 2.12, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 14.5_

  - [x] 1.8 Weave screen components and Try it samples
    - **Demo-essential.**
    - Files: `src/ui/screens/weave/WeaveScreen.tsx`, `ClothCanvas.tsx`, `TryIt.tsx`, `WeaveScreen.module.css`, `src/ui/App.tsx`, `tests/ui/screens/weave.test.tsx`, `tests/ui/screens/weaveWiring.test.ts`.
    - Wire `prepareCloth`, `parseRenderSettings`, `createPlayer`, `paintToCanvas`, `browserScheduler`. Play, pause, resume, step, scrubber, speed, warp and weft colour, zari with tone, repeat 1 to 8, pick text, hatched gap list in text, failure message with the previous cloth kept, empty state with controls disabled. Canvas sized to the available width within 1 to 4096, with the alternative text. Hide thread size, float highlight and the other `sim-preview.html` controls.
    - "Try it" with three Sample_Designs starts playback (or shows the finished cloth under reduced motion) and asks for confirmation before replacing unsaved scanned cards.
    - Wiring test with `FakeScheduler` and a fake paint: play runs to the last pick and stops; pause keeps the frame; a colour change keeps the pick. Render examples: controls disabled when empty, hidden controls absent.
    - Time sample selection to first painted pick in Node and record the number; the on-device timing is a manual check noted in the log.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.9, 2.12, 2.13, 3.7, 3.8, 4.1, 4.2, 4.7, 4.8, 14.9, 16.5_

  - [x] 1.9 Printable card layout, SVG and raster
    - Files: `src/ui/printable/layout.ts`, `svg.ts`, `raster.ts`, `tests/ui/printable/layout.test.ts`, `svg.test.ts`, `raster.test.ts`.
    - `hookCentreMm`, `printableLayout` (validates profile and grid, returns violations), `printableSvg`, `printableRaster(profile, grid, pixelsPerMm)` returning `PixelData`. Unpunched mark is a mid-grey ring, same outer diameter, interior left as stock. `hookCentreMm` is reused later by the Scan overlay.
    - **Property 34**: the layout is complete and inside the card; invalid input gives violations and no layout. Failure-path property, never cuttable.
    - **Property 35** (Cuttable property): the SVG `width`, `height` and `viewBox` are in millimetres.
    - **Property 37**: for any valid profile (generated, fixed seed) and any valid grid, `readCard(profile, printableRaster(...))` returns the same grid, at the default 12 pixels per millimetre or any value giving holes above `MIN_HOLE_DIAMETER_PX`. Round-trip property, never cuttable.
    - **Property 38**: every pick of each Sample_Design reads back from its printed card, for the demo profile and for generated profiles. Round-trip property, never cuttable.
    - If Property 37 fails, stop and report the shrunk counterexample, seed and path, and whether the drawing or the reader is wrong. Do not narrow or filter. Changing the unpunched mark to a cross is a design change to report, not a way around a failure.
    - _Requirements: 21.3, 21.4, 21.5, 21.7, 21.11, 21.12, 21.13, 21.14, 21.15, 21.16, 21.17, 21.18_

  - [x] 1.10 PNG pixel density and download
    - Files: `src/ui/printable/png.ts`, `download.ts`, `tests/ui/printable/png.test.ts`, `tests/ui/printable/download.test.ts`.
    - `crc32`, `withPixelDensity` (signature check, remove an old `pHYs`, insert after `IHDR`), `download.ts` with canvas encoding and anchor click behind injected dependencies, and a print action that returns a failure without calling the download when the profile or grid is invalid.
    - **Property 36**: inserting the density keeps the PNG intact and is idempotent. Round-trip property, never cuttable.
    - **Property 14 (print half)**: any invalid profile or grid gives a failure and the fake download dependency is called zero times. Failure-path property, never cuttable.
    - Examples: chunk list of a downloaded PNG is `IHDR`, `pHYs`, `IDAT`, `IEND` only; the SVG has no `<metadata>` or `<text>`; a 12-pixel-per-millimetre PNG of the demo card has density 12000.
    - Time `printableRaster` for a Sample_Design pick in Node and record it (target under 500 ms on a phone; on-device is a manual check).
    - _Requirements: 21.2, 21.5, 21.8, 21.10, 21.17, 21.18, 21.19_

  - [x] 1.11 Try it print controls
    - Files: `src/ui/screens/weave/TryIt.tsx`, `src/ui/i18n/en.json`, `src/ui/i18n/hi.json`, `tests/ui/screens/tryit.test.tsx`.
    - For each Sample_Design: a pick chooser (default first pick, clamped to the range), PNG and SVG download buttons loading `printable/` by dynamic `import()`, the sentence "Print at 100% scale, do not fit to page", the sentence that it is a print for photographing and not a cut card, and a failure message with no download.
    - Render examples: both sentences present in both languages; the chooser clamps.
    - _Requirements: 21.1, 21.2, 21.6, 21.9, 21.17_

  - [x] 1.12 Deploy configuration, README Vercel steps and bundle check
    - **Demo-essential.**
    - Files: `vite.config.ts`, `vercel.json`, `README.md`, `scripts/check_bundle.ts`, `package.json`, `tests/ui/deploy.test.ts`.
    - `vite.config.ts` gets `base: './'`. `vercel.json` has the Vite framework, build command `npm run build`, output `dist` and no rewrite.
    - README: banner reference at the top, the Vercel steps (import the repository, framework preset Vite, build command, output directory, public URL), the statement that no login is needed, the `npm run build` and `npm run preview` local check, the statement that Card_Profile values are illustrative and unverified, the statement that no loom controller has been tested, and a placeholder line for the public URL until it exists. Image references with alternative text for the banner and three GIFs (the files arrive in Phase 3).
    - `check_bundle` (an npm script run after `npm run build`): gzipped entry chunk under 200 KB and no URL starting with `/` or `http` in `dist/index.html`. Phase 3 adds the Scan-only marker check.
    - Test: `vercel.json` content, `base` is `'./'`, the app source has no `fetch` target other than the profile, no analytics string, no `http` font URL in the CSS. After `npm run build`, run `check_bundle` and `parseCardProfile` on `dist/profiles/demo-12x16.json`.
    - _Requirements: 13.1, 13.3, 13.4, 13.6, 13.7, 16.1, 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.10, 23.12, 23.14_

  - [x] 1.13 Phase 1 build-log entry
    - **Demo-essential.**
    - Files: `docs/BUILD_LOG.md`, `docs/HINDI_REVIEW.md`.
    - Record what was built, the contrast findings, the bundle sizes, the Node timings (sample load, `printableRaster`), flagged Hindi strings, and the manual checks still open: a phone-width check of Try it with `npm run dev`, printing a Printable_Card at 100% scale and measuring it with a ruler, and on-device timings. Regenerate `docs/HINDI_REVIEW.md`.
    - _Requirements: 4.8, 16.7, 21.5, 21.19_

  - [x] 1.14 Phase 1 push
    - **Demo-essential.**
    - Run `npm run test:run`, `npm run typecheck` and `npm run build`, then `git push`. Run `git remote -v` first; if no remote is configured, ask the user before pushing and do not add one yourself.
    - _Requirements: 16.7_

- [x] 2. Phase 2: Keep and the archive
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 22.1, 22.2, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10, 22.11, 22.12, 22.13_

  - [x] 2.1 Archive types and functions over a store
    - **Demo-essential.**
    - Files: `src/archive/types.ts`, `src/archive/designs.ts`, `src/archive/index.ts`, `tests/archive/designs.test.ts`, `tests/support/fakes.ts`.
    - Types of the design. `saveDesign`, `getDesign`, `listDesigns`, `deleteDesign` over an injected `ArchiveStore`, `now` and `newId`. Sorting by `createdAt` descending then `id`. Every failure a value, no throw. Import only types from `src/codec/index.ts`.
    - `FakeArchiveStore`: in-memory, `put` stages both the record and the summary and commits together, injectable failure at open, `put`, `get`, `list` and `remove`.
    - **Property 15**: saving then getting returns an equal pattern, equal Metadata, the same profile name and creation time. Round-trip property, never cuttable.
    - **Property 16** (Cuttable property): lists are newest first and carry no pattern.
    - **Property 17**: delete removes exactly one design; unknown ids give `not-found`.
    - **Property 18**: an injected failure at open, `put` or `remove` gives `storage-unavailable` or `write-failed`, does not throw and leaves the store unchanged. Failure-path property, never cuttable.
    - Example tests: field storage, empty list, a `put` that fails after staging leaves nothing.
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

  - [x] 2.2 IndexedDB store
    - **Demo-essential.**
    - Files: `src/archive/idbStore.ts`, `src/archive/index.ts`, `tests/archive/structure.test.ts`.
    - `openIndexedDbStore()` for database `naqsha-archive` version 1 with stores `designs` and `summaries` (index `createdAt`), `put` and `remove` in one `readwrite` transaction over both. An unavailable `indexedDB` rejects with a value that `designs.ts` maps to `storage-unavailable`. Default deps use `Date.now` and `crypto.randomUUID`.
    - Source-scan test: only `idbStore.ts` mentions `indexedDB`, no file in `src/archive` mentions `localStorage`, and imports from `src/codec` are type-only through `index.ts`.
    - The real IndexedDB cannot run in Node here. State this in the log (task 2.7) and add a manual check item: save, refresh, list, reopen.
    - _Requirements: 6.8, 6.9, 6.11_

  - [x] 2.3 Card_Profile notice
    - **Demo-essential.**
    - Files: `src/ui/profile/notice.ts`, `src/ui/ProfileNotice.tsx`, `src/ui/ProfileNotice.module.css`, `src/ui/i18n/en.json`, `src/ui/i18n/hi.json`, `tests/ui/profile/notice.test.ts`, `tests/ui/screens/profileNotice.test.tsx`.
    - `profileNotice(profile)` returns a notice exactly when `status` contains `UNVERIFIED`, with the status text unchanged. `ProfileNotice` shows the profile `name` always, and the translated sentence plus the status text beside an icon or word when the notice exists. It is not announced through the live region. Reused by the Scan screen in Phase 3.
    - **Property 39**: the notice shows exactly for an unverified profile (any status text, `undefined`, lower-case "unverified", "UNVERIFIED" inside other words), and `statusText` equals the status. Not cuttable (R22.13 requires it).
    - Examples: the demo profile gives a notice with the status text unchanged; switching language changes the sentence and keeps the status text.
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.8, 22.9, 22.10, 22.11, 22.13_

  - [x] 2.4 Reducer actions for saved designs
    - **Demo-essential.**
    - Files: `src/ui/state/appState.ts`, `tests/ui/state/appState.test.ts`.
    - Add `open-saved` (replaces the Current_Pattern with origin `archive`, shows Weave) and `mark-saved` (sets `saved: true` on a scanned origin). Extend the Property 1 test to include these actions.
    - _Requirements: 7.7_

  - [x] 2.5 Keep logic and export, archive failure messages
    - **Demo-essential.**
    - Files: `src/ui/state/keep.ts`, `src/ui/i18n/messages.ts`, `src/ui/i18n/en.json`, `src/ui/i18n/hi.json`, `tests/ui/state/keep.test.ts`, `tests/ui/i18n/failureKeys.test.ts`.
    - `canExport`, `canSave`, `savedLabel`, `summaryRow`, `runExport` (calls `exportPatternBmp`, and `downloadBmp` with `bmpFileName` only on success), the Keep form reducer that keeps the form on failure. Add `exportFailureKey`, `bmpReadFailureKey` and `archiveFailureKey` as exhaustive switches, and the Keep keys.
    - **Property 6 (export, BMP read and archive failure types)**: every `reason` has a key in both files that is not the raw reason. Failure-path property, never cuttable.
    - **Property 13 (runExport half)**: generated profiles, patterns and options through `runExport` bytes read back to the same pattern. Round-trip property, never cuttable.
    - **Property 14 (export half)**: invalid profile, empty pattern, damaged card or invalid options gives a failure and `FakeDownloadDeps` is called zero times. Failure-path property, never cuttable.
    - **Property 20**: a failed save keeps the entered Metadata and sets an error announcement. Failure-path property, never cuttable.
    - **Property 19** (Cuttable property): the saved label shows the trimmed name or "untitled" in the language.
    - **Property 21** (Cuttable property): list rows show name, place, date and pick count, and the profile name only when it differs from the profile in use.
    - Examples: defaults equal `DEFAULT_EXPORT_OPTIONS`, an empty pattern disables both controls, `bmpFileName` is used.
    - _Requirements: 5.3, 5.5, 5.6, 5.7, 5.8, 7.2, 7.3, 7.4, 7.6, 22.12_

  - [x] 2.6 Keep screen components
    - **Demo-essential.**
    - Files: `src/ui/screens/keep/KeepScreen.tsx`, `KeepScreen.module.css`, `src/ui/App.tsx`, `tests/ui/screens/keep.test.tsx`.
    - Export options (bit depth, lift colour, pick order, end order, one line each), the loom-purpose export button, the "no loom controller has been tested" sentence, the six optional fields, save, the record-not-legal-protection sentence, the saved list with open and confirmed delete, the empty-list text, the Card_Profile name and the Unverified_Profile notice next to the export control and next to the save control (shown before use, never blocking), and a differing profile name on list entries. Mount the screen in `App`.
    - Render examples: markup in a name appears escaped; the notice is shown for the demo profile and absent for a profile without status; both notice places exist; an empty pattern disables export with the Try it or Scan hint; a failed save keeps the form.
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.9, 7.1, 7.5, 7.8, 7.9, 7.10, 22.1, 22.2, 22.4, 22.6, 22.7, 22.10, 22.12_

  - [x] 2.7 Phase 2 build-log entry
    - **Demo-essential.**
    - Files: `docs/BUILD_LOG.md`, `docs/HINDI_REVIEW.md`, `.kiro/steering/structure.md`.
    - Update the `src/archive` and `src/ui` entries in `structure.md` to the real exports (`saveDesign`, `getDesign`, `listDesigns`, `deleteDesign`; `App`). Add a log entry with the manual IndexedDB check (save, refresh, list, reopen) and its result or "not yet run". Regenerate `docs/HINDI_REVIEW.md`.
    - _Requirements: 6.1, 12.12_

  - [x] 2.8 Phase 2 push
    - **Demo-essential.**
    - Run `npm run test:run`, `npm run typecheck` and `npm run build`, then `git push`. Run `git remote -v` first; if no remote is configured, ask the user before pushing.
    - _Requirements: 16.7_

- [x] 3. Phase 3: Scan with tap-to-correct and batch
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 16.10, 17.1, 17.3, 17.5, 17.6, 22.1, 22.3, 22.5, 22.10, 22.11, 23.9, 23.11, 23.12, 23.13_

  - [x] 3.1 Scan_Batch operations and reducer actions
    - Files: `src/ui/state/batch.ts`, `src/ui/state/appState.ts`, `tests/ui/state/batch.test.ts`, `tests/ui/state/appState.test.ts`.
    - `appendCard`, `removeCard`, `moveCard`, `replaceCard`, `commitBatch`, and the reducer actions `batch-accept`, `batch-remove`, `batch-move`, `batch-replace`, `batch-commit`, `read-failed`. Extend the Property 1 test to the new actions.
    - **Property 23**: a `read-failed` action leaves the batch unchanged and announces the failure. Failure-path property, never cuttable.
    - **Property 26**: batch operations keep their invariants, and any out-of-range index returns the batch unchanged.
    - **Property 27**: Done keeps the order of the Scan_Batch (replace and append).
    - Example tests: the replace or append confirmation, and an unaccepted read does not alter the batch.
    - _Requirements: 9.1, 11.1, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

  - [x] 3.2 Read failure messages
    - Files: `src/ui/i18n/messages.ts`, `src/ui/i18n/en.json`, `src/ui/i18n/hi.json`, `tests/ui/i18n/failureKeys.test.ts`.
    - `readFailureKey` as an exhaustive switch over the six `ReadFailure` kinds (`invalid-profile`, `invalid-image`, `peg-holes-not-found`, `ambiguous-orientation`, `resolution-too-low`, `card-outside-image`), importing the reader's type under the alias `CardReadFailure`. Add the Scan keys, with the plain-language texts that R9.2 to R9.7 describe, in Hindi and English.
    - **Property 6 (read failure type)**: every kind has a key in both files that is not the raw kind string. Failure-path property, never cuttable.
    - Example tests: the text for `peg-holes-not-found`, `ambiguous-orientation`, `resolution-too-low`, `card-outside-image` and `invalid-image` states the cause and the next step in both languages.
    - _Requirements: 8.6, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [x] 3.3 Correction and marker logic
    - Files: `src/ui/state/corrections.ts`, `tests/ui/state/corrections.test.ts`.
    - `toggleHook`, `undoCorrection`, `hookMarkers` (uses `cardToImage` from `src/reader` and `hookCentreMm` from `src/ui/printable/layout.ts`), `hitSizePx`, `minimumZoom`.
    - **Property 22**: markers sit on the hook positions, with `filled` for a punched hole and `ring` otherwise.
    - **Property 24**: toggling a hook twice restores the grid, one toggle changes exactly one cell, the result passes `validateCardGrid`, and undoing every correction returns the read grid. Round-trip property, never cuttable.
    - **Property 25** (Cuttable property): hit areas reach 48 CSS pixels at or above `minimumZoom`.
    - Example: a position outside the grid returns the grid unchanged.
    - _Requirements: 8.3, 8.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 3.4 Scan screen components
    - Files: `src/ui/screens/scan/ScanScreen.tsx`, `CardOverlay.tsx`, `BatchList.tsx`, `ScanScreen.module.css`, `src/ui/App.tsx`, `tests/ui/screens/scan.test.tsx`, `tests/integration/scanFixtures.test.ts`.
    - Lazy-load `ScanScreen` with `React.lazy` and `Suspense`. File input, busy state, a request counter so a late result never replaces a newer one, overlay with filled and ring markers and a text legend, enlarged hit areas and zoom, keyboard-operable markers, corrected badge, undo, accept, batch list (numbered thumbnails, confirmed remove, earlier, later, scan again), Done with the replace or append question, one message per `CardReadFailure` kind, violation locations for `invalid-profile`, the Card_Profile name and the Unverified_Profile notice (reusing `ProfileNotice` from task 2.3), no network request.
    - Integration test with the fixtures in `tests/fixtures/` and their ground-truth JSON, for all four conditions (clean, noisy, tilted, noisy and tilted): `readCard` on the fixture pixels equals the ground-truth grid and the overlay markers match it. A failure example for each of the six read failure kinds through the message mapping.
    - Render examples: each marker is a button with an accessible name; Done is disabled for an empty batch; the notice and profile name are shown.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.10, 16.10, 17.5, 17.6, 22.1, 22.3, 22.5, 22.10, 22.11_

  - [x] 3.5 Scan chunk check and timing
    - Files: `scripts/check_bundle.ts`, `docs/BUILD_LOG.md`.
    - Extend `check_bundle` so a Scan-only marker string must be absent from the entry chunk and present in a separate chunk. Run it and record the sizes. Time `readCard` on a 1080p synthetic image in Node and record it (the on-device number is a manual check).
    - _Requirements: 8.8, 16.1, 16.10_

  - [x] 3.6 README media (manual capture)
    - Files: `media/banner.png`, `media/weave-sample.gif`, `media/scan-printed-card.gif`, `media/keep-export.gif`, `README.md`.
    - This task needs the user if it cannot be done headlessly. Run `npm run build` and `npm run preview`, then capture one banner and three GIFs from the Built_Site in a real browser with the demo profile: Weave playback of a Sample_Design; scanning the printed card with a tap correction; the BMP export. The Scan and Keep GIFs must show the Card_Profile notice. Each file at most 5 MB (check with `ls -l`). Confirm the public URL with the user and put it in the README. The README already references these files (task 1.12); check that every reference resolves and has alternative text.
    - If capture is not possible in this session, say so, leave the README references in place, and list the missing files in the build log; this does not block the Phase 3 push.
    - _Requirements: 23.5, 23.9, 23.10, 23.11, 23.12, 23.13_

  - [x] 3.7 Phase 3 build-log entry and final check
    - Files: `docs/BUILD_LOG.md`, `docs/HINDI_REVIEW.md`.
    - Run `npm run test:run`, `npm run typecheck`, `npm run build` and `check_bundle`. Confirm every requirement ID from 1 to 17 and 21 to 23 appears in a test title (18 to 20 are Phase 4). Regenerate `docs/HINDI_REVIEW.md` and tell the user how many strings need a native Hindi speaker. List what was not verified: real IndexedDB in a browser, on-device timings, any loom controller, the Hindi text, real card dimensions.
    - _Requirements: 12.9, 12.12, 16.7, 17.1, 17.3_

  - [x] 3.8 Phase 3 push
    - Run `npm run test:run`, `npm run typecheck` and `npm run build`, then `git push`. Run `git remote -v` first; if no remote is configured, ask the user before pushing.
    - _Requirements: 16.7_

  - [x] 3.9 Requirement-ID coverage
    - Not demo-essential.
    - Files: existing test files under `tests/`, `docs/BUILD_LOG.md`.
    - The Phase 3 build-log entry (task 3.7) lists 55 requirement IDs that appear in no test title. Take that list from `docs/BUILD_LOG.md`, start with the 21.x and 23.x IDs, then the rest. For each ID choose exactly one of three outcomes:
      1. An existing test already checks the requirement: add the ID prefix to its title.
      2. No test checks it: write a new test with the ID prefix (property-based where the requirement is about a pure function, per `testing.md`).
      3. It cannot be tested automatically: list it in `docs/BUILD_LOG.md` as a manual check with exact steps (what to open, what to do, what to expect).
    - Never weaken, narrow, skip or delete a test. Changing a title prefix is the only edit allowed on an existing test. If a new test fails, stop and report the shrunk counterexample, seed and path.
    - Re-run the title check used in task 3.7 and confirm that every one of the 55 IDs is now in a test title or in the manual-check list.
    - Report three counts to the user and in the build log: IDs given a prefix on an existing title, new tests written, manual checks.
    - Run `npm run test:run` and `npm run typecheck`. Commit. Do not push (the next push is task 4.7).
    - _Requirements: 17.1, 17.3_

- [x] 4. Phase 4: CUT-LAST features, trimmed
  - Scope set by the user: the live camera, and one animation extra (rise from darkness). Self-hosted fonts are conditional. Hindi voice prompts and the Night loom theme are dropped by choice.
  - Every task in this phase ends by running `npm run test:run`, `npm run typecheck`, `npm run build` and `npm run check-bundle` (the npm script that runs `scripts/check_bundle.ts`), and committing when all four pass. No property is weakened: no narrowed arbitrary, no filter, no lower `numRuns`, no looser check.
  - _Requirements: 13.5, 13.6, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 20.2, 20.4, 20.6_

  - [x] 4.1 Live camera scan
    - Files: `src/ui/screens/scan/LiveCamera.tsx`, `src/ui/screens/scan/ScanScreen.tsx`, `src/ui/platform/browser.ts`, `tests/ui/platform/browser.test.ts`, `tests/ui/screens/liveCamera.test.ts`.
    - `cameraControl(env)` decision, `getUserMedia` stream with a card-shaped guide frame, capture of one frame through the existing `loadPixelData` and `readCard` path, a refused or missing camera message with photo upload kept, track stop on leave, and the secure-page note.
    - **Property 33** (Cuttable property): the camera control follows the secure-page rule.
    - Example with `FakeCamera` that counts stopped tracks after leaving the screen, and a refused-permission example that leaves photo upload usable (failure path).
    - Run the four checks named in the task 4 header.
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [x] 4.2 Rise from darkness, with skip control
    - Only this animation extra of Requirement 20 is built. The hole pop (20.1), the thread-drawn progress (20.3) and the Night loom theme switch (20.5) are not built.
    - Files: `src/ui/screens/weave/WeaveScreen.tsx`, `src/ui/screens/weave/WeaveScreen.module.css`, `src/ui/state/playback.ts`, `src/ui/i18n/en.json`, `src/ui/i18n/hi.json`, `tests/ui/state/playback.test.ts`, `tests/ui/screens/weave.test.tsx`.
    - The first weave of a design rises out of darkness once: the cloth fades in from dark to full colour while the first playback runs. A skip control (48 px target, text label in both languages, keyboard operable) ends the effect at once and shows the cloth at full colour. Later plays of the same design, step, scrub and settings changes do not repeat it. The effect is a pure function of an elapsed fraction so it can be tested without a browser.
    - Under `prefers-reduced-motion: reduce` the effect never starts and no skip control is shown (reuses `autoplay`, Property 32).
    - Add no dependency and no image or font asset; the entry chunk must stay under 200 KB gzipped (`check_bundle`).
    - Property test with a recorded seed: the effect level is between 0 and 1, never decreases as the fraction grows, equals 1 once skipped, and is always 1 under reduced motion. Example tests: it runs once per design, skip ends it, reduced motion shows none.
    - Run the four checks named in the task 4 header.
    - _Requirements: 20.2, 20.4, 20.6_

  - [x] 4.3 Self-hosted fonts (conditional)
    - Check first: does the app actually load web fonts? Search `src`, `index.html`, `public` and `dist` for `@font-face`, `fonts.googleapis`, `fonts.gstatic`, `.woff`, `.woff2` and any `<link>` to a font. The earlier tasks use fallback font stacks only.
    - If no web font is loaded: build nothing. Record in `docs/BUILD_LOG.md` that self-hosted fonts are not needed, with the files searched and the result. Do not add `public/fonts/` or `src/ui/theme/fonts.css`.
    - If a web font is loaded: add `woff2` subsets only if the licence allows redistribution (record each licence in `docs/BUILD_LOG.md`), referenced by relative `@font-face` URLs with `font-display: swap`; Files: `public/fonts/`, `src/ui/theme/fonts.css`, `src/main.tsx`; re-run the no-third-party-host test.
    - Run the four checks named in the task 4 header.
    - _Requirements: 13.5, 13.6_

  - [x] 4.4 Record dropped features
    - Files: `docs/BUILD_LOG.md`.
    - Add one entry stating that Hindi voice prompts (Requirement 19) and the Night loom theme (Requirement 20.5) were DROPPED BY CHOICE of the user, not for lack of time or because of a failure, and that the hole pop (20.1) and thread-drawn progress (20.3) were left out when the user trimmed Phase 4. No implementation task exists for any of them; do not add code, tests, strings or tokens for them. The Night loom tokens already in `src/ui/theme/tokens.css` stay as they are.
    - Run the four checks named in the task 4 header.
    - _Requirements: 16.7_

  - [x] 4.5 Phase 4 build-log entry
    - Files: `docs/BUILD_LOG.md`, `docs/HINDI_REVIEW.md`.
    - Record what was built (4.1, 4.2), the result of the font check (4.3), the dropped features (4.4), the check results and bundle sizes, any Hindi strings added, and the updated "not verified" list (live camera on a real device, the rise-from-darkness effect in a real browser).
    - Regenerate `docs/HINDI_REVIEW.md` with `npm run review-list`. Run the four checks named in the task 4 header.
    - _Requirements: 12.12, 16.7_

  - [x] 4.6 Phase 4 push
    - Run `npm run test:run`, `npm run typecheck`, `npm run build` and `npm run check-bundle`, then `git push`. The user has authorised this push. Run `git remote -v` first; if no remote is configured, ask the user before pushing and do not add one yourself.
    - _Requirements: 16.7_

- [x] 5. Final task: Kiro usage document
  - [x] 5.1 Write docs/KIRO_USAGE.md
    - Files: `docs/KIRO_USAGE.md`. Read-only inputs: everything under `.kiro` (specs, steering, hooks, settings including the MCP configuration), `docs/BUILD_LOG.md`, `git log`.
    - Describe only what was done, and verify each statement against the files, the build log or git history. Do not describe a Kiro feature without evidence. For each Kiro feature actually used, give the file names and one concrete example:
      - Specs: the four specs, each with its `requirements.md`, `design.md` and `tasks.md`, and one example of a requirement flowing into a design property and a task.
      - Steering docs: each file under `.kiro/steering`, what it says, and which one helped most with the evidence for that.
      - Hooks: which hooks exist under `.kiro/hooks`, and whether each fired, from evidence only (build log, git history). If there is no evidence a hook fired, say so.
      - MCP: Context7, only if the build log or history shows it was used. Otherwise say it was configured and not used, or not configured.
      - Property-based tests and the real bugs they caught: verify each in `docs/BUILD_LOG.md` or git history before listing it, including the decoy peg pair, overlapping holes, the Property 46 and Property 5 changes and any other. Give the commit or log entry for each.
      - Vibe sessions: only if the log or history shows one.
    - Include what did not work (failures, parked tasks, tool limits, things Kiro got wrong and how they were fixed).
    - State plainly: planning and prompt drafting were done with Claude; Kiro wrote the specs and the code.
    - Run `npm run test:run` and `npm run typecheck`. Commit and `git push`; the user has authorised this push. Run `git remote -v` first; if no remote is configured, ask the user.
    - _Requirements: 16.7_

- [x] 6. Phase 6: fixes and verification scripts
  - Every task in this phase ends the same way: run `npm run test:run`, `npm run typecheck`, `npm run build` and `npm run check-bundle`, then commit the specific paths the task changed (never `git add -A` or `git add .`). No test is weakened or deleted; if a check fails, fix the cause or report the failure with its output (for a property, the shrunk counterexample, seed and path).
  - _Requirements: 2.8, 8.8, 14.12, 16.5, 16.7, 20.4, 23.1, 23.11_

  - [x] 6.1 Fixes: structure test, test IDs, README, Skip focus
    - Files: `tests/ui/structure.test.ts`, `docs/BUILD_LOG.md`, the four test files named in the task 3.9 log, `README.md`, `tests/ui/deploy.test.ts` (only if the README test needs the new text, never loosened), the Skip control component and its focus target function under `src/ui/` (find them from the task 4.2 log entry), `src/ui/state/` or the file that holds the pure function, and the matching test files.
    - (a) Read the working-tree change to `tests/ui/structure.test.ts` with `git diff`. Accept it only if it reads: only `src/ui/screens/scan/camera.ts` may mention `getUserMedia` or `mediaDevices`. If the diff says something else, stop and report it. Record the acceptance, with the date and the exact rule, in `docs/BUILD_LOG.md`.
    - (b) Fix the four test titles that carry the wrong requirement ID. Take all four from the task 3.9 entry in `docs/BUILD_LOG.md` (the list that starts "Existing titles carry an ID that does not match"): `tests/ui/printable/raster.test.ts` Property 38 over generated profiles (R21.14 to R21.15), `tests/ui/state/playback.test.ts` "there are three speeds" (R2.6 to R2.8), `tests/ui/state/cloth.test.ts` "the viewport clamps" (R3.4 to R3.7), `tests/ui/screens/weave.test.tsx` "thread size ... absent" (R2.13 to R3.8). Check each against `requirements.md` before editing. Change only the ID in the title; the body, seed, `numRuns` and assertions stay as they are. Note the change in `docs/BUILD_LOG.md`.
    - (c) Fix `README.md`: remove "coming" and "no app screen yet" everywhere (the intro line and the "What it does" table rows for the Camera screen, simulator, exporter and Archive). Describe the app as it is now, with the live URL https://naqsha-ashen.vercel.app/. Claim nothing that does not exist: state that the Hindi text is unreviewed, the camera is untested on real devices, no loom controller is tested and the Card_Profile is unverified. Keep the README test in `tests/ui/deploy.test.ts` passing without changing what it checks.
    - (d) Close the Skip button focus gap from task 4.2. Write a pure function that returns the focus target after Skip: the Pause control, or the Play control when playback is paused. Unit test it and add a fast-check property. Wire it in the component with a ref, keep the reduced-motion behaviour unchanged, and add a render or wiring test that Skip moves focus to the target. Mark the open gap in `docs/BUILD_LOG.md` as closed, with the date.
    - Property test names state the requirement in words and carry the comment `Feature: app, Property N: <text>` only where a design property applies; otherwise the title states the requirement ID and plain statement.
    - End with the common steps above.
    - _Requirements: 2.8, 3.7, 3.8, 14.11, 16.7, 20.4, 21.15, 23.1_

  - [x] 6.2 `npm run check:all`
    - Files: `scripts/check_all.ts`, `scripts/checks/hygiene.ts`, `scripts/checks/secrets.ts`, `scripts/checks/summary.ts`, `package.json`, `tests/scripts/hygiene.test.ts`, `tests/scripts/secrets.test.ts`, `tests/scripts/summary.test.ts`.
    - `check:all` runs these steps in order: typecheck, the full test suite, build, bundle check, the spec format validators, repo hygiene. For the spec format validators, look in the repo for an existing command (a script in `package.json` or a file under `scripts/`); if none exists, report the step as SKIPPED with the reason "no spec format validator command in the repo" and do not invent one.
    - Repo hygiene checks: `LICENSE` present; `.kiro` is not git-ignored (use `git check-ignore`); `.kiro/specs`, `.kiro/hooks` and `.kiro/settings` exist; no API keys or tokens in tracked files (a pattern scan over `git ls-files` with a documented allowlist in the source, each allowlist entry carrying a reason); `README.md` has no "coming"; the git working tree state, reported as info and never a failure.
    - Output: PASS, FAIL or SKIPPED per step, the exact output of any failed step, then a summary table. Exit code is non-zero if any step fails. `--bail` stops at the first failure; without it every step runs.
    - The pure parts are separate functions: each hygiene check over injected file and git data, the secret scan, the summary formatting and the argument parsing. They take injected dependencies and are tested with fakes.
    - Property tests (fast-check, fixed seed, at least 100 runs): the secret detector flags every planted key from generators for the formats it claims to detect (embedded in arbitrary surrounding text) and passes generated clean text that contains no such pattern; the summary table has one row per step and its exit code is non-zero exactly when a step failed; `--bail` output never contains a step after the first failure.
    - Example tests: each hygiene check passes and fails on a fake repository; allowlisted text is not flagged; SKIPPED does not count as failure.
    - End with the common steps above.
    - _Requirements: 16.7, 23.1_

  - [x] 6.3 `npm run check:browser`
    - Files: `scripts/check_browser.ts`, `scripts/checks/cdp.ts`, `scripts/checks/chrome.ts`, `scripts/checks/bmpHeader.ts`, `package.json`, `.gitignore`, `docs/BUILD_LOG.md`, `tests/scripts/bmpHeader.test.ts`, `tests/scripts/chrome.test.ts`.
    - Drive real headless Chrome with the same approach as the README media capture (look at how `scripts/` or the task 3.6 log entry did it): the installed Chrome, controlled over the DevTools protocol. Prefer no new dependency: write a small CDP client over Node's built-in WebSocket. If a dev-only dependency turns out to be needed, justify it in `docs/BUILD_LOG.md` first, with its size and why the built-in route was not enough.
    - The script starts `npm run preview` on the built `dist/` itself, waits until it answers, and stops it on exit, including after a failure. It fails with a clear message if Chrome is not found, and honours a `CHROME_PATH` override. It requires `dist/` to exist and says so otherwise.
    - Steps, each reported PASS or FAIL with the reason: load the app; switch the language; play each Try it sample; save a design in Keep, hard reload, the design is still listed; open it; delete it, and it is still gone after a reload; export the 1-bit and 8-bit BMP and check the width (ends), height (picks), colour count and file size, by direct header parse; download the printable card PNG; upload it to Scan and check the read grid equals the sample pick; upload a blank image and check the failure message; no horizontal scroll at 320, 390 and 1280 px.
    - Screenshots go in `media/check/`, which is added to `.gitignore`. Exit code is non-zero if any step fails.
    - The pure parts get unit tests: the BMP header parse (agrees with `readPatternBmp` on exported files), the Chrome path search over an injected file system, and the result formatting.
    - Property test (fast-check, fixed seed, at least 100 runs): for any generated pattern and export options, the direct header parse of `exportPatternBmp` output gives the same width, height, colour count and file size as `bmpLayout`.
    - End with the common steps above. Do not run the script against Chrome in this task beyond a smoke run; the real run is task 6.7.
    - _Requirements: 14.12, 21.15, 23.1_

  - [x] 6.4 `npm run check:deployed`
    - Files: `scripts/check_deployed.ts`, `scripts/checks/deployed.ts`, `package.json`, `tests/scripts/deployed.test.ts`.
    - `npm run check:deployed -- <url>`; the default is https://naqsha-ashen.vercel.app/. Steps, each PASS or FAIL: HTTP 200 with no redirect to a login page; `profiles/demo-12x16.json` loads and passes `parseCardProfile`; the JS and CSS assets referenced by `index.html` each load with 200; the page title is the expected one (read it from `index.html`); print the key response headers (content type, cache control, server). Exit code is non-zero on failure.
    - The pure parts are separate and unit tested: URL normalisation (trailing slash, relative asset resolution against the base), extraction of script and stylesheet references and the title from HTML, login-redirect detection, header selection and result formatting.
    - Property tests (fast-check, fixed seed, at least 100 runs): asset extraction finds every generated `src` and `href` of script and stylesheet tags and no others; URL resolution of a relative asset against a base stays on the base origin; normalisation is idempotent.
    - End with the common steps above.
    - _Requirements: 23.1, 23.3_

  - [x] 6.5 `npm run check:manual`
    - Files: `scripts/check_manual.ts`, `scripts/checks/manualSteps.ts`, `scripts/checks/manualResults.ts`, `docs/MANUAL_TEST_RESULTS.md` (created on first answer by the script, not by hand), `package.json`, `tests/scripts/manualSteps.test.ts`, `tests/scripts/manualResults.test.ts`.
    - An interactive terminal walkthrough: one step at a time with exact instructions, then asks pass, fail or skip. Each answer is appended with the date to `docs/MANUAL_TEST_RESULTS.md`; earlier answers are never overwritten or removed.
    - Steps: live camera on the phone using the deployed URL; printing at 100% and measuring with a ruler; a real card photo; the rise-from-darkness look; reduced motion; IndexedDB in a real browser, if not already covered by `check:browser`; and the five manual items R8.8, R14.12, R16.5, R23.1 and R23.11. Read the five items' real steps from the "Manual coverage list" in the task 3.9 entry of `docs/BUILD_LOG.md`. Keep them in a data file (`manualSteps.ts`) that duplicates the steps exactly, with a test that reads `docs/BUILD_LOG.md` and checks that the IDs and the step text in the data file match the log.
    - The pure parts are separate and unit tested: the step list, answer parsing (accepts p, pass, f, fail, s, skip in any case; rejects anything else and asks again), and results formatting (append-only). Input and output are injected so the walkthrough is tested with fake streams.
    - Property tests (fast-check, fixed seed, at least 100 runs): answer parsing accepts exactly the documented words in any letter case and with surrounding whitespace, and rejects other text; appending a result keeps every earlier line of the file unchanged.
    - End with the common steps above. This task does not run the walkthrough; the user does.
    - _Requirements: 8.8, 14.12, 16.5, 23.1, 23.11_

  - [x] 6.6 `npm run check:everything`, README and build-log entry
    - Files: `scripts/check_everything.ts`, `package.json`, `README.md`, `docs/BUILD_LOG.md`, `tests/scripts/everything.test.ts`, `tests/ui/deploy.test.ts` (only to add checks, never to loosen).
    - `check:everything` runs `check:all`, then `check:browser`, then `check:deployed` (printing its result), and runs `check:manual` only when `--manual` is given. It exits non-zero if any step it ran failed, and prints a summary table with the exit status of each.
    - README gets a "Verify it yourself" heading that documents all five commands: `check:all`, `check:browser`, `check:deployed`, `check:manual` and `check:everything`. For each, say what it does and what it needs; state that `check:browser` needs Chrome (with the `CHROME_PATH` override) and a built `dist/`, `check:deployed` needs network access, and `check:manual` needs a person and a phone. The README must still contain no "coming".
    - Add a `docs/BUILD_LOG.md` entry for Phase 6: what each script checks, what it cannot check, and any dependency decision.
    - The pure planning part (which steps run for which flags) is separate and unit tested, with a property that the step order is always all, browser, deployed, then manual, and manual is present exactly when `--manual` is given.
    - End with the common steps above.
    - _Requirements: 16.7, 23.1_

  - [x] 6.7 Run the checks for real, fix, commit and push
    - Files: whichever scripts or files the real runs show to be wrong; `docs/BUILD_LOG.md`.
    - Run `npm run check:all` and `npm run check:browser` for real. Report the exact output, including every failure. Do not weaken, skip or remove any check, test or property to make a run pass.
    - Fix real bugs in the scripts. Report real app bugs without hiding them: for each, record the step, the output and the cause in `docs/BUILD_LOG.md`, and fix it only if the fix is small and a test covers it; otherwise leave it reported and open.
    - Run `npm run test:run`, `npm run typecheck`, `npm run build` and `npm run check-bundle`. Commit the specific paths changed. Run `git remote -v`, then `git push`; the user has authorised this push. Never force push.
    - _Requirements: 16.7, 23.1_

- [x] 7. Phase 7: flake, hooks evidence, prerelease steering, reviewer agent
  - Every task in this phase ends the same way: run `npm run test:run`, `npm run typecheck`, `npm run build` and `npm run check-bundle`, then commit the specific paths the task changed (never `git add -A` or `git add .`). Never weaken or delete a test, and never loosen a check: no narrowed arbitrary, no filter, no lower `numRuns`, no longer timeout in place of a condition, no skipped step. If a check fails, fix the cause or report the failure with its real output (for a property, the shrunk counterexample, seed and path).
  - Say only what is true. Anything that cannot be verified from the repo, the Kiro documentation or a real run is written as "not verified". Never write fake log lines or invented results.
  - _Requirements: 16.7, 23.1_

  - [x] 7.1 `check:browser` step 11 flake
    - Files: `scripts/check_browser.ts`, `scripts/checks/` (only the files the cause points to), `docs/BUILD_LOG.md`, and, only if the app has a race, the `src/ui` files holding it with a matching test under `tests/ui/`.
    - Run `npm run check:browser` 10 times in a row (build `dist/` first). Record every result, per step and per run, in a table in `docs/BUILD_LOG.md`, including the exact output of each failure.
    - Find the root cause among: a timing wait in the check, a race in the app (for example the Weave pick counter or the player after a failed Scan read, or after navigating from Scan back to Weave), or the check itself. Record the evidence for the cause.
    - If the app has a race: fix it and add a test that fails before the fix (run it against the unfixed code first and record that it failed). Where the race concerns pure state, add a fast-check property with a fixed seed and at least 100 runs.
    - If the check is at fault: replace the wait with a condition on observable state, not a longer timeout, and do not loosen what the step asserts.
    - After the fix, run `npm run check:browser` 10 more times and record every result in the same way. Report any failure that remains; do not hide it.
    - End with the common steps above. Commit.
    - _Requirements: 2.8, 9.1, 16.7, 23.1_

  - [x] 7.2 Hooks evidence
    - Files: `.kiro/hooks/*` (both hooks), `.gitignore`, `scripts/check_hooks.ts`, `scripts/checks/hooksLog.ts`, `package.json`, `tests/scripts/hooksLog.test.ts`, `docs/BUILD_LOG.md`.
    - Inspect `.kiro/hooks` and read both hooks, including their trigger types. Make each hook leave proof when it fires by appending one line (ISO timestamp, hook name, result) to a git-ignored log file, for example `.kiro/hooks/hooks.log` or `logs/hooks.log`. Use whatever the hook format supports: a command action that appends the line, or an instruction in the hook prompt that tells the agent to append it. Add the log path to `.gitignore` and verify with `git check-ignore -v <path>`; record the output. If the hook format cannot append a line, say so in `docs/BUILD_LOG.md` and use the closest supported mechanism.
    - Add `npm run check:hooks` (`scripts/check_hooks.ts`): print the last lines of the log and say, per hook, whether it has ever fired. A hook is reported as fired only if the log holds a line for it; with no log file or no line it prints "never fired (no log line)". Never create or edit log lines from the script.
    - Pure parsing parts (log line parsing, per-hook fired status, last-lines selection) are separate functions with injected input and unit tests. Property tests (fast-check, fixed seed, at least 100 runs): a formatted line parses back to the same timestamp, hook name and result; a hook is reported as fired exactly when a line with its name exists; malformed lines never cause a throw and never count as fired; the last-lines selection returns at most N lines in file order.
    - Document in `docs/BUILD_LOG.md` how to trigger each hook in the Kiro IDE and what should appear in the Agent Hooks panel. Read the trigger types from the hook files. If the panel location or label cannot be verified from the repo, state what is known and what is not.
    - Do not write fake log lines. Whether either hook has fired is recorded only from the real log.
    - End with the common steps above. Commit.
    - _Requirements: 16.7_

  - [x] 7.3 Manual prerelease steering and offline step
    - Files: `.kiro/steering/prerelease-check.md`, `scripts/check_browser.ts`, `scripts/checks/offline.ts` (or the file the existing `checks/` layout suggests), `package.json` (only if needed), `tests/scripts/offline.test.ts`, `docs/BUILD_LOG.md`.
    - Check whether `KIRO_PROMPTS.md` exists in the repo (search the whole tree). If it exists, take the pre-release checks from its prompt 39. If it does not exist, say so in `docs/BUILD_LOG.md` and in the steering file's notes and use the user's list below.
    - Verify the exact front matter syntax for manual inclusion from the existing files under `.kiro/steering` and from Kiro documentation (Context7 tool or web search if needed). Record the source. Write the file with `inclusion: manual` so it runs as a slash command in Kiro, and state in the log if the slash command itself was not verified in the IDE.
    - The steering file instructs the agent to run these checks and report each as pass or fail with the real output: tests pass; `.kiro` is not git-ignored; `LICENSE` exists; README run steps work from a clean clone (`git clone` to a temporary directory, `npm ci`, `npm run build`, with the real output reported); no API keys; the app loads with the network off; the build log is up to date (compare the date of the last `docs/BUILD_LOG.md` entry with the latest commit date and report both). It calls `npm run check:all` and `npm run check:browser` and reports their real output.
    - Offline check: if `check:browser` has no offline step, add one as a real step. After the first load of the built site, call `Network.emulateNetworkConditions` with `offline: true` and check that the app still works for Weave (a Try it sample plays to its last pick). The step must claim nothing it does not test. If the app does not work offline, report the failure and what fails; do not weaken the step. The pure parts (building the offline emulation parameters, the pass or fail decision from observed page state) get unit tests and a fast-check property with a fixed seed and at least 100 runs. The steering file may describe the offline check only once it exists.
    - End with the common steps above. Commit.
    - _Requirements: 13.1, 13.3, 16.7, 23.1_

  - [x] 7.4 Workspace custom agent `weave-reviewer` and a real review
    - Files: the agent file or the fallback steering file (see below), `docs/WEAVE_REVIEW.md`, `docs/BUILD_LOG.md`.
    - First establish from Kiro documentation (Context7 tool, web search or local docs) and from what this Kiro installation supports whether workspace custom agents exist, where they live (for example `.kiro/agents/*.json`) and their exact schema. Record the sources and the result in `docs/BUILD_LOG.md`. If this Kiro version does not support custom agents, say so plainly and use the fallback: `.kiro/steering/weave-reviewer.md` with manual inclusion.
    - Check whether `KIRO_PROMPTS.md` exists (prompt 38). If it exists, use prompt 38 for the agent's content. If not, say so and use this description: review a diff for (a) wrong use of weaving terms against `.kiro/steering/weaving-glossary.md`, (b) card layout values hard-coded instead of coming from a Card_Profile, (c) functions in `src/codec`, `src/exporter` or `src/simulator` without property tests.
    - Create the agent (or the fallback), then run the review on the current branch diff against the first commit of the app work. State the base commit used and how it was chosen. Run it by invoking the `semantic_reviewer` sub-agent if it fits, or execute the checklist by hand. Save the real report in `docs/WEAVE_REVIEW.md` and state truthfully how it was run (the custom agent itself, the sub-agent, or the checklist done by hand).
    - Record in `docs/BUILD_LOG.md` what the review found, with counts and file names, without softening any finding.
    - Do not fix findings in this task; list them.
    - End with the common steps above. Commit.
    - _Requirements: 16.7, 17.1_

  - [x] 7.5 Update `docs/KIRO_USAGE.md`, commit and push
    - Files: `docs/KIRO_USAGE.md`, the task status files under `.kiro/specs/app/`.
    - Update the document for: the hooks evidence (only what `.kiro/hooks` log and `npm run check:hooks` show), the steering command (`prerelease-check`), the custom agent or the fallback, and the flake investigation (cause, fix, before and after results). Say only what is true and mark anything unverified. Do not describe a Kiro feature without evidence.
    - Run `npm run test:run`, `npm run typecheck`, `npm run build` and `npm run check-bundle`. Commit the specific paths changed, including the task status files. Run `git remote -v`, then `git push`; the user has authorised this push. Never force push.
    - _Requirements: 16.7_

## Notes

- **Phases.** Exactly four, in order: (1) Weave, Try it, printable card and deployment; (2) Keep and archive; (3) Scan; (4) CUT-LAST, trimmed. Each ends with a push task (1.14, 2.8, 3.8, 4.6). Task 5.1 follows Phase 4 and commits and pushes itself. Task 3.9 was added after 3.8 and does not push; its commit goes out with the push in 4.6. Tasks in the same wave touch different files and may run in parallel.
- **Where properties live.** Phase 1: 1, 2, 3, 4, 5, 6 (sim, profile, print failures), 7, 8, 9, 10, 11, 12, 13 (Sample_Design half), 14 (print half), 28, 29, 30, 31, 32, 34, 35, 36, 37, 38. Phase 2: 6 (export, BMP read, archive failures), 13 (runExport half), 14 (export half), 15, 16, 17, 18, 19, 20, 21, 39. Phase 3: 6 (read failures), 22, 23, 24, 25, 26, 27. Phase 4: 33, and a new property for the rise-from-darkness effect level in task 4.2 (it has no number in `design.md`; `design.md` is unchanged). Property 6 is split across phases because each failure-to-key function ships with the module it serves; it is complete after task 3.2.
- **Never cuttable.** Round-trip: 13, 15, 24, 36, 37, 38. Failure-path: 2, 6, 7, 14, 18, 20, 23, 34. Also not cuttable: 1, 3, 5, 8, 9, 10, 11, 12, 17, 22, 26, 27, 28, 39.
- **Cuttable property.** 4, 16, 19, 21, 25, 29, 30, 31, 32, 33, 35. R17.1 asks for a property on each pure function, so cutting one is reported to the user with the function it leaves without a property.
- **Demo-essential.** Tasks 1.1 to 1.8, 1.12 to 1.14 and 2.1 to 2.8. Tasks 3.9 and 5.1 are not demo-essential. Printing (1.9 to 1.11) and Scan (Phase 3) follow the guaranteed demo.
- **Manual checks.** Real IndexedDB in a browser (2.2), on-device timings (1.8, 1.10, 3.5), printing at 100% scale (1.13), the README media (3.6). These need the user.
- **Not verified by any task.** Real card dimensions (the demo profile is illustrative and unverified), any loom controller, and the Hindi wording. These are stated in the README and in `docs/HINDI_REVIEW.md`.
- **Phase 4 scope.** Built: live camera (R18), rise from darkness with skip control (R20.2, 20.4, 20.6). Conditional: self-hosted fonts (4.3), built only if the app loads web fonts, otherwise recorded as not needed. Not built: Hindi voice prompts (R19) and the Night loom theme (R20.5), DROPPED BY CHOICE of the user and recorded in task 4.4; hole pop (R20.1) and thread-drawn progress (R20.3) are also left out. `requirements.md` and `design.md` are unchanged, so those requirements stay in them as not implemented.
- **Phase 6.** Added after task 5.1, so the order is 1 to 5, then 6. Tasks 6.1 to 6.7 run one after another, each in its own wave, because they share `package.json`, `README.md` and `docs/BUILD_LOG.md`. Each ends with `npm run test:run`, `npm run typecheck`, `npm run build`, `npm run check-bundle` and a commit of specific paths. No test is weakened or deleted. The property tests of the pure parts are written in the same task as the code; none is cuttable. 6.2 reports the spec format validators as SKIPPED if the repo has no command for them. 6.3 uses no new dependency unless `docs/BUILD_LOG.md` justifies one first. The real runs, which need Chrome and a built `dist/`, happen in 6.7; `check:manual` needs the user and a phone and is run by the user. 6.7 pushes (authorised, never forced).
- **Phase 7.** Added after task 6.7, so the order is 1 to 6, then 7. Tasks 7.1 to 7.5 run one after another, each in its own wave, because they share `package.json`, `scripts/check_browser.ts` and `docs/BUILD_LOG.md`. Each ends with `npm run test:run`, `npm run typecheck`, `npm run build`, `npm run check-bundle` and a commit of specific paths. No test is weakened or deleted and no check is loosened. 7.1 replaces a wait with a condition and never with a longer timeout. 7.2 never writes fake log lines. 7.3 and 7.4 first check whether `KIRO_PROMPTS.md` exists and say so if it does not. 7.4 states how the review was run and does not fix findings. 7.5 pushes (authorised, never forced).
- **Pushes.** The phase-end tasks (1.14, 2.8, 3.8, 4.6) and task 5.1 push; the user authorised the pushes in 4.6 and 5.1. None adds a remote without asking the user.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.6", "1.9"] },
    { "id": 2, "tasks": ["1.5", "1.7", "1.10"] },
    { "id": 3, "tasks": ["1.8"] },
    { "id": 4, "tasks": ["1.11"] },
    { "id": 5, "tasks": ["1.12"] },
    { "id": 6, "tasks": ["1.13"] },
    { "id": 7, "tasks": ["1.14"] },
    { "id": 8, "tasks": ["2.1", "2.3", "2.4"] },
    { "id": 9, "tasks": ["2.2", "2.5"] },
    { "id": 10, "tasks": ["2.6"] },
    { "id": 11, "tasks": ["2.7"] },
    { "id": 12, "tasks": ["2.8"] },
    { "id": 13, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 14, "tasks": ["3.4"] },
    { "id": 15, "tasks": ["3.5"] },
    { "id": 16, "tasks": ["3.6"] },
    { "id": 17, "tasks": ["3.7"] },
    { "id": 18, "tasks": ["3.8"] },
    { "id": 19, "tasks": ["3.9"] },
    { "id": 20, "tasks": ["4.1", "4.3"] },
    { "id": 21, "tasks": ["4.2"] },
    { "id": 22, "tasks": ["4.4"] },
    { "id": 23, "tasks": ["4.5"] },
    { "id": 24, "tasks": ["4.6"] },
    { "id": 25, "tasks": ["5.1"] },
    { "id": 26, "tasks": ["6.1"] },
    { "id": 27, "tasks": ["6.2"] },
    { "id": 28, "tasks": ["6.3"] },
    { "id": 29, "tasks": ["6.4"] },
    { "id": 30, "tasks": ["6.5"] },
    { "id": 31, "tasks": ["6.6"] },
    { "id": 32, "tasks": ["6.7"] },
    { "id": 33, "tasks": ["7.1"] },
    { "id": 34, "tasks": ["7.2"] },
    { "id": 35, "tasks": ["7.3"] },
    { "id": 36, "tasks": ["7.4"] },
    { "id": 37, "tasks": ["7.5"] }
  ]
}
```
