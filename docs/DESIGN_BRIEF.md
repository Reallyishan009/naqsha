# Naqsha: Design Brief

This is the look and feel for Naqsha. It was drafted with Claude. It contains design decisions, not code. Every colour pair must be checked for WCAG AA and listed in `src/ui/theme/contrast.ts`.

**Second design pass (2026-11-21).** The section "The look (second pass)" below replaces the first-pass rules where they conflict. Replaced rules stay in the file, marked **Replaced**, so the earlier decisions can be read. Run 1 of the pass covers the design system and the Landing. Weave, Keep, Scan and Code get the new tokens, colours and fonts through the shared components, and their own layout follows in run 2.

## The look (second pass)

Calm, premium, editorial, with real pictures.

### Palette

- Day: warm cream ground, deep forest-green ink and primary buttons, warm tan accent.
- Night: near-black green ground, amber accent.
- Madder stays for punched holes and errors in both themes.
- Every pair meets WCAG AA. Large display text (24 px and up) may use 3:1. Small eyebrow labels and body text need 4.5:1, so eyebrows use a darker tan or the green.
- Every pair is listed in `src/ui/theme/contrast.ts` for both themes. `tokens.css` holds the same values; a test compares them.

| Token | Day | Night | Use |
|---|---|---|---|
| `--ground` | `#F6EFE0` | `#0E1511` | Page background |
| `--surface` | `#FFFBF2` | `#16201A` | Cards and sheets |
| `--ink` | `#183326` | `#EFE8D6` | Main text (forest green in Day) |
| `--ink-soft` | `#566759` | `#A3B3A7` | Secondary text, control borders |
| `--line` | `#E6DCC4` | `#1F2D24` | Hairlines and the Graph_Paper_Ground (soft, so the ground stays calm) |
| `--primary`, `--on-primary` | `#1F4D36`, `#FFFBF2` | `#E3B341`, `#0B120E` | Primary Button, links |
| `--accent` | `#8A6532` | `#E3B341` | Italic accent word in a display heading |
| `--eyebrow` | `#6E4E22` | `#D9A83E` | Small letterspaced labels |
| `--tint` | `#EDE3CB` | `#1E2B23` | Chips |
| `--band`, `--on-band`, `--band-accent` | `#1F4D36`, `#F6EFE0`, `#E2C48F` | `#1B3A2A`, `#F1EBD9`, `#E3B341` | The deep-green band |
| `--zari` | `#B0800A` | `#E3B341` | Focus ring (unchanged) |
| `--frost` | `rgb(255 251 242 / 0.95)` | `rgb(22 32 26 / 0.95)` | Header glass, never below 0.85 alpha; contrast is checked at the worst-case backdrop |

`--card`, `--hole`, `--madder`, `--indigo` and `--leaf` keep their meaning (Night `--hole` is `#070D09`). Scales: spacing 4 to 48 px plus 64, 96 and 128 px; radius control 4, panel 8, media 16, card 24 and pill; shadows `--shadow-card`, `--shadow-lift`, `--shadow-float`. The measured ratios are in `.kiro/specs/second-pass-run1/measurements.md`.

### Header

- A floating pill: centred, rounded, sticky, frosted (`backdrop-filter` blur on a surface that is at least 85 percent opaque, so contrast holds over any photo).
- Left: mark and name. Centre: Weave, Keep, Scan, Code (Code keeps its Advanced marker). Right: theme toggle, language switch, one dark primary pill "Scan a card".
- At 320 px it collapses to the mark plus a menu Disclosure. The Disclosure has an accessible name from an i18n key, and the nav controls stay reachable inside it.

### Headings and type

- Latin headings use one refined SIL OFL serif with roman and italic (Newsreader, Fraunces or Crimson Pro; the choice and file sizes are recorded in `.kiro/specs/second-pass-run1/measurements.md`).
- Each major heading has one italic accent word in the tan accent. Hindi headings use colour only, with no italic, and keep Rozha One for Devanagari.
- Body text is Hind. Bits and numbers are IBM Plex Mono.
- All fonts are self-hosted, subset woff2, precached. New font files total at most 80,000 bytes. Licence texts are in `public/fonts/` and credited in the README.
- **Replaced:** Display = Rozha One for all headings, Latin and Devanagari. Rozha One now applies to Devanagari headings only.
- Unchanged: base size 18 px on phones, scale 14, 16, 18, 22, 28, 36, Hindi line height 1.7, English 1.5, tabular figures in tables.

### Section header

A letterspaced eyebrow with a hairline on each side, a big two-line serif heading with one italic accent word, and a centred one-line subtitle. Section headers may be centred. Running text stays left-aligned.

### Cards and buttons

- Cards: 24 px radius, soft shadow, a picture on top, serif title, short text, small chips.
- Buttons are pills. The primary is dark green. The secondary is white with a hairline. On hover they lift 2 px, with no lift under reduced motion. The focus ring is always visible.
- **Replaced:** corner radius 4 px on controls and 8 px on panels. Punch cards keep square corners.

### Spacing, radius and shadow tokens

- Spacing scale: 4, 8, 12, 16, 24, 32, 48 (kept).
- Radius scale as tokens: card 24 px, pill fully rounded, plus the smaller steps the controls need.
- One soft shadow set as tokens.
- **Replaced:** "Borders: 1 px `--line`. Avoid drop shadows, except a soft one under the punch card." Soft shadows are now allowed on cards, the header pill and media frames. Borders stay 1 px `--line` for hairlines.

### Pictures

