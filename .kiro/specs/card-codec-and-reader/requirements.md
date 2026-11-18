# Requirements Document

## Introduction

This spec covers two modules of Naqsha: `src/codec` and `src/reader`.

- **Codec.** Converts between a `CardGrid` (the hole grid of one card, which is one pick) and a flat list of ends. Validates a `CardGrid` and a `CardProfile`. The mapping from hook position to end index is part of the `CardProfile`, because looms differ.
- **Reader.** Reads ONE card image into a `CardGrid`, using only the Canvas 2D API and typed arrays. The steps are: greyscale, threshold, find the card using the peg holes, decide which way up the card is from the peg hole diameters, correct tilt, sample each hook position from the profile, and decide punched or not punched.

Out of scope: camera access, the UI, the simulator, the exporter, and the archive.

Every function in both modules takes the `CardProfile` as an input. The card layout is never hard-coded (see `card-geometry.md`). Terms follow `weaving-glossary.md`: a **punched hole** is a pattern hole, a **peg hole** is a fixed alignment hole, and one card is one **pick**.

## Glossary

- **Hook position**: one position in the hole grid of a card, identified by `(hookRow, hookColumn)`. Every hook position is an end.
- **Ends list**: a `boolean[]` of length `hookRows * hookColumns`. `ends[endIndex]` is `true` when the hook for that end lifts (the hook position is a punched hole).
- **Violation**: one reported problem, with a machine-readable kind and the location it applies to.
- **Dark**: a pixel classified below the threshold. In the fixtures, holes are dark and the card surface is light.
- **Pose**: the position of the card in the image, described by tilt (degrees, positive = clockwise, from -180 to 180), scale (pixels per millimetre) and the image position of the card's top-left corner.
- **Hole accuracy**: for one image, the number of hook positions whose read value equals the ground-truth value, divided by `hookRows * hookColumns`.
- **Ground truth**: the `card` field of the JSON file written next to each fixture image by `scripts/make_fixtures.ts`.

## Referencing criteria

Acceptance criteria are referenced as `R<requirement>.<criterion>` (for example `R5.4`). Test and property names must start with that ID (see Requirement 17).

## Requirements

### Requirement 1: End-order mapping in the CardProfile

**User Story:** As a developer supporting several looms, I want the mapping from hook position to end index to be part of the CardProfile, so that a loom with different wiring needs a new profile and no new code.

#### Acceptance Criteria

1. THE CardProfile SHALL include an end-order mapping that assigns every hook position `(hookRow, hookColumn)` exactly one end index in the range `0` to `hookRows * hookColumns - 1`.
2. THE codec SHALL derive every end index from the profile's end-order mapping and SHALL NOT assume row-major order anywhere else.
3. THE demo profile `public/profiles/demo-12x16.json` SHALL state the row-major mapping explicitly, where end index = `hookRow * hookColumns + hookColumn`, and SHALL keep its ILLUSTRATIVE, UNVERIFIED status marker.
4. IF a CardProfile has no end-order mapping THEN profile validation SHALL report a violation and the codec SHALL NOT fall back to a default order.

### Requirement 2: Validate a CardProfile

**User Story:** As a developer loading profile files at runtime, I want a profile checked before it is used, so that a bad or incomplete profile gives a clear message instead of wrong output.

#### Acceptance Criteria

