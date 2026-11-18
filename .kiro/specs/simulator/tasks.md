# Implementation Plan

## Overview

The plan builds `src/simulator` in four phases so a visible result comes early:

1. Types, `prepareCloth`, settings, a basic `renderFrame`, and a sample cloth PNG in `media/`, then a checkpoint where you look at it.
2. Gap rows, floats and the horizontal repeat.
3. Frames, the shed animation, the player and `canvas.ts`, with a dev-only preview page.
4. The remaining properties, structure tests, the benchmark, and a final checkpoint on frame times.

Each phase ends with a `BUILD_LOG.md` entry and a push.

## How to read this plan

- **Demo-essential** marks tasks needed to show the cloth forming in the demo.
- **Cut last** marks the 8 properties the design marks as cuttable: Properties 3, 7, 8, 9, 13, 15, 20 and 24. Cutting one is reported, never silent. No failure-path check and not Property 23 (tiled equals base) is cuttable.
- "Property N" refers to the numbered properties in `design.md`; the test title is the property's requirement ID and statement.
- Every task ends by running the tests and the type checker and committing when both pass. If either fails, fix the cause without weakening a test, or stop and report (see `testing.md`).
- Relative imports inside `src/simulator` use the `.ts` extension, as in `src/codec`, because `scripts/render_sample.ts` runs it under plain Node.

## Tasks

- [x] 1. First render
  - Types, preparation, settings, the basic frame and a sample PNG to look at.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2, 6.3, 7.1, 7.2, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 9.4, 11.1, 11.2, 11.3, 12.3, 12.4, 12.5, 13.2_

- [x] 1.1 Types and `prepareCloth`
  - **Demo-essential.**
  - Files: `src/simulator/types.ts`, `src/simulator/prepare.ts`, `src/simulator/index.ts`, `tests/support/slots.ts`, `tests/simulator/prepare.test.ts`.
  - Write the types from the design. Implement `prepareCloth(profile: unknown, slots: unknown)`: `parseCardProfile`, then per slot `null`/`undefined` is missing, a value failing `validateCardGrid` is damaged, otherwise the lift set comes from `encodeCardGrid`. Never throw; copy what is kept.
  - In `tests/support/slots.ts`, add `slotListArbitrary(profile)` with valid, missing and damaged slots, reusing `profileArbitrary` and `cardGridArbitrary`.
  - Add Properties 1, 2 and 4.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.2, 11.3, 12.3, 12.4, 12.5, 13.2_

- [x] 1.2 Render settings
  - **Demo-essential.**
  - Files: `src/simulator/settings.ts`, `src/simulator/index.ts`, `tests/support/slots.ts`, `tests/simulator/settings.test.ts`.
  - Implement `parseColour` and `parseRenderSettings` with the design's ranges: thread size 3 to 16, repeat 1 to 64 (default 1), viewport sides 1 to 4,096, highlight limit 1 to 64, non-empty weft plan, `#rrggbb` colours. Add `weftPlanArbitrary` and `renderSettingsArbitrary` (small viewports).
  - Add Property 12 (failure path, not cuttable).
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.3, 11.1, 11.2, 14.1_

- [x] 1.3 Basic `renderFrame` for rest frames
  - **Demo-essential.**
  - Files: `src/simulator/style.ts`, `src/simulator/render.ts`, `src/simulator/index.ts`, `tests/simulator/render.test.ts`.
  - Implement `shadeTable`, the layout (fell, woven rows above it, plain warp in the shed, loom background), crossing cells with warp-or-weft-on-face shading, and the weft plan cycle, for `rest(p)` frames. Write through a `Uint32Array` view. Validate the frame (`pick-out-of-range`). Gap picks may draw as background for now; task 2.1 adds the hatch.
  - Add Properties 5, 16 (failure path) and 18.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 2.1, 2.3, 2.4, 2.5, 5.2, 6.1, 6.2, 7.1, 7.2, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 9.4_

- [x] 1.4 Zari weft
  - **Demo-essential.**
  - Files: `src/simulator/style.ts`, `src/simulator/render.ts`, `tests/simulator/render.test.ts`.
  - Add the zari base colours and the highlight rule from the design (centre row of each weft-on-face cell, columns where `x mod 4 = 0`).
  - Add Property 14.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 5.3, 5.5, 5.6_

