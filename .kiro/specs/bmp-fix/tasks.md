# Implementation Plan: loom file fix

## Overview

Small fix. The user replaced public/demo/loom-files/diamond-1bit.bmp and diamond-8bit.bmp (uncommitted) with the real export of the 36-pick Diamond sample: 192 x 36, 926 B at 1 bit and 7,990 B at 8 bit. Do not touch the BMP files.

## Tasks

- [ ] 1. Loom files are the Diamond export
  - [-] 1.1 Update the test and every text that says the files are the 200-pick pattern, run the gate, commit with the BMPs
    - In tests/ui/state/demoDesigns.test.tsx change the test "are byte for byte what the normal export gives for the demo pattern of 200 picks" to compare against generateSample(profile, 'diamond') exported with the normal export path (runExport or exportPatternBmp as the test already uses) at 1 and 8 bit; rename it (for example "are byte for byte what the normal export gives for the Diamond sample at 1 and 8 bit"); keep the rest of the file. Also assert the sizes 926 and 7,990 bytes and the width 192 and 36 picks read back from the BMP header.
    - Update every place that says these files are the 200-pick pattern or that the Diamond sample differs from them: the Keep demo card text (en.json and hi.json; Hindi marked reviewed false, review-list), docs/JUDGES.md, public/demo/README.txt, docs/BUILD_LOG.md, README if it says so, .kiro/specs/judges-kit/measurements.md (add a dated note), and any test that pins the old wording or the old sizes (4,862 and 39,478; 192 x 200): re-aim by the new numbers at the same strength. Search with grep for 200, 4862, 39478, demoPattern and 'diamond-' across src, tests, scripts, docs, public/demo/README.txt. Say plainly in the texts that the files are the Diamond export. check:browser step 22 (BMP header width 192) must still pass; if it also checks the height or size, update to 36 / the new sizes.
    - Run the full gate: typecheck, test:run, build, check-bundle, check:browser, contrast report. Commit with message `demo loom files: now the Diamond export` including public/demo/loom-files/*.bmp (the user's uncommitted replacement; do not modify them) and the .kiro/specs/judges-kit and bmp-fix status files; add by explicit path; plain push to origin auto/build. Report: files changed, gate results, entry chunk bytes, commit hash.

## Notes

- Stop after this fix.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] }
  ]
}
```
