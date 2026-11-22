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
## 2026-11-21 (app phase 4, task 4.4: dropped features)
**Goal today:** Record which Phase 4 extras were not built, and the known gaps in the one that was (the rise from darkness, task 4.2). No behaviour changed.
**Dropped by the user's choice:**
- **Hindi voice prompts (Requirement 19).** The user chose to drop them.
- **Night loom theme (Requirement 20.5).** The user chose to drop it.
**Left out in the trim (not dropped by choice):** The user asked for only the rise-from-darkness extra, so these were not built.
- **Hole pop (R20.1).**
- **Thread-drawn progress (R20.3).**
**Night loom tokens (checked in the code):** The tokens still exist in `src/ui/theme/tokens.css` under `[data-theme='night']` (line 24), and `src/ui/theme/contrast.ts` still has a `night` palette and contrast pairs. Nothing switches to them: a search of `src` and `index.html` finds no `data-theme` outside `tokens.css`, so the app always uses the Day loom. The tokens are unused.
**Open accessibility gap (from task 4.2):** The skip control is rendered only while the rise is running (`RiseSkipControl` in `src/ui/screens/weave/WeaveScreen.tsx`). After it is used it disappears, so keyboard focus falls back to the page. This is **open, not fixed**. A fix is not a small change here: the Play button is disabled while the cloth is playing, so the target would have to be the Pause button or the cloth wrapper (which needs a ref and a tabindex), and the project's tests run in a Node environment with no DOM, so focus cannot be tested without adding a test dependency. I did neither.
**Judgement call from 4.2:** A manual step or scrub ends the rise (`seekTo` dispatches `seek` to `riseReducer`). This was chosen in task 4.2; the requirements do not say it.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec.
## 2026-11-21 (app phase 4, task 4.5: Phase 4 summary)
**Goal today:** Record what Phase 4 built, checked and left out, from the commits after `fb74897` (`git log fb74897..`), and list what nobody has verified.
**Commits in range:** `390524a` (task 3.9 tests and log), `f352bf3` (CardThumb fix), `a4e2617` (live camera), `65efbf2` (fonts log), `024e767` (rise from darkness), `4da9ccc` (dropped features log). `dce5d2d` only marks Phase 3 tasks complete.
**Built:**
- **Live camera, task 4.1 (R18), `a4e2617`.** A live camera option on the Scan screen. `src/ui/screens/scan/camera.ts` holds the camera logic (failure kinds `denied`, `no-camera`, `failed`; stopping every track), `LiveCamera.tsx` the view, and `src/ui/platform/browser.ts` the browser hookup. It sits in the lazy Scan chunk. Tests use a fake camera (`tests/ui/screens/liveCamera.test.tsx`, `tests/ui/platform/browser.test.ts`). 12 new Hindi strings.
- **Rise from darkness, task 4.2 (R20.2, R20.4), `024e767`.** The first weave of a loaded design rises from darkness, with a skip control shown only while the effect runs. State logic is in `src/ui/state/playback.ts` (`riseReducer`, `riseLevel`, `riseFraction`). With reduced motion on, the effect does not start (the reducer takes `reducedMotion`; its look and the toggle have not been seen on a screen).
**Checked and not built:**
- **Fonts, task 4.3.** The app loads no web font (system stacks in `src/ui/theme/tokens.css`), so no font was self-hosted. Details are in the task 4.3 entry.
- **Dropped features, task 4.4.** Hindi voice prompts (R19) and the night loom theme (R20.5) were dropped by the user. Hole pop (R20.1) and thread-drawn progress (R20.3) were left out in the trim. The night tokens exist but nothing switches to them. Details are in the task 4.4 entry.
**Defect found by task 3.9, fixed in `f352bf3`:** R15.6 says a punch card is drawn with manila stock, round holes, peg holes and lacing holes wherever one appears. `CardThumb` (`src/ui/screens/scan/BatchList.tsx`) drew only a rectangle and one disc per punched hook, and had no Card_Profile input. Task 3.9 wrote a failing test and stopped on that ID. The fix: `CardThumb` takes the Card_Profile and draws from `printableLayout`; unpunched positions get no mark; with no profile or an invalid layout it draws the plain outline. New test `tests/ui/screens/cardDrawing.test.tsx` (an example and a property). `design.md` line 271 ("an SVG of the grid") is now loosely worded; `design.md` and `requirements.md` were not edited.
**Property 38 raised from 20 to 100 runs (`f352bf3`):** `tests/ui/printable/raster.test.ts`, `numRuns: 20` to `numRuns: 100`, seed 3801 unchanged. `design.md` line 684 and `tasks.md` line 18 ask for at least 100. The file went from about 6 s to about 28 s (about 22 s more); I did not re-time it in this task. This replaces the note in the task 3.9 entry that said the property still ran 20 times.
**One edited test, needs the user's confirmation:** `tests/ui/structure.test.ts` (in `a4e2617`). The old assertion said no file in `src/ui` mentions `getUserMedia` or `mediaDevices`. It is now: the only file that does is `ui/screens/scan/camera.ts` (sorted list equals that one path). This is a narrowing of what the test allows, made because R18 needs the camera API. It is stricter than "anywhere in `src/ui`" only in that it pins the file. Please confirm the change is acceptable; if not, revert that hunk and the camera needs another design.
**Manual coverage list from task 3.9 (still manual, not run by me):** R23.1 public URL needs no login or key; R23.11 media show the profile name and the "Unverified" notice; R8.8 1080p read within 300 ms on a mid-range 2020 phone; R14.12 no horizontal scroll from 320 to 1920 px; R16.5 100-pick simulation within 16 ms per frame on a phone. Steps are in the task 3.9 entry. Also by hand: the Resume button after pause (R2.4).
**Sizes (`npm run build`, `npm run check-bundle`):**
- Entry chunk `index-CYTYaTQc.js`: 93,124 bytes gzipped (310.27 kB raw). Limit 204,800. It was 92,251 at the end of task 3.9.
- Scan chunk `ScanScreen-fWL-CVEZ.js`: 9,118 bytes gzipped (27.32 kB raw), plus 1.12 kB gzipped CSS. The Scan chunk had no figure in earlier entries.
**Final checks:** `npm run test:run`: **77 files, 589 tests, all passing** (75 files and 565 tests at the end of task 3.9). `npm run typecheck`, `npm run build` and `npm run check-bundle` pass.
**Hindi review:** `npm run review-list` regenerated `docs/HINDI_REVIEW.md` with no change, so it was already current. **178 strings unreviewed** (166 at the end of Phase 3). No Hindi speaker has read them.
**Not verified (needs the user's hand test):**
- Live camera on a real phone: permission prompt, denial, no camera, back camera choice, stopping the camera when leaving the screen. Only a fake camera was tested.
- Real IndexedDB in a browser (the archive tests use a hand-written fake).
- Printing a Printable_Card at 100% and measuring it with a ruler.
- A real photo of a printed card read by the Scan screen. All reader tests use generated images.
- The rise-from-darkness look, and the reduced-motion toggle (that the effect is skipped with the system setting on).
- Keyboard focus after the skip control is used. This gap is open, as recorded in the task 4.4 entry; the control disappears and focus falls back to the page.
- On-device timings: `readCard`, `printableRaster`, simulation at 16 ms per frame, the rise effect.
- Any loom controller: no exported BMP has been tried on one.
- Hindi text, including the 12 strings added for the camera and the rise.
- Real card dimensions: the demo Card_Profile values are illustrative.
- Also still open from earlier entries: the README's Status section still says the camera screen, archive and UI are not built and there is no hosted site; the GIFs were not played back in a browser.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check).
**Credits left:** Not recorded.
**Commit:** Phase 4 work spans `390524a` to `4da9ccc`; see the commit that adds this entry.
## 2026-11-20 (app phase 6, task 6.1: fixes)
**Goal today:** Close the four open items from the Phase 4 entries: the structure test, four wrong test IDs, the stale README, and the Skip focus gap.
**(a) Structure test accepted, 2026-11-20:** The user accepted the edit to `tests/ui/structure.test.ts` made in `a4e2617`. The rule as written in the test: only `src/ui/screens/scan/camera.ts` may mention `getUserMedia` or `mediaDevices` (the sorted list of `src` files that do equals `['ui/screens/scan/camera.ts']`). The working tree had no further change to that file, so `git diff` showed nothing and the committed text was read instead. The edit is accepted, not reverted.
**(b) Test IDs corrected (only the ID in each title changed; bodies, seeds and `numRuns` are untouched):**
- `tests/ui/printable/raster.test.ts`, Property 38 over generated profiles: R21.14 to R21.15 (R21.15 is the Sample_Design round trip). The demo-profile test beside it already says "R21.14 R21.15", so no title is duplicated.
- `tests/ui/state/playback.test.ts`, "there are three speeds": R2.6 to R2.8 (R2.8 is the speed control).
- `tests/ui/state/cloth.test.ts`, "the viewport clamps to 1..4096": R3.4 to R3.7 (R3.7 is the viewport limit).
- `tests/ui/screens/weave.test.tsx`, "thread size, float highlight ... absent": R2.13 to R3.8 (R3.8 hides those controls).
**(c) README:** Removed every "coming" and "no app screen yet". The intro, the "What it does" table, "Why it matters", the Kiro table, "Architecture" and "Credits" now state what exists. The README says the Hindi text is unreviewed, the live camera is untested on real devices, no loom controller is tested, the archive was tested only with a fake store, and the Card_Profile is illustrative and unverified. The live URL is in the intro. "Why it matters" says no weaver has tested the app yet. The Architecture section is text only; no diagram was drawn.
**(d) Skip focus gap: closed in code on 2026-11-20.** `focusTargetAfterSkip` and `focusAfterSkip` are in `src/ui/state/playback.ts`: Pause while playing, Play when idle, paused or finished (Pause is disabled unless playing, so it is never the target then). `WeaveScreen` holds refs to the Play and Pause buttons and calls `focusAfterSkip` in the skip handler before dispatching `skip`, while the target is enabled. The skip control still renders only while the rise runs and never under reduced motion, so that behaviour is unchanged. Tests (`tests/ui/state/playback.test.ts`): examples, a property over every playback status, and a property that exactly the chosen control receives `focus()` (fakes, no DOM). This closes the gap recorded in the task 4.4 entry; the "Keyboard focus after the skip control is used" line in the Phase 4 not-verified list is superseded.
**Still needs a real browser:** that focus actually lands on Pause or Play after a click or a keyboard activation of Skip, that a screen reader announces it, and that the wiring has no timing problem on Safari. The tests run in Node with no DOM, so they check the choice of target and that `focus()` is called on it, not that the browser moves focus.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, property tests (fast-check).
**Final checks:** `npm run test:run`: 77 files, 592 tests, all passing (589 before; 3 new focus tests). `npm run typecheck`, `npm run build` and `npm run check-bundle` pass. Entry chunk 93,203 bytes gzipped (limit 204,800); Scan chunk 9,120 bytes gzipped.
## 2026-11-21 (app phase 6, task 6.3: `npm run check:browser`)
**Goal today:** A script that drives a real headless Chrome through the built app and reports PASS or FAIL for twelve steps.
**Dependency decision:** none added. The DevTools client is about 150 lines over Node's built-in `WebSocket` (`scripts/checks/cdp.ts`), the preview server is `vite preview` through Vite's own `preview()` API (Vite is already a dev dependency), and the blank PNG uses the existing `scripts/png_rgba.ts`. Chrome is found by `scripts/checks/chrome.ts` (macOS, Linux, Windows paths, `CHROME_PATH` first) and started with `--remote-debugging-port=0`; the port is read from `DevToolsActivePort` in a temporary profile directory.
**What it checks:** (1) title, visible Weave heading, no console errors on load; (2) hi/en switch changes the heading, navigation text and `<html lang>`; (3) each Try it sample plays: the pick counter advances through every value to 36 of 36 and the cloth canvas has opaque pixels and several colours; (4) Keep saves a design with a name and place; (5) it is still listed after a hard reload (cache ignored); (6) Open shows the same finished cloth (canvas hash equals the Floral cloth played in step 3); (7) Delete asks first, removes it, and it is still gone after a reload; (8) 1-bit and 8-bit BMP downloads are parsed directly (width 192 = ends, height 36 = picks, bits per pixel, colour count, colour table entries, declared and real file size), read back with `readPatternBmp` and compared byte for byte with `exportPatternBmp`; (9) the Diamond printable card PNG is 720x540 with one `pHYs` chunk of 12000 x 12000 per metre, unit metre, CRCs valid; (10) that PNG uploaded on Scan reads to the same grid as the sample pick; (11) a blank PNG gives the peg-holes-not-found message, no markers, and the batch and the Weave cloth are unchanged; (12) `scrollWidth <= innerWidth` on Weave, Keep and Scan at 320, 390 and 1280 px, with a read card open on Scan.
**Script bugs found while writing it, fixed in the script, none in the app:** DOM nodes returned by value come back empty, so waits use `!!`; the Hindi dictionary entries are `{text, reviewed}` objects; a design opened from Keep is shown finished at once (the Weave screen mounts with a pattern) so no playback is awaited; the canvas is measured only after two reads agree, because the counter reaches the last pick slightly before the last frame is drawn; step 10 prints pick 6 of the Diamond, not pick 1, since pick 1 has no lifted ends and an all-empty read would pass.
**What it cannot check:** a real phone camera, real card photos, print scale, Hindi wording, a loom controller, or any browser other than Chrome.
**Tests:** `tests/scripts/bmpHeader.test.ts` (BMP header parse against `bmpLayout` and `readPatternBmp` over generated profiles, patterns and options; PNG `pHYs` parse against `withPixelDensity`), `chrome.test.ts`, `cdp.test.ts`, `report.test.ts`. Properties use fixed seeds and 100 runs. No test was weakened or removed.
**`media/check/`** is in `.gitignore`; `git check-ignore` shows the tracked files under `media/` are not matched.
## 2026-11-21 (app phase 6, tasks 6.1 to 6.6: fixes and verification scripts)
**Goal today:** Fix the open items from Phase 4, then add five commands that check the project: `check:all`, `check:browser`, `check:deployed`, `check:manual` and `check:everything`. The README documents them under "Verify it yourself".
**6.1 fixes:** the structure test edit was accepted; four wrong requirement IDs in test titles were corrected (titles only); the stale README text was rewritten; focus after Skip is now handled in code (`focusAfterSkip`). Details are in the task 6.1 entry above.
**The five scripts:**
- `check:all`: typecheck, test suite, build, bundle check, spec format validators (SKIPPED, the repo has no command for them), and hygiene (LICENSE, `.kiro` not ignored, `.kiro` directories, no secrets in tracked files, README placeholder wording, git state as INFO). Cannot check: anything that needs a browser, the network or a person.
- `check:browser`: twelve steps in headless Chrome over the built `dist/` (see the task 6.3 entry). Cannot check: a real phone camera, real card photos, print scale, Hindi wording, a loom controller, or any browser other than Chrome.
- `check:deployed`: HTTP 200 and no login page, page title, JS and CSS assets, `profiles/demo-12x16.json` through `parseCardProfile`, and the response headers. Cannot check: whether the deployed code is the code on `main` (see below), or anything about how the page behaves.
- `check:manual`: an interactive walkthrough that writes `docs/MANUAL_TEST_RESULTS.md`. It needs a person and a phone, so I have not run it.
- `check:everything`: runs the first three in order, then `check:manual` only with `--manual`. Every stage runs even if an earlier one fails, unless `--bail`. It prints PASS, FAIL or SKIPPED with each exit code and exits non-zero if any stage failed. A stage that cannot start (for example Chrome missing, where `check:browser` exits non-zero with its message) shows as FAIL with that message. `--url <url>` is passed to `check:deployed`. The orchestration is in `scripts/checks/everything.ts` over an injected runner; `scripts/check_everything.ts` only spawns the processes.
**Dependency decision:** none added in Phase 6. The DevTools client is built on Node's built-in `WebSocket`, the preview server uses Vite's own API, and `check:deployed` uses Node's `fetch`.
**Found by `check:browser` step 1:** the page requests `/favicon.ico` and gets 404, so step 1 (no console errors on load) FAILS; the other eleven steps pass. Status: open until 6.7. The fix is not made in 6.6.
**Found by `check:deployed`:** the deployed `index.html` references `assets/index-CYTYaTQc.js`; a local `npm run build` gives `assets/index-DIpFeFC9.js` (the CSS name `index-1dD1MI1L.css` matches). The script cannot say which commit is deployed, so I only know the JS differs from my local build. The deploy may be behind `main`. Not confirmed; to be checked in 6.7.
**Judgement calls:** the property tests for the manual steps carry an "R23.1" prefix in their titles (for example "R23.1 findStep finds every step by its id in any letter case"), although they test the walkthrough data rather than R23.1 itself. I chose R23.1 because the testing steering wants a requirement ID in every title and the manual steps are listed under the R23.1 coverage entry; a different ID may be more exact. The same applies to the R16.7 prefix on the `check:everything` tests. Measured run times in the README are single runs on one laptop: `check:all` about 37 s, `check:browser` about 58 s, `check:deployed` under 1 s.
**What remains manual:** live camera on a real phone, printing at 100% and measuring, a real card photo, the rise-from-darkness look and reduced motion on a real device, IndexedDB in browsers other than Chrome, native Hindi review, any loom controller, and the five items R8.8, R14.12, R16.5, R23.1 and R23.11.
**Tests:** `tests/scripts/everything.test.ts`: properties with seed 20240613 and 200 runs (stage order always all, browser, deployed, manual; manual present exactly when `--manual`; every stage runs without `--bail`; exit code non-zero if and only if a stage failed; `--bail` stops after the first failure), plus examples for argument parsing, `--url`, a throwing runner and the summary. No test was weakened or removed.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, property tests (fast-check).
## 2026-11-21 (app phase 6, task 6.7: real runs, favicon fix)
**Goal today:** Run `check:all` and `check:browser` for real, fix what they find, commit and push.
**First `check:browser` run:** 10 passed, 2 failed. Step 1 FAILED: `Failed to load resource: the server responded with a status of 404 (Not Found) http://127.0.0.1:54141/favicon.ico`. Step 11 also FAILED: `the pick counter did not reach 36 of 36 within 60000 ms (values seen: none)`. Step 1 is a real app bug: `index.html` had no favicon link and `public/` had no favicon, so the browser asked for `/favicon.ico` on every load. `check:all` passed (PASS 9, FAIL 0, SKIPPED 1, INFO 1).
**Fix, in the app and not in the check:** `public/favicon.svg` (a small woven check mark in the Day loom indigo, zari and ground colours from `tokens.css`, no text, no external URL) and `<link rel="icon" type="image/svg+xml" href="./favicon.svg" />` in `index.html`. The path is relative, so it works with `base: './'` and from the static site. `dist/favicon.svg` exists after `npm run build`, and `npm run check-bundle` still passes (no `src` or `href` starting with `/` or `http`). Step 1 and the check scripts were not changed.
**After the fix:** `check:browser` 12 passed, 0 failed on the next run and again on a third run. Step 11 passed in both. I did not find the cause of the one step 11 failure on the first run: it failed while reading the Weave counter before the blank-image upload, it did not repeat in two later runs, and I changed nothing for it. It may be a timing flake in that wait; treat it as unexplained. `check:all` passed again.
**`check:deployed`:** passes 4 of 4, but the deployed JS is `assets/index-CYTYaTQc.js` and the local build is `assets/index-DIpFeFC9.js`. The hashes differ, so the deployed app is not shown to match this build.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check).
## 2026-11-22 (app phase 7, task 7.1: `check:browser` step 11 flake)
**Goal today:** Find out why step 11 failed once with `the pick counter did not reach 36 of 36 within 60000 ms (values seen: none)`, and fix it without a longer timeout.
**Runs.** Baseline: 10 runs of the unchanged check (`/tmp/naqsha-flake/run-N.txt`). After: 10 runs of the changed check (`/tmp/naqsha-flake/after/run-N.txt`). Every run exited 0 and printed `12 passed, 0 failed`; no FAIL line in any of the 20 runs.

| Step | Baseline PASS (of 10) | After PASS (of 10) | Failure text |
|---|---|---|---|
| 1 app loads | 10 | 10 | none |
| 2 language switch | 10 | 10 | none |
| 3 play the three Try it samples | 10 | 10 | none |
| 4 Keep: save | 10 | 10 | none |
| 5 hard reload | 10 | 10 | none |
| 6 open the saved design | 10 | 10 | none |
| 7 delete with confirmation | 10 | 10 | none |
| 8 export 1-bit and 8-bit BMP | 10 | 10 | none |
| 9 printable card PNG | 10 | 10 | none |
| 10 upload that PNG on Scan | 10 | 10 | none |
| 11 blank image, batch and pattern unchanged | 10 | 10 | none |
| 12 no horizontal scroll | 10 | 10 | none |

**Reproduction attempts (one-off copy of the original check in `/tmp/naqsha-flake/exp`, not committed; only change was `Emulation.setCPUThrottlingRate` from `THROTTLE`).**
- CPU throttle 4, 8 and 16, one run each: 12 passed, 0 failed each time.
- Six runs in parallel at throttle 6: 12 passed, 0 failed in all six.
- Hidden or background tab (throttled `requestAnimationFrame`): not tried.
- Result: **the failure was not reproduced** in 10 + 10 plain runs, 3 throttled runs and 6 parallel throttled runs.

