# Second design pass, run 1: measurements

Numbers and decisions for this run. Sections follow the brief.

## Licence verification

Date: 2026-11-21. Run by the orchestrator through the Wikimedia Commons API (imageinfo, extmetadata) for each of the five source photos. Result: every licence and author matches `media/photos-source/manifest.json` and `docs/IMAGE_CREDITS.md`. No file carries a NonFree flag, and no usage restriction was reported.

| File in `public/photos/` | Licence | Artist | NonFree | Matches manifest.json and IMAGE_CREDITS.md |
|---|---|---|---|---|
| `loom-hero-1600.avif`, `loom-hero-800.avif` | CC BY 2.0 | Herry Lawford | none | yes |
| `sari-pattern-cards-900.avif` | CC BY 2.0 | McKay Savage | none | yes |
| `kanchipuram-handloom-900.avif` | CC BY 2.0 | McKay Savage | none | yes |
| `bradford-card-chain-900.avif` | CC BY 3.0 | Linda Spashett (Storye_book) | none | yes |
| `bradford-card-stack-900.avif` | CC BY 3.0 | Linda Spashett (Storye_book) | none | yes |

Source files stay in `media/photos-source/`. That folder is outside `public/`, and `vite.config.ts` sets no `publicDir`, so Vite uses its default `public/`. A listing of `dist/` shows `photos/` (from `public/photos/`) and no `photos-source`, so the originals are not in the build output. Re-check this after the next build in task 2.5.

## Fonts
Task 3.1. Heading serif: **Newsreader** (Production Type), roman and italic, Latin only. Devanagari headings keep Rozha One through the stack `'Newsreader', 'Rozha One', Georgia, serif`.

Why Newsreader: the three candidates (Newsreader, Fraunces, Crimson Pro, all from google/fonts at the pinned commit `06bfe0d62a98375cb09c942fa18e68bd32cff057`) were each pinned to one weight (400) and subset to the same 101 Latin and symbol code points. Sizes of the roman plus italic pair: Fraunces 27,272 B (opsz 72, SOFT 0, WONK 0), Crimson Pro 27,352 B, Newsreader 29,108 B (opsz 36). All three fit the 80,000 B limit with room. Newsreader was chosen because it is drawn for reading on screens at 24 to 48 px (the size of a heading) with a true italic, and its hairlines stay sturdy at that size; Fraunces at the display optical size has thin hairlines that get fragile at 24 px, and Crimson Pro is drawn for print text. The 1,832 B difference to the smallest option is not worth that.

Method: the variable fonts (`Newsreader[opsz,wght].ttf`, `Newsreader-Italic[opsz,wght].ttf`) are pinned with `fonttools varLib.instancer` to wght=400 and opsz=36, then subset with `pyftsubset` (woff2, all layout features, no hinting) to the same Latin and symbol list the other fonts use. Pinning the axes is what makes the files small. `scripts/fonts/subset.sh` and `report.ts` do it; run `scripts/fonts/subset.sh` to reproduce.

| File | Bytes before subsetting (source .ttf, variable) | Bytes after (woff2) |
|---|---|---|
| Newsreader-Regular.woff2 | 451,664 | 13,928 |
| Newsreader-Italic.woff2 | 495,684 | 15,180 |
| **New font bytes, sum** | 947,348 | **29,108** (limit 80,000) |

For reference, the four existing files are unchanged by the re-run: RozhaOne-Regular 41,184, Hind-Regular 39,468, Hind-Bold 36,576, IBMPlexMono-Regular 6,692 (sum 123,920). All six woff2 files: 153,028 B.

The pinned instances before the subset were 118,624 B (roman) and 131,228 B (italic). Newsreader has no glyph for U+25CB and U+25CF (the repair legend circles), the same two code points IBM Plex Mono lacks; the browser draws them from the fallback family. They are listed in `scripts/fonts/missing-glyphs.json`.

