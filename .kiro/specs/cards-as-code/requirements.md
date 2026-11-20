# Requirements Document

## Introduction

This spec adds **Code view**, a fourth Screen of the Naqsha app that shows a naksha as text: one card (one pick) per line, each punched hole a `1` and each unpunched hook position a `0`, in end order. A weaver sees cloth; a developer sees a program. Code view adds the three things a developer expects of a program listing: reading it line by line, stepping through it with breakpoints, and diffing it against another version.

Code view is a demo feature. It is small, it is built on the finished `src/codec`, and it adds no new mapping, no new renderer and no new storage. The hook-position-to-end mapping comes only from `encodeCardGrid` in `src/codec`; the cloth beside the current card is the Weave_Screen's existing simulator rendering; the designs it compares against come from the existing `src/archive`.

The work splits in two:

- A pure module, `src/codec-view`, that imports only from `src/codec` and holds all of the logic: bit lines, alignment, diff, diff text. It has no React, no DOM and no archive import, so every rule in this spec about lines and diffs is a property of a pure function.
- The Code_View_Screen in `src/ui`, lazy-loaded in its own chunk the way the Scan_Screen is, which reads the Archive, renders the lines and the cloth, and holds the breakpoints as view state.

Terms follow `weaving-glossary.md`: one **card** encodes one **pick**, an **end** is one warp thread, a **punched hole** at a **hook** position lifts that end, and a **naksha** is the design. Card geometry is never hard-coded (`card-geometry.md`): the number of ends per pick is `hookRows * hookColumns` from the Card_Profile, and the end index of a hook position is fixed by the profile's `endOrder`, a mapping the Codec_View_Module reads only through `encodeCardGrid` and never from the `endOrder` table directly.

Out of scope: see "Out of scope" at the end of this document.

## Glossary

- **App**: The Naqsha browser application in `src/ui`. Defined in `.kiro/specs/app/requirements.md`.
- **Screen**: One of the App's top-level screens, reachable from its navigation. Code view is the fourth, after Weave, Keep and Scan.
- **Weave_Screen**: The App's existing Screen that plays the Current_Pattern as cloth and offers the Sample_Designs. Defined in the app spec.
- **Scan_Screen**: The App's existing Screen that reads a card from an image. Defined in the app spec.
- **Current_Pattern**: The Pattern held in App memory, as defined in the app spec.
- **Card_Profile**: The CardProfile loaded at runtime, as defined in the app spec. It fixes `hookRows`, `hookColumns` and `endOrder`.
- **Archive**: The `src/archive` module. **Saved_Design** and **Design_Summary** are its records.
- **Codec_View_Module**: The pure module `src/codec-view`. Its exports are `cardToBits`, `patternToLines`, `diffPatterns`, `applyDiff` and `diffToText`.
- **Code_View_Screen**: The Screen in `src/ui` that shows Code view.
- **Ends_Per_Pick**: `hookRows * hookColumns` of the Card_Profile, that is, the number of ends on one card.
- **Bit_Line**: The text of one card: a string of Ends_Per_Pick characters, each `0` or `1`, where character `e` is the state of end `e`.
- **Group_Separator**: The character `|`, written into the displayed and exported text between groups of `hookColumns` ends, as a reading aid only.
- **Line**: One Bit_Line together with its pick index.
- **Line_Set**: The result of `patternToLines`: the Card_Profile name, `hookRows`, `hookColumns`, Ends_Per_Pick, and the ordered Lines of a Pattern. Two Line_Sets are **equal** when all of those are equal.
- **Window**: The slice of Lines that the Code_View_Screen has in the document at one time.
- **Window_Size**: The fixed number of Lines in a Window.
- **Breakpoint**: A pick index the user has marked on the Code_View_Screen. Breakpoints are view state of that Screen.
- **Selected_Pick**: The pick index Code view is stopped on. It is the same value the Weave_Screen seeks to.
- **Alignment**: The pairing of the Lines of two Line_Sets produced by a longest common subsequence of their Bit_Lines.
- **Diff_Entry**: One row of a Diff, of exactly one kind: `unchanged`, `changed`, `added` or `removed`.
- **Diff**: The result of `diffPatterns`: either a refusal with a reason, or an ordered list of Diff_Entries with the Diff_Counts.
- **Changed_Hole**: One end position at which the two Bit_Lines of a `changed` Diff_Entry differ.
- **Diff_Counts**: Three numbers of a Diff: changed holes, added cards, removed cards.
- **Diff_Text**: The plain text form of a Diff produced by `diffToText`: one line per Diff_Entry, each starting with a marker (space, `~`, `+` or `-`) and the pick numbers.
- **Diff_Pick_Limit**: The largest number of picks per side that `diffPatterns` accepts.
- **Code_View_Marker**: A string literal that only the Code view chunk of the Built_Site contains, used by `check:bundle` to prove the chunk split.
- **Built_Site**, **Initial_Load**, **Service_Worker**, **Precache**, **Translation_File**, **Review_List**, **Sample_Design**, **Touch_Target**: as defined in `.kiro/specs/app/requirements.md`.
- **Sim_Failure**: a `SimFailure` returned by `src/simulator`, with the kinds `invalid-profile`, `invalid-settings` and `pick-out-of-range`.
- **PreparedCloth**: the `src/simulator` type holding a Pattern prepared for rendering, which the Weave_Screen's cloth rendering takes.
- **RenderSettings**: the `src/simulator` type holding the thread colours and sizes that the Weave_Screen's cloth rendering takes.

## Referencing criteria

Acceptance criteria are referenced as `R<requirement>.<criterion>` (for example `R5.3`). Test and property names start with that ID, as `testing.md` requires.

## Requirements

### Requirement 1: A card as a line of bits

**User Story:** As a developer looking at a weave design, I want each card printed as one line of bits, so that a naksha reads like a program I can scan with my eyes.

#### Acceptance Criteria

