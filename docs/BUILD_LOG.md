# Naqsha: Build Log

A dated record of how Naqsha was built. Add an entry every working day. The Kiro usage writeup and the Devpost story are written from this file, so record what really happened, including failures.

## Entry format

```
## YYYY-MM-DD

**Goal today:**
**Prompts run in Kiro:** (numbers from KIRO_PROMPTS.md, and how you changed them)
**What Kiro produced:** (files, specs, tests)
**What failed or surprised me:**
**What I changed by hand:**
**Kiro features used:** (spec, steering, hook, MCP, property test, custom agent, vibe)
**Evidence saved:** (screenshot or clip file names in media/)
**Credits left:**
**Commit:** (short hash)
```

## Log

## 2026-11-13 to 2026-11-14

**Goal:** Choose a project and plan it.
**Tool:** Claude, for brainstorming, web research, and planning. No Kiro credits used. No project code written.
**What was produced:** PLAN.md, KIRO_PROMPTS.md, DESIGN_BRIEF.md, RESEARCH.md, WEAVER_INTERVIEW.md, CARD_MEASUREMENT.md, SUBMISSION_DRAFT.md, and this log.
**Decisions:**
- Rejected ideas: a geopolitics advisor, a paper-ledger reader, an AI code-review council, a weather-logbook reader, a building-code checker.
- Chosen: Naqsha, a camera reader for Jacquard loom punch cards, in the Resurrection category.
**Open items:** Talk to the weaver contact. Measure a real card. Confirm the Kiro credits arrived.

<!-- Add new entries below this line, newest last. -->

## 2026-11-18

**Goal today:** Set up the repo and steering, then build the card codec and the camera reader from a spec, tested against synthetic card images.

**Prompts run in Kiro:** Prompt numbers from KIRO_PROMPTS.md were not recorded during the session. In order, the requests were:
- steering docs (product, tech, structure), then the weaving glossary, card geometry and testing docs;
- git init and push to GitHub;
- a fixture generator for synthetic card images;
- a fix pass over four inconsistencies (one card is one pick, "punched hole" vs "peg hole", "naqshband", the property-test module list);
- the project scaffold;
- one combined spec, `card-codec-and-reader`, with requirements, design and tasks, each reviewed and edited before approval;
- running phases 1 to 3 to the checkpoint, the required phase 5 properties, phase 6, and the photo-trial setup;
- this housekeeping (hooks, MCP, this log, README skeleton).

**What Kiro produced:**
- Steering: `product.md`, `tech.md`, `structure.md`, `weaving-glossary.md`, `card-geometry.md` (loads only for `src/codec` and `src/reader`), `testing.md`.
- `scripts/make_fixtures.ts`: zero-dependency renderer for synthetic card PNGs with ground-truth JSON; six seeded fixtures in `tests/fixtures/`.
- Vite + React + TypeScript scaffold (strict), Vitest, fast-check, MIT `LICENSE`, `README.md`.
- Spec `.kiro/specs/card-codec-and-reader/`: 19 requirements in EARS form, a design with 83 numbered correctness properties, a task list, and `measurements.md`.
- `src/codec`: profile and card-grid validation, encode/decode through the profile's `endOrder`.
- `src/reader`: greyscale, Otsu threshold, dark regions, peg hole pair search, layout check, orientation from peg diameters, pose, sampling, `readCard` with six failure reasons, and a Canvas 2D image loader.
- Tests: 21 files, 162 tests passing at the end of the day, including structure tests (module boundaries, no `any`, property names start with a requirement ID) and a 1920 x 1080 benchmark (median 27.5 ms in Node on an Apple M1).
- Measured accuracy on the six synthetic fixtures: 100% hole accuracy on all six, including the two noisy ones (`measurements.md`).
- Dev-only photo trial: `scripts/photo-trial/` (printable card at 40 px/mm) and `scripts/read-photo.html`.
- Two shell-command hooks in `.kiro/hooks/` and a Context7 MCP config in `.kiro/settings/mcp.json`.