- [x] 1.5 Sample cloth PNG
  - **Demo-essential.**
  - Files: `scripts/render_sample.ts`, `scripts/png_rgba.ts`, `package.json`, `media/sample-cloth.png`, `tests/scripts/render_sample.test.ts`.
  - The generator's `encodePng` writes greyscale only, so add a small zero-dependency RGBA PNG encoder (`node:zlib`) in `scripts/png_rgba.ts`.
  - `scripts/render_sample.ts` loads the demo profile, builds 48 picks with `demoPattern(profile, 48)` from `scripts/make_fixtures.ts`, uses a weft plan of one plain weft and one gold zari weft, thread size 6, and writes `rest(48)` to `media/sample-cloth.png`. Add a `sample-cloth` script to `package.json`.
  - Test: rendering twice gives identical PNG bytes, and the PNG decodes to the size of the viewport.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 5.5, 8.1_

- [x] 1.6 Checkpoint: look at the first render
  - **Demo-essential.**
  - Generate `media/sample-cloth.png` and report its path, size, the settings used, and the render time. Check by eye that warp and weft read as threads, the over-under order is visible, and zari picks are distinct.
  - Stop and wait for the user to look at the image before phase 2.
  - _Requirements: 6.1, 6.2, 5.5_

- [x] 1.7 Phase 1 log and push
  - Files: `docs/BUILD_LOG.md`.
  - Add a `docs/BUILD_LOG.md` entry for this phase in the file's entry format: what Kiro produced, what failed or surprised, what the user changed by hand (only what is known; write "not recorded" otherwise), and the commit range. Push.
  - _Requirements: 13.4_

- [x] 2. Gaps, floats and repeat
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 14.1, 14.2, 14.3, 14.4_

- [x] 2.1 Gap rows
  - **Demo-essential.**
  - Files: `src/simulator/style.ts`, `src/simulator/render.ts`, `tests/simulator/render.test.ts`.
  - Draw missing picks with the `/` hatch and damaged picks with the `X` cross-hatch, from the fixed palette, across the full width, never partly drawing a damaged card.
  - Add Properties 6, 10 and 11.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 2.2 Floats
  - Files: `src/simulator/floats.ts`, `src/simulator/index.ts`, `tests/simulator/floats.test.ts`.
  - Implement `computeFloats` (weft runs per woven pick, warp runs per end, both stopping at gap picks).
  - Add Properties 7 and 8. Both are **Cut last**, but keep at least one, because `computeFloats` needs a property for the naming and coverage test.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 2.3 Float highlighting
  - Files: `src/simulator/floats.ts`, `src/simulator/render.ts`, `tests/simulator/render.test.ts`.
  - Implement the window-bounded float length scan and the highlight blend.
  - Add Property 9 (**Cut last**).
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 3.3_

- [x] 2.4 Horizontal repeat
  - **Demo-essential.**
  - Files: `src/simulator/render.ts`, `tests/simulator/render.test.ts`.
  - Build each row for one base width and copy it across with `copyWithin`; measure weft floats across the tiled width when highlighting is on.
  - Add Property 23 (not cuttable) and Property 24 (**Cut last**).
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 14.2, 14.3, 14.4_

- [x] 2.5 Phase 2 log and push
  - Files: `docs/BUILD_LOG.md`.
  - Add a `docs/BUILD_LOG.md` entry for this phase in the file's entry format: what Kiro produced, what failed or surprised, what the user changed by hand (only what is known; write "not recorded" otherwise), and the commit range. Push.
  - _Requirements: 13.4_

- [x] 3. Animation and canvas
  - _Requirements: 7.3, 9.1, 9.2, 9.3, 9.5, 10.3, 12.2_

- [x] 3.1 Frames and time
  - **Demo-essential.**
  - Files: `src/simulator/frames.ts`, `src/simulator/index.ts`, `tests/simulator/frames.test.ts`.
  - Implement `PASS_STEPS`, `framesForPick` and `frameAt` as the design states.
  - Add Properties 19 and 21.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.1, 9.2, 9.3, 10.3_