Licence: SIL Open Font License 1.1, "Copyright 2020 The Newsreader Project Authors". Text copied to `public/fonts/Newsreader-OFL.txt` (checked by `subset.sh`: it stops if the text is not OFL 1.1). Source: https://github.com/google/fonts/tree/06bfe0d62a98375cb09c942fa18e68bd32cff057/ofl/newsreader (METADATA.pb at that commit: license "OFL", designer "Production Type"; upstream https://github.com/productiontype/Newsreader). Checked 2026-11-21.
## Image bytes

public/photos: 335,824 bytes in six AVIF files (brief figure).

public/art (task 2.3, `node scripts/make_art.ts`, AVIF quality 80 through macOS `sips`, no new dependency): 239,239 bytes in nine files.

| File | Pixels | Bytes |
|---|---|---|
| card-diamond.avif | 768x576 | 25,414 |
| card-border.avif | 768x576 | 9,423 |
| card-floral.avif | 768x576 | 19,456 |
| grid-diamond.avif | 768x576 | 62,257 |
| cloth-diamond.avif | 768x576 | 8,108 |
| cloth-border.avif | 768x576 | 33,721 |
| cloth-floral.avif | 768x576 | 10,276 |
| cloth-lost.avif | 768x576 | 33,900 |
| chain-8.avif | 1152x864 | 36,684 |

public/photos + public/art: 575,063 bytes (limit 600,000; art limit 264,000). The AVIF bytes come from the encoder of the machine that ran the script, so the files are committed. Chrome decodes them (checked in headless Chrome).

## Bundle

(Filled in by tasks 4.4 and 4.5.)

## Contrast
Task 3.2. `node scripts/contrast_report.ts` lists 74 pairs (37 per theme) and every one meets its minimum (exit 0). The report uses the repo's own `contrastRatio`, with ratios truncated and never rounded up.

Palette (`THEME_TOKENS` in `src/ui/theme/contrast.ts`, same values in `tokens.css`):

| Token | Day | Night |
|---|---|---|
| ground | #F6EFE0 cream | #0E1511 near-black green |
| surface | #FFFBF2 | #16201A |
| ink | #183326 forest | #EFE8D6 |
| ink-soft | #566759 | #A3B3A7 |
| line | #E6DCC4 (softer, so the Graph_Paper_Ground stays calm) | #1F2D24 |
| primary / on-primary | #1F4D36 / #FFFBF2 | #E3B341 amber / #0B120E |
| accent (display, 24 px+) | #8A6532 tan | #E3B341 amber |
| eyebrow (small label) | #6E4E22 darker tan | #D9A83E |
| tint (chips) | #EDE3CB | #1E2B23 |
| band / on-band / band-accent | #1F4D36 / #F6EFE0 / #E2C48F | #1B3A2A / #F1EBD9 / #E3B341 |
| zari (focus ring, old accent) | #B0800A (unchanged) | #E3B341 (unchanged) |
| on-zari | #2A1F14 | #070D09 |
| card, madder, indigo, leaf, on-hole | unchanged | unchanged |
| hole | #1B140C (unchanged) | #070D09 |
| frost (header glass) | rgb(255 251 242 / 0.95) | rgb(22 32 26 / 0.95) |

Frosted header: contrast is computed on the opaque equivalent at the worst case, the surface at alpha 0.95 over black in Day (dark text loses most when the glass darkens) and over white in Night (light text loses most when it lightens). That gives #F2EEE6 in Day and #222B25 in Night. Any real photo lies between those two backdrops. The alpha is 0.95, not 0.85: at 0.85 the Day focus ring (zari #B0800A, 3:1) would fall to about 2.6:1 over a black backdrop, and Day zari stays unchanged (R3.12 pins it). The floor of 0.85 is a test (`FROST_MIN_ALPHA`); the value in use is 0.95.

Tightest pairs (margin over the minimum):

| Pair | Ratio | Minimum |
|---|---|---|
| Day on-zari #2A1F14 on zari #B0800A (unchanged from before) | 4.55 | 4.5 |
| Day zari focus ring on the frosted header, worst case #F2EEE6 | 3.05 | 3 |
| Day accent #8A6532 on ground #F6EFE0 (display text; 4.5 kept although 3 would do) | 4.59 | 4.5 |
| Day zari focus ring on ground #F6EFE0 (unchanged) | 3.08 | 3 |
| Day ink-soft #566759 on tint #EDE3CB | 4.72 | 4.5 |

