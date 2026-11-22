# Implementation Plan: Part B, judges' demo kit

## Overview

One task at a time, in order; each task follows brief.md in this folder (its rules apply to every task). Commit with the given message and push after each task.

## Tasks

- [ ] 1. Demo files and precache rules
  - [-] 1.1 Commit public/demo, re-aim R14.7, precache exclusions
    - Read brief.md sections 5 and the intro. Commit all of public/demo/ (explicit paths per subfolder), re-aim R14.7 in tests/ui/illustrations/illustrations.test.tsx to allow public/demo/ only (strict for everything else; say what changed), add the explicit precache exclusion list and tests (real-cards never precached; the noisy PNGs by the number decision), update the build, run the gate (typecheck, test:run, build, check-bundle, check:browser, contrast report), create measurements.md, commit `demo files: add public/demo, precache rules` including .kiro/specs/judges-kit/ and .kiro/specs/home-button/ status files, push.

- [ ] 2. Scan demo
  - [~] 2.1 Scan Demo cards
    - Implement brief.md section 1 and 5 for the Scan screen with tests. Run the gate. Commit `scan: demo cards and real card photos` and push. Record in measurements.md 'Real card reads' what the reader returned for each of the 8 real photos (read, partly read or failed, and the message) by running them through the real reader in headless Chrome or the reader in Node (readCard with loadPixelData; whichever is quicker), without altering the reader.

- [ ] 3. Keep, Code, Weave demos
  - [~] 3.1 Keep Demo card
    - Implement brief.md section 2 and 5 with tests. Gate. Commit `keep: demo card` and push.
  - [~] 3.2 Code Demo card
    - Implement brief.md section 3 and 5 with tests. Gate. Commit `code: demo card` and push.
  - [~] 3.3 Weave Demo strip
    - Implement brief.md section 4 and 5 with tests. Gate. Commit `weave: demo strip` and push.

- [ ] 4. Docs, browser checks, screenshots
  - [~] 4.1 JUDGES.md, check:browser steps, screenshots, final gate
    - Implement brief.md sections 6, 7 (check:browser steps) and 8 (screenshots, mode after-run3). Update docs/BUILD_LOG.md (one entry for Part B incl. bytes: entry chunk, precache total, and the real-card read results) and docs/KIRO_USAGE.md (short). Run the full gate plus check:all once. Commit `judges kit: JUDGES.md, browser checks, screenshots` and push. Report bytes and the file list of screenshots.

## Notes

- Stop after task 4.1. Anything left when the credit cap nears goes to docs/STUCK.md.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["3.2"] },
    { "id": 4, "tasks": ["3.3"] },
    { "id": 5, "tasks": ["4.1"] }
  ]
}
```