- [x] 3.2 The shed in lift and pass frames
  - **Demo-essential.**
  - Files: `src/simulator/render.ts`, `tests/simulator/render.test.ts`.
  - Draw raised ends for `lift(p)` and `pass(p, s)` and the weft part-way across for `pass(p, s)`. Extend the frame arbitrary used by Properties 6 and 18 to include lift and pass frames.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 3.3 Player
  - **Demo-essential.**
  - Files: `src/simulator/player.ts`, `src/simulator/index.ts`, `tests/simulator/player.test.ts`.
  - Implement `createPlayer` with an injected scheduler and paint function: play, pause, resume, seek, current.
  - Add Property 17, using a fake scheduler and clock.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 7.3, 9.5, 10.3_

- [x] 3.4 Canvas and a dev-only preview page
  - **Demo-essential.**
  - Files: `src/simulator/canvas.ts`, `src/simulator/index.ts`, `scripts/sim-preview.html`, `scripts/sim-preview.ts`, `tests/simulator/canvas.test.ts`.
  - `paintToCanvas` (one `putImageData` per frame) and `browserScheduler` (`requestAnimationFrame`). Test both with fakes that record calls.
  - The dev-only page plays the demo pattern on a canvas, with the weft plan and repeat as page inputs, and shows the median and worst frame time so it can be opened on a phone. It is not part of the app build; check that `dist/` has no preview page.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 8.2, 9.5, 10.1, 10.3, 12.2_

- [x] 3.5 Phase 3 log and push
  - Files: `docs/BUILD_LOG.md`.
  - Add a `docs/BUILD_LOG.md` entry for this phase in the file's entry format: what Kiro produced, what failed or surprised, what the user changed by hand (only what is known; write "not recorded" otherwise), and the commit range. Push.
  - _Requirements: 13.4_

- [ ] 4. Remaining properties, structure, speed
  - _Requirements: 1.6, 5.2, 6.1, 9.4, 10.1, 10.2, 10.4, 10.5, 11.1, 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.3_

- [x] 4.1 Never throws, and inputs unchanged
  - **Demo-essential** for Property 22.
  - Files: `tests/simulator/prepare.test.ts`, `tests/simulator/render.test.ts`.
  - Add Property 22 (failure path, not cuttable) and Property 3 (**Cut last**).
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 1.6, 11.1_

- [ ] 4.2 Remaining cut-last properties
  - Files: `tests/simulator/render.test.ts`, `tests/simulator/style.test.ts`.
  - Add Properties 13, 15 and 20, all **Cut last**.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 5.2, 6.1, 9.4_

- [x] 4.3 Structure tests for the simulator
  - Files: `tests/structure/modules.test.ts`, `tests/structure/propertyNames.test.ts`.
  - Extend the scans to `src/simulator`: imports only from `src/simulator` and `src/codec`, browser APIs only in `canvas.ts`, no `any`, no `demo-12x16` or `public/`. Extend the property naming and coverage test to `src/simulator` exports (other than `paintToCanvas` and `browserScheduler`, which have example tests with fakes).
  - If a scan finds a violation, report it and stop.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 10.5, 12.1, 12.2, 12.3, 12.4, 12.5, 13.1, 13.3_

- [x] 4.4 Benchmark
  - Files: `tests/simulator/benchmark.test.ts`, `.kiro/specs/simulator/measurements.md`.
  - Generate a 2,000-pick slot list from the demo profile, render frames spread across it (rest, lift and pass frames, picks from 0 to 2,000) at 1920 x 1080 with thread size 6 and repeat 1, and print the median and worst frame time and the time at pick 0 versus pick 2,000. Fail only if a render fails, never on the time.
  - Record the numbers, the machine and the Node version in `measurements.md`.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 10.1, 10.2, 10.4_

- [ ] 4.7 Faster float highlighting
  - **Demo-essential.** Added after the task 4.4 benchmark: with highlighting on, the median frame was about 16 ms at 1920 x 1080.
  - Files: `src/simulator/floats.ts`, `src/simulator/render.ts`, `tests/simulator/benchmark.test.ts`, `.kiro/specs/simulator/measurements.md`.
  - Replace the per-cell float scan in `renderFrame` with one run-length pass per visible woven pick (weft floats, across the tiled width) and one pass per end over the visible picks plus `maxLength` picks of margin (warp floats). Output must be byte-identical; Property 9 must pass unchanged.
  - Re-run the benchmark and record the numbers. If the median with highlighting on is above 12 ms in Node, stop and report.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 3.3, 10.1, 10.2_

