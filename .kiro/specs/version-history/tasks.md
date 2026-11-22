# Implementation Plan: Version History

## Overview

Four groups, in order. The lead engineer makes one git commit per group. Language is TypeScript, as in the design. The only property test is Property 1; every other test is example-based. Do not loosen any existing assertion except the two named in the design (the `idbStore` version and index test, and the R6.1 five-field `SavedDesign` test).

## Tasks

- [ ] 1. Group 1: Archive
  - [ ] 1.1 Add the version types, `versions.ts` and `saveDesign` lineage
    - In `src/archive/types.ts`, add `designId?` and `note?` to `SavedDesign` and `DesignSummary`, and export `NOTE_MAX = 200`.
    - Create `src/archive/versions.ts` with `designIdOf`, `groupDesigns`, `previousVersion` and the `DesignGroup` type, and export them from `src/archive/index.ts`.
    - In `src/archive/designs.ts`, add `continues` and `note` to `saveDesign`: a missing source returns `not-found`, a note over 200 characters returns `write-failed` with a detail, a whitespace note is stored as absent, and a first Version stores no `designId`.
    - Add example tests in `tests/archive/` for grouping, the 200 and 201 character notes, the whitespace note, the first Version having no `designId`, a continuing Version storing `designIdOf(source)`, the three failure reasons, and delete of one Version, the newest Version and the last Version.
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.3, 5.1, 5.2, 7.1_

  - [ ] 1.2 Upgrade `idbStore` to version 2 and extend the fake IndexedDB
    - In `src/archive/idbStore.ts`, set `DATABASE_VERSION` to 2 and make `onupgradeneeded` read `event.oldVersion`: version 0 creates both stores with all indexes including `designId`, and version 1 adds only the `designId` index through `request.transaction.objectStore('summaries')`. No record is rewritten.
    - In `tests/support/fakeIndexedDb.ts`, add an option to start from given version 1 rows and to pass `oldVersion` and `request.transaction.objectStore(name).createIndex`.
    - Add the old-shape upgrade test: every legacy row is listed as a Design with one Version, opened with equal Pattern, Metadata, Card_Profile name and creation time, and deleted.
    - Update, on purpose, the `idbStore` test that pins version 1 and the index list so it pins version 2 and the `designId` index, and the R6.1 test that pins `SavedDesign` to five fields so it pins the seven-field shape.
    - _Requirements: 6.1_

  - [ ] 1.3 Write the property test for lineage listing and restore
    - **Property 1: Lineage listing and restore**
    - In `tests/archive/`, use fast-check with at least 100 runs, `FakeArchiveStore`, and an injected increasing clock and id source. Tag it `Feature: version-history, Property 1: Lineage listing and restore`, and name it after the requirement.
    - **Validates: Requirements 2.1, 3.1, 3.2, 4.2**

- [ ] 2. Group 2: State
  - [ ] 2.1 Add the compare field, the three actions, the `KeepForm` fields and the Keep helpers
    - In `src/ui/types.ts`, add `compare: CompareRequest | null` to `AppState`, add the `CompareRequest` and `CompareChoice` types, and add the actions `compare-versions`, `restore-saved` and `set-archive-origin`. `navigate` and `withNewPattern` clear `compare`. `restore-saved` sets origin `archive`, resets `selectedPick` to 0, clears breakpoints and stays on the current screen. `set-archive-origin` only changes an origin that is already `archive`.
    - In `src/ui/state/keep.ts`, add `note` and `saveMode` to `KeepForm`, add the `set-note`, `set-save-mode` and `set-metadata` form actions, and add `effectiveSaveMode`, `versionRow` and `compareTargets`.
    - Add example tests in `tests/ui/` for the reducer actions, `effectiveSaveMode` for archive and non-archive origins, `versionRow`, and `compareTargets`.
    - _Requirements: 1.1, 1.2, 3.2, 4.1, 4.2_

- [ ] 3. Group 3: Screens
  - [ ] 3.1 Build the grouped Keep list, the save choice and the per-version actions
    - In `KeepScreen.tsx` and `KeepScreen.module.css`, list `groupDesigns(designs)` with name, version count and the "Show versions" and "Hide versions" button (`aria-expanded`, `aria-controls`). Render the Version_List as an ordered list, newest first, with date, note and pick count.
    - Add the save choice (`fieldset`, `legend`, two radios, default "Save as new version") and the note field, shown only for an `archive` origin, with nothing written until the weaver confirms. Add per-version Open, Compare, Restore and Delete, reusing `DeleteConfirm`. `runRestore` dispatches `restore-saved` and `set-metadata`. After a save, dispatch `set-archive-origin` so the next save continues the newest Version.
    - Add `keep.version.*` keys to `src/ui/i18n/en.json` and `hi.json` with separate singular and plural count keys, Hindi entries marked `reviewed:false`, then run `npm run review-list` to regenerate `docs/HINDI_REVIEW.md`. Keep every control a native button with a text name, a visible focus indicator, and wrapping text at 320 px.
    - Add example tests in `tests/ui/` for the save choice shown only for an `archive` origin, one entry per Design, delete updating the list, and both languages having every new key.
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 3.2, 4.2, 4.3, 5.1, 5.2, 8.1_

  - [ ] 3.2 Wire Compare through `DiffPanel` and `CodeViewScreen`
    - Give `DiffPanel` an optional `request: CompareRequest | null` prop. When it arrives and the profile is ready, set both choices and run the existing comparison once. `CodeViewScreen` passes `state.compare`. `KeepScreen` dispatches `compare-versions` for Compare with the previous Version and Compare with the open design.
    - Add example tests in `tests/ui/` that a compare request preselects both sides and shows the `diffPatterns` result, and that the flat chooser lists every Version.
    - _Requirements: 4.1, 8.1_

- [ ] 4. Group 4: Finish
  - [ ] 4.1 Update steering and docs
    - Add a `version` row to `.kiro/steering/weaving-glossary.md`, and update the archive and ui entries in `.kiro/steering/structure.md`.
    - Add an entry to `docs/BUILD_LOG.md` that records the two deliberately updated tests and the measured entry chunk size, and update `docs/KIRO_USAGE.md`.
    - _Requirements: 8.1, 8.2_

  - [ ] 4.2 Verify, measure and push
    - Run `npm run typecheck` and `npm run test:run`, and fix any failure without weakening a property or assertion.
    - Run `npm run build` then `npm run check-bundle`, and report the entry chunk gzipped size against the 97,686 byte baseline and the 204,800 byte limit. Do not run `check:browser` or `check:all`.
    - Push the `auto/build` branch.
    - _Requirements: 8.2_

## Notes

- Each group is one git commit: Archive, State, Screens, Finish.
- No optional tasks. Property 1 is the only property test; all other tests are example-based.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2"] }
  ]
}
```
