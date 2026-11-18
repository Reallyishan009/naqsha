![Naqsha banner: a punched Jacquard card beside the woven cloth it makes](media/banner.png)

# Naqsha

A browser app that reads a Jacquard loom punch card through a camera, rebuilds the weave pattern, and (coming) simulates the cloth and exports a bitmap for electronic Jacquard looms.

The banner and the three GIFs below are not in the repository yet. They are added in Phase 3, so these images show as broken links until then.

![Weave screen: a sample design weaving pick by pick into cloth](media/weave-sample.gif)

![Scan screen: a printed card is read and one hole is corrected with a tap](media/scan-printed-card.gif)

![Keep screen: a design is kept in the archive and exported as a bitmap](media/keep-export.gif)

Public URL: https://naqsha-ashen.vercel.app/ (opens with no login; deployed by hand on Vercel, see "Deploy to Vercel").

**Status:** the card codec and the card reader are built and tested on synthetic card images, and the simulator renders cloth on a canvas (dev preview page only). The exporter writes and reads back BMP files (no app screen yet). The camera screen, archive and UI are not built yet.

## Try it in 60 seconds

**Coming.** There is no hosted site and no camera screen yet. Today you can run a developer-only photo trial: print a rendered card, photograph it, and read the photo on a local page (see "Run it locally").

## What it does

| Step | Status |
|---|---|
| Read one card from an image into a grid of punched and unpunched hook positions | Built (`src/reader`), synthetic images only |
| Convert a card grid to a list of ends and back, through the profile's end order | Built (`src/codec`) |
| Camera screen | Coming |
| Simulate the cloth pick by pick | Built (`src/simulator`): renders the cloth pick by pick on a canvas from tested pixel code; dev preview page only, no app screen yet |
| Export a bitmap for an electronic Jacquard loom | Built (`src/exporter`): uncompressed BMP, 1-bit and 8-bit, one pixel per end and one row per pick; reads its own files back; no app screen yet |
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

### Exporter options and limits

- `bitDepth`: `1` (default) or `8`.
- `liftColour`: `black` (default) or `white`.
- `pickOrder`: `first-at-top` (default) or `first-at-bottom`.
- `endOrder`: `first-at-left` (default) or `first-at-right`.

Limits:

- Each loom controller may need a specific variant of these options.
- No loom controller has been tested with these files.
- The right lift colour for each controller is unverified. Black is only the default.
- Designs with a missing or damaged card cannot be exported.
- One pixel per end. There is no repeat across the loom width.
- The reader reads only files this exporter writes.

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
npm run sample-bmp   # write media/sample-design-1bit.bmp and media/sample-design-8bit.bmp
```

Check the built site locally before you deploy:

```
npm run build        # type-check, then build to dist/
npm run check-bundle # entry chunk under 200 KB gzipped, no absolute URL in dist/index.html
npm run preview      # serve dist/ locally and open the address it prints
```

The built site uses relative paths (`base: './'`), so it works from the root of a host and from a sub-path.

Developer-only photo trial: start the dev server with `npx vite --host`, print `/scripts/photo-trial/print.html` at 100% scale, photograph the printed card from directly above, then open `/scripts/read-photo.html` and choose the photo.

Developer-only simulator preview: start the dev server with `npx vite --host` and open `/scripts/sim-preview.html`.

## Deploy to Vercel

The site is deployed at https://naqsha-ashen.vercel.app/ . The steps below are how to deploy your own copy by hand.

1. Create a Vercel account (the free Hobby plan is enough) and sign in. Connect it to the Git host that holds this repository.
2. In Vercel choose **Add New... > Project** and import this repository.
3. Framework preset: **Vite**. `vercel.json` already states it.
4. Build command: `npm run build`. `vercel.json` already states it.
5. Output directory: `dist`. `vercel.json` already states it.
6. Environment variables: none. Add none. The app has no backend and no API key.
7. Select **Deploy**. Vercel prints the public URL when the build ends. If you deploy your own copy, put its URL in the "Public URL" line near the top of this file.

Visitors need no login, no account and no API key to open the published site. The site makes no request to a third party and has no analytics.

What is not verified:

- Card_Profile values are ILLUSTRATIVE and UNVERIFIED. `public/profiles/demo-12x16.json` is a demo card, not a measured one.
- No loom controller has been tested with the exported bitmaps.

## Prior work and credits

Naqsha is not the first project to read Jacquard punch cards with a camera. It builds on this research:

- *Visual system for punched card reading in textile industry*, 2018. A camera-based system for reading the punched cards of mechanical Jacquard looms. [doi:10.1080/00051144.2018.1456097](https://www.tandfonline.com/doi/full/10.1080/00051144.2018.1456097)
- *Digitization and recognition of Jacquard cards for textile design preservation*, Multimedia Tools and Applications, 2025. A multi-step computer vision method that extracts design information from photos of Jacquard cards. [doi:10.1007/s11042-025-20917-9](https://link.springer.com/article/10.1007/s11042-025-20917-9). Its dataset is published at [ELiRF/telers](https://github.com/ELiRF/telers).

Other credits: coming.

## License

MIT. See `LICENSE`.