1. WHEN a CardProfile is validated THEN the codec SHALL return the list of all violations found, and the profile SHALL be valid if and only if that list is empty.
2. IF `hookRows` or `hookColumns` is not a positive integer THEN validation SHALL report a violation naming that field.
3. IF the card width, card height, hole diameter, horizontal pitch, vertical pitch, diameter of either peg hole, or the lacing hole diameter, is not a positive finite number THEN validation SHALL report a violation naming that field.
4. IF any hook position's hole would extend outside the card, measured from the first hole centre, the pitches and the hole diameter, THEN validation SHALL report a violation naming the hook position.
5. IF the end-order mapping assigns one end index to more than one hook position, leaves an end index unassigned, or uses an index outside `0` to `hookRows * hookColumns - 1`, THEN validation SHALL report a violation naming the offending hook position or end index.
6. THE CardProfile SHALL give each of its peg holes its own position and its own diameter.
7. IF the profile does not list exactly two peg holes, or lists two peg holes at the same position, THEN validation SHALL report a violation, because the reader needs two distinct peg holes to find the card.
8. IF the two peg hole diameters differ by less than 10% of the larger diameter THEN validation SHALL report a violation naming both peg holes, because the reader could not reliably tell which way up the card is. Equal diameters are included.
9. WHEN the value passed to profile validation is not an object, or is missing fields, THEN validation SHALL report violations and SHALL NOT throw.

### Requirement 3: Validate a CardGrid against a CardProfile

**User Story:** As a developer, I want to know whether a CardGrid fits a given CardProfile, so that malformed card data is rejected before it is encoded or used.

#### Acceptance Criteria

1. WHEN a CardGrid has exactly `hookRows` hook rows and every hook row has exactly `hookColumns` boolean values THEN validation SHALL report the CardGrid as valid.
2. IF the number of hook rows differs from `hookRows` THEN validation SHALL report a violation that states the expected and the actual count.
3. IF a hook row has a length different from `hookColumns` THEN validation SHALL report a violation that names the `hookRow` index and states the expected and the actual length.
4. IF a hook position holds a value that is not a boolean THEN validation SHALL report a violation that names that hook position.
5. THE validation SHALL return all violations found, not only the first.
6. WHEN the value passed to validation is not an array, or is `null` or `undefined`, THEN validation SHALL report a violation and SHALL NOT throw.

### Requirement 4: Encode a CardGrid into an ends list

**User Story:** As a developer, I want to turn a card's hole grid into a flat list of ends, so that other modules can work with one pick as a simple list.

#### Acceptance Criteria

1. WHEN a valid CardGrid is encoded THEN the codec SHALL return an ends list of length `hookRows * hookColumns` in which `ends[e]` equals the value of the hook position that the profile's mapping assigns to end index `e`.
2. THE number of `true` values in the ends list SHALL equal the number of punched holes in the CardGrid.
3. IF the CardGrid is not valid for the profile THEN encoding SHALL fail with the violations from Requirement 3 and SHALL NOT return a partial ends list.
4. THE encoder SHALL NOT modify its inputs, and the same inputs SHALL always give the same output.

### Requirement 5: Decode an ends list into a CardGrid

**User Story:** As a developer, I want to rebuild a card's hole grid from a list of ends, so that a stored or computed pick can be shown and compared on its card.

#### Acceptance Criteria

1. WHEN an ends list of length `hookRows * hookColumns` containing only booleans is decoded THEN the codec SHALL return a CardGrid with `hookRows` hook rows of `hookColumns` values, in which each hook position holds the value of the end index that the profile's mapping assigns to it.
2. IF the ends list length differs from `hookRows * hookColumns` THEN decoding SHALL fail and state the expected and the actual length.
3. IF an element of the ends list is not a boolean THEN decoding SHALL fail and name that end index.
4. FOR ALL valid CardGrids and all valid profiles, decoding the encoded CardGrid SHALL return a CardGrid equal to the original.
5. FOR ALL ends lists of the correct length and all valid profiles, encoding the decoded ends list SHALL return an ends list equal to the original.
6. THE CardGrid returned by decoding SHALL always pass the validation in Requirement 3.
7. THE decoder SHALL NOT modify its inputs, and the same inputs SHALL always give the same output.

### Requirement 6: Accept an image as pixel data

**User Story:** As a developer, I want the reader to work on plain pixel data, so that it can be tested without a browser and driven by any image source later.

#### Acceptance Criteria

