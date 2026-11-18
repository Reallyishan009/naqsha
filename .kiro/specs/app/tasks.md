# Implementation Plan

## Overview

The plan has exactly four phases, in this order. Each phase ends with a push task.

1. **Phase 1: Weave, Try it, printable sample card, deployment.** App foundations, shell, Weave screen with Try it, the printable sample card inside Try it (Requirement 21), the deploy configuration (Requirement 23: `base: './'`, `vercel.json`, README Vercel steps) and a build-log entry.
2. **Phase 2: Keep and the archive.** Archive module, BMP export, save and list, and the Card_Profile notice on Keep (Requirement 22).
3. **Phase 3: Scan.** Photo read, tap-to-correct, Scan_Batch, the Card_Profile notice on Scan (Requirement 22), and the README media (Requirement 23).
4. **Phase 4: CUT-LAST.** Live camera (Requirement 18), Hindi voice prompts (Requirement 19), animation extras and Night loom theme (Requirement 20), self-hosted fonts.

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

- [ ] 1. Phase 1: Weave, Try it, printable sample card and deployment
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

  - [-] 1.14 Phase 1 push
    - **Demo-essential.**
    - Run `npm run test:run`, `npm run typecheck` and `npm run build`, then `git push`. Run `git remote -v` first; if no remote is configured, ask the user before pushing and do not add one yourself.
    - _Requirements: 16.7_

- [ ] 2. Phase 2: Keep and the archive
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 22.1, 22.2, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10, 22.11, 22.12, 22.13_

  - [ ] 2.1 Archive types and functions over a store
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

  - [ ] 2.2 IndexedDB store
    - **Demo-essential.**
    - Files: `src/archive/idbStore.ts`, `src/archive/index.ts`, `tests/archive/structure.test.ts`.
    - `openIndexedDbStore()` for database `naqsha-archive` version 1 with stores `designs` and `summaries` (index `createdAt`), `put` and `remove` in one `readwrite` transaction over both. An unavailable `indexedDB` rejects with a value that `designs.ts` maps to `storage-unavailable`. Default deps use `Date.now` and `crypto.randomUUID`.
    - Source-scan test: only `idbStore.ts` mentions `indexedDB`, no file in `src/archive` mentions `localStorage`, and imports from `src/codec` are type-only through `index.ts`.
    - The real IndexedDB cannot run in Node here. State this in the log (task 2.7) and add a manual check item: save, refresh, list, reopen.
    - _Requirements: 6.8, 6.9, 6.11_

  - [ ] 2.3 Card_Profile notice
    - **Demo-essential.**
    - Files: `src/ui/profile/notice.ts`, `src/ui/ProfileNotice.tsx`, `src/ui/ProfileNotice.module.css`, `src/ui/i18n/en.json`, `src/ui/i18n/hi.json`, `tests/ui/profile/notice.test.ts`, `tests/ui/screens/profileNotice.test.tsx`.
    - `profileNotice(profile)` returns a notice exactly when `status` contains `UNVERIFIED`, with the status text unchanged. `ProfileNotice` shows the profile `name` always, and the translated sentence plus the status text beside an icon or word when the notice exists. It is not announced through the live region. Reused by the Scan screen in Phase 3.
    - **Property 39**: the notice shows exactly for an unverified profile (any status text, `undefined`, lower-case "unverified", "UNVERIFIED" inside other words), and `statusText` equals the status. Not cuttable (R22.13 requires it).
    - Examples: the demo profile gives a notice with the status text unchanged; switching language changes the sentence and keeps the status text.
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.8, 22.9, 22.10, 22.11, 22.13_

  - [ ] 2.4 Reducer actions for saved designs
    - **Demo-essential.**
    - Files: `src/ui/state/appState.ts`, `tests/ui/state/appState.test.ts`.
    - Add `open-saved` (replaces the Current_Pattern with origin `archive`, shows Weave) and `mark-saved` (sets `saved: true` on a scanned origin). Extend the Property 1 test to include these actions.
    - _Requirements: 7.7_

  - [ ] 2.5 Keep logic and export, archive failure messages
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

  - [ ] 2.6 Keep screen components
    - **Demo-essential.**
    - Files: `src/ui/screens/keep/KeepScreen.tsx`, `KeepScreen.module.css`, `src/ui/App.tsx`, `tests/ui/screens/keep.test.tsx`.
    - Export options (bit depth, lift colour, pick order, end order, one line each), the loom-purpose export button, the "no loom controller has been tested" sentence, the six optional fields, save, the record-not-legal-protection sentence, the saved list with open and confirmed delete, the empty-list text, the Card_Profile name and the Unverified_Profile notice next to the export control and next to the save control (shown before use, never blocking), and a differing profile name on list entries. Mount the screen in `App`.
    - Render examples: markup in a name appears escaped; the notice is shown for the demo profile and absent for a profile without status; both notice places exist; an empty pattern disables export with the Try it or Scan hint; a failed save keeps the form.
    - _Requirements: 5.1, 5.2, 5.4, 5.6, 5.9, 7.1, 7.5, 7.8, 7.9, 7.10, 22.1, 22.2, 22.4, 22.6, 22.7, 22.10, 22.12_

  - [ ] 2.7 Phase 2 build-log entry
    - **Demo-essential.**
    - Files: `docs/BUILD_LOG.md`, `docs/HINDI_REVIEW.md`, `.kiro/steering/structure.md`.
    - Update the `src/archive` and `src/ui` entries in `structure.md` to the real exports (`saveDesign`, `getDesign`, `listDesigns`, `deleteDesign`; `App`). Add a log entry with the manual IndexedDB check (save, refresh, list, reopen) and its result or "not yet run". Regenerate `docs/HINDI_REVIEW.md`.
    - _Requirements: 6.1, 12.12_

  - [ ] 2.8 Phase 2 push
    - **Demo-essential.**
    - Run `npm run test:run`, `npm run typecheck` and `npm run build`, then `git push`. Run `git remote -v` first; if no remote is configured, ask the user before pushing.
    - _Requirements: 16.7_