1. THE Codec_View_Module SHALL provide `cardToBits`, which takes a Card_Profile and one card and returns a result value that, on success, holds a Bit_Line of exactly Ends_Per_Pick characters, each character either `0` or `1`, with no Group_Separator and no other character.
2. THE Codec_View_Module SHALL set character `e` of a Bit_Line to `1` for every end index `e` that the ends list returned by `encodeCardGrid` from `src/codec` for that card and Card_Profile marks as lifted, and to `0` for every other end index from 0 to Ends_Per_Pick − 1.
3. THE Codec_View_Module SHALL take the hook-position-to-end mapping only from the ends list that `encodeCardGrid` returns, SHALL NOT read the Card_Profile's `endOrder` and SHALL NOT compute an end index from `hookRows` or `hookColumns`, so that for a Card_Profile whose `endOrder` is not row-major the Bit_Line still agrees with `encodeCardGrid` at every end index.
4. IF the card fails `validateCardGrid` for the Card_Profile, THEN THE Codec_View_Module SHALL return a failure value holding the violations that `src/codec` returned, unchanged and in the order `src/codec` returned them, and SHALL return no Bit_Line and no partial Bit_Line.
5. THE Codec_View_Module SHALL provide `patternToLines`, which takes a Card_Profile and a Pattern and returns a Line_Set holding the Card_Profile name, `hookRows`, `hookColumns`, Ends_Per_Pick, and exactly one Line per card of the Pattern, where Line `p` holds pick index `p` and the Bit_Line of card `p`, so that a Pattern of `n` picks gives `n` Lines and a Pattern of no picks gives no Lines.
6. THE Codec_View_Module SHALL order the Lines of a Line_Set by ascending pick index, starting at pick index 0 and increasing by 1, with no gap and no repeated pick index.
7. THE Codec_View_Module SHALL leave the Card_Profile and the Pattern it is given unchanged, so that each remains equal by value to a copy taken before the call, and SHALL return results equal by value for two calls with inputs equal by value.
8. THE Codec_View_Module SHALL return every failure as a value and SHALL NOT throw for any input value, including a card that is not an array, a card with the wrong number of hook rows or hook columns, a card element that is not a boolean, and a Pattern that is not an array.
9. IF the card at pick index `p` of the Pattern fails `validateCardGrid` for the Card_Profile, THEN THE Codec_View_Module SHALL return a Line_Set in which Line `p` holds pick index `p` and the violations of that card in place of a Bit_Line, and SHALL hold the pick index and Bit_Line of every other pick index as R1.5 requires.
10. IF the Pattern given to `patternToLines` is not an array of cards, THEN THE Codec_View_Module SHALL return a failure value naming the Pattern as the location of the problem and SHALL return no Line_Set and no Lines.

### Requirement 2: The Code view listing

**User Story:** As a developer, I want to see the whole design as a numbered listing that stays fast on a long card chain, so that I can read a real design and not just a toy one.

#### Acceptance Criteria

1. THE App SHALL offer Code view as a fourth Screen with a navigation control beside the Weave, Keep and Scan controls, and WHEN the user activates that control, THE App SHALL show the Code_View_Screen.
2. THE Code_View_Screen SHALL show, for each Line in the Window, the pick number as a numeral and the Bit_Line, where the pick number is the pick index of that Line counted from 0, and SHALL write the Group_Separator between each group of `hookColumns` ends with no Group_Separator before the first group or after the last group, so that the shown Bit_Line holds Ends_Per_Pick characters of `0` or `1` plus `(Ends_Per_Pick / hookColumns) - 1` Group_Separators.
3. THE Code_View_Screen SHALL pad the pick number of every Line to the character width of the largest pick index of the Current_Pattern and SHALL show the Lines in fixed-width text, so that the first character of the Bit_Line of every Line in the Window starts at the same horizontal offset.
4. THE Code_View_Screen SHALL keep at most Window_Size Line elements in the document at one time, whatever the length of the Current_Pattern, by rendering only the Window around the Selected_Pick and the scroll position, where the Window is a contiguous run of Lines in ascending pick order that holds the Line of the Selected_Pick, and holds every Line of the Current_Pattern WHILE the Current_Pattern has fewer picks than Window_Size.
5. THE Window_Size SHALL be a fixed number of at least 40 and at most 200 Lines, and SHALL not change with the length of the Current_Pattern, the Selected_Pick or the viewport size.
6. THE Code_View_Screen SHALL show a listing of a 10,000-pick Current_Pattern, and THE tests SHALL check R2.4 and R2.6 at 10,000 picks.
7. WHEN the Selected_Pick changes to a Line outside the Window, THE Code_View_Screen SHALL move the Window so that the Line of the Selected_Pick is one of the at most Window_Size Line elements in the document and is inside the viewport.
8. THE Code_View_Screen SHALL show, while any Line is on screen, the total number of picks of the Current_Pattern as a numeral and the Card_Profile name.
9. IF a card of the Current_Pattern fails `validateCardGrid` for the Card_Profile, THEN THE Code_View_Screen SHALL show that Line with its pick number and a plain-language label naming it a damaged card, SHALL show no Bit_Line for that Line, and SHALL show the remaining Lines of the Window with their Bit_Lines.
10. WHEN the user opens Code view on a 10,000-pick Current_Pattern, THE Code_View_Screen SHALL have the Lines of the Window in the document within 1,000 ms of the navigation control being activated, and WHEN the Selected_Pick changes, THE Code_View_Screen SHALL have the moved Window in the document within 100 ms, both measured in the project's tests.
11. WHEN the user scrolls the listing, THE Code_View_Screen SHALL move the Window so that every Line inside the viewport is in the document, and SHALL still keep at most Window_Size Line elements in the document.

### Requirement 3: Step through the design with breakpoints

**User Story:** As a developer, I want to step through the cards and stop on the ones I marked, so that I can inspect a design the way I debug a program.

#### Acceptance Criteria

