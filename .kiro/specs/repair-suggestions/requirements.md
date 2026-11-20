# Requirements Document

## Introduction

Real card chains lose cards, and weavers know that a naksha repeats and mirrors. Repair suggestions guess what a lost card probably looked like, show the evidence, and let the weaver accept or skip each guess. The feature never changes the design on its own, and every guess is labelled as a guess. It adds a pure module `src/repair` and a panel on the Weave_Screen.

## Glossary

- **Pattern**: An ordered list of CardGrid values, one per pick (the Current_Pattern is a Pattern).
- **CardGrid**: The hook positions of one card, each punched or unpunched.
- **Card_Profile**: The card geometry that a CardGrid must match.
- **Current_Pattern**: The Pattern of the design open in the app.
- **Gap**: A pick whose slot is missing (null or undefined) or damaged (fails `validateCardGrid`), as `src/simulator/prepare.ts` classifies it.
- **Suggestion**: A guess of what the card at a Gap looked like. It holds the proposed card, a kind, a Confidence, and evidence as plain data.
- **Kind**: One of `repeat`, `mirror` or `neighbours`.
  - `repeat`: the readable picks show a period p, and the lost card is taken from a pick a multiple of p away.
  - `mirror`: the chain is symmetric about a centre, and the lost card is the card at the mirror pick.
  - `neighbours`: the picks immediately before and after the Gap are identical, and that card is proposed.
- **Confidence**: `high`, `medium` or `low`. Always shown in words.
- **Repair**: Accepting a Suggestion into the Current_Pattern.
- **Repaired_Pick**: A pick whose card came from an accepted Suggestion.
- **Repair_Module**: The module `src/repair`, which imports only `src/codec` and `src/codec-view`.
- **Repair_Panel**: The panel on the Weave_Screen that lists Gaps and their Suggestions.
- **Weave_Screen**, **Code_View_Screen**, **Keep_Screen**: Existing screens of the app.
- **Saved_Design**, **Version**: As defined by the version-history spec.
- **App**: The Naqsha browser application.

## Requirements

### Requirement 1: Suggest repairs for lost cards

**User Story:** As a card maker, I want a list of guesses for each lost card, so that I can rebuild a damaged card chain.

#### Acceptance Criteria

1. WHEN `suggestRepairs` is called with a Pattern and a Card_Profile, THE Repair_Module SHALL return a result value holding, for each Gap in the Pattern, a list of zero or more Suggestions ordered best first, with cards compared by `cardToBits` from `src/codec-view`.
2. IF the Card_Profile is invalid, the Pattern is not an array, or the cards do not match the Card_Profile, or IF a Gap has no Suggestion because the Pattern has no repeat, every pick is a Gap, only one or two picks exist, or the Gap is the first or last pick, THEN THE Repair_Module SHALL return a result value without throwing, holding a failure value for the invalid input and a plain-data reason for each Gap that has no Suggestion, and holding no Gap entries when the Pattern has no Gap.

### Requirement 2: Show the evidence for each guess

**User Story:** As a weaver, I want each guess to show the evidence behind it, so that I can judge it.

#### Acceptance Criteria

1. THE Repair_Module SHALL return, for each pairing of one Gap with one of the three Kinds, exactly one result: either a Suggestion that carries its evidence as plain data, or a plain-data reason why that Kind does not apply to that Gap. For the `repeat` Kind, the evidence SHALL state the period and the picks that agree with it. Where more than one period fits, the Suggestion SHALL use the period whose pairs agree exactly, then the one with the most agreeing pairs, then the shortest.
2. IF two Suggestions of different Kinds for the same Gap propose cards that differ at one or more hook positions, THEN THE Repair_Module SHALL return both Suggestions unchanged and mark that Gap as conflicting. It SHALL NOT merge them or drop either one.

### Requirement 3: Offer repairs when cards could not be read

**User Story:** As a weaver, I want to see that cards could not be read and to ask for suggestions, so that I decide when to look at guesses.

#### Acceptance Criteria

