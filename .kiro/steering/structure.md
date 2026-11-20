# Naqsha — Project Structure Steering

## Directory Layout

```
Naqsha/
├── src/
│   ├── codec/       # Punch card encoding and decoding
│   ├── codec-view/  # Bit lines, diff and diff text for Code view
│   ├── repair/      # Guesses for lost cards (repeat, mirror, neighbours)
│   ├── reader/      # Camera capture and image pre-processing
│   ├── simulator/   # Weave simulation and cloth rendering
│   ├── exporter/    # Bitmap generation and file export
│   ├── archive/     # IndexedDB persistence and retrieval
│   └── ui/          # React components and pages
├── tests/           # All test files, mirroring src/ structure
├── public/          # Static assets served as-is
├── index.html       # Vite entry point
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Module Responsibilities

### src/codec
Converts between raw hole-grid data and the application's internal PunchCard representation. Contains the encoder, decoder, and all shared domain types (types.ts). No I/O, no React — pure data transformation only.

Key exports: validateCardProfile, parseCardProfile, validateCardGrid, endsPerPick, encodeCardGrid, decodeEnds; types CardProfile, PegHole, PointMm, CardGrid, Pattern, Ends, Result, Violation, ViolationKind

### src/codec-view
Turns codec data into text for reading and comparing: a card into a Bit_Line, a Pattern into a Line_Set, two Line_Sets into a Diff, a Diff back into a Line_Set, and a Diff into plain text. Pure data transformation; no React, no DOM, no browser API, no I/O. Imports only from src/codec, and takes the hook-position-to-end mapping only from encodeCardGrid.

Key exports: cardToBits, patternToLines, diffPatterns, applyDiff, diffToText; also groupBits, lineKey, alignLines, GROUP_SEPARATOR, DIFF_MARKERS, DIFF_PICK_LIMIT; types BitLine, BitsLine, DamagedLine, Line, LineSet, LineSetHeader, Diff, DiffEntry, DiffCounts, DiffRefusal, BitsResult, LinesFailure, LinesResult, ApplyFailure, ApplyResult, Alignment

### src/repair
Suggests what a lost card (a gap: a pick that is missing or damaged) probably looked like, and the evidence for each guess. Three kinds only: repeat (cards equal at a period), mirror (the chain is symmetric about a centre) and neighbours (the picks on both sides are the same card). Pure data transformation; no React, no DOM, no I/O. Imports only from src/codec and src/codec-view, and compares cards only with codec-view's cardToBits. Never changes its input and never throws; a suggestion is a guess and carries its confidence (high, medium, low) and its evidence as plain data.

Key exports: suggestRepairs, MIN_COMPARISONS, AGREEMENT_FLOOR, HIGH_MIN_COMPARISONS; types SuggestionKind, Confidence, Evidence, Suggestion, NotAppliedReason, NoSuggestionReason, GapRepair, RepairFailure, RepairResult

### src/reader
Handles everything between the physical card and the codec: loading an image into pixel data, greyscale, thresholding, dark region detection, peg hole selection (pegHoles.ts, selectPegHoles.ts), layout check (layout.ts), orientation, pose, and sampling the hook positions into a card grid. Isolates all browser image API calls so the rest of the app does not depend on them. No perspective correction. Camera stream acquisition is not built yet.

Key exports: readCard, loadPixelData, isPixelData, toGreyscale, chooseThreshold, classifyDark, findDarkRegions, equivalentDiameterPx, findPegHolePair, rankPegHolePairs, selectPegHolePair, layoutMatches, orientationSeparation, decideOrientation, poseFromPegHoles, cardToImage, samplingRadiusPx, decidePunched, sampleCardGrid, normalizeDegrees, angleDifferenceDegrees; types PixelData, GreyImage, DarkMap, DarkRegion, PointPx, Orientation, Pose, PegHolePair, PegHoleSelection, LayoutResult, OrientationDecision, ReadFailure, ReadResult, ImageSource

### src/simulator
Takes a decoded PunchCard and renders the weave pattern onto a canvas element. Implements the interlacing logic (warp/weft over-under rules) and produces an animated row-by-row preview. No camera or file I/O.

Files: prepare.ts, settings.ts, style.ts, render.ts, floats.ts, frames.ts, player.ts, canvas.ts (the only file that touches browser APIs), types.ts. Imports only from src/simulator and src/codec.

Key exports: prepareCloth, isPreparedCloth, parseRenderSettings, parseColour, renderFrame, computeFloats, floatLengthAt, framesForPick, frameAt, PASS_STEPS, createPlayer, paintToCanvas, browserScheduler; types SlotList, PickRow, GapReport, PreparedCloth, Weft, RenderSettings, Frame, SimImage, SimFailure, SimResult, Float, Player, Scheduler, PaintContext

### src/exporter
Exports a Pattern (one CardGrid per pick) as an uncompressed BMP with a colour table, one pixel per end and one row per pick, in 1-bit and 8-bit variants, and reads those files back. Handles the browser download trigger in one file. Imports only from src/codec. Each loom controller may need a specific variant (bit depth, lift colour, pick order, end order); no controller has been tested.

Key exports: exportPatternBmp, readPatternBmp, parseExportOptions, DEFAULT_EXPORT_OPTIONS, bmpLayout, bmpFileName, downloadBmp; types ExportOptions, ExportFailure, ReadFailure, ExportResult, ReadResult, BmpLayout, DownloadDeps

### src/archive
Thin wrapper around IndexedDB. Stores and retrieves saved designs (Pattern, Metadata, Card_Profile name, creation time) and a summary row per design for listing. Every function returns a result value and never throws. Callers do not touch IndexedDB; only `idbStore.ts` mentions it. `designs.ts` takes an injected `ArchiveStore`, `now` and `newId`, defaulting to the browser's. Imports only types from src/codec.

A saved design is one or more *versions*. Each version is one ordinary record and summary; an optional `designId` names the design it continues (absent on the first version, whose own id is the design id) and an optional `note` holds at most NOTE_MAX characters. `versions.ts` holds the pure grouping (no I/O). The IndexedDB schema is at version 2: the upgrade from 1 adds a `designId` index on the summaries store and rewrites no record.

Key exports: saveDesign (optional `continues` and `note`), getDesign, listDesigns, deleteDesign, designIdOf, groupDesigns, previousVersion, NOTE_MAX, openIndexedDbStore (in idbStore.ts, not re-exported from index.ts), StoreUnavailableError; types Metadata, SavedDesign, DesignSummary, DesignGroup, SaveInput, ArchiveFailure, ArchiveResult, ArchiveStore, ArchiveDeps

### src/ui
All React components, pages, and hooks. Composes the other modules into user-facing flows. Screens live in ui/screens/ (weave, keep), with state logic in ui/state/, the Card_Profile notice in ui/ProfileNotice.tsx, the printable card in ui/printable/, and translations in ui/i18n/. Each component has a .tsx file and a .module.css beside it.

Keep lists designs grouped by version (ui/screens/keep/DesignEntry.tsx); Compare hands two sides to the Code view through `AppState.compare`.

Key exports: App; type exports from ui/types.ts (for example Screen, Language, AppState, AppAction, CurrentPattern, ClothChoices, CompareRequest, ScanState). The Scan screen is not built yet.

### tests/
Mirrors src/ one-for-one. Each module has a corresponding test file, so the Codec_View_Module's tests live in tests/codec-view/. Integration tests that span multiple modules live in tests/integration/.

## Module Dependency Rules

Dependencies flow in one direction only:

```
ui → simulator, exporter, archive, reader, codec-view, repair
reader → codec
simulator → codec
exporter → codec
codec-view → codec
repair → codec, codec-view
archive → (IndexedDB only, no other src/ modules)
codec → (no src/ dependencies)
```

- codec has no dependencies on other src/ modules; it is the foundation.
- ui may import from any module but modules must not import from ui.
- Circular imports are forbidden. If a circular dependency appears, extract the shared types to codec/types.ts.

## File Naming

- React components: PascalCase.tsx (e.g. ScannerView.tsx)
- Hooks: useCamelCase.ts (e.g. useCameraStream.ts)
- Utilities and pure functions: camelCase.ts (e.g. gridExtractor.ts)
- Types files: always named types.ts, one per module
- Test files: subject.test.ts or subject.test.tsx under tests/
- CSS Modules: PascalCase.module.css, same name as the component

## Adding a New Module

1. Create src/<module-name>/ with at least index.ts and types.ts.
2. Add a corresponding tests/<module-name>/ directory.
3. Document the module's responsibilities and key exports in this file.
4. Ensure the new module's dependency direction is consistent with the rules above.
