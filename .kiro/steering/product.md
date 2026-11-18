# Naqsha — Product Steering

## What Naqsha Is

Naqsha is a browser application that digitises Jacquard loom punch cards used by Indian handloom weavers. A weaver or card maker holds a physical punch card up to their device camera. The app reads the hole pattern, reconstructs the weave structure row by row, simulates how the finished cloth will look, and exports a bitmap that electronic Jacquard looms can consume directly.

The name "Naqsha" (نقشہ) means pattern or design in Urdu and Hindi — the traditional term for the weave card itself.

## Problems It Solves

1. **Preservation** — Thousands of unique weave patterns exist only as physical punch cards that degrade over time. Naqsha gives archivists a way to digitise and store them without specialist equipment.
2. **Modernisation** — Card makers who know traditional patterns cannot easily transfer them to electronic looms. Naqsha bridges the analogue-to-digital gap without requiring CAD software skills.
3. **Accessibility** — Existing digitisation tools require high digital literacy or expensive hardware. Naqsha runs in any modern browser with a camera.

## Users

| Persona | Context | Key need |
|---|---|---|
| Handloom weaver | Works at the loom, may own a basic smartphone | Quickly check whether a card set produces the intended cloth before threading |
| Card maker (naqshband) | Cuts and arranges punch cards, limited computer use | Transfer a card set to a new electronic loom without redrawing |
| Textile archivist | Museum or government body, moderate computer skills | Batch-scan and store card sets with metadata for long-term preservation |

All personas have **low to moderate digital literacy**. The UI must work without training, with minimal text, and with large touch targets.

## Core User Journeys

1. **Scan** — Point camera at a punch card → app detects the grid → user confirms or adjusts the detected boundary → holes are decoded.
2. **Simulate** — Decoded rows animate as woven cloth on screen, weft over warp, so the user sees the pattern before committing.
3. **Export** — User saves the bitmap (and optionally a JSON representation) locally or to the in-browser archive.
4. **Archive** — User names and tags a scan, browses past scans, retrieves or deletes them.

## Non-Goals (v1)

- No server-side processing; all computation runs in the browser.
- No cloud sync or account system.
- No support for dobby looms or non-Jacquard card formats.
- No colour simulation beyond thread colour selection; texture rendering is out of scope.
- No print layout or PDF export.

## Success Criteria

- A weaver with no prior app training can complete a scan-to-export flow in under three minutes.
- Hole detection accuracy ≥ 95 % on cards photographed under typical workshop lighting.
- Exported bitmaps load correctly on at least two common electronic Jacquard loom controllers.
- The archive survives browser refresh and survives clearing the site cache (data lives in IndexedDB, not localStorage).
