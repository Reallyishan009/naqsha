# Implementation Plan: loom-mcp

## Overview

Build the stdio MCP server in `tools/loom-mcp/` in four groups, one git commit per group: foundation, tools, proof and wiring, finish. The design has no Correctness Properties section, so tests are node:test unit tests and stdio tests, with no property tests. Never loosen or remove an existing assertion in any test.

## Tasks

- [ ] 1. Foundation: package, limits, Path_Guard and PNG decoder
  - [ ] 1.1 Create the package, helpers and Path_Guard with unit tests
    - Create `tools/loom-mcp/package.json` (own scripts `start`, `test`, `typecheck`; `@modelcontextprotocol/sdk` 1.32.2 and `zod` 4.6.7, exact pins, already installed) and its lockfile; add a strict `tsconfig.json` (`allowImportingTsExtensions`, `erasableSyntaxOnly`, `types: node`, include `src` and `tests` only)
    - Write `src/limits.ts`, `src/paths.ts` (Path_Guard), `src/input.ts` (inline or path JSON, profile and pattern parsing, size checks before parsing) and `src/result.ts` (`ok`, `fail`, reason codes)
    - Write `tests/paths.test.ts` covering a `..` segment, a NUL byte, an absolute path outside the Repo_Root, a symlink leading out, a non-regular file, bad write names, and a symlinked out target
    - _Requirements: 2.1, 8.1, 8.2, 8.3, 9.2_

  - [ ] 1.2 Write the PNG decoder with unit tests
    - Write `src/png.ts` using `node:zlib` only: colour types 0, 2, 3, 4 and 6, all five scanline filters, chunk length and CRC checks, output as the reader's `PixelData`; `not_png`, `unsupported_png` (16-bit, interlaced) and `too_large` errors, with size limits checked first
    - Write `tests/png.test.ts` covering each colour type, each filter, bad CRC, truncated chunk, 16-bit, interlaced, not a PNG, and the file size and pixel count limits
    - Commit group 1 (`tools/loom-mcp` foundation) once its tests pass
    - _Requirements: 4.1, 8.2, 9.2_

- [ ] 2. Tools: the five tools and the server entry
  - [ ] 2.1 Add the server entry, `validate_profile` and `read_card_photo`
    - Write `src/hooks.ts` (`registerHooks`, retry a relative import with `.ts`), `src/server.ts` (import hooks, dynamic-import `createServer.ts`, `StdioServerTransport`, log to stderr only) and `src/createServer.ts` (`McpServer`, per-tool zod input and output schemas, every handler wrapped so any failure returns a Tool_Error and the process keeps serving)
    - Write `src/tools/validateProfile.ts` (inline or path profile, one plain sentence per violation) and `src/tools/readCardPhoto.ts` (default profile `public/profiles/demo-12x16.json`, one Bit_Line from `cardToBits`, reader failure reason as the reason code with a hint of at most 200 characters naming one photo change)
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 4.2, 8.1, 8.2_

  - [ ] 2.2 Add `render_cloth`, `diff_designs` and `export_bmp`
    - Write `src/tools/renderCloth.ts` (options repeat 1 to 64, threadSizePx 3 to 16, `#rrggbb` colours; PNG through `scripts/png_rgba.ts`; picks, gap and float counts in `structuredContent`; the first invalid option named, no file written; image over 4096 pixels per side refused with `too_large`)
    - Write `src/tools/diffDesigns.ts` (`patternToLines`, `diffPatterns`, `diffToText`; a refusal becomes a Tool_Error with the refusal reason and its values in the hint) and `src/tools/exportBmp.ts` (1-bit BMP written only to `out/<fileName>`, returns path and size equal to the file on disk)
    - Register all five tools in `createServer.ts`
    - Commit group 2 (the five tools and the server) once `npm run typecheck` passes in `tools/loom-mcp`
    - _Requirements: 1.1, 1.2, 5.1, 6.1, 7.1, 8.1, 8.2_

- [ ] 3. Proof and wiring: stdio tests, registration and docs
  - [ ] 3.1 Write the stdio, source scan and isolation tests
    - Write `tests/stdio.test.ts`: start the server with `StdioClientTransport`, check the five-tool list with schemas and descriptions, call every tool through the SDK client against `tests/fixtures/*.png` and `public/profiles/demo-12x16.json`, and add one failing case per tool (`validate_profile` path outside the root, `read_card_photo` blank image giving `peg-holes-not-found`, `render_cloth` repeat 65, `diff_designs` refused pair, `export_bmp` name with a separator); check that a failing call is followed by a successful one on the same process, and that the `export_bmp` size equals the size on disk (the test removes its output file)
    - Write `tests/scan.test.ts` (no `child_process`, `net`, `http`, `https`, `fetch` or `process.env` in `src/`) and `tests/isolation.test.ts` (root `package.json` dependencies and lockfile unchanged from `git HEAD` before this feature, exact pins in the server `package.json`, no file under `src/` imports from `tools/`)
    - _Requirements: 1.1, 1.2, 2.1, 3.1, 4.1, 4.2, 5.1, 6.1, 7.1, 8.1, 8.2, 8.3, 9.2_

  - [ ] 3.2 Register the server and add docs, ignore rule and root scripts
    - Add the `loom-mcp` entry to `.kiro/settings/mcp.json` (command `node`, args `tools/loom-mcp/src/server.ts`, no secret), leaving the Context7 entry byte-for-byte unchanged
    - Write `.kiro/steering/loom-mcp.md` (front matter `inclusion: manual`, one sentence per tool on when to use it) and `tools/loom-mcp/README.md` (what it is, run command, config entry for another MCP_Client, every tool, the Requirement 8 limits)
    - Add `tools/loom-mcp/out/` to the root `.gitignore`; add only the root scripts `typecheck:loom-mcp` and `test:loom-mcp` (both `npm --prefix tools/loom-mcp`), with no change to the root dependencies or the root lockfile
    - Commit group 3 once the server tests pass
    - _Requirements: 2.1, 8.2, 9.1, 9.2_

- [ ] 4. Finish: checks, Kiro call, records and push
  - [ ] 4.1 Run the glossary scan and all checks
    - Run a one-off glossary scan with `tools/loom-mcp/src` added (a throwaway run, no change to `tests/structure/glossaryTerms.test.ts`) and fix real findings in the server code
    - Run `typecheck:loom-mcp` and `test:loom-mcp`, then the root `npm run typecheck` and `npm run test:run`; the root `test:run` must run the same test files as before. Do not run `check:browser` or `check:all`
    - _Requirements: 2.1, 9.2_

  - [ ] 4.2 Try the server from Kiro, record it and push
    - Try to call two tools (for example `validate_profile` and `render_cloth`) from Kiro itself; record the exact transcript, or exactly what happened if the call could not be made, in `docs/BUILD_LOG.md`
    - Update `docs/KIRO_USAGE.md` with the loom-mcp server, its steering document and the result of the Kiro call
    - Commit group 4 and push the `auto/build` branch
    - _Requirements: 9.1_

## Notes

- Each group ends in one git commit; the commit step sits in the last sub-task of the group.
- Each task references the requirement clauses it covers.
- No property tests: the design lists no Correctness Properties.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1"] },
    { "id": 3, "tasks": ["2.2"] },
    { "id": 4, "tasks": ["3.1"] },
    { "id": 5, "tasks": ["3.2"] },
    { "id": 6, "tasks": ["4.1"] },
    { "id": 7, "tasks": ["4.2"] }
  ]
}
```