**What failed or surprised me:**
- **Property 46 failed.** The design asked for a disc's measured diameter to be within 5% for discs of 6 to 40 px. Counterexample `[6, 0, 0]`: a 6 px disc on a pixel corner measures 6.38 px (6.4% off), which is pixel quantisation, not a bug. I chose to change the property to "within 1 px always, within 5% from 12 px", and the counterexample stays as a regression example.
- **Property 80 failed** on a dark-pixel count (6.3% off) because of the generator's anti-aliasing. It now uses a coverage-weighted area with the same 5% tolerance.
- **Decoy peg pair bug.** While measuring the R18.8 scale, `readCard` returned wrong grids at 2.75, 2.25 and 1.25 px/mm (67 to 71 of 192 hook positions wrong): two punched holes of equal size can out-score the real peg holes. Fix (task 5.16): each candidate pair is checked against the card layout, and the pair that explains the most dark regions wins. Two follow-ups during that task: a decoy could still pass on sparse cards with no lacing holes, and the lacing-hole rule rejected cropped cards (fixed by requiring only lacing holes inside the image).
- **New failure reason `resolution-too-low`** (R12.5, task 5.17). At about 1 px/mm a tiny punched hole vanished and the read came back as a wrong grid. Sparse-card sweeps (up to 3,000 cases per bin) found wrong grids up to the 9 to 10 px bin, so the reader now refuses punched holes under 11 px. This is a safety floor, not a fix for the cause.
- **Task 5.14 parked.** Its four image properties (67, 68, 70, 77) failed on small or sparse cards because the layout check rejects good reads (safe failures, no wrong grids). They are saved as `parked-5.14-readCard-tests.patch` and folded into defect task 5.18, which is still open.
- Property 69 (noise images) was split: uniform images must give `peg-holes-not-found`; noise images must fail with no grid but may fail at a later step (8 in 3,000 did).
- The `src/archive` stub files were deleted from the working tree during phase 3 by an unknown cause; they were restored from git.
- The shell refused heredocs containing "npm run" text, so some files were written in pieces.

**What I changed by hand:** No files were edited by hand in this session; every file change was made by Kiro on request. My part was review and decisions: the spec edits before each approval (orientation from unequal peg diameters, the 10% minimum peg difference, the `pixelsPerMm` generator option, `.ts` import extensions in `src/codec`), the license holder name, the Property 46 change, the layout-check fix and the "best explanation wins" rule, the `resolution-too-low` reason and the 11 px floor, splitting Property 69, parking task 5.14, restoring `src/archive`, and skipping the 32 cut-last properties.

**Kiro features used:** spec (requirements, design, tasks), steering (including a file-matched steering doc), property tests with fast-check, shell-command hooks (created, not yet seen firing in the IDE), MCP (Context7, queried once to check browser API use).

**Evidence saved:** None yet; `media/` was created empty.

**Credits left:** Not recorded.

**Commit:** see the commit that adds this entry; work today spans `909d940` to `a3dee72`.

## 2026-11-18 (simulator phase 1)

**Goal today:** Simulator spec and phase 1 (first render).

**Prompts run in Kiro:** Not recorded by number. In order, the requests were:
- start the simulator spec (requirements first);
- answer the review: own slot type `CardGrid | null`, no tie-up plus a horizontal repeat count, no face-down setting, extra zari wefts out of scope;
- approve the design with decisions: minimum thread size 3 px and R6.4 dropped; measure speed first and do not change requirements if the budget is missed; shed height, 4096 px cap and fixed colours accepted;
- approve tasks;
- run phase 1 to the checkpoint.

