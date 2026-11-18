# Implementation Plan

## Overview

The order follows your plan. Phase 1 is the project changes from the design. Phase 2 is the codec. Phase 3 is the reader up to `readCard` and the fixture accuracy tests. Task 4 is a checkpoint. Phase 5 adds the remaining properties by module, phase 6 the structure tests, benchmark and docs, and task 7 the optional photo trial.

- **Demo-essential** marks the tasks needed for the minimal working path: a card image goes in, a correct `CardGrid` comes out, and the fixture accuracy tests (R13) pass.
- **Cut last** marks property-test tasks that can be dropped last if time runs out. Cutting one is never silent: report which properties were dropped and why. A cut-last task only holds extra properties for functions that already have at least one property in an earlier task, so `testing.md` and R17.1 stay satisfied. No accuracy target (R13) and no failure-path check is marked cut last.
- Untagged tasks are required but not needed for the demo.
- Only the photo task (7.1) is optional (`*`). Cut-last tasks are not marked optional, so they still run in a full run.
- "Property N" refers to the numbered properties in `design.md`. The test title is the property's requirement ID and statement.
- Every task ends by running the test suite and the type checker. Commit only when both pass. If either fails, fix the cause without weakening a test (see `testing.md`), or stop and report.

## Tasks

- [x] 1. Project changes the design needs
  - The tsconfig flags, codec types, demo profile, generator and fixtures that phases 2 to 5 build on.
  - _Requirements: 1.3, 15.3, 19.1, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8_

- [x] 1.1 Allow `.ts` import extensions
  - **Demo-essential.**
  - Files: `tsconfig.json`.
  - Add `"allowImportingTsExtensions": true` and `"erasableSyntaxOnly": true`. Confirm the build still passes and that Vite resolves `.ts` imports.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 15.5_

- [x] 1.2 New CardProfile shape, demo profile and per-peg rendering
  - **Demo-essential.**
  - Files: `src/codec/types.ts`, `src/codec/index.ts`, `public/profiles/demo-12x16.json`, `scripts/make_fixtures.ts`, `tests/scripts/make_fixtures.test.ts`.
  - In `types.ts`, add `PegHole`, `endOrder`, `pegHoles: [PegHole, PegHole]`, `Ends`, `ViolationKind`, `Violation` and `Result` as in the design. In `index.ts`, re-export them using `.ts` extensions.
  - Demo profile: add the explicit row-major `endOrder` table (12 x 16, values 0 to 191), and make `pegHoles` the two-element array with diameters 2.5 mm and 3.0 mm. Keep the positions, every other value, and the ILLUSTRATIVE, UNVERIFIED marker.
  - Generator: import types from `../src/codec/index.ts`. Draw each peg at its own `positionMm` and `diameterMm`. Add no demo-profile literals.
  - Update the three existing generator tests only for the new fields. Do not weaken any check.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 1.3, 2.6, 15.3, 19.1, 19.3, 19.4, 19.7_

- [x] 1.3 `pixelsPerMm` render option and regenerated fixtures
  - **Demo-essential.**
  - Files: `scripts/make_fixtures.ts`, `tests/scripts/make_fixtures.test.ts`, `tests/fixtures/*`.
  - Add `pixelsPerMm` to `RenderOptions` with a default of 6, and a `--pixels-per-mm` CLI flag. The border stays in millimetres, so it scales with the option. Record the value in `options.pixelsPerMm` of each ground-truth file. Set it explicitly in `FIXTURE_SET`.
  - Regenerate `tests/fixtures/` with the fixtures script. Run it twice and confirm byte-identical PNG and JSON files. Check that the two pegs now look different in size.
  - Add example tests. R19.8: a render at 3 px/mm is half the width and height of one at 6 px/mm, give or take a pixel, and the option is recorded. R19.6: regenerating `FIXTURE_SET` in memory gives exactly the committed bytes.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 19.6, 19.8_