1. THE Code_View_Screen SHALL provide a step forward control, and WHEN the user activates that control, THE Code_View_Screen SHALL set the Selected_Pick to one greater than the Selected_Pick and SHALL leave the Current_Pattern and the Breakpoints unchanged.
2. THE Code_View_Screen SHALL provide a step back control, and WHEN the user activates that control, THE Code_View_Screen SHALL set the Selected_Pick to one less than the Selected_Pick and SHALL leave the Current_Pattern and the Breakpoints unchanged.
3. WHILE the Selected_Pick is the last pick index of the Current_Pattern, THE Code_View_Screen SHALL disable the step forward control, and WHILE the Selected_Pick is pick 0, THE Code_View_Screen SHALL disable the step back control.
4. THE Code_View_Screen SHALL provide a jump control that takes a pick number from 0 to the last pick index of the Current_Pattern, and WHEN the user applies that control with such a value, THE Code_View_Screen SHALL set the Selected_Pick to that value.
5. IF the jump control is applied with a value that is blank, is not a whole number, or lies outside 0 to the last pick index of the Current_Pattern, THEN THE Code_View_Screen SHALL keep the Selected_Pick and the Breakpoints unchanged, SHALL show a plain-language message naming 0 and the last pick index as the allowed range, and SHALL remove that message WHEN the jump control is next applied with a value in that range.
6. THE Code_View_Screen SHALL provide, on every Line in the Window, a control that sets a Breakpoint on that Line's pick index when that pick index has none and removes it when that pick index has one, holding at most one Breakpoint per pick index.
7. THE Code_View_Screen SHALL mark every Line that has a Breakpoint with a text or shape marker, in addition to any colour.
8. WHEN the user activates "run to next breakpoint", THE Code_View_Screen SHALL set the Selected_Pick directly to the lowest pick index above the Selected_Pick that has a Breakpoint, without making the intervening pick indices the Selected_Pick on the way.
9. IF no pick index above the Selected_Pick has a Breakpoint, THEN THE Code_View_Screen SHALL set the Selected_Pick to the last pick index of the Current_Pattern, SHALL show a plain-language message saying that no further Breakpoint was found, and SHALL announce that message in the App's live region.
10. THE Code_View_Screen SHALL hold the Breakpoints as Screen state, SHALL keep the Current_Pattern, the Saved_Designs and the exported files free of them, SHALL keep them while the user moves to another Screen and back within the same page load, and SHALL discard them when the Current_Pattern is replaced or the page is reloaded.
11. THE Code_View_Screen SHALL highlight the Line of the Selected_Pick with a text or shape marker distinct from the Breakpoint marker of R3.7, in addition to any colour, and WHILE the Selected_Pick has a Breakpoint, THE Code_View_Screen SHALL show both markers on that Line.
12. IF the step forward control or the step back control is activated while that control is disabled, THEN THE Code_View_Screen SHALL keep the Selected_Pick unchanged and SHALL show no error message.
13. THE Code_View_Screen SHALL keep a Breakpoint on a pick index whose Line has left the Window, and WHEN that Line returns to the Window, THE Code_View_Screen SHALL show the Breakpoint marker of R3.7 on it again.

### Requirement 4: The cloth beside the current card

**User Story:** As a weaver watching a developer use Code view, I want the cloth of the card under the cursor shown next to its line, so that the bits and the cloth are visibly the same thing.

#### Acceptance Criteria

1. THE Code_View_Screen SHALL show the cloth at the Selected_Pick using the same `src/simulator` functions and the same canvas component the Weave_Screen uses, SHALL take its PreparedCloth from the Current_Pattern and its RenderSettings from the same cloth choices the Weave_Screen uses, taking only the viewport size from its own layout, and SHALL add no second cloth renderer, that is, no pixel-drawing code and no canvas drawing call of its own.
2. THE App SHALL hold the Selected_Pick as one value in App state shared by the Code_View_Screen and the Weave_Screen, so that the pick either Screen last moved to is the pick the other Screen shows when it is opened, with no replay from pick 0.
3. WHEN the Selected_Pick changes, THE Code_View_Screen SHALL paint, within 100 ms of the change, the still rest frame of the new Selected_Pick, which is the frame the Weave_Screen paints when it seeks to that pick index, and SHALL start no playback.
4. IF `src/simulator` returns a Sim_Failure for the Selected_Pick, THEN THE Code_View_Screen SHALL show a plain-language message distinct for each of the kinds `invalid-profile`, `invalid-settings` and `pick-out-of-range`, SHALL paint no cloth, and SHALL keep the Lines of the Window, their pick numbers, and the step, jump and breakpoint controls shown and operable.
5. WHILE the Current_Pattern has no picks, THE Code_View_Screen SHALL show the empty-design message defined in R7.1 in place of the cloth and SHALL paint no cloth.
6. WHEN the Current_Pattern is replaced, THE App SHALL set the Selected_Pick to pick 0, so that no Selected_Pick above the last pick index of the new Current_Pattern survives the replacement.
7. THE Code_View_Screen SHALL paint, for a given PreparedCloth, RenderSettings and Selected_Pick, an image pixel-for-pixel equal to the image the Weave_Screen paints for the same PreparedCloth, the same RenderSettings and the same Selected_Pick.

### Requirement 5: Diff two designs

**User Story:** As a naqshband improving a design, I want to compare what I have now with a design I saved, so that I can see exactly which cards and which holes changed.

#### Acceptance Criteria