**What I did observe.** With a `MutationObserver` on the page, the pick counter text on each arrival at Weave was (one line per arrival, 11 arrivals in one run): `Pick 0 of 0` or `Pick 36 of 36` when the cloth is already built, and `["Pick 1 of 36", "Pick 36 of 36"]` six times, so for one render the counter reads "Pick 1 of 36" before the mount effect seeks to the end (`WeaveScreen.tsx`, `player.seek(count)` after the first render with a built cloth). Final state is always right.
**Cause (a reading of the code and the observation, not a reproduced failure).** In the old `playToEnd`, `seen` only started filling when a read had `pick < total`, and the wait returned only when `seen` was non-empty. Step 11's `weaveSignature` reads the counter once and calls `playToEnd` if `pick < total`. If that one read lands on the one-render `Pick 1 of 36` and the next read in `playToEnd` is already `Pick 36 of 36`, `seen` stays empty, the wait can never finish, and it times out with `values seen: none`. That matches the one failure text exactly. It needs a read to land in a window of one render, which fits a failure that appeared once. The wait was at fault, not the app: the final state is correct and nothing was lost. I did not change the app. The one-render `Pick 1 of 36` is a visible flicker in principle; I have not judged whether it is worth a separate fix.
**Fix in the check.** The wait is now a condition on state: done as soon as a read shows the last pick, whatever was read before (`stepPickWatch` in `scripts/checks/pickWatch.ts`, pure). Timeouts are unchanged (150 s default, 60 s in step 11). Nothing step 11 asserts was loosened: the message text, the batch size, the Weave counter and canvas hash (`after === before`) are checked as before. Step 3 still requires at least three increasing counter values, so a counter that does not advance still fails there. On timeout the error now adds the last counter text, the screen title, the counter, the Play and Pause disabled state, whether a canvas exists, the page visibility, the console errors and a screenshot written to `media/check/failure-pick-counter-36.png` (`media/check/` is git-ignored).
**Tests.** `tests/scripts/pickWatch.test.ts`: three examples (first pick to last between two reads; first read at the last pick; not finished before the last pick) and one property (finished exactly when some reading with the right total is at the last pick; seed 71101, 200 runs). These are tests of the new wait. No test was weakened or removed.
**Verification:** `npm run test:run` 709 passed (the first run had two 5 s timeouts, `tests/reader/readCard.test.ts` and `tests/simulator/render.test.ts`, while the machine was loaded after the parallel experiment; the next run passed 89 files, 709 tests, and I changed no timeout), `npm run typecheck`, `npm run build` and `npm run check-bundle` (93203 bytes gzipped, limit 204800) pass.
**Root cause:** not reproduced; most likely the wait described above.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check).
## 2026-11-22 (app phase 7, task 7.2: hooks evidence)
**Goal today:** Make each hook in `.kiro/hooks` leave one log line when it fires, and a command that reports from the real log only.
**Hooks found (exact):** both are in `.kiro/hooks/*.json`, schema `"version": "v1"`, trigger `PostFileSave`, action type `command`, no agent prompt.
| File | Name | Matcher (regex on the saved file path) | Command (now) | Timeout |
|---|---|---|---|---|
| `test-on-save.json` | `Related tests and typecheck on save` | `(^|/)(src|scripts)/.+\.(ts|tsx)$` | `sh -c 'node .kiro/hooks/bin/related-tests.mjs; s=$?; node scripts/log_hook.ts "<name>" "exit $s"; exit $s'` | 10 s |
| `fixtures-on-profile-change.json` | `Regenerate fixtures on profile or generator change` | `(^|/)(public/profiles/[^/]+\.json|scripts/make_fixtures\.ts)$` | `sh -c 'sh .kiro/hooks/bin/check-fixtures.sh; s=$?; node scripts/log_hook.ts "<name>" "exit $s"; exit $s'` | 60 s |
`.kiro/hooks/bin/` holds the two scripts the commands call (not hooks).
**Mechanism.** The action is a shell command, so the command appends the line itself: after the real work it runs `node scripts/log_hook.ts <hook-name> "exit <status>"` and then exits with the original status, so the hook result is unchanged. The line format (`<ISO timestamp>TAB<hook name>TAB<result>`) is in `scripts/checks/hooksLog.ts` only. Log file: `logs/hooks.log`. `git check-ignore -v logs/hooks.log` prints `.gitignore:11:logs/	logs/hooks.log`.
**Schema check.** Fields used (`version`, `hooks[].name`, `description`, `trigger`, `matcher`, `action.type`, `action.command`, `timeout`) match the Kiro hooks documentation (https://kiro.dev/docs/hooks/, fetched today) and the existing files. No field was added. The docs also list an optional `enabled` field (default true) which these files do not set.
**Known limit.** A line is written only if the command runs to the end. If Kiro kills the command at its timeout, no line is written. `Related tests and typecheck on save` has a 10 s timeout and runs Vitest related tests plus `tsc --noEmit`, which may take longer; I did not time it or change the timeout. A missing line for that hook may mean a timeout, not a hook that did not fire.
**`npm run check:hooks`** (`scripts/check_hooks.ts`, read-only): prints the last 20 log lines, then per hook `fired N times, last at T` or `never fired (no log line)`. A missing log file is the same as an empty one. Malformed lines are printed and not counted, and the exit code is 1 if any exist or a hook file cannot be read. Real output today:
```
last 0 line(s) of logs/hooks.log (no log file or it is empty):
hooks:
  Regenerate fixtures on profile or generator change: never fired (no log line)
  Related tests and typecheck on save: never fired (no log line)
```
**Did either hook fire?** No. I cannot fire a `PostFileSave` hook from a shell: it fires when the Kiro IDE saves a matching file. I wrote no log line by hand and no test touches `logs/`.
**How to trigger in the Kiro IDE.**
- `Related tests and typecheck on save`: save any `.ts` or `.tsx` file under `src/` or `scripts/` (for example edit and save `src/codec/types.ts`). Then run `npm run check:hooks`; the count should go from 0 to 1 (if the command finished within 10 s).
- `Regenerate fixtures on profile or generator change`: save `public/profiles/demo-12x16.json` or `scripts/make_fixtures.ts`. This regenerates `tests/fixtures/` (`git checkout -- tests/fixtures` discards a change). Then run `npm run check:hooks`.
- Saving `scripts/make_fixtures.ts` matches both matchers, so it should fire both hooks.
- The Kiro docs say hooks activate when a session starts; if a hook does not fire, start a new session.
**Agent Hooks panel.** From the docs: the IDE has an "Agent Hooks" section in the Kiro panel, with a `+` button to create a hook. Not verified (I cannot open the IDE from here, and the docs page does not say): the exact label of each entry (presumably the hook `name` above), how the enabled state is shown, whether a manual run button exists, and whether `PostFileSave` hooks show a fired indicator. Verified only in the repo: the files set no `enabled` field, which the docs define as default true.
**Tests.** `tests/scripts/hooksLog.test.ts`: examples for format and parse, malformed lines, an empty log, last lines and reading hook names; fast-check properties (seed 72002, 200 runs): format then parse round-trips; the per-hook count equals the number of lines with that name; malformed lines are reported and never counted; last-lines returns at most N lines, the last ones, in file order. The round-trip generator excludes tab and line break in names and results, because formatting replaces those by a space. `scripts/log_hook.ts` itself is not run in a test because it writes to `logs/hooks.log`.
**Verification:** `npm run test:run` 90 files, 719 tests passed; `npm run typecheck`, `npm run build` and `npm run check-bundle` (93203 bytes gzipped) pass.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, hooks, property tests (fast-check).

## 2026-11-22 (app phase 7, task 7.3: prerelease steering and offline step)
**Goal today:** A manual steering file that runs the pre-release checks, and a real "network off" step in `check:browser`.
**`KIRO_PROMPTS.md`:** does not exist. `git ls-files` lists no such file, and a filesystem search of the repository, `~/Desktop`, `~/Documents` and `~/Downloads` found none (a search of the whole disk timed out, so it is not ruled out outside those folders). So prompt 39 was not available, and the pre-release list is the user's: tests pass, `.kiro` not ignored, `LICENSE` exists, README run steps work from a clean clone, no API keys, the app loads with the network off, the build log is up to date. The steering file says so in its notes.
**Front matter source.** https://kiro.dev/docs/steering/ (fetched today): the block is YAML at the very top of the file between `---` lines; `inclusion: manual` makes a file available with `#steering-file-name` in chat, and the docs say manual files also appear as slash commands (type `/` in chat). The existing `.kiro/steering/card-geometry.md` uses the same block with `inclusion: fileMatch`. The docs do not say whether the slash menu shows the file name or a title. **Not verified in the IDE:** that `/prerelease-check` appears in the menu; I cannot open the IDE from here.
**Steering file.** `.kiro/steering/prerelease-check.md`, `inclusion: manual`. It tells the agent to run, in order, `npm run check:all`, `npm run check:browser`, a clean clone (`git clone` of the local repo into a temp dir, `npm ci`, `npm run build`, `npm run test:run`, remove the temp dir) and the build-log date comparison, to report PASS or FAIL with real output, never mark PASS without output and never weaken a check. It describes step 13 only as it now exists. I did not run `check:all`, the clean-clone item or the build-log item this time; the file was written, not exercised end to end.
**Step 13 "works with the network off"** in `scripts/check_browser.ts`; pure parts in `scripts/checks/offline.ts` (`offlineConditions`, `decideOffline`, `formatOffline`). `Network.enable`, `Network.setCacheDisabled {cacheDisabled: false}`, then `Network.emulateNetworkConditions {offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1}`.
- A (offline, then `Page.reload` without ignoring the cache): the app must be on screen, the network must be confirmed off (`navigator.onLine` false and a `no-store` fetch of the profile fails), Weave renders, a Diamond Try it plays to its last pick, language switching works. If the reload shows no app, the other four checks are reported NOT RUN, not PASS.
- B (site loaded online again, then offline, no reload): network confirmed off, Diamond Try it plays to its last pick, 1-bit BMP export with header parse, Scan read of the printable PNG equals Diamond pick 6.
- The step passes only if every check in A and B passes. Network is switched back online in a `finally`.
**Tests.** `tests/scripts/offline.test.ts`: 11 tests, five of them fast-check properties (seed 13013, 200 runs): the offline flag passes through and nothing else changes; the step passes exactly when there is a group and every check passed; one line per check that did not pass; a worse check never turns a failing step into a pass; a group prints as PASS exactly when it passes.
**Real result of `npm run check:browser` (once): 12 passed, 1 failed. Step 13 FAILS, and both failures are findings, not check bugs.**
- A FAIL: after `Page.reload` offline the load event fired on Chrome's error page: `location chrome-error://chromewebdata/`, page text "…ERR_INTERNET_DISCONNECTED", failed requests `http://127.0.0.1:<port>/ -> net::ERR_INTERNET_DISCONNECTED`. The site has no service worker, and the page itself is not served from cache on a reload, so a reload with no network shows no app. The other four A checks did not run.
- B: PASS network confirmed off; PASS Diamond Try it to 36 of 36; PASS 1-bit BMP export (`demo-12x16-1bit.bmp`, 192x36, 926 bytes); **FAIL** Scan read: "timed out after 15000 ms waiting for the scan screen". The INFO lines of the same run show why: `ScanScreen-BC2WebHd.js` and `ScanScreen-Baka5qIY.css` failed with `net::ERR_INTERNET_DISCONNECTED` and "Unable to preload CSS". The Scan screen is a lazy chunk (R16.10) fetched when Scan is first opened, and in B the page had not opened Scan before going offline. This is a tension between R13.1 (no request after Initial_Load) and R16.10 (Scan code loads on first open). Initial_Load is defined as the JavaScript for the first screen, so on a strict reading opening Scan for the first time offline is allowed to need the network; I did not decide that. Not tested: a Scan read after the Scan chunk has been loaded once, then offline (the check does not claim it).
- The step's failure message for the Scan check names only the timeout; the cause above comes from the INFO lines. I did not change the step after the run.
**Not fixed, on purpose.** A service worker or precaching would change what the app does and is not in this task. Options for the user: add a service worker that caches `dist/` (fixes A and B), or prefetch the Scan chunk after the first load (fixes B only), or amend R13.1 to say reload and first Scan open need the network.
**Verification:** `npm run test:run` 91 files, 730 tests passed; `npm run typecheck`, `npm run build` and `npm run check-bundle` (93203 bytes gzipped, limit 204800) pass.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check).
## 2026-11-22 (app phase 7, task 7.4: weave-reviewer agent and a real review)
**Goal today:** A workspace custom agent that reviews a diff for weaving terms, hard-coded card layout and missing property tests, and a real review of the app work.
**Kiro support (confirmed from the docs).** https://kiro.dev/docs/custom-agents/configuration-reference/ (fetched today; the old /docs/cli/... URL redirects there) says an agent is a JSON file or a Markdown file with YAML front matter (body is the system prompt), that workspace agents live in `.kiro/agents/` (global ones in `~/.kiro/agents/`), and lists the fields `name`, `description`, `tools`, `resources` (`file://` URIs), `permissions.rules`, `model` and others. There was no `.kiro/agents` folder before. I created `.kiro/agents/weave-reviewer.md` in that Markdown format: tools `read` and `shell`, shell limited to `git diff/log/show/status`, `grep`, `rg`, writes denied, resources the weaving glossary, card-geometry and testing steering files. **Not verified in the IDE:** that the agent appears in the agent picker and that the permission rules behave as written; I cannot open the IDE from here. I did not create the manual steering fallback because the format is documented.
**`KIRO_PROMPTS.md`:** does not exist (confirmed in task 7.3), so prompt 38 was not available; the agent's content follows the description in the task.
**How the review was run.** Not by the custom agent (it cannot be started from inside a sub-agent) and not by the `semantic_reviewer` sub-agent. I ran the checklist by hand with `git`, grep and throwaway Node scripts in /tmp (not committed). Base `a9830f0`, the commit before `f2a61a7` (task 1.1); `git diff a9830f0..HEAD -- src scripts tests` is 136 files, 17215 added lines. Full report: `docs/WEAVE_REVIEW.md`.
**Findings (nothing fixed).**
- **A, weaving terms:** 242 lines flagged, 7 real issues, 155 acceptable, 80 false positives. The real issues are `hole` and `cell` used as the name of a punched hole value: `src/ui/state/scan.ts:162,164` (`for (const hole of row)`, `if (hole)`), `scripts/time_read_card.ts:68` (`cell`), `tests/ui/printable/download.test.ts:43,57,59` (`cell`), `tests/ui/screens/scan.test.tsx:287` ("changes one cell"). The glossary has no word for "any hole", and `holes-overlap` (`src/codec/types.ts:44`) uses it. Another finding, against card-geometry.md rule 5 rather than a term: `scripts/check_browser.ts:647-650` computes the end index as `row * hookColumns + column` instead of using `endOrder`. The search covers only the listed words, so other synonyms are not found.
- **B, hard-coded layout:** 23 entries, 7 real issues, 13 acceptable, 3 false positives. Real: `scripts/check_browser.ts:612,613` (12 px/mm written again instead of `DEFAULT_PIXELS_PER_MM`), `:615` and `:667` (720 x 540 instead of the size computed from the profile), `scripts/checks/manualSteps.ts:50,52` ("60 mm by 45 mm" in the print step text), `tests/ui/screens/liveCamera.test.tsx:252` (`aspectRatio: 60 / 45`). Accepted, with the reason in the report: demo-profile pins in `tests/ui/printable/raster.test.ts`, `svg.test.ts`, `tests/scripts/bmpHeader.test.ts` (192 and 36 are repeated there and could be derived from the profile).
- **C, property tests:** 33 exported functions of `src/codec`, `src/exporter` and `src/simulator` checked; 32 are named inside a test that calls `fc.assert`. **`downloadBmp` (`src/exporter/download.ts`) has no property test**; `tests/exporter/download.test.ts` has three example tests with fakes for it. The structure test `tests/structure/propertyNames.test.ts` does not report this because `downloadBmp` is in its `EXCLUDED_FROM_COVERAGE` list, and the check it does make is weaker than "inside a property test": the name only has to appear in a file that contains `fc.assert`. `paintToCanvas` and `browserScheduler` are in the same exclusion list but do have property tests (`tests/simulator/canvas.test.ts:33` and `:71`).
**Verification:** `npm run test:run` 91 files, 730 tests passed; `npm run typecheck`, `npm run build` and `npm run check-bundle` (93203 bytes gzipped, limit 204800) pass.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** custom agent file, steering, spec, property tests (fast-check).
## 2026-11-23 (app phase 8, task 8.1: service worker, offline reload and installability)
**Goal today:** The app opens with no network after a reload, a new version never leaves a visitor on stale files, and the app is installable. No new dependency: `dependencies` are still `react` and `react-dom`.
**The worker.** `public/sw.js`, hand-written plain JavaScript, a classic worker script with no build step of its own. On `install` it fetches every precache entry once (`Request(url, {cache:'reload'})`, resolved against `self.registration.scope`) and puts it in the cache of the current version, rejecting if any entry answers not-ok, so a half-filled cache is never installed. On `activate` it deletes every cache whose name is not the current version, then calls `clients.claim()`. On `fetch` it serves a GET from the cache when it is there and otherwise goes to the network exactly once; a page navigation whose network request fails falls back to the cached start page. On `message` it calls `skipWaiting()` only for `naqsha:skip-waiting`. The logic is put on `self.naqshaServiceWorker` so a test can call it with fakes; the four `addEventListener` calls at the end are the only lines no test reaches, and the listeners they register are tested through the captured handlers.
**`ignoreVary: true`, found by a real run.** The first `check:browser` runs failed with every script and style sheet `net::ERR_FAILED` while the navigation itself was served. The diagnostic I added to the step printed the cause: `vite preview` answers with `Vary: Origin`, and the page asks for its own chunks with `crossorigin` (so the request carries an `Origin` the worker's own precache request did not), which makes `cache.match` miss. The lookup now passes `{ignoreVary: true}`: the precache is keyed by address, one build, one copy per file. A test pins the option so it cannot be dropped silently.
**Precache list, generated.** `scripts/build_precache.ts` runs as the last step of `npm run build` (`tsc --noEmit && vite build && node scripts/build_precache.ts`) and writes the block between `/* naqsha:precache-start */` and `/* naqsha:precache-end */` of `dist/sw.js`. The repository copy keeps placeholders (`naqsha-v1-placeholder`, `["./", "./index.html"]`). The real list of this build is 13 entries: `./`, the six `assets/` chunks and style sheets including the lazy `ScanScreen-*.js` and its CSS, `./favicon.svg`, both icons, `./index.html`, `./manifest.webmanifest`, `./profiles/demo-12x16.json`. Cache name `naqsha-v1-2e798d210557`: the format version plus a SHA-256 over every precached file's path and bytes, so a changed file gives a new cache name and new worker bytes even when no file name changed. Pure parts in `scripts/checks/precache.ts`. `tests/ui/deploy.test.ts` now runs `buildPrecache` on its temporary build, so the site it checks is the one a host would serve.
**Registration, dev server excluded.** `vite.config.ts` carries a small plugin that defines `__BUILT_SITE__` (`env.command === 'build'`), declared in `src/globals.d.ts`; the exported config object still has `base: './'` at the top level, which `tests/ui/deploy.test.ts` reads. `import.meta.env.PROD` was not used on purpose: `tests/ui/deploy.test.ts` forbids every `import.meta.env.*` but `BASE_URL`, and I did not want to widen that check. The built entry chunk holds `function oe(){return!0}` for `isBuiltSite()`, so the flag really is replaced.
**Update path chosen: tell the visitor, with a control.** A waiting worker is not activated by itself. The app shows a banner, "A newer Naqsha is ready on this device." with "Use the newer Naqsha"; pressing it posts `naqsha:skip-waiting` to the waiting worker and reloads once on `controllerchange`. Nothing reloads under the visitor's hands, and the first worker of a visit taking control reloads nothing (the state machine reloads only from `loading-update`). The two strings are new in `en.json` and `hi.json` with `reviewed: false`, and `docs/HINDI_REVIEW.md` was regenerated.
**Installability.** `public/manifest.webmanifest`: name, short name, `start_url` and `scope` `./`, `display: standalone`, `theme_color` `#FFFBF2` (`--surface`), `background_color` `#F6EFE0` (`--ground`), icons 192 and 512. `index.html` references `./manifest.webmanifest` and `./icons/icon-192.png` by relative path, so `check_bundle`'s absolute-URL rule still passes. Icons are generated by `scripts/make_icons.ts` (`npm run icons`), which reads the rectangles of `public/favicon.svg` and fills them into an RGBA buffer written with the existing `scripts/png_rgba.ts` encoder: no dependency. The `rx` rounded corner of the favicon background is not drawn, so the icon is a full square, and there is no maskable icon. The generated PNGs are checked in and `tests/scripts/icons.test.ts` compares them with a fresh run of the generator.
**`check_bundle` extended:** it now also checks the `<link rel="manifest">` of `dist/index.html`, the manifest fields and relative icon paths, that every icon exists and is the size it declares (PNG header), that `dist/sw.js` exists and carries a readable, generated versioned precache block, and that the block covers the built site with no absolute path and no missing file.
**Gzipped entry chunk: 94016 bytes (91.8 KB) of the 204800 byte budget (R16.1).** It was 93203 bytes before this task; the service worker registration and the update banner added 813 bytes. The Scan chunk is 9117 bytes gzipped. The worker, the manifest and the icons are not part of the entry chunk.
**Spec changes (authorised by the user for this task).** `requirements.md`: R13.1 amended (the precache fetches each file of the Built_Site once while installing, so "no network request after the Initial_Load and the Card_Profile fetch" was untrue); R16.10 amended (fetching separated from evaluating: the precache may fetch the Scan chunk earlier, which neither puts it in the Initial_Load nor evaluates it); Requirement 24 added with 24.1 to 24.8; three glossary entries added (Service_Worker, Precache, Web_Manifest). `design.md`: a "Service worker and installability" section with the `ServiceWorkerState`, `ServiceWorkerEvent` and `ServiceWorkerStep` types, Properties 40 to 43, and the testing-strategy lines for the new checks and for what the fakes cannot reach.
**Tests.** `tests/ui/platform/serviceWorker.test.ts` (18 tests) and `tests/scripts/precache.test.ts` (7), with fakes in `tests/support/serviceWorkerFakes.ts`: `FakeCache`, `FakeCacheStorage`, `FakeFetch`, `FakeWorker`, `FakeRegistration`, `FakeServiceWorkerContainer`, and a loader that evaluates the real `public/sw.js` with `self` bound to a fake (a classic worker script cannot be imported, so the file itself, not a copy of its logic, is what the tests run).
- Property 40 (seed 2401, 200 runs): install requests every entry exactly once, at the address it resolves to against the scope, and the current cache holds one response per entry.
- Property 41 (seed 2402, 200 runs): activate deletes exactly the caches that are not the current version and keeps the current one.
- Property 42 (seed 2403, 200 runs): a cached request is served with no network call; one that is not cached calls the network exactly once and returns its response.
- Property 43 (seed 2404, 200 runs): for a generated `dist/` written to a temporary directory, `buildPrecache` writes the start page plus every file but `sw.js`, each relative, with no absolute path and nothing missing, and the written worker reads back the same list and cache name.
- Examples: install to waiting to in control tells the visitor once and reloads once; a worker already waiting at registration is reported at once; nothing is registered when the production flag is false; a failed registration is reported and the app carries on; only GET is served; the navigation fallback; a changed file gives a new cache name; the shell shows the banner only when an update waits.
- **What the fakes cannot test** (and `check:browser` step 13 does, in a real Chrome): the browser's own install, activate and update lifecycle, `skipWaiting` and `clients.claim`, and whether a host's response headers let a cached response match a real request. The `Vary: Origin` fault above is exactly of that kind: no fake would have found it.
**`check:browser` step 13 rebuilt, and it passes for real (13 passed, 0 failed).** The step now proves the network is gone instead of only emulating it: Chrome's `Network.emulateNetworkConditions {offline:true}` does not reach the service worker's own requests, so the first run showed the worker happily answering from the still-running preview server (a request for an address in no cache came back HTTP 200). The step therefore stops the `vite preview` server as well (`ctx.stopPreview`, run once) after one plain online navigation that lets the worker take control; the hard reloads of steps 5 and 7 bypass the worker, so a page left by one of them is not controlled. `Network.setCacheDisabled {cacheDisabled:true}` was tried and removed: with it, Chrome bypasses the service worker too, and every cached chunk failed. What answers instead of Chrome's HTTP cache is shown directly: a response put only in the worker's cache, at an address the server never served, comes back through `fetch` and is then removed again. Real output of the final run:
```
PASS  13. works with the network off: PASS A. offline, no reload
          PASS a service worker controls the page before the network goes off: controlled by the worker, caches naqsha-v1-2e798d210557, 13 precached responses
          PASS the preview server is stopped, so no request can be answered from it: http://127.0.0.1:57310/ refused the connection (fetch failed)
          PASS the worker's cache, and not the network, is what answers a request: a response put only in the cache naqsha-v1-2e798d210557, at an address the server never served, came back through fetch (and was removed again: true)
          PASS the network is really off: navigator.onLine false, a request for an uncached address failed (TypeError: Failed to fetch), the card profile came from the cache
          PASS a Try it sample plays to its last pick: Diamond counter reached 36 of 36 (36 values seen)
          PASS language switching works: hi "बुनाई", back to en "Weave"
          PASS the first Scan open works offline: the Scan chunk loaded with no network and all 192 hooks equal Diamond pick 6
          PASS a BMP export works offline: demo-12x16-1bit.bmp: 192x36, 1 bit, 926 bytes
        PASS B. offline, then reload the page
          PASS the page reloads offline and the app is on screen: app on screen at http://127.0.0.1:57310/; failed requests: http://127.0.0.1:57310/never-cached-1795123766499.txt -> net::ERR_FAILED
          PASS the network is really off: navigator.onLine false, a request for an uncached address failed (TypeError: Failed to fetch), the card profile came from the cache
          PASS Weave renders: Weave screen with a canvas
          PASS a Try it sample plays to its last pick: Diamond counter reached 36 of 36 (36 values seen)
          PASS the first Scan open works offline: the Scan chunk loaded with no network and all 192 hooks equal Diamond pick 6
          PASS a BMP export works offline: demo-12x16-1bit.bmp: 192x36, 1 bit, 926 bytes
          PASS language switching works: hi "बुनाई", back to en "Weave"
```
The only console errors of that run are the step's own never-cached probes. The group letters swapped: A is now "offline, no reload" and B is "offline, then reload the page", because the server is stopped once and the no-reload checks run first. The task 7.3 entry above, and the line in `docs/KIRO_USAGE.md` that says the A group fails for want of a service worker, describe the old step and the state before this task.
**Not done, stated plainly.** No maskable icon and no rounded corner in the generated icons. The worker caches only what the build produces: a visit to an address with a query string that was never cached relies on the navigation fallback, and a cross-origin request would always go to the network (there are none). Installing the app was not tried on a real phone, and the Web_Manifest was not checked by a browser's install prompt; only its fields, its icons and its relative paths are tested. `npm run check:deployed` was not run for this task.
**Verification:** `npm run test:run` 94 files, 764 tests passed; `npm run typecheck` passes; `npm run build` passes and ends with `precache: 13 entries in cache naqsha-v1-2e798d210557`; `npm run check-bundle` passes (94016 bytes gzipped, limit 204800); `npm run check:all` 9 PASS, 0 FAIL, 1 SKIPPED (no spec format validator command in the repo), 1 INFO (changed files in the working tree); `npm run check:browser` 13 passed, 0 failed.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check).
## 2026-11-23 (app phase 8, task 8.2 part 1: review fixes)
**Goal today:** The 14 real findings of `docs/WEAVE_REVIEW.md` fixed, the `endOrder` finding fixed, and the missing `downloadBmp` property test written. The two new structure checks and the strengthened property-name check are the rest of task 8.2 and are not in this entry.
**Re-check first.** The category A and B classes were read again against the code, line by line within each class. Full table in the new "Re-check and fixes (task 8.2, part 1)" section of `docs/WEAVE_REVIEW.md`.
- **One reclassification, false positive -> acceptable:** `src/ui/samples/sampleDesigns.ts:15, 31, 32` ("cells" for a motif tile). A motif tile is part of the naksha, so the word is about the weave and calling it a false positive was wrong. It stays acceptable, not a real issue: the floral tile is two repeats wide, so it is not a *repeat*, and the glossary has no term for it. Nothing renamed.
- **Everything else unchanged.** Checked: `.row` is `display: flex` (`ScanScreen.module.css:43`, `KeepScreen.module.css:91`); `summaryRow` is one line of the saved-design list; `rows` in `tests/support/fakeIndexedDb.ts` is a store `Map`; the four "horizontal" lines measure `scrollWidth` against `innerWidth`; `cell()` in `src/ui/i18n/reviewList.ts` escapes a markdown table cell; `time_read_card.ts` 1920 x 1080 is the camera frame; `weaveWiring.test.ts:23` 320 and 192 are a viewport. Counts after the re-check: A 7 real, 158 acceptable, 77 false positives; B unchanged at 7, 13, 3.
**Category A, all 7 fixed** (`hole`/`cell` naming a punched hole value): `src/ui/state/scan.ts:162,164` -> `punchedHole`; `scripts/time_read_card.ts:68` -> `punched`; `tests/ui/printable/download.test.ts:43,57,59` -> `punchedHole` and "a punched hole value that is not a boolean"; `tests/ui/screens/scan.test.tsx:287` -> "R10.6 toggling keeps the grid size and changes one punched hole" (same `R10.6` prefix, same seed, same `numRuns`, same assertions).
**Category B, all 7 fixed.** `scripts/check_browser.ts:612,613` use `DEFAULT_PIXELS_PER_MM` from `src/ui/printable/raster.ts`; `:615` compares the downloaded PNG with the size computed from the profile (and the pHYs expectation with `DEFAULT_PIXELS_PER_MM * 1000`); `:667` builds the blank PNG of step 11 from `cardWidthMm`/`cardHeightMm`; the demo-profile pin at `:616` is untouched. `scripts/checks/manualSteps.ts` now reads `public/profiles/demo-12x16.json` through `parseCardProfile` and exports `CARD_SIZE_BY`/`CARD_SIZE_X`, so the print step text carries no written-in size; it is no longer a data-only module and its header says so. `tests/scripts/manualSteps.test.ts` builds the same two strings from `demoProfile()` and now checks the `expected` field as well as the instructions, so neither side has the size by hand; the print step is not one of the five ids tied to this log, so no log text changed with it. `tests/ui/screens/liveCamera.test.tsx:252` uses `profile.cardWidthMm / profile.cardHeightMm` and builds the expected `aspect-ratio:` string from the same number.
**The `endOrder` finding, `scripts/check_browser.ts:647-650`, fixed, and the first reading corrected.** `shapes[row * hookColumns + column]` was not an end index: `shapes` held the `button[data-shape]` elements in document order, and that order comes from `hookMarkers` (`src/ui/state/corrections.ts`), which walks hook rows then hook columns. Indexing that list with `endOrder[hookRow][hookColumn]` would be wrong for a profile whose `endOrder` is not row-major, so the fix is not that. What was wrong is real: the step decided which hook a marker belonged to from an unstated assumption about document order, and reported mismatches with no end at all. Step 10 now finds the marker for a hook position by the accessible name the app builds (`Hook row R, column C: punched hole`), checks that the name and the drawn shape agree, names every mismatch by its end from `profile.endOrder[hookRow][hookColumn]` (card-geometry.md rule 5), and asserts separately that the document order is hook row-major, which is what the arrow keys of R10.8 depend on. **Was step 10 passing for the wrong reason?** Its result was right, for a weaker reason than it claimed: the demo profile is row-major, and both sides of the comparison were built row-major, so the formula agreed with the markers while checking no end. It passes after the fix with the end range taken from the profile: `all 192 hooks (ends 0 to 191 from the profile's endOrder) equal Diamond pick 6 (96 punched, 96 not); card accepted into the batch`. Left, and listed in the review so it is not lost: the offline sub-check of step 13 (`:864-866`) still compares `expected.flat()` by document index; it carries the same implicit row-major assumption and computes no end.
**`downloadBmp` property test** (`tests/exporter/download.test.ts`, seed 80211, 100 runs, `FakeDownloadDeps`): over generated profiles, Patterns, export options and the four ways an export fails, a successful export downloads exactly once with the identical `Uint8Array` of `exportPatternBmp`, the name of `bmpFileName`, type `image/bmp`, one revoked URL, and bytes that `readPatternBmp` returns to the same Pattern; a failed export has no `bytes` field, so nothing is downloaded and nothing revoked. The property counts both branches and fails if either never ran, so it cannot pass vacuously. That `runExport` never calls `downloadBmp` after a failure is Property 14 in `tests/ui/state/keep.test.ts` and is not restated.
**Not done in this part:** `tests/structure/glossaryTerms.test.ts`, `tests/structure/cardDimensions.test.ts`, and the strengthening of `tests/structure/propertyNames.test.ts` (removing `paintToCanvas`, `browserScheduler` and `downloadBmp` from `EXCLUDED_FROM_COVERAGE` and requiring the name inside the same `it(...)` as its `fc.assert`). `npm run check:all`, `check:deployed` and `check:manual` were not run for this part.
**Verification:** `npm run test:run` 94 files, 765 tests passed; `npm run typecheck` passes; `npm run build` passes (`precache: 13 entries in cache naqsha-v1-2e798d210557`); `npm run check-bundle` passes (94016 bytes gzipped, limit 204800); `npm run check:browser` 13 passed, 0 failed, step 10 as quoted above.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check).

