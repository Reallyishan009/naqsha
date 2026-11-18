# Naqsha — Project Structure Steering

## Directory Layout

```
Naqsha/
├── src/
│   ├── codec/       # Punch card encoding and decoding
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

Key exports: decodePunchCard, encodePunchCard, PunchCard, HoleGrid

### src/reader
Handles everything between the physical card and the codec: camera stream acquisition via getUserMedia, frame capture, perspective correction, binarisation, and grid extraction. Isolates all browser media API calls so the rest of the app does not depend on them.

Key exports: startCameraStream, captureFrame, extractGrid

### src/simulator
Takes a decoded PunchCard and renders the weave pattern onto a canvas element. Implements the interlacing logic (warp/weft over-under rules) and produces an animated row-by-row preview. No camera or file I/O.

Key exports: simulateWeave, renderRow, WeavePattern

### src/exporter
Converts a completed WeavePattern into output formats: a bitmap (ImageData / PNG blob) suitable for electronic Jacquard loom controllers, and an optional JSON snapshot for reimport. Handles the browser download trigger.

Key exports: exportBitmap, exportJSON, BitmapOptions

### src/archive
Thin wrapper around IndexedDB. Stores and retrieves scan records (card metadata + bitmap + JSON). Provides a simple async CRUD interface; callers do not interact with IndexedDB directly.

Key exports: saveScan, getScan, listScans, deleteScan, ScanRecord

### src/ui
All React components, pages, and hooks. Composes the other modules into user-facing flows. Components are grouped by feature (e.g. ui/scanner/, ui/simulator/, ui/archive/). Each component directory contains the .tsx file and its .module.css.

Key exports: App, ScannerPage, SimulatorPage, ArchivePage

### tests/
Mirrors src/ one-for-one. Each module has a corresponding test file. Integration tests that span multiple modules live in tests/integration/.

## Module Dependency Rules

Dependencies flow in one direction only:

```
ui → simulator, exporter, archive, reader
reader → codec
simulator → codec
exporter → simulator, codec
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