1. THE Codec_View_Module SHALL provide `diffPatterns`, which takes a first Line_Set as the earlier design and a second Line_Set as the later design and, for every pair of input values, returns a Diff that is either a refusal with a reason under R6.9 to R6.11 or an ordered list of Diff_Entries together with the Diff_Counts.
2. THE Codec_View_Module SHALL build the Alignment from a common subsequence of the two sequences of Bit_Lines of the greatest length such a subsequence can have, so that one inserted or deleted card leaves every Line after it matched to a Line with an equal Bit_Line, and WHERE more than one common subsequence has that greatest length, THE Codec_View_Module SHALL pick the Alignment by one tie-breaking rule that reads only the two sequences of Bit_Lines and not the order in which they were passed, so that R5.7 and R5.9 hold.
3. THE Codec_View_Module SHALL classify each Diff_Entry as exactly one of four kinds: `unchanged` where the Alignment matches two Lines with equal Bit_Lines, `changed` where the pairing of R5.4 pairs a removed Line with an added Line, `added` where a Line of the second Line_Set is neither matched by the Alignment nor paired by R5.4, and `removed` where a Line of the first Line_Set is neither matched by the Alignment nor paired by R5.4.
4. THE Codec_View_Module SHALL treat each gap of the Alignment, that is the Lines left unmatched between two consecutive matches, before the first match, or after the last match, as one block holding the unmatched Lines of the first Line_Set and the unmatched Lines of the second Line_Set, each in ascending pick index order, and SHALL pair the `k`-th unmatched Line of the first Line_Set in that block with the `k`-th unmatched Line of the second Line_Set in the same block for every `k` from 1 up to the smaller of the two counts, SHALL pair no two Lines that lie in different blocks, and SHALL leave the unmatched Lines of the larger count that take no partner, which are those with the highest pick indices in that block, as `removed` for the first Line_Set or `added` for the second.
5. THE Codec_View_Module SHALL record, in each `changed` Diff_Entry, the pick index of its Line of the first Line_Set, the pick index of its Line of the second Line_Set, both Bit_Lines, and its Changed_Holes as the end positions at which the two Bit_Lines differ, each such end position listed once and in ascending end order, and every `changed` Diff_Entry SHALL hold at least one Changed_Hole.
6. THE Codec_View_Module SHALL list the Diff_Entries in Alignment order, so that the pick indices of the first Line_Set strictly increase across the entries that carry one, namely `unchanged`, `changed` and `removed`, and the pick indices of the second Line_Set strictly increase across the entries that carry one, namely `unchanged`, `changed` and `added`.
7. THE Codec_View_Module SHALL return, for the same two Line_Sets, a Diff with the same entries in the same order, of the same kinds, with the same pick indices, Bit_Lines and Changed_Holes, and with the same Diff_Counts, whatever it has been given before, and SHALL leave both given Line_Sets unchanged.
8. THE Codec_View_Module SHALL provide `applyDiff`, which takes the first Line_Set and a Diff that `diffPatterns` returned for that Line_Set and returns a Line_Set equal, by the Line_Set equality of the Glossary, to the second Line_Set of that Diff, and SHALL leave the given Line_Set unchanged.
9. THE Codec_View_Module SHALL make the Diff of the second Line_Set against the first the mirror of the Diff of the first against the second: the same number of Diff_Entries in the same order, each `unchanged` entry holding the same two Lines, each `changed` entry holding the same two Lines with the same Changed_Holes, and each `added` entry for a Line of the one Diff being a `removed` entry for that same Line of the other.
10. IF `applyDiff` is given a Diff that is a refusal, or a Diff whose `unchanged`, `changed` and `removed` entries do not name, in ascending pick index order, exactly the Lines of the given Line_Set, THEN THE Codec_View_Module SHALL return a failure value naming that reason, SHALL return no Line_Set, and SHALL leave the given Line_Set unchanged.

### Requirement 6: The diff report, its text export and its refusals

**User Story:** As an archivist, I want counts and a plain-text diff I can copy into a note, so that a change to a design can be recorded outside the app.

#### Acceptance Criteria

1. THE Codec_View_Module SHALL report, with every Diff that is not a refusal, the Diff_Counts as three whole numbers of 0 or more: the number of Changed_Holes summed over the `changed` Diff_Entries, the number of `added` Diff_Entries, and the number of `removed` Diff_Entries.
2. THE changed-hole count of the Diff of Line_Set A against Line_Set B SHALL equal the changed-hole count of the Diff of B against A, for every pair of Line_Sets that `diffPatterns` refuses in neither direction.
3. THE Codec_View_Module SHALL count an `added` Diff_Entry in the added-cards count only and a `removed` Diff_Entry in the removed-cards count only, and SHALL NOT count any punched hole of an `added` or `removed` card as a Changed_Hole.
4. THE Codec_View_Module SHALL provide `diffToText`, which takes a Diff and returns Diff_Text holding one line per Diff_Entry, each line starting with exactly one marker character — a single space for `unchanged`, `~` for `changed`, `+` for `added`, `-` for `removed` — and SHALL write every Bit_Line of the Diff_Text with one Group_Separator between each group of `hookColumns` ends and none before the first group or after the last group.
5. THE Diff_Text SHALL separate its lines with a single newline character and SHALL end with a summary line that starts with `#` and holds the three Diff_Counts as decimal numerals separated by single spaces, in the order changed holes, added cards, removed cards; WHEN a Diff has no Diff_Entries, THE Diff_Text SHALL hold that summary line alone.
6. THE Code_View_Screen SHALL let the user compare the Current_Pattern against one Saved_Design, or two Saved_Designs against each other, chosen from the list the Archive returns, and SHALL pass the design chosen first as the first Line_Set and the Current_Pattern or the design chosen second as the second Line_Set, so that `added` always means present only in the second Line_Set.
7. THE Code_View_Screen SHALL show, for each Diff_Entry in view, the marker from R6.4, a text label of its kind, and, for a `changed` entry, the second Line_Set's Bit_Line with every differing end position marked by a text or shape marker and not by colour alone.
8. THE Code_View_Screen SHALL offer the Diff_Text both as text the user can select and copy and as a file the user can download, and the downloaded file SHALL hold the same characters as the Diff_Text shown, with no line added, removed or reordered.
9. IF the two Line_Sets have different `hookRows` or different `hookColumns`, THEN THE Codec_View_Module SHALL refuse with the reason `dimension-mismatch` carrying the `hookRows` and `hookColumns` of both Line_Sets, and SHALL return no Diff_Entries and no Diff_Counts.
10. IF the two Line_Sets carry different Card_Profile names, THEN THE Codec_View_Module SHALL refuse with the reason `profile-mismatch` carrying both names, and SHALL return no Diff_Entries and no Diff_Counts.
11. IF either Line_Set has more picks than the Diff_Pick_Limit, THEN THE Codec_View_Module SHALL refuse with the reason `too-many-picks` carrying the Diff_Pick_Limit and the pick count of both Line_Sets, and SHALL return no Diff_Entries and no Diff_Counts.
12. THE Diff_Pick_Limit SHALL be a fixed number of at least 2,000 picks that is the same on every run, and THE Code_View_Screen SHALL show, for each of the three refusal reasons, its own plain-language message that names the values the refusal carries and one action the user can take next.
13. WHEN `diffPatterns` refuses, THE Code_View_Screen SHALL keep both chosen designs listed and selectable, SHALL show no Diff_Entries and no Diff_Counts, and SHALL offer no Diff_Text to copy or download.
14. THE Diff_Text SHALL write each Diff_Entry as the marker character, one space, a pick index field, one space, and one Bit_Line, where the pick index field is the entry's pick index in the first Line_Set, the character `/`, and its pick index in the second Line_Set, each written as a decimal numeral and written as `-` where the entry has no index on that side; THE written Bit_Line SHALL be the second Line_Set's Bit_Line for an `added` or `changed` entry and the first Line_Set's Bit_Line for an `unchanged` or `removed` entry; and down the Diff_Text neither the first-Line_Set pick indices nor the second-Line_Set pick indices SHALL decrease.
15. IF `diffToText` is given a Diff that is a refusal, THEN THE Codec_View_Module SHALL return Diff_Text of one line naming the refusal reason and the values that refusal carries, and SHALL write no Diff_Entry line and no summary line.
16. WHILE the list the Archive returns holds no Saved_Design, THE Code_View_Screen SHALL disable the controls that choose a design to compare and SHALL show a plain-language message saying there is no saved design to compare against.

