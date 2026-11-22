# Implementation Plan: Second design pass, run 2

## Overview

Work list for run 2 (header, Weave, Keep, Scan and Code, motion). See brief.md in this folder; its hard rules apply to every task. Each task is one part and ends with the gate, one commit with the exact message and a push.

## Tasks

- [x] 1. Part 0: header
  - [x] 1.1 Header layout, scroll shrink, menu sheet, screenshots, commit `header: calmer layout, menu sheet`
    - Implement Part 0 of brief.md. Create measurements.md. Capture header screenshots into media/design/after-run2/. Run the gate. Commit with the message `header: calmer layout, menu sheet` and push. Report the file list of the new screenshots.

- [x] 2. Part 1: Weave
  - [x] 2.1 Weave reskin and commit `weave: reskin with cards and sections`
    - Implement Part 1 of brief.md. Capture Weave views (weave-sample with a design loaded, weave-lost with lost cards and repair panel, day and night, 390 and 1280) into media/design/after-run2/. Run the gate. Commit with the message `weave: reskin with cards and sections` and push.

- [x] 3. Part 2: Keep
  - [x] 3.1 Keep reskin and commit `keep: reskin with photo cards, timeline and segmented export`
    - Implement Part 2 of brief.md. Capture keep-versions (a design with 2 versions) day and night, 390 and 1280. Run the gate. Commit with the message `keep: reskin with photo cards, timeline and segmented export` and push.

- [ ] 4. Part 3: Scan and Code
  - [-] 4.1 Scan and Code reskin and commit `scan and code: reskin`
    - Implement Part 3 of brief.md. Capture scan (empty, and with a read card if the script can do it) and code-diff views, day and night, 390 and 1280. Run the gate. Commit with the message `scan and code: reskin` and push.

- [ ] 5. Part 4: motion
  - [~] 5.1 Motion and commit `motion: screen fade, scan sweep`
    - Implement Part 4 of brief.md and the closing docs. Run the gate. Commit with the message `motion: screen fade, scan sweep` and push. Report bytes: entry chunk and lazy chunks gzipped, contrast tightest pairs.

## Notes

- One task per part, run in order. Anything left when the credit cap nears goes to docs/STUCK.md.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["3.1"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["5.1"] }
  ]
}
```
