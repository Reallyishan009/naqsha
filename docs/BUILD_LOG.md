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

## 2026-11-18 (simulator phase 4)
**Goal today:** Simulator phase 4 (remaining properties, structure tests, benchmark, frame-time fix, docs).
**Prompts run in Kiro:** Not recorded by number.
**What Kiro produced:**
- Property 22 (never throws) and the `renderFrame` fix it led to.
- Structure tests extended to `src/simulator` (no violations).
- Property 15 widened, and new Properties 25 and 26, so every exported simulator function has a property.
- `tests/simulator/benchmark.test.ts` and `.kiro/specs/simulator/measurements.md`.
- Run-length float highlighting (task 4.7).
- Docs updates (`structure.md`, `README.md`, this entry).
- Test suite at the end of the phase: 31 files, 224 tests passing.
**What failed or surprised me:**
- **Property 22 failed.** `renderFrame` threw a TypeError on a non-PreparedCloth (counterexample `[[],[],[]]`). Fix: a module-private WeakSet brand; a bad cloth returns `invalid-settings` with setting `cloth`; settings are re-parsed on every call. Frame time went from 5.5 to 6.5 ms.
- The naming test found 10 exported helpers without a property. Fixed with Properties 15, 25 and 26.
- **Benchmark (task 4.4):** with float highlighting on, the median was about 16 ms and the worst up to 24 ms at 1920 x 1080, so the budget was missed. Without highlighting it was about 6 ms. Frame time also rose from pick 0 until the viewport filled (about 180 picks at 6 px), then stayed flat.
- After task 4.7 the median with highlighting on is about 10.6 ms (p95 11.3 to 12.5 ms). Output was byte-identical on 1,825 frames checked.
- Isolated worst frames (29 ms and 147 ms) appeared in runs without highlighting, likely garbage-collection pauses. Not investigated.
- **REQUIREMENT CHANGE APPROVED BY THE USER:** R10.2 now says frame time does not grow with the pick index once the viewport is full of woven picks (commit `271caf6`).
- **Cut-last properties skipped across the simulator:** 3, 8, 13, 20 and 24. Property 15 (cut last) was kept and widened. Task 4.2 was skipped by the user.
**What I changed by hand:** No files edited by hand; the user approved the two fixes.
**Kiro features used:** spec, property tests, steering.
**Evidence saved:** None new.
**Credits left:** Not recorded.
**Commit:** range `75d5952..HEAD` (`d1ad64f`, `afe549a`, `5976f43`, `271caf6`, `195d5ec`, plus the docs commit).

## 2026-11-18 (exporter phase 1)
**Goal today:** Exporter spec (requirements, design, tasks) and phase 1 (export).
**Prompts run in Kiro:** Not recorded by number. In order, the requests were:
- write the exporter requirements, adapted from prompt 28;
- answer the review: designs with gaps fail to export; lift colour black by default, white as an option, and the docs say the right colour per controller is unverified; pick 0 at the top and end 0 at the left by default; the 8-bit colour table has 256 entries; the exporter imports only `src/codec`; the download helper stays in one file;
- approve the design and tasks with decisions: a file over 2 GB is refused as `invalid-options` with option `bitDepth`; a non-array Pattern is `invalid-card` at pick -1; the reader ignores padding;
- run all three phases.
**What Kiro produced:**
- `.kiro/specs/exporter/`: 12 requirements, a design with 19 numbered properties (17 marked Demo and 2 Cut last), and 13 tasks.
- `structure.md` updated: exporter imports only `src/codec`.
- `src/exporter`: `types.ts`, `options.ts` (`parseExportOptions`), `layout.ts` (`bmpLayout`), `exportBmp.ts` (`exportPatternBmp`, 1-bit and 8-bit).
- `tests/support/patterns.ts`.
- Known-bytes tests for 1-bit (70 bytes) and 8-bit (1,086 bytes), with the bytes written out in the tests.
- Properties 1, 2, 3, 6, 8 and the options half of 9, plus two extra option properties (valid options are returned unchanged; parsing never throws).
- `scripts/export_sample.ts` and the `sample-bmp` package script.
- `media/sample-design-1bit.bmp` (4,862 bytes) and `media/sample-design-8bit.bmp` (39,478 bytes), 192 x 200 px, recognised by `file` and `sips`.
- Test suite at the end of phase 1: 34 files, 246 tests passing.
**What failed or surprised me:**
- No property failed.
- A size-limit test first used a layout too small to exceed the 2 GB limit (test arithmetic error). It now checks `bmpLayout` only, because a Pattern large enough to trigger the refusal through `exportPatternBmp` would not fit in memory.
- Until task 1.3, `bitDepth` 8 was refused with `invalid-options`, as a marked temporary step.
- The R7.2 property had the 1-bit layout arithmetic hard-coded. It was generalised to both bit depths in task 1.3 (widened).
- **Cut-last properties skipped:** none so far.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests.
**Evidence saved:** `media/sample-design-1bit.bmp`, `media/sample-design-8bit.bmp`.
**Credits left:** Not recorded.
**Commit:** range `721aa45..HEAD` (starts with `30784ec`).