### Requirement 7: Empty, missing and failing inputs

**User Story:** As a weaver with low digital literacy, I want Code view to say plainly when there is nothing to show, so that I never think the app is broken.

#### Acceptance Criteria

1. WHILE the Current_Pattern has no picks, THE Code_View_Screen SHALL show a message saying there is no design yet and naming the Scan_Screen and the Sample_Designs of the Weave_Screen as the two places to get one, SHALL show no Lines, and SHALL show the step, jump, breakpoint and diff controls as present and disabled rather than absent.
2. IF a call to the Archive returns the failure `storage-unavailable`, THEN THE Code_View_Screen SHALL show the plain-language message for that failure, SHALL keep the listing of the Current_Pattern on screen, SHALL disable the controls that choose or compare a Saved_Design, and SHALL keep the step, jump and breakpoint controls enabled.
3. IF a Saved_Design chosen for a comparison contains a card that fails `validateCardGrid` for the Card_Profile, THEN THE Code_View_Screen SHALL name the design and the lowest pick index whose card fails, SHALL show no Diff_Entries and no Diff_Counts, and SHALL keep the listing of the Current_Pattern on screen.
4. IF the Archive returns the failure `not-found` for a chosen Saved_Design, THEN THE Code_View_Screen SHALL show the plain-language message for that failure, SHALL show the list of Saved_Designs the Archive returns on a fresh listing call, and SHALL keep the listing of the Current_Pattern on screen.
5. WHEN two compared Line_Sets are equal, THE Code_View_Screen SHALL report Diff_Counts of zero changed holes, zero added cards and zero removed cards, SHALL show every Diff_Entry as `unchanged`, SHALL show a message saying the two designs are the same, and SHALL show no refusal and no error message.
6. WHILE the Card_Profile has failed to load, THE Code_View_Screen SHALL show the App's profile message in place of the listing, SHALL show no Lines, SHALL disable the step, jump, breakpoint and diff controls, and SHALL keep every navigation control operable.
7. WHILE the Current_Pattern has more picks than the Diff_Pick_Limit, THE Code_View_Screen SHALL show the listing and SHALL keep the step, jump and breakpoint controls enabled.
8. WHILE the Current_Pattern has more picks than the Diff_Pick_Limit, WHEN the user asks to compare it against a Saved_Design, THE Code_View_Screen SHALL show the plain-language message for the refusal reason `too-many-picks` naming the Diff_Pick_Limit and the number of picks of the Current_Pattern, SHALL show no Diff_Counts, and SHALL keep the listing of the Current_Pattern on screen.

### Requirement 8: Module boundaries

**User Story:** As a maintainer, I want the bit lines and the diff to be pure functions in their own module, so that they can be tested alone and reused by a script or the exporter later.

#### Acceptance Criteria

1. THE Codec_View_Module SHALL live in `src/codec-view`, SHALL contain at least `index.ts` and `types.ts`, SHALL declare every type of this feature in `src/codec-view/types.ts`, and SHALL export `cardToBits`, `patternToLines`, `diffPatterns`, `applyDiff` and `diffToText` from `src/codec-view/index.ts`.
2. THE Codec_View_Module SHALL resolve every import specifier of every file in `src/codec-view` to a file in `src/codec-view` or to a file in `src/codec`, and SHALL contain no import specifier naming `src/reader`, `src/simulator`, `src/exporter`, `src/archive`, `src/ui`, an installed package or a Node built-in module.
3. THE Codec_View_Module SHALL use no React, no DOM API and no browser API, so no file in `src/codec-view` SHALL name `react`, `window`, `document`, `navigator`, `localStorage`, `indexedDB`, `fetch`, `OffscreenCanvas`, `CanvasRenderingContext2D`, `ImageData` or `requestAnimationFrame`, and every exported function of the module SHALL return its result when called in Node with no DOM present.
4. THE Code_View_Screen SHALL hold all Archive access and all rendering of this feature, so among the files of this feature only files under `src/ui` SHALL import from `src/archive`, from `src/simulator` or from `react`, and no file outside `src/ui` SHALL contain an import specifier naming `src/ui`.
5. THE Codec_View_Module SHALL take the Card_Profile as an input parameter of every exported function that needs card geometry, SHALL read `hookRows`, `hookColumns` and Ends_Per_Pick only from that Card_Profile or from a Line_Set given to it, SHALL read no `endOrder` table itself and SHALL take the hook-position-to-end mapping only from the ends list `encodeCardGrid` returns as R1.3 requires, and no file in `src/codec-view` SHALL contain the demo Card_Profile's name as a string literal or its `hookRows`, `hookColumns` or Ends_Per_Pick value as a numeric literal.
6. THE code of this feature SHALL report zero errors from the project's `typecheck` command with `"strict": true`, and SHALL contain no `any` type, no `as any` cast, no `@ts-ignore` comment and no `@ts-expect-error` comment.
7. THE identifiers and comments of this feature SHALL use the terms of `weaving-glossary.md`, and in particular `pick`, `end`, `card`, `hook` and `punchedHole`, and SHALL use none of the non-glossary names `rowIndex`, `columnIndex`, `holeValue`, `horizontalThread`, `verticalThread` or `overlap` for those concepts.
8. THE tests of this feature SHALL live in `tests/codec-view/` for the Codec_View_Module and in `tests/ui/` for the Code_View_Screen, SHALL mirror the file names of `src/` as `<subject>.test.ts` or `<subject>.test.tsx`, and no test file of this feature SHALL live in any other directory.
9. THE project SHALL record in `.kiro/steering/structure.md` an entry for the Codec_View_Module naming `src/codec-view`, its responsibilities, each of its five key exports `cardToBits`, `patternToLines`, `diffPatterns`, `applyDiff` and `diffToText`, and the dependency directions `codec-view → codec` and `ui → codec-view`.
10. THE feature SHALL add no entry to the `dependencies` of `package.json`, so that list SHALL hold the same entries after this feature as before it.
11. THE project SHALL add a test in `tests/codec-view/` that reads every import statement of every file in `src/codec-view` and of every file of this feature in `src/ui`, and IF an import statement or a named API breaks R8.2, R8.3 or R8.4, THEN that test SHALL fail and SHALL name the file, the import specifier or API name, and the criterion broken.
12. IF a file in `src/codec`, `src/reader`, `src/simulator`, `src/exporter` or `src/archive` contains an import specifier naming `src/codec-view`, THEN the test of R8.11 SHALL fail and SHALL name that file, so that the dependency direction stays one-way.

