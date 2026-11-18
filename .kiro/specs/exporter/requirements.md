# Requirements Document

## Introduction

This spec covers `src/exporter`. It exports a Pattern (a list of CardGrids from `src/codec`, one card per pick) as an uncompressed BMP file with a colour table, so that a weaver can load the design onto an electronic Jacquard loom. The image has one pixel per end and one row per pick. Ends are placed in the order the profile's `endOrder` gives. There are two variants: 1 bit per pixel and 8 bits per pixel. The BMP bytes are written by hand, with no image library.

The exporter also reads back the files it writes, so that a round trip can be tested and an exported design can be re-imported.

The exporter depends only on `src/codec`. It never reads a camera, the network or the simulator.

**Controller compatibility.** Each electronic Jacquard loom controller may need a specific variant (bit depth, colour of a lifted end, which pick comes first, which end is on the left). No controller has been tested with these files. The product goal "exported bitmaps load correctly on at least two common electronic Jacquard loom controllers" (`product.md`) is not met by this spec and stays unverified until a real controller is tried.

Out of scope: the JSON design file and the cloth PNG (prompt 29), designs with missing or damaged cards, multiple-harness ties or repeats across the width, compressed BMP, other image formats, and any controller-specific format other than plain BMP.

Terms follow `weaving-glossary.md`: a **pick** is one pass of the weft (one card), an **end** is one warp thread, a **punched hole** at a hook position lifts its end, and a **lift** is the set of ends raised for one pick.

## Glossary

- **Export options**: bit depth (1 or 8), lift colour (`black` or `white`), pick order (`first-at-top` or `first-at-bottom`), and end order across the image (`first-at-left` or `first-at-right`).
- **Lifted pixel**: the pixel for end `e` of pick `p`. It has colour index 1 when end `e` is lifted in pick `p`, and colour index 0 otherwise.
- **Colour table**: the BMP palette after the headers. Index 0 is the colour of an end that stays down; index 1 is the colour of a lifted end, set by the lift colour option.
- **Image row**: one row of pixels. Image rows are stored bottom-up in the file, as BMP requires for a positive height.
- **Row stride**: the number of bytes in one stored image row, padded to a multiple of 4.
- **Round trip**: export a Pattern, then read the bytes back with the same profile and options.

## Referencing criteria

Acceptance criteria are referenced as `R<requirement>.<criterion>` (for example `R3.2`). Test and property names start with that ID, as `testing.md` requires.

## Requirements

### Requirement 1: Input

**User Story:** As a card maker, I want to export a checked design, so that the loom never weaves from bad card data.

#### Acceptance Criteria

1. THE exporter SHALL accept a CardProfile, a Pattern (a list of CardGrids, one per pick) and export options.
2. WHEN the exporter receives a profile THEN it SHALL check it with `parseCardProfile` from `src/codec`, and IF it is invalid THEN it SHALL return a failure with the violations and SHALL NOT produce any bytes.
3. WHEN any card fails `validateCardGrid` for the profile THEN the exporter SHALL return a failure naming every such pick index with its violations, and SHALL NOT produce any bytes. A card SHALL never be guessed, repaired or skipped.
4. IF the Pattern has no picks THEN the exporter SHALL return a failure and SHALL NOT produce any bytes.
5. THE exporter SHALL accept a Pattern of at least 10,000 picks.
6. THE exporter SHALL NOT modify the profile, the Pattern or the options.

### Requirement 2: Pixels follow the profile's end order

**User Story:** As a weaver, I want each pixel to be the end the loom expects, so that the woven design matches the cards.

#### Acceptance Criteria

1. THE image width in pixels SHALL equal `hookRows * hookColumns` from the profile, one pixel per end, and the image height SHALL equal the number of picks, one image row per pick.
2. THE exporter SHALL get each pick's lift from `encodeCardGrid` in `src/codec`, so that the end order comes only from the profile's `endOrder`.
3. THE pixel for end `e` of pick `p` SHALL have colour index 1 when end `e` is lifted in pick `p`, and colour index 0 otherwise.
4. WITH end order `first-at-left`, end 0 SHALL be the leftmost pixel; WITH `first-at-right`, end 0 SHALL be the rightmost pixel.
5. WITH pick order `first-at-top`, pick 0 SHALL be the top image row as an image viewer shows it; WITH `first-at-bottom`, pick 0 SHALL be the bottom image row.

### Requirement 3: BMP file structure

**User Story:** As a developer, I want a plain, standard BMP, so that common software and loom controllers can open it.