- [ ] 3. Phase 3: Scan with tap-to-correct and batch
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 16.10, 17.1, 17.3, 17.5, 17.6, 22.1, 22.3, 22.5, 22.10, 22.11, 23.9, 23.11, 23.12, 23.13_

  - [ ] 3.1 Scan_Batch operations and reducer actions
    - Files: `src/ui/state/batch.ts`, `src/ui/state/appState.ts`, `tests/ui/state/batch.test.ts`, `tests/ui/state/appState.test.ts`.
    - `appendCard`, `removeCard`, `moveCard`, `replaceCard`, `commitBatch`, and the reducer actions `batch-accept`, `batch-remove`, `batch-move`, `batch-replace`, `batch-commit`, `read-failed`. Extend the Property 1 test to the new actions.
    - **Property 23**: a `read-failed` action leaves the batch unchanged and announces the failure. Failure-path property, never cuttable.
    - **Property 26**: batch operations keep their invariants, and any out-of-range index returns the batch unchanged.
    - **Property 27**: Done keeps the order of the Scan_Batch (replace and append).
    - Example tests: the replace or append confirmation, and an unaccepted read does not alter the batch.
    - _Requirements: 9.1, 11.1, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_

  - [ ] 3.2 Read failure messages
    - Files: `src/ui/i18n/messages.ts`, `src/ui/i18n/en.json`, `src/ui/i18n/hi.json`, `tests/ui/i18n/failureKeys.test.ts`.
    - `readFailureKey` as an exhaustive switch over the six `ReadFailure` kinds (`invalid-profile`, `invalid-image`, `peg-holes-not-found`, `ambiguous-orientation`, `resolution-too-low`, `card-outside-image`), importing the reader's type under the alias `CardReadFailure`. Add the Scan keys, with the plain-language texts that R9.2 to R9.7 describe, in Hindi and English.
    - **Property 6 (read failure type)**: every kind has a key in both files that is not the raw kind string. Failure-path property, never cuttable.
    - Example tests: the text for `peg-holes-not-found`, `ambiguous-orientation`, `resolution-too-low`, `card-outside-image` and `invalid-image` states the cause and the next step in both languages.
    - _Requirements: 8.6, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9_

  - [ ] 3.3 Correction and marker logic
    - Files: `src/ui/state/corrections.ts`, `tests/ui/state/corrections.test.ts`.
    - `toggleHook`, `undoCorrection`, `hookMarkers` (uses `cardToImage` from `src/reader` and `hookCentreMm` from `src/ui/printable/layout.ts`), `hitSizePx`, `minimumZoom`.
    - **Property 22**: markers sit on the hook positions, with `filled` for a punched hole and `ring` otherwise.
    - **Property 24**: toggling a hook twice restores the grid, one toggle changes exactly one cell, the result passes `validateCardGrid`, and undoing every correction returns the read grid. Round-trip property, never cuttable.
    - **Property 25** (Cuttable property): hit areas reach 48 CSS pixels at or above `minimumZoom`.
    - Example: a position outside the grid returns the grid unchanged.
    - _Requirements: 8.3, 8.4, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [ ] 3.4 Scan screen components
    - Files: `src/ui/screens/scan/ScanScreen.tsx`, `CardOverlay.tsx`, `BatchList.tsx`, `ScanScreen.module.css`, `src/ui/App.tsx`, `tests/ui/screens/scan.test.tsx`, `tests/integration/scanFixtures.test.ts`.
    - Lazy-load `ScanScreen` with `React.lazy` and `Suspense`. File input, busy state, a request counter so a late result never replaces a newer one, overlay with filled and ring markers and a text legend, enlarged hit areas and zoom, keyboard-operable markers, corrected badge, undo, accept, batch list (numbered thumbnails, confirmed remove, earlier, later, scan again), Done with the replace or append question, one message per `CardReadFailure` kind, violation locations for `invalid-profile`, the Card_Profile name and the Unverified_Profile notice (reusing `ProfileNotice` from task 2.3), no network request.
    - Integration test with the fixtures in `tests/fixtures/` and their ground-truth JSON, for all four conditions (clean, noisy, tilted, noisy and tilted): `readCard` on the fixture pixels equals the ground-truth grid and the overlay markers match it. A failure example for each of the six read failure kinds through the message mapping.
    - Render examples: each marker is a button with an accessible name; Done is disabled for an empty batch; the notice and profile name are shown.
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.9, 10.1, 10.2, 10.3, 10.4, 10.5, 10.8, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.10, 16.10, 17.5, 17.6, 22.1, 22.3, 22.5, 22.10, 22.11_

  - [ ] 3.5 Scan chunk check and timing
    - Files: `scripts/check_bundle.ts`, `docs/BUILD_LOG.md`.
    - Extend `check_bundle` so a Scan-only marker string must be absent from the entry chunk and present in a separate chunk. Run it and record the sizes. Time `readCard` on a 1080p synthetic image in Node and record it (the on-device number is a manual check).
    - _Requirements: 8.8, 16.1, 16.10_

  - [ ] 3.6 README media (manual capture)
    - Files: `media/banner.png`, `media/weave-sample.gif`, `media/scan-printed-card.gif`, `media/keep-export.gif`, `README.md`.
    - This task needs the user if it cannot be done headlessly. Run `npm run build` and `npm run preview`, then capture one banner and three GIFs from the Built_Site in a real browser with the demo profile: Weave playback of a Sample_Design; scanning the printed card with a tap correction; the BMP export. The Scan and Keep GIFs must show the Card_Profile notice. Each file at most 5 MB (check with `ls -l`). Confirm the public URL with the user and put it in the README. The README already references these files (task 1.12); check that every reference resolves and has alternative text.
    - If capture is not possible in this session, say so, leave the README references in place, and list the missing files in the build log; this does not block the Phase 3 push.
    - _Requirements: 23.5, 23.9, 23.10, 23.11, 23.12, 23.13_

  - [ ] 3.7 Phase 3 build-log entry and final check
    - Files: `docs/BUILD_LOG.md`, `docs/HINDI_REVIEW.md`.
    - Run `npm run test:run`, `npm run typecheck`, `npm run build` and `check_bundle`. Confirm every requirement ID from 1 to 17 and 21 to 23 appears in a test title (18 to 20 are Phase 4). Regenerate `docs/HINDI_REVIEW.md` and tell the user how many strings need a native Hindi speaker. List what was not verified: real IndexedDB in a browser, on-device timings, any loom controller, the Hindi text, real card dimensions.
    - _Requirements: 12.9, 12.12, 16.7, 17.1, 17.3_

  - [ ] 3.8 Phase 3 push
    - Run `npm run test:run`, `npm run typecheck` and `npm run build`, then `git push`. Run `git remote -v` first; if no remote is configured, ask the user before pushing.
    - _Requirements: 16.7_