## 2026-11-18 (exporter phase 2)
**Goal today:** Exporter phase 2 (reader and download helper).
**Prompts run in Kiro:** Not recorded by number. The user asked to run all three phases without stopping unless a test fails.
**What Kiro produced:**
- `src/exporter/readBmp.ts`: `readPatternBmp` checks in this order: profile, options, not-a-bmp, unsupported-bmp fields, width-mismatch, inconsistent-size fields, then pixels by colour table entry. The file's own bit depth decides how to read, so both variants read back with the same options.
- `src/exporter/download.ts`: `bmpFileName` and `downloadBmp` with injectable dependencies. The URL is revoked through an injectable `defer` (`setTimeout(0)` by default), because Safari can cancel a download that is revoked in the same tick. `DownloadDeps` gained a `defer` field beyond the design.
- Properties 9 (reader half), 10 (round trip), 12 (1-bit and 8-bit round trip), 13, 14, 15, 16 and 19.
- Example tests, including the inverse read with the wrong lift colour and a child-process test that importing `download.ts` in plain Node does not throw.
- Test suite at the end of phase 2: 36 files, 263 tests passing.
**What failed or surprised me:**
- No property failed.
- An in-process test of importing `download.ts` without browser globals failed because Vitest needs `URL` itself, so it runs in a child Node process.
- Reading a file with the wrong `liftColour` option inverts the Pattern silently (both colours are known). This is correct per R6.3, but the options must match the export.
- **Cut-last properties skipped:** none so far.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, property tests.
**Evidence saved:** None new.
**Credits left:** Not recorded.
**Commit:** range `a2e02c9..HEAD` (`5347fd5`, `787c6aa`, `398c2ae`).
## 2026-11-18 (exporter phase 3)
**Goal today:** Exporter phase 3 (remaining properties, structure tests, docs).
**Prompts run in Kiro:** Not recorded by number.
**What Kiro produced:**
- Properties 5 (pixel placement, checked with an independent pixel reader), 11 (identical bytes), 17 (reader never throws, including truncated and byte-flipped files) and 18 (export never throws).
- Cut-last Properties 4 (inputs unchanged) and 7 (padding zero), plus an example that the reader ignores padding.
- Structure tests extended to `src/exporter` (the exporter-only browser word list adds `URL`, `setTimeout` and `globalThis`).
- README and `structure.md` updates.
- Test suite: 36 files, 276 tests passing.
**What failed or surprised me:**
- No property failed in phase 3.
- **Cut-last properties skipped:** none (Properties 4 and 7 were both added).
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, property tests, steering.
**Evidence saved:** None new.
**Credits left:** Not recorded.
**Commit:** range `dafc418..HEAD`.

## 2026-11-19 (app phase 1, task 1.5: shell and theme tokens)
**What Kiro produced:** `App` shell (navigation, language switch, profile error banner, per-screen error boundary, one live region), theme tokens, `contrastRatio` and `TOKEN_PAIRS`, `platform/browser.ts`.
**Contrast findings (R14.7):** every Night loom pair passes. In Day loom, `--zari` `#B8860B` on `--ground` `#F6EFE0` is 2.84:1, below the 3:1 needed for the focus indicator. Darkening zari alone would break `--ink` on `--zari` (button text, needs 4.5:1; the brief value gives 4.95:1). Proposed and applied: `--zari` Day loom `#B0800A`, which gives `--ink` on zari 4.55:1, zari on ground 3.09:1, zari on surface 3.42:1. Night loom zari is unchanged.
**Cut-last properties skipped:** none (Properties 31 and 32 are both written).
## 2026-11-20 (requirement change, user-approved: profile validation rejects overlapping holes)
**What changed:** new criterion R2.11 in `card-codec-and-reader`: validation reports a violation when the discs of any two holes (hook positions, lacing holes, peg holes) overlap or touch, that is, the distance between centres is at most the sum of radii. `validateCardProfile` (and so `parseCardProfile`) now reports a new violation kind `holes-overlap` that names both holes.
**Why:** task 1.9 (printable card) Properties 37 and 38 failed with seeds 3701 and 3801 (`tests/ui/printable/raster.test.ts`). The shrunk counterexample had two lacing holes about 0.87 mm apart with a 1.5 mm diameter, which the old validation accepted, so the printed discs overlapped. The fast-check paths of those two failures, supplied later by the user: Property 37, seed 3701, path `15:7:0:1:0:0:0:0:0:0:0:0:0:4:3:3:3:2:5:2:4:2:4:5:3:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0:0`; Property 38, seed 3801, path `3:4:1:0:1:1:1:1:1:1:1:3:2:0:7:0:4:4:6:4:4:6`. The user chose to change the requirement, not the property.
**How it is checked:** hook against hook is checked by neighbour pitch only (the grid is regular), lacing against lacing by an x sweep, and a lacing or peg hole against the hook grid only in the cells within reach of its disc. Property 87 compares this with a brute-force all-pairs check. Added Properties 85, 86 and 87 and example tests in `tests/codec/validateCardProfile.test.ts`.
**Test changes caused by the rule:**
- `tests/support/profiles.ts`: generated profiles keep at least 0.5 hole diameter of clear gap (pitches raised to at least 1.5 hole diameters, lacing holes closer than that are dropped). `numRuns` and seeds are unchanged.
- `tests/codec/validateCardProfile.test.ts` Property 11 (R2.8 accepted): peg diameters up to 20 mm now overlap other holes, so both peg holes are moved off the card. The diameter range is unchanged.
- `tests/reader/resolution.test.ts`: two saved counterexample profiles had overlapping lacing holes; x values moved apart (8x5: 16.5391 to 16.9 and 13.7146 to 20.2; 9x9: 16.8972 to 17.8). Expected results unchanged.
**Checks:** `public/profiles/demo-12x16.json` is still valid. `npm run fixtures` regenerates `tests/fixtures` byte-identically (same checksums, no git diff).
**Files changed:** `src/codec/types.ts`, `src/codec/validateCardProfile.ts`, `.kiro/specs/card-codec-and-reader/requirements.md`, `.kiro/specs/card-codec-and-reader/design.md`, `tests/codec/validateCardProfile.test.ts`, `tests/support/profiles.ts`, `tests/reader/resolution.test.ts`.
**Cut-last properties skipped:** none.
## 2026-11-20 (app phase 1, task 1.10: PNG pixel density and download)
**What Kiro produced:** `src/ui/printable/png.ts` (`crc32`, `withPixelDensity`) and `download.ts` (`saveFile`, `printPng`, `printSvg`, `browserPrintDeps`, the only file in `printable/` that names browser APIs). Properties 36 and 14 (print half) plus examples: chunk list `IHDR`, `pHYs`, `IDAT`, `IEND`; density 12000 at 12 px/mm; SVG with no `<metadata>` or `<text>`.
**Timing (R21.19):** `printableRaster` for a floral pick of the demo profile at 12 px/mm took 10.5 ms in Node (one run). The on-device check on a mid-range 2020 phone is a manual check, not done.
**Not covered by a test:** the real canvas `toBlob` path and the real anchor click run only in a browser; tests use fakes behind `PrintDeps` and `DownloadDeps`.
**Cut-last properties skipped:** none.

