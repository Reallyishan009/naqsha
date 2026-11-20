# loom-mcp

A small [Model Context Protocol](https://modelcontextprotocol.io) server for Naqsha. It lets Kiro, or any MCP client, work on punch card designs with real tools: validate a card profile, read a photo of a card, render the woven cloth, compare two designs and export a BMP for an electronic Jacquard loom.

It runs over stdio and calls the app's own pure modules (`src/codec`, `src/reader`, `src/simulator`, `src/codec-view`, `src/exporter`) directly, so the answers are the app's answers. Nothing in `src/` imports from `tools/`, and this package has its own `package.json` and lockfile, so the MCP SDK is never a dependency of the app or its bundle.

## Run it

Needs Node 22.18 or newer (it runs the `.ts` files directly) and, once, `npm install` inside this folder.

```
cd tools/loom-mcp
npm install
npm start          # waits for an MCP client on stdin; the ready line goes to stderr
npm test           # unit tests and a real stdio exchange through the SDK client for every tool
npm run typecheck
```

From the repository root: `npm run test:loom-mcp` and `npm run typecheck:loom-mcp`.

## Add it to a client

In Kiro it is already listed in `.kiro/settings/mcp.json`. For another client, run the server file with `node` from the repository root:

```json
{
  "mcpServers": {
    "loom-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/Naqsha/tools/loom-mcp/src/server.ts"]
    }
  }
}
```

The server finds the repository from its own file location, not from the working directory, and it needs no environment variable and no secret.

## Tools

| Tool | What it does | Main input |
|---|---|---|
| `validate_profile` | Checks a card profile and says in words what is wrong. | `profile` (JSON) or `path` |
| `read_card_photo` | Reads a PNG photo of one card; returns the bit line and the hook rows, or the reason it failed and how to retake the photo. | `path`, optional `profile` or `profilePath` (default `public/profiles/demo-12x16.json`) |
| `render_cloth` | Weaves a design and returns a PNG of the cloth plus picks, gaps and floats. | `pattern` or `patternPath`, `repeat` 1 to 64, `threadSizePx` 3 to 16, `warpColour`, `weftColour` |
| `diff_designs` | Compares two designs; returns the Code view diff text and the counts. | `first`, `second` (each `pattern` or `path`) |
| `export_bmp` | Writes a 1-bit BMP to `tools/loom-mcp/out/`. | `pattern` or `patternPath`, `fileName`, `liftColour`, `pickOrder`, `endOrder` |

Successful results carry `structuredContent` that matches the tool's output schema. A failure has `isError: true`, a text of the form `reason: message Hint: hint`, and the reason and hint in `_meta`; it has no structured content, because clients check structured content against the output schema. An argument of the wrong type is refused by the SDK before the tool runs and is also an error result.

Reason codes: `path_not_allowed`, `too_large`, `not_found`, `not_json`, `not_png`, `unsupported_png`, `invalid_profile`, `invalid_pattern`, `invalid_option`, `internal_error`, and the reader's and exporter's own reasons (`peg-holes-not-found`, `ambiguous-orientation`, `resolution-too-low`, `card-outside-image`, `invalid-image`, `invalid-card`, `empty-pattern`, `invalid-options`) and the diff refusals (`dimension-mismatch`, `profile-mismatch`, `too-many-picks`).

## Limits and safety

- **Files:** read and written only under the repository root. A path with a `..` segment, an absolute path outside the root, and a link that leads outside the root are refused (`path_not_allowed`). The check uses the real path, after links are followed.
- **Writes:** only `export_bmp` writes, only a bare file name of letters, digits, dot, dash and underscore ending in `.bmp` (at most 64 characters), only into `tools/loom-mcp/out/` (ignored by git). An existing link at that name is not written through.
- **Sizes**, checked before the input is parsed, decoded, drawn or written (`too_large`): inline JSON 1 MiB; a JSON file 2 MiB; a PNG file 8 MiB; a PNG of at most 16,777,216 pixels (4096 x 4096); at most 5,000 picks in a design; a rendered cloth at most 4096 pixels on a side (it is refused, not cropped).
- **PNG:** 8-bit, not interlaced, grey, RGB, palette, grey with alpha or RGB with alpha. Anything else is `unsupported_png`.
- **No network, no shell, no secrets:** the server makes no network request, starts no process, and reads no environment variable. A test scans the source for each of these.
- Error messages never include the content of a file.

## Pinned versions

`@modelcontextprotocol/sdk` 1.32.2 (published 2026-10-23, the latest at the time, about four weeks old) and `zod` 4.6.7 (published 2026-10-12; zod before 4.6.6 has an advisory for memory use on oversized collections, GHSA-mrhx-c7xc-m3w5, so `npm audit` is clean). Both are exact in `package.json` and the lockfile.