## 2026-11-23 (app phase 8, task 8.3: the Weave pick counter flicker)
**Goal today:** On arriving at Weave the pick counter must never read a position that does not belong to the design on screen. The fault seen in task 7.1: for one render the counter read `Pick 1 of 36` before the mount effect seeked the player.
**The failing test, written and run before the fix** (`tests/ui/screens/weave.test.tsx`, `R2.10 R14.9 the first render on arriving with a design shows that design, so the counter never reads a position from the previous render`). It renders `WeaveScreen` with a loaded design, the way the other screen tests do (`renderToStaticMarkup`, no DOM library), and asks for the counter of that very first render. Real output against the unfixed code:
```
 FAIL  tests/ui/screens/weave.test.tsx > weave screen > R2.10 R14.9 the first render on arriving with a design shows that design, so the counter never reads a position from the previous render
AssertionError: expected [ 'Pick 0 of 0' ] to deeply equal [ 'Pick 36 of 36' ]
- Expected
+ Received
  [
-   "Pick 36 of 36",
+   "Pick 0 of 0",
  ]
 ❯ tests/ui/screens/weave.test.tsx:133:32
 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```
`Pick 0 of 0` is the first of the two stale renders: the screen built its cloth in an effect, so the first commit paired the 36-pick design with the "no design" counter, and the second commit paired the new cloth with the previous position (`Pick 1 of 36`) until the effect's seek reported the real one.
**Cause, and it is the one the task states, with one addition.** The counter read `playback`, which the player's `onFrame` sets, while `pickCount` came from the cloth that had just been built. Those are two different commits, so the counter and the player disagreed for one render each time. The addition: there were **two** such renders per arrival, not one, because the cloth itself was also built in an effect (`Pick 0 of 0`, then `Pick 1 of 36`, then `Pick 36 of 36`).
**The fix (no timeout, no hidden element).** `src/ui/screens/weave/WeaveScreen.tsx`:
- The cloth is built in the render that first shows it (`useMemo` over profile, Pattern, choices and viewport) and fed to the existing `clothReducer` by adjusting state during that same render, which React finishes before it commits. So no commit shows a new design beside the old counter, and the failure announcement moved to its own effect.
- The position shown is one derived value, `displayedPlayback`: while the cloth on screen is the one the stored state describes, that state is shown; a cloth the player has not reported on yet is shown in its **entry state**, and the effect then enters the player at exactly that state (`play(entry.pick, …)` when it is playing, else `seek(entry.pick)`). The counter, the canvas alternative text, the scrubber, the step controls and the rise level all read that one value, so the counter and the seek cannot disagree.
- `src/ui/state/playback.ts` holds the rule: `EntryMode`, `entryModeFor` (the design loaded on arrival is shown finished, a design just chosen autoplays, a rebuild of the same design keeps its pick), `entryPlayback` (the entry state, which is also the position its seek moves to) and `displayedPlayback` (the derivation above). `WeaveScreen.tsx` has no position logic of its own left.
**Behaviour kept:** R3.6 a colour, zari, repeat or size change keeps the current pick (`entryPlayback('keep', …)`, clamped to the new cloth); R14.9 reduced motion shows the finished cloth and starts no rise; the counter text and the canvas alternative text are unchanged; the gap list, play, pause, step, scrub and speed are unchanged. New tests cover the gap list, the scrubber range, the enabled controls and the absent skip control on that first render, and a design with one card that does not fit the profile still lists the pick with a gap.
**One behaviour did change, on purpose.** When a rebuild fails and the previous cloth stays on screen (R2.12), the counter now keeps the position of the cloth that is on screen. Before, a new Pattern reset the counter to the first pick while the old cloth stayed, which was the same disagreement in another place.
**Property** (`tests/ui/state/playback.test.ts`, seed 80301, 200 runs): for any new pick count, any previous pick count, any previous playback state and any entry, the position shown is an integer in 0..pickCount of the cloth now on screen, it equals the entry the player is given, a rebuild keeps the previous pick clamped to the new cloth, and for a design the screen has not shown before the result does not depend on the previous state at all. A second property (seed 80301, 100 runs) checks `entryModeFor` over four designs. Nothing was weakened: no arbitrary narrowed, no `fc.pre`, no `.filter`, no lower `numRuns`, no skipped test.
**Before and after in a real browser.** A one-off observer (`/tmp/naqsha-flicker/observe.ts`, not committed, the same `MutationObserver` reading as the task 7.1 note) chooses Diamond, then leaves and re-enters Weave 11 times and records every counter value each arrival commits:
```
unfixed build: arrival 1..11: ["Pick 1 of 36","Pick 36 of 36"]   -> arrivals with more than one counter value: 11 of 11
fixed build:   arrival 1..11: ["Pick 36 of 36"]                  -> arrivals with more than one counter value: 0 of 11
```
Task 7.1 saw the two-value arrival 6 times in 11; this observer starts recording from a clean state and saw it on every arrival of the unfixed build, and on none of the fixed build. What it observes is DOM commits, not paints: a commit the browser never painted would still be listed, so this is the stronger reading of the two.
**`npm run check:browser` (once, after the fix): 13 passed, 0 failed.** The three steps that read the counter are unchanged in what they report: step 3 `diamond [hash 6a4aaebd]: counter 1 -> 36 of 36 (36 values)`, `border [hash 2f2571bd]`, `floral [hash 9273d4ad]`, each `868x521 canvas, 452228 opaque pixels, 7+ colours`; step 6 `Weave shows pick 36 of 36; canvas hash 9273d4ad equals the Floral cloth`; step 11 `batch stays at 1; Weave stays "Pick 36 of 36 / 6a4aaebd"`. These steps poll the counter, so they could not see the one-render value before the fix and cannot show the change; the observation above is where the change is visible. Step 3 still begins at pick 1 because a chosen sample autoplays from the first pick, which is that design's own position.
**Left alone, and not a counter fault.** The cloth canvas keeps the pixels of the previous design until the player's first paint, so for one frame a new design can show the old cloth beside its own (correct) counter. That is unchanged by this task and is in the canvas, not in the counter.
**Verification:** `npm run test:run` 96 files, 799 tests passed; `npm run typecheck` passes; `npm run build` passes (`precache: 13 entries in cache naqsha-v1-be994549d044`); `npm run check-bundle` passes (94191 bytes gzipped, limit 204800, up from 94016 before this task); `npm run check:browser` 13 passed, 0 failed.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, property tests (fast-check).

## 2026-11-23 (app phase 8, task 8.4: the related-tests hook timeout and its log line)

**The unit is seconds, so `"timeout": 10` really was 10 s.** Checked before changing anything, because at milliseconds the value would have meant 10 ms and the whole reading would change. Two Kiro pages say seconds: the hook schema table on [Hooks](https://kiro.dev/docs/hooks/) gives `hooks[].timeout` as "Timeout in seconds for command actions (default: 60). 0 disables the timeout. Ignored for agent actions", and [Hook actions](https://kiro.dev/docs/hooks/actions/) repeats that a command action's timeout defaults to 60 seconds and 0 disables it. (Both pages read 2026-11-23; wording paraphrased, content rephrased for compliance with licensing restrictions.) Context7 was not needed. **Not documented, and therefore not verified:** which signal the runner sends at the timeout and whether it kills the whole process group. The fix below does not depend on the answer.

**Measured cost of the hook command.** `node .kiro/hooks/bin/related-tests.mjs` (Vitest `related --run` plus `tsc --noEmit`), five real runs per saved file, sequential, on an otherwise idle machine, timed with `/usr/bin/time -p`, the saved path fed on STDIN the way the hook feeds it:

```
for i in 1 2 3 4 5; do printf '{"filePath":"%s/<file>"}' "$PWD" |
  /usr/bin/time -p node .kiro/hooks/bin/related-tests.mjs > out 2> err; done
```

| Saved file | Related test files | Runs (s, in order) | Min | Median | Max |
|---|---|---|---|---|---|
| `scripts/log_hook.ts` (few) | 0 of 96 ("No affected test files found") | 0.92, 0.57, 0.55, 0.62, 0.56 | **0.55** | **0.57** | **0.92** |
| `src/ui/state/playback.ts` | 6 of 96 | 1.39, 1.06, 0.99, 0.97, 1.00 | **0.97** | **1.00** | **1.39** |
| `src/codec/validateCardProfile.ts` (widely imported) | 54 of 96 | 33.86, 35.07, 34.38, 35.04, 34.10 | **33.86** | **34.38** | **35.07** |
| `src/codec/types.ts` (widely imported) | 54 of 96 | 33.49, 33.95, 34.46, 35.96, 34.93 | **33.49** | **34.46** | **35.96** |

All 20 runs exited 0. The slowest run of all four cases is **35.96 s**, which is about 3.6 times the old 10 s timeout, so a save of any codec file was being killed. `tsc --noEmit` is a small part of it (TypeScript 7 typechecks this repo in well under a second); the cost is the 54 related test files, and `npm run test:run` for all 96 takes 35.4 s, so the related set is already most of the suite. The first run of each case is the slowest (0.92 vs 0.55, 1.39 vs 0.97), which is the cold cache.

**New timeout: 120 s in the hook, with a 110 s deadline inside the wrapper.** The margin over the measured 35.96 s is about 3.3 times, for three reasons, each visible in the numbers above: the runs were measured on an idle machine while the hook fires during editing (34 s wall at 77 s user time means it already uses more than two cores, so a busy machine is slower); a cold cache adds to the first run after a restart; and the related set grows with the suite, whose present ceiling is the whole 35.4 s run. 120 s leaves room for roughly a tripling before a save is killed again. The 10 s gap between the wrapper's own deadline (110 s) and the hook timeout (120 s) is there so the wrapper, not the runner, ends a run that overruns, and has time to write its line.

**The log line is now written when a run is cut short.** Before, the command was `sh -c 'node .kiro/hooks/bin/related-tests.mjs; s=$?; node scripts/log_hook.ts … "exit $s"; exit $s'`: the line came after the work, so a kill at the timeout left no line, and a hook that timed out was indistinguishable from a hook that never fired. New command:

```
sh .kiro/hooks/bin/run-logged.sh "Related tests and typecheck on save" 110 node .kiro/hooks/bin/related-tests.mjs
```

`.kiro/hooks/bin/run-logged.sh` (POSIX sh) writes exactly one line through `scripts/log_hook.ts` in each of three cases: the command finishes (`exit <status>`, and the wrapper exits with that same status, so the result the runner sees is unchanged); its own 110 s deadline passes (the command is sent TERM, line `timed out (deadline 110s)`, exit 124); or the wrapper is killed from outside, which is what the runner's timeout does (a `trap` on TERM and INT writes `timed out (terminated by the hook runner)` before exiting 124). A `trap` on EXIT is the net for any path that wrote no line. Only SIGKILL can still leave no line, because it cannot be trapped. STDIN (the runner's JSON, which `related-tests.mjs` reads to find the saved file) is copied to a temporary file and handed to the command, because a POSIX shell gives a background command `/dev/null` as its standard input; the run below shows the payload arriving.

**The simulation, run for real.** `NAQSHA_HOOKS_LOG` (new, for verification only) sends the line elsewhere, and the hook name is `timeout simulation`, so `logs/hooks.log` keeps lines from real hook runs only. **These lines are from a simulation, not from a hook the IDE fired.** No log line in this repository was written by hand.

```
export NAQSHA_HOOKS_LOG=/tmp/naqsha-hooktime/sim.log
# 1. command succeeds, STDIN passed through
printf '{"filePath":"…/src/codec/types.ts"}' | sh .kiro/hooks/bin/run-logged.sh "timeout simulation" 5 \
  sh -c 'cat > /tmp/naqsha-hooktime/seen-stdin.txt; exit 0'   -> wrapper exit=0
   stdin reached the command: {"filePath":"…/src/codec/types.ts"}
# 2. command fails, status passed through
sh .kiro/hooks/bin/run-logged.sh "timeout simulation" 5 sh -c 'exit 3'   -> wrapper exit=3
# 3. the wrapper's own deadline: deadline 2 s, command sleeps 8 s
/usr/bin/time -p sh .kiro/hooks/bin/run-logged.sh "timeout simulation" 2 sleep 8
   real 2.13   -> wrapper exit=124
# 4a. TERM to the wrapper while it runs (runner-style kill, single process)
sh .kiro/hooks/bin/run-logged.sh "timeout simulation" 60 sleep 30 & sleep 2; kill -TERM $!   -> wrapper exit=124
# 4b. TERM to the whole process group
perl -e 'setpgrp(0,0); exec @ARGV' sh .kiro/hooks/bin/run-logged.sh "timeout simulation" 60 sleep 30 &
  sleep 2; kill -TERM -$!   -> wrapper exit=124
```

The lines those five runs wrote, read back from `/tmp/naqsha-hooktime/sim.log` (tabs between the fields):

```
2026-11-20T04:14:33.348Z	timeout simulation	exit 0
2026-11-20T04:14:33.432Z	timeout simulation	exit 3
2026-11-20T04:14:35.567Z	timeout simulation	timed out (deadline 2s)
2026-11-20T04:14:59.210Z	timeout simulation	timed out (terminated by the hook runner)
2026-11-20T04:15:01.324Z	timeout simulation	timed out (terminated by the hook runner)
```

The old command shape loses the line, shown the same way for comparison: `perl -e 'setpgrp(0,0); exec @ARGV' sh -c 'sleep 30; s=$?; node scripts/log_hook.ts "old style simulation" "exit $s"; exit $s'`, process group sent TERM after 2 s, exited 143 and **wrote no file at all** (`log lines written: no file`).

**The real command through the wrapper**, once, with the temp log and the name `wrapper check, not a hook run`: `real 34.38` s, wrapper exit 0, `on-save checks passed`, line `2026-11-20T04:15:57.059Z  wrapper check, not a hook run  exit 0`. So the wrapper's overhead is inside the run-to-run spread of the 34 s case.

**Log parsing extended, no property weakened.** `scripts/checks/hooksLog.ts`: `TIMEOUT_RESULT_PREFIX`, `isTimeoutResult`, and `HookSummary.timedOut`, so `npm run check:hooks` says, for example, `fired 3 times, last at …, 2 of them timed out` instead of counting a timeout as a plain firing. `tests/scripts/hooksLog.test.ts` gains one example (the two wrapper results are recognised, counted and described) and one property (seed 72002, 200 runs): a formatted timeout line parses back to the same timestamp, hook name and result, and is counted as one firing and one timeout. The existing properties are untouched, including "malformed lines never throw, are reported and never counted as fired"; the two example expectations that compare a whole `HookSummary` gained the new field and lost nothing.

**The wrapper itself is tested, by running it.** `tests/scripts/runLogged.test.ts` spawns `.kiro/hooks/bin/run-logged.sh` with `NAQSHA_HOOKS_LOG` pointed at a temporary file (so the suite never writes to `logs/hooks.log`) and checks the three results against the real log file it writes: a command that exits 0 and one that exits 3 pass their status through and are logged as `exit 0` and `exit 3`, with the STDIN payload arriving at the command byte for byte; a 1 s deadline against `sleep 30` gives status 124 and the line `timed out (deadline 1s)`; a `SIGTERM` sent to the wrapper after 300 ms gives status 124 and the line `timed out (terminated by the hook runner)`. Each case also asserts that exactly one line was added and that it parses. No mocks; the tests skip on Windows, where there is no POSIX shell.

**Real firings, from `logs/hooks.log` only.** `npm run check:hooks` reports `Related tests and typecheck on save: fired 68 times, last at 2026-11-20T04:19:50.376Z` and `Regenerate fixtures on profile or generator change: never fired (no log line)`. The 68 lines are `exit 0` and `exit 1` only; no timeout line exists yet, because the wrapper was installed in this task. The last line was written after `test-on-save.json` was changed, so the IDE fired the hook once with the new command and it passed; **unverified:** `exit 0` reads the same from either command shape, so that line alone does not prove which one ran. **Also unverified:** how many saves were killed at the old 10 s timeout and left no line at all. Saves of files whose related set is small (the 0.55 s to 1.4 s cases) fitted in 10 s, so the lines that exist are consistent with those; a save of a codec file at 34 s could not have fitted.

**Left alone, on purpose:** `.kiro/hooks/fixtures-on-profile-change.json` still uses the old command shape, so it too writes no line if it is killed at its 60 s timeout. `sh .kiro/hooks/bin/check-fixtures.sh` was not timed in this task, and a deadline below its real cost would produce false timeout lines, so it is recorded as open rather than changed blind.

**Verification:** `npm run test:run` 97 files, 804 tests passed; `npm run typecheck` passes; `npm run build` passes (`precache: 13 entries in cache naqsha-v1-be994549d044`); `npm run check-bundle` passes (94191 bytes gzipped, limit 204800); `npm run check:hooks` exits 0 with no malformed line.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, hooks, property tests (fast-check).
---

## 2026-11-23 (app phase 8, task 8.5: Phase 8 overall, the real runs, documentation and push)

**Goal today:** Close the one gap task 8.4 left open (the fixtures hook), run every check for real, write Phase 8 down as a whole, and push.

### The fixtures hook, the gap task 8.4 left open

**`sh .kiro/hooks/bin/check-fixtures.sh` timed for real.** Seven sequential runs on an idle machine, `/usr/bin/time -p`, each a full `node scripts/make_fixtures.ts --all` over the 12 files of `tests/fixtures/` plus two `shasum` passes:

```
for i in 1 2 3 4 5 6 7; do /usr/bin/time -p sh .kiro/hooks/bin/check-fixtures.sh; done
0.77, 0.42, 0.42, 0.42, 0.42, 0.48, 0.42   (seconds, in order)
```

**Min 0.42 s, median 0.42 s, max 0.77 s.** Every run printed `fixtures regenerated; all PNG and JSON bytes unchanged` and exited 0, and `git status tests/fixtures` was empty afterwards, so the generator is byte-stable. The first run is the slowest, the same cold-cache effect as in task 8.4.

**The 60 s timeout stays.** The measured maximum is 0.77 s, about 78 times inside it, so there was nothing to raise. (For comparison, the related-tests hook needed 120 s because its slowest measured run was 35.96 s.)

**The same wrapper, with a 50 s deadline.** `.kiro/hooks/fixtures-on-profile-change.json` no longer uses the `sh -c '...; node scripts/log_hook.ts ...'` shape, which writes nothing when the runner kills the process. New command:

```
sh .kiro/hooks/bin/run-logged.sh "Regenerate fixtures on profile or generator change" 50 sh .kiro/hooks/bin/check-fixtures.sh
```

50 s sits 10 s below the hook's 60 s timeout (the same margin as 110 s under 120 s for the other hook), so the wrapper, not the runner, ends an overrunning run and has time to write its line; and it is about 65 times the measured maximum, so a real run can never be cut short by the deadline and no false timeout line can appear. Both hooks now use one wrapper, so there is nothing left with the old shape.

**Verified by simulation, into a temporary log.** `NAQSHA_HOOKS_LOG` pointed at `/tmp/naqsha-sim.kKKelp/sim-hooks.log` and the hook name set to `Fixtures hook timeout SIMULATION, not a hook run`, so `logs/hooks.log` still holds only lines written by hooks the IDE fired. **The three lines below are from a simulation.** No log line in this repository was written by hand.

```
# (a) the exact hook command, real deadline 50 s
sh .kiro/hooks/bin/run-logged.sh "$HOOK" 50 sh .kiro/hooks/bin/check-fixtures.sh < /dev/null
   fixtures regenerated; all PNG and JSON bytes unchanged      -> wrapper exit 0
# (b) the exact hook command, TERM to the wrapper 150 ms in (a runner-style kill)
sh .kiro/hooks/bin/run-logged.sh "$HOOK" 50 sh .kiro/hooks/bin/check-fixtures.sh < /dev/null &
  sleep 0.15; kill -TERM $!                                    -> wrapper exit 124
# (c) the same command made slow on purpose (sleep 3 first), deadline 1 s, so the deadline wins
sh .kiro/hooks/bin/run-logged.sh "$HOOK" 1 sh -c 'sleep 3; sh .kiro/hooks/bin/check-fixtures.sh'
                                                               -> wrapper exit 124
```

The lines those three runs wrote, read back from the temporary log (tabs between the fields):

```
2026-11-20T04:28:43.302Z	Fixtures hook timeout SIMULATION, not a hook run	exit 0
2026-11-20T04:28:43.534Z	Fixtures hook timeout SIMULATION, not a hook run	timed out (terminated by the hook runner)
2026-11-20T04:28:44.663Z	Fixtures hook timeout SIMULATION, not a hook run	timed out (deadline 1s)
```