- [ ] 4.5 Final checkpoint: frame times
  - **Demo-essential.**
  - Report the measured frame times at 1920 x 1080 for 2,000 picks: median, worst, and pick 0 versus pick 2,000.
  - If the median or worst frame time in Node is over 16 ms, or frame time grows with the pick index, stop. Do not change R8.2 or any requirement. Report the numbers and a proposed fallback, and wait for the user's approval.
  - If Node is within budget, report that the 16 ms phone budget (R10.1) is still unmeasured, and that the preview page from task 3.4 shows frame times on a phone.
  - _Requirements: 10.1, 10.2_

- [ ] 4.6 Docs, phase 4 log and push
  - Files: `.kiro/steering/structure.md`, `README.md`, `docs/BUILD_LOG.md`.
  - Update the simulator's key exports in `structure.md`, and the README's "What it does" table and known limits (one weft per pick, no tie-up, no face-down, threads at least 3 px).
  - Add a `docs/BUILD_LOG.md` entry for this phase in the file's entry format: what Kiro produced, what failed or surprised, what the user changed by hand (only what is known; write "not recorded" otherwise), and the commit range. Push.
  - _Requirements: 12.3_

## Notes

- **Order.** One task at a time. Most tasks touch `render.ts`, `index.ts` or the same test files, and each task commits.
- **Phase 1 checkpoint (1.6)** waits for you to look at `media/sample-cloth.png`; it has no automatic pass or fail.
- **Final checkpoint (4.5)** stops if the Node frame time misses 16 ms. No requirement changes without your approval.
- **Cut last.** Properties 3, 7, 8, 9, 13, 15, 20 and 24. If both 7 and 8 are cut, `computeFloats` has no property and the naming test fails, so at least one stays.
- **Pushes.** Only the phase-end tasks (1.7, 2.5, 3.5, 4.6) push.
- **New files outside `src/simulator`:** `scripts/render_sample.ts`, `scripts/png_rgba.ts`, `scripts/sim-preview.*` (dev only), `media/sample-cloth.png`, `.kiro/specs/simulator/measurements.md`.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": [
        "1.1"
      ]
    },
    {
      "id": 1,
      "tasks": [
        "1.2"
      ]
    },
    {
      "id": 2,
      "tasks": [
        "1.3"
      ]
    },
    {
      "id": 3,
      "tasks": [
        "1.4"
      ]
    },
    {
      "id": 4,
      "tasks": [
        "1.5"
      ]
    },
    {
      "id": 5,
      "tasks": [
        "1.6"
      ]
    },
    {
      "id": 6,
      "tasks": [
        "1.7"
      ]
    },
    {
      "id": 7,
      "tasks": [
        "2.1"
      ]
    },
    {
      "id": 8,
      "tasks": [
        "2.2"
      ]
    },
    {
      "id": 9,
      "tasks": [
        "2.3"
      ]
    },
    {
      "id": 10,
      "tasks": [
        "2.4"
      ]
    },
    {
      "id": 11,
      "tasks": [
        "2.5"
      ]
    },
    {
      "id": 12,
      "tasks": [
        "3.1"
      ]
    },
    {
      "id": 13,
      "tasks": [
        "3.2"
      ]
    },
    {
      "id": 14,
      "tasks": [
        "3.3"
      ]
    },
    {
      "id": 15,
      "tasks": [
        "3.4"
      ]
    },
    {
      "id": 16,
      "tasks": [
        "3.5"
      ]
    },
    {
      "id": 17,
      "tasks": [
        "4.1"
      ]
    },
    {
      "id": 18,
      "tasks": [
        "4.2"
      ]
    },
    {
      "id": 19,
      "tasks": [
        "4.3"
      ]
    },
    {
      "id": 20,
      "tasks": [
        "4.4"
      ]
    },
    {
      "id": 21,
      "tasks": [
        "4.7"
      ]
    },
    {
      "id": 22,
      "tasks": [
        "4.5"
      ]
    },
    {
      "id": 23,
      "tasks": [
        "4.6"
      ]
    }
  ]
}
```