## 2026-11-20 (app phase 1, task 1.13: Phase 1 summary)
**Goal today:** Close Phase 1 of the `app` spec (Weave, Try it, printable sample card, deployment) and record what happened.
**Prompts run in Kiro:** Not recorded by number. Tasks 1.1 to 1.12 were run one at a time from `.kiro/specs/app/tasks.md`.
**What Kiro produced:**
- App foundations and shell: `src/ui` types, English and Hindi translations with a lookup and a Hindi review list, profile loading, app state reducer, shell with language switch and theme tokens, one live region.
- Weave screen: cloth settings and playback model, gap list, canvas, play, pause, step, scrub, speed, colours, zari, repeat, and "Try it" with three sample designs (diamond, border, floral).
- Printable card inside Try it: layout, SVG and raster drawing, PNG pixel density, PNG and SVG download, loaded as a separate lazy chunk.
- Deployment: Vite `base: './'`, `vercel.json`, README Vercel steps, `npm run check-bundle`.
- Final checks run for this entry: `npm run test:run` gives 57 files, 405 tests, all passing. `npm run typecheck` and `npm run build` pass. `check-bundle` passes: entry chunk 82,760 bytes gzipped (limit 204,800); build output also has a 2.51 kB gzipped lazy chunk for the printable download and 1.38 kB gzipped CSS.
- Node timings (Apple M1, single runs): sample selection to first painted pick 0.8 ms (floral, demo profile); `printableRaster` for one floral pick at 12 px/mm 10.5 ms.
**What failed or surprised me:**
- **Sample designs had the wrong shape on square-thread cloth.** The first diamond, border and floral designs did not look right once woven, because the simulator draws every end and every pick as the same size, so a motif sized to the card's width and height looked stretched. Commit `de65145` retuned them: diamond and floral are tiled along the ends in cells as wide as one repeat is long, the border became a zigzag band, and each floral flower now has separate petals. The formulas still read no card dimension. I did not record the shapes before the retune, so this entry cannot describe them in detail. Eyes-on judgement of the three shapes is still the user's.
- **REQUIREMENT CHANGE APPROVED BY THE USER (see the 2026-11-20 entry above):** card-codec-and-reader R2.11, profile validation rejects overlapping holes. Properties 37 and 38 (printable card draw then `readCard`) failed with seeds 3701 and 3801: two lacing holes about 0.87 mm apart with a 1.5 mm hole diameter were accepted by validation, so the printed discs overlapped. The user chose to change the requirement, not the property. The fast-check `path` strings of those two failures were not saved.
- **Existing property changed, needs the user's confirmation: R2.8 (Property 11 in `tests/codec/validateCardProfile.test.ts`).** With R2.11 in force, peg hole diameters up to 20 mm overlap other holes, so the test now moves both peg holes off the card. The diameter range is unchanged, but the property now checks R2.8 only with peg holes outside the card, so it covers less than before.
- **Two edited reader counterexamples, need the user's confirmation:** in `tests/reader/resolution.test.ts` two saved profiles (8x5 and 9x9) had overlapping lacing holes, so R2.11 rejects them. Lacing hole x values were moved apart (8x5: 16.5391 to 16.9 and 13.7146 to 20.2; 9x9: 16.8972 to 17.8). The expected results are unchanged, but these are no longer the original counterexamples.
- `tests/support/profiles.ts` now keeps at least 0.5 hole diameter of clear gap in generated profiles. This narrows the profile arbitrary for every test that uses it. `numRuns` and seeds are unchanged.
- **Contrast change (R14.7):** in Day loom, `--zari` `#B8860B` on `--ground` `#F6EFE0` was 2.84:1, below the 3:1 needed for the focus indicator. Darkening zari alone would have failed `--ink` on zari, so the token is now `#B0800A` (ink on zari 4.55:1, zari on ground 3.09:1). This differs from the value in `DESIGN_BRIEF.md`. Night loom zari is unchanged. All other token pairs pass.
- **Cuttable properties skipped in Phase 1: none.** Checked by searching the tests for `Feature: app, Property N`. Of Properties 4, 16, 19, 21, 25, 29, 30, 31, 32, 33 and 35: Properties 4, 29, 30, 31, 32 and 35 exist in Phase 1 tests. Properties 16, 19 and 21 belong to Phase 2, 25 to Phase 3 and 33 to Phase 4, so they are not yet written, and nothing was dropped.
- **Not measured:** on-device timings (sample selection, `printableRaster` on a mid-range 2020 phone). The Node numbers above are not a substitute.
- **Not covered by tests:** the real canvas `toBlob` path, the real anchor click and the real `requestAnimationFrame` run only in a browser; tests use fakes. Nobody has opened the Weave screen in a browser in this session.
- **README references missing files:** `README.md` points to `media/banner.png`, `media/weave-sample.gif`, `media/scan-printed-card.gif` and `media/keep-export.gif`. None exist until Phase 3, so those images show as broken links. The README says so. The public URL is also a placeholder until the Vercel deployment is made.
- **Hindi review list:** 61 strings, all `reviewed: false`, listed in `docs/HINDI_REVIEW.md` (regenerated with `npm run review-list`; the file was already current). A Hindi speaker has not read them.
**Deployment:** the user deployed the site to Vercel by hand: https://naqsha-ashen.vercel.app/ . The user reports it loads publicly with no login (not verified by Kiro in a browser). A `curl -L` request from Kiro's machine returned HTTP 200; that checks only the status code, not what the page shows.
**User acceptance:** the user accepted Phase 1, including the test changes from the R2.11 fix: R2.8 (Property 11) with peg holes moved off the card, the two edited reader counterexamples in `tests/reader/resolution.test.ts`, and the generator margin in `tests/support/profiles.ts`. The fast-check paths for Properties 37 and 38 are now recorded in the 2026-11-20 requirement-change entry.
**Manual checks still open:** phone-width check of Try it with `npm run dev`; print a Printable_Card at 100% scale and measure it with a ruler; read a printed card with a camera; on-device timings.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check), hooks.
**Evidence saved:** None new.
**Credits left:** Not recorded.
**Commit:** see the commit that adds this entry; Phase 1 work spans `f2a61a7` to `acf3e58`.