**What Kiro produced:**
- `.kiro/specs/simulator/`: 14 requirements, a design with 24 numbered properties (16 marked Demo and 8 Cut last), and a 23-task plan.
- `src/simulator`: `types.ts`, `prepare.ts` (`prepareCloth`), `settings.ts` (`parseColour`, `parseRenderSettings`), `style.ts`, `render.ts` (`renderFrame` for rest frames, with zari highlight), `index.ts`.
- `tests/support/slots.ts`; tests for prepare, settings and render.
- `scripts/png_rgba.ts` (zero-dependency RGBA PNG encoder), `scripts/render_sample.ts` and the `sample-cloth` package script.
- `media/sample-cloth.png`: 1152 x 324 px, 48 demo picks, maroon plain weft and gold zari, deterministic SHA-1 `d6c87d08...`.
- Test suite at the end of phase 1: 25 files, 183 tests passing.
- One 1920 x 1080 rest frame took 7 to 11 ms in Node on an Apple M1 (informational).

**What failed or surprised me:**
- **Property 5 (R2.3, task 1.4) failed** after the zari highlight was added. For odd thread sizes its crossing-centre sample lands on a zari highlight pixel (counterexample: warp `#000000`, gold zari weft, t=3, 8x8 viewport, seed 20240611). The fix computes the expected zari colour at that pixel from the same highlight rule, so the check stays exact; arbitraries, numRuns and seed are unchanged. The agent applied the fix before reporting the failure, which the orchestrator had allowed in advance for exactly this case.
- **Property 1 (R1.2):** the first generator used `name: 42` as an invalid profile, but `parseCardProfile` only checks that `name` is present, so the profile stayed valid. The generator was changed to remove `name` instead. This exposed a codec gap, fixed next (`name` must be a string).
- Property 5 uses a filter that drops settings where a shaded warp colour equals a shaded weft colour.
- A non-array `slots` returns `invalid-settings` with setting `slots`. This is an interpretation, because no failure reason fits exactly.
- In the design review, the count of cut-last properties was first reported as 7; it is 8 (Properties 3, 7, 8, 9, 13, 15, 20, 24).

**What I changed by hand:** No files edited by hand; the user reviewed and approved the sample image.

**Kiro features used:** spec, steering, property tests.

**Evidence saved:** `media/sample-cloth.png`.

**Credits left:** Not recorded.

**Commit:** `6adcc26`, `43d116c`, `2d01a98`, `a51b281`, `7b146f8`, `784e768` (range `6adcc26` to `784e768`).

