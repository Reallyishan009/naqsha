<!-- Banner: coming. Put the image in media/ and link it here. -->

# Naqsha

A browser app that reads a Jacquard loom punch card through a camera, rebuilds the weave pattern, and (coming) simulates the cloth and exports a bitmap for electronic Jacquard looms.

<!-- GIF of a card being scanned and the cloth weaving: coming. -->

**Status:** the card codec and the card reader are built and tested on synthetic card images, and the simulator renders cloth on a canvas (dev preview page only). The camera screen, exporter, archive and UI are not built yet.

## Try it in 60 seconds

**Coming.** There is no hosted site and no camera screen yet. Today you can run a developer-only photo trial: print a rendered card, photograph it, and read the photo on a local page (see "Run it locally").

## What it does

| Step | Status |
|---|---|
| Read one card from an image into a grid of punched and unpunched hook positions | Built (`src/reader`), synthetic images only |
| Convert a card grid to a list of ends and back, through the profile's end order | Built (`src/codec`) |
| Camera screen | Coming |
| Simulate the cloth pick by pick | Built (`src/simulator`): renders the cloth pick by pick on a canvas from tested pixel code; dev preview page only, no app screen yet |
| Export a bitmap for an electronic Jacquard loom | Coming |
| Archive scanned card sets in the browser | Coming |

The card layout is a profile loaded at runtime. The only profile, `public/profiles/demo-12x16.json`, holds ILLUSTRATIVE, UNVERIFIED values for a small demo card (12 hook rows x 16 hook columns). No real card has been measured yet.

### Reader failure reasons

`readCard(profile, pixels)` returns a card grid with the pose it found, or one of these failures. It never throws.

| Reason | Meaning |
|---|---|
| `invalid-profile` | The card profile failed validation. |
| `invalid-image` | The pixel data has a wrong size, length or type. |
| `peg-holes-not-found` | No pair of dark regions matched the peg holes and the card layout. |
| `ambiguous-orientation` | The card could not be told upright from upside down, or the peg diameters and the layout disagree. |
| `card-outside-image` | A hook position falls outside the image. |
| `resolution-too-low` | A punched hole is under 11 px across, so it cannot be sampled reliably. |

### Limits

- Accuracy is measured on synthetic fixtures only. No real card photograph has been tested. See `.kiro/specs/card-codec-and-reader/measurements.md`.
- The card must be upright or upside down within 10 degrees, with no perspective distortion. Mirrored images are not supported. Holes must be darker than the card surface.
- Each peg hole diameter must differ from the punched hole diameter. Profile validation does not enforce this.
- A 2 mm hole needs at least 5.5 px/mm, because the reader refuses punched holes under 11 px.
- The 300 ms reading budget has not been checked on a phone.

### Simulator limits

- One weft per pick (no extra zari wefts on the ground weft).
- One end per hook (no harness tie-up). A horizontal repeat count is supported.
- No face-down weaving.
- Threads are at least 3 px wide.
- `renderFrame` rejects copies of a prepared cloth (`structuredClone`, Web Worker messages).
- The 16 ms per frame budget is unmeasured on a phone. Node figures are in `.kiro/specs/simulator/measurements.md`.

### Known issue (task 5.18, not fixed)

On sparse or small cards, the peg-pair check against the layout can reject a good read. This fails safely with `peg-holes-not-found`. At low resolution it could also pick a wrong peg pair; the 11 px floor hides the measured cases, but the cause is still there.

## Why it matters

**Coming,** with the weaver's own words once the interview is done. In short: many weave designs exist only as physical punch cards, and those cards wear out.

## How it was built with Kiro

Planning was done with Claude before any Kiro session. The code, specs and tests were produced in Kiro.

| Kiro feature | Used for | Status |
|---|---|---|
| Specs | `card-codec-and-reader`: requirements, design with numbered correctness properties, tasks | Done |
| Steering | Product, tech, structure, weaving glossary, card geometry (loaded only for codec and reader files), testing rules | Done |
| Property-based tests | fast-check properties named after the requirement they check | Done |
| Hooks | Related tests and typecheck on save; fixture regeneration with a PNG drift check | Created, not yet seen firing in the IDE |
| MCP | Context7 documentation server | Configured |
| Custom MCP server, custom agent | | Coming |

The day-by-day record, including what failed, is in `docs/BUILD_LOG.md`.

## Architecture

**Coming** as a diagram. Module layout and dependency rules are in `.kiro/steering/structure.md`.

## Run it locally

Requires Node 22.18 or newer.

```
npm install
npm run dev          # start the dev server
npm run test:run     # run the tests once (npm test watches)
npm run typecheck    # type-check with tsc
npm run build        # type-check, then build to dist/
npm run fixtures     # regenerate the synthetic card images in tests/fixtures/
```

Developer-only photo trial: start the dev server with `npx vite --host`, print `/scripts/photo-trial/print.html` at 100% scale, photograph the printed card from directly above, then open `/scripts/read-photo.html` and choose the photo.

Developer-only simulator preview: start the dev server with `npx vite --host` and open `/scripts/sim-preview.html`.

## Prior work and credits

Naqsha is not the first project to read Jacquard punch cards with a camera. It builds on this research:

- *Visual system for punched card reading in textile industry*, 2018. A camera-based system for reading the punched cards of mechanical Jacquard looms. [doi:10.1080/00051144.2018.1456097](https://www.tandfonline.com/doi/full/10.1080/00051144.2018.1456097)
- *Digitization and recognition of Jacquard cards for textile design preservation*, Multimedia Tools and Applications, 2025. A multi-step computer vision method that extracts design information from photos of Jacquard cards. [doi:10.1007/s11042-025-20917-9](https://link.springer.com/article/10.1007/s11042-025-20917-9). Its dataset is published at [ELiRF/telers](https://github.com/ELiRF/telers).

Other credits: coming.

## License

MIT. See `LICENSE`.