Case (c) had to be given a deliberately slowed stand-in: the real command finishes in under a second and the wrapper's deadline is a whole number of seconds, so no deadline value can cut the real command short. That is the point of the 50 s choice, and it is why (b) uses the real command. `logs/hooks.log` was 68 lines before and after.

### Phase 8 as a whole

**Service worker and installability (8.1).** `public/sw.js`, hand-written, no new dependency; `dependencies` are still `react` and `react-dom`. Precache: 13 entries (the start page, `index.html`, the six `assets/` chunks and style sheets including the lazy `ScanScreen-*.js` and its CSS, `profiles/demo-12x16.json`, `favicon.svg`, the manifest, both icons), generated after the build by `scripts/build_precache.ts` so hashed names are never written by hand. Cache name of this build: `naqsha-v1-be994549d044` (format version plus a SHA-256 over every precached path and its bytes, so a changed file gives a new cache and new worker bytes). Update path chosen: **tell the visitor with a control** ("A newer Naqsha is ready on this device." / "Use the newer Naqsha"), which posts `naqsha:skip-waiting` and reloads once on `controllerchange`; nothing reloads unasked. Installable through `public/manifest.webmanifest` with icons generated by `scripts/make_icons.ts` from `public/favicon.svg`.

Two findings that only real runs produced, and neither could have come from a fake: `vite preview` answers with `Vary: Origin` while the page requests its own chunks with `crossorigin`, so `cache.match` missed every chunk until the lookup passed `{ignoreVary: true}`; and Chrome's `Network.emulateNetworkConditions {offline:true}` does not reach the worker's own requests, so the first "offline" run was quietly answered by the still-running preview server. Step 13 now stops the preview server, and shows that a response put only in the cache, at an address the server never served, comes back through `fetch`. What the fakes cannot test is listed in the 8.1 entry: the browser's own install, activate and update lifecycle, `skipWaiting`, `clients.claim`, and whether a host's headers let a cached response match a real request.

**Review fixes, and the checks that would have caught them (8.2).** Part 1: one reclassification (`src/ui/samples/sampleDesigns.ts:15,31,32`, "cells" for a motif tile, false positive -> acceptable, because a motif tile is part of the naksha); all 7 category A findings fixed (`hole`/`cell` naming a punched hole value); all 7 category B findings fixed (every card number now derived from the Card_Profile); the `endOrder` finding in `check:browser` step 10 fixed, and the review's first reading of it corrected (the formula indexed document order, not ends, so the step was right for the row-major demo profile while checking no end at all); and the missing `downloadBmp` property written (seed 80211, 100 runs).

Part 2 added the three checks, and **the new glossary check found nine further real findings in older code that the review never read**, because the review covered only the lines the app spec added: `cell`/`cellLocation`/`firstCell` for an end index and `cellRange`/`firstRow`/`lastRow` for a hook range in `src/codec/validateCardProfile.ts`; `cell` indexing ends and four "cell" comments in `src/simulator/render.ts`; `weftByRow`, `shedRow`, `weftRow`, `warpMaskRow` and `row` for a pick in the same file; `row` for a `PickRow` in `src/simulator/floats.ts` and two comments there; five comment terms in `src/simulator/style.ts`; the `PegHole` and sampling comments in `src/codec/types.ts` and `src/reader/sampling.ts`; and four comments in `src/ui/printable/layout.ts`, `src/ui/samples/sampleDesigns.ts`, `src/ui/screens/keep/KeepScreen.tsx` and `scripts/checks/summary.ts`. Every edit is a local name or a comment, so no behaviour changed and the tests passed unchanged. The check reported 105 uses in all; 16 allowances, each carrying a reason, explain the rest, and a test fails if an allowance covers nothing. The card-number check reports four literals, all explained by three line-scoped allowances (`DEFAULT_PIXELS_PER_MM = 12`, the kept demo pin, `ICON_SIZES = [192, 512]`). The strengthened property-name check (the name must stand inside the same `it(...)` as the property runner, or in a helper that test names) emptied `EXCLUDED_FROM_COVERAGE` down to `loadPixelData` alone, and **reported `decidePunched` (`src/reader/sampling.ts`) as having no property, so one was written** rather than excluded: `R11.1 a hook position is punched exactly when more than half of its sampling pixels are dark`, seed 80219, 300 runs. Both new checks state what they cannot find (a synonym outside the word list, an inflected form, anything inside a string literal, the `tests/` tree; a card number written in another form).

**The Weave pick counter flicker (8.3).** The failing test was written first and its real output is in the 8.3 entry (`expected [ 'Pick 0 of 0' ] to deeply equal [ 'Pick 36 of 36' ]`, which also showed the arrival had **two** stale renders, not one). The fix builds the cloth in the render that first shows it and derives the position from one value, `displayedPlayback`, which is also the state the seek enters, so the counter and the player cannot disagree. A one-off `MutationObserver` observing DOM commits over 11 arrivals: **the unfixed build showed two counter values on 11 of 11 arrivals, the fixed build on 0 of 11.** Property at seed 80301, 200 runs.

**Hook timeout (8.4, with the fixtures hook above).** Measured, in seconds: related tests and typecheck 0.55 min / 0.57 median / 0.92 max for a file with no related test, 33.49 / 34.46 / 35.96 for a codec file whose related set is 54 of 96 test files (20 runs over four saved files), against a 10 s timeout, so every save of a codec file was being killed and left no line. Now 120 s with a 110 s wrapper deadline. The fixtures hook: 0.42 / 0.42 / 0.77 over seven runs, timeout left at 60 s with a 50 s deadline. `npm run check:hooks` reports `Related tests and typecheck on save: fired 68 times, last at 2026-11-20T04:19:50.376Z` and `Regenerate fixtures on profile or generator change: never fired (no log line)`.

### The real runs of this task

Nothing failed, so nothing was fixed and no check was touched.

- `npm run test:run`: **97 test files, 804 tests, all passed**, 33.53 s.
- `npm run typecheck`: passes, no output.
- `npm run build`: passes, ends with `precache: 13 entries in cache naqsha-v1-be994549d044`.
- `npm run check-bundle`: passes. **Entry chunk `./assets/index-BxQUVtbs.js`, 94191 bytes gzipped against the 204800 byte budget (46%), R16.1 holds.** Scan chunk 9116 bytes gzipped; both icons and the generated precache block checked.
- `npm run check:all`: **9 PASS, 0 FAIL, 1 SKIPPED, 1 INFO.** Skipped: no spec format validator command in the repo. Info: the working tree had 6 changed or untracked paths while the check ran.
- `npm run check:browser`: **13 passed, 0 failed.** Step 13 passes in both groups (offline with no reload, and offline then reload), including the first Scan open and a BMP export offline. The only console errors are the step's own never-cached probes.
- `npm run check:deployed`: **4 passed, 0 failed** against https://naqsha-ashen.vercel.app/ (HTTP 200, title, assets, and `profiles/demo-12x16.json` accepted by `parseCardProfile`).

**What the deployed site actually is, stated plainly.** It is whatever Vercel last built, which is an older commit: it serves `assets/index-DIpFeFC9.js` and `assets/index-1dD1MI1L.css`, while this local build produces `assets/index-BxQUVtbs.js` and `assets/index-BDdimImO.css`. **The asset hashes do not match the local build.** `GET /sw.js`, `/manifest.webmanifest` and `/icons/icon-192.png` all answer **404** there. So the service worker, offline support, installability, the flicker fix and every other piece of Phase 8 are live only after the next deploy; `check:deployed` passing says the old site still loads, nothing more. The offline evidence in this log and in the 8.1 entry is from the local built site under `vite preview`, in a real Chrome.

### Still open after Phase 8

- **Nothing in Phase 8 is deployed** (above). A deploy of `main` is the one outstanding action, and whether Vercel serves `sw.js` and the manifest from `dist/` is unverified until then.
- **No maskable icon and no rounded corner** in the generated icons; installing the app was never tried on a real phone and no browser install prompt was seen. Only the manifest fields, the icon sizes and the relative paths are tested.
- **The offline sub-check of `check_browser.ts` step 13 still compares `expected.flat()` by document index**, so it carries the row-major assumption that step 10 was fixed to drop. Recorded in `docs/WEAVE_REVIEW.md`; it computes no end.
- **The cloth canvas, not the counter:** a new design can show the previous design's pixels for one frame until the player's first paint. Unchanged by 8.3 and in the canvas.
- **What the structure checks cannot find:** a glossary synonym outside the word list, an inflected form, text inside a string literal (which is why one of the seven category A findings, a test title, is invisible to the check) and the whole `tests/` tree for check A; a card number written in another form (`6 * 32`) for check B; and whether a property says anything worth saying for check C.
- **Still unverified from earlier phases**, unchanged by Phase 8: real IndexedDB in a browser, the live camera on a phone, printing at 100% scale, a photograph of a real card, any loom controller, on-device timings, the real card dimensions, the Hindi wording, and that the custom agent and the `prerelease-check` steering command work in the IDE.
- **Task 5.18** (the four parked `readCard` image properties of task 5.14) is untouched and still open.

**Verification:** the seven runs above, as quoted.
**What I changed by hand:** No files edited by hand.
**Kiro features used:** spec, steering, hooks, property tests (fast-check).
---
## 2026-11-20 (cards-as-code phase 1, task 1.1: the entry chunk before Code view)

**Goal today:** Record the gzipped entry-chunk size of the current build, before any file of the `cards-as-code` feature exists, so that task 4.4 can state what Code view cost (R9.4).

**What changed:** This entry only. No source file was written, edited or stubbed; `src/codec-view` does not exist yet, and `src/` still holds `archive`, `codec`, `exporter`, `reader`, `simulator`, `ui`, `main.tsx` and `globals.d.ts`.

**Bundle sizes, `check-bundle` (R9.4).** Measured on this machine (Node v24.5.0, darwin arm64) by `npm run build` followed by `npm run check-bundle`, on branch `auto/build` with no file of this feature present. Nothing under `src/`, `tests/`, `scripts/` or `package.json` differed from the last commit while the build ran; the only paths `git status` listed were this log and untracked `.kiro/specs/` files. `check-bundle` gzips at level 9 and counts bytes; `vite build` prints its own gzip level and uses kB = 1000 bytes, which is why the two disagree for the same file (vite said `gzip: 95.46 kB`, the check said 94191 bytes).

| Row | Chunk | Gzipped bytes | Limit |
|---|---|---|---|
| **before** (this task) | `./assets/index-BxQUVtbs.js` | **94191** | 204800 |
| **after** (task 4.4, includes the design pass) | `./assets/index-Czo1BVeg.js` | **109570** | 204800 |
| **Code view chunk** (task 4.4) | `assets/CodeViewScreen-DUaaI3MN.js` | **10042** | none (not limited) |

The **after** row and the **Code view chunk** row were filled in by **task 4.4**; see the entry "cards-as-code phase 4, task 4.4" below for how they were measured, what the 15,379-byte difference holds, and the rest of the R9.4 record.