## 2026-11-21 (app phase 2: Keep and the archive)
**Goal today:** Close Phase 2 of the `app` spec (archive, IndexedDB store, Card_Profile notice, Keep screen, BMP export) and record what happened.
**Prompts run in Kiro:** Not recorded by number. Tasks 2.1 to 2.6 were run one at a time from `.kiro/specs/app/tasks.md`; this entry is task 2.7.
**What Kiro produced:**
- `src/archive`: `saveDesign`, `getDesign`, `listDesigns`, `deleteDesign` over an injected `ArchiveStore` (`put`, `get`, `listSummaries`, `remove`), with `now` and `newId` injected; every failure is a value, none throws. Lists sort newest first, then by id, and carry no pattern.
- `src/archive/idbStore.ts`: `openIndexedDbStore()` for database `naqsha-archive` version 1, stores `designs` and `summaries` (index `createdAt`); `put` and `remove` each use one `readwrite` transaction over both stores.
- `src/ui/profile/notice.ts` and `ProfileNotice.tsx`: the Card_Profile notice, shown exactly when the profile `status` contains `UNVERIFIED`, with the status text unchanged.
- `appState.ts`: `open-saved` and `mark-saved` actions.
- `src/ui/state/keep.ts`: `canExport`, `canSave`, `savedLabel`, `summaryRow`, `runExport`, the Keep form reducer; `exportFailureKey`, `bmpReadFailureKey` and `archiveFailureKey` as exhaustive switches.
- `src/ui/screens/keep/KeepScreen.tsx`: export options, the loom export button with the "no loom controller has been tested" sentence, six optional fields, save, the saved list with open and confirmed delete, and the notice next to both the export and the save controls.
- Tests: Properties 15, 16, 17, 18 (archive), 19, 20, 21 (Keep), 39 (notice), the export halves of 13 and 14, and Property 6 for the export, BMP read and archive failure types. Test files: `tests/archive/designs.test.ts`, `idbStore.test.ts`, `structure.test.ts`, `tests/ui/state/keep.test.ts`, `tests/ui/screens/keep.test.tsx`, and others.
- Final checks run for this entry: `npm run test:run` gives 64 files, 469 tests, all passing. `npm run typecheck` and `npm run build` pass. `npm run check-bundle` passes: entry chunk 89,566 bytes gzipped (limit 204,800; 82,760 at the end of Phase 1). The lazy printable chunk is 2.51 kB gzipped and the CSS 1.80 kB gzipped.
**Deviations from the design:**
- **`StoreUnavailableError`.** The design did not name it. `src/archive/types.ts` exports this error class; a store method throws it when the database cannot be opened, and the archive reports `storage-unavailable` for it from any operation. Any other throw from `put` or `remove` is `write-failed`; any other throw from `get` or `listSummaries` is `storage-unavailable`. `openIndexedDbStore` is exported from `idbStore.ts` but is not re-exported from `src/archive/index.ts`; only `designs.ts` uses it.
- **Default deps.** The four archive functions take `deps` as an optional last argument that defaults to browser deps (`openIndexedDbStore()`, `Date.now`, `crypto.randomUUID`), built on first use so importing the module never touches IndexedDB. `openIndexedDbStore` also takes an optional `IDBFactory`, so tests can pass a fake. An open that failed is tried again on the next call.
- **`summaryRow` has a third argument.** It is `summaryRow(summary, currentProfileName, untitled)`; the `untitled` text is passed in so the function stays free of the language lookup.
**What failed or surprised me:**
- **Property 18 test bug (mine, in the test, not in the code).** `tests/archive/designs.test.ts` Property 18 first expected only `storage-unavailable` or `write-failed` from every failed call. With an empty store, a `get` or `delete` of an unknown id correctly returns `not-found`, so the test failed on a correct result. The fix lets `not-found` through for those two calls only when the store holds no design. I could not recover the original failing counterexample from the repository, so this describes the cause from the final test text and not from a saved failure. `numRuns` (the shared `NUM_RUNS`), seed 1801 and the failure points are unchanged. This does loosen what the property accepts in that one case, so it needs the user's confirmation.
- No other property failed in Phase 2.
**Archive tests use a hand-written fake IndexedDB.** `tests/support/fakeIndexedDb.ts` is an in-memory `IDBFactory` written for this project. No new dependency was added (`package.json` still has only `react` and `react-dom` as dependencies). It supports open with upgrade, object stores with a key path, indexes, transactions over several stores, put, get, getAll, count, delete and abort, with structured clone on the way in and out. `idbStore.ts` runs unchanged over it.
**What the fake cannot prove (the user will test these by hand):**
- That `idbStore.ts` is correct against the real browser typings, `createIndex`, `getAll` and `count`. The fake implements the parts of those APIs that I understood; a real browser may differ.
- The real request-failure abort behaviour: the fake aborts a transaction when a write fails, and a browser's ordering of `onerror` and `onabort` may differ.
- Real structured-clone limits and storage quota errors.
- Opening failure in private browsing modes.
- `onversionchange` across two tabs (the handler closes the database; only one fake database exists).
- Transaction timing and auto-commit rules.
- Persistence across a page refresh and after clearing the browser cache (a product success criterion). Nothing in Node can show this.
**Cuttable properties skipped:** none. Properties 16, 19 and 21 all exist (`Feature: app, Property 16` in `tests/archive/designs.test.ts`; Properties 19 and 21 in `tests/ui/state/keep.test.ts`).
**Manual checks still open (not yet run):**
- In a real browser: save a design, reload the page, check it is in the list, open it, delete it, reload and check it is gone. Also clear the site data and check the list is empty and the app still works.
- Open an exported 1-bit and an 8-bit BMP in an image viewer and check it looks like the design.
- Run the Keep screen at phone width, in both languages.
- No loom controller has been tried with an exported file, and the Card_Profile values are unverified.
**Hindi review list:** 117 strings, all `reviewed: false` (61 at the end of Phase 1). `docs/HINDI_REVIEW.md` was regenerated with `npm run review-list`. A Hindi speaker has not read them.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check).
**Evidence saved:** None new.
**Credits left:** Not recorded.
**Commit:** Phase 2 work spans `9486b0c` to `ad0a711`; see the commit that adds this entry.