- [x] 1.4 Steering docs for the new profile shape
  - Files: `.kiro/steering/card-geometry.md`, `.kiro/steering/tech.md`, `tests/scripts/make_fixtures.test.ts`.
  - `card-geometry.md`: in the Layout table, give each peg hole its own position and diameter (2.5 mm and 3.0 mm), and keep the ILLUSTRATIVE, UNVERIFIED marker on every value. The end index rule now points to the profile's `endOrder`. Add the limitation that peg hole diameters must differ from the punched hole diameter for reliable detection.
  - `tech.md`: relative imports inside `src/codec` use the `.ts` extension, so that Node can run the generator.
  - Add the R19.5 example test: the Layout table states the demo profile's peg positions and diameters.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 19.5_

- [x] 2. Codec: validation, encode and decode
  - The first properties for every codec function. The remaining codec properties are in task 5.
  - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.6, 4.1, 4.3, 5.1, 5.4, 5.5, 14.1, 17.3, 19.2, 19.4, 19.6_

- [x] 2.1 Validate a CardProfile, and the profile arbitraries
  - **Demo-essential.**
  - Files: `src/codec/validateCardProfile.ts`, `src/codec/index.ts`, `tests/support/profiles.ts`, `tests/codec/validateCardProfile.test.ts`, `tests/scripts/make_fixtures.test.ts`.
  - Implement `validateCardProfile`, `parseCardProfile` and `MIN_PEG_DIAMETER_DIFFERENCE`, covering validation rules 1 to 8 from the design. Collect every violation. Never throw.
  - In `tests/support/profiles.ts`, add `rowMajorEndOrder`, `endOrderArbitrary`, `profileArbitrary` (within the design's ranges), `cardGridArbitrary`, `endsArbitrary` and `mutateProfile`.
  - Add Properties 1, 3, 10, 11 and 12. Add example tests: diameters of exactly 10% (2.7 mm and 3.0 mm) are accepted, and the demo profile is valid with its ILLUSTRATIVE marker (R19.4).
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 1.1, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 17.3, 19.4_

- [x] 2.2 Validate a CardGrid
  - **Demo-essential.**
  - Files: `src/codec/validateCardGrid.ts`, `src/codec/index.ts`, `tests/codec/validateCardGrid.test.ts`.
  - Implement `validateCardGrid(profile, input: unknown)` to return every violation, never throw, and report the expected and actual counts.
  - Add Properties 13 and 18.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 3.1, 3.6_

- [x] 2.3 Encode and decode through the profile's end-order
  - **Demo-essential.**
  - Files: `src/codec/endsCodec.ts`, `src/codec/index.ts`, `tests/codec/endsCodec.test.ts`.
  - Implement `endsPerPick`, `encodeCardGrid` and `decodeEnds` using only `profile.endOrder`, with no index arithmetic. Return `Result` values and never throw.
  - Add Properties 19, 27 and 28.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 1.2, 4.1, 4.3, 5.1, 5.4, 5.5, 14.1_

- [x] 2.4 Wire the generator to the codec
  - **Demo-essential.**
  - Files: `scripts/make_fixtures.ts`, `tests/scripts/make_fixtures.test.ts`, `tests/fixtures/*.json`.
  - The generator calls `parseCardProfile` before rendering and stops with the violations if the profile is invalid. It writes `ends: encodeCardGrid(profile, card)` into each ground-truth file, next to `card`.
  - Regenerate the fixtures. Only the JSON files may change. Confirm that every PNG is byte-identical to task 1.3, and stop and report if one is not.
  - Add Property 81, which checks the ends list directly, not through the codec.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 19.2, 19.6_

- [x] 3. Reader pipeline up to `readCard` and the fixture accuracy tests
  - The minimal working path. Each pipeline function gets its first property here. The remaining reader properties are in task 5.
  - _Requirements: 6.1, 6.3, 6.4, 6.5, 7.3, 8.1, 8.3, 8.4, 9.1, 9.2, 9.4, 9.6, 9.7, 10.1, 10.3, 10.4, 11.1, 11.2, 11.3, 12.1, 12.2, 12.4, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 17.4, 17.5, 17.7, 18.4, 18.6, 18.7_

- [x] 3.1 Reader types, pixel data check and greyscale
  - **Demo-essential.**
  - Files: `src/reader/types.ts`, `src/reader/pixelData.ts`, `src/reader/greyscale.ts`, `src/reader/index.ts`, `tests/reader/pixelData.test.ts`, `tests/reader/greyscale.test.ts`.
  - Write the reader types as in the design. Implement `isPixelData` and `toGreyscale`, using the integer weights 299, 587 and 114 with rounding.
  - Add Properties 32 and 36. Add example tests for one known colour pixel and a 1 x 1 image.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 6.1, 6.3, 6.4, 7.3_

- [x] 3.2 Threshold choice
  - **Demo-essential.**
  - Files: `src/reader/threshold.ts`, `src/reader/index.ts`, `tests/reader/threshold.test.ts`.
  - Implement `chooseThreshold` with Otsu's method: exact `BigInt` comparison, the first best split, then the middle of any empty-bin gap. A pixel is dark when its level is below the threshold. A single-level image gets threshold 0. Implement `classifyDark`.
  - Add Properties 39, 41 and 42. Add an example test: a two-level image of 20 and 215 gives a threshold above 20 and at most 215.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 8.1, 8.3, 8.4_

- [x] 3.3 Dark regions
  - **Demo-essential.**
  - Files: `src/reader/regions.ts`, `src/reader/index.ts`, `tests/reader/regions.test.ts`.
  - Implement `findDarkRegions` as a 4-connected flood fill with an explicit `Int32Array` stack, recording area, centroid, bounds and `touchesEdge`. Implement `equivalentDiameterPx`.
  - Add Property 44, checked against an independent union-find written in the test. Add Property 46.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.1, 9.2_

- [x] 3.4 Orientation rule
  - **Demo-essential.**
  - Files: `src/reader/orientation.ts`, `src/reader/index.ts`, `tests/reader/orientation.test.ts`.
  - Implement `orientationSeparation` and `decideOrientation` with `MIN_SEPARATION` set to 0.5, using `q = (cDown - cUp) / (2 * |e0 - e1|)` as stated in the design. If `e0 = e1`, the decision is ambiguous.
  - Add Properties 50 and 52. Add example tests for the three worked examples in the design (q of +0.93, -0.93 and 0).
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 18.4, 18.6_

- [x] 3.5 Angle helpers and card-to-image mapping
  - **Demo-essential.**
  - Files: `src/reader/pose.ts`, `src/reader/index.ts`, `tests/reader/pose.test.ts`.
  - Implement `normalizeDegrees`, `angleDifferenceDegrees` and `cardToImage`. `poseFromPegHoles` comes in task 3.7.
  - Add Property 59. Add example tests: 179 and -179 differ by 2, and a 90-degree pose maps (1, 0) mm to (origin.x, origin.y + s).
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 10.1, 18.7_

- [x] 3.6 Peg hole pair search
  - **Demo-essential.**
  - Files: `src/reader/pegHoles.ts`, `src/reader/index.ts`, `tests/support/images.ts`, `tests/reader/pegHoles.test.ts`.
  - Implement `findPegHolePair` with `TILT_SEARCH_LIMIT_DEGREES` set to 15 and `FIT_MAX` set to 0.15, as in the design. In `tests/support/images.ts`, add analytic region builders that place regions from a pose with `cardToImage`.
  - Add Property 57. Add an example test: the demo profile's regions at 6 px/mm and tilt 0 give the right pair and a scale within 1%.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.2, 9.7_

- [x] 3.7 Pose from the peg hole pair
  - **Demo-essential.**
  - Files: `src/reader/pose.ts`, `tests/reader/pose.test.ts`.
  - Implement `poseFromPegHoles(profile, pair, orientation)`. For `upside-down`, the two roles are swapped, so the tilt comes out near 180.
  - Add Property 56, covering both orientations.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.4_

- [x] 3.8 Sampling
  - **Demo-essential.**
  - Files: `src/reader/sampling.ts`, `src/reader/index.ts`, `tests/reader/sampling.test.ts`.
  - Implement `samplingRadiusPx` with `SAMPLING_RADIUS_FRACTION` set to 0.6, `decidePunched` as `darkCount * 2 > sampleCount`, and `sampleCardGrid`. `sampleCardGrid` checks the bounds of every hook position before it reads any pixel, and returns `null` when the card leaves the image.
  - Add Properties 62 and 64.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 10.3, 10.4, 11.1, 11.2_

- [x] 3.9 `readCard`
  - **Demo-essential.**
  - Files: `src/reader/readCard.ts`, `src/reader/index.ts`, `tests/support/images.ts`, `tests/reader/readCard.test.ts`.
  - Implement `readCard(profile: unknown, pixels: unknown)` following the design's data flow, with `MIN_REGION_AREA_PX` set to 4 and `MAX_CANDIDATE_REGIONS` set to 400. The profile is checked before the pixels. There is no `try` or `catch`. In `tests/support/images.ts`, add `greyToPixelData`, `padPixelData` and `renderCardPixels`.
  - Add one example test for each outcome: a clean render read back exactly, `invalid-profile`, `invalid-image`, `peg-holes-not-found` on a uniform image, `card-outside-image` on a cropped render, and a render rotated by 180 degrees, read back as the upright grid with orientation `upside-down`. `ambiguous-orientation` gets its test in task 5.13.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.7, 11.3, 12.1, 12.2, 12.4, 18.3_

- [x] 3.10 PNG test helper and fixture accuracy tests
  - **Demo-essential.** The accuracy targets are never cut.
  - Files: `tests/support/png.ts`, `tests/reader/accuracy.test.ts`.
  - Write `decodePng` for 8-bit greyscale, filter-0 PNGs, using `node:zlib` only. It throws on any other format.
  - The accuracy test runs on every fixture. It loads the ground truth, then `public/profiles/<profile>.json`, then decodes the PNG and runs `readCard`. The targets are 100% for `pick0-clean`, `pick1-clean`, `pick2-clean` and `pick0-tilted`, and at least 95% for `pick0-noisy` and `pick0-noisy-tilted`. Tilt must be within 0.5 degrees of `options.tiltDegrees` (compared modulo 360), and scale within 1% of `options.pixelsPerMm`.
  - On failure, the message gives the fixture, the measured accuracy and the mismatched `(hookRow, hookColumn)` positions. Every run prints a one-line measurement per fixture.
  - If a target is missed, do not lower it or edit a fixture. Stop and report, and go to task 4.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.4, 9.6, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 17.4, 17.5, 17.7_

- [x] 4. Checkpoint: measured accuracy on every fixture
  - **Demo-essential.**
  - Files: `.kiro/specs/card-codec-and-reader/measurements.md`, a new record.
  - Run the accuracy test and record the real output for all six fixtures, including the noisy ones. For each fixture, record the hole accuracy, the mismatched positions, the measured versus expected tilt, the measured versus expected scale, the threshold, the number of candidate regions, the measured peg diameters and the separation q.
  - Report the table to the user in chat. If any target in R13 is missed, stop and wait for the user's decision before task 5. If any constant was changed to reach the targets, list the old and the new value.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 13.1, 13.2, 13.3, 13.5, 13.6_

- [ ] 5. Remaining properties, by module
  - Each task adds properties to an existing test file. If a property fails, report its shrunk counterexample, seed and path, and say whether the code or the property is wrong (see `testing.md`).
  - _Requirements: 1.4, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.6, 5.7, 6.1, 6.2, 6.6, 7.1, 7.2, 7.4, 7.5, 8.1, 8.2, 8.5, 9.1, 9.2, 9.3, 9.5, 9.7, 10.1, 10.2, 10.3, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2, 12.3, 12.4, 14.3, 14.4, 17.6, 17.8, 18.1, 18.2, 18.3, 18.5, 18.6, 18.7, 18.8, 19.1_

- [ ] 5.1 CardProfile validation: integrity properties
  - Files: `tests/codec/validateCardProfile.test.ts`.
  - Add Properties 2, 7 and 9.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 1.4, 2.5, 2.7_

- [ ] 5.2 CardProfile validation: field properties
  - **Cut last.** Rules 3 to 5 already run inside Properties 1, 3 and 12.
  - Files: `tests/codec/validateCardProfile.test.ts`.
  - Add Properties 4, 5, 6 and 8.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 2.2, 2.3, 2.4, 2.6_

- [ ] 5.3 CardGrid validation: detailed violations
  - **Cut last.** Properties 13 and 18 already cover this function.
  - Files: `tests/codec/validateCardGrid.test.ts`.
  - Add Properties 14, 15, 16 and 17.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [ ] 5.4 Encode and decode: rejection properties
  - Files: `tests/codec/endsCodec.test.ts`.
  - Add Properties 22, 25 and 26.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 4.3, 5.2, 5.3_

- [ ] 5.5 Encode and decode: shape, count and purity properties
  - **Cut last.** Properties 19, 27 and 28 already cover this function.
  - Files: `tests/codec/endsCodec.test.ts`.
  - Add Properties 20, 21, 23, 24, 29 and 30.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 4.1, 4.2, 4.4, 5.1, 5.6, 5.7_

- [ ] 5.6 Pixel data and the Canvas 2D conversion
  - Files: `src/reader/canvasSource.ts`, `src/reader/index.ts`, `tests/reader/canvasSource.test.ts`, `tests/reader/pixelData.test.ts`.
  - Implement `loadPixelData` with an injectable `createCanvas`. The default uses `OffscreenCanvas` when available, otherwise a canvas element. Only `drawImage` and `getImageData` are used. This is the only file in `src/reader` that uses a browser API.
  - Add Property 33, using a fake canvas that records its calls. Add Property 31, which is **Cut last** because Property 32 already covers `isPixelData`.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 6.1, 6.2, 6.3_

- [ ] 5.7 Greyscale: remaining properties
  - **Cut last.** Property 36 already covers this function.
  - Files: `tests/reader/greyscale.test.ts`.
  - Add Properties 34, 35, 37 and 38.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [ ] 5.8 Threshold: remaining properties
  - Files: `tests/reader/threshold.test.ts`.
  - Add Property 40. Add Property 43, which is **Cut last**. (Property 39 was added in task 3.2.)
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 8.2, 8.5_

- [ ] 5.9 Regions: edge flag
  - **Cut last.** Properties 44 and 46 already cover this function, and the fixture tests depend on the edge rule.
  - Files: `tests/reader/regions.test.ts`.
  - Add Property 45.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.1_

- [ ] 5.10 Orientation: remaining properties
  - Files: `tests/reader/orientation.test.ts`.
  - Add Property 51, the error budget, which is not cuttable. Add Properties 47, 48, 49 and 53, which are **Cut last**.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 18.1, 18.2, 18.3, 18.5, 18.6_

- [ ] 5.11 Peg hole search and pose: remaining properties
  - Files: `tests/reader/pegHoles.test.ts`, `tests/reader/pose.test.ts`.
  - Add Properties 54 and 55, which are not cuttable because they check decoy rejection. Add Properties 58 and 60, which are **Cut last**.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.2, 9.3, 10.1, 18.7_

- [ ] 5.12 Sampling: remaining properties
  - Files: `tests/reader/sampling.test.ts`.
  - Add Property 61. Add Properties 63 and 65, which are **Cut last**.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 10.3, 11.1, 11.2_

- [ ] 5.13 `readCard`: failure paths, orientation and the R18.8 scale
  - Files: `tests/reader/readCard.test.ts`.
  - Add Properties 69, 73, 74, 75 and 76 (failure paths), and Properties 78 and 79 (orientation). These use a pinned seed where they render images, and none is cuttable.
  - Measure the R18.8 scale. Use a profile with peg diameters of 2.5 mm and 2.8 mm, and assert that `validateCardProfile` returns `[]` for it. Render it with a fixed seed at decreasing `pixelsPerMm`. Record the highest scale at which the peg holes are still found and the result is `ambiguous-orientation`. Write that scale, and the separation measured there, into the test and into `measurements.md`. If no such scale exists (the reader goes from a correct read straight to `peg-holes-not-found`), stop and report this with the measured values instead of changing the profile.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 9.7, 12.1, 12.2, 12.3, 12.4, 18.3, 18.4, 18.5, 18.8_

- [ ] 5.14 `readCard`: image properties
  - Files: `tests/reader/readCard.test.ts`.
  - Add Properties 67, 68, 70 and 77, which are not cuttable. They use `numRuns` 25 and a pinned seed. Add Properties 66, 71 and 72, which are **Cut last**.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 6.6, 9.5, 10.2, 11.3, 11.4, 14.3, 14.4_

- [ ] 5.15 Generator: per-peg drawing property
  - Files: `tests/scripts/make_fixtures.test.ts`.
  - Add Property 80, using `profileArbitrary`, a pinned seed and `numRuns` 25.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 19.1, 19.3_

- [ ] 6. Structure tests, benchmark and docs
  - _Requirements: 6.3, 6.5, 14.2, 15.1, 15.2, 15.4, 15.5, 16.1, 16.2, 16.3, 17.1, 17.2_

- [ ] 6.1 Module boundary and dependency tests
  - Files: `tests/structure/modules.test.ts`, `tests/structure/dependencies.test.ts`.
  - These tests scan source text with `node:fs`.
  - `src/codec` imports nothing from other `src/` modules and uses no browser API. `src/reader` imports only from `src/codec`. Only `canvasSource.ts` names `document`, `OffscreenCanvas`, `HTMLImageElement`, `ImageBitmap` or `Blob`.
  - Neither module uses `any`, names `demo-12x16`, or imports from `public/`. Peg-hole words appear only in the files listed in the design.
  - `package.json` `dependencies` holds only `react` and `react-dom`.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 6.3, 6.5, 14.2, 15.1, 15.2, 15.4, 15.5, 16.3_

- [ ] 6.2 Property naming and coverage test
  - Files: `tests/structure/propertyNames.test.ts`.
  - Every test whose body calls `fc.assert` has a title that starts with an ID like `R5.4`. Every exported function in `src/codec` and `src/reader`, other than `loadPixelData`, is named in a test file that calls `fc.assert`. If cut-last tasks were dropped, this test must still pass.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 17.1, 17.2_

- [ ] 6.3 Benchmark
  - Files: `tests/reader/benchmark.test.ts`, `.kiro/specs/card-codec-and-reader/measurements.md`.
  - Render the demo card, pad it to 1920 x 1080, time `readCard` and print the time. The test fails only if the read fails, never on the time.
  - Record the Node time in `measurements.md`, and note that the 300 ms phone budget (R16.1) is still unmeasured. If the Node time is over 300 ms, report it.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 16.1, 16.2_

- [ ] 6.4 README and structure.md
  - Files: `README.md`, `.kiro/steering/structure.md`.
  - README: add what the codec and reader do, how to regenerate the fixtures, and the limits. Accuracy is measured on synthetic fixtures only, the demo profile is illustrative, cards must be upright or upside down within 10 degrees with no perspective, and peg hole diameters must differ from the punched hole diameter.
  - `structure.md`: update the key exports of `src/codec` and `src/reader` to the real names.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 15.4_

- [ ] 7. Optional real-photo trial
  - _Requirements: 6.2_

- [ ]* 7.1 Print a rendered card, photograph it and try the reader
  - Optional. This makes no claim about the accuracy targets, which cover synthetic fixtures only.
  - Files: `scripts/read-photo.html` and `scripts/read-photo.ts`. These are dev-only and not part of the app build, which uses only `index.html`.
  - Render one demo card with the fixtures script at `--pixels-per-mm 40`, clean, with a known seed. Print it at 100% scale so that the image is 70 mm wide (the card is 60 mm plus a 5 mm border each side), and check with a ruler.
  - Place it on a darker surface under even light. Photograph it from directly above.
  - Open `scripts/read-photo.html` on the dev server. It loads a photo through `loadPixelData`, runs `readCard` with the demo profile, and prints the result and its accuracy against the render's ground truth.
  - If it fails or scores below 100%, report the following. Do not change constants or targets because of one photo.
    - the failure reason, or the accuracy and the mismatched hook positions
    - the measured tilt, scale and separation q, if the pose was found
    - the threshold and the number of candidate regions
    - the measured versus expected peg diameters
    - the photo's resolution, the lighting and the background
    - the photo itself
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 6.2_

## Notes

- **Order and waves.** The graph runs one task per wave. Most tasks edit the same `index.ts` or test files, every task commits, and task 4 must block phase 5 until you have seen the measurements.
- **Task 1.2 changes the profile shape and the generator together.** If they were split, the type checker would fail between the two tasks.
- **The fixtures are regenerated twice.** Task 1.3 regenerates them for the new pegs and `pixelsPerMm`. Task 2.4 adds `ends` to the JSON, which needs the codec. In task 2.4 every PNG must stay byte-identical, which checks that wiring the codec did not change rendering.
- **`structure.md` is updated in task 6.4, not phase 1,** because the real export names exist only after phases 2 and 3.
- **Changing constants.** Any constant from the design's constants table that is changed during implementation is reported with its old and new value. The R13 targets never change.
- **Commits.** Every task commits. No task pushes.

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
        "2.1"
      ]
    },
    {
      "id": 5,
      "tasks": [
        "2.2"
      ]
    },
    {
      "id": 6,
      "tasks": [
        "2.3"
      ]
    },
    {
      "id": 7,
      "tasks": [
        "2.4"
      ]
    },
    {
      "id": 8,
      "tasks": [
        "3.1"
      ]
    },
    {
      "id": 9,
      "tasks": [
        "3.2"
      ]
    },
    {
      "id": 10,
      "tasks": [
        "3.3"
      ]
    },
    {
      "id": 11,
      "tasks": [
        "3.4"
      ]
    },
    {
      "id": 12,
      "tasks": [
        "3.5"
      ]
    },
    {
      "id": 13,
      "tasks": [
        "3.6"
      ]
    },
    {
      "id": 14,
      "tasks": [
        "3.7"
      ]
    },
    {
      "id": 15,
      "tasks": [
        "3.8"
      ]
    },
    {
      "id": 16,
      "tasks": [
        "3.9"
      ]
    },
    {
      "id": 17,
      "tasks": [
        "3.10"
      ]
    },
    {
      "id": 18,
      "tasks": [
        "4"
      ]
    },
    {
      "id": 19,
      "tasks": [
        "5.1"
      ]
    },
    {
      "id": 20,
      "tasks": [
        "5.2"
      ]
    },
    {
      "id": 21,
      "tasks": [
        "5.3"
      ]
    },
    {
      "id": 22,
      "tasks": [
        "5.4"
      ]
    },
    {
      "id": 23,
      "tasks": [
        "5.5"
      ]
    },
    {
      "id": 24,
      "tasks": [
        "5.6"
      ]
    },
    {
      "id": 25,
      "tasks": [
        "5.7"
      ]
    },
    {
      "id": 26,
      "tasks": [
        "5.8"
      ]
    },
    {
      "id": 27,
      "tasks": [
        "5.9"
      ]
    },
    {
      "id": 28,
      "tasks": [
        "5.10"
      ]
    },
    {
      "id": 29,
      "tasks": [
        "5.11"
      ]
    },
    {
      "id": 30,
      "tasks": [
        "5.12"
      ]
    },
    {
      "id": 31,
      "tasks": [
        "5.13"
      ]
    },
    {
      "id": 32,
      "tasks": [
        "5.14"
      ]
    },
    {
      "id": 33,
      "tasks": [
        "5.15"
      ]
    },
    {
      "id": 34,
      "tasks": [
        "6.1"
      ]
    },
    {
      "id": 35,
      "tasks": [
        "6.2"
      ]
    },
    {
      "id": 36,
      "tasks": [
        "6.3"
      ]
    },
    {
      "id": 37,
      "tasks": [
        "6.4"
      ]
    },
    {
      "id": 38,
      "tasks": [
        "7.1"
      ]
    }
  ]
}
```
