# Naqsha v1.0

A browser app that reads a Jacquard loom punch card from a photo or camera, rebuilds the weave pattern, shows how the cloth will weave, and exports a BMP for electronic Jacquard looms. It works offline after the first visit and keeps designs on your device. Built with Kiro for Kiroween 2026 (Resurrection).

Live: https://naqsha-ashen.vercel.app/
Try it with no punched card: [docs/JUDGES.md](docs/JUDGES.md)

## What is in it
- Weave: watch a design weave pick by pick; lost and torn cards flagged; repair suggestions shown as labelled guesses
- Scan: read a card from a photo or the live camera, tap a hole to fix it, read cards in a batch; demo cards to test without a punched card
- Keep: save designs, version history, compare, export BMP (1-bit and 8-bit), printable sample cards
- Code view: each card as a line of bits, with breakpoints and a diff
- Hindi and English, day and night, offline after the first visit
- `tools/loom-mcp`: an MCP server with five tools built on the app's own modules

## Limits
- No real card has been read. The reader is tested on synthetic cards; 8 real-card photos all fail with "peg holes not found".
- The card layout is an illustrative demo profile, not measured from a real card.
- No loom has been tested with the BMP files.
- The Hindi text is unreviewed.
- Phone camera and animations are untested on real devices.

## How it was built
Kiro wrote the code, specs and tests. Planning, prompt drafting, photo sourcing, the README and its media were done with Claude. See [docs/KIRO_USAGE.md](docs/KIRO_USAGE.md).

## Credits
Photos from Wikimedia Commons (CC BY 2.0, CC BY 3.0, CC0): see [docs/IMAGE_CREDITS.md](docs/IMAGE_CREDITS.md). Fonts under the SIL Open Font License. Licence: MIT.