#### Acceptance Criteria

1. THE file SHALL start with a 14-byte file header (`BM`, file size, two reserved zero fields, pixel data offset) followed by a 40-byte `BITMAPINFOHEADER`, with all multi-byte fields little-endian.
2. THE info header SHALL give the width, a positive height (rows stored bottom-up), one plane, the bit depth (1 or 8), compression `BI_RGB` (0, uncompressed), the image size in bytes, and the number of colour table entries.
3. EACH stored image row SHALL be padded with zero bytes to a multiple of 4 bytes, so the row stride is `4 * ceil(width * bitDepth / 32)` bytes.
4. IN the 1-bit variant, the leftmost pixel of a row SHALL be the most significant bit of the row's first byte, and unused bits in the last byte SHALL be zero.
5. IN the 8-bit variant, each pixel SHALL be one byte holding its colour index (0 or 1).
6. THE file size in the file header SHALL equal the actual number of bytes, which is `14 + 40 + 4 * (colour table entries) + rowStride * height`, and the pixel data offset SHALL equal `14 + 40 + 4 * (colour table entries)`.
7. THE image size field SHALL equal `rowStride * height`.
8. THE exporter SHALL write the BMP bytes itself into a `Uint8Array`, and SHALL NOT use an image library, a canvas or any other dependency.

### Requirement 4: Colour table

**User Story:** As a weaver, I want the file to state which colour means a lifted end, so that the loom and any viewer agree on it.

#### Acceptance Criteria

1. EVERY exported file SHALL contain a colour table, placed directly after the info header, with each entry stored as 4 bytes (blue, green, red, reserved zero).
2. THE 1-bit variant SHALL have a colour table of exactly 2 entries.
3. THE 8-bit variant SHALL have a colour table of exactly 256 entries. Only indices 0 and 1 SHALL be used by pixels, and the info header SHALL state 2 important colours.
4. WITH lift colour `black` (the default), index 0 SHALL be white (255, 255, 255) and index 1 black (0, 0, 0). WITH lift colour `white`, index 0 SHALL be black and index 1 white.
5. THE unused entries 2 to 255 of the 8-bit colour table SHALL all be the colour of index 0.

### Requirement 5: Export options

**User Story:** As a weaver whose loom expects a particular layout, I want to choose the variant, so that I can match my controller.

#### Acceptance Criteria

1. THE options SHALL have defaults: bit depth 1, lift colour `black`, pick order `first-at-top`, end order `first-at-left`.
2. IF an option has a value outside its allowed set THEN the exporter SHALL return a failure naming the option, and SHALL NOT produce any bytes.
3. THE exporter SHALL record no options in the file other than what the BMP headers and the colour table already express.

### Requirement 6: Read back an exported file

**User Story:** As a card maker, I want to re-import a design I exported, so that I can check it or edit it later.

#### Acceptance Criteria

1. THE exporter SHALL provide a reader that takes the file bytes, a CardProfile and the export options, and returns the Pattern, or a failure.
2. THE reader SHALL accept only files in the variants this exporter writes: `BM`, a 40-byte info header, one plane, bit depth 1 or 8, compression 0, a positive height, and a colour table with the entry count of that bit depth.
3. THE reader SHALL decide whether an end is lifted from the colour table entry its pixel uses, by comparing it with the lift colour option, and SHALL fail if a pixel uses a colour that is neither the lifted nor the down colour.
4. IF the file's width differs from `hookRows * hookColumns` of the profile THEN the reader SHALL fail and state both widths.
5. IF the file size in the header, the pixel data offset, the image size, or the actual length of the bytes do not agree with each other and with the width, height and bit depth THEN the reader SHALL fail and state which value is wrong.
6. THE reader SHALL turn each image row back into a CardGrid with `decodeEnds` from `src/codec`, so that the end order comes only from the profile's `endOrder`.
7. THE reader SHALL NOT throw for any byte sequence, and SHALL NOT read outside the given bytes.

### Requirement 7: Round trip and stated properties

**User Story:** As the project owner, I want the export proven by properties, so that a design survives export and re-import exactly.

#### Acceptance Criteria

1. FOR ALL valid profiles, Patterns of valid cards and export options, reading back the exported bytes with the same profile and options SHALL return a Pattern equal to the original.
2. FOR ALL exports, the file size in the file header SHALL equal the length of the bytes, and SHALL equal `14 + 40 + 4 * (colour table entries) + rowStride * height`.
3. FOR ALL exports, the colour table SHALL be present, with 2 entries for 1 bit and 256 for 8 bits, and its index 0 and index 1 SHALL match the lift colour option.
4. FOR ALL exports, the same profile, Pattern and options SHALL give identical bytes.
5. FOR ALL exports, the 1-bit and the 8-bit file of the same Pattern SHALL read back to the same Pattern.

