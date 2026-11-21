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

(Filled in by task 3.1.)

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

(Filled in by task 3.2.)

## Changed checks

None yet.

## Not checked by eye

Nothing yet.

## Stuck

Nothing yet.