1. WHILE the Current_Pattern has N Gaps, where N is a whole number greater than zero, THE Weave_Screen SHALL show the notice "N cards could not be read", with N written as a decimal number equal to the count of Gaps, and a "Suggest repairs" button, and WHILE the Current_Pattern has zero Gaps, THE Weave_Screen SHALL show neither the notice nor the "Suggest repairs" button.
2. WHEN the weaver presses "Suggest repairs", THE Repair_Panel SHALL, within 1 second, list every Gap, and for each Gap list every Suggestion for that Gap, and for each Suggestion show: the evidence as written text, the Confidence as written text, a drawing of the proposed card in which punched holes and unpunched positions differ by shape as well as by colour, one Accept button, and one Skip button, and THE Repair_Panel SHALL show once, as written, the text "These are guesses based on the pattern. Check them against the real card if you can."

### Requirement 4: Accept, skip and undo

**User Story:** As a weaver, I want to accept or skip each guess and undo a mistake, so that the design changes only when I say so.

#### Acceptance Criteria

1. WHEN the weaver presses Accept on a Suggestion, THE App SHALL, within 1 second, replace the card at that Gap in the Current_Pattern with the Suggestion's card, update the cloth to show the replaced card, and mark the Repaired_Pick "repaired (a guess)" on both the Weave_Screen and the Code_View_Screen listing.
2. WHEN the weaver presses Undo, THE App SHALL, within 1 second, reverse the most recent accept not yet undone (a single Accept, or all the cards of one "Accept all high-confidence" press), restore the cards the Current_Pattern held before that accept, update the cloth, and remove the "repaired (a guess)" mark from each restored Repaired_Pick, and, if no accept remains to undo, THE App SHALL leave the Current_Pattern unchanged.
3. WHEN the weaver presses the separate "Accept all high-confidence" control, THE App SHALL accept only Suggestions whose Confidence is high and whose Gap is not a conflicting Gap, and THE App SHALL change the Current_Pattern only on a press of Accept, "Accept all high-confidence" or Undo, so that skipping a Suggestion or leaving it untouched changes nothing.

### Requirement 5: Save and export repaired designs

**User Story:** As an archivist, I want repaired designs saved and exported honestly, so that guesses are not mistaken for read cards.

#### Acceptance Criteria

1. WHEN the weaver saves a design that has at least one Repaired_Pick, THE Keep_Screen SHALL save it as a normal new Version through the version-history save, keep every earlier Version unchanged, and store the cards of the Repaired_Picks as they are in the Current_Pattern.
2. WHEN the weaver exports a BMP of a design that has at least one Repaired_Pick, THE App SHALL show a notice of one line of text, in the current interface language, saying that some picks are suggested guesses, and SHALL still produce the BMP file with the same content as for a design without Repaired_Picks.
3. WHEN the weaver opens a saved design or restores a Version, THE App SHALL remove every Repaired_Pick mark from the Weave_Screen and the Code_View_Screen listing, and SHALL leave the cards of the opened or restored design unchanged.

### Requirement 6: Language and accessibility

**User Story:** As a weaver with low digital literacy, I want the panel to work in my language and with my keyboard, so that I can use it without help.

#### Acceptance Criteria

1. THE Repair_Panel SHALL: (a) define every user-visible string in both English and Hindi in the translation files, with the Hindi strings recorded as unreviewed; (b) let a user reach, operate and leave every control using the keyboard alone (Tab, Shift+Tab, Enter and Space), with no keyboard trap; (c) give every control and every drawing a non-empty accessible name that a screen reader announces; (d) convey every state or signal with at least one cue other than colour (text, shape or icon); and (e) show no horizontal scrollbar and no content that needs horizontal scrolling at a viewport width of 320 px or wider.

### Requirement 7: Try a design with lost cards

**User Story:** As a new user, I want a sample with lost cards, so that I can try the feature without a damaged card.

#### Acceptance Criteria

1. WHEN the weaver chooses "Try a design with lost cards" on the Weave_Screen, THE App SHALL replace the Current_Pattern with a sample Pattern that has exactly three Gaps and no other missing or damaged pick, where each Gap has at least one Suggestion, so that the Weave_Screen shows the notice "3 cards could not be read" with the "Suggest repairs" button, without a camera, a file, or any change to the Current_Pattern before the choice.

### Requirement 8: Load the feature on demand

**User Story:** As a weaver on a slow connection, I want the app to start fast, so that the new feature does not slow every visit.

#### Acceptance Criteria

1. THE App SHALL request the Repair_Module and the Repair_Panel only after the weaver first presses "Suggest repairs" in a page session, and the entry chunk of the production build SHALL NOT contain either of them and SHALL be under 204,800 bytes (200 KB) gzipped.
