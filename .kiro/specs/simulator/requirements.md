# Requirements Document

## Introduction

This spec covers `src/simulator`. Given a Pattern (a list of cards, one per pick) and a CardProfile from `src/codec`, the simulator shows the cloth forming pick by pick. For each card, the punched holes lift their ends, the weft passes through the shed, and the cloth advances. It renders on a plain canvas, with warp and weft drawn as visible threads in colours the user chooses, and with an option for a zari weft.

The simulator depends only on `src/codec`. It never reads a camera, a file or the network.

Out of scope for this spec: playback buttons and other UI (the simulator offers functions and a small player that the UI calls later), flagging and repairing damaged cards beyond showing them as gaps, the exporter, the archive, texture and lighting beyond the thread drawing defined here, multiple-harness ties (one end per hook position; a plain horizontal repeat count is in scope, Requirement 14), and the items under "Known limits".

Terms follow `weaving-glossary.md`: a **pick** is one pass of the weft, an **end** is one warp thread, a **lift** raises the ends whose hooks are activated by punched holes, a **float** is a thread passing over two or more threads of the other set, the **face** is the visible side of the cloth, and **zari** is metallic weft.

## Glossary

- **Card slot**: one entry of the simulator's input list, at pick index `p`. Its type is `CardGrid | null`. A slot holds a card, is **missing** (`null`), or is **damaged** (a value that fails `validateCardGrid` from `src/codec` for the profile, which can happen when slots come from stored or scanned data).
- **Slot list**: the simulator's own input type, an ordered list of card slots. It is separate from `Pattern` in `src/codec`, which is unchanged.
- **Gap pick**: a pick whose card slot is missing or damaged.
- **Lift set**: for a pick with a valid card, the ends whose hook positions are punched, found through the profile's `endOrder`. The simulator gets the lift set from `encodeCardGrid` in `src/codec`.
- **Interlacement**: at the crossing of end `e` and pick `p`, which thread is on the face. If end `e` is in the lift set of pick `p`, the warp is on the face; otherwise the weft is on the face.
- **Cloth state at pick `p`**: the interlacements of picks `0` to `p - 1`. It is a pure function of the Pattern, the profile and `p`.
- **Weft plan**: the weft used for each pick. Each weft is either a **plain weft** with a user colour or a **zari weft**.
- **Render settings**: warp colour, the weft plan, zari tone, thread size in pixels, the horizontal repeat count, the viewport (width and height in pixels), and float highlighting.
- **Base width**: the `hookRows * hookColumns` ends of one repeat. With a repeat count `k`, the cloth is `k` base widths wide.
- **Frame**: the image for one point of the animation, identified by a pick index and a phase (`lift`, `pass` with a step number, or `advance`).
- **Fell**: the edge of the woven cloth where the newest pick is beaten in.

## Referencing criteria

Acceptance criteria are referenced as `R<requirement>.<criterion>` (for example `R3.2`). Test and property names start with that ID, as `testing.md` requires.

## Requirements

### Requirement 1: Simulation input

**User Story:** As a weaver, I want to load the cards of a design, including any that are missing or damaged, so that I can see what the cloth will look like before I thread the loom.

#### Acceptance Criteria

1. THE simulator SHALL accept a CardProfile and a slot list, where slot `p` is the card for pick `p` or `null` for a missing card. The slot list SHALL be the simulator's own type, and `Pattern` in `src/codec` SHALL NOT change.
2. WHEN the simulator receives a profile THEN it SHALL check it with `parseCardProfile` from `src/codec`, and IF the profile is invalid THEN it SHALL return a failure with the violations and SHALL NOT render anything.
3. THE simulator SHALL classify every card slot as valid, missing or damaged. A slot is missing when it holds `null` (or `undefined`, which can come from untyped data). A slot is damaged when it holds any other value that fails `validateCardGrid` for the profile.
4. THE simulator SHALL report, for the whole Pattern, the list of gap picks with each pick index, whether it is missing or damaged, and for a damaged slot the violations from `validateCardGrid`.
5. THE simulator SHALL accept a Pattern of any length from 0 to at least 10,000 picks.
6. THE simulator SHALL NOT modify the profile or the Pattern it is given.

### Requirement 2: Lift and interlacement

**User Story:** As a card maker, I want each card to lift exactly the ends its punched holes select, so that the simulated cloth matches what the loom will weave.