Next: Night madder #E0625A on surface 4.82; Day accent on surface 5.09; Day ink-soft on frost 5.21 and on ground 5.27. Display accent text is 4.5:1 or better in both themes (Night 8.59 or better).

Not yet listed (later tasks add their pairs when the markup exists): text on the Landing hero photo overlay (task 4.1) and the Night section photo overlay (task 4.3).

## Changed checks

Task 3.2 (tokens and palette). Every change relaxes a first-pass prohibition only as far as brief.md permits, and each relaxation has its own narrowness test.

- `tests/ui/theme/styles.test.ts`, "R3.13 no CSS Module has a gradient function, a backdrop-filter property or a blur function" replaced by four tests. A `gradient(` is allowed only in `GRADIENT_MODULES` (`components/Photo.module.css` and the four `illustrations/*.module.css` files), only as a background, only as `linear-gradient` with exactly two stops that are `var(--token)` or `transparent`. A second test feeds the checker three stops, radial, conic, repeating, colour literals and a one-stop gradient, and expects each to be rejected. A third test forbids gradient text (`background-clip: text`, transparent `-webkit-text-fill-color`) in every module. The `backdrop-filter` and `blur(` ban stays in every module except `Shell.module.css`, where `backdrop-filter` must be `blur(Npx)` in a rule whose own background is `var(--frost)`; `blur(` in any other property stays forbidden. A fourth test reads `--frost` in both themes of tokens.css and requires alpha >= 0.85. Reason: the frosted header pill, tonal gradients inside illustrations and photo frames (brief.md). The component-source test (`R14.8 R3.13`, no gradient, filter, backdrop-filter or blur in .tsx) is unchanged, so an SVG `<linearGradient>` in an illustration is still refused; a later task that needs one must ask for that relaxation.
- `tests/ui/theme/styles.test.ts`, "R3.6 every box-shadow ... is var(--shadow-card)" changed to "a var(--shadow-*) token that tokens.css defines": the three tokens `--shadow-card`, `--shadow-lift`, `--shadow-float`. A second test shows that a written-out shadow, an unknown token (`--shadow-glow`) and a list do not match. The test for component sources (no shadow of its own) is unchanged. Reason: soft shadows on cards, the header pill and media frames (brief.md).
- `tests/ui/theme/tokens.test.ts`: R3.2 (spacing scale, now 4 to 48 plus 64, 96 and 128 px), R3.3 (radius scale, now control 4, panel 8, media 16, card 24, pill 999 px) and R3.5 (three shadow tokens, the first still pinned to its old value) now list the extended scales exactly; a new test checks that every new palette token is defined in `:root` and overridden in the Night block. Reason: the brief asks for radius, spacing and shadow tokens. R3.1 (type scale), R3.7 (motion), R7.1 (Graph_Paper_Ground, still the only gradient in tokens.css) and R3.12 (Day zari value) are unchanged and pass.
- `tests/ui/theme/contrast.test.ts` and `scripts/contrast_report.ts`: the pair check resolves colours through the new `tokenColour(theme, name)`, because a pair background may now be `frost` (the worst-case opaque colour of the header glass). The assertion (ratio >= minimum for every pair) is the same. New example tests: the worst-case computation, `--frost` in tokens.css equals `surface` at the alpha used for the check, and the new text pairs are listed in both themes. No new property test was written.

