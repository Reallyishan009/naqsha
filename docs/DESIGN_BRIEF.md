# Naqsha: Design Brief

This is the look and feel for Naqsha. Give it to Kiro with prompt 40 in KIRO_PROMPTS.md. Kiro turns it into a steering doc and writes the CSS.

This brief was drafted with Claude. It contains design decisions, not code. Check every colour pair for contrast once Kiro implements it. The values below have not been tested on a screen.

## Idea

The interface looks like the weaver's own materials: manila card stock, graph paper for the naksha, silk, and gold zari thread. It should feel like a workbench, not a dashboard.

Two themes:

- **Day loom** (default): ivory silk background, for use in a bright workshop.
- **Night loom**: deep indigo, for the Halloween theme and the demo video.

## Colour tokens

| Token | Day loom | Night loom | Use |
|---|---|---|---|
| `--ground` | `#F6EFE0` | `#14122B` | Page background |
| `--surface` | `#FFFBF2` | `#1E1B3D` | Panels and sheets |
| `--ink` | `#2A1F14` | `#F1E8D5` | Main text |
| `--ink-soft` | `#6B5B48` | `#B4A9C8` | Secondary text |
| `--line` | `#D9CBB0` | `#35315E` | Borders and grid lines |
| `--card` | `#D8B67A` | `#C9A461` | Punch card stock |
| `--hole` | `#1B140C` | `#07061A` | Punched hole |
| `--zari` | `#B8860B` | `#E3B341` | Primary accent, buttons, focus |
| `--madder` | `#9C2B2B` | `#E0625A` | Errors, damaged cards |
| `--indigo` | `#27306B` | `#8FA3FF` | Links, unpunched overlay |
| `--leaf` | `#2F6B4F` | `#6FCF9B` | Confirmed, success |

Rules:

- Status colours always come with an icon or a word. Colour is never the only signal.
- Text on `--zari` buttons uses `--ink` in day loom and `--hole` in night loom.
- Kiro must report any pair below WCAG AA and propose a darker or lighter value.

## Type

| Role | Family | Fallback | Use |
|---|---|---|---|
| Display | Rozha One | Georgia, serif | Screen titles, Hindi and English |
| Body | Hind | system-ui, sans-serif | All running text and controls |
| Data | IBM Plex Mono | ui-monospace, monospace | Card bits, numbers, the cards-as-code view |

- Load from Google Fonts, and include the Devanagari subsets.
- Base size 18px on phones, because many users read at arm's length in a workshop.
- Scale: 14, 16, 18, 22, 28, 36.
- Hindi line height 1.7. English line height 1.5.
- Numbers in tables use tabular figures.

## Spacing and shape

- Spacing scale: 4, 8, 12, 16, 24, 32, 48.
- Corner radius: 4px on controls, 8px on panels. Punch cards have square corners.
- Touch targets: at least 48px.
- Borders: 1px `--line`. Avoid drop shadows, except a soft one under the punch card to lift it off the page.

## Signature details

- **Graph-paper ground.** The page background carries a faint grid in `--line` at 8px, like naksha paper. It fades out behind text panels.
- **The punch card.** A card is always drawn as manila stock with round holes, peg holes at the ends, and lacing holes. It looks like the real object in every screen where a card appears.
- **Selvedge edge.** The top bar has a thin woven border in `--zari` and `--madder`, like the edge of a sari.
- **Thread progress.** Progress bars are a thread being drawn across, not a filling rectangle.

## Screens

### Scan
- The camera fills the screen. A card-shaped guide frame sits in the centre, with corner brackets in `--zari`.
- One line of instruction under the frame, in Hindi first.
- After capture: detected punched holes in `--leaf`, unpunched in `--indigo` outline, low-confidence holes pulsing in `--zari`.
- One large button at the bottom: "Next card". A smaller one: "Done".

### Weave
- Cloth on the left or top, taking two thirds of the space. The current card on the right or bottom.
- Playback controls in one row: back, play, forward, speed. A scrubber spans the full width.
- Damaged or missing cards appear as a hatched gap in `--madder`.

### Keep
- A form with large fields: name, designer, weaver, place, date. All optional.
- A voice-note button with a clear recording state.
- Three export buttons with plain labels: "For electronic loom (BMP)", "Printable cards", "Design file".
- A one-line note: "This is a record of the design. It is not legal protection."

### Cards as code
- Dark panel in both themes. Each card is a row of bits in the data font.
- Changed cards in a diff are marked with a `+` or `-` and a colour.

## Motion

- Holes appear with a short pop when detected, staggered across the card, under 400ms in total.
- Cloth forms one pick at a time. The speed follows the playback control.
- The first weave of a scanned design rises out of darkness. It plays once and can be skipped.
- With reduced motion turned on: no stagger, no rise, instant state changes.

## Halloween, with restraint

- Night loom theme, candle-warm `--zari`, and the idea of a design returning from decayed cards.
- No skulls, blood, or jump scares. The subject is living craftspeople and their heritage.

## Language and words

- Hindi first, English second. Every control has both available.
- Use the weaver's words: card, design, loom. Avoid "bitmap", "matrix", and "decode" outside the cards-as-code view.
- Buttons say what happens: "Read this card", "Save design".
- Errors say what went wrong and what to do: "The card is not fully in the frame. Move the phone back."

## Do not

- Do not use purple-to-blue gradients, glass effects, or emoji as icons.
- Do not centre everything. Left-align text.
- Do not hide the main action in a menu.
- Do not use religious imagery as decoration.