1. THE reader SHALL accept an image as pixel data made of a width, a height and RGBA bytes in a `Uint8ClampedArray`, together with a CardProfile.
2. WHEN the caller provides a browser image source (an image element, an `ImageBitmap` or a `Blob`) THEN a separate function SHALL convert it to pixel data using only the Canvas 2D API (`drawImage` and `getImageData`).
3. THE Canvas 2D conversion SHALL be the only place in `src/reader` that uses a browser API. All other reader functions SHALL work on typed arrays only.
4. IF the width or height is not a positive integer, or the byte length is not `width * height * 4`, THEN the reader SHALL fail with reason `invalid-image` before reading any pixel.
5. THE reader SHALL NOT depend on any image-processing library.
6. THE reader SHALL NOT assume any image size, pixel scale or card position.

### Requirement 7: Convert to greyscale

**User Story:** As a developer, I want a single grey level per pixel, so that later steps do not depend on colour.

#### Acceptance Criteria

1. WHEN pixel data is converted THEN the reader SHALL return one 8-bit grey level per pixel, so the output length equals `width * height`.
2. THE reader SHALL compute each grey level from the red, green and blue bytes with one fixed luminance weighting and SHALL ignore the alpha byte.
3. WHEN a pixel has equal red, green and blue values THEN its grey level SHALL equal that value.
4. WHEN no colour channel of a pixel decreases THEN its grey level SHALL NOT decrease.
5. THE conversion SHALL NOT modify its input, and the same input SHALL always give the same output.

### Requirement 8: Threshold into dark and light

**User Story:** As a weaver photographing a card in a workshop, I want the reader to cope with brighter and darker pictures, so that I do not have to adjust the light.

#### Acceptance Criteria

1. WHEN a greyscale image is thresholded THEN the reader SHALL choose the threshold from that image's own grey-level histogram and SHALL NOT use a fixed constant.
2. THE reader SHALL return one value per pixel, dark or light, where dark means below the threshold.
3. WHEN every grey level in an image is raised or lowered by the same amount without clipping THEN the dark and light classification SHALL stay the same.
4. THE reader SHALL give a defined result for every image, including an image with a single grey level, and SHALL NOT produce `NaN` or throw.
5. THE thresholding SHALL NOT modify its input, and the same input SHALL always give the same output.

### Requirement 9: Find the card using the peg holes

**User Story:** As a weaver holding a card at an angle, I want the reader to find the card by itself, so that I do not have to line it up exactly.

#### Acceptance Criteria

1. THE reader SHALL treat dark regions that touch the image edge as the surroundings of the card, not as holes.
2. WHEN the thresholded image is searched THEN the reader SHALL identify the profile's peg holes among the dark regions by matching the peg hole positions and diameters in the profile, without assuming any tilt, scale or card position.
3. THE reader SHALL NOT mistake punched holes or lacing holes for peg holes.
4. WHEN the peg holes are found THEN the reader SHALL compute the pose: tilt in degrees (positive = clockwise), scale in pixels per millimetre, and the image position of the card's top-left corner.
5. THE reader SHALL find the card when its tilt from upright is anywhere from -10 to +10 degrees. Cards that are upside down are covered by Requirement 18.
6. FOR ALL fixtures in `tests/fixtures/`, the estimated tilt SHALL be within 0.5 degrees of the expected tilt, which is the `options.tiltDegrees` value in that fixture's ground-truth JSON.
7. IF fewer than two peg holes are found, or the peg holes found do not fit the positions in the profile, THEN the reader SHALL fail with reason `peg-holes-not-found` and SHALL NOT return a CardGrid.

### Requirement 10: Correct tilt and locate each hook position

**User Story:** As a weaver, I want each hook position read where it really is on a tilted card, so that tilt does not cause misread holes.

#### Acceptance Criteria