#### Acceptance Criteria

1. THE number of ends in one base width SHALL be `hookRows * hookColumns` from the profile, one end per hook position, and end `e` SHALL be drawn at warp position `e` of each base width, counted from the left edge of that base width.
2. WHEN a pick has a valid card THEN its lift set SHALL be exactly the ends that `encodeCardGrid` marks as lifted, so the end order comes only from the profile's `endOrder`.
3. AT each crossing of end `e` and a pick with a valid card, the warp SHALL be on the face IF end `e` is in the lift set, and the weft SHALL be on the face otherwise.
4. THE simulator SHALL show the face of the cloth, with the warp and weft that are on the face drawn in front.
5. THE interlacement of a pick SHALL depend only on its own card slot and the profile, and SHALL NOT depend on any other pick.

### Requirement 3: Floats

**User Story:** As a weaver, I want long floats to be visible, so that I can spot a design that will snag or look loose.

#### Acceptance Criteria

1. THE simulator SHALL compute, for every pick with a valid card, the weft floats (runs of two or more adjacent ends with the weft on the face) and, for every end, the warp floats (runs of two or more adjacent picks with the warp on the face), each with its start, its length and the thread set.
2. A float SHALL NOT continue across a gap pick. A gap pick ends any warp float that reaches it.
3. WHERE the user enables float highlighting with a length limit THEN the simulator SHALL mark every float longer than that limit in the rendered image.
4. THE float computation SHALL be a pure function of the Pattern and the profile.

### Requirement 4: Missing and damaged cards

**User Story:** As a weaver with an old card chain, I want a missing or damaged card to show as a gap, so that I never weave from a guessed pattern.

#### Acceptance Criteria

1. WHEN a pick is a gap pick THEN the simulator SHALL draw it as a visible gap row across the full cloth width, in a gap style that cannot be mistaken for any interlacement of warp and weft.
2. THE simulator SHALL NOT infer, interpolate, copy or repeat any interlacement for a gap pick from other picks, and SHALL NOT draw warp or weft crossings in a gap row.
3. THE gap row SHALL distinguish a missing card from a damaged card.
4. A gap pick SHALL still take its place in the pick sequence, so pick `p + 1` is drawn after the gap at the same position it would have had if pick `p` were valid.
5. WHEN a damaged card is only partly valid (for example one hook row has the wrong length) THEN the simulator SHALL treat the whole pick as damaged, and SHALL NOT render the valid part of it.

### Requirement 5: Weft plan and zari

**User Story:** As a designer, I want to choose the colours of warp and weft and to use zari on chosen picks, so that the preview looks like the sari I plan to weave.

#### Acceptance Criteria

1. THE render settings SHALL include one warp colour and a weft plan.
2. THE weft plan SHALL be a non-empty list of wefts that repeats over the picks, so pick `p` uses weft `p mod n` of a plan of length `n`. A plan of length 1 uses one weft for every pick.
3. EACH weft SHALL be either a plain weft with one colour, or a zari weft with a zari tone of gold or silver.
4. THE colours SHALL be given as sRGB values (`#rrggbb`), and IF a colour is not a valid `#rrggbb` value THEN the simulator SHALL return a failure naming the setting and SHALL NOT render.
5. THE simulator SHALL draw a zari weft as a distinct thread type, with a metallic highlight pattern that a plain weft of any colour never produces, so zari picks can be told apart from plain picks in the image.
6. THE zari appearance SHALL be fixed by the zari tone and the thread size, and SHALL NOT use random numbers or the current time.

### Requirement 6: Visible threads

**User Story:** As a weaver with low digital literacy, I want the threads to look like threads, so that I can read the cloth the way I read real cloth.

#### Acceptance Criteria

1. THE simulator SHALL draw each end and each pick as a thread with a visible width in pixels set by the thread size, and SHALL draw a shading or edge at each thread's sides so that adjacent threads of the same colour remain distinguishable.
2. AT each crossing, the thread on the face SHALL be drawn over the other one, so that the over-under order is visible.
3. THE thread size SHALL be an integer number of pixels from 3 to at least 16, and IF it is outside that range THEN the simulator SHALL return a failure and SHALL NOT render. Below 3 pixels a gap row could not be told apart from cloth (R4.1).

