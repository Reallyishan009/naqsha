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

Final figures, task 4.5 (`wc -c` on 2026-11-22; no image was added or changed after task 2.3):

| public/photos | Bytes |
|---|---|
| bradford-card-chain-900.avif | 56,110 |
| bradford-card-stack-900.avif | 36,059 |
| kanchipuram-handloom-900.avif | 41,671 |
| loom-hero-1600.avif | 125,955 |
| loom-hero-800.avif | 34,645 |
| sari-pattern-cards-900.avif | 41,384 |
| **Photos, sum** | **335,824** |

public/art: the nine files above, **239,239** bytes. **Photos plus art: 575,063 bytes** (600,000 limit, margin 24,937). The four full-page Landing screenshots in `media/design/after-run1/` (10,965,250 bytes of PNG in total) are review files, not part of the site, and are not in `public/`.

## Bundle

Final numbers, task 4.5 (2026-11-22), from `npm run build` then `npm run check-bundle` (exit 0; `npm run check:all` rebuilt and re-checked, same files). `check-bundle` gzips with Node's zlib; Vite's own build table prints slightly larger numbers for the same files (entry chunk 127.39 kB there), so the figures below are the `check-bundle` ones.

| Chunk | Gzipped bytes |
|---|---|
| **Entry chunk** `assets/index-BdocheQh.js` | **126,022** (limit 204,800; Landing limit 150,000: below it, margin 23,978) |
| `assets/CodeViewScreen-Dk2_yBon.js` (lazy, Code view) | 10,037 |
| `assets/ScanScreen-g6d1Djl9.js` (lazy, Scan) | 9,074 |
| `assets/Panel-BlaBWCl-.js` (lazy, shared by Scan and Code view) | 3,909 |
| `assets/RepairPanel-DVgw_d5J.js` (lazy) | 3,026 |
| `assets/validateCardGrid-ClOvHDqy.js` (lazy) | 2,978 |
| `assets/download-DGhGghlR.js` (lazy) | 2,279 |
| `assets/bits-C9KCoVfM.js` (lazy) | 506 |

There is no lazy chunk for the Landing sections: all seven sections are in the entry chunk, which stayed under 150,000 B, so the lazy-section fallback of task 4.4 was not needed. The stylesheet `assets/index-DCqJe5hR.css` is 35.53 kB (7.75 kB gzipped by Vite) and is not part of the 150,000 B figure. The precache holds 44 entries (`precache: 44 entries in cache naqsha-v1-3a5b63fe454b`).

Entry chunk over this part: 117,383 B after task 4.1, 121,001 B after 4.2, 125,341 B after 4.3, 126,022 B after 4.4 and at 4.5.

The 150,000 B Landing limit is a separate check in `scripts/check_bundle.ts` (`LANDING_ENTRY_LIMIT_BYTES`, `landingEntryProblem`, printed as `entry chunk below the Landing limit of 150000: yes`). The 204,800 B limit and every other check are unchanged.

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

Final report, task 4.5 (2026-11-22): `node scripts/contrast_report.ts` exit 0, "Every pair meets its minimum", **84 pairs (42 per theme)**. Added after task 3.2: the hero pairs (4.1), `accent` on `tint` (4.2) and the Night section photo pairs (4.3), all described below. Tightest pairs, by margin over the minimum:

| Pair | Ratio | Minimum | Margin |
|---|---|---|---|
| Day zari #B0800A on frost (worst case #F2EEE6) | 3.05 | 3 | 0.05 |
| Day on-zari #2A1F14 on zari #B0800A | 4.55 | 4.5 | 0.05 |
| Day zari #B0800A on ground #F6EFE0 | 3.08 | 3 | 0.08 |
| Day accent #8A6532 on ground #F6EFE0 | 4.59 | 4.5 | 0.09 |
| Day ink-soft #566759 on tint #EDE3CB | 4.72 | 4.5 | 0.22 |
| Day band-accent #E2C48F on hero (worst case #3F554B) | 4.79 | 4.5 | 0.29 |
| Night madder #E0625A on surface #16201A | 4.82 | 4.5 | 0.32 |
| Day zari #B0800A on surface #FFFBF2 | 3.42 | 3 | 0.42 |