1. WHEN the pose is known THEN the reader SHALL compute the image location of every hook position from the profile's first hole centre and pitches, applying the pose, so that tilt is corrected.
2. FOR ALL cards, the CardGrid read from an image of the card tilted by any angle in the range of Requirement 9.5, or of Requirement 18.3 for a card that is upside down, SHALL equal the CardGrid read from an untilted image of the same card.
3. THE reader SHALL define a sampling area for each hook position that lies entirely within the hole diameter given in the profile, so that a neighbouring hole cannot affect the result.
4. IF the sampling area of any hook position lies partly or fully outside the image THEN the reader SHALL fail with reason `card-outside-image`, and SHALL NOT read any pixel outside the pixel data.

### Requirement 11: Decide punched or not punched

**User Story:** As a weaver, I want every hook position read as punched or not punched, so that the rebuilt pattern matches my card.

#### Acceptance Criteria

1. WHEN more than half of the pixels in a hook position's sampling area are dark THEN the reader SHALL record that hook position as punched (`true`), and otherwise as not punched (`false`).
2. THE reader SHALL return a CardGrid with `hookRows` hook rows of `hookColumns` values that passes the validation in Requirement 3.
3. THE reader SHALL NOT read the peg holes or the lacing holes as part of the CardGrid.
4. THE reader SHALL NOT modify the pixel data it is given, and the same input SHALL always give the same output.

### Requirement 12: Report failures and never return a guessed CardGrid

**User Story:** As a weaver with low digital literacy, I want the app to say clearly when a card could not be read, so that I never save or weave from a wrong pattern.

#### Acceptance Criteria

1. THE reader SHALL return either a success result containing the CardGrid and the pose, or a failure result containing one reason from this fixed list: `invalid-profile`, `invalid-image`, `peg-holes-not-found`, `ambiguous-orientation`, `card-outside-image`, `resolution-too-low`.
2. WHEN the profile fails the validation in Requirement 2 THEN the reader SHALL fail with reason `invalid-profile` and SHALL include the violations.
3. THE reader SHALL NOT throw for any pixel data or any profile value, including empty, oversized or uniform images.
4. WHEN the reader fails THEN it SHALL NOT return a CardGrid.
5. WHEN the card has been found and its orientation decided, IF the punched hole diameter in pixels at the measured scale is below a minimum set by measurement, THEN the reader SHALL fail with reason `resolution-too-low`, SHALL report the measured and the minimum diameter in pixels, and SHALL NOT return a CardGrid. This exists because a punched hole of only 1 to 2 pixels can vanish at its sampling position, which would otherwise give a wrong CardGrid (found in task 5.13).

### Requirement 13: Accuracy on the synthetic fixtures

**User Story:** As the project owner, I want measured accuracy targets on the seeded fixtures, so that a change that breaks reading is caught.

#### Acceptance Criteria

1. WHEN the reader reads `pick0-clean`, `pick1-clean` or `pick2-clean` from `tests/fixtures/` THEN the hole accuracy SHALL be 100%.
2. WHEN the reader reads `pick0-tilted` from `tests/fixtures/` THEN the hole accuracy SHALL be 100%.
3. WHEN the reader reads `pick0-noisy` or `pick0-noisy-tilted` from `tests/fixtures/` THEN the hole accuracy SHALL be at least 95%.
4. THE accuracy tests SHALL load the profile named in each fixture's ground truth and SHALL compare the read CardGrid with the ground-truth `card` field.
5. WHEN an accuracy test fails THEN the report SHALL state the fixture name, the measured accuracy and the list of mismatched hook positions.
6. THE accuracy targets SHALL NOT be lowered, and the fixtures SHALL NOT be changed to make a test pass, without the user's agreement (see `testing.md`).

### Requirement 14: The profile is always an input

**User Story:** As a developer supporting several looms, I want no card dimension written into the code, so that a new loom needs only a new profile file.

#### Acceptance Criteria

1. THE codec and the reader SHALL receive the CardProfile as an input parameter in every function that depends on card layout.
2. THE source of `src/codec` and `src/reader` SHALL NOT contain card dimensions, hole counts, pitches, hole positions or the demo profile's values as literals or module-level constants.
3. WHEN a CardProfile that differs from the demo profile in hook grid size, pitches, peg hole positions, peg hole diameters and end-order mapping is used with a clean synthetic image rendered from that same profile by `scripts/make_fixtures.ts` (see Requirement 19) THEN the reader SHALL reach 100% hole accuracy.
4. THE tests for criterion 3 SHALL generate the profiles and images with a fixed random seed.

