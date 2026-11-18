# Naqsha

Naqsha is a browser app for handloom weavers, card makers (naqshband) and textile archivists. The camera reads a Jacquard loom punch card, the app rebuilds the weave pattern, simulates the cloth pick by pick, and exports a bitmap for electronic Jacquard looms. Everything runs in the browser, with no backend for core features.

**Status:** the card codec and the card reader are built. The simulator, exporter, archive and UI are not.

## Demo profile values are illustrative

The card layout is a profile loaded at runtime. The only profile in the repo, `public/profiles/demo-12x16.json`, holds ILLUSTRATIVE, UNVERIFIED values for a small demo card (12 hook rows x 16 hook columns). No real card has been measured. Replace these values with measured ones before relying on them.

## Run it

Requires Node 22.18 or newer.

```
npm install
npm run dev          # start the dev server
npm run test:run     # run the tests once (npm test watches)
npm run typecheck    # type-check with tsc
npm run build        # type-check, then build to dist/
npm run fixtures     # regenerate the synthetic card images in tests/fixtures/
```

## Codec and reader

`src/codec` holds the card profile and card grid types, validates profiles and grids, and converts a card grid to a list of ends (one per hook position, in the profile's `endOrder`) and back. It does no I/O.

`src/reader` turns a photo of one card into a card grid. `readCard(profile, pixels)` greyscales the image, picks a threshold, finds dark regions, finds the two peg holes, decides whether the card is upright or upside down, fits the card position and scale, and samples every hook position. It returns either a card grid with the pose it found, or a failure with one of the reasons below. It never throws.

### Failure reasons

| Reason | Meaning |
|---|---|
| `invalid-profile` | The card profile failed validation. |
| `invalid-image` | The pixel data has a wrong size, length or type. |
| `peg-holes-not-found` | No pair of dark regions matched the peg holes and the card layout. |
| `ambiguous-orientation` | The card could not be told upright from upside down, or the peg diameters and the layout disagree. |
| `card-outside-image` | A hook position falls outside the image. |
| `resolution-too-low` | A punched hole is under 11 px across, so it cannot be sampled reliably. |

### Regenerating the fixtures

`npm run fixtures` rewrites the synthetic card images and their ground-truth JSON in `tests/fixtures/`. Every image uses a fixed seed, so the output is the same each run. Commit the regenerated files together with any change to the generator.

### Limits

- Accuracy is measured on synthetic fixtures only. No real card photograph has been tested. See `.kiro/specs/card-codec-and-reader/measurements.md` for the numbers.
- The demo profile is illustrative (see above).
- The card must be upright or upside down within 10 degrees, with no perspective distortion. Mirrored images are not supported. Holes must be darker than the card surface.
- Each peg hole diameter must differ from the punched hole diameter. Profile validation does not enforce this. Without it the reader can mistake punched holes for peg holes.
- The reader refuses an image where a punched hole is under 11 px across (`resolution-too-low`). A 2 mm hole therefore needs at least 5.5 px/mm. A phone photo of a card normally gives much more.
- The 300 ms hole detection budget has not been checked on a device.

### Known issue (task 5.18, not fixed)

On sparse or small cards, the peg-pair check against the layout can reject a good read. This fails safely, with `peg-holes-not-found`. At low resolution the check could also pick a wrong peg pair and give a wrong grid. The 11 px floor hides the wrong-pair cases that were measured, but the cause is still there.

## Project docs

Product, tech, structure, glossary, card geometry and testing rules are in `.kiro/steering/`.

## License

MIT. See `LICENSE`.
