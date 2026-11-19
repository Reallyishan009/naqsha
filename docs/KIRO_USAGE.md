# How Kiro was used on Naqsha

This file is written only from what is in the repository: `.kiro/`, `docs/BUILD_LOG.md`, `git log` and `tests/`. Where the repository has no evidence, it says "no evidence in the repository". Commit hashes are short hashes from `git log`.

## 8. Authorship (stated first so it is not missed)

Planning and prompt drafting were done with Claude (BUILD_LOG, entry 2026-11-13 to 2026-11-14: "Claude, for brainstorming, web research, and planning. No Kiro credits used"). Kiro wrote the specs and the code. BUILD_LOG records "No files edited by hand" in every entry from 2026-11-18 on. The author's part was review, approval and decisions (for example approving or rejecting a requirement change).

The planning files named in that entry (`PLAN.md`, `KIRO_PROMPTS.md`, `RESEARCH.md`, `WEAVER_INTERVIEW.md`, `CARD_MEASUREMENT.md`, `SUBMISSION_DRAFT.md`) are not in this repository. Only `docs/DESIGN_BRIEF.md`, `docs/BUILD_LOG.md` and `docs/HINDI_REVIEW.md` are. The prompt numbers from `KIRO_PROMPTS.md` were not recorded during sessions.

## 1. Specs

Four specs exist in `.kiro/specs/`. Each has `requirements.md`, `design.md` and `tasks.md`. Each also has a `tasks.meta.json` (execution records written by Kiro; only the `app` one is tracked in git).

| Spec | Requirements | Design properties | Extra files |
|---|---|---|---|
| `card-codec-and-reader` | 19 | 87 | `measurements.md`, `parked-5.14-readCard-tests.patch` |
| `simulator` | 14 | 26 | `measurements.md` |
| `exporter` | 12 | 19 | none |
| `app` | 23 | 39 | `.config.kiro` (workflow type `requirements-first`, spec type `feature`) |

Counts come from counting `### Requirement` and `### Property` headings today. BUILD_LOG reports earlier counts (83 and 24 properties for the first two) because the specs grew; the growth is recorded below (R2.10, R2.11 and others).

**Example: one requirement traced to a design property, a task and a test.**

- Requirement: `card-codec-and-reader/requirements.md`, Requirement 9, criterion 3: "THE reader SHALL NOT mistake punched holes or lacing holes for peg holes."
- Design property: `card-codec-and-reader/design.md`, "Property 55: R9.3 punched holes and lacing holes are not mistaken for peg holes", with "Validates: Requirements 9.3" and the test file named as `tests/reader/pegHoles.test.ts`.
- Task: `card-codec-and-reader/tasks.md`, task 5.11 adds Properties 54 and 55 as "not cuttable because they check decoy rejection". Task 5.16 later says "retarget Property 55" to `selectPegHolePair`.
- Test: `tests/reader/pegHoles.test.ts`, the block commented "Property 55" (around line 180), and `tests/reader/layout.test.ts` titles beginning "R9.3".

This chain is also the decoy peg pair bug in section 5.

**Example of a spec changing during the build.** `card-codec-and-reader/requirements.md` gained criterion R2.10 (profile `name` must be a string, commit `f6b7e75`) and R2.11 (overlapping holes rejected, commit `d8f047f`). Both were added by the user's decision after a test or generator exposed a gap. See section 5.

## 2. Steering docs

Six files in `.kiro/steering/`. Five are always loaded; `card-geometry.md` has front matter `inclusion: fileMatch` with `fileMatchPattern: "src/{codec,reader}/**"`.

| File | What it constrains |
|---|---|
| `product.md` | What Naqsha is, the three user personas, the four journeys, the non-goals (no server, no accounts, no dobby looms) and the success criteria. |
| `tech.md` | Stack (Vite, React, strict TypeScript, Vitest, fast-check, Canvas 2D, IndexedDB), no heavy image libraries, CSS Modules only, `.ts` import extensions in `src/codec`, performance budgets (200 KB gzipped JS, 300 ms for hole detection on 1080p, 16 ms per simulation frame). |
| `structure.md` | Directory layout, what each `src/` module may import, file naming, and the key exports of each module. Kiro updated it as modules were added (BUILD_LOG: exporter phase 1, simulator phase 4, app phase 2). |
| `weaving-glossary.md` | Domain terms to use in identifiers and comments (`pick`, `end`, `hook`, `punched hole`, `float`, `zari` and so on). |
| `card-geometry.md` | One card is one pick; a punched hole lifts the hook; the card layout is a runtime profile and never hard-coded in `src/codec` or `src/reader`. Its layout table is marked ILLUSTRATIVE, UNVERIFIED. |
| `testing.md` | Every pure function in four modules needs a fast-check property; properties are named after the requirement they check; fixtures use fixed seeds; and "Never weaken a property silently". |