Night pairs: the tightest is Night madder on surface (above); the hero and Night section worst cases are in the 4.1 and 4.3 notes below.
Task 4.1 (Landing hero). The hero text lies on the loom photo under `--hero-tint` (Day #0F2A1E, Night #060D09) at alpha 0.8 (`--hero-tint-alpha` in tokens.css, `HERO_TINT` in contrast.ts; an example test compares the two). Worst case is a white photo pixel under the tint: Day #3F554B, Night #383D3A (`heroWorstCase`, pair background `hero`). The text-side shade (a two-stop gradient of the same tint to transparent) only darkens further, so it is not counted. New pairs, both themes, 4.5 minimum: `on-band` on hero (Day 7.02, Night 9.29) and `band-accent` on hero (Day 4.79, Night 5.68). The tan ring replaces the zari focus ring inside the hero (Day zari on the hero worst case would be about 2.5:1); `band-accent` meets 3:1 there with room. `node scripts/contrast_report.ts` exits 0.


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

Task 4.4 follow-up (orchestrator's review of the four `landing-full` screenshots). No test or check was loosened or removed.
- `scripts/screenshots.ts`, mode `after-run1`: the capture now emulates `prefers-reduced-motion: reduce` like the other modes (it was `no-preference`), so the hero Process_Loop shows its deterministic still frame and every reveal block is visible at once. The scroll-through, the wait for every picture to be decoded and the wait for no `[data-reveal="pending"]` block are unchanged (stricter than needed under reduced motion, still true). The scroll reveal itself (fade, 12 px rise, once, none under reduced motion, nothing hidden without IntersectionObserver) stays covered by `tests/ui/components/reveal.test.tsx`; the screenshots no longer show it. The header comment of the script says so.
- Hero still frame at 390: the media card is about 430 px tall and the canvas is filled by the card, the lit holes and the cloth, with no empty band above the cloth, so the `compact` prop and the canvas aspect were left alone (ProcessLoop tests untouched).
- Footer strip: the 60 px of page ground below the footer was `main`'s 16 px bottom padding plus the live region (1.5 em minimum height and 16 px margin) that follows `main`. On the Landing only (`state.screen === 'weave'` with no pick), `App.tsx` adds `mainLanding` (no bottom padding) and `liveRegionLanding` (visually hidden, still in the page, still `role="status"` `aria-live="polite"`) from `Shell.module.css`. Other screens keep both unchanged.
- Landing links: the "Scan your own card" link and the footer Weave, Keep, Scan and Code links take `--primary` with an underline (`Landing.module.css` `.scanLink a`, `LandingEnd.module.css` `.links a`) in place of `--indigo`. `--primary` on `--ground`, `--surface` and `--frost` at 4.5 is already in contrast.ts for both themes, so no new pair was added. Global `.quiet` is untouched.
- "Bring a card" band: `BringBand` now holds the text column and, beside it (below it under 40 rem), `ArtImage` `chain-8` (alt `art.chain8.alt`, lazy, width and height from `ART`) in a 24 px rounded frame. No new bytes: the file is already in public/art and the precache. The two buttons stay secondary, the text left-aligned.

## Not checked by eye

Written at task 4.5. What was not looked at by a person or by the orchestrator, only measured or tested:

- **Hindi full-page views.** Hindi full-page Landing captures were taken and opened during tasks 4.2 and 4.3 (390 and 1280, day and night, plus 320 Hindi day), but they are not in the final set: `media/design/after-run1/` holds only the four English files `landing-full-<theme>-<width>.png`. The final Hindi Landing was checked by `check:browser` (headline, buttons, no horizontal scroll at 320, 390 and 1280, no clipped navigation label) and by tests, not by a new look.
- **320 px views of the new Landing sections.** The sections of tasks 4.2 and 4.3 at 320 px were checked by metrics only: `check:browser` step 12 (`scrollWidth` equals `innerWidth` at 320) and the picture-decoded check. No 320 px full-page capture of them was opened.
- **ProcessLoop animation.** The loop was seen only as still frames (screenshots run under reduced motion show the deterministic still frame; the animated cycle, the pause button and the off-screen pause are covered by tests with a fake scheduler and by `check:browser` finding painted pixels on the canvas). Nobody watched it play.
- **AVIF only, no JPEG fallback.** Every photo and art file is AVIF. Headless Chrome decodes all of them (`check:browser`: every picture decoded, online and offline). No other browser (Safari, Firefox, an older Chrome) was tried, so whether each one decodes AVIF here is not verified. No JPEG fallback was added.
- **Real devices, keyboard and screen reader.** Not done for the new Landing, header or ProcessLoop. Focus rings and contrast are covered by style tests and the contrast table, not by looking at a real focus ring in a real browser.
- **Hindi text.** Every new Hindi string is `reviewed: false`; `docs/HINDI_REVIEW.md` lists them for a Hindi speaker.
- **The deployed site.** Not redeployed and `check:deployed` was not run, so nothing here says the new Landing is live.

## Stuck

Nothing: `docs/STUCK.md` was never needed and does not exist.

Task 4.1 (Landing hero and curved divider). Each change re-aims a check at the same claim; none lowers a limit.
- `scripts/check_browser.ts` step 15 (was "headline, steps and first tile within 700 px at 390 by 844, one primary Button, a tile starts a sample"). The old rule cannot hold with a full hero: the Step_Strip and the first Sample_Tile are below the fold by design. New rule, matched by accessible name: at 390 by 844 with no scrolling the headline, the primary "Scan a card" button and the "Try a sample" button are fully visible (bottom <= 844 px; `LANDING_LIMIT_PX` is now `PHONE.height`). Measured: English headline ends at 433, both buttons at 594; Hindi 418 and 592. Kept: exactly one primary Button in `main` (now the hero's "Scan a card", asserted by name), the three tiles are all secondary (was: first primary, two secondary), a tile still starts its sample and the counter advances. Reason: the one primary Button of the Landing moved from the first tile to the hero.
- `scripts/check_browser.ts`, offline Landing check (was: the Hero_Loom svg in the hero slot, found by role "img" and the `hero.title` name, with shapes). The hero slot now holds the Process_Loop, a canvas. The check finds `canvas[role="img"]` in `[data-hero-slot]` by the `processLoop.title` name through `aria-labelledby`, requires a size and at least two painted (non-transparent) colours read back from its 2D context, and keeps the headline and sample-control assertions.
- `scripts/check_browser.ts` step 14 (network log). The image allow-list was the favicon and the manifest icons. It now also lists, by exact address, each file of public/photos and public/art (read from disk). Still own origin only, and any other image request fails.
- `tests/ui/screens/landing.test.tsx`: R8.2 (headline) strips the accent word's `<em>` and still requires the exact translation, and adds one accent word that is italic in English and not in Hindi; R8.4/R8.5 (tiles) now expects three secondary tiles and checks that the one primary is the hero's "Scan a card" and "Try a sample" is secondary; R8.8 (previews use no image file) looks inside each tile instead of the whole Landing, because the hero now carries the loom photo; R8.1 and R8.13 read the headline text through the same tag-stripping helper. The Hindi `reviewed: false` list gained the new keys.
- `tests/ui/illustrations/hero.test.tsx`, "Landing hero slot": the two R13.1 tests now describe the Process_Loop in the slot (named canvas of the first Sample_Design, only its pause button can take focus, empty with no profile, `data-motion="still"` under reduced motion) instead of the Hero_Loom svg. The HeroLoom component and its own tests are untouched; the Landing no longer uses it.
- `tests/ui/screens/shell.test.tsx`: the one-Scan-pill count is taken inside `<header>`, because the Weave Landing now has its own "Scan a card" in `main`.
- `tests/ui/theme/styles.test.ts`: `screens/weave/Landing.module.css` joins `GRADIENT_MODULES` for the hero's two-stop tint-to-transparent shade (brief.md allows tinted photo overlays). Same narrowness: two stops, tokens or `transparent`, background only.
- `tests/ui/theme/contrast.test.ts`: one example test for the hero worst case (alpha equals tokens.css, the two pairs, both >= 4.5).
- Not a test change: the hero's focus ring is `--band-accent` instead of `--zari` (see Contrast). The hero primary Button is the normal primary (dark green by day, amber at night); by day it sits on the dark tint with its label at 7:1 and no extra border.

Task 4.1 numbers: entry chunk about 118.7 kB gzipped (117,383 B by `check-bundle`), under the 150,000 B target; no new image bytes (the hero uses loom-hero-800 and 1600, already counted); 11 new i18n keys.
Task 4.2 (Landing sections 2 to 4). The step strip, the old intro and the old sample tiles are replaced by How it works, What you can do and Try a sample. Each change re-aims a check at the same claim; none lowers a limit.
- `tests/ui/screens/landing.test.tsx` R8.3 (was: the Step_Strip has three steps in order with a label each): now the How it works list has three steps in order (card, design, cloth), each with its title (`landing.how.*.title`) in the current language, and the list is named by `landing.steps.name`. The three `landing.step.*` keys stay in en/hi (still in ADDED_KEYS and HINDI_REVIEW.md) but the Landing no longer shows them.
- R8.4/R8.5 (was: each tile is the one button holding name, `<canvas>` and "Try it"): a tile is now a card (`article`) holding the name, the app-made cloth and card pictures (`/art/cloth-<design>.avif`, `/art/card-<design>.avif`), the label "Try it", and exactly one `button[data-sample]` named "Try it: <design>" that is secondary. The whole card is the press target (the button's `::after` covers it). The count of three tiles, all secondary, one primary Button on the Landing (the hero's "Scan a card") and "Try a sample" secondary are asserted as before.
- R8.8 (was: a tile holds no `<img>`, `src` or `url()`): now a tile's only `src` values are its own two files in public/art (rendered by `scripts/make_art.ts` with the real card renderer and `renderFrame`), in that order, with no `<picture>`, no `url()` and no photo. The live Cloth_Preview canvas was dropped from the tiles because the app-made cloth picture shows the same cloth; `renderClothPreview` and its checks (more than one colour, null for a pattern that cannot be drawn) are unchanged.
- `tests/ui/illustrations/illustrations.test.tsx`: R14.2 now compares four Spot_Illustrations (the three empty states plus `WorksOfflineIllustration`) instead of three. R14.3 "the Landing draws one Step_Icon in each of its three steps" became "the Landing draws one Spot_Illustration (the Works offline card) and no Step_Icon, and each How it works step has its number 1, 2, 3" because the step strip no longer exists; the Step_Icons keep their own tests (R14.1, R14.4, R14.6, R14.8, R14.9) and are unused by the Landing.
- `tests/ui/screens/shell.test.tsx`: R1.1 looked for `weave.empty` on the Weave Landing; the Landing no longer shows that one-line intro, so it now looks for `landing.lead` (the hero paragraph). The one-Scan-pill check took the first `<header ... </header>` greedily, which now runs through the sections' own `<header>` elements; the regex is lazy so it still measures exactly the pill header.
- `scripts/check_browser.ts`: no edit. Check 15 (headline, "Scan a card", "Try a sample" inside 844 px; one primary; three secondary tiles; a tile starts a sample), the Disclosure and offline checks pass with the new Landing as they are. `data-sample` is on each card's button; the button text is "Try it", the accessible name "Try it: <design>".
- `src/ui/components/Eyebrow.module.css`: `.eyebrow` is now `width: 100%`. A flex line sized to its content gave the two hairlines no room, so "HOW IT WORKS" wrapped onto two lines at 1280 px (seen in the screenshots). Not a test change.
- `src/ui/App.tsx`: a new `useLayoutEffect` scrolls to the top when the Screen changes or when the player takes the Landing's place. The long Landing left the next Screen scrolled to the same depth, and `check:browser` step 8 ("export 1-bit and 8-bit BMP") then timed out opening the Keep "More" Disclosure in 3 of 4 runs. After the fix it passed 19 of 19 in three runs. No check was edited.
- `src/ui/theme/contrast.ts`: one pair added in both themes, `accent` (the section heading's accent word, display text) on `tint` (the middle band): Day 4.12, Night 7.57 (minimum 3). `node scripts/contrast_report.ts` exits 0.
- Glossary test (`tests/structure/glossaryTerms.test.ts`) flagged "row" in the new code; the How it works rows are named steps (`step`, `data-step`, `.stepTitle`) in code, CSS and tests.
Task 4.2 numbers: entry chunk 121,001 B gzipped (limit 204,800; target 150,000). No new image bytes (every picture was already in public/photos and public/art). 56 new i18n keys (en and hi, hi `reviewed: false`, all in ADDED_KEYS, `npm run review-list` regenerated). Full `vitest run` 1,875 tests pass; typecheck, build, check-bundle, check:browser (19 of 19) pass.
Looked at (full-page captures at 390 and 1280, day and night, English and Hindi, plus 320 Hindi day): fixed the eyebrow wrap above; left edges of the hero text and every section's content are the same line (29 px at 1280 and 25 px at 390, the header pill's inner edge); no horizontal scroll (scrollWidth equals the width) and no broken image (`complete && naturalWidth > 0` for all 16) in any capture; text on the tinted and ground bands and the chips on the pictures read clearly in both themes.

Task 4.3 (Landing sections 5 to 7: Night, "Bring a card", footer and credits). Each change re-aims a check at the same claim; none lowers a limit.
- `tests/ui/deploy.test.ts`, R23.7 ("the production build contains no third-party URL"): the footer now carries links a visitor can follow, so the test allows exactly those and nothing else: the licence and source address of each photo (the exact strings parsed from docs/IMAGE_CREDITS.md, so a link added anywhere else is still an offender) and the app's own repository (`REPOSITORY_URL`, or a path under it). The match is exact, or the address cut at its closing parenthesis (the test's pattern stops at `)`). The rest of the rule (no analytics, no network API, every other address) is unchanged. These are links, not requests: check:browser step 14 (own origin only) still passes.
- The footer's links to Weave, Keep, Scan and Code are a named `<ul>`, not a second `<nav>`: `tests/ui/components/themeSwitch.test.tsx` (R4.9) pins exactly one `<nav>` in the Shell and that test is unchanged.
- `package.json` gained a `repository` field (the origin remote, `https://github.com/Reallyishan009/naqsha`); a test compares it with `REPOSITORY_URL` in `src/ui/state/siteCredits.ts`.
- New tests in `tests/ui/screens/landingEnd.test.tsx` (example tests): the seven sections in order by `data-landing-section` (hero, how, what, samples, night, band, footer) in both languages; every file of public/photos and every entry of IMAGE_CREDITS appears in the footer with author, licence link and source link; the Night button is a Button that is not primary, offers the other theme, reads "Switch to night" or "Back to day" and calls the `onThemeChosen` prop with it (the same prop the Theme_Switch of the header gets); exactly one primary Button on the Landing still; the band holds Scan and Sample and the privacy line; the licence name is the first line of LICENSE; the font credits number equals the font families in public/fonts (and their licence files); every image address on the Landing is the app's own (`photos/` or `art/`, `.avif`); the footer has no centred rule. `tests/ui/theme/contrast.test.ts` has one more example test for the Night section's worst case and alpha. No property test was written.
- 17 new i18n keys (en and hi, hi `reviewed: false`, all in ADDED_KEYS, `npm run review-list` run). The exact English line is "Built with Kiro; planning and prompt drafting with Claude".
- Not a test change: `LandingEnd.module.css` is new; the footer is `--surface` (cream by day), the credit links are `--primary` on it (pair listed, both themes).

Contrast, task 4.3: `NIGHT_PHOTO_TINT` in `src/ui/theme/contrast.ts` (`--night-photo-alpha: 0.86` in tokens.css, darker than the hero's 0.8) and the background `night-photo` (worst case: a white photo pixel under `hero-tint` at 0.86: Day #31483E, Night #292F2B). New pairs, both themes, 4.5 minimum: `on-band` on night-photo (Day 8.62, Night 11.47) and `band-accent` on night-photo (Day 5.88, Night 7.02). The "Bring a card" band uses the existing `on-band` and `band-accent` on `band` pairs; its two Buttons are secondary (their own surface and ink). Footer text is `ink`, `ink-soft` and `primary` on `surface`, all already listed. `node scripts/contrast_report.ts` exits 0.

Task 4.3 numbers: entry chunk 125,341 B gzipped (limit 204,800; target 150,000). No new image bytes. Full `vitest run` 1,920 tests pass; typecheck, build, check-bundle, check:browser (19 of 19) pass.
Looked at (full-page captures with images decoded after scrolling, 390 and 1280, Day and Night, English and Hindi): fixed a double full stop after "IBM Corp." (the separator is now " · ", as in the photo credits), the font credit lines being too far apart (an inline-block link made each line 56 px high; now inline, 32 px), and the footer links wrapping "Code" onto a second line at 390 px (their padding is now the only space between them; the first link sits on the left edge of the text). No horizontal scroll at any width (scrollWidth equals the width) and every image decoded. The Night button flips the theme in both directions (captured with "Back to day" at night). Text on the dark tint, on the green band and the credit links on the cream footer read clearly in both themes.

Task 4.4 (scroll reveal, bundle, precache, screenshots). Nothing was loosened; every change adds a check or re-aims one at the same claim.
- `scripts/check_bundle.ts` and `tests/scripts/checkBundle.test.ts`: new `LANDING_ENTRY_LIMIT_BYTES` (150,000) and `landingEntryProblem`, run by the command as an addition to the 204,800 limit (unchanged, and its test still pins 204,800). Two example tests: the limit is 150,000 and below 204,800; 149,999 passes, 150,000 fails with the file name. The command applies it to the production build only, because `tests/ui/deploy.test.ts` runs `checkBundle` on a build made in test mode (development React, larger).
- `tests/scripts/precache.test.ts`: new test that each font licence file the Landing footer links to (`fonts/<licenceFile>`, from `FONT_CREDITS`) is in dist and in the precache list. The test of task 2.5 (every file of public/photos and public/art is a file of dist and an entry of the list) is unchanged.
- `scripts/check_browser.ts`: the offline Landing check now also requires the seven sections in order (by `data-landing-section`), the hero photo decoded (`img.complete && naturalWidth > 0`), the card photo of "how it works" decoded after scrolling to it, and every picture of every section decoded (18 pictures in 7 sections in the last run). Before, it looked at the loom canvas only. Step 14 (network log) allows each file of public/photos and public/art by exact address, as logged under task 4.1.
- `scripts/checks/screenshots.ts`, `scripts/screenshots.ts`, `tests/scripts/screenshots.test.ts`: a second set, `landing-full-<theme>-<width>.png` for day and night at 390 and 1280, into `media/design/after-run1/`, with `landingFullNames` and `landingFullProblems` (same checks as `setProblems`: exact names, each a PNG as wide as its name says, no extra file) and tests for them. The first set of 24 and its `setProblems` are unchanged and their tests pass. The capture scrolls through the page and waits for every picture to be decoded; later (see the 4.4 follow-up above) it also emulates reduced motion.
- Scroll reveal: `src/ui/state/reveal.ts` and `src/ui/components/Reveal.tsx` (new), tests `tests/ui/state/reveal.test.ts` and `tests/ui/components/reveal.test.tsx` (example tests only). Content is visible unless IntersectionObserver exists and the block is confirmed off screen; no hiding under reduced motion.

Task 4.5 (this gate). No test, check or limit was changed in this task; it ran the gate and wrote the numbers and documents. Runs of 2026-11-22 (local time, UTC+5:30), each exit 0: `npm run review-list`, `npm run typecheck`, `npm run test:run` (144 files, 1,947 tests passed; the benchmark printed ratio 1.30 against the bound 2.2 and did not flake), `npm run build` (precache: 44 entries), `npm run check-bundle` (entry 126,022 B), `npm run check:browser` (19 of 19 steps), `node scripts/contrast_report.ts` (84 pairs, all meet their minimum), `npx vitest run tests/scripts/precache.test.ts` (15 tests passed), `npm run check:all` (9 PASS, 0 FAIL, 1 SKIPPED: no spec format validator command in the repo, 1 INFO: the dirty working tree).