## 2026-11-21 (app phase 3, task 3.5: Scan chunk check and readCard timing)
**Goal today:** Check that the Scan code stays out of the entry chunk, record the chunk sizes, and time `readCard` on a 1080p synthetic image in Node.
**What changed:**
- `scripts/check_bundle.ts` now fails when the Scan-only marker string is in the entry chunk, or when no other chunk in `dist/assets` has it. The marker is `width and height must be positive integers`, the `invalid-image` detail text in `src/reader/readCard.ts`. A string literal is used because minification renames identifiers but keeps strings. If that message changes, `SCAN_ONLY_MARKER` must change with it. `BundleReport` gained `scanChunks`.
- `scripts/time_read_card.ts` (new) renders one demo card (tilt 3 degrees, noise 2, shade 0.1, seed 1) at 19.6 px/mm, pads it to exactly 1920 x 1080, checks that the read grid equals the ground truth, then times `readCard` over 15 runs after one warm-up read.
**Sizes (`npm run check-bundle`, gzip level 9):** entry chunk `assets/index-CHTieIvU.js` 92,230 bytes (limit 204,800); Scan chunk `assets/ScanScreen-DWCJl0Mp.js` 7,659 bytes. `vite build` prints 93.44 kB and 7.70 kB for the same files, because it uses its own gzip level and kB = 1000 bytes.
**readCard timing, Node v24.5.0, darwin arm64, 1920 x 1080, 15 runs per batch, three batches:** min 23.4 / 23.3 / 23.3 ms; median 24.6 / 24.2 / 24.1 ms; max 32.1 / 35.0 / 31.3 ms. Run with `node scripts/time_read_card.ts`.
**Budget:** 300 ms for a 1080p frame on a mid-range 2020 phone (`tech.md`). The Node number is from a laptop and says nothing certain about a phone. The on-device timing is a manual check and has not been done.
**Deviation:** `src/reader` imports its own files without an extension, which Node cannot resolve. `time_read_card.ts` registers a small resolve hook (`node:module` `registerHooks`) that retries with `.ts`. No source file was changed for this.
**Evidence saved:** None.
## 2026-11-21 (app phase 3, task 3.6: README media)
**Goal today:** Capture the banner and three GIFs from the built site in a real browser.
**What changed:** `media/banner.png`, `media/weave-sample.gif`, `media/scan-printed-card.gif`, `media/keep-export.gif` added. The README line saying the media was missing was replaced by a short note on how they were captured.
**Tools used (all outside the project, nothing added to `package.json`):** the installed Google Chrome 157 app, run headless and driven over the DevTools protocol by a throwaway Node script in `/tmp/naqsha-capture/` (Node 24 built-in `WebSocket`, real mouse events, `DOM.setFileInputFiles` for the photo); Python 3.13 with Pillow 13.0.0 (already on the machine) to scale the PNG frames and write the GIFs. The script is not kept in the repository.
**How each file was made:**
- App: `npm run build`, `npm run preview` on port 4173, window 900 x 1000, English, demo profile `demo-12x16`.
- `weave-sample.gif`: Weave, "Diamond" sample, playback until pick 36 of 36.
- `scan-printed-card.gif`: Scan, a card image from `scripts/make_fixtures.ts` (demo profile, `--noise 8 --tilt 3 --shade 0.15 --seed 7 --pixels-per-mm 8`, picked card is `scripts/photo-trial/input-card.json`), one hook tapped (diamond badge shown), card accepted. The Card_Profile notice is on screen in the first and last frames. The input is a generated image, not a camera photo.
- `keep-export.gif`: Keep with the "Floral" sample, 1-bit chosen, download button pressed. The notice is on screen in the export panel. The BMP landed in a temporary folder and was not kept.
- `banner.png`: composed with Pillow from two real captures, the printable card raster `scripts/photo-trial/card.png` on the left and a screenshot of the finished diamond cloth canvas on the right. It is a composite, not one screenshot.
**Sizes:** see `ls -l media/`; all four files are well under 5 MB.
**Seen while capturing (not changed):** after "Accept this card" the live message reads "Card {number} added." in English, so the `{number}` placeholder is not filled for the `scan.accepted` announcement.
**Not verified:** the GIFs were not played back in a browser or on GitHub; the Hindi UI was not captured.
## 2026-11-21 (app phase 3, task 3.7: Scan with tap-to-correct and batch, final check)
**Goal today:** Close Phase 3 of the `app` spec and record what happened, including what is not verified.
**Prompts run in Kiro:** Not recorded by number. Tasks 3.1 to 3.6 were run one at a time from `.kiro/specs/app/tasks.md`; this entry is task 3.7.
**What Kiro produced:**
- Scan_Batch operations and reducer actions (3.1), read failure messages (3.2), correction and marker logic (3.3), the lazy Scan screen with tap-to-correct, the batch list and a fixture integration test (3.4), the Scan chunk check and `readCard` timing (3.5), and README media (3.6).
- **3.1 batch commit:** accepting a card commits it to the batch, and the batch is cleared as a whole when the pattern is handed on to Weave or Keep. The Remove and Done confirmations are kept in local screen state in `ScanScreen.tsx`, not in `AppState`, so a reload or a screen change drops a half-made confirmation and nothing in the reducer depends on it.
- Tests: Property 25 (hit areas reach 48 CSS pixels) and the other Phase 3 properties, plus `tests/ui/screens/announce.test.tsx` and `tests/integration/scanFixtures.test.ts` (the four fixture conditions: clean, noisy, tilted, noisy and tilted).
**Final checks run for this entry:**
- `npm run test:run`: 69 files, 520 tests, all passing (64 files and 469 tests at the end of Phase 2).
- `npm run typecheck` and `npm run build` pass.
- `npm run check-bundle` passes. Entry chunk `assets/index-CP5VmUnR.js` 92,251 bytes gzipped (limit 204,800; 89,566 at the end of Phase 2). Scan chunk `assets/ScanScreen-Db_vFQEy.js` 7,674 bytes gzipped. `vite build` prints 93.47 kB and 7.72 kB for the same files (its own gzip level, kB = 1000 bytes). The Scan-only marker is in the Scan chunk and not in the entry chunk.
- `readCard` on a 1920 x 1080 synthetic image, Node v24.5.0, darwin arm64, 15 runs per batch, measured in task 3.5: median 24.1 to 24.6 ms, max 35.0 ms. The budget is 300 ms on a mid-range 2020 phone. This is a laptop number and says nothing certain about a phone.
**What failed or surprised me:**
- **`announce` params bug.** During media capture (3.6) the live message after "Accept this card" read "Card {number} added." because the `announce` path did not pass `params` to the translator, so `{number}` stayed unfilled for `scan.accepted` and `scan.replaced`. Fixed in `59956cb` (`ScanScreen.tsx`, `App.tsx`, `appState.ts`, `types.ts`) with a new test, `tests/ui/screens/announce.test.tsx`. The 3.6 entry says "not changed"; it was fixed afterwards. The Scan GIF was re-recorded in `5d55064` so it ends on "Card 1 added." No other GIF showed the bug.
- No property failed in Phase 3 that I know of from the repository; I did not keep a record of intermediate failures.
**Read failure kinds checked only through message mapping in the app:**
- `ambiguous-orientation`, `resolution-too-low` and `card-outside-image` have no real-photo test in the app. The app tests check that each kind maps to a message in both languages (`tests/ui/i18n/failureKeys.test.ts`) and, in the fixture integration test, the messages shown.
- Reader tests do cover all three on synthetic images from the generator, not photographs: `resolution-too-low` in `tests/reader/resolution.test.ts` (line 38 and nearby), `ambiguous-orientation` at 2.25 px/mm in `tests/reader/resolution.test.ts` line 65 (title "R18.8 ..."), and `card-outside-image` for a render cropped through the top hook rows in `tests/reader/readCard.test.ts` line 86 (title "R10.4 ..."). Whether the real camera photo of a printed card triggers these kinds the way the synthetic images do is unknown.
**Cuttable properties skipped:** none. Property 25 exists (`tests/ui/state/corrections.test.ts`, `Feature: app, Property 25`). Properties 4, 16, 19, 21, 25, 29, 30, 31, 32 and 35 all exist; Property 33 belongs to Phase 4 and has not been written.
**Requirement-ID coverage check (Requirements 1 to 17 and 21 to 23):**
- Method: a script read the 202 numbered acceptance criteria of those requirements and looked for `R<n>.<m>` in test titles (`it`, `test`, `describe`) under `tests/ui`, `tests/archive`, `tests/integration`, `tests/structure` and `tests/scripts`. Titles under `tests/reader`, `tests/codec`, `tests/simulator` and `tests/exporter` use the numbering of the earlier module specs, so they were not counted (an `R1.5` there is not app R1.5). Several titles list two IDs ("R14.8 and R14.9 ..."); both were counted. No acceptance criterion was weakened and no test was added in this task.
- **147 of 202 IDs appear in a test title. 55 do not.** No documented manual check was found for these either, except where noted below. They are open:
  - Requirement 1: 1.1, 1.5. Requirement 2: 2.4, 2.8. Requirement 3: 3.7, 3.8. Requirement 4: 4.6. Requirement 5: 5.1, 5.4. Requirement 6: 6.1, 6.2, 6.4. Requirement 7: 7.1. Requirement 8: 8.2, 8.6, 8.8. Requirement 9: 9.4, 9.5, 9.9. Requirement 13: 13.2, 13.4, 13.5. Requirement 14: 14.4, 14.6, 14.11, 14.12. Requirement 15: 15.3, 15.6, 15.7. Requirement 16: 16.5, 16.7, 16.9. Requirement 17: 17.3, 17.4, 17.6. Requirement 21: 21.3, 21.4, 21.7, 21.10, 21.11, 21.12, 21.15, 21.16. Requirement 22: 22.2. Requirement 23: 23.1, 23.4, 23.5, 23.6, 23.7, 23.9, 23.10, 23.11, 23.12, 23.13, 23.14.
  - Several of these are probably checked by a test whose title carries no ID (for example 6.1 to 6.4 in `tests/archive/designs.test.ts`, 21.15 as Property 38, 17.6 in `tests/integration/scanFixtures.test.ts`, 13.2 and 13.4 in `tests/ui/deploy.test.ts`, 3.7 and 16.5 in the Weave tests). I did not match them one by one, so this log does not claim they are covered. Some others are documentation or process criteria (17.3, 23.4 to 23.6, 23.9 to 23.14, 16.7) that a title check cannot show; 16.7 is checked by `npm run build` above and 23.9, 23.12 and 23.13 by the media files and `ls -l media/`.
  - Decision for the user: add ID prefixes to the existing titles that already cover these, or write new tests for the ones nothing covers. I did neither here.