**Which one helped most: this is a judgement.** BUILD_LOG never says "steering rule X caused Y", so the repository cannot prove a ranking. The closest evidence points to `testing.md`:

- Its rule "Never weaken a property silently" matches how the log reports every weakened test. Each of these is flagged for the user's confirmation: Property 46 (`36e1e28`), Property 6 of the simulator (`9e3f6b5`), Property 18 of the archive, Property 11 (R2.8) and the edited counterexamples in `tests/reader/resolution.test.ts` (`d8f047f`), and the narrowed `tests/ui/structure.test.ts` assertion (`a4e2617`).
- Its rule that property names start with a requirement ID is enforced by a structure test (`92205db`, "Add property naming and coverage structure test"), and the task 3.9 coverage check relied on those IDs to find 55 untested criteria.

`card-geometry.md` is the second candidate: its "no hard-coded dimensions" rule is why the fixtures, tests and `scripts/time_read_card.ts` all take a profile. The log gives no case where it caught a mistake.

## 3. Hooks

Two hook files in `.kiro/hooks/`, each with a script in `.kiro/hooks/bin/`. Both were created in the housekeeping step of 2026-11-18 (`f81656c`, `300cf0a`).

| File | Trigger | Matcher | Action | Timeout |
|---|---|---|---|---|
| `test-on-save.json` ("Related tests and typecheck on save") | `PostFileSave` | `src` or `scripts` `.ts` or `.tsx` files | command: `node .kiro/hooks/bin/related-tests.mjs` (runs the Vitest files related to the saved file, then `tsc --noEmit`) | 10 s |
| `fixtures-on-profile-change.json` ("Regenerate fixtures on profile or generator change") | `PostFileSave` | `public/profiles/*.json` or `scripts/make_fixtures.ts` | command: `sh .kiro/hooks/bin/check-fixtures.sh` (regenerates `tests/fixtures/`, exits 1 if any PNG byte changed) | 60 s |

**Did they fire? No evidence it fired, for either hook.** BUILD_LOG 2026-11-18 says "shell-command hooks (created, not yet seen firing in the IDE)", and `README.md` says "Created, not yet seen firing in the IDE". The 2026-11-20 entry lists "hooks" under features used for app Phase 1 but records no hook output. No later entry or commit message mentions a hook result. `related-tests.mjs` also states that the field holding the saved file path in the hook's stdin is undocumented, so it falls back to `git status`; that code path was written without having seen a real event.

A related fact: after the R2.11 change the log records that `npm run fixtures` regenerated `tests/fixtures` byte-identically. That is a manual run of the same generator, not a hook firing.

## 4. MCP

`.kiro/settings/mcp.json` configures one server, `context7` (`npx -y @upstash/context7-mcp`, key read from `CONTEXT7_API_KEY`, `autoApprove` for `resolve-library-id` and `query-docs`). Added in `a3dee72`.

**Use:** BUILD_LOG 2026-11-18 says "MCP (Context7, queried once to check browser API use)". That is the only record of use. The query text, the library, and what the answer changed are not recorded, and no commit message mentions Context7. `README.md` lists the server as "Configured". So: one use is recorded in the log, with no detail, and nothing else is known. Later entries (simulator, exporter, app) do not list MCP among features used.

## 5. Property-based tests: bugs and changes they led to

Each item has its source. "Log" means `docs/BUILD_LOG.md`. All properties use fast-check.

**1. Decoy peg pair (reader).** While measuring the R18.8 scale, `readCard` returned wrong grids at 2.75, 2.25 and 1.25 px/mm (67 to 71 of 192 hook positions wrong) because two punched holes of equal size can out-score the real peg holes. Fix: task 5.16, commit `75b5498` (layout check and best-explanation pair selection). Follow-ups in the same task: a decoy could still pass on sparse cards with no lacing holes, and the lacing-hole rule rejected cropped cards. Related: `92a1eb1` adds the `resolution-too-low` failure and an 11 px floor (task 5.17), because at about 1 px/mm a tiny punched hole vanished and the read returned a wrong grid. Sweeps of sparse cards, up to 3,000 cases per bin, found wrong grids up to the 9 to 10 px bin. The log calls the floor "a safety floor, not a fix for the cause". Source: Log 2026-11-18. The spec records it in `tasks.md` tasks 5.16 and 5.17 and in `measurements.md`.

Where the repository is less clear: the log says the bug was found "while measuring the R18.8 scale". It was not a failing property that exposed it first. Properties 54 and 55 (task 5.11) were written to check decoy rejection, but the log does not say they failed.

