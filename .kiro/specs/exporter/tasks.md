# Implementation Plan

## Overview

The plan builds `src/exporter` in three phases:

1. Types, options and the export function (1-bit, then 8-bit), with the known-bytes tests, and sample `.bmp` files in `media/` to open in an image viewer.
2. The reader and the download helper.
3. The remaining properties, structure tests and docs.

Each phase ends with a `BUILD_LOG.md` entry and a push.

## How to read this plan

- **Demo-essential** marks tasks needed to export a loom file in the demo.
- **Cut last** marks the two properties the design marks as cuttable: Property 4 (inputs unchanged) and Property 7 (padding is zero). Cutting one is reported, never silent. No failure-path or round-trip property is cuttable.
- "Property N" refers to the numbered properties in `design.md`; the test title is the property's requirement ID and statement.
- Every task ends by running the tests and the type checker and committing when both pass. If either fails, fix the cause without weakening a test, or stop and report (see `testing.md`).
- Relative imports inside `src/exporter` use the `.ts` extension, because `scripts/export_sample.ts` runs it under plain Node.

## Tasks

- [ ] 1. Export
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 7.2, 7.3, 9.2, 10.2, 10.3, 10.4, 12.3_

- [ ] 1.1 Types and options
  - **Demo-essential.**
  - Files: `src/exporter/types.ts`, `src/exporter/options.ts`, `src/exporter/index.ts`, `tests/support/patterns.ts`, `tests/exporter/options.test.ts`.
  - Write the types from the design (replacing the scaffold stubs). Implement `DEFAULT_EXPORT_OPTIONS` and `parseExportOptions` (defaults for missing fields, first bad field reported, never throws). Add `exportOptionsArbitrary` and `patternArbitrary(profile)` (1 to 40 picks of valid cards).
  - Add the export half of Property 9 (failure path); the reader half follows in task 2.1.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 5.1, 5.2, 10.2, 10.3_

- [ ] 1.2 Layout and the 1-bit export
  - **Demo-essential.**
  - Files: `src/exporter/layout.ts`, `src/exporter/exportBmp.ts`, `src/exporter/index.ts`, `tests/exporter/exportBmp.test.ts`.
  - Implement `bmpLayout` and `exportPatternBmp` for bit depth 1: checks in the order profile, options, Pattern (non-array, empty, damaged cards), size limit; then headers, the 2-entry colour table and the rows, following "Pixel placement" and "Header fields". All four orientation options.
  - Add the 1-bit known-bytes test (the 70 bytes in the design, written out in the test). Add Properties 1, 2, 3 (failure paths) and 6.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8, 4.1, 4.2, 4.4, 7.2, 9.2, 10.4, 12.3_

- [ ] 1.3 The 8-bit export
  - **Demo-essential.**
  - Files: `src/exporter/exportBmp.ts`, `tests/exporter/exportBmp.test.ts`.
  - Add bit depth 8: one byte per pixel, the 256-entry colour table with entries 2 to 255 equal to entry 0, important colours 2.
  - Add the 8-bit known-bytes test (1,086 bytes: the first 54 bytes, the colour table and the last 8 pixel bytes from the design). Add Property 8.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 3.5, 4.1, 4.3, 4.4, 4.5, 7.3, 12.3_

- [ ] 1.4 Sample BMP files
  - **Demo-essential.**
  - Files: `scripts/export_sample.ts`, `package.json`, `media/sample-design-1bit.bmp`, `media/sample-design-8bit.bmp`, `tests/scripts/export_sample.test.ts`.
  - `scripts/export_sample.ts` loads the demo profile, builds 200 picks with `demoPattern(profile, 200)` from `scripts/demo_pattern.ts`, and writes both variants with default options to `media/`. Add a `sample-bmp` script to `package.json`.
  - Test: two runs give identical bytes, and each file starts with `BM` and has the size its header states.
  - Report the file sizes and the image size in pixels, so the user can open them in an image viewer.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 3.6, 7.4_

- [ ] 1.5 Phase 1 log and push
  - Files: `docs/BUILD_LOG.md`.
  - Add a `docs/BUILD_LOG.md` entry for this phase in the file's entry format: what Kiro produced, what failed or surprised, what the user changed by hand (only what is known; write "not recorded" otherwise), cut-last properties skipped, and the commit range. Push.
  - _Requirements: 12.4_

- [ ] 2. Reader and download
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.5, 8.1, 8.2, 8.3, 9.3_

- [ ] 2.1 Reader: headers and sizes
  - **Demo-essential.**
  - Files: `src/exporter/readBmp.ts`, `src/exporter/index.ts`, `tests/exporter/readBmp.test.ts`.
  - Implement `readPatternBmp` steps 1 to 5 and 7 of "Reading back", with every read bounds-checked. For this task, map colour index 1 to lifted; task 2.2 switches to the colour-table check.
  - Add Properties 10 (round trip), 13, 14 and 16, and the reader half of Property 9.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 6.1, 6.2, 6.4, 6.5, 6.6, 7.1, 9.3_