- [ ] 4. Phase 4: CUT-LAST features
  - These are the first items to drop. Dropping one is reported to the user.
  - _Requirements: 13.5, 13.6, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 19.1, 19.2, 19.3, 19.4, 19.5, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [ ] 4.1 Live camera scan
    - Files: `src/ui/screens/scan/LiveCamera.tsx`, `src/ui/screens/scan/ScanScreen.tsx`, `src/ui/platform/browser.ts`, `tests/ui/platform/browser.test.ts`, `tests/ui/screens/liveCamera.test.ts`.
    - `cameraControl(env)` decision, `getUserMedia` stream with a card-shaped guide frame, capture of one frame through the existing `loadPixelData` and `readCard` path, a refused or missing camera message with photo upload kept, track stop on leave, and the secure-page note.
    - **Property 33** (Cuttable property): the camera control follows the secure-page rule.
    - Example with `FakeCamera` that counts stopped tracks after leaving the screen, and a refused-permission example that leaves photo upload usable (failure path).
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7_

  - [ ] 4.2 Hindi voice prompts
    - Files: `src/ui/screens/scan/SpeakButton.tsx`, `src/ui/screens/scan/ScanScreen.tsx`, `src/ui/platform/browser.ts`, `tests/ui/screens/speak.test.ts`.
    - Speak control shown only when a Hindi voice exists, speaks the `hi` text on activation only, never automatically, uses installed voices only. Examples with `FakeSpeech`.
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_

  - [ ] 4.3 Animation extras and Night loom theme
    - Files: `src/ui/screens/scan/CardOverlay.module.css`, `src/ui/screens/weave/WeaveScreen.module.css`, `src/ui/App.tsx`, `src/ui/theme/tokens.css`, `tests/ui/theme/theme.test.ts`.
    - Hole pop under 400 ms in total, rise-from-darkness once with a skip control, thread-drawn progress, all off under `prefers-reduced-motion` (reuses `autoplay`, Property 32). Theme switch with a 48 px target using the Night loom tokens; check the Night loom token pairs through the contrast function of Property 31. Re-run `check_bundle`.
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [ ] 4.4 Self-hosted fonts
    - Files: `public/fonts/`, `src/ui/theme/fonts.css`, `src/main.tsx`.
    - Add `woff2` subsets (Devanagari and Latin) for Rozha One, Hind and IBM Plex Mono only if their licences allow redistribution; reference them by relative `@font-face` URLs with `font-display: swap`. Check the licence of each first and record it in `docs/BUILD_LOG.md`. Re-run `check_bundle` and the no-third-party-host test.
    - _Requirements: 13.5, 13.6_

  - [ ] 4.5 Phase 4 build-log entry
    - Files: `docs/BUILD_LOG.md`, `docs/HINDI_REVIEW.md`.
    - Record which Phase 4 items were built and which were dropped. Re-run `npm run test:run`, `npm run typecheck`, `npm run build` and `check_bundle`, regenerate `docs/HINDI_REVIEW.md`, and update the "not verified" list.
    - _Requirements: 12.12, 16.7_

  - [ ] 4.6 Phase 4 push
    - Run `npm run test:run`, `npm run typecheck` and `npm run build`, then `git push`. Run `git remote -v` first; if no remote is configured, ask the user before pushing.
    - _Requirements: 16.7_