**2. Overlapping holes (R2.11).** Printable card Properties 37 and 38 (`tests/ui/printable/raster.test.ts`) failed with seeds 3701 and 3801. The shrunk counterexample had two lacing holes about 0.87 mm apart with a 1.5 mm hole diameter, which `validateCardProfile` accepted, so the printed discs overlapped. The user chose to change the requirement, not the property. Fix: new criterion R2.11 and violation kind `holes-overlap`, commit `d8f047f`; `e86b7ef` fixed a floating-point rounding error in the overlap test construction. New Properties 85, 86, 87 (87 compares the bounded check with a brute-force all-pairs check). fast-check paths are in the log's 2026-11-20 requirement-change entry. Source: Log 2026-11-20.

Side effects the log says needed the user's confirmation: Property 11 (R2.8) now moves both peg holes off the card, so it covers less than before; two saved counterexample profiles in `tests/reader/resolution.test.ts` had their lacing hole x values moved; `tests/support/profiles.ts` now keeps a 0.5 hole diameter gap. The log (task 3.7 entry) records that the user accepted these.

**3. Property 46 change (codec and reader).** The design asked that a disc's measured diameter be within 5% for discs of 6 to 40 px. Counterexample `[6, 0, 0]`: a 6 px disc on a pixel corner measures 6.38 px (6.4% off). This is pixel quantisation, not a code bug. The user approved changing the property to "within 1 px always, within 5% from 12 px"; `[6,0,0]` stays as a regression example. Commit `36e1e28` (`design.md` Property 46 text changed in the same commit). Source: Log 2026-11-18. Property 80 failed the same day on a dark-pixel count (6.3% off) from generator anti-aliasing and now uses a coverage-weighted area with the same 5% tolerance (commit `d72c412`).

**4. Property 5 changes (simulator).** The same number exists in all four specs. This is the simulator's Property 5 ("R2.3 a crossing shows the warp on the face exactly when its end is lifted"), changed twice:
- After the zari highlight was added (`7b146f8`), Property 5's crossing-centre sample landed on a highlight pixel for odd thread sizes. Counterexample: warp `#000000`, gold zari weft, t=3, 8x8 viewport, seed 20240611. The expected colour is now computed from the same highlight rule; arbitraries, `numRuns` and seed are unchanged. The log says the agent applied the fix before reporting, which the orchestrator had allowed in advance for this case. The log does not name the commit; the diff of `7b146f8` to `tests/simulator/render.test.ts` adds the highlight-aware expected colour in the R2.3 test, so I attribute the fix to it.
- After float highlighting was added, the expected colour includes the highlight blend (`9e3f6b5`, whose message says so, with Property 6 run with `floatHighlight` off by user decision).
- Property 5 also uses a filter that drops settings where a shaded warp colour equals a shaded weft colour (Log). That is a standing narrowing, disclosed in the log.

**5. Other bugs and changes the log records:**
- **Simulator Property 6** failed once float highlighting was on, because replacing a pick inside a float correctly changes neighbouring highlights. User decision: run it with highlighting off (`9e3f6b5`).
- **Simulator Property 23** failed: the zari highlight and gap hatch were drawn at absolute x positions, so rows did not tile unless the base width was a multiple of 4 and 6 (counterexample: 2x5 hooks, t=3, base width 30, gold zari). Design changed to measure from the start of each repeat (`a4534b9`, "approved design change").
- **Simulator Property 22** failed: `renderFrame` threw a TypeError on `[[],[],[]]`. Fixed in `d1ad64f` (the commit message says "bug found by Property 22").
- **Simulator Property 1 generator** used `name: 42` as an invalid profile, but `parseCardProfile` only checked that `name` existed. This exposed a codec gap: new violation kind `not-a-string`, criterion R2.10, Property 84 (`f6b7e75`).
- **Simulator R10.2** (frame time) was missed by the benchmark: with float highlighting on the median was about 16 ms and the worst up to 24 ms at 1920 x 1080. Not a property failure; found by the benchmark test (task 4.4). The user approved a requirement change (`271caf6`) and run-length highlighting was added (`195d5ec`), giving about 10.6 ms. Source: Log 2026-11-18 (simulator phase 4).
- **Property 69** (noise images) was split because 8 of 3,000 noise images failed at a later step than expected (Log, 2026-11-18). Task 5.14 was parked (section 7).
- **Unfilled-placeholder announce bug (app).** How it was actually found: not by a property. During README media capture (task 3.6) the live message after "Accept this card" read "Card {number} added." The 3.6 log entry records it as "Seen while capturing (not changed)". It was then fixed in `59956cb` with a new regression test `tests/ui/screens/announce.test.tsx`, and the GIF was re-recorded in `5d55064`. The task 3.7 entry says: "The 3.6 entry says 'not changed'; it was fixed afterwards." The regression test includes a fast-check property (`fc.assert` in the R14.10 test: no unfilled `{placeholder}` in any announced message with placeholders, in either language) plus two examples. The log does not record the failing counterexample, because the bug was seen during capture, not found by a failing property run.
- **CardThumb R15.6 defect (app).** Found by the requirement-ID coverage task 3.9, not by a property from the design: the task wrote a failing test for R15.6 and stopped. `CardThumb` drew only a rectangle and one disc per punched hook, with no Card_Profile input. Fixed in `f352bf3`, with `tests/ui/screens/cardDrawing.test.tsx` (an example and a property). The same commit raised Property 38's `numRuns` from 20 to 100. Source: Log 2026-11-21 (task 3.9 and 4.5).
- **Archive Property 18** (test bug, mine): see section 7.