### Requirement 9: Bundle, precache and offline

**User Story:** As a weaver on a basic phone and a weak connection, I want Code view to cost me nothing until I open it and to work with the network off, so that the app stays as light and as usable as before.

#### Acceptance Criteria

1. WHEN the user opens Code view for the first time since the page was loaded, THE App SHALL request the Code view chunk and SHALL load the Code_View_Screen from it, in the way the Scan_Screen is loaded, and THE App SHALL request that chunk at no earlier point of that page session.
2. THE Initial_Load of the Built_Site SHALL stay under 200 KB of JavaScript gzipped, measured as `check:bundle` already measures it: the gzipped size of the entry chunk named by the module script of `dist/index.html`, which SHALL stay below 204,800 bytes with this feature built.
3. IF the entry chunk of the Built_Site contains the Code_View_Marker, THEN THE `check:bundle` check SHALL report that problem and fail, and IF no other `.js` chunk of `dist/assets` contains the Code_View_Marker, THEN THE `check:bundle` check SHALL report that problem and fail.
4. THE project SHALL record in `docs/BUILD_LOG.md`, as byte counts measured by `check:bundle`, the gzipped size of the entry chunk before this feature, the gzipped size of the entry chunk after this feature, the gzipped size of the Code view chunk, and the 204,800-byte limit.
5. THE Precache of the Service_Worker in `dist/sw.js` SHALL hold an entry naming the Code view chunk, and IF the Precache list omits any file of the Built_Site, or names an entry that is not a file of the Built_Site, THEN THE `check:bundle` check SHALL report that problem and fail.
6. THE project SHALL add a test that identifies the Code view chunk as the `.js` file of `dist/assets` containing the Code_View_Marker, and IF no entry of the generated Precache list of `dist/sw.js` names that file, THEN THE test SHALL fail and SHALL name the chunk it looked for.
7. THE `check:browser` offline step SHALL check, in both its group A (offline, no reload) and its group B (offline, then reload the page), that with Chrome offline and the preview server stopped the first open of Code view in that page session shows the Lines of a Sample_Design, reports that Sample_Design's pick count, and moves the Selected_Pick from pick 0 to pick 1 on one activation of the step forward control.
8. IF any of the Code view checks of the `check:browser` offline step fails or does not run, THEN THE step SHALL fail and SHALL name the group and the check that did not pass, and a check that did not run SHALL NOT count as a pass.
9. THE Code_View_Marker SHALL be a string literal of the Code_View_Screen's own code and not an identifier, so that it survives minification, and THE `check:bundle` check SHALL report the file name and the gzipped size of every `.js` chunk of `dist/assets` that contains it.
10. IF the request for the Code view chunk fails, THEN THE App SHALL show a plain-language message saying Code view could not be loaded, SHALL keep the navigation and the other Screens usable, and SHALL leave the Current_Pattern unchanged.

### Requirement 10: Text and language

**User Story:** As a Hindi-speaking weaver, I want every word of Code view in Hindi, so that the screen is as readable to me as the rest of the app.

#### Acceptance Criteria

1. THE Code_View_Screen SHALL take every user-visible string, including every control label, heading, message and accessible name, from a Translation_File by key, and SHALL contain no user-visible word as a literal in a component, with the only exception being the fixed characters of R10.6.
2. THE project SHALL add every new key to both the `hi` and the `en` Translation_File, so that the two files hold the same set of keys, and SHALL use in the `hi` text of a key the same placeholder names as in the `en` text of that key.
3. THE Hindi strings of Code view SHALL use exactly the Hindi terms already used in the `hi` Translation_File for the glossary terms — पिक for pick, एंड for end, कार्ड for card, छेद for a punched hole, नक्शा for the naksha and नक्शबंद for the naqshband — and SHALL use no other word for those six concepts.
4. THE project SHALL set the per-key reviewed state of every new Hindi string to not reviewed, so that the Review_List names that key with its Hindi text and its English text until a native Hindi speaker marks it reviewed.
5. THE Code_View_Screen SHALL show every pick number, end position and Diff_Count as the digits `0` to `9`, identical in both languages, inserted into the string of a Translation_File through a placeholder, and SHALL take every word around those numbers from a Translation_File.
6. THE Code_View_Screen SHALL show the Bit_Line characters `0` and `1`, the Group_Separator and the Diff_Entry markers ` `, `~`, `+` and `-` identically in both languages, and SHALL take them from the Codec_View_Module and not from a Translation_File.
7. THE Codec_View_Module SHALL produce the same Diff_Text in both languages, because it takes no Translation_File (R8.2, R8.3), and THE Code_View_Screen SHALL take every label, heading and message it shows around that Diff_Text from a Translation_File.
8. THE Code_View_Screen SHALL take the accessible names of R11.3 to R11.5 and the live-region announcement of R11.6 from a Translation_File, with the pick number, the end positions and the Diff_Entry kind inserted as placeholders, so that a screen reader set to Hindi hears पिक and एंड and no English word.

### Requirement 11: Keyboard, screen reader and layout

**User Story:** As a user with a keyboard, a screen reader, colour-blindness or a small phone, I want Code view to be as usable as the other screens, so that the feature does not exclude me.

#### Acceptance Criteria