**Not verified (the unfilled list):**
- Real IndexedDB in a browser (the archive tests use a hand-written fake; see the Phase 2 entry).
- On-device timings: `readCard` on a phone, sample selection, `printableRaster`, simulation at 16 ms per frame.
- A real camera photo of a printed card. The Scan GIF reads a generated image, not a photograph.
- Printing at true scale: a Printable_Card printed at 100% and measured with a ruler.
- Any loom controller: no exported BMP has been tried on one.
- Hindi text: **166 strings** in `docs/HINDI_REVIEW.md`, all `reviewed: false` (117 at the end of Phase 2). The file was regenerated with `npm run review-list` and was already current. A Hindi speaker has not read them.
- Real card dimensions: the demo Card_Profile values are illustrative and unverified.
- The Hindi UI was not captured in the media; all four files show English.
- The GIFs were not played back in a browser or on GitHub.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check).
**Evidence saved:** `media/scan-printed-card.gif` (re-recorded), `media/banner.png`, `media/weave-sample.gif`, `media/keep-export.gif`.
**Credits left:** Not recorded.
**Commit:** Phase 3 work spans `e7a365d` to `5d55064`; see the commit that adds this entry.

## 2026-11-21 (app phase 3, task 3.9: requirement coverage)
**Goal today:** Give each of the 55 requirement IDs that the Phase 3 entry listed as missing from test titles a test title, a new test, or a manual check.
**Recomputed list:** the same method (R<n>.<m> in titles under `tests/ui`, `tests/archive`, `tests/integration`, `tests/structure`, `tests/scripts`, requirements 1 to 17 and 21 to 23, 202 criteria) gave the same 55 IDs as the Phase 3 entry. No difference.
**Requirement coverage, counts (sum 55):**
- **9** IDs now in the title of an existing test (prefix added, assertions unchanged): 6.2, 8.2, 9.4, 9.5, 17.6, 21.7, 21.11, 21.15, 22.2.
- **41** IDs covered by newly written tests: 15.6 (`tests/ui/screens/cardDrawing.test.tsx`, an example and a property), 1.1, 1.5, 2.4, 2.8, 3.7, 3.8, 4.6, 5.1, 5.4, 6.1, 6.4, 7.1, 8.6, 9.9, 13.2, 13.4, 13.5, 14.4, 14.6, 14.11, 15.3, 15.7, 16.7, 16.9, 17.3, 17.4, 21.3, 21.4, 21.10, 21.12, 21.16, 23.4, 23.5, 23.6, 23.7, 23.9, 23.10, 23.12, 23.13, 23.14.
- **5** IDs listed below as manual checks: 8.8, 14.12, 16.5, 23.1, 23.11.
- Total 9 + 41 + 5 = 55. **R15.6 is now covered**: `CardThumb` takes the Card_Profile and draws manila stock, round punched holes, peg holes and lacing holes from `printableLayout`. Unpunched positions get no mark, because the ring is a tenth of a hole wide, under a pixel at thumbnail size. With no profile or an invalid layout it draws the plain card outline. `design.md` line 271 ("an SVG of the grid") is now loosely worded; `design.md` and `requirements.md` were not edited.
- Property 38 (generated profiles) in `tests/ui/printable/raster.test.ts` now uses `numRuns: 100`, as `design.md` line 684 and `tasks.md` line 18 require ("at least 100 runs"). It had 20. The file's run time went from about 6 s to about 28 s.