### Requirement 15: Module boundaries and naming

**User Story:** As a maintainer, I want clear module boundaries and consistent terms, so that the code stays easy to follow.

#### Acceptance Criteria

1. THE `src/codec` module SHALL NOT import from any other `src/` module and SHALL NOT use any browser API, React, or file input and output.
2. THE `src/reader` module SHALL import only from `src/codec`, and SHALL NOT import from `src/ui`, `src/simulator`, `src/exporter` or `src/archive`.
3. THE types for each module SHALL live in that module's `types.ts`, with `CardProfile`, `CardGrid` and `Pattern` remaining in `src/codec/types.ts`.
4. THE code and comments in both modules SHALL use the terms in `weaving-glossary.md`, with "punched hole" for a pattern hole and "peg hole" only for a fixed alignment hole.
5. THE code in both modules SHALL be strict TypeScript, and SHALL NOT use `any`.

### Requirement 16: Performance

**User Story:** As a weaver with a basic smartphone, I want a card read quickly, so that scanning feels immediate.

#### Acceptance Criteria

1. WHEN the reader reads a 1920 x 1080 image THEN it SHALL finish in under 300 ms on a mid-range 2020 smartphone, the budget set in `tech.md`.
2. THE project SHALL include a benchmark that reads a generated 1920 x 1080 image and prints the time, so that the budget can be checked on a device. A run in Node is informational only and SHALL NOT fail the test suite.
3. THE reader SHALL add no runtime dependency to the project.

### Requirement 17: Property-based and fixture-based testing

**User Story:** As the project owner, I want the tests organised as the testing steering requires, so that a failing requirement can be traced from the test name.

#### Acceptance Criteria

1. EVERY pure function in `src/codec` and `src/reader` SHALL have at least one property-based test written with fast-check, in addition to any example-based tests.
2. EVERY property SHALL have a name that starts with the ID of the requirement criterion it checks, followed by a plain statement of that criterion, for example `R5.4 decoding an encoded CardGrid returns the original CardGrid`.
3. THE properties SHALL generate CardProfiles and CardGrids from arbitraries and SHALL NOT hard-code dimensions.
4. THE image tests SHALL use the seeded fixtures in `tests/fixtures/`, or images generated at test time with a fixed seed by `scripts/make_fixtures.ts`, and SHALL compare results with the ground-truth JSON.
5. THE tests SHALL decode the fixture PNG files with a small test-only helper that uses no image-processing library.
6. WHEN a property fails THEN the report SHALL include fast-check's shrunk counterexample, the seed and the path.
7. THE tests for these modules SHALL cover the fixture conditions clean, noisy, tilted, and noisy and tilted.
8. NO property SHALL be weakened to make a test pass without telling the user (see `testing.md`).

### Requirement 18: Detect a card that is upside down

**User Story:** As a weaver who may hold a card either way up, I want the reader to know which way up the card is, so that I never get a pattern read from a card turned by 180 degrees.

#### Acceptance Criteria