## Notes

- **Phases.** Exactly four, in order: (1) Weave, Try it, printable card and deployment; (2) Keep and archive; (3) Scan; (4) CUT-LAST. Each ends with a push task (1.14, 2.8, 3.8, 4.6). Tasks in the same wave touch different files and may run in parallel.
- **Where properties live.** Phase 1: 1, 2, 3, 4, 5, 6 (sim, profile, print failures), 7, 8, 9, 10, 11, 12, 13 (Sample_Design half), 14 (print half), 28, 29, 30, 31, 32, 34, 35, 36, 37, 38. Phase 2: 6 (export, BMP read, archive failures), 13 (runExport half), 14 (export half), 15, 16, 17, 18, 19, 20, 21, 39. Phase 3: 6 (read failures), 22, 23, 24, 25, 26, 27. Phase 4: 33. Property 6 is split across phases because each failure-to-key function ships with the module it serves; it is complete after task 3.2.
- **Never cuttable.** Round-trip: 13, 15, 24, 36, 37, 38. Failure-path: 2, 6, 7, 14, 18, 20, 23, 34. Also not cuttable: 1, 3, 5, 8, 9, 10, 11, 12, 17, 22, 26, 27, 28, 39.
- **Cuttable property.** 4, 16, 19, 21, 25, 29, 30, 31, 32, 33, 35. R17.1 asks for a property on each pure function, so cutting one is reported to the user with the function it leaves without a property.
- **Demo-essential.** Tasks 1.1 to 1.8, 1.12 to 1.14 and 2.1 to 2.8. Printing (1.9 to 1.11) and Scan (Phase 3) follow the guaranteed demo.
- **Manual checks.** Real IndexedDB in a browser (2.2), on-device timings (1.8, 1.10, 3.5), printing at 100% scale (1.13), the README media (3.6). These need the user.
- **Not verified by any task.** Real card dimensions (the demo profile is illustrative and unverified), any loom controller, and the Hindi wording. These are stated in the README and in `docs/HINDI_REVIEW.md`.
- **Pushes.** Only the phase-end tasks push, and none adds a remote without asking the user.

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
    { "id": 19, "tasks": ["4.1", "4.4"] },
    { "id": 20, "tasks": ["4.2", "4.3"] },
    { "id": 21, "tasks": ["4.5"] },
    { "id": 22, "tasks": ["4.6"] }
  ]
}
```
