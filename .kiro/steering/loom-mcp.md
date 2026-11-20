---
inclusion: manual
---
# Naqsha: loom-mcp tools

`loom-mcp` is an MCP server in `tools/loom-mcp`. It gives an agent real tools for Naqsha's pure code: the reader, the simulator, the Code view diff and the BMP exporter. It is registered in `.kiro/settings/mcp.json` as `loom-mcp`. Every path an agent gives must be inside this repository; the only place anything is written is `tools/loom-mcp/out/`.

Use the glossary terms in what you say about results: pick, end, hook, card, punched hole, float, gap.

## When to use each tool

- **validate_profile**: use it before trusting a new or edited card profile, or when another tool answers `invalid_profile`. It lists every problem in plain words. An invalid profile is a normal answer, not an error.
- **read_card_photo**: use it to see what the reader makes of a PNG photo of one card (for example `tests/fixtures/pick0-clean.png`), or to check a photo before it goes in the app. If it fails, the reason code and the hint say how to retake the photo (`peg-holes-not-found`, `ambiguous-orientation`, `resolution-too-low`, `card-outside-image`, `invalid-image`).
- **render_cloth**: use it to look at a design as woven cloth and to count its picks, gaps (cards that are missing or damaged) and floats. It returns a PNG image. Lower `repeat` or `threadSizePx` if it answers `too_large`.
- **diff_designs**: use it to compare two versions of a design (two lists of cards, inline or as files) and read what changed, in the same text the Code view copies. Both designs must be for the card profile you give.
- **export_bmp**: use it to write a 1-bit BMP for an electronic Jacquard loom. It writes `tools/loom-mcp/out/<fileName>` and nothing else. No loom controller has been tested with these files.

## Rules

- A design is a list of cards, one per pick; a card is a list of hook rows, each a list of `true` (punched hole) and `false`. A design file may also be an object with a `pattern` list. `null` in the list is a lost card.
- An error result has a reason code (`path_not_allowed`, `too_large`, `not_found`, `not_json`, `not_png`, `unsupported_png`, `invalid_profile`, `invalid_pattern`, `invalid_option`, or a reader or exporter reason) and a hint. Read the hint before retrying.
- Do not try to read or write outside the repository, and do not ask the tools to fetch anything from the network; they cannot.