1. WHEN the peg holes have been located THEN the reader SHALL measure the diameter of each peg-hole region and SHALL compare the measured diameters with the two peg hole diameters in the profile to decide whether the card is upright or rotated by 180 degrees.
2. WHEN the measured diameters match the profile for an upright card and do not match it for a card rotated by 180 degrees THEN the reader SHALL read the card as upright.
3. WHEN the measured diameters match the profile for a card rotated by 180 degrees and do not match it for an upright card THEN the reader SHALL read the card as upside down, and for any card with a tilt within 10 degrees of 180 degrees the CardGrid SHALL equal the CardGrid read from an image of the same card upright.
4. IF the measured diameters do not allow the reader to decide between the two orientations THEN the reader SHALL fail with reason `ambiguous-orientation` and SHALL NOT return a CardGrid.
5. THE reader SHALL NOT return a CardGrid unless the orientation was decided from the peg hole diameters, so a CardGrid read from a card that may be rotated by 180 degrees is never returned.
6. THE rule that decides whether two measured diameters can be told apart SHALL depend on the profile's diameters and the measured scale, and SHALL NOT be a fixed pixel count. The design SHALL document the rule.
7. THE pose SHALL report tilt in the range -180 to 180 degrees, so that an upside-down card has a tilt near 180 degrees. WHEN a reported tilt is compared with an expected tilt, the difference SHALL be taken modulo 360 degrees.
8. THE tests for this requirement SHALL use synthetic images generated by `scripts/make_fixtures.ts` with a fixed random seed, including cards rotated by 180 degrees. To test criterion 4, THE tests SHALL use a profile that PASSES validation (including R2.8), rendered at a pixel scale so low that the measured peg hole diameters cannot be told apart. THE tests SHALL NOT use an invalid profile for this purpose.

### Requirement 19: Fixture generator follows the whole profile

**User Story:** As a developer testing the reader, I want the fixture generator to follow every part of the profile, so that tests can use profiles that differ from the demo profile.

#### Acceptance Criteria

1. THE script `scripts/make_fixtures.ts` SHALL render each peg hole at the position and with the diameter that the profile gives for that peg hole, for any positions and diameters that pass profile validation.
2. THE script SHALL read the end-order mapping from the profile, and SHALL record in each ground-truth JSON file the card's ends list in the profile's order, in addition to the `card` grid.
3. THE script SHALL NOT contain the demo profile's values as literals, and SHALL render correctly for a profile that differs from the demo profile in hook grid size, pitches, peg hole positions, peg hole diameters and end-order mapping.
4. THE demo profile `public/profiles/demo-12x16.json` SHALL be changed so that its two peg holes have different diameters (for example 2.5 mm and 3.0 mm) and so that it states the row-major end-order mapping, and it SHALL keep its ILLUSTRATIVE, UNVERIFIED status marker.
5. THE Layout table in `.kiro/steering/card-geometry.md` SHALL be updated to match the demo profile's peg hole positions and diameters, and SHALL keep the ILLUSTRATIVE, UNVERIFIED marker on every value.
6. WHEN the demo profile or the script changes THEN every file in `tests/fixtures/` SHALL be regenerated from them, and two runs of the generator SHALL give byte-identical PNG and JSON files.
7. THE existing generator tests in `tests/scripts/make_fixtures.test.ts` SHALL keep passing, and SHALL be updated only as far as the new profile fields require, without weakening any check.
8. THE script SHALL accept a `pixelsPerMm` render option, with a default of 6, SHALL render the card and its border at that scale, and SHALL record the value in `options.pixelsPerMm` of each ground-truth JSON file. R14.3 and R18.8 use this option.

## Assumptions and open questions for review

Settled by your review: orientation (Requirement 18 and R2.6 to R2.8), exactly two peg holes (R2.7), a minimum peg hole diameter difference of 10% of the larger diameter (R2.8), upside-down cards read correctly (R18.3), the fixture generator (Requirement 19) importing the end-order mapping from `src/codec`, the generator's `pixelsPerMm` option (R19.8), the tilt reference (R9.6), and `src/reader` in the property-test rule of `testing.md` and `tech.md`. Remaining notes:

1. **Failure reasons.** The list has six reasons (R12.1) and is closed. `resolution-too-low` was added after task 5.13 (R12.5).
2. **Peg diameter limitation.** Peg detection relies on peg hole diameters differing from the punched hole diameter. Validation does not enforce this. It is documented in `design.md` and in `card-geometry.md`.
3. **Carried forward.** The reader assumes holes are darker than the card surface. Mirrored images and perspective distortion are not supported. Accuracy targets cover synthetic fixtures only. The 300 ms budget is checked on a device.