Task 3.3 (pill header). No unit or property test was loosened or edited to fit the new header: `navigation.test.tsx` (R9.x), `shell.test.tsx`, `themeSwitch.test.tsx` (the Selvedge is still the first child of `<header>`, `.header` still has `overflow: hidden`) and the style tests pass as they were. The layout uses container queries on `.shell`, not `@media`, so the R9 "no @media" and R14.11 media-query rules still hold. New: one example test in `tests/ui/screens/shell.test.tsx` (menu button named by `nav.menu`, collapsed, controls a group that holds the navigation, both switches and one Scan pill, both languages); `nav.menu` and `nav.scanCard` added to ADDED_KEYS and `docs/HINDI_REVIEW.md` regenerated. `tests/ui/screens/primaryButton.test.tsx` needed no edit: it renders the four Screens, never the Shell, so the header pill is not counted; the browser checks count primaries inside `main` only.
- `scripts/checks/session.ts`: new `openHeaderMenu` and `closeHeaderMenu`. They find the header button `button[aria-expanded][aria-controls]` by its accessible name (`nav.menu`, English or Hindi) and click it only when the page draws it (its client rects exist, which is true under 360 px only) and it is closed. At 390 and 1280 px they click nothing.
- `scripts/check_browser.ts`: `ensureEnglish`, `ensureLanguage`, `clickNavItem` and `chooseTheme` call `openHeaderMenu` before they press a header control. The controls are still found by the same names as before. In the navigation step at 320 px the menu is opened before the header controls are measured, and the selector is widened from `header nav button, header [role=group] button, header [role=switch]` (7 controls) to `header button` (9: the Menu button, 4 navigation items, 2 languages, the Theme_Switch, the Scan pill), so the new buttons are measured for clipped text and overlap too. That is stricter, not looser.
- `scripts/screenshots.ts`: the same helpers before the language, navigation and theme clicks; each capture closes the menu first so the 320 px screenshots show the page, not the open menu.
- Not a test change, but it explains a header decision: checks 15, 16 and 18 of `check:browser` (Landing within 700 px, Disclosures, primary Button within 844 px, all at 390 by 844) failed with the first version of the header, which was 248 px tall in English and 260 px in Hindi. They pass with the final header (198 px English, 200 px Hindi at 390). To get there, between 360 and 799 px the navigation shows its labels without icons, and the bar uses 8 px vertical padding. No limit was changed.
Task 3.4 (Button, Card, Chip, Eyebrow, SectionHeader). Two existing tests follow the token rename from the zari fill to the primary fill; the assertions are the same strength (same properties, same "in every state", no theme conditional, no `.primary:state` rule).
- `tests/ui/components/components.test.tsx`, R5.7: "the primary Button is --on-zari text on --zari" is now "--on-primary text on --primary" (`color: var(--on-primary)`, `background: var(--primary)`; the checks that there is no `data-theme` and no `.primary:<state>` rule are untouched). The pair `on-primary` on `primary` (4.5:1) was already in contrast.ts, both themes.
- `tests/ui/screens/navigation.test.tsx`, R9.3: the current navigation item is `background: var(--primary)` and `color: var(--on-primary)` instead of the zari pair. Weight 700 and the 3 px underline are still asserted.
- Not a test change: at the Part 1 gate, checks 15, 16 and 18 of `check:browser` failed again at 390 by 844 because the 3.4 Tabs padding (16 px instead of 12 px) pushed the Night loom switch onto its own row (header 254 px, tile ended at 723 px, Keep primary Button at 870 px). `src/ui/Shell.module.css` now gives the header's language Tabs 12 px side padding again (header 198 px at 390). No limit was changed; all 19 steps pass.
- New `tests/ui/components/designComponents.test.tsx` (example tests, server-render and style text): hairlines `aria-hidden`, accent word italic only when not Hindi, Card order and optional parts, Button pill, 2 px lift and shadow token, no lift under reduced motion.
- Not a test change: the Sample tiles on the Weave Landing wear the Button classes, so they turned into huge ovals when Button became a pill. `Landing.module.css` now gives `.tiles .tile` the media radius (16 px) and its own padding.
- The lift uses the `translate` property, not `transform`, because the Scan hook markers pass a `transform` to their element and `transform: translateY` would replace it. The no-lift rule for reduced motion sits in `@media (prefers-reduced-motion: reduce)` (the only motion query R14.11 allows in a module).

## Not checked by eye

Nothing yet.

## Stuck

Nothing yet.