**The real output, quoted.** `npm run build`, from the size table onward (vite's `transforming...`, `✓ 94 modules transformed.`, `rendering chunks...` and `computing gzip size...` progress lines are left out; vite reported itself as v8.3.8):
```
dist/index.html                        0.74 kB │ gzip:  0.43 kB
dist/assets/ScanScreen-Baka5qIY.css    3.66 kB │ gzip:  1.12 kB
dist/assets/index-BDdimImO.css         7.45 kB │ gzip:  1.87 kB
dist/assets/style-uXsjHezt.js          0.94 kB │ gzip:  0.53 kB
dist/assets/download-nsz99dzb.js       4.83 kB │ gzip:  2.22 kB
dist/assets/ScanScreen-usaqXbWI.js    27.32 kB │ gzip:  9.17 kB
dist/assets/index-BxQUVtbs.js        313.73 kB │ gzip: 95.46 kB
✓ built in 160ms
precache: 13 entries in cache naqsha-v1-be994549d044
```
`npm run check-bundle`:
```
entry chunk: ./assets/index-BxQUVtbs.js, 94191 bytes gzipped (limit 204800)
scan chunk: assets/ScanScreen-usaqXbWI.js, 9116 bytes gzipped
precache: 13 entries in cache naqsha-v1-be994549d044
icon: ./icons/icon-192.png, 192x192
icon: ./icons/icon-512.png, 512x512
bundle check passed
```
Both commands exited 0. The before figure leaves **110,609 bytes** of the 204,800-byte budget for everything Code view adds to the entry chunk, which R9.1 and R9.3 intend to be nothing but the lazy import of the Code view chunk.

**Not verified:** nothing about Code view — no chunk of this feature exists to measure. The 94191-byte figure is from this laptop's build of the current working tree; it is not the size of whatever the deployed site serves (the deploy was already behind at the end of Phase 8, see the task 8.5 entry).

**Evidence saved:** None beyond the quoted output; `dist/` is not committed.

---
## 2026-11-20 (cards-as-code phase 1, tasks 1.2 to 1.21: the pure module and its checkpoint)

**Goal:** Build `src/codec-view`, the pure module Code view rests on — Bit_Lines, the alignment, the Diff, `applyDiff` and the Diff_Text — with its properties and its boundary test, and close Phase 1 at the task 1.21 checkpoint. Nothing in `src/ui` was touched; Phases 2, 3 and 4 are not started.

**What Phase 1 built.**
- `src/codec-view/` (1,156 lines): `types.ts` (every type of the feature), `bits.ts` (`cardToBits`, `patternToLines`, `groupBits`, `GROUP_SEPARATOR`), `align.ts` (`lineKey`, `alignLines`), `diff.ts` (`DIFF_PICK_LIMIT`, `diffPatterns`, `applyDiff`), `diffText.ts` (`DIFF_MARKERS`, `diffToText`), `index.ts` (the five key exports plus the six named helpers and constants). No `src/` dependency but `src/codec`; no React, no DOM, no browser API, no `any`.
- `tests/codec-view/` (7 files, 116 tests): `bits.test.ts` (P1, P2), `align.test.ts`, `diff.test.ts` (P3, P4, P5, P6, P7 and the R5.5 well-formedness property), `diffText.test.ts` (P8), `totality.test.ts` (P10), `boundaries.test.ts` (the eleven boundary rows plus eleven planted-breach example tests), and `benchmark.test.ts` (task 1.21, new in this entry).
- Test support: `tests/support/lineSets.ts` (new: `lineSetArbitrary`, `diffRefusalArbitrary`, `diffArbitrary`), a `PickCountRange` parameter on `patternArbitrary`, and `importSpecifiers` moved into `tests/support/source.ts`.
- Steering: the `src/codec-view` entry in `.kiro/steering/structure.md`, and **changed hole** added to `.kiro/steering/weaving-glossary.md`.
- P9 was deliberately not written: it belongs to Phase 2.

**The checkpoint audit (R12.1, R12.5).** Every one of the five exports has at least one property and at least one example-based test, and P1 to P8 and P10 all exist; `groupBits`, `lineKey` and `alignLines` are covered too. Two honest findings, neither patched over:
- `patternToLines` has no property of its own that asserts R1.5 and R1.6 over generated input. Its property cover is P10 (totality) plus every property that builds a Line_Set, since `patternToLines` is the only way to make one; its R1.5, R1.6, R1.9 and R1.10 behaviour is asserted by seven example tests. R12.1 is met; a dedicated `patternToLines` property would be stronger.
- The P10 counterexample is kept as its own example test (`diffText.test.ts`, `R1.8 writes the Diff_Text of the counterexample P10 reported, where it used to throw`) rather than through the `examples` option of P10 as R12.10 words it. The reason is that P10's input is a whole record of eight generated fields, of which the counterexample constrains one. Reported, not changed.

**The one bug a property found: P10 in `diffToText`.** P10 at seed 11820 shrank to a Diff that is no refusal whose `entries` field holds text rather than a list of Diff_Entries; `diffToText` threw on it instead of returning a value, breaking R1.8. The fix reads every field of the given value through a guard — `ok`, `refusal` and the values its reason names, `entries`, each entry, `counts` — and returns one line of the shape R6.15 fixes for a refusal, `! not-a-diff <field>`, naming the field that is not a Diff's. A partial Diff_Text was rejected as the fix because a dropped entry or a missing count would read as a true report of the comparison. `not-a-diff` is none of the three refusal reasons, so the line cannot be mistaken for one. The counterexample is kept as the regression test named above. (I did not re-run the pre-fix code at this checkpoint; the failure and the seed are as the task 1.20 test records them.)

**The correction to `tests/structure/glossaryTerms.test.ts`.** The word scan flags `hole` unless it is part of a glossary term. Code view needed "changed hole", and the first move was to widen the test's allowance list. That is a weakened check, so it was replaced: **changed hole** is now a term in `.kiro/steering/weaving-glossary.md`, and the test's allowance for `['changed', 'hole']` carries the glossary term as its reason, exactly as `punched hole`, `peg hole` and `lacing hole` do. The scan is at full strength; the bare word `hole` still fails.

**Existing tests that changed, and why.** Four files, none of them weakened; no assertion was dropped.
- `tests/structure/modules.test.ts`: its private `specifiers()` helper was deleted and it now imports `importSpecifiers` from `tests/support/source.ts`. Same three regexes, same behaviour; `tests/codec-view/boundaries.test.ts` needed the same scan (task 1.3).
- `tests/support/source.ts`: gained `importSpecifiers` and its `lineOf` helper.
- `tests/support/patterns.ts`: `patternArbitrary(profile)` gained an optional `PickCountRange`, defaulting to the present 1 to 40 picks, so the exporter tests that call it are untouched and the Code view properties can ask for 0 and 1 picks (R12.3).
- `tests/structure/glossaryTerms.test.ts`: the `changed hole` allowance and its reason, as above.

**The 2,000 × 2,000 diff (task 1.21).** `tests/codec-view/benchmark.test.ts` builds both sides from the exported `DIFF_PICK_LIMIT` — never the literal 2,000 — on the widest of twenty generated Card_Profiles (10 × 10 hook positions, 100 ends per pick), the second side being the first with one card deleted, one appended and one punched hole flipped every 100 picks, so the alignment carries a long common subsequence, an insertion, a deletion and unmatched picks. The measured time is written straight to stdout, so it is in the output of `npm run test:run` with or without a terminal attached.

| Picks per side | Measured |
|---|---|
| 250 × 250 | 3.15 to 3.51 ms (first measurement of the run, cold) |
| 500 × 500 | 2.01 to 2.08 ms |
| 1000 × 1000 | 7.27 to 8.33 ms |
| **2000 × 2000** | **25.59, 26.61, 27.01, 27.36 ms over four standalone runs; 49.61 ms inside the full suite** |

Growth from 500 to 1,000 to 2,000 picks is roughly fourfold per doubling, as a quadratic dynamic program should be, and the figure matches the 20 to 30 ms the design assumed for `DIFF_PICK_LIMIT`. **The ceiling the test asserts is 1,000 ms**, about 37 times the standalone measurement and 20 times the measurement under a loaded parallel test run. It is set that high on purpose: it is a guard against a change of order — a cubic alignment, or per-cell work on 100-character Bit_Lines instead of interned ids — and must not fail on a loaded machine or a cold JIT. A smaller regression does not fail the test; it shows in the printed number, which is why the number is printed.

**The runs, as they came out.**

`npm run test:run` — exit 0:
```
> naqsha@0.0.0 test:run
> vitest run
 RUN  v5.1.0 /Users/ishantripathi/dev/Naqsha
benchmark: codec-view diffPatterns, 10 x 10 hook positions (100 ends per pick), 2000 x 2000 picks: 49.61 ms, ceiling 1000 ms; smaller sizes 250 x 250: 9.70 ms, 500 x 500: 2.08 ms, 1000 x 1000: 6.99 ms
 Test Files  104 passed (104)
      Tests  920 passed (920)
   Start at  18:36:57
   Duration  36.03s (tests 93%, import 5%, transform 1%, worker 1%)
```

`npm run typecheck` — exit 0, no diagnostic output:
```
> naqsha@0.0.0 typecheck
> tsc --noEmit
```

`npm run check:all` — exit 0:
```
> naqsha@0.0.0 check:all
> node scripts/check_all.ts
PASS    typecheck: npm run typecheck
PASS    test suite: npm run test:run
PASS    build: npm run build
PASS    bundle check: npm run check-bundle
SKIPPED spec format validators: no spec format validator command in the repo
PASS    hygiene: LICENSE: LICENSE present
PASS    hygiene: .kiro not ignored: .kiro is not git-ignored
PASS    hygiene: .kiro directories: .kiro/specs, .kiro/hooks, .kiro/settings exist
PASS    hygiene: no secrets: no secrets found in 288 tracked text files
PASS    hygiene: README has no "coming": README.md has no "coming"
INFO    hygiene: git working tree: git working tree has 14 changed or untracked path(s)
PASS 9, FAIL 0, SKIPPED 1, INFO 1
```
`check:all` runs typecheck, the test suite, the build, the bundle check, the spec format validators and the hygiene checks, and **no browser and no network step** — those live in `npm run check:browser`, `check:deployed` and `check:everything`, which Phase 1 did not run and which task 4.4 owns. The one SKIPPED step is the spec format validator, skipped because the repo has no such command, exactly as on previous runs. The INFO step reports the 14 uncommitted paths of this Phase 1 work; it is not a failure.

**The entry chunk is unchanged.** `npm run build` then `npm run check-bundle`, both exit 0:
```
entry chunk: ./assets/index-BxQUVtbs.js, 94191 bytes gzipped (limit 204800)
scan chunk: assets/ScanScreen-usaqXbWI.js, 9116 bytes gzipped
precache: 13 entries in cache naqsha-v1-be994549d044
icon: ./icons/icon-192.png, 192x192
icon: ./icons/icon-512.png, 512x512
bundle check passed
```
Identical to the **before** row of the task 1.1 entry, down to the content hash in the file name: `./assets/index-BxQUVtbs.js`, 94191 bytes gzipped, limit 204800. `vite build` transformed the same 94 modules as before. That is what Phase 1 should produce: `src/ui` imports nothing from `src/codec-view`, so no module of it reaches any chunk. Checked twice over: the file name hash is unchanged, and no chunk in `dist/assets` holds any of the module's distinctive strings (`too-many-picks`, `profile-mismatch`, `lines-mismatch`). The **after** and **Code view chunk** rows of the task 1.1 table stay empty; task 4.4 fills them.

**Not verified:** no browser run, no deployed run and no manual check at this checkpoint — Code view has no screen yet, so there is nothing to click. The timings are from this laptop (Node v24.5.0, darwin arm64) and are not a figure for a mid-range phone. The pre-fix `diffToText` throw is recorded from the task 1.20 test, not re-observed here. `git status` also lists three untracked `tasks.meta.json` files of older specs; they are Kiro session state, not Phase 1 work, and were left out of the commit.

**Kiro features used:** spec (requirements, design, tasks for `cards-as-code`), steering (`structure.md`, `weaving-glossary.md`), property tests with fast-check.

**Evidence saved:** None beyond the quoted output; `dist/` is not committed.

**Commit:** one commit for Phase 1, on `auto/build`, not pushed: the 25 files above, including the three `cards-as-code` spec documents and the two steering files.

---

## 2026-11-20 (cards-as-code phases 2 and 3: shared state, the Code view screen and its checkpoint)

**What was built.**
Phase 2 (committed and pushed earlier as `fa04deb`): `AppState.selectedPick` and `breakpoints` with the `select-pick`, `toggle-breakpoint` and `set-cloth-choices` actions, so the Weave and Code view screens share one Selected_Pick (2.1); `buildReadyCloth` moved to `src/ui/state/cloth.ts` (2.2); 60 translation keys in English and Hindi, all Hindi marked `reviewed: false` (2.3); the pure view logic in `src/ui/state/codeView.ts`: `windowFor`, `pickNumberWidth`, `toggleBreakpoint`, `nextBreakpoint`, `parseJump`, `lineAccessibleName`, `diffEntryAccessibleName` (2.4 to 2.6).
Phase 3 (this commit): the lazy fourth screen and its `Code` navigation entry (3.1); the virtualised listing and one Line each (3.2); step, jump and run-to-next-breakpoint with one live-region announcement per deliberate move (3.3); the cloth beside the current card, reusing `ClothCanvas` (3.4); the diff panel with choosers, counts and entries (3.5); copy and download of the Diff_Text (3.6); refusals, empty, missing and failing inputs (3.7); keyboard, focus, colour and motion rules and the `focusTargetAfterWindowMove` helper (3.8). Files: `src/ui/screens/code/` (`CodeViewScreen.tsx`, `Listing.tsx`, `LineRow.tsx`, `DiffPanel.tsx`, `diffText.ts` and four `.module.css`), `src/ui/state/codeView.ts`, `src/ui/App.tsx`, `tests/ui/screens/code.test.tsx`.

**The checkpoint found what the sub-agents had been told not to look for.** During Phase 3 no sub-agent ran `npm run typecheck` or the full suite, so this is the first time they ran together. Three things failed and were fixed in code or test scaffolding; no assertion was removed or loosened and no `any`, `as any`, `@ts-ignore` or `@ts-expect-error` was added.

1. `npm run typecheck`, first run, exit 1:
```
tests/ui/screens/code.test.tsx(1076,15): error TS1294: This syntax is not allowed when 'erasableSyntaxOnly' is enabled.
tests/ui/screens/code.test.tsx(1908,30): error TS2345: Argument of type '{ kind: "damaged"; pick: number; }' is not assignable to parameter of type 'Line'.
  Property 'violations' is missing in type '{ kind: "damaged"; pick: number; }' but required in type 'DamagedLine'.
```
Fix: `FakeDiffTextDeps` used a constructor parameter property (`constructor(private readonly copyResult …)`), now a declared field assigned in the constructor; the Hindi-name test's damaged Line literal gained `violations: []`. Both are in the test scaffolding. The assertions around them are unchanged. Typecheck then exit 0, no output beyond the two header lines.
2. `npm run test:run`, first run, exit 1, `Test Files 1 failed | 105 passed (106)`, `Tests 1 failed | 1073 passed (1074)`. The failing test was `tests/structure/glossaryTerms.test.ts` ("R15.4, R10.2 and R12.3 the code and comments of src and scripts use the glossary term, not a synonym"): **67 uses of `row`, `column` and `cell` in the new Code view files** that the glossary does not allow. Fix, in the code and not in the test's allowance list: `rowHeight` to `lineHeight` (it already matched the CSS property `--code-line-height`), `LineRow` component and its props to `LineItem`, `EntryRow*` to `EntryItem*`, `endColumn` to `endTextIndex`, `markerRow` to `markerLine`, `cells` to `characters`, `cellWidth` to `characterWidth`, `diffTextRows` to `diffTextLineCount`, CSS classes `.row`, `.listingColumn`, `.clothColumn` to `.controls`, `.listingPane`, `.clothPane`, the attribute `data-marker-row` to `data-marker-line`, and the message placeholders `firstRows`, `firstColumns`, `secondRows`, `secondColumns` to `firstHookRows`, `firstHookColumns`, `secondHookRows`, `secondHookColumns` (the glossary term "hook row" and "hook column"). The `<textarea rows=…>` HTML attribute cannot be renamed, so the Diff_Text box is now sized with `style={{ height: calc(N * 1lh + var(--diff-text-frame)) }}` and a `--diff-text-frame` custom property in `DiffPanel.module.css`. **That is a visual change nobody has seen in a browser.** The component files keep the names `LineRow.tsx` and `LineRow.module.css`, because `design.md`, `tasks.md` and the tests name them; the file name is not scanned by the glossary test, so the file and the exported component `LineItem` no longer share a name.
3. `npm run test:run`, second run, exit 1, same counts (1 failed, 1073 passed): `tests/ui/i18n/reviewList.test.ts` ("R12.12 the checked-in docs/HINDI_REVIEW.md equals the generated …") failed because the placeholder rename in `hi.json` changed the generated review list. Fix: `npm run review-list`; `docs/HINDI_REVIEW.md` changed by exactly one line (the `codeview.refusal.dimension-mismatch` row).

**The final runs**, after those fixes.
`npm run typecheck` — exit 0:
```
> naqsha@0.0.0 typecheck
> tsc --noEmit
```
`npm run test:run` — exit 0:
```
 Test Files  106 passed (106)
      Tests  1074 passed (1074)
   Start at  20:09:37
   Duration  34.59s (tests 93%, import 5%, transform 2%, worker 1%)
```
(Phase 1 ended on 104 files and 920 tests; Phase 2 on 105 files and 991 tests.)

**The boundary test (task 1.3) on the real Code view files.** `tests/codec-view/boundaries.test.ts` passes, 23 of 23 tests. Its screen set is every `.ts` and `.tsx` under `src/ui/screens/code/` plus `src/ui/state/codeView.ts`, which on disk is six files: `CodeViewScreen.tsx`, `DiffPanel.tsx`, `LineRow.tsx`, `Listing.tsx`, `diffText.ts` and `src/ui/state/codeView.ts`. Every `.ts` and `.tsx` file in those places is in the set; no file was missed. The four `.module.css` files are not in the set, by design (the test reads imports and API names). **Gap:** the test never prints the set and never asserts that it is non-empty (its sanity check is `screenFiles.every(isUnder UI)`, which is true of an empty set), so the claim above comes from applying the test's own file rule to the directory, not from the test's output. The test's header comment still says the screen set "is empty until Phase 3"; I did not edit the test.

**Existing tests that changed in Phase 3** (`git diff HEAD`):
- `tests/ui/screens/shell.test.tsx`: `SCREENS` gained `'code'` (3 to 4 screens); `expect(SCREENS).toHaveLength(3)` to `(4)`; the navigation button counts `toBe(3)` to `toBe(4)` in three places (R1.3 on every screen, the profile banner test, the update-notice test); the R1.3 title says "four" instead of "three". The meaning of each assertion is the same (the navigation lists every screen); only the number of screens changed.
- `tests/ui/accessibility.test.tsx`: the R14.4 test now also renders the Code view page and its title names Code view. **One helper, `unnamed()`, was widened:** a control whose `id` is the `for` of a `<label>` with text is now accepted as named. Before, such a control was reported unless it had its own `aria-label`. This applies to every page that test checks, not only Code view; no existing page needed it, so no existing result changed, but a future control named only through `label[for]` now passes where it did not. A new `describe('Code view styles')` block (motion, focus ring, Touch_Target, widths) was added; it does not alter an existing test.
- `tests/ui/i18n/messages.test.ts`: the expected placeholder names for `codeview.refusal.dimension-mismatch` follow the rename above (`firstRows` to `firstHookRows` and the other three). The assertion is the same: the message carries these four values.
- `tests/ui/state/codeView.test.ts`: no change in Phase 3 (last changed in Phase 2).
No existing assertion changed meaning.

**Bundle.** `npm run build` — exit 0 (`tsc --noEmit && vite build && node scripts/build_precache.ts`; 110 modules transformed, 15 precache entries). `npm run check-bundle` — exit 0:
```
entry chunk: ./assets/index-C1uNIch0.js, 97686 bytes gzipped (limit 204800)
scan chunk: assets/ScanScreen-DsnKdTJL.js, 9123 bytes gzipped
precache: 15 entries in cache naqsha-v1-08d01333424e
icon: ./icons/icon-192.png, 192x192
icon: ./icons/icon-512.png, 512x512
bundle check passed
```
- Entry chunk: 97686 bytes, against the pre-feature baseline of 94191 bytes (`./assets/index-BxQUVtbs.js`): **+3495 bytes**, still 107114 bytes under the 204800 limit. The growth is the lazy `import()` call, the fourth navigation entry, the new `AppState` fields, the Code view translation keys in both dictionaries (60 keys) and the shared state code; the screen itself is not in it.
- A separate Code view chunk exists: `dist/assets/CodeViewScreen-DT2AHiJ2.js`, 29.00 kB, **9414 bytes** gzipped (`gzip -9`; Vite prints 9.41 kB), and `CodeViewScreen-BhArghES.css`, 5.30 kB, 1.37 kB gzipped. `check-bundle` does not print or check it; that is Phase 4 work (parameterising `check_bundle.ts`).
- No leak: `grep -l naqsha-code-view-listing dist/assets/*.js` finds only `CodeViewScreen-DT2AHiJ2.js`. The entry chunk does not contain the marker.
- `dist/sw.js` lists both `CodeViewScreen` files in its precache. No test checks that yet (Phase 4).

**Skipped on purpose, by the credit-saving rule** (each is marked cuttable and is not written; all are cuts to report, R12.7 and R12.11): 2.7 `focusTargetAfterWindowMove` as a task of its own (the helper was written in Phase 3 for 3.8, in `src/ui/state/codeView.ts`, used by `Listing.tsx` and covered by example tests in `tests/ui/screens/code.test.tsx`; no property is written for it); 2.8 P9 (the Window holds at most Window_Size Lines and always holds the Selected_Pick); 2.9 the reducer property (R3.1); the fast-check property inside 2.6 (the R11.3 name property); 3.9 R4.7 (both screens derive one image from one `renderFrame` call); 3.10 the listing timing test at 10,000 picks (R2.6, R2.10). Properties P1 to P8 and P10 still pass.

**Known gaps and limits reported by the task sub-agents.**
- Everything ran in Node with server rendering only. No click, focus move, scroll, keypress, clipboard, canvas, `ResizeObserver` or layout was exercised.
- 3.2: `listingWindow` departs from the design: when the viewport and the Selected_Pick cannot both fit in the 80-line Window, the viewport wins, so the Window may not hold the Selected_Pick until the user scrolls back. That is a literal departure from R2.4; a deliberate move still scrolls to it. User decision pending.
- 3.2 and 3.3: `Listing` re-rendered forever when given zero Lines for a non-empty pattern; worked around by rendering it only when there are Lines.
- 3.3: the no-further-breakpoint case announces `codeview.announce.noBreakpoint` and not the pick, because the App holds one announcement at a time.
- 3.5: a 2,000-entry diff puts about 14,000 elements in the DOM (`content-visibility: auto` skips layout and paint, not DOM creation).
- 3.5 and 3.7: saved designs are read with the current Card_Profile's geometry but carry their own recorded profile name, so a design from another profile is refused with `profile-mismatch`, and cards that cannot be read become damaged and block the comparison (R7.3).
- 3.7: no retry control after `storage-unavailable`; the choosers re-enable when the Current_Pattern changes.
- 3.8: the Code view CSS has no transitions or smooth scrolling at all, stricter than the spec, because the existing R14.11 test only allows `reduce` queries.
- 2.1: a Weave screen re-entered after the cloth finished now arrives paused at the last pick and not finished (the reducer clamps), so the cloth shows one pick fewer woven; `select-pick` clamps to `pickCount - 1` in `entryPlayback('show-selected')`.
- 2.3: `codeview.pickCount` reads "1 picks" for a count of 1 (the same flaw as the existing `keep.list.picks`); no key exists for a failed download, so it falls back to `error.generic`; Hindi uses डिज़ाइन for "design", as the rest of `hi.json` does.
- The 2,000 x 2,000 diff benchmark read 520 ms in the Phase 2 full run and 27 ms standalone, against a 1,000 ms ceiling.

**Not verified.**
- **No browser has ever run any of this.** Nothing in Phases 2 and 3 was opened, clicked, scrolled or focused in Chrome, Firefox or Safari, on a phone or on a desktop. Do not read "Code view works" from this entry; read "Code view renders to the markup the tests expect, in Node".
- The widths 320, 390 and 1280 px, the focus ring's contrast and clipping, the tab order, the focus restore after a Window move, the live-region announcements, the clipboard and the file download are unchecked. The new `1lh` sizing of the Diff_Text box is unchecked.
- The lazy chunk's failure path (`error.codeview.load`) is tested only through `screenErrorKey`, not by a real failed `import()`.
- The service worker and offline use of the Code view chunk are unchecked (the chunk is in the precache list; no test and no offline run covers it).
- The Hindi text is machine-written and `reviewed: false`; nobody has read it.
- `check:all` (beyond the pieces named above), `check:browser`, `check:deployed` and `check:everything` were not run at this checkpoint. Phase 4 owns them.
- Timings are from this laptop (Node, darwin arm64), not a mid-range phone.

**Kiro features used:** spec (requirements, design, tasks for `cards-as-code`), steering (`structure.md`, `weaving-glossary.md`, `testing.md`), property tests with fast-check, sub-agent task execution.
**Evidence saved:** the quoted output above; `dist/` is not committed.
**Commit:** one commit for top-level task 3 on `auto/build`: the Phase 3 files, the glossary and review-list fixes (including the regenerated `docs/HINDI_REVIEW.md`), this entry, and the spec's `tasks.md` and `tasks.meta.json`.
---
## 2026-11-20 (version-history: one unattended run, spec and all four task groups)
**What was built.** Each saved design can now have versions. A save from a design opened from the archive offers "Save as new version" (default) and "Save as a new design"; any other save starts a new design, as before. A version is one ordinary archive record and summary with two optional fields: `designId` (the design it continues; absent on the first version, whose own id is the design id) and `note` (at most 200 characters). Keep lists one entry per design (newest version on top, version count); a design with several versions opens into its versions, newest first (date, note, pick count). Each version has Open, Compare with the previous version, Compare with the open design, Restore and Delete. Compare sets `AppState.compare` and shows the Code view with both sides chosen, through the existing `compareDesigns` and `diffPatterns` (no second diff). Restore loads the version as the open design (origin `archive`), fills the form with its Metadata, stays on Keep and writes nothing; the next save continues it as a new version. After any save from an archive origin the open design becomes the version just saved.
- Archive: `src/archive/versions.ts` (pure: `designIdOf`, `groupDesigns`, `previousVersion`), `saveDesign` takes optional `continues` and `note`, `NOTE_MAX = 200`. `deleteDesign` and `listDesigns` are unchanged: deleting the newest version leaves the older ones under the same `designId`, deleting the last removes the design.
- IndexedDB: `DATABASE_VERSION` 1 to 2. `onupgradeneeded` reads `oldVersion`: 0 creates both stores and both indexes; 1 adds the `designId` index on `summaries` through `request.transaction`. No record is rewritten, because a record with no `designId` is a design with one version. The upgrade is tested against an old-shape database (`createFakeIndexedDb({ legacy })`, new option in `tests/support/fakeIndexedDb.ts`): the rows are equal before and after, the old records list, open and delete, and a new version can continue an old record.
- State and screens: `restore-saved`, `set-archive-origin` and `compare-versions` actions, `AppState.compare`, `KeepForm.note` and `saveMode`, pure helpers in `src/ui/state/keep.ts`; `src/ui/screens/keep/DesignEntry.tsx` and `DeleteConfirm.tsx` (moved out of `KeepScreen.tsx`); `DiffPanel` takes an optional `request`; 18 new keys in `en.json` and `hi.json` (singular and plural count keys separate, so no "1 versions"); Hindi is `reviewed: false` and `docs/HINDI_REVIEW.md` was regenerated. Glossary: a `version` row was added. `structure.md`: the archive and ui entries were updated.
**Tests.** Example tests for each behaviour in `tests/archive/versions.test.ts`, `tests/ui/screens/versions.test.tsx` and the state tests. **One new property** (`tests/archive/versions.test.ts`, "R3.2 R4.2 saving versions then listing returns them newest first, and each one restores an equal pattern", seed 20261120, 100 runs); no other property was added.
**Existing tests changed, on purpose, and why.**
1. `tests/archive/designs.test.ts`, R6.1: the five-field `SavedDesign` check is now the seven-field shape (adds `designId`, `note`). The user asked for this. A design's first version still stores five fields (checked in `versions.test.ts`).
2. `tests/archive/idbStore.test.ts`, R6.11: "version 1, indexes `['createdAt']`" is now "version 2, indexes `['createdAt', 'designId']`". This follows from the requested schema bump. **The user did not name this one.**
3. `tests/ui/screens/keep.test.tsx`, R7.1: the count of `<input type="text"` went from 5 to 6, because the Save panel has a new note input. It is still an exact count. **The user did not name this one.**
4. `tests/ui/state/keep.test.ts`: one `KeepForm` literal gained `note` and `saveMode` (a type error otherwise). The assertions are unchanged.
No assertion was removed, skipped or loosened; no `any`, `as any` or `@ts-ignore` was added.
**Decisions taken (user may reverse).**
- The requirement detailer added "a note over 200 characters returns a failure". There is no new failure reason: `saveDesign` returns `write-failed` with the detail "note is longer than 200 characters" and stores nothing; the note input also has `maxLength`. `requirements.md` R2.1 says so.
- Saving a version whose source version was deleted since is `not-found` and writes nothing. The weaver can choose "Save as a new design".
- The `designId` index is not read by any code yet. It is the smallest non-destructive change that gives the requested bump something real to do. If it is not wanted, drop it and keep version 1.
- The new files could not use the word "row" (the glossary scan gives no allowance to new files), so the list-entry helper is `designHeading`, the detail helper is `versionDetails`, and the new CSS class is `.actions`.
**Not done or not verified.**
- No browser was opened. Nothing was clicked, focused or scrolled; the 320 px width, the focus order after Restore and after a delete, and the live region were not looked at. `check:browser` and `check:all` were not run, as instructed.
- The Code view choosers still list every version flat with the same label ("name (n picks)"), so several versions of one design look alike there. The Compare buttons on Keep avoid this by choosing both sides for the weaver. A date in the chooser label is not built.
- The Hindi strings are machine-written and unreviewed.
- The request effect in `DiffPanel` runs in a browser only; the tests cover `compareDesigns`, not the effect.
**Entry chunk: before 97,686 bytes gzipped (`./assets/index-C1uNIch0.js`), after 99,932 bytes (`./assets/index-BxCsz-rc.js`): +2,246 bytes**, 104,868 bytes under the 204,800 limit. The Code view chunk went from 9,414 to about 9,510 bytes gzipped.
**Evidence.** `npm run typecheck` clean; `npm run test:run`: 108 files, 1127 tests passed; `npm run build` and `npm run check-bundle` passed.
**Kiro features used:** spec (requirements, design, tasks for `version-history`), requirement detailing sub-agents, steering (glossary, structure, testing), property test with fast-check.
**Commits:** spec; group 1 (archive); group 2 (state); group 3 (screens); group 4 (docs and steering).
---
## 2026-11-21 (repair-suggestions: one unattended run, spec and all four task groups)
**What was built.** A lost card (a gap: a pick that is missing, or damaged, as `prepareCloth` classifies it) now gets guesses with evidence. Nothing changes until a button is pressed.
- `src/repair` (new module; imports only `src/codec` and `src/codec-view`; no React, no I/O, never throws): `suggestRepairs(pattern, profile)` returns for each gap zero or more suggestions, best first. Three kinds. **repeat**: the best period `p` (all pairs agree first, then most agreeing pairs, then shortest) and the card taken from picks a multiple of `p` away. **mirror**: the best centre sum `i + j` and the card at the mirror pick. **neighbours**: the picks on both sides are the same card (always low confidence). Each suggestion has the card (a copy), the kind, a confidence (high, medium, low) and evidence as plain data; each kind appears exactly once per gap, either as a suggestion or as a `notApplied` reason. If kinds propose different cards, both are returned and the gap is marked `conflict`. A gap with no suggestion has a reason (`no-readable-cards`, `too-short`, `no-evidence`). Cards are compared with codec-view's `cardToBits`, also for the conflict check. Failures are values (`invalid-profile`, `not-a-pattern`).
- **Thresholds are my choice** (named constants in `candidates.ts`): a period or mirror counts when at least `MIN_COMPARISONS = 3` readable pairs are compared and at least `AGREEMENT_FLOOR = 0.8` of them agree; high confidence needs every pair to agree, at least `HIGH_MIN_COMPARISONS = 4` pairs, and (for repeat) at least two agreeing supporters.
- State: `AppState.repairs` (`picks`, `history`), actions `accept-repairs` (one item for Accept, several for "Accept all high-confidence"; one history group each) and `undo-repair`; the existing `withNewPattern` clears them, so open, restore, sample and scan commit all clear the marks.
- Weave: `RepairNotice` ("N cards could not be read", "Suggest repairs", the accepted picks and Undo). The button loads `RepairPanel` with `import()`, so the panel and `src/repair` are one separate chunk. The panel lists each gap with kind and confidence in words, the evidence sentence, a drawing (filled circle for a punched hole, ring for a position that is not punched, with an accessible name), Accept and Skip per suggestion, "Why not the other kinds?" with the reasons, the sentence "These are guesses based on the pattern. Check them against the real card if you can.", and a separate dashed "Accept all high-confidence" button (first high suggestion of each non-conflicting gap). Code view lines of repaired picks say "repaired (a guess)" in words, a dashed edge and the accessible name. Keep shows one line about guesses next to the export button when any pick is repaired; saving is the unchanged version-history save.
- Sample: "Try a design with lost cards" (`sampleWithLostCards`): the diamond with picks 5, 16 and the last replaced by an empty grid (a card no profile accepts, so the simulator shows it as damaged). Every gap gets repeat and mirror suggestions that agree.
- 52 new keys in `en.json` and `hi.json` (Hindi `reviewed: false`, `docs/HINDI_REVIEW.md` regenerated); `structure.md` has the new module and the dependency `ui -> repair`.
**Tests.** Example tests per kind and per edge case (`tests/repair/suggest.test.ts`: first and last pick, no repeat, centre pick, conflict, supporters tie, all gaps, wrong profile, too short, invalid profile, not an array, inputs unchanged, 1,500 picks), the reducer, the sample, and the panel and notice by server rendering (`tests/ui/screens/repair.test.tsx`). **Two properties, no others:** (1) a block of 1 to 6 cards repeated until the chain has at least 8 picks and 3 repeats, one card lost (missing or damaged): the first repeat suggestion is the true card (seed 20261121, 100 runs); (2) a palindrome of a half of 5 to 8 cards, with or without a centre card, one card other than the centre lost: the first mirror suggestion is the true card (seed 20261122, 100 runs). The centre of an odd palindrome has no mirror partner; it is chosen out of the property by index and covered by an example test. Both properties also passed once with 5,000 runs and other seeds on this machine (not committed). No existing assertion was changed or removed; tests were only added.
**Decisions taken (user may reverse).**
- In the app a lost card is an empty grid `[]` (typed as a card, rejected by every profile). `null` or `undefined` slots (gap kind `missing`) are understood by the module but no screen produces one, because `Pattern` is `CardGrid[]`.
- The accepted marks live only for the session. After "Save as new version" the stored version holds the guessed cards as ordinary cards, with no flag; the Keep export line disappears when another design is opened. A note or flag on the version is not built.
- The first suggestion of a gap is accepted by "Accept all high-confidence" only when the gap has no conflict.
- New files cannot use the words "row", "cell" or "hole" alone (glossary scan), so the drawing constant is `HOOK_SPACING_PX` and the loop variable `punchedHole`.
**Not done or not verified.**
- No browser was opened. The lazy `import()` and its failure message, focus after Accept (goes to the panel heading), the live-region announcements, the 320 px layout, the look of the drawing and of the badge on a Code view line at 320 px (the bits region gets narrow and scrolls) are unchecked. `check:browser` and `check:all` were not run, as instructed.
- The Hindi text is machine-written and unreviewed.
- Exporting a design that still has gaps fails as before; the guesses line is for designs with accepted repairs.
**Entry size (gzipped).** Before: entry chunk 99,932 bytes. After: entry chunk **100,853 bytes** (+921), limit 204,800. The build also moved shared codec code into a chunk the entry loads at start (`validateCardGrid-*.js`, 3,004 bytes) and a small one only the panel needs (`bits-*.js`, 525), so the initial JavaScript is 100,853 + 3,004 = **103,857 bytes** (+3,925 against the old single file). The panel and `src/repair` are `RepairPanel-*.js`, 3,142 bytes, loaded on the first press of "Suggest repairs"; `suggestRepairs` is not in the entry chunk (checked in `dist/assets`, and by a source test).
**Evidence.** `npm run typecheck` clean; `npm run test:run`: 110 files, 1181 tests passed; `npm run build` and `npm run check-bundle` passed.
**Kiro features used:** spec (requirements, design, tasks for `repair-suggestions`), requirement detailing sub-agents, steering (glossary, structure, testing), property tests with fast-check.
**Commits:** spec; group 1 (module); group 2 (state and sample); group 3 (screens); group 4 (docs).
---
## 2026-11-21 (two jobs: the repaired-picks note, and loom-mcp)
### Job 1: repaired-picks note
**What was built.** When a design with accepted repairs is saved from Keep, `withGuessesLine` (`src/ui/state/keep.ts`) appends one line to the design's notes field: "Includes N suggested cards (guesses): picks a, b, c." (singular: "Includes 1 suggested card (a guess): pick a."), picks from 1 in ascending order, in the language in use, after the typed notes on a new line. Typed notes are never replaced, a line already there is not added twice, and the form on screen is not changed (so a failed save leaves what was typed). The line goes in `metadata.notes`, not in the version note, so the 200-character rule of the version note is untouched. Two keys in `en.json` and `hi.json` (Hindi unreviewed; `docs/HINDI_REVIEW.md` regenerated). Commit `40d06af`.
**Tests.** Eight example tests in `tests/ui/screens/keep.test.tsx` (order and 1-based picks, empty notes, trailing space, Hindi, no repairs returns the same form, no duplicates, input unchanged, a save stores the line in the design notes and leaves a 200-character version note as typed). No property test; no existing assertion changed.
### Job 2: loom-mcp
**What was built.** `tools/loom-mcp`: an MCP server over stdio with five tools: `validate_profile`, `read_card_photo`, `render_cloth`, `diff_designs`, `export_bmp`. It imports the app's pure modules from `src/` (with a resolve hook for the reader's extensionless imports, as `scripts/time_read_card.ts` does); nothing in `src/` imports from `tools/`. Own `package.json` and lockfile: **`@modelcontextprotocol/sdk` 1.32.2** (published 2026-10-23, the latest on the registry and about four weeks old) and **`zod` 4.6.7** (published 2026-10-12; zod below 4.6.6 has advisory GHSA-mrhx-c7xc-m3w5, and `npm audit` found it with the first version I tried, 3.25.76, so I moved to 4.6.7; audit is now clean). Both exact. The root `package.json` gained two scripts (`typecheck:loom-mcp`, `test:loom-mcp`) and no dependency; the root lockfile is untouched.
- **Safety:** reads only under the repository root (no `..` segment, real path after links must stay inside, regular files only); writes only a bare `.bmp` name into `tools/loom-mcp/out/` (gitignored), never through a link; limits: inline JSON 1 MiB, JSON file 2 MiB, PNG file 8 MiB, PNG 16,777,216 pixels, 5,000 picks, cloth 4096 pixels per side (refused, not cropped); no network, no shell, no environment variable (a test scans the source); error messages never carry file content. All in the README.
- **Registration:** `.kiro/settings/mcp.json` has `loom-mcp` (`node`, `tools/loom-mcp/src/server.ts`, `autoApprove` for the four read-only tools, not for `export_bmp`). The Context7 entry is unchanged except that its closing brace now has a comma after it. Steering `.kiro/steering/loom-mcp.md` (manual). `tools/loom-mcp/README.md`.
- **Root checks, on purpose:** `tsconfig.json` lists `src`, `tests`, `scripts` and `vite.config.ts`, so `tools/` is outside the root typecheck; the server has its own `tsconfig.json` and `npm run typecheck`. Vitest includes only `tests/`, so `tools/` tests are outside `test:run`, which runs the same 110 files as before. There is no lint script in this repository. The glossary scan reads only `src` and `scripts`; I added `tools/loom-mcp/src` to its list for one run, it found the words rows, threads and SHED_THREADS in my code, I renamed them, it passed, and I put the test file back. `tools/` stays out of the permanent scan because a new directory gets no allowance (the scan is stricter than the code needs to be for a tool), but the server source was cleaned to it.
**Deviation from the design.md.** The design says an error result carries `structuredContent: {ok:false, reason, message, hint}`. The SDK client checks any `structuredContent` against the tool's `outputSchema`, even on an error, and refuses a result that does not match (found by running it: `Structured content does not match the tool's output schema`). So an error result has `isError: true`, a text `reason: message Hint: hint`, and the reason and hint in `_meta`, and no `structuredContent`. An argument of the wrong type is refused by the SDK before the tool runs; that is also an `isError` result, with the SDK's own text and no reason code.
**Tests (96, `npm run test:loom-mcp`, node:test, no new dependency).** Path guard (traversal, absolute, links in and out, write names, a link as the out directory), PNG decoder (colour types 0, 2, 3, 4, 6 each with filters 0 to 4, damaged and unsupported forms, the pixel limit before inflating), a real stdio exchange through the SDK client for every tool against `tests/fixtures/*.png` and the demo profile with checked outputs (the four fixtures read to the grid in their ground-truth JSON, the PNG block is a PNG of the reported size, the BMP reads back to the same design with the app's `readPatternBmp`, the size returned equals the file on disk) and failing cases for every tool, isolation (exact pins, lockfile versions, root dependencies, nothing in `src` imports `tools`) and the source scan. No property test.
**Evidence from Kiro itself.** This is the exact exchange from this chat. Kiro had connected `loom-mcp` from `.kiro/settings/mcp.json` without a restart; its tools loaded by id `tool::loom-mcp::<name>`.
```
load_resource tool::loom-mcp::validate_profile  -> loaded; description "Checks a card profile (the layout of one punch card: hook rows and columns, ..." input_schema { profile?: object, path?: string }
tool_call tool::loom-mcp::validate_profile {"path": "public/profiles/demo-12x16.json"}
  -> The card profile "demo-12x16" is valid: 12 hook rows by 16 hook columns, 192 ends per pick.
load_resource tool::loom-mcp::read_card_photo   -> loaded; input_schema { path: string (required), profile?: object, profilePath?: string }
tool_call tool::loom-mcp::read_card_photo {"path": "../../../etc/passwd"}
  -> MCP tool error: path_not_allowed: The path contains a ".." segment. Hint: Use a path inside the repository, such as tests/fixtures/pick0-clean.png.
tool_call tool::loom-mcp::read_card_photo {"path": "tests/fixtures/pick0-noisy-tilted.png"}
  -> Read a card of 12 hook rows by 16 hook columns (upright, tilt -6.0 degrees).
     Bit line: 100100100100100001001001001001000010010010010010100100100100100101001001001001000010010010010010100100100100100101001001001001000010010010010010100100100100100101001001001001000010010010010010
     1001001001001000 / 0100100100100100 / 0010010010010010 / 1001001001001001 / 0100100100100100 / 0010010010010010 / 1001001001001001 / 0100100100100100 / 0010010010010010 / 1001001001001001 / 0100100100100100 / 0010010010010010
```
What this shows and does not show: Kiro called three real tool calls against the live server, one of them a failing call that returned the reason code and the hint. The agent side showed the text content only; I did not see `structuredContent`, the `_meta` or an image block from Kiro. `render_cloth`, `diff_designs` and `export_bmp` were not called from Kiro; they were called through the SDK client in the tests. The Kiro MCP panel was not looked at (I cannot see the IDE).
**Not done or not verified.** No other MCP client was tried. The tools were not run on a photo taken with a camera; only the generated fixtures. Windows paths and the `\` separator are handled by the guard but were not run on Windows. `export_bmp` has not been tried on a loom controller.
**Evidence.** `npm run typecheck:loom-mcp` clean; `npm run test:loom-mcp`: 96 tests passed; `npm audit` in `tools/loom-mcp`: 0 vulnerabilities; root `npm run typecheck` clean; root `npm run test:run`: 110 files, 1189 tests passed. `check:browser` and `check:all` were not run.
**Kiro features used:** MCP (a custom server, called from this chat), spec (requirements, design, tasks for `loom-mcp`), requirement detailing sub-agents, steering (a manual steering file).
**Commits:** `40d06af` (job 1); spec; group 1 (foundation); group 2 (tools); group 3 (tests and wiring); group 4 (this entry).
---
## 2026-11-21 (design-and-ux-pass: one unattended run, Stage 0 and Stages A to D)
**What was built.** A design and UX pass over the App, with no change to the codec, reader, repair, exporter or archive modules and no new entry in `dependencies` or `devDependencies`. Stage A: three self-hosted fonts, the Token_File (`src/ui/theme/tokens.css`), the Theme_Switch (Day and Night) and the shared components (`Button`, `Field`, `Panel`, `Tabs`, `Notice`, `Disclosure`, `StateMessage`, `LoadingState`, `WeftProgress`). Stage B: the Landing, the navigation with icons and the word "Advanced" for Code view, "More" and "Settings" Disclosures, friendly states. Stage C: the card drawing, the Hero_Loom, Step_Icons and Spot_Illustrations, and the "after" screenshots. Stage D: version labels, singular and plural pick texts, the finished cloth on return to Weave, the steady benchmark and the loom-mcp design fix. Every number below is copied from `.kiro/specs/design-and-ux-pass/measurements.md`.

### Licence record and Font_Weight_Report
Checked 2026-11-21 at the google/fonts commit `06bfe0d62a98375cb09c942fa18e68bd32cff057` (`FONTS_REF` in `scripts/fonts/subset.sh`). Each licence text was downloaded from that commit and the script confirmed that it contains "SIL OPEN FONT LICENSE Version 1.1". All three are SIL OFL 1.1, so all four font files were copied.

| Font (files) | Licence | Source URL | Licence text |
|---|---|---|---|
| Rozha One (`RozhaOne-Regular.woff2`) | SIL Open Font License 1.1 | https://raw.githubusercontent.com/google/fonts/06bfe0d62a98375cb09c942fa18e68bd32cff057/ofl/rozhaone/ | `RozhaOne-OFL.txt` (copyright Indian Type Foundry, no Reserved Font Name) |
| Hind (`Hind-Regular.woff2`, `Hind-Bold.woff2`) | SIL Open Font License 1.1 | https://raw.githubusercontent.com/google/fonts/06bfe0d62a98375cb09c942fa18e68bd32cff057/ofl/hind/ | `Hind-OFL.txt` (copyright Indian Type Foundry, no Reserved Font Name) |
| IBM Plex Mono (`IBMPlexMono-Regular.woff2`) | SIL Open Font License 1.1 | https://raw.githubusercontent.com/google/fonts/06bfe0d62a98375cb09c942fa18e68bd32cff057/ofl/ibmplexmono/ | `IBMPlexMono-OFL.txt` (copyright IBM Corp., Reserved Font Name "Plex") |

The IBM Plex Mono licence reserves the name "Plex". The subset keeps the font's original family name table, as google/fonts distributes it; the file is not renamed or presented as a different font.

Font_Weight_Report (output of `node scripts/fonts/report.ts`; before is the source `.ttf`, after is the subsetted `.woff2`):

| File | Bytes before | Bytes after |
|---|---|---|
| RozhaOne-Regular.woff2 | 322828 | 41180 |
| Hind-Regular.woff2 | 299532 | 39500 |
| Hind-Bold.woff2 | 286604 | 36572 |
| IBMPlexMono-Regular.woff2 | 135580 | 6660 |
| Sum after subsetting | | 123912 |

The sum 123,912 is below the 307,200-byte limit and no file is above 51,200 bytes, so no range or weight had to go and the user did not have to be asked (R2.6). Code points used in `en.json` and `hi.json` that a source font lacks: only U+25CF `●` and U+25CB `○` (in `repair.legend`), which all four source fonts lack; the browser draws them from the fallback family. Every Devanagari code point used in `hi.json` is in Rozha One, Hind Regular and Hind Bold. The list of unused code points the fonts lack is in `scripts/fonts/missing-glyphs.json`.

### Bundle sizes (gzipped, level 9, from `npm run check-bundle` after `npm run build`)
Entry_Chunk: before Stage A `./assets/index-Cge58eUK.js`, **101,075 bytes**; after Stage C `./assets/index-DrddQ7uj.js`, **109,126 bytes** (+8,051); the final Entry_Chunk after Stage D is **109,570 bytes**. The limit is 204,800. No Illustration was moved into a lazy chunk (`HeroLoom.tsx` keeps its static import) and no fallback or error boundary was added for it.

| File | Before Stage A | After Stage C | Change |
|---|---|---|---|
| assets/CodeViewScreen-CGYejRHN.js | 9321 | 9504 | +183 |
| assets/Panel-ChUTrmoB.js | (not present) | 3908 | +3908 |
| assets/RepairPanel-CoxnrWd3.js | 3119 | 3026 | -93 |
| assets/ScanScreen-CcvgxDeV.js | 9152 | 9064 | -88 |
| assets/bits-DtHZV-gD.js | 510 | 507 | -3 |
| assets/download-BjoTNPCU.js | 2227 | 2279 | +52 |
| assets/index-DrddQ7uj.js (Entry_Chunk) | 101075 | 109126 | +8051 |
| assets/style-*.js | 538 | (not present) | -538 |
| assets/validateCardGrid-ClOvHDqy.js | 2975 | 2978 | +3 |
| Sum of all JavaScript chunks | 128917 | 140392 | +11475 |

Before-Stage-A file names: `CodeViewScreen-D-CiFXEJ.js`, `RepairPanel-BB_TRwHZ.js`, `ScanScreen-02MsZOA5.js`, `bits-DYr9iaPj.js`, `download-C1mhc7Cf.js`, `style-iZjlxjtF.js`, `validateCardGrid-Kwe0StTt.js`. The Scan chunk went from 9,152 to 9,064 bytes. The `style` chunk of the baseline is no longer a separate file and a new shared `Panel` chunk (with its own `Panel-*.css`) appeared, so the rows for those two do not compare like for like; the sum row does.

### Contrast table
Printed by `npm run build && node scripts/contrast_report.ts`; ratios truncated by `truncateRatio`, never rounded up. All 17 pairs meet their minimum in both themes, so **no pair is below AA** and no token value had to change. Day `--zari` stays **`#B0800A`**, not the brief's `#B8860B`, which gives only 2.84:1 on the ground. `--on-zari` and `--on-hole` were added to `THEME_TOKENS` and `tokens.css` together. `design.md` quotes `hole` on `card` as 9.46 (Day) and 8.54 (Night); those are rounded, the truncated ratios are 9.45 and 8.53.

| Pair (foreground on background) | Minimum | Day | Night |
|---|---|---|---|
| ink on ground | 4.5 | 14.05 | 14.97 |
| ink on surface | 4.5 | 15.58 | 13.47 |
| ink-soft on ground | 4.5 | 5.70 | 8.20 |
| ink-soft on surface | 4.5 | 6.32 | 7.38 |
| madder on ground | 4.5 | 6.56 | 5.26 |
| madder on surface | 4.5 | 7.27 | 4.73 |
| indigo on ground | 4.5 | 10.65 | 7.68 |
| indigo on surface | 4.5 | 11.81 | 6.91 |
| leaf on ground | 4.5 | 5.49 | 9.62 |
| leaf on surface | 4.5 | 6.09 | 8.65 |
| on-zari on zari | 4.5 | 4.55 | 10.27 |
| on-hole on hole | 4.5 | 14.96 | 16.42 |
| zari on ground | 3 | 3.08 | 9.37 |
| zari on surface | 3 | 3.42 | 8.43 |
| hole on card | 3 | 9.45 | 8.53 |
| ink-soft on ground | 3 | 5.70 | 8.20 |
| ink-soft on surface | 3 | 6.32 | 7.38 |

### Benchmark decision (R19)
**Approach: the ratio of the alignment time to a baseline measured in the same run** (R19.2, second approach), bound **2.2**. A fixed ceiling cannot work: the first alignment of a worker is slow in about one full suite run in three (about 570 ms against 30 to 60 ms for later ones), so no ceiling above 570 ms can fail on a 2.0 times slowdown of the fast mode, and one below it fails on the slow first alignment. The slowness is compute (JIT tiering of the 4-million-cell loop), not waiting for a core: the CPU time shows the same 449 to 642 ms. Allocating the two tables is 2 to 3 ms and is not the cause.

Before the change (`tests/codec-view/benchmark.test.ts` unchanged, ceiling 1000 ms; three consecutive `npm run test:run` runs, alignment of 2000 x 2000 picks, 10 x 10 hook positions):

| Run | Alignment time | Smaller sizes (250 / 500 / 1000 picks) |
|---|---|---|
| 1 | 32.66 ms | 4.38 / 6.59 / 8.00 ms |
| 2 | 568.85 ms | 8.18 / 2.18 / 20.84 ms |
| 3 | 569.01 ms | 4.80 / 2.98 / 11.09 ms |

Each run had 135 of 136 test files and 1611 of 1612 tests passing; the one failure each time was `tests/scripts/fonts.test.ts` "R1.6" (U+00B7 missing from `RozhaOne-Regular.woff2`), fixed in Stage D (see the defects below).

Variants tried, measured in full suite runs with a placeholder bound of 1000:

| Variant | Full suite ratios |
|---|---|
| two-row baseline, one timed alignment | 28.49, 47.78, 1.94 (alignment 545 / 497 / 45 ms; baseline 10 to 19 ms) |
| two-row baseline, best of 5 | 4.17, 3.58, 5.95, 4.19, 4.26 |
| full `Int32Array` table, best of 5 | 2.91, 1.79, 2.54, 2.74, 2.61, 3.49, 2.96, 2.77 |
| two tables as the alignment keeps, best of 5, wall clock | 0.77, 1.02, 1.30, 1.57, 0.99, 0.77, 2.08, 1.13, 1.26, 1.10 |
| same, best of 9, CPU time (final) | 1.07 to 1.40 over eleven runs |

The final test times the alignment and the baseline 9 times each, alternating, and uses the least of each. The baseline fills a `Uint16Array` and a `Uint32Array` of (picks + 1) x (picks + 1) cells with the same recurrence as the alignment, over the same two interned key arrays; it calls neither `diffPatterns` nor `alignLines`. A smaller baseline did not slow down with the memory traffic of the other test files, so the ratio moved with the load. It fails with `expect(ratio, message).toBeLessThan(2.2)`; the message carries the alignment time, the baseline time, the ratio and the bound, and all nine times of each. Kept: `DIFF_PICK_LIMIT` against `DIFF_PICK_LIMIT`, the smaller sizes (one run each, not asserted), the seed 20_931, and every check of before.

Setting the bound, three consecutive full suite runs (alignment / baseline / ratio): 28.99 ms / 23.27 ms / 1.25; 31.62 ms / 24.50 ms / 1.29; 30.05 ms / 21.42 ms / 1.40. Highest ratio 1.40; 1.5 times it is 2.10; rounded up to one decimal, **2.2**. Today's ratio is 1.25 to 1.40, so 2.0 times it is 2.5 to 2.8 and the bound is below it (R19.3).

After the change, three consecutive full suite runs with the bound 2.2 (the test passed in each; the only failure was `tests/scripts/fonts.test.ts` "R1.6"):

| Run | Alignment | Baseline | Ratio |
|---|---|---|---|
| 1 | 25.60 ms | 23.18 ms | 1.10 |
| 2 | 29.68 ms | 22.09 ms | 1.34 |
| 3 | 29.91 ms | 26.08 ms | 1.15 |

**Slowdown check (R19.8).** `alignLines` temporarily ran `alignCanonical` twice and `npm run test:run` ran three times. The Benchmark_Test failed in all three: ratio 2.38, 2.86 and 2.92 against the bound 2.2 (alignment 53.41 / 59.13 / 65.62 ms, baseline 22.42 / 20.67 / 22.46 ms; message "alignment 53.41 ms, baseline 22.42 ms, ratio 2.38, bound 2.2"). `src/codec-view/align.ts` was then restored from a copy; `git diff --stat src/codec-view` and `git status --short src/codec-view` print nothing.

**Departures from the requirement, on purpose, for the user to accept or reverse.**
1. R19.6 says to keep the timed repetitions at their present value. They went from 1 to **9**, because the data above show that one timed alignment is bimodal and cannot be steady.
2. The time is the **CPU time** of the process (`process.cpuUsage`), not the wall clock, so another test file taking the core does not count. The baseline is the two-table one above, not two `Int32Array` rows.
3. **Weakness when run alone:** the test run on its own has a ratio of 0.93 to 0.96 (CPU time on a quiet machine), so the bound 2.2 is meant for the full suite and would not catch a 2.0 times slowdown of a standalone run (about 1.9 against 2.2).

### "After" inspection (R24)
Three rounds (build, `npm run screenshots -- after`, look at the files). All 24 files in `media/design/after/` were opened; the files of the last round are kept. Defects found and fixed:
- `code-diff-day-1280.png`, `code-diff-night-1280.png`: the Bit_Lines of the diff entries and of the pick list were cut at the right edge (they scroll sideways, R11.8) with nothing that says so. Fix: a visible line "A line cut off at the edge scrolls sideways." (`codeview.scrollHint`, en and hi) above the diff entries (`DiffPanel.tsx`) and above the pick list (`CodeViewScreen.tsx`), and an always-drawn scroll bar in theme colours on `.entries`, `.textArea` and `.bits`. Headless Chrome does not paint the bars in the captures, so the sentence is what the files show.
- `code-diff-day-320.png`, `code-diff-night-320.png`: a diff entry showed only about 20 characters of its Bit_Line, because the marker, the word "Changed" and the pick number took the line before it. Fix: in a container no wider than 40rem (`@container` on `.entries`) the entry is a block, so the Bit_Line and its ^ row take the line below the label (`DiffPanel.module.css`).
- `keep-versions-day-1280.png`, `keep-versions-night-1280.png`, `keep-versions-day-320.png`, `keep-versions-night-320.png`: the contents of "More" (colour choices, Metadata fields, note, save mode) sat on the bare page between two panels. Fix: the "More" Disclosure is inside a `Panel` (`KeepScreen.tsx`).
- `code-diff-*`: the Code view empty state had no Spot_Illustration in one path. `NothingToCompareIllustration` is passed (`CodeViewScreen.tsx`).
- `scripts/screenshots.ts` overlap hint (not a defect in `src/`): it reported 3 pairs on `weave-lost-*-1280.png` (text of a closed `<details>` that the capture's `content-visibility: visible` made measurable) and 307 pairs on `code-diff-*-1280.png` (Bit_Lines scrolled out of their scroll region). The hint now ignores closed `<details>` content and cuts each box by the scroll or clip box of its ancestors. Result: 0 overlapping pairs and no sideways overflow in all 24 files.
- Hindi string `codeview.nextStep` held a hyphen ("एक-एक"), which the Diff_Entry marker rule (R10.6, R10.7; `tests/ui/i18n/messages.test.ts`) forbids. It was found when the new key changed the order of that property's sample. It now reads "…उसकी पिकें एक के बाद एक देखें।" (`hi.json` and `HINDI_REVIEW.md`, still unreviewed). No property was changed.

Seen and left as it is (a choice, not a defect): on the Landing at 1280 the text block is centred in the height of the Hero_Loom (an empty band above "Weave", by design); the cloth canvas on Weave shows an unwoven band above the cloth; the repair panel on Weave 1280 spans the cloth column only. Text and graphic contrast and the gap between adjacent controls looked right in all 24 files (every gap seen is 8 px or more). **Unfixed: none.**

### Changed selectors and checks (old selector, new selector, reason)
Strength was kept in every row: the same text, element or property is asserted, in the element that now carries it.
- `tests/ui/deploy.test.ts` "R13.5": old, no `@font-face` or `@import` in any `src/**/*.css`; new, `@import` is still banned everywhere and `@font-face` is banned in every file except `src/ui/theme/tokens.css`, where each `src` must be a `fonts/*.woff2` path with no scheme or host; the `font-family` check (generic family or `var(--font-*)`) runs on the CSS with the `@font-face` blocks removed. Reason: R1.2 requires four `@font-face` rules in the Token_File. A font declared anywhere else still fails.
- Notice (task 2.10): old `<p role="alert" class=...>TEXT</p>`; new a Notice, `<div role="alert" data-variant="error"><p>icon and word</p><div>TEXT</div></div>`. A new helper `tests/support/notices.ts` (`alertTexts`, `noticeTexts`) returns the text blocks, so the tests (`accessibility.test.tsx` R14.6, `keep.test.tsx` R15.7, `repair.test.tsx` R1.2, five in `code.test.tsx`) assert the same text inside the same role. `scripts/check_browser.ts` (three places): old `[role="alert"]`; first `[role="alert"] > div`, then in task 3.6 `[data-variant="error"] > div` (the Scan read failure no longer has a role of its own, because `read-failed` already dispatches `announce`). Same text block, same equality with `EN['error.read.peg-holes-not-found']`.
- Field (task 2.10): old `<label for=ID>TEXT</label><input id=ID>`; new `<label><span>TEXT</span>CONTROL</label>` (`code.test.tsx` R3.4 R3.5, R6.16, R7.1; `components.test.tsx` R6.8, where the span lost its class). The label names the control by wrapping it.
- Style tests that read a Screen module for a button or field rule now read the shared module (`accessibility.test.tsx` R14.11 and R11.10, `keep.test.tsx` R14, `repair.test.tsx` R6.1): old `.button`, `.input`, `.select` in the Screen modules; new `Button.module.css` `.button` and the control rule in `Field.module.css`, plus a check that the Screens use `<Button` (and `<Field`) and contain no raw `<button`.
- Card drawing (task 4.4): `repair.test.tsx` R3.2, old `fill="currentColor"` and `fill="none"` found once each; new exact counts of `<circle>` with class `punchedHole` and `unpunchedMark` per suggested card (stricter). `accessibility.test.tsx` R14.4: an `<svg>` is also named by a non-empty first-child `<title>`. `accessibility.test.tsx` R14.11: a `(min-width: Npx)` query is also allowed when its block holds no `font` text (R12.4 puts the card beside the cloth from 720 px).
- `src/ui/screens/code/LineRow.module.css` `.line` (task 2.11): old `box-shadow: inset 0 -1px 0 var(--line)` (R3.6 allows only `var(--shadow-card)`); new a 1px `.line::after` strip. `LineRow.tsx` `SELECTED_MARK`: old `▶` (U+25B6, Extended_Pictographic, an emoji under R7.6); new `►` (U+25BA). Three expectations in `code.test.tsx` re-aimed from `▶` to `►`.
- Navigation (task 3.2): `scripts/check_browser.ts` `goTo` and `showScreen`, old `clickText('nav button', LABEL)` (exact text); new `clickNavItem`, the `nav button` whose `textContent.trim()` starts with LABEL, because the Code view item now reads "CodeAdvanced". The next step still waits for the Screen heading to equal the same text.
- Landing (task 3.3): the Weave screen with no pick is the Landing. `weave.test.tsx` R2.8, R3.8 (two) now render `arrivedWith('diamond', ...)`; R2.1 renders the player alone (`renderPlayer`); R4.1 and R2.12 render the `<TryIt>` section alone (`renderTryIt`). `shell.test.tsx` R14.10, `themeSwitch.test.tsx` R4.9 and `announce.test.tsx` use a ready profile, because a loading profile adds a transient `role="status"`. `check_browser.ts` `chooseSample`, "app loads" and the offline "online load": old a `button` whose text is the sample name; new `[data-sample="<design>"]`, because the tile also holds "Try it".
- Code view panel order (task 3.7): `code.test.tsx` R6.6 R6.16, old the panel heading after the pick list; new before the step-back control, the first `data-pick=` and the cloth heading. R11.1: `<select` now comes before the first `data-pick=`. Same number of order checks.
- Shell (task 3.8): `code.test.tsx` R9.10, only the constructor call of `ScreenBoundary` (it takes `t` and `onRetry`). `scan.test.tsx` R13.1 R16.10: old `lazy(() => import('./screens/scan/ScanScreen.tsx'))`; new `importScanScreen = () => import(...)` plus `useLazyScreen(importScanScreen, ...)`, the same fact (a dynamic import, no static import); the `not.toMatch(/^import .*screens\/scan/m)` line is unchanged.
- Plural pick texts (task 5.2): `messages.test.ts` `DESIGN_TABLE_KEYS`, old `codeview.pickCount`; new `codeview.pickCount.one` and `.other`. `check_browser.ts` step 4, old `EN['keep.list.picks']`; new `EN['keep.list.picks.other']`. `stateMessages.test.ts` `ADDED_KEYS` gained the eight new keys.
- Other selectors the scripts use are unchanged: `#screen-title`, `#scan-file`, `#keep-saved`, `keep-delete-ID`, `button[data-shape]`, `button[data-corrected]`, `button[aria-label=...]`, `label span`, `#scan-batch-title ~ ol > li`.
- **The existing R13.5 deploy test was re-aimed to allow `@font-face` in `tokens.css` only** (first row above).

### Disclosure check changes
- `scripts/check_browser.ts`: new `openDisclosure(page, name)`; `openMore` calls it. Old: a `button[aria-expanded][aria-controls]` whose text equals `disclosure.more`; new: the same button found by its accessible name given by the caller. It waits, clicks only when `aria-expanded` is `false`, waits for `true`, and fails with `the Disclosure "<name>" was not found`. `openMore` is called in step 4 (Keep save, before the place field is filled), step 8 (BMP export) and the offline BMP step. No Weave step changes colours, zari or repeat, so none opens "Settings".
- No test in `tests/` had to open a Disclosure: the unit tests render server markup, where collapsed content is still present (`hidden`). The input count in `keep.test.tsx` R7.1 (six text inputs and one textarea) is unchanged.
- `ProfileNotice` (Keep and Scan): the one-line notice stays visible; the status text is inside a Disclosure named by the profile name, not "More", so a script that opens "More" never opens it by mistake.
- Scan "More" is controlled by the screen: collapsed on arrival, opened by `ScanScreen` when a read completes, never moving focus. No `openMore` call is needed on Scan.
- New `check_browser.ts` steps after step 14 (the offline step moves from 15 to 19): 15 Landing, 16 Disclosures (collapsed on arrival, `hidden` panel, real Tab does not enter it, Enter and Space toggle, Escape collapses and returns focus, opening leaves the scroll position unchanged), 17 navigation (`aria-current="page"` on exactly one of 4 items; at 320 px in both languages and themes no overflow or overlap), 18 the primary Button of each Screen is within the first 844 px at 390 by 844.
- `scripts/checks/manualSteps.ts` still says the profile status text is visible on every Scan and Keep frame. It describes the GIFs recorded before this pass and was not edited.

### Hindi wrapping fixes
None. No Hindi file is among the 24 screenshots; the Hindi strings that grow their controls at 320 px are covered by `check:browser` step 17. `codeview.nextStep` and `codeview.scrollHint` wrap in their paragraphs.

### Keys whose Hindi one and other texts are the same
The Hindi word "पिक" does not change with the count, so no separate Hindi singular is needed; both entries are kept so that `hi.json` and `en.json` have the same keys: `keep.list.picks` ("{count} पिक" for 1 and for every other count), `codeview.pickCount` (same), `codeview.diff.option` ("{name} ({count} पिक)" for 1 and for every other count).

### Defects found along the way
- **First-visit "A newer Naqsha is ready" notice** (found in task 3.8, fixed in `src/ui/serviceWorker.ts`). `registerServiceWorker` treated every worker that reached `installed` as an update waiting. On a first visit the first worker also fires `updatefound` and `installed`, so the Shell showed the notice and pushed the content down. The cache name is a content hash and does not change between loads, so that was ruled out. Fix: `ContainerLike` has `controller`; the `updatefound` handler reads `container.controller !== null` before the worker installs, and only an update of a controlled page reaches `new-worker-waiting`. The R24.5 tests pass unchanged; one test was added for a first install followed by a genuine update.
- **Keep primary button pushed below the fold** (found by `check:browser` steps 16 and 18). The one-line profile notice, the "Card profile:" label and the profile Disclosure sat above the export button; opening the Disclosure moved the button from 776 to 824 px to 842 to 890 px, out of the 844 px viewport (R10.7), and in Hindi it ended at 860 px (R23.7). Fix: `ProfileNotice` takes `part` (`all`, `notice`, `details`); the export panel draws the one-line notice above the button and the name and Disclosure at the end of the panel. The Code view compare panel had the same problem (Compare ended at 886 px en and 945 px hi); after moving the hint into the result and the notices below the choosers it ends at 728 px and 777 px.
- **The ▶ pictograph replaced by ►** (task 2.11, see the changed selectors): `▶` is Extended_Pictographic, an emoji under R7.6.
- **Fonts re-subset for the middle dot** (task 5.8). The new key `codeview.diff.separator` uses U+00B7. All four source `.ttf` files have it, but the `.woff2` files were subset before the key existed, so `tests/scripts/fonts.test.ts` R1.6 failed in every full suite run from task 5.4 on. `scripts/fonts/subset.sh` was run again; the four `.woff2` files changed and now hold U+00B7; `missing-glyphs.json` and the test are unchanged.
- Step icon too big (task 4.6): with a 56 px icon the Landing's first tile ended at 713 px (en) and 705 px (hi) against the 700 px limit. Fixed by a 32 px icon and a 0 gap; all 19 `check:browser` steps passed.
- Two violations of the style test in `src/ui` (task 2.11): the `box-shadow` and the `▶` above. The source was fixed, not the test.

### Other decisions
- Behaviour change in Keep export: `onExport` now waits one `setTimeout(0)` before it builds and downloads the file, so the browser can paint the delayed Thread_Progress. `runExport` is unchanged; `check:browser` steps 8 and 19 (BMP export, online and offline) still pass.
- No width media query is allowed in a module style sheet (`accessibility.test.tsx` R14.11), so the Landing asks its own width with a container query (`@container (min-width: 40rem)`) and sizes the headline with `clamp()`.

**Kiro features used:** spec (requirements, design, tasks for `design-and-ux-pass`), steering (glossary, structure, testing), sub-agent task execution, property-test and example-test rules, the screenshot and `check:browser` scripts.
**Commits (five, in this order):** `63578cf` Stage 0 (screenshot tooling and the "before" screenshots, taken before any Stage A change, R24.1); `a9883e8` Stage A (fonts, tokens, theme switch, base components); `a56dac5` Stage B (Landing, navigation, Disclosures, friendly states); `6c80a79` Stage C (card drawing, Hero_Loom, Step_Icons, Spot_Illustrations, "after" screenshots); `559da00` Stage D (version labels, singular picks, finished cloth on return, steady benchmark, loom-mcp design fix). The documents of tasks 6.1 to 6.3 are folded into the Stage D commit (task 6.6).
---

## 2026-11-21 (cards-as-code phase 4, task 4.4: the bundle numbers, what was cut, and the documentation)
**Goal:** Close the R9.4 record for Code view: the four byte counts, the precache total, what was built, what was measured, what was cut, what stays open, and the R8.10 dependency check. Measured on this machine (Node v24.5.0, darwin arm64) on branch `auto/build` at `32ec32b` (the 4.3 commit) with only spec status files (`.kiro/specs/cards-as-code/tasks.md`, `tasks.meta.json`) modified. Nothing was committed.

### The four R9.4 byte counts (`npm run build`, then `npm run check-bundle`, both exit 0)
| R9.4 number | Value | Source |
|---|---|---|
| Gzipped entry chunk **before** this feature | **94,191 bytes** (`./assets/index-BxQUVtbs.js`) | Task 1.1 (entry above), measured on the working tree at `28ed91b`, the last commit before the first cards-as-code commit `493055e` |
| Gzipped entry chunk **after** this feature | **109,570 bytes** (`./assets/index-Czo1BVeg.js`) | `check-bundle` today. **It includes the design pass**, which landed after the feature was built (see the split below) |
| Gzipped size of the Code view chunk | **10,042 bytes** (`assets/CodeViewScreen-DUaaI3MN.js`) | `check-bundle`, line `Code view chunk:` |
| Limit | **204,800 bytes** (unchanged; not raised) | `ENTRY_CHUNK_LIMIT_BYTES = 200 * 1024` in `scripts/check_bundle.ts`; the line reads `(limit 204800)` |

The real output of today's `npm run check-bundle` (`npm run build` printed `✓ 170 modules transformed`, `index-Czo1BVeg.js 374.84 kB │ gzip: 111.04 kB`, `precache: 26 entries in cache naqsha-v1-44056bb4531a`; vite's `gzip:` figure differs from the check's because the check gzips at level 9 and counts bytes):
```
entry chunk: ./assets/index-Czo1BVeg.js, 109570 bytes gzipped (limit 204800)
chunk: assets/CodeViewScreen-DUaaI3MN.js, 10042 bytes gzipped
chunk: assets/Panel-ChUTrmoB.js, 3908 bytes gzipped
chunk: assets/RepairPanel-Bq05uOIJ.js, 3026 bytes gzipped
chunk: assets/ScanScreen-BkuXnqtG.js, 9078 bytes gzipped
chunk: assets/bits-Dgmg86ll.js, 508 bytes gzipped
chunk: assets/download-KT2praNC.js, 2279 bytes gzipped
chunk: assets/index-Czo1BVeg.js, 109570 bytes gzipped
chunk: assets/validateCardGrid-ClOvHDqy.js, 2978 bytes gzipped
Scan chunk: assets/ScanScreen-BkuXnqtG.js, 9078 bytes gzipped
Code view chunk: assets/CodeViewScreen-DUaaI3MN.js, 10042 bytes gzipped
precache: 26 entries in cache naqsha-v1-44056bb4531a
icon: ./icons/icon-192.png, 192x192
icon: ./icons/icon-512.png, 512x512
bundle check passed
```
**The "before" number was re-measured, not only quoted.** The tree at `28ed91b` was exported with `git archive` into a temporary directory (using this repository's `node_modules`), built and checked: `entry chunk: ./assets/index-BxQUVtbs.js, 94191 bytes gzipped (limit 204800)`, `precache: 13 entries in cache naqsha-v1-be994549d044`, the same file name hash and cache name as task 1.1 recorded. The directory was deleted afterwards.

**What the 15,379 bytes between "before" and "after" hold. This is not the cost of Code view alone.**
| State | Entry chunk, gzipped | Step | Where it is recorded |
|---|---|---|---|
| `28ed91b`, before the feature | 94,191 | | task 1.1 |
| Phases 1 to 3 of this feature (`aee11b9`) | 97,686 | **+3,495** | the phases 2 and 3 entry; Code view chunk 9,414 bytes then |
| Before design pass Stage A (`63578cf`) | 101,075 | +3,389 | the design pass entry; the span holds version-history, repair-suggestions and loom-mcp work, none of it measured separately |
| After the design pass (today) | 109,570 | **+8,495** | the design pass entry (fonts, tokens, Landing, Hero_Loom, illustrations, shared components) |
Only the first step, +3,495 bytes, is measured as Code view's own cost on the entry chunk (the lazy `import()`, the fourth navigation entry, the `AppState` fields, the first 60 translation keys in two languages, the shared state code). The +3,389 between `aee11b9` and `63578cf` is not split between version-history, repair-suggestions and anything else; I did not measure at the commits between. The Code view chunk grew from 9,414 to 10,042 bytes (+628) over the same span, which holds the version-history and repair-suggestions Code view changes and the design pass. The entry chunk is 95,230 bytes under the limit.

### Precache total (requested beyond R9.4)
**Total precache size: 641,024 bytes** (raw file sizes, not gzipped) across the 25 files that the 26 entries of the precache list in `dist/sw.js` name (cache `naqsha-v1-44056bb4531a`).
**How it was computed.** A throwaway script (`/tmp/precache_total.ts`, not committed) read `dist/sw.js` with the repository's own `readPrecacheBlock` (`scripts/checks/precache.ts`), took each entry, resolved it against `dist/`, and added up `fs.statSync(file).size`. The entry `./` is the start page and has no file of its own: the worker serves it from `./index.html`, which is already an entry (1,429 bytes), so `./` is skipped and counted once. No listed file was missing from `dist/`. Cross-check with another tool: `find dist -type f ! -name sw.js` and `stat -f %z` summed give **25 files, 641,024 bytes**, the same number; this also confirms that the list names every file of `dist/` except `sw.js` (R9.5). I did not change `scripts/check_bundle.ts` to print this, so no assertion changed.
Largest entries:
| Bytes | Entry |
|---|---|
| 374,840 | `./assets/index-Czo1BVeg.js` (gzipped: 109,570) |
| 41,184 | `./fonts/RozhaOne-Regular.woff2` |
| 39,468 | `./fonts/Hind-Regular.woff2` |
| 36,576 | `./fonts/Hind-Bold.woff2` |
| 30,405 | `./assets/CodeViewScreen-DUaaI3MN.js` (gzipped: 10,042) |
| 26,179 | `./assets/ScanScreen-BkuXnqtG.js` |
| 19,857 | `./assets/index-DhbMZ6pU.css` |
| 10,469 | `./assets/Panel-ChUTrmoB.js` |
The entry chunk gzipped size asked for beside it is **109,570 bytes**. The precache total is bytes on disk, which is what the worker stores; what a first visit downloads over the network is smaller if the host compresses. Code view's share of the precache: its chunk and its stylesheet (`CodeViewScreen-BLTQXRjR.css`) are two of the 25 files. At `28ed91b` the precache held 13 entries; its byte total was not measured then.

### R8.10: `package.json` `dependencies`
**Unchanged.** `git show 28ed91b:package.json` and `git show HEAD:package.json` both give `"dependencies": {"react": "^19.3.1", "react-dom": "^19.3.1"}`, and the working-tree `package.json` equals `HEAD`. `devDependencies` are also identical (8 entries, same names and ranges). `git diff 28ed91b HEAD -- package.json` shows three added `scripts` lines only (`typecheck:loom-mcp`, `test:loom-mcp`, `screenshots`, added by the loom-mcp work and the design pass, not by Code view) and no change to a dependency list; `package-lock.json` has no commit in that range. `28ed91b` is the commit before the first cards-as-code commit `493055e`, found with `git log`.

### What was built
`src/codec-view` (six files, 1,156 lines): Bit_Lines (`cardToBits`, `patternToLines`, `groupBits`), the alignment (`lineKey`, `alignLines`), the Diff (`diffPatterns`, `applyDiff`) and the Diff_Text (`diffToText`), with 7 test files in `tests/codec-view/` holding properties P1 to P8 and P10 and the boundary test. In `src/ui`: `AppState.selectedPick` and `breakpoints` shared by Weave and Code view, `src/ui/state/codeView.ts` (Window, breakpoints, jump parse, accessible names, focus helper), the lazy fourth Screen `src/ui/screens/code/` (listing, step, jump, run to the next breakpoint, the cloth beside the current card, the diff panel with the plain-text export), 66 `codeview.*` keys in English and Hindi today (60 were added by task 2.3; all 66 Hindi strings, and `error.codeview.load`, are `reviewed: false`). In `scripts/` and `tests/`: `check_bundle.ts` parameterised over `CHUNK_MARKERS` (Scan and Code view), the precache test for the Code view chunk, and `check:browser` steps for the Code view at three widths and offline. Details of each phase are in the three earlier cards-as-code entries.

### The 2,000 x 2,000 diff (task 1.21), and the benchmark after the design pass
Task 1.21 measured (entry above): **25.59 to 27.36 ms in four standalone runs and 49.61 ms inside the full suite**, against a fixed 1,000 ms ceiling, on 10 x 10 hook positions, `DIFF_PICK_LIMIT` picks a side. A Phase 2 full run had read 520 ms for the same alignment. The design pass then replaced the fixed ceiling with a **ratio test** (alignment time over a baseline measured in the same run, bound **2.2**, nine repetitions each, CPU time; numbers in the design pass entry: ratios 1.07 to 1.40 over eleven full suite runs, 0.93 to 0.96 standalone). Re-run today, standalone, `npx vitest run tests/codec-view/benchmark.test.ts`: alignment **22.05 ms** (best of nine), baseline 23.81 ms, **ratio 0.93**, bound 2.2; smaller sizes 11.53 ms (250), 4.03 ms (500), 13.16 ms (1000). A standalone run cannot show a 2.0 times slowdown (0.93 times 2.0 is 1.9, under the bound); only the full suite run can, as the design pass entry says. This is a laptop number, not a phone number: the 100 to 300 ms estimate for a phone is still unmeasured.

### The listing timings of task 3.10: not done, there are none
Task 3.10 (listing timing at 10,000 picks, R2.6 and R2.10) is unticked and was **not written**: `grep` finds no `performance.now`, no timing and no ceiling in `tests/ui/screens/code.test.tsx`, so **no listing timing exists to report**. What it leaves unchecked: that a 10,000-pick listing renders its Window inside a stated time, and that moving the Selected_Pick renders the moved Window inside a stated time, in jsdom. What does exist instead is structural: `code.test.tsx` renders 10,000-pick patterns and asserts at most `WINDOW_SIZE` (80) `li.line` elements, a full-height spacer, and that the Window moves to the Selected_Pick; no time is read. Still unmeasured anywhere: R2.10's 1,000 ms and 100 ms on a phone. `check:browser` step 13 opens Code view on a 36-pick sample only.

### Existing tests changed by task 2.1 (commit `fa04deb`)
The task named four files; `git diff fa04deb~1 fa04deb -- tests` shows what really happened:
- `tests/ui/state/playback.test.ts` is the **only file in which an existing line was changed**. `PlaybackState` lost its `pick`, so `stateArbitrary` no longer has a `pick` field, `entryPlayback` and `displayedPlayback` gained a `selectedPick` argument, and the expectations in "R2.8 R3.6 R14.9 each entry gets its own position", "R2.10 the player's own report is shown while it is about the cloth on screen" and the property "R2.10 R3.6 the position shown for a cloth is one of that cloth's own positions and carries nothing of the design shown before" were rewritten to the new signatures. One assertion moved: the property used to check that `displayed.pick` is an integer between 0 and the pick count; it now checks that on `entryPlayback(...)`, and the next line still asserts `displayed` equals that entry, so the same fact holds. The "keep" check went from `previous.pick` to the `selectedPick` argument; the "a design not shown before takes nothing from the previous position" check is kept with a second generated `selectedPick`. The property still runs on its own seed and `numRuns`; no `numRuns`, seed or arbitrary range was narrowed. New in the same file: five example tests for arriving on Weave after Code view moved the Selected_Pick (R4.2).
- `tests/ui/state/appState.test.ts` (+78 lines), `tests/ui/screens/weave.test.tsx` (+6 lines: one new test, "R4.1 the cloth choices shown are the ones held in the app state") and `tests/ui/state/cloth.test.ts` (+12 lines: two tests of `buildReadyCloth`) **only gained tests**; no line of an existing test changed.
- `tests/ui/screens/weaveWiring.test.ts` is named by the task and was **not changed** by it (its last commit is `390524a`).
The task's own note lists `cloth.test.ts` and not `appState.test.ts`; the diff has both. Later changes to Weave tests came from other tasks and are recorded where they happened: the Phase 3 entry (shell and accessibility tests) and the design pass entry (Landing: `weave.test.tsx` R2.1, R2.8, R3.8, R4.1, R2.12 re-aimed).

### Cuttable tasks dropped, checked against the repository
Marked `[~]` and unticked: 2.7, 2.8, 2.9, 3.9, 3.10. Each was checked in the code and tests, not taken from the earlier log.
| Task | In the repo? | Dropped | What it leaves unchecked |
|---|---|---|---|
| 2.7 `focusTargetAfterWindowMove` | **Built.** The function is `src/ui/state/codeView.ts:283`, used at `src/ui/screens/code/Listing.tsx:194` (written for task 3.8). Its example tests are in `tests/ui/screens/code.test.tsx` (about lines 1865 to 1891), covering a breakpoint control whose Line left the Window, a Bit_Line region still in the Window and a damaged Selected_Pick, plus the `null` and `step-forward` cases | Only its place: the task names `tests/ui/state/codeView.test.ts`, the tests are in `code.test.tsx`. The tick was never set. No property was required by the task | Nothing beyond the task's own example list. Whether focus really lands where the helper says in a browser is **not checked** by anything (R11.13); `check:browser` does not press a control and scroll the Window |
| 2.8 P9, the Window holds at most Window_Size Lines and always holds the Selected_Pick | **Not written.** `tests/ui/state/codeView.test.ts` has no fast-check at all. Examples instead: `windowFor` at 0, 1, fewer than 80 and 10,000 picks and clamping (`codeView.test.ts` lines 47 to 132), and `code.test.tsx` R2.11 over four hand-picked scroll positions | P9 | The invariant over any pick count from 0 to 10,000, any Selected_Pick, any scroll position and any `visiblePicks` from 1 to `WINDOW_SIZE`. Note the decision still open from the Phase 3 entry: `listingWindow` lets the viewport win over the Selected_Pick, a literal departure from R2.4's "always holds the Selected_Pick"; P9 as worded would have tested that, and nothing does now |
| 2.9 reducer property (R3.1) | **Not written.** Examples exist in `tests/ui/state/appState.test.ts`: "R3.1 R3.2 select-pick leaves the Current_Pattern and the breakpoints unchanged", "R3.10 toggle-breakpoint adds and removes ...", "R3.10 the breakpoints and the pick survive navigating away and back", "R3.10 R4.6 every action that replaces the Current_Pattern sets pick 0 and discards the breakpoints" | The property over action sequences | That the Selected_Pick stays within `0..lastPick` and the breakpoints stay ascending without repeats across any mix of `select-pick`, `toggle-breakpoint`, `navigate` and the pattern-replacing actions |
| 3.9 R4.7 one `renderFrame` image on both screens | **Not written.** No test in `code.test.tsx` mentions R4.7. By structure only: `CodeViewScreen.tsx:14` and `WeavePlayer.tsx:44` import `ClothCanvas` and `createClothPlayer` from the same file `weave/ClothCanvas.tsx` | The test | That both screens paint the image of one `renderFrame` call for the same PreparedCloth, RenderSettings and pick. `check:browser` hashes the canvas only on Weave (`CANVAS_STATS`), so what the Code view canvas holds is **not checked by any run** |
| 3.10 listing timing at 10,000 picks | **Not written** (section above) | The two timing tests | The jsdom times of the first render and of a Window move at 10,000 picks |
**A finding about a ticked task.** Task 2.6 is ticked `[x]` and is demo-essential, but its property (`it('R11.3 a Line accessible name names its pick and its punched ends', …)` over `lineArbitrary(profile)`, both Line kinds and both dictionaries) **does not exist**: `tests/ui/state/codeView.test.ts` imports no fast-check, and `lineAccessibleName` and `diffEntryAccessibleName` have only example tests (`codeView.test.ts` from line 258) plus an example in `tests/ui/i18n/messages.test.ts:238`. The Phase 3 entry lists it among the skipped properties; the tick does not say so. It leaves unchecked: that the accessible name of any generated Line lists exactly the punched ends in ascending order with no Group_Separator, in English and in Hindi, and that the Hindi name holds no English word (R10.8). P1 to P8 and P10, the eight demo-essential properties, all exist; this one is a ninth property that the task asked for and did not get. `src/ui` is outside the modules `testing.md` requires a property for, so no structure test flags it.
**Update, 2026-11-21:** the statement above that the R11.3 property "does not exist" is no longer true. The property was added on 2026-11-21 in `tests/ui/state/codeView.test.ts` (seed 211103, 300 runs, no counterexample found). Its generator only produces ungrouped Bit_Lines, so the end indices of a grouped Bit_Line are not covered.
The properties P1 to P8 and P10 were not weakened by anything in this task; this task changed no test.

### Browser run, today
`npm run check:browser` on the build above: **19 of 19 steps passed, exit 0**. Step 12 measured the Code view at 320, 390 and 1280 px, in English and Hindi, Day and Night, with `scrollWidth` equal to `innerWidth` each time (for example `code at 320 (en, day): scrollWidth 320, innerWidth 320`). Step 18 put the Code view's primary Button ("Compare") at 716 px (English) and 765 px (Hindi) of the 844 px viewport. Step 19, group A and group B, both passed `the first Code view open works offline: listing arrived with no network; "36 picks" shown, 36 of at most 80 Lines in the document, Selected_Pick 0 then 1 after one step forward`, with the service worker's cache `naqsha-v1-44056bb4531a` holding 26 precached responses and the preview server stopped. That is headless Chrome on this laptop only.

### Manual checks left open
Nothing of Code view is in `scripts/checks/manualSteps.ts` (`check:manual` has no Code view step), so none of these is walked through by a script. Not checked by any script or by me:
- **Real devices.** Code view on a phone, in Safari, in Firefox. R2.10's 1,000 ms and 100 ms, and the 100 to 300 ms diff estimate, are laptop numbers only.
- **Keyboard and screen reader.** Tab order, the focus ring and its contrast, focus after the Window moves, the live-region announcements, a screen reader reading a Line (R11.3) or a Diff_Entry (R11.5) aloud. Only the markup is tested, in Node.
- **Clipboard and download.** Copy of the Diff_Text and its file download in a real browser.
- **The `1lh` sizing of the Diff_Text box** (the glossary-driven replacement of `rows`): the design pass screenshots of the Code view (`code-diff-*`) were opened by a sub-agent only, and I did not check that they show the Diff_Text box; no person has looked.
- **The lazy chunk's failure path** (`error.codeview.load`) with a real failed `import()`: tested through `screenErrorKey` only.
- **Hindi.** Every Code view string is `reviewed: false`; `docs/HINDI_REVIEW.md` lists them for a native speaker (`npm run review-list` run today wrote the same file: no change, because it was already current; 67 rows name Code view: the 66 `codeview.*` keys and `error.codeview.load`).
- **The deployed site.** It is an older build; `check:deployed` was not run, so nothing says Code view is live there.
- **The open decision from Phase 3**: `listingWindow` (`src/ui/screens/code/Listing.tsx:63`) still lets the viewport win over the Selected_Pick, a departure from R2.4's "always holds the Selected_Pick"; I read the function today and it is unchanged, and no decision is recorded. (The other Phase 3 item, a finished cloth re-entered from Code view arriving one pick short, was changed by the design pass, Stage D "the finished cloth on return to Weave"; I did not re-test it here.)

### Documents written in this task
`docs/BUILD_LOG.md` (the task 1.1 table rows and this entry), `docs/KIRO_USAGE.md` (section 10, Code view), `README.md` (one line for Code view in the table "What it does"), and `npm run review-list` run for `docs/HINDI_REVIEW.md` (the file came out unchanged, so it has no diff). The README line was not checked against a live site. The README status paragraph still says "three screens (Weave, Scan, Keep)" and the architecture paragraph lists six modules; neither was changed, because the task asked for one line.

**Kiro features used:** spec (`cards-as-code`: requirements, design, tasks), steering (`structure.md`, `weaving-glossary.md`, `testing.md`), property tests with fast-check, sub-agent task execution.
**Evidence saved:** the quoted output above; `dist/` is not committed.

## 2026-11-21 (second design pass, run 1, task 1.2: README count, media move, decisions)
Each statement below was checked against the repository on this date, not copied from the earlier log.
### README and media
- `README.md`, status paragraph: "three screens (Weave, Scan, Keep)" became "four screens (Weave, Keep, Scan, Code view)". The four come from `type Screen = 'weave' | 'keep' | 'scan' | 'code'` in `src/ui/types.ts:5` and the four directories in `src/ui/screens/` (`code`, `keep`, `scan`, `weave`). The status paragraph also gained one sentence on Code view. The table "What it does" already holds the full statement (one line of bits per pick, breakpoints, a diff against a saved design with a plain-text export), so the requested sentence was not added a second time.
- `media/loom-mcp-connected.png` and `media/loom-mcp-validate-profile.png` were still in `media/` and tracked. They moved with `git mv` to `media/kiro/` (a new directory). A search of the repository (outside `node_modules`, `.git` and `dist`) found no reference to either file name in `README.md`, `docs/`, `src/`, `scripts/` or `tests/`. The only mentions are in `.kiro/specs/design-and-ux-pass/` (requirements, design, tasks, measurements), which describe the state at that time and were left as written. `tests/ui/readme.test.ts` counts GIFs and the banner in `media/` only, and the two PNGs are not among them.
### DECISION: `listingWindow` lets the viewport win over the Selected_Pick
- **What it does.** `listingWindow` (`src/ui/screens/code/Listing.tsx:63`) first asks `windowFor` (`src/ui/state/codeView.ts:40`) for a Window that holds both the Selected_Pick and the visible Lines. If that Window does not cover the visible Lines (`windowCoversView`), it returns the Window for the first visible pick instead. When the user has scrolled so far from the Selected_Pick that both cannot fit in `WINDOW_SIZE` (80) Lines, the visible Lines are in the document and the Selected_Pick's Line is not.
- **The departure.** R2.4 of `cards-as-code` says the Window "holds the Line of the Selected_Pick". In that case it does not. The doc comment above the function states the same.
- **Why it was left.** The other choice is to keep the Selected_Pick's Line and leave the viewport without Lines, which shows an empty listing while the user scrolls. R2.11 asks that every Line inside the viewport is in the document, and the two cannot both hold once the user scrolls more than one Window away. The doc comment gives the reason: the viewport is never left without Lines. This was the choice made in task 3.2, recorded then as "User decision pending", and no one has revisited it.
- **What it affects.** Only the case of a scroll far from the Selected_Pick. Moving the Selected_Pick (step, run to a breakpoint, a click) scrolls the listing to it, and both fit again (R2.7). While the Selected_Pick's Line is out of the document, its Line (the one with `aria-current`, `LineRow.tsx:96`) and its controls are not in the DOM, and when focus was on a Line that left the Window, `focusTargetAfterWindowMove` (`src/ui/state/codeView.ts:283`, used in `Listing.tsx`) sends focus to the step forward control. No test pins this case: `tests/ui/screens/code.test.tsx` (R2.11, about line 265) checks only that the visible Lines are covered and that the Window stays at most `WINDOW_SIZE`.
- **Status.** A decision of the build, not confirmed by the user. It stays open until the user says otherwise.
### Cuttable tasks dropped (cards-as-code 2.8, 2.9, 3.9, 3.10)
All four are unticked in `.kiro/specs/cards-as-code/tasks.md`. None was written.
| Task | What exists instead | What it leaves unchecked |
|---|---|---|
| 2.8 P9, the Window holds at most `WINDOW_SIZE` Lines and holds the Selected_Pick | Example tests of `windowFor` in `tests/ui/state/codeView.test.ts` (0 picks, 1 pick, fewer than 80, 10,000 picks, clamping) and four hand-picked scroll positions in `code.test.tsx` R2.11. No property covers `windowFor` or `listingWindow` | R2.4, R2.6, R2.7 and R2.11 are checked by no property, only by example tests of the window function. Over any pick count to 10,000, any Selected_Pick and any scroll position, nothing checks the size bound or the covered-view rule. Nothing tests the departure above either |
| 2.9 reducer invariant (R3.1) | Examples in `tests/ui/state/appState.test.ts` (select-pick clamping, toggle-breakpoint keeping the list ascending without repeats, breakpoints surviving navigation, pattern-replacing actions resetting pick and breakpoints). The one action-sequence property in that file checks only that navigation keeps the Current_Pattern | That one Selected_Pick and one breakpoint set exist and stay valid (pick within 0 to last pick, breakpoints ascending without repeats) over generated sequences of `select-pick`, `toggle-breakpoint`, `navigate` and the pattern-replacing actions |
| 3.9 R4.7, both screens paint the same image | By structure only: `CodeViewScreen.tsx:14` and `WeavePlayer.tsx:44` both import `ClothCanvas` and `createClothPlayer` from `weave/ClothCanvas.tsx`. No test in `code.test.tsx` mentions R4.7 | R4.7 has no test: nothing compares the image the Code view paints with the image Weave paints for the same PreparedCloth, RenderSettings and Selected_Pick. `check:browser` hashes the canvas on Weave only (`CANVAS_STATS`) |
| 3.10 listing timing at 10,000 picks | Structural tests only: at most `WINDOW_SIZE` `li.line` elements and a full-height spacer for a 10,000-pick pattern. `code.test.tsx` does not read `performance` | R2.10's 1,000 ms (first render) and 100 ms (moved Window) at 10,000 picks are not measured anywhere, in jsdom or on a phone |

## 2026-11-22 (second design pass, run 1: cleanup, imagery, design system, Landing)

One entry for the whole run. The work list is `.kiro/specs/second-pass-run1/tasks.md`, the rules are in `brief.md` beside it, and every number and every changed check is in `measurements.md` there. Four commits on `auto/build`: `cleanup before second pass` (`d598e0e`), `imagery: photos wired in, app-made pictures, process loop` (`63befcb`), `design system: tokens, header, buttons, cards, section header` (`c799a01`) and `Landing: hero and sections` (this gate, task 4.5). Run 2 (the other screens and motion) was not started.

### Cleanup (task 1)
- The R11.3 accessible-name property was written in `tests/ui/state/codeView.test.ts` (seed 211103, 300 runs, no counterexample found). See the update line in the task 4.4 entry above.
- README count of screens (four), the loom-mcp screenshots moved to `media/kiro/`, and the entry of 2026-11-21 above record the `listingWindow` decision and the four dropped cuttable tasks (2.8, 2.9, 3.9, 3.10).

### Imagery (task 2)
- Six licensed AVIF photos in `public/photos/` (335,824 bytes); originals and `manifest.json` stay in `media/photos-source/`, outside `public/`, and are not in `dist/`. The orchestrator re-checked every licence through the Wikimedia Commons API on 2026-11-21: all five sources match `manifest.json` and `docs/IMAGE_CREDITS.md` (CC BY 2.0 and CC BY 3.0), none flagged NonFree. The footer credit list is generated from `docs/IMAGE_CREDITS.md` at build time (`?raw` import and the parser in `src/ui/state/imageCredits.ts`); a test checks that it covers every file in `public/photos`.
- Nine app-made AVIF pictures in `public/art/` (239,239 bytes), drawn by `scripts/make_art.ts` with the real card renderer, `prepareCloth` and `renderFrame`: the demo card for three samples, the pattern grid, the cloth for four samples and a chain of eight laced cards. Photos and art together are 575,063 bytes (limit 600,000).
- `ProcessLoop` (`src/ui/illustrations/ProcessLoop.tsx`): a Canvas component that runs the real pipeline in a cycle of six to eight seconds, with a still finished frame under reduced motion, a pause button, a pause when off screen and a text alternative. It is used on the Landing hero. The optional use in the Weave player was not done; Weave is unchanged.

### Design system (task 3)
- Heading serif: Newsreader, roman and italic, Latin only, 29,108 bytes of new font (limit 80,000), licence text and README credit added; Devanagari headings keep Rozha One. The README now names four font families.
- New palette (cream and forest green by day, near-black green and amber at night), spacing, radius and shadow tokens, a frosted header surface at alpha 0.95 (floor 0.85 is a test). Pill header with a menu Disclosure below 360 px, built with container queries so the "no `@media`" style rule still holds. Shared `Button` as a pill with a 2 px lift, new `Card`, `Chip`, `Eyebrow` and `SectionHeader`.
- To allow exactly what the brief allows, `tests/ui/theme/styles.test.ts` and `tests/ui/deploy.test.ts` were relaxed only as far as needed, each with its own narrowness test; every edit is listed with its reason in `measurements.md`, "Changed checks".

### Landing (task 4)
- Seven sections in one entry chunk: hero (tinted loom photo, headline with one accent word, "Scan a card" and "Try a sample", three facts, the tilted Process_Loop, an inline-SVG curved divider), How it works, What you can do, Try a sample, Night (a button that switches the theme), the green "Bring a card" band and the cream footer with licence, repository link, the Kiro and Claude line, font credits and the photo credits. The hero's pick count is the length of the Diamond sample, computed, not typed. No ratings, guest counts, prices or testimonials.
- Scroll reveal (fade and 12 px rise, once, none under reduced motion, nothing hidden when IntersectionObserver is missing). A screen change scrolls to the top (a defect found by `check:browser`, below).
- `npm run screenshots` has a second set: four full-page Landing views (390 and 1280, day and night) in `media/design/after-run1/`. The orchestrator opened them.

### Numbers (verified on 2026-11-22; details in `measurements.md`)
- Entry chunk **126,022 bytes** gzipped (limit 204,800; Landing limit 150,000). Lazy chunks: Code view 10,037, Scan 9,074, Panel 3,909, RepairPanel 3,026, validateCardGrid 2,978, download 2,279, bits 506. The Landing sections are in the entry chunk; no lazy section chunk was needed.
- Images: photos 335,824 + art 239,239 = **575,063 bytes**. Fonts: 29,108 bytes new, 153,028 bytes in all six files.
- Contrast: 84 pairs (42 per theme), all meet their minimum. Tightest: Day zari on the frosted header 3.05 (minimum 3), Day on-zari on zari 4.55 (4.5), Day zari on ground 3.08 (3), Day accent on ground 4.59 (4.5), Day ink-soft on tint 4.72 (4.5).
- Runs, all exit 0: `review-list`, `typecheck`, `test:run` (144 files, 1,947 tests; the benchmark ratio was 1.30 against a bound of 2.2, no rerun needed), `build` (precache 44 entries), `check-bundle`, `check:browser` (19 of 19 steps), `node scripts/contrast_report.ts`, `tests/scripts/precache.test.ts` (15 tests), `check:all` (9 PASS, 0 FAIL, 1 SKIPPED, 1 INFO).

### Changed checks
None was lowered. They are listed one by one in `measurements.md`, "Changed checks", with the reason. The short version: the gradient, backdrop-filter and shadow style rules were relaxed to the brief's allowed effects only; the token scales tests list the extended scales; two button tests follow the token rename from zari to primary; the Landing tests and `check:browser` steps 14 and 15 and the offline Landing check were re-aimed at the same claims (named by accessible name) because the hero, the step strip and the sample tiles changed; `deploy.test.ts` R23.7 allows exactly the footer's credit and repository links; `check:browser` and `screenshots` open the header menu by its accessible name below 360 px; the stricter 150,000 B entry limit and the picture-decoded offline checks were added. New example tests only; no property test was written except the R11.3 property of task 1.1.

### Defects found by looking at screenshots
- "HOW IT WORKS" wrapped onto two lines at 1280 px, because the eyebrow line was as wide as its content and left the hairlines no room. Fixed in `Eyebrow.module.css`.
- A double full stop after "IBM Corp." in the footer font credits; the font credit lines were 56 px apart (an inline-block link); the footer links wrapped "Code" onto a second line at 390 px. All three fixed in `LandingEnd`.
- A 60 px strip of page ground under the footer (main's bottom padding plus the live region). On the Landing only, the padding is removed and the live region is visually hidden but kept.
- Landing links used `--indigo`; they now use `--primary` with an underline (pair already in the contrast table).
- The "Bring a card" band had text only; it now holds the chain-of-eight picture too (no new bytes).

### Defects found by checks, not by looking
- The first pill header was 248 px tall in English, and `check:browser` steps 15, 16 and 18 (390 by 844) failed; the final header is 198 px. The same steps failed again at the Part 1 gate when Tabs padding grew to 16 px; the header Tabs got their 12 px back. No limit was changed.
- On Keep, `check:browser` step 8 timed out in 3 of 4 runs because the long Landing left the next screen scrolled down. `App.tsx` now scrolls to the top on a screen change; after that the step passed 19 of 19 in three runs.
- When Button became a pill, the Sample tiles (which wear the Button classes) turned into large ovals; they got their own radius.

### Not checked by eye
- Hindi full-page views: Hindi captures were opened during tasks 4.2 and 4.3, but the final set holds only the four English files.
- The 320 px views of the new Landing sections were checked by metrics only (no horizontal scroll, every picture decoded), not by a capture someone opened.
- The ProcessLoop animation was seen only as still frames; the cycle, pause and off-screen pause are tested with a fake scheduler.
- AVIF only, no JPEG fallback. Headless Chrome decodes every file; no other browser was tried.
- No real device, no screen reader, no redeploy (`check:deployed` was not run). The new Hindi strings are `reviewed: false` in `docs/HINDI_REVIEW.md`.

**Kiro features used:** a work list in `.kiro/specs/second-pass-run1/` run task by task by sub-agents, steering (glossary, testing, tech, structure, product).

## 2026-11-22: second design pass, run 2 (header, Weave, Keep, Scan and Code, motion)
Work list `.kiro/specs/second-pass-run2/` (tasks 1.1 to 5.1), branch `auto/build`, one commit per part: `header: calmer layout, menu sheet`, `weave: reskin with cards and sections`, `keep: reskin with photo cards, timeline and segmented export`, `scan and code: reskin`, `motion: screen fade, scan sweep`. No new colour, font or dependency; no new property test; no property weakened.
### What was built
- **Header.** From 1024 px: mark and name, four plain links with a small icon (the current one on a filled accent pill, text 5.09:1 day and 9.74:1 night), one "Scan a card" pill (hidden on Scan), a two-segment language control "EN | हि" and an icon-only theme switch named by its action ("Switch to night loom"). Under 1024 px: mark, pill and a Menu button that opens a sheet with 48 px rows, then the two controls (Escape closes it and returns focus). The pill shrinks after 24 px of scrolling by padding paired with equal margin, so `main` does not move (new `check:browser` step 14).
- **Weave.** SectionHeader with the italic accent word (colour only in Hindi), the cloth in a Card and the controls in a Card beside or below it, lost-card counts as Chips with a mark, the app-made cloth picture with "Try a sample" when no cloth is ready.
- **Keep.** Photo-top cards, the BMP export as the one primary section with 1-bit and 8-bit as segmented controls on the same radio markup, versions as a vertical timeline (line and dots, with text), grouped fields.
- **Scan and Code.** Scan: a dashed rounded photo zone with the drawn Diamond card, step Chips (the current step marked by text and shape), markers keep their 44 px or larger targets. Code view: the card-chain photo with a visible credit line, an Advanced Chip, bit lines in IBM Plex Mono, step controls in a Card. Both columns are centred like Weave and Keep (`margin-inline: auto`, same 60rem).
- **Motion.** Screen change: opacity-only fade of `main`, 120 ms (`--motion-short`), one animation name per screen so the change restarts it with no remount and no layout shift. Scan: one 640 ms (2 x `--motion-long`) band that crosses the photo once per read (a transform on a clipped overlay, keyed by a per-photo read number, so a corrected hook does not replay it). Both end under reduced motion through the global rule in tokens.css. Weave loom lift cycle skipped: well over the 40 lines the brief allows (it needs a new simulator frame type and painting).
### Numbers (verified on 2026-11-22; details in `measurements.md`)
- Entry chunk **127,876 bytes** gzipped after Part 4 (run 1 ended at 126,022; limit for this run 150,000; 204,800 untouched). Per part: 127.84 kB (header), 126,914, 127,720, 127,821, 127,876. Lazy chunks: Code view 10,251, Scan 9,440, validateCardGrid 2,978, download 2,279, bits 508, ScreenIntro 218.
- Contrast: every pair meets its minimum. Tightest: Day on-zari on zari 4.55 (4.5), Day accent on ground 4.59 (4.5), Day zari on the frosted header 3.05 (3), Day zari on ground 3.08 (3), Day ink-soft on tint 4.72 (4.5). One new pair in the run (on-primary on accent).
- Tests: `test:run` 145 files, 2,001 tests (benchmark ratio 1.10 against 2.2); `check:browser` 20 of 20 steps.
### Changed checks
Listed one by one in `measurements.md`. Header labels changed (icon-only theme switch, EN | हि segments, no Advanced sub-label), so the theme, shell and navigation tests and the scripts were re-aimed by accessible name at the same claims. Two episodes worth naming:
- **Step 20, Code view open offline.** In Part 3 the assertion "the marked Line is pick 0, then 1 after a step" was loosened to "exactly one marked Line, in range, a step moves it by one" because the cloth plays on Weave and Code view could open at pick 1 or later. That was weakening a check to hide a race. In Part 4 it was restored: the check pauses the cloth, sets the Weave scrubber to 0 with a real input event, waits for "Pick 1 of 36", then opens Code view and asserts pick 0 and then pick 1 (groups A and B share the function).
- **`setViewport` race.** `check:browser` step 12 sometimes failed with "timed out waiting for the header menu to open", and once with a missing language button. The header chooses its layout in JS from a media query, so right after a width change the page still drew the old layout; a click could land on a button that then vanished. `setViewport` now waits until `header[data-narrow]` matches the width, `click` waits for a still box, and `openHeaderMenu` names its state when it fails. A "FAIL" line seen above a passing summary was only the PASS line of the offline reload check, whose detail prints `net::ERR_FAILED`; a test now keeps FAIL lines, the failed count and the exit code in agreement.
### Defects found by checks, not by looking
- Keep's intro and padding made the primary Button fall outside the first 844 px at 390 (871 to 919 px); the intro was shortened and the padding reduced, the check was not touched.
- The `check:browser` step 12 timeout above.
- Motion: `styles.test` and `navigation.test` showed that every module may use only `(min-width)` or `(prefers-reduced-motion: reduce)` queries and that Shell has none; the fade therefore relies on the global reduced-motion rule instead of a query of its own. The glossary test rejected the word "holes" in a new comment.
### Not checked by eye
- Hindi on the Weave, Keep, Scan and Code screens.
- 320 px on those four screens (metrics only: no horizontal scroll, targets).
- The fade and the sweep were seen only as frames or as the CSS read, not as motion. The centred Scan and Code columns were not recaptured.
- No real device, no screen reader, no redeploy (`check:deployed` was not run). New Hindi strings are `reviewed: false` in `docs/HINDI_REVIEW.md`.
**Kiro features used:** a work list in `.kiro/specs/second-pass-run2/` run task by task by sub-agents, steering (glossary, testing, tech, structure, product), the `weave-reviewer` rules through the glossary and structure tests.
## 2026-11-22: Part B, judges' demo kit (Demo cards on every screen, JUDGES.md, browser checks)
Work list `.kiro/specs/judges-kit/` (tasks 1.1 to 4.1), branch `auto/build`. Goal: a judge with no punched card can test every function of every screen with one click and download a loom file. No new dependency, colour or font; no property test added or weakened.
### What was built
- **Demo files** (`public/demo/`): 7 card PNGs and 2 loom BMPs made with our own code, 8 real card photos from Wikimedia Commons with `CREDITS.md`. Precache has an explicit exclusion list (`NOT_PRECACHED_*` in `scripts/checks/precache.ts`): the real photos and the two noisy PNGs stay out.
- **Scan**: Demo cards (pressing a thumbnail runs the same read as an uploaded file). **Keep**: save a demo design, make a demo edit, two loom file links. **Code view**: load the Diamond, a breakpoint on pick 3, compare with an edited version. **Weave**: "Show a lost card" and "Show a torn card". `docs/JUDGES.md` is the 10-step path, linked from the README.
- `check:browser` has 23 steps: two new ones (Scan "Noisy and tilted" read equals `tests/fixtures/pick0-noisy-tilted.json` and the blank card's not-found message; Keep loom file links give a BMP of the profile's width, 192) sit before the offline step, which is now step 23. `npm run screenshots -- after-run3` writes 8 files to `media/design/after-run3/`.
### Numbers
- Entry chunk **131,375 bytes** gzipped (limit 150,000). Precache 54 entries, **1,397,783 bytes**, no limit exists; the two noisy PNGs (253,538 B) are left out by that number.
- **Real card reads: 0 of 8.** All eight real photos fail with `peg-holes-not-found`, because the reader is built for the demo card layout. `docs/JUDGES.md` says so and the screen shows the failure unchanged.
- **Loom files vs the Diamond sample.** `diamond-1bit.bmp` and `diamond-8bit.bmp` were first 192 x 200 and byte-identical to the export of the 200-pick `demoPattern` (`scripts/export_sample.ts`), not of the 36-pick Diamond sample. They were then replaced (see the later entry: the loom files are now the Diamond export, 192 x 36). The old note said "diamond" but the text says what they are. No real loom's file format was available, and the BMP is not tested on a physical loom.
### Changed checks
Listed in `.kiro/specs/judges-kit/measurements.md`: R14.7 now allows `public/demo/`; precache R9.5 allows the explicit exclusion list and asserts it is absent; R13.3 allows one demo-image fetch; R23.7 allows the addresses in `CREDITS.md`; Code view Tab order gained the Demo card buttons; the offline step also fetches the loom files. One failure in this task: a literal 192 in the new check tripped the card-geometry test; the check now reads the width from the profile.
### Not checked by eye
Keep and Code screenshots and all 390 px screenshots by the sub-agent (the orchestrator opens them); Hindi Demo cards; offline thumbnails (the noisy cards and real photos show as broken images offline by design).
**Kiro features used:** a work list in `.kiro/specs/judges-kit/`, one sub-agent task at a time, steering (glossary, structure, card geometry, testing).

## Demo loom files: now the Diamond export (bmp-fix 1.1)
- `public/demo/loom-files/diamond-1bit.bmp` (926 bytes) and `diamond-8bit.bmp` (7,990 bytes) are now the normal export of the 36-pick Diamond sample, 192 x 36. They replace the 200-pick files (4,862 and 39,478 bytes). The BMP files were replaced by the user; this task did not edit them.
- `tests/ui/state/demoDesigns.test.tsx` compares them byte for byte with the export of `generateSample(profile, 'diamond')` at 1 and 8 bit and reads size, width and pick count from the header. The Keep Demo card text, `public/demo/README.txt` and `docs/JUDGES.md` say they are the Diamond export. `media/sample-design-*.bmp` (200 picks, `scripts/export_sample.ts`) are unchanged.