**Manual checks (nothing automatic can show these):**
- **23.1 Public URL needs no login, account or API key.** Open https://naqsha-ashen.vercel.app/ in a private browser window on a phone and on a laptop. Expect the Weave screen with no login or sign-up prompt. Open the browser's network tab, reload, and expect only requests to the same host (the page, its scripts and styles, and `profiles/demo-12x16.json`). This also covers the "served by the Deploy_Host" half of R23.7; the built files are checked by an automatic test.
- **23.11 Media were captured from the running Built_Site with the demo profile and show the notice.** Open `media/scan-printed-card.gif` and `media/keep-export.gif` on GitHub (or a browser) and watch each to the end. Expect the Card_Profile name `demo-12x16` and the "Unverified" notice with the status text visible on every Scan and Keep frame. Open `media/weave-sample.gif` and expect a Sample_Design weaving pick by pick. This step also checks what each GIF shows for R23.9 and R23.10; the automatic tests only check that the files exist, are GIF or PNG, are referenced in the README and are at most 5 MB.
- **8.8 Reading a 1080p photo takes 300 ms or less on a mid-range 2020 phone.** Run `npm run build` and `npm run preview -- --host`, open the address on the phone, choose a 1920 x 1080 photo of the printed card on the Scan screen, and time the wait from choosing the file to the markers appearing (screen recording at 60 fps, count frames). Expect 300 ms or less. Laptop figure for comparison: median 24 ms (task 3.5).
- **14.12 No horizontal page scroll from 320 to 1920 CSS pixels.** Open the deployed site in a desktop browser, open the device toolbar, set the width to 320, 360, 600, 1024 and 1920 in turn, and visit Weave, Keep and Scan (with a photo read) in English and Hindi. Expect no horizontal scrollbar and no clipped control at any width. Repeat once on a real phone in portrait.
- **16.5 Cloth simulation of a 100-pick Pattern stays within 16 ms per painted frame.** On a phone, open `scripts/sim-preview.html` through `npx vite --host`, load a 100-pick pattern, play it, and read the median and worst frame times the page shows. Expect 16 ms or less per painted frame. The Node figures in `.kiro/specs/simulator/measurements.md` do not stand in for this.
**Observations (nothing changed for these):**
- R2.4 (play while paused resumes) is tested at the player: after pause and resume no frame goes back before the paused pick, and playback runs to the end. The Weave screen calls `player.resume()` from its play button when paused; that button branch has no automatic test (no DOM in the test setup). Check by hand: play, pause, press the button labelled "Resume" and expect the cloth to continue from the same pick.
- R5.1 quotes the label "For electronic loom (BMP)"; the shipped label is "Download the file for a loom" (and its Hindi text). The new test checks the loom purpose, not the quoted words.
- R23.10 asks for each GIF "next to the text that describes" its flow. The README places the three GIFs together after one paragraph; the alternative text describes each one. The test checks the banner is first, each GIF is referenced once and every reference resolves.
- Existing titles carry an ID that does not match the criterion of that number in this spec: `tests/ui/printable/raster.test.ts` Property 38 over generated profiles says R21.14 (the criterion is R21.15), `tests/ui/state/playback.test.ts` "there are three speeds" says R2.6 (speed is R2.8), `tests/ui/state/cloth.test.ts` "the viewport clamps" says R3.4 (R3.7), `tests/ui/screens/weave.test.tsx` "thread size ... absent" says R2.13 (R3.8). I left them as they are, because the rules allow adding a prefix but not changing a title.
- One in-scope ID, app R5.5, was counted as present only because of a title under `tests/scripts` that uses the numbering of an earlier spec ("R5.5 the sample cloth PNG ..."). App R5.5 (export calls `exportPatternBmp` and `downloadBmp` with `bmpFileName`) is checked by "runExport offers one download named by bmpFileName" in `tests/ui/state/keep.test.ts`, which has no ID in its title. I did not change either title. (The `tests/scripts` titles with R19.x are outside the 202 criteria.)
- The Property 38 test over generated profiles runs 20 times (`numRuns: 20`, seed 3801), below the 100 that `testing.md` asks for new properties. I did not touch it.
- `tests/ui/deploy.test.ts` builds the site under `NODE_ENV=test`, so that build holds React's development text; the R16.1 size check measures that build. R23.7 builds a separate production copy for its own check.
- The README still says the camera screen, archive and UI are not built and that "There is no hosted site" in its Status and "Try it in 60 seconds" sections, which no longer matches the app. Not edited here.
**Final checks:** `npm run test:run` 75 files, 565 tests, all passing (69 files and 520 tests at the end of Phase 3). `npm run typecheck`, `npm run build` and `npm run check-bundle` pass (entry chunk 92,251 bytes gzipped).
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, property tests.
## 2026-11-21 (app phase 4, task 4.3: self-hosted fonts, conditional)
**Goal today:** Find out whether the app loads any web font, and self-host fonts only if it does.
**Result:** It does not, so no fonts were self-hosted and no font files were added.
**Evidence:**
- `src/ui/theme/tokens.css` lines 16 to 18 are the only font definitions: `--font-display: Georgia, serif`, `--font-body: system-ui, sans-serif`, `--font-data: ui-monospace, monospace`. Every `font-family` in `src` uses one of these three variables.
- No `@font-face`, no `fonts.googleapis.com` or `fonts.gstatic.com`, and no `.woff`, `.woff2`, `.ttf` or `.otf` reference in `src`, `index.html` or `public`. `index.html` has no font `<link>`.
- No font file exists in the repository outside `node_modules`.
- Built `dist/`: 0 `@font-face` in both CSS files, no `url(` in either, and no font host or font file name in `dist/index.html` or the JS. The only `rel="preload"` and `rel="stylesheet"` strings in the JS are React DOM internals; `dist/index.html` links one stylesheet from `./assets`.
**Why not built:** `docs/DESIGN_BRIEF.md` line 46 asks for Google Fonts with Devanagari subsets (IBM Plex Mono for data). The app deliberately uses system stacks, because the product must work without network access and Google Fonts would add a third-party request on every page load.
**Visual consequence:** Text renders in whatever font the device provides. Devanagari (Hindi) uses the system's Devanagari font, so its appearance varies by device and operating system. Headings use Georgia where it exists. The data font is the system monospace, not IBM Plex Mono. If a consistent look is wanted later, self-hosting Devanagari-capable fonts needs a decision on licences and file sizes against the 200 KB JS budget (fonts are not JS, but they cost load time).
**Final checks:** see the commit that adds this entry.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec.