1. THE Code_View_Screen SHALL make every step, jump, breakpoint and diff control reachable and operable with the keyboard alone, in a tab order that follows the visual order, SHALL leave no control reachable only by pointer, and SHALL let keyboard focus leave the listing and reach the App navigation without a pointer.
2. WHILE a control of the Code_View_Screen has keyboard focus, THE Code_View_Screen SHALL show a focus indicator on that control with a contrast ratio of at least 3:1 against its neighbours, and SHALL bring that control into view so that no part of the indicator is hidden by the edge of a Bit_Line region or of the listing.
3. THE Code_View_Screen SHALL give each Line of a valid card an accessible name holding the pick number that Line shows and then the end indices of its punched holes in ascending order, separated by a comma and a space, with no punched end omitted and with no Group_Separator in the name; in the `en` Translation_File this name reads exactly "Pick 5: punched at ends 0, 3, 7" for pick 5 punched at ends 0, 3 and 7.
4. WHEN a Line has no punched hole, THE Code_View_Screen SHALL give it an accessible name holding the pick number and a statement that no end is punched, taken from the Translation_File, reading exactly "Pick 5: no end punched" in `en` for pick 5.
5. THE Code_View_Screen SHALL hold, in the accessible name of each Diff_Entry, the word for its kind in the current language as changed, added, removed or unchanged, the pick number or both pick numbers of that entry, and for a `changed` entry the differing end indices in ascending order, and SHALL NOT leave the marker character of R6.4 as the only statement of the kind.
6. WHEN the Selected_Pick changes by a step, a jump or "run to next breakpoint", THE Code_View_Screen SHALL announce the new pick number in the App's live region once per change, and SHALL announce nothing WHEN the Window moves while the Selected_Pick is unchanged.
7. THE Code_View_Screen SHALL mark every Breakpoint, the Selected_Pick, and each Diff_Entry kind with a text label or a shape marker in addition to any colour, using the markers of R6.4 — `~` for changed, `+` for added, `-` for removed and a space for unchanged — so that each of these states can be told apart from the others when the screen is rendered without colour.
8. THE Code_View_Screen SHALL lay out without horizontal page scrolling at viewport widths of 320, 390 and 1280 CSS pixels, measured as the document being no wider than the viewport at that width, by letting each Bit_Line scroll horizontally inside its own region rather than wrapping onto a second visual row, and THE `check:browser` check SHALL fail IF the document is wider than the viewport at any of those three widths.
9. WHILE the operating system reports `prefers-reduced-motion: reduce`, WHEN the Window or the Selected_Pick moves, THE Code_View_Screen SHALL place the new Window and the new Selected_Pick marker in one step with no CSS transition, no animation and no smooth scrolling, and SHALL have the Line of the Selected_Pick in view once the move is done.
10. THE Code_View_Screen SHALL give every interactive control, including the breakpoint control on each Line, a Touch_Target of at least the size the App's Touch_Target definition already requires, at every viewport width from 320 to 1920 CSS pixels.
11. THE Code_View_Screen SHALL place each Bit_Line in its own region that carries an accessible name holding the pick number of that Line, is in the tab order, is marked for assistive technology as a scrollable region, and scrolls horizontally to both its first end and its last end with the keyboard alone.
12. WHEN a Line shows a card that fails `validateCardGrid` (R2.9), THE Code_View_Screen SHALL give that Line an accessible name holding the pick number and the damaged-card label from the Translation_File, and SHALL list no end indices in that name.
13. IF the element with keyboard focus leaves the document because the Window moved, THEN THE Code_View_Screen SHALL move focus to the control of the same kind on the Line of the Selected_Pick, or to the step forward control where that Line has no such control, and SHALL NOT leave the document body focused.

### Requirement 12: Testing

**User Story:** As the project owner, I want Code view tested the way `testing.md` requires, so that a failing requirement can be traced from the test name.

#### Acceptance Criteria

1. THE project SHALL provide, for each of the five exported functions of the Codec_View_Module (`cardToBits`, `patternToLines`, `diffPatterns`, `applyDiff` and `diffToText`), at least one fast-check property and at least one example-based test.
2. THE title of each property of this feature SHALL start with the ID of the criterion it checks, in the form `R<requirement>.<criterion> `, followed by a plain statement of that criterion, for example `R5.8 applying a diff to the first design gives the second`, and SHALL NOT consist of the ID alone or of a title that names no requirement.
3. THE properties SHALL take `hookRows`, `hookColumns` and `endOrder` of the Card_Profile, the Patterns and the pick counts from arbitraries, SHALL generate pick counts over a range that includes 0 picks and 1 pick, and SHALL contain no card dimension, Ends_Per_Pick value or punched-hole count as a numeric literal.
4. THE properties SHALL pass a fixed `seed`, written as a literal in the test file, and a fixed `numRuns` of at least 100 in the options of `fc.assert`.
5. THE project SHALL implement every property marked demo-essential in "Correctness properties" below, that is P1, P2, P3, P4, P5, P6, P7 and P10.
6. IF a property of this feature fails, THEN THE project SHALL report fast-check's shrunk counterexample, the seed and the path that fast-check prints, and SHALL state whether the code or the property is wrong.
7. THE project SHALL NOT weaken a property of this feature to make a test pass without telling the user, where weakening includes narrowing an arbitrary so the failing inputs are no longer generated, adding `fc.pre` or a `.filter` that excludes the failing inputs, lowering `numRuns`, loosening a tolerance, replacing an equality with a looser check, skipping, marking `.todo`, and deleting.
8. THE project SHALL add one example-based test of the Code_View_Screen per criterion from R7.1 to R7.5 and R7.8, covering the empty Current_Pattern (R7.1), the Archive failure `storage-unavailable` (R7.2), a Saved_Design that fails `validateCardGrid` (R7.3), the Archive failure `not-found` (R7.4), two equal Line_Sets (R7.5) and a Current_Pattern longer than the Diff_Pick_Limit (R7.8).
9. THE properties SHALL run through `fc.assert`, and SHALL NOT wrap it in `try`/`catch` or replace its check with one that hides the failure message.
10. WHEN the cause of a reported property failure is fixed, THE project SHALL keep that shrunk counterexample as a permanent regression case through the `examples` option of the same property.
11. WHERE a change to a property of this feature reduces what that property covers, THE project SHALL state exactly what is changed and why before or together with the change, and SHALL wait for the user to agree before making it.