- [ ] 2.2 Reader: colours
  - **Demo-essential.**
  - Files: `src/exporter/readBmp.ts`, `tests/exporter/readBmp.test.ts`.
  - Decide each pixel from its colour table entry against the lift and down colours (step 6); a third colour gives `unknown-colour`.
  - Add Properties 15 and 12 (round trip across bit depths). Property 10 must still pass unchanged.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 6.3, 7.5_

- [ ] 2.3 Download helper
  - **Demo-essential.**
  - Files: `src/exporter/download.ts`, `src/exporter/index.ts`, `tests/exporter/download.test.ts`.
  - Implement `bmpFileName` and `downloadBmp` with injectable dependencies; the defaults use `Blob`, `URL` and `document`, looked up at call time.
  - Add Property 19 and the fake-dependency example test (one Blob of type `image/bmp`, one click, URL revoked).
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 2.4 Phase 2 log and push
  - Files: `docs/BUILD_LOG.md`.
  - Add a `docs/BUILD_LOG.md` entry for this phase in the file's entry format: what Kiro produced, what failed or surprised, what the user changed by hand (only what is known; write "not recorded" otherwise), cut-last properties skipped, and the commit range. Push.
  - _Requirements: 12.4_

- [ ] 3. Properties, structure and docs
  - _Requirements: 1.6, 2.3, 3.3, 6.7, 7.4, 9.1, 10.1, 10.5, 11.1, 11.2, 11.3, 11.4, 12.1, 12.2_

- [ ] 3.1 Remaining properties
  - **Demo-essential.**
  - Files: `tests/exporter/exportBmp.test.ts`, `tests/exporter/readBmp.test.ts`.
  - Add Properties 5 (pixel placement, with an independent pixel reader in the test), 11 (identical bytes), 17 (reader never throws) and 18 (export never throws).
  - If Property 17 or 18 finds a throw, report the counterexample and stop; do not narrow the arbitraries.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 2.3, 6.7, 7.4, 9.1, 12.2_

- [ ] 3.2 Cut-last properties
  - Files: `tests/exporter/exportBmp.test.ts`, `tests/exporter/readBmp.test.ts`.
  - Add Property 4 and Property 7, both **Cut last**.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 1.6, 3.3_

- [ ] 3.3 Structure tests for the exporter
  - Files: `tests/structure/modules.test.ts`, `tests/structure/propertyNames.test.ts`.
  - Extend the scans to `src/exporter`: imports only from `src/exporter` and `src/codec`, browser APIs only in `download.ts`, no `any`, no `demo-12x16` or `public/`. Extend the property naming and coverage test to `src/exporter` exports other than `downloadBmp`, which has an example test with fakes.
  - If a scan finds a violation or an exported function has no property, report it and stop.
  - Run `npm run test:run` and `npm run typecheck`. When both pass, commit.
  - _Requirements: 10.1, 10.5, 12.1_

- [ ] 3.4 Docs, phase 3 log and push
  - Files: `README.md`, `.kiro/steering/structure.md`, `docs/BUILD_LOG.md`.
  - README: change the exporter row in "What it does" to built, add an "Exporter options and limits" list with the four options and their defaults, and state that each loom controller may need a specific variant, that no controller has been tested, and that the right lift colour for each controller is unverified. Check that the exporter section of `structure.md` lists the real exports.
  - Add a `docs/BUILD_LOG.md` entry for this phase in the file's entry format: what Kiro produced, what failed or surprised, what the user changed by hand (only what is known; write "not recorded" otherwise), cut-last properties skipped, and the commit range. Push.
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

## Notes

- **Order.** One task at a time, as most tasks share `exportBmp.ts`, `readBmp.ts` and their test files.
- **Known bytes.** The expected bytes for both variants are written out in `design.md` and must be written out in the tests, not computed by the exporter.
- **Sample files (1.4).** `media/sample-design-1bit.bmp` and `media/sample-design-8bit.bmp`, 192 x 200 px, black for lifted ends.
- **Cut last.** Properties 4 and 7 only.
- **Pushes.** Only the phase-end tasks (1.5, 2.4, 3.4) push.

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
        "2.1"
      ]
    },
    {
      "id": 6,
      "tasks": [
        "2.2"
      ]
    },
    {
      "id": 7,
      "tasks": [
        "2.3"
      ]
    },
    {
      "id": 8,
      "tasks": [
        "2.4"
      ]
    },
    {
      "id": 9,
      "tasks": [
        "3.1"
      ]
    },
    {
      "id": 10,
      "tasks": [
        "3.2"
      ]
    },
    {
      "id": 11,
      "tasks": [
        "3.3"
      ]
    },
    {
      "id": 12,
      "tasks": [
        "3.4"
      ]
    }
  ]
}
```