## 2026-11-18 (simulator phase 2)
**Goal today:** Fix the codec name gap; simulator phase 2 (gap rows, floats, float highlighting, horizontal repeat).
**Prompts run in Kiro:** Not recorded by number. In order, the requests were:
- approve the sample image;
- do task 1.7;
- fix the codec gap (the profile name must be a string);
- start phase 2 and report the skipped cut-last properties.
**What Kiro produced:**
- **Codec:** new violation kind `not-a-string`, new criterion R2.10 in the card-codec-and-reader requirements, design Property 84, codec task 5.19, an example test and Property 84 (commit `f6b7e75`).
- **Simulator:** gap rows (missing picks hatched with `/`, damaged picks cross-hatched with `X`) with Properties 6, 10 and 11; `computeFloats` with Property 7; window-bounded float highlighting (scans at most limit+1 cells each way) with Property 9; horizontal repeat by copying one base width with `copyWithin`, with Property 23 (tiled render equals the base render repeated).
- Test suite at the end of the phase: 26 files, 192 tests passing.
- Timing (Node, Apple M1, demo profile, 1920x1080, t=8, repeat 4, 2000 picks, rest frame): median 5.5 ms with highlighting off, 9.5 ms with highlighting on (maxLength 4). Informational; the budget check is task 4.5.
**What failed or surprised me:**
- **Property 6 (R2.5) failed** once float highlighting was on: replacing a pick inside a warp float correctly changes the highlight in neighbouring picks. User decision: Property 6 runs with highlighting off (R2.5 is about interlacement; Property 9 checks highlighting). Design text updated.
- **Property 5 (R2.3) failed** after highlighting was added. Its expected colour now includes the highlight blend, computed from the same reference as Property 9, so the check stays exact.
- **Property 23 (R14.2) failed.** The design drew the zari highlight at absolute x mod 4 and the gap hatch at absolute (x ± y) mod 6, so those rows did not tile unless the base width was a multiple of 4 and 6 (counterexample: 2x5 hooks, t=3, base width 30, gold zari). User decision: measure both patterns from the start of each repeat (u = x mod base width). Design changed; Properties 5, 9 and 10 updated to the new rule; `sample-cloth.png` unchanged (same SHA-1).
- A timing of 74.3 ms per frame reported during task 2.4 could not be reproduced; repeated measurements give 5.5 to 6.7 ms with highlighting off. Cause unknown.
- **Cut-last properties skipped in phase 2:** Property 8 (R3.2, floats stop at gaps; the rule is still exercised by Property 7's reference) and Property 24 (R14.4, floats across repeat boundaries; covered by Properties 7 and 9). Kept although cut-last: Property 7 (the only property for `computeFloats`) and Property 9 (the only test of the highlight code).
**What I changed by hand:** No files edited by hand; the user made the decisions above.
**Kiro features used:** spec, property tests.
**Evidence saved:** None new.
**Credits left:** Not recorded.
**Commit:** `f6b7e75`, `51c6dae`, `1bd1d82`, `9e3f6b5`, `a4534b9` (range `f6b7e75` to `a4534b9`).

## 2026-11-18 (simulator phase 3)
**Goal today:** Simulator phase 3 (frames, shed animation, player, canvas and a dev preview page).
**Prompts run in Kiro:** Not recorded by number. The request was: commit the 2.5 checkbox, run phase 3, report the preview page command and URLs.
**What Kiro produced:**
- `src/simulator/frames.ts`: `PASS_STEPS = 8`, `framesForPick`, `frameAt`, with Properties 19 and 21.
- `render.ts`: lift and pass frames (raised ends in the shed, the weft band part-way across). Properties 6, 16 and 18 were extended to lift and pass frames. A second R7.5 property covers lift and pass frames of gap picks and bad steps.
- `src/simulator/player.ts`: `createPlayer` (play, pause, resume, seek, current) with an injected scheduler and paint. Property 17: play to p and `seek(p)` both paint exactly `renderFrame(rest(p))`.
- `src/simulator/canvas.ts`: `paintToCanvas` (one `putImageData` per frame) and `browserScheduler` (`requestAnimationFrame` looked up at call time). It is the only browser-API file in `src/simulator`.
- `scripts/sim-preview.html` and `scripts/sim-preview.ts`: dev-only preview page with controls, a scrub slider, gap toggles (pick 20 missing, pick 30 damaged) and a median/worst frame-time readout. It is not in the app build. `demoPattern` moved to `scripts/demo_pattern.ts` so the page can use it without Node modules; fixtures are byte-identical after the move.
- Test suite at the end of phase 3: 29 files, 212 tests passing.
**What failed or surprised me:**
- No property failed in phase 3.
- Property 23 (tiled equals base) holds only for rest frames: in a pass frame the weft band stops at a fraction of the full tiled width. The property was left unchanged (it renders rest frames).
- When the shed is shorter than one thread (a very short viewport), the weft band is clipped to the shed instead of drawing over the cloth.
- The preview page's frame time covers `renderFrame` plus the canvas copy per painted tick, because the player calls `renderFrame` internally.
- The preview page was checked with curl (HTTP 200) and the type checker only. Kiro did not open it in a browser.
- **Cut-last properties skipped in phase 3:** none (phase 3 has none).
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, property tests.
**Evidence saved:** None new.
**Credits left:** Not recorded.
**Commit:** `7cba7b8`, `6fd808d`, `b44dcce`, `1a67e94`, `1e87d74` (range `7cba7b8` to `1e87d74`).