## Correctness properties

Each property is written with fast-check, is named with the criterion it checks, and runs with a fixed seed (R12.2, R12.4). "Demo-essential" properties must exist for this feature to count as done; "cuttable" ones are the first to drop if time runs out.

| Property | Criterion | Statement | Status |
|---|---|---|---|
| P1 | R1.1, R1.2 | For any valid Card_Profile and card, `cardToBits` returns a string of Ends_Per_Pick characters, every character is `0` or `1`, and character `e` is `1` exactly when `encodeCardGrid` lifts end `e`. | Demo-essential |
| P2 | R1.2 | Round trip: for any valid Card_Profile and card, reading the Bit_Line back as an ends list and passing it through `decodeEnds` returns the original card. | Demo-essential |
| P3 | R5.1, R7.5 | `diffPatterns(a, a)` reports no `changed`, `added` or `removed` Diff_Entries and Diff_Counts of zero, for any Line_Set `a`. | Demo-essential |
| P4 | R5.8 | `applyDiff(a, diffPatterns(a, b))` returns a Line_Set equal to `b`, for random Patterns of differing lengths over the same Card_Profile. | Demo-essential |
| P5 | R6.1, R6.3 | Flipping exactly one punched hole of exactly one card gives exactly one `changed` Diff_Entry, no `added` and no `removed` entries, and a changed-hole count of 1. | Demo-essential |
| P6 | R5.2 | Inserting one card at any position gives exactly one `added` Diff_Entry, no `changed` and no `removed` entries. | Demo-essential |
| P7 | R5.9, R6.2 | For any two Line_Sets `a` and `b` that `diffPatterns` refuses in neither direction, `diffPatterns(b, a)` is the mirror of `diffPatterns(a, b)` — the same entries in the same order, each `unchanged` and each `changed` entry holding the same two Lines and the same Changed_Holes, and each `added` entry of the one being the `removed` entry of the other — and so the changed-hole counts of the two Diffs are equal. | Demo-essential |
| P8 | R6.4, R6.5, R6.14 | `diffToText` writes one line per Diff_Entry plus one summary line, every Diff_Entry line starts with one of the four markers and the summary line with `#`, and the pick numbers down the text do not decrease. | Cuttable |
| P9 | R2.4, R2.6 | For a Pattern of up to 10,000 picks and any Selected_Pick, the Window holds at most Window_Size Lines and contains the Line of the Selected_Pick. | Cuttable |
| P10 | R1.8, R6.9 to R6.11 | For any input value, including a non-array, a wrong-length card and mismatched Line_Sets, every exported function returns a value and throws nothing. | Demo-essential |

P7 is demo-essential because R5.2 now closes what was open. Where two common subsequences of the Bit_Lines are equally long, R5.2 requires the Alignment to be picked by one tie-breaking rule that reads only the two sequences of Bit_Lines and not the order in which they were passed, so a tie can no longer be broken by argument order and pair different Lines in `diffPatterns(a, b)` than in `diffPatterns(b, a)`. R5.9 states the mirror property that this rests on, and R6.2's equal changed-hole counts follow from it. The design phase must name the concrete tie-breaking rule it uses and show that the rule picks the same Alignment both ways round; if no such rule gives symmetry, the design phase must bring the counterexample back to this document for a decision rather than dropping R6.2 silently.

## Decisions taken in writing these requirements

1. **Virtualised, not paginated.** The listing renders only a Window of at most Window_Size Lines (R2.4, R2.5) and is tested at 10,000 picks (R2.6). Pagination was rejected because stepping and "run to next breakpoint" would have to move between pages.
2. **Bits are in end order, grouped by `hookColumns`.** The only mapping is `encodeCardGrid` (R1.3). The Group_Separator every `hookColumns` ends is a reading aid; with the demo profile's row-major `endOrder` each group happens to be one hook row, and with another `endOrder` a group is still exactly `hookColumns` ends but need not be one hook row. No second mapping is added to make groups match hook rows.
3. **A Bit_Line is a string.** `0` and `1` characters, so the Alignment can compare whole Lines cheaply and `diffToText` needs no conversion.
4. **Diff refuses rather than guesses.** Different dimensions, different Card_Profile names, or too many picks are refusals with reasons (R6.9 to R6.11), never a best-effort comparison.
5. **Breakpoints are not data.** They are Screen state, discarded on reload and never written to the Archive or an exported file (R3.10).
6. **One renderer, one seek value.** Code view reuses the Weave_Screen's simulator rendering and shares the Selected_Pick with it (R4.1, R4.2), so the two screens cannot disagree about which pick is current.
7. **Module name.** `src/codec-view`, because it is a view of codec data with no dependency beyond `src/codec`. It is a new module, so `structure.md` has to record it (R8.9).
8. **The Diff_Text line format is fixed here, not left to the design.** R6.14 fixes each Diff_Entry line as `marker pickA/pickB bits`: the marker character of R6.4, one space, the pick index of the first Line_Set and the pick index of the second separated by `/`, with `-` written for a side the entry has no index on, one space, then the Bit_Line with Group_Separators. R6.5 fixes the last line as a `#` summary line holding the three Diff_Counts. Fixing the format in the requirements keeps the Diff_Text a stable thing an archivist can paste into a note and a test can compare against, and keeps it the same in both languages (R10.6, R10.7).

## Out of scope

- Comparing two designs built for different Card_Profiles, or for the same loom with different `endOrder` tables. Such a comparison is refused (R6.9, R6.10).
- Editing a design from Code view. Code view reads; the Scan_Screen's tap-to-correct remains the only way to change a card.
- Parsing a Bit_Line listing back into a Pattern, and importing a diff from another tool. Only `applyDiff` on a Diff this module produced is in scope (R5.8).
- A three-way diff, a merge, or any history beyond the two designs being compared.
- Syntax colouring of motifs, float marking, or any weave analysis in the listing; the Weave_Screen already shows floats and gaps.
- Diffing designs longer than the Diff_Pick_Limit (R6.11).
- Persisting Breakpoints, the Selected_Pick or the chosen comparison across a page reload.