### Requirement 7: Render any pick directly

**User Story:** As a weaver checking a long card chain, I want to jump to any pick, so that I do not wait for the animation to replay from the start.

#### Acceptance Criteria

1. THE simulator SHALL render the cloth state at any pick `p` from 0 to the Pattern length with one call that takes `p` as input.
2. THE work to render pick `p` SHALL depend on the viewport size and the number of picks visible in the viewport, and SHALL NOT grow with `p`.
3. THE image for pick `p` SHALL be equal, pixel for pixel, to the image reached by animating from pick 0 to pick `p`.
4. THE simulator SHALL NOT keep state between render calls that changes their output.
5. WHEN `p` is outside 0 to the Pattern length, or is not an integer, THEN the simulator SHALL return a failure and SHALL NOT render.

### Requirement 8: Deterministic pixels

**User Story:** As a developer and an archivist, I want the same input to give the same picture every time, so that tests and archived previews can be compared byte for byte.

#### Acceptance Criteria

1. WHEN the same profile, Pattern, render settings and frame are rendered twice THEN the two images SHALL be identical in every pixel byte.
2. THE simulator SHALL compute the image as RGBA pixel data in typed arrays, and SHALL copy it to the canvas with one `putImageData` call per frame, so that browser anti-aliasing and font rendering cannot change the result.
3. THE rendering SHALL NOT use random numbers, the current time, the device pixel ratio, or any canvas drawing call other than `putImageData`.
4. THE pixel computation SHALL run outside a browser (in Node), so that identical output can be checked in tests.

### Requirement 9: Show the cloth forming pick by pick

**User Story:** As a weaver, I want to watch each pick being woven, so that I can follow how the cards build the design.

#### Acceptance Criteria

1. THE animation of one pick SHALL show, in order: the lift (the lifted ends of that pick raised to open the shed), the weft passing across the full width, and the cloth advancing by one pick at the fell.
2. THE pass phase SHALL be shown in a fixed number of steps, so that each frame is identified by a pick index, a phase and a step number.
3. A gap pick SHALL be animated as a gap row reaching the fell, with no lift and no weft pass.
4. THE viewport SHALL keep the fell at a fixed position and show as many earlier picks as fit, with the newest pick next to the fell.
5. THE simulator SHALL offer a player that plays frames from a start pick to an end pick at a pick rate the caller chooses, and that can be paused, resumed and moved to any pick.

### Requirement 10: Smooth animation for 2000 picks

**User Story:** As a weaver with a long card chain, I want the animation to stay smooth for a whole design, so that I can watch it without stutter.

#### Acceptance Criteria