- Licensed photographs (six AVIF files in `public/photos/`) with a visible credit on the page: author, title, licence name linked to the licence, link to the source page, and the change made ("resized, converted"). The credits list is generated from `docs/IMAGE_CREDITS.md`.
- Pictures made by the app itself with the real code (`scripts/make_art.ts` into `public/art/`): the demo card as a physical card, the pattern grid, the cloth, and a chain of eight laced cards.
- ProcessLoop, a live canvas running the real pipeline, with zero image bytes and a still frame under reduced motion.
- Total image bytes of photos and art: at most 600,000.
- Nothing is copied from a third party: no text, photos, logos or branding. No invented ratings, guest counts, prices or testimonials.

### Effects

Allowed:

- soft shadows
- rounded corners
- frosted panels (`backdrop-filter`)
- subtle two-stop tonal gradients inside illustrations
- tinted photo overlays
- an inline-SVG curved or wavy divider

Forbidden:

- emoji
- gradient text
- rainbow gradients
- bouncing motion
- purple-to-blue gradients

**Replaced:** the first-pass line "Do not use purple-to-blue gradients, glass effects, or emoji as icons." Glass (frosted) panels and the effects above are now allowed. Purple-to-blue gradients and emoji stay forbidden.

## First-pass brief

The rest of this file is the first-pass brief. Where it conflicts with the section above, the section above wins.

### Idea

The interface looks like the weaver's own materials: manila card stock, graph paper for the naksha, silk, and gold zari thread. It should feel like a workbench, not a dashboard.

Two themes:

- **Day loom** (default): ivory silk background, for use in a bright workshop.
- **Night loom**: deep indigo, for the Halloween theme and the demo video.

**Replaced by the second pass:** the palette below (ivory and indigo become cream with forest green, and near-black green with amber). The first-pass values are kept here for reference; `tokens.css` and `contrast.ts` now hold the second-pass values.

### Colour tokens (first pass)

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

Rules (still apply):

- Status colours always come with an icon or a word. Colour is never the only signal.
- Text on the accent button uses a token that passes AA in both themes.
- Report any pair below WCAG AA and propose a darker or lighter value.

### Type (first pass)

| Role | Family | Fallback | Use |
|---|---|---|---|
| Display | Rozha One | Georgia, serif | Screen titles, Hindi and English (**Replaced**: Latin headings now use the serif chosen in task 3.1) |
| Body | Hind | system-ui, sans-serif | All running text and controls |
| Data | IBM Plex Mono | ui-monospace, monospace | Card bits, numbers, the cards-as-code view |

Fonts are self-hosted, not loaded from Google Fonts at run time.

### Spacing and shape (first pass)

- Touch targets: at least 48 px (kept).
- Punch cards have square corners (kept).
- **Replaced:** 4 px control radius, 8 px panel radius, and the "avoid drop shadows" rule (see Cards and buttons, and Spacing, radius and shadow tokens above).

### Signature details

- **Graph-paper ground.** The page background carries a faint grid in `--line` at 8px, like naksha paper. It fades out behind text panels.
- **The punch card.** A card is always drawn as manila stock with round holes, peg holes at the ends, and lacing holes. It looks like the real object in every screen where a card appears.
- **Selvedge edge.** The top bar has a thin woven border in `--zari` and `--madder`, like the edge of a sari. (Second pass: the top bar is now the floating pill header; the selvedge stays as a detail where the Selvedge component is used.)
- **Thread progress.** Progress bars are a thread being drawn across, not a filling rectangle.

### Screens (layout stays until run 2)

#### Scan
- The camera fills the screen. A card-shaped guide frame sits in the centre, with corner brackets in `--zari`.
- One line of instruction under the frame, in Hindi first.
- After capture: detected punched holes in `--leaf`, unpunched in `--indigo` outline, low-confidence holes pulsing in `--zari`.
- One large button at the bottom: "Next card". A smaller one: "Done".

#### Weave
- Cloth on the left or top, taking two thirds of the space. The current card on the right or bottom.
- Playback controls in one row: back, play, forward, speed. A scrubber spans the full width.
- Damaged or missing cards appear as a hatched gap in `--madder`.

#### Keep
- A form with large fields: name, designer, weaver, place, date. All optional.
- A voice-note button with a clear recording state.
- Three export buttons with plain labels: "For electronic loom (BMP)", "Printable cards", "Design file".
- A one-line note: "This is a record of the design. It is not legal protection."

#### Cards as code
- Dark panel in both themes. Each card is a row of bits in the data font.
- Changed cards in a diff are marked with a `+` or `-` and a colour.

### Motion

- Holes appear with a short pop when detected, staggered across the card, under 400ms in total.
- Cloth forms one pick at a time. The speed follows the playback control.
- The first weave of a scanned design rises out of darkness. It plays once and can be skipped.
- With reduced motion turned on: no stagger, no rise, instant state changes.
- Second pass additions: scroll reveal of Landing sections is a fade and a 12 px rise, once, under 400 ms, and none under reduced motion. Content is visible without JavaScript observers firing. Nothing bounces.

### Halloween, with restraint

- Night loom theme, candle-warm accent, and the idea of a design returning from decayed cards.
- No skulls, blood, or jump scares. The subject is living craftspeople and their heritage.

### Language and words

- Hindi first, English second. Every control has both available.
- Use the weaver's words: card, design, loom. Avoid "bitmap", "matrix", and "decode" outside the cards-as-code view (the Landing may say "BMP" where the export card truthfully names the file).
- Buttons say what happens: "Read this card", "Save design".
- Errors say what went wrong and what to do: "The card is not fully in the frame. Move the phone back."

### Do not

- Do not use emoji as icons. Do not use gradient text, rainbow gradients or purple-to-blue gradients.
- Do not centre running text. Left-align it. Section headers may be centred.
- Do not hide the main action in a menu.
- Do not use religious imagery as decoration.