## 6. Vibe sessions

No evidence in the repository. BUILD_LOG lists vibe only as an option in its entry template, and no entry names a vibe session. Every recorded session was run from a spec or an ad hoc request described in the log.

## 7. What did not work

All from `docs/BUILD_LOG.md` unless a hash is given.

- **Task 5.14 parked.** Four image properties (67, 68, 70, 77) failed on small or sparse cards because the layout check rejects good reads. These were safe failures (no wrong grids). They are saved as `.kiro/specs/card-codec-and-reader/parked-5.14-readCard-tests.patch` and folded into defect task 5.18, which the log says is still open. Commits `36b3f51`, `3963367`.
- **Property 18 of the archive, my test bug.** `tests/archive/designs.test.ts` first expected only `storage-unavailable` or `write-failed`, but a `get` or `delete` of an unknown id on an empty store correctly returns `not-found`. The fix lets `not-found` through for those two calls on an empty store. The original failing counterexample could not be recovered, so the log describes the cause from the final test text. The log says this loosens the property and needs the user's confirmation. The test is in `9486b0c`; no separate fix commit exists in git history.
- **Exporter size-limit test**: first used a layout too small to exceed 2 GB (arithmetic error in the test). It now checks `bmpLayout` only.
- **Exporter `download.ts` import test**: could not run in-process because Vitest itself needs `URL`; it runs in a child Node process.
- **The floral sample (and the other two samples).** The first diamond, border and floral designs looked stretched on square-thread cloth. Commit `de65145` retuned them. The log says "I did not record the shapes before the retune", and eyes-on judgement of the three shapes "is still the user's".
- **A timing that could not be reproduced.** 74.3 ms per frame during simulator task 2.4; repeated runs gave 5.5 to 6.7 ms. Cause unknown. Isolated worst frames of 29 ms and 147 ms were also not investigated.
- **`src/archive` stub files deleted** from the working tree during phase 3 of the first spec, cause unknown; restored from git.
- **Shell limitation:** the shell refused heredocs containing "npm run" text, so some files were written in pieces.
- **task_update tool failures:** no evidence in the repository. The build log does not record any.
- **Fixtures and real photos.** All reader tests and fixtures are generated images (`scripts/make_fixtures.ts`, seeded). No real photograph of a card has been read. `scripts/photo-trial/` is a dev-only printable card and `scripts/read-photo.html`; no result of a real-photo trial is recorded. The `ambiguous-orientation`, `resolution-too-low` and `card-outside-image` failures were checked only on synthetic images.
- **Hooks never seen firing** (section 3). **Context7 used once, with no detail** (section 4).
- **Dropped or left out:** Hindi voice prompts (R19) and the Night loom theme (R20.5) were dropped by the user; hole pop (R20.1) and thread-drawn progress (R20.3) were left out in the trim. The Night tokens exist but nothing switches to them.
- **Open accessibility gap:** after the rise-from-darkness skip control is used, it disappears and keyboard focus falls back to the page. Not fixed; the test setup has no DOM.
- **A requirement-ID mismatch:** four existing test titles carry IDs that do not match the criterion of that number (Log, task 3.9). Left unchanged.
- **README out of date** at the time of the task 3.9 and 4.5 entries; the later commit `1d24fbc` ("Update README status and quick start to match the built app") addresses it. I did not check the current README against the app.

**Unverified, per the log:** real IndexedDB in a browser (tests use a hand-written fake); the live camera on a real phone (fake camera only); printing at 100% scale; a camera photo of a printed card; any loom controller (no exported BMP has been tried); on-device timings (all numbers are from a laptop, Node v24.5.0, Apple M1); the real card dimensions (the demo profile is illustrative); all 178 Hindi strings (`reviewed: false`); the rise-from-darkness look and reduced-motion behaviour; that the README GIFs play on GitHub.

## Checks run for this file

`npm run test:run` (77 files, 589 tests, passing), `npm run typecheck`, `npm run build` and `npm run check-bundle` (entry chunk 93,124 bytes gzipped, limit 204,800) all passed before this file was committed.