1. WHEN a Pattern of 2000 picks is played THEN the simulator SHALL render each frame in under 16 ms on a mid-range 2020 smartphone, the budget in `tech.md`, for any viewport up to 1920 x 1080 pixels.
2. ONCE the viewport is full of woven picks, THE frame time SHALL NOT grow with the pick index, so the last pick of a 2000-pick Pattern renders as fast as any other pick after the viewport has filled. Before the viewport is full, frames are cheaper because fewer woven rows are drawn. (Changed with the user's approval after the task 4.4 benchmark.)
3. THE player SHALL schedule frames with `requestAnimationFrame`, and WHEN rendering falls behind THEN it SHALL skip frames rather than slow down the pick rate.
4. THE project SHALL include a benchmark that renders frames across a generated 2000-pick Pattern at 1920 x 1080 and prints the median and worst frame time. A run in Node is informational and SHALL NOT fail the test suite.
5. THE simulator SHALL add no runtime dependency.

### Requirement 11: Errors never throw

**User Story:** As a developer, I want the simulator to report bad input instead of crashing, so that the UI can show a clear message.

#### Acceptance Criteria

1. THE simulator SHALL return either a success with the image or a failure with a reason from a fixed list, and SHALL NOT throw for any input value.
2. THE failure reasons SHALL be: `invalid-profile`, `invalid-settings` (with the setting name), and `pick-out-of-range`.
3. A missing or damaged card SHALL NOT be a failure; it SHALL be rendered as a gap (Requirement 4) and reported (R1.4).

### Requirement 12: Module boundaries

**User Story:** As a maintainer, I want the simulator to stay independent, so that it can be tested alone and reused by the exporter.

#### Acceptance Criteria

1. THE `src/simulator` module SHALL import only from `src/codec`, and SHALL NOT import from `src/reader`, `src/exporter`, `src/archive` or `src/ui`.
2. THE pixel computation SHALL use no browser API, and the only browser API in `src/simulator` SHALL be the canvas copy (`putImageData`) and `requestAnimationFrame`, kept in one file.
3. THE simulator types SHALL live in `src/simulator/types.ts`, and the code and comments SHALL use the terms in `weaving-glossary.md`.
4. THE code SHALL be strict TypeScript and SHALL NOT use `any`.
5. THE simulator SHALL take the CardProfile as an input and SHALL NOT contain card dimensions or the demo profile's values as literals.

### Requirement 13: Testing

**User Story:** As the project owner, I want the simulator tested as the testing steering requires, so that a failing requirement can be traced from the test name.

#### Acceptance Criteria

1. EVERY pure function in `src/simulator` SHALL have at least one fast-check property, with a title that starts with the ID of the criterion it checks.
2. THE properties SHALL generate profiles, Patterns (including missing and damaged slots), weft plans and render settings from arbitraries, and SHALL NOT hard-code card dimensions.
3. THE tests SHALL include properties for R7.3 (direct render equals animated render), R8.1 (identical pixels), R4.2 (a gap pick never shows crossings, and changing other picks never changes a gap row), R2.5 (changing one card changes only its own pick) and R14.2 (the tiled render equals the base render repeated).
4. WHEN a property fails THEN the report SHALL include fast-check's shrunk counterexample, the seed and the path, and no property SHALL be weakened without telling the user.

### Requirement 14: Horizontal repeat

**User Story:** As a designer, I want to see the design repeated across the width of the cloth, so that the preview looks like a full panel and not one narrow strip.

#### Acceptance Criteria

1. THE render settings SHALL include an optional horizontal repeat count, a positive integer with a default of 1, and IF it is not a positive integer from 1 to at least 64 THEN the simulator SHALL return a failure naming the setting and SHALL NOT render.
2. WHEN the repeat count is `k` THEN the cloth SHALL be `k` base widths wide, and every pixel column `x` of the tiled render SHALL equal pixel column `x mod (base width in pixels)` of a render with repeat count 1 and a viewport wide enough to hold one base width, with float highlighting off.
3. THE repeat count SHALL NOT change the lift set, the interlacement or the gap rows of any pick; it only repeats them across the width.
4. WHERE float highlighting is on with a repeat count above 1, weft floats SHALL be measured across the full tiled width, because adjacent repeats touch in the cloth.

## Decisions from the requirements review

1. **Slot list.** The simulator has its own input type, a list of `CardGrid | null` slots (R1.1). `Pattern` in `src/codec` is unchanged.
2. **One end per hook.** No tie-up. A horizontal repeat count tiles the cloth across the width (Requirement 14).
3. **Face.** No face-down setting. A lifted end shows the warp on the face (R2.3); `design.md` states the assumption.
4. **Minimum thread size.** Raised to 3 pixels (R6.3) so that gap rows can always be told apart from cloth (R4.1); the former R6.4 (1 to 2 px threads) is dropped.
5. **Gap style.** Gap rows use patterns, not only colour, so missing and damaged cards can be told apart by colour-blind users (R4.1, R4.3).
6. **Performance.** Measure first. If frame times miss the 16 ms budget (R10.1), no requirement changes: the numbers and a proposed fallback go to the user for approval. The Node benchmark is informational.
7. **Player.** A small player with play, pause, resume and seek, and no buttons (R9.5).
8. **R10.2 wording.** Approved by the user after the benchmark: frame time must stay flat once the viewport is full of woven picks; early frames may be cheaper.

## Known limits

- Extra (supplementary) zari wefts on top of the ground weft in the same pick are out of scope. Each pick has exactly one weft.
- No harness tie-up: one end per hook position, plus a plain horizontal repeat.
- No face-down weaving.
- Pattern length is tested up to 10,000 picks (R1.5).
- `renderFrame` only accepts a cloth object returned by `prepareCloth` in the same JavaScript realm. A copy of a prepared cloth, for example from `structuredClone` or a cloth posted to a Web Worker, is rejected with `invalid-settings` (setting `cloth`). A worker must call `prepareCloth` itself.