### Requirement 8: Save the file

**User Story:** As a weaver, I want to save the file to my device, so that I can copy it to the loom.

#### Acceptance Criteria

1. THE exporter SHALL provide a function that offers the bytes to the user as a download with a file name ending in `.bmp` and the MIME type `image/bmp`.
2. THE download function SHALL be the only code in `src/exporter` that uses a browser API, and SHALL be kept in one file.
3. THE suggested file name SHALL contain only letters, digits, `-` and `_` before `.bmp`, and SHALL include the bit depth (for example `design-1bit.bmp`).

### Requirement 9: Errors never throw

**User Story:** As a developer, I want the exporter to report bad input instead of crashing, so that the UI can explain the problem.

#### Acceptance Criteria

1. THE export function and the reader SHALL return either a success or a failure with a reason from a fixed list, and SHALL NOT throw for any input value.
2. THE export failure reasons SHALL be: `invalid-profile`, `invalid-card` (with every bad pick and its violations), `empty-pattern`, and `invalid-options` (with the option name).
3. THE reader failure reasons SHALL be: `invalid-profile`, `invalid-options`, `not-a-bmp`, `unsupported-bmp` (with the field), `inconsistent-size` (with the field), `width-mismatch` (with both widths), and `unknown-colour`.

### Requirement 10: Module boundaries

**User Story:** As a maintainer, I want the exporter to stay small and independent, so that it can be tested alone.

#### Acceptance Criteria

1. THE `src/exporter` module SHALL import only from `src/codec`, and SHALL NOT import from `src/reader`, `src/simulator`, `src/archive` or `src/ui`.
2. THE exporter types SHALL live in `src/exporter/types.ts`, and the code and comments SHALL use the terms in `weaving-glossary.md`.
3. THE code SHALL be strict TypeScript and SHALL NOT use `any`.
4. THE exporter SHALL take the CardProfile as an input and SHALL NOT contain card dimensions or the demo profile's values as literals.
5. THE exporter SHALL add no runtime dependency.

### Requirement 11: Documentation of controller compatibility

**User Story:** As a weaver, I want to know the file may not suit my loom, so that I check it before weaving.

#### Acceptance Criteria

1. THE README and the exporter section of `structure.md` SHALL state that each loom controller may need a specific variant (bit depth, lift colour, pick order, end order).
2. THE README SHALL state that no loom controller has been tested with the exported files.
3. THE documentation SHALL list the options so a weaver can match a controller's manual.
4. THE documentation SHALL state that the right lift colour for each controller is unverified, and that black for a lifted end is only the default.

### Requirement 12: Testing

**User Story:** As the project owner, I want the exporter tested as the testing steering requires, so that a failing requirement can be traced from the test name.

#### Acceptance Criteria

1. EVERY pure function in `src/exporter` SHALL have at least one fast-check property, with a title that starts with the ID of the criterion it checks.
2. THE properties SHALL generate profiles, Patterns and options from arbitraries, and SHALL NOT hard-code card dimensions.
3. THE tests SHALL include the properties in Requirement 7, a property that the reader never throws for any bytes (R6.7), and a test that a known small Pattern exports to known bytes written out in the test.
4. WHEN a property fails THEN the report SHALL include fast-check's shrunk counterexample, the seed and the path, and no property SHALL be weakened without telling the user.

## Decisions from the requirements review

1. **Gaps.** A design with a missing or damaged card fails to export (R1.3).
2. **Lift colour.** Black for a lifted end is the default, white is an option, and the docs say the right colour for each controller is unverified (R4.4, R11.4).
3. **Orientation.** Pick 0 at the top and end 0 at the left are the defaults; both are options (R2.4, R2.5).
4. **8-bit colour table.** 256 entries, only indices 0 and 1 used (R4.3, R4.5).
5. **Dependency rule.** The exporter imports only from `src/codec` (R10.1); `structure.md` is updated to match.
6. **Download helper.** Stays in the exporter, in one file (R8).

## Known limits

- No loom controller has been tested with the exported files.
- No gap picks: designs with a missing or damaged card cannot be exported.
- One pixel per end, no repeat across the loom width.
- The reader reads only the variants this exporter writes; it is not a general BMP reader.
- The resolution fields in the info header are written as 0.
