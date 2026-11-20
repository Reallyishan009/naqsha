# Implementation Plan: Repair Suggestions

## Overview

Twelve tasks in four groups, built in order, with one git commit at the end of each group. The design uses TypeScript, so no language question applies. Only the two properties from design.md are property tests. Every other test is an example test. Never loosen or remove an existing assertion. If one must change, say so in `docs/BUILD_LOG.md`.

## Tasks

- [ ] 1. Group 1: Repair module
  - [ ] 1.1 Write `src/repair`
    - Add `types.ts`, `slots.ts`, `repeat.ts`, `mirror.ts`, `neighbours.ts`, `suggest.ts` and `index.ts` as in design.md.
    - Export `suggestRepairs` and the constants `MIN_COMPARISONS`, `AGREEMENT_FLOOR`, `HIGH_MIN_COMPARISONS`. Import only `src/codec` and `src/codec-view`.
    - Add a `src/repair` section and the lines `ui → repair` and `repair → codec, codec-view` to `.kiro/steering/structure.md`.
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

  - [ ] 1.2 Write tests in `tests/repair/` and commit Group 1
    - Example tests for each Kind: period choice, evidence fields, confidence levels, `supporters-tie`, `no-supporter`, `no-period`, `centre-pick`, `partner-out-of-chain`, `partner-unreadable`, `no-mirror`, `at-chain-edge`, `neighbour-unreadable`, `neighbours-differ`.
    - Example tests for each edge case: no Gaps, all Gaps, very short chain (one or two picks), profile mismatch, Gap at the first or last pick, no repeat, invalid profile, not a pattern, centre pick, conflict (both Suggestions kept), ordering, inputs not modified.
    - **Property 1: A repeating chain recovers a lost card**, with `fc.assert`, at least 100 runs, a fixed seed and no `fc.pre` or `.filter`. The profile is generated.
    - **Property 2: A palindromic chain recovers a lost card from its mirror partner**, under the same rules.
    - Tag each property `Feature: repair-suggestions, Property N: <title>`.
    - Commit Group 1 once `npm run typecheck` and the `tests/repair` tests pass.
    - **Validates: Requirements 1.1, 2.1**
    - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [ ] 2. Group 2: State
  - [ ] 2.1 Add repair state and the lost-cards sample, then commit Group 2
    - Add `AppState.repairs` (`picks`, `history`) to `ui/types.ts`, with the actions `accept-repairs` and `undo-repair`, and handle both in the reducer in `ui/state/`.
    - Make `withNewPattern` reset `repairs`, so open, restore, sample and scan commit clear the marks.
    - Add `sampleWithLostCards(profile)` to `ui/samples/sampleDesigns.ts`.
    - Example tests for: accept, accept-all, undo, undo with empty history, reset by open and restore, picks out of range, and a sample with exactly three Gaps that each have a Suggestion.
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.3, 7.1_

- [ ] 3. Group 3: Screens
  - [ ] 3.1 Add the strings
    - Add the `repair.*` and `tryit.lost` keys to `en.json` and `hi.json`, with Hindi `reviewed: false`.
    - Run `npm run review-list` to regenerate `docs/HINDI_REVIEW.md`.
    - Add an example test for key parity between the two files.
    - _Requirements: 6.1_

  - [ ] 3.2 Build the Weave notice and the lazy Repair_Panel
    - Add `RepairNotice` (count, singular and plural, absent at zero Gaps, "Suggest repairs" button, "Repaired (a guess)" line and Undo) and an injectable loader that runs `import()`, with a loading state and a failure message.
    - Add `RepairPanel.tsx` with its CSS Module: Gap list, evidence text, Confidence in words, an SVG drawing with an accessible name, Accept, Skip, "Show again", conflict and reason text, the guess sentence once, and "Accept all high-confidence".
    - Make the panel recompute after each accept.
    - Example tests: server rendering of the notice and the panel, and the loader with an injected fake.
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 6.1, 8.1_

  - [ ] 3.3 Add the Code view marks, the Keep notice and the TryIt button, then commit Group 3
    - Pass `state.repairs.picks` from `CodeViewScreen` to `Listing` and `LineRow`, so a repaired Line shows "repaired (a guess)" in its text and accessible name.
    - Add an optional `repairedCount` to `KeepView` and show the one-line notice next to the export button. Leave save and export unchanged.
    - Add the "Try a design with lost cards" button to TryIt, dispatching `request-sample` with the lost-cards Pattern.
    - Example tests for the Code view labels, the Keep notice and the TryIt button.
    - _Requirements: 4.1, 5.1, 5.2, 5.3, 6.1, 7.1_

- [ ] 4. Group 4: Finish
  - [ ] 4.1 Run the checks
    - Run `npm run typecheck`, `npm run test:run`, `npm run build` and `npm run check-bundle`. Do not run `check:browser` or `check:all`.
    - Report the entry chunk gzipped size, which must stay under 99,932 bytes before the change and under 204,800 bytes after. Confirm that `src/repair` is not in the entry chunk.
    - _Requirements: 8.1_

  - [ ] 4.2 Write the docs, commit Group 4 and push
    - Add a BUILD_LOG entry with the bundle sizes and any changed assertion, and update `docs/KIRO_USAGE.md`.
    - Commit Group 4 and push to `auto/build`.
    - _Requirements: 8.1_

## Notes

- Property tests follow `.kiro/steering/testing.md`: fixed seed, no weakened property, and a failure is reported with its shrunk counterexample, seed and path.
- Use glossary terms in new code: pick, card, hook, punched hole, end.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2"] },
    { "id": 5, "tasks": ["3.3"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2"] }
  ]
}
```
