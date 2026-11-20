# Requirements Document

## Introduction

loom-mcp is a small Model Context Protocol server over stdio in `tools/loom-mcp`. It gives Kiro and any other MCP client five tools to work on Naqsha: validate a Card_Profile, read a photo of a card, render cloth, compare two designs and export a BMP. The server imports the pure modules in `src/` (codec, reader, simulator, exporter, codec-view) and adds no behaviour of its own to them. It has its own package, so the MCP SDK never reaches the app's dependencies or bundle.

## Glossary

- **Loom_MCP**: The MCP server in `tools/loom-mcp` that serves the five tools over stdio.
- **MCP_Client**: Any program that connects to the Loom_MCP over stdio, such as Kiro or the SDK client used in tests.
- **Repo_Root**: The Naqsha repository directory. The only place the Loom_MCP reads files from.
- **Out_Directory**: `tools/loom-mcp/out/`, gitignored. The only place the Loom_MCP writes files to.
- **Tool_Result**: The reply to a tool call, holding `content` blocks and `structuredContent`.
- **Tool_Error**: A Tool_Result with `isError` true, a reason code and a hint on what to do next.
- **Card_Profile**: The description of a card's size, hook positions and peg holes, as defined in `src/codec`.
- **CardGrid**: The punched holes of one card, which encode one pick.
- **Pattern**: An ordered list of CardGrids, one per pick (`CardGrid[]`).
- **Bit_Line**: The text form of one CardGrid, one character per end, as produced by `src/codec-view`.
- **Diff**: The list of added, removed and changed picks between two Patterns, as produced by `src/codec-view`.
- **Gap**: A pick that is missing or damaged in a Pattern.
- **Path_Guard**: The function that decides whether a path may be read or written.

## Requirements

### Requirement 1: Server and tool contract

**User Story:** As an MCP_Client user, I want a server that lists its tools with clear schemas and reports every failure as a result, so that an agent can use the tools without guessing.

#### Acceptance Criteria

1. WHEN an MCP_Client requests the tool list, THE Loom_MCP SHALL return exactly five tools, named `validate_profile`, `read_card_photo`, `render_cloth`, `diff_designs` and `export_bmp`, and each listed tool SHALL have a JSON input schema and a description of one or two sentences.
2. IF a tool call fails for any reason, including input that does not match the tool's JSON input schema or an unexpected exception, THEN THE Loom_MCP SHALL return a Tool_Error as the result of that call, leave the server process running, and accept and answer the next call from the MCP_Client.

### Requirement 2: Isolation from the app

**User Story:** As a maintainer, I want the server kept apart from the app, so that the SDK adds nothing to the app's dependencies or bundle.

#### Acceptance Criteria

1. THE Loom_MCP SHALL have its own `package.json` and lockfile, separate from the root `package.json` and root lockfile, where the Loom_MCP `package.json` declares `@modelcontextprotocol/sdk` as exactly `1.32.2` and `zod` as exactly `4.6.7` (no `^`, `~`, or other range operator) and the Loom_MCP lockfile resolves each to that same version, with no file under `src/` importing from `tools/`, and with the `dependencies` and `devDependencies` entries of the root `package.json` and the root lockfile unchanged from before the Loom_MCP was added.

### Requirement 3: validate_profile

**User Story:** As a card maker, I want a Card_Profile checked, so that I learn what is wrong with it before I use it.

#### Acceptance Criteria

1. WHEN `validate_profile` receives a Card_Profile as inline JSON or as a path under the Repo_Root, THE Loom_MCP SHALL return a valid or invalid verdict and one sentence in plain words for every violation found (none when the verdict is valid), each sentence naming the part of the Card_Profile at fault and what is wrong with it, with no violation omitted or reported twice, and without changing the Card_Profile or any file.

### Requirement 4: read_card_photo

**User Story:** As an archivist, I want a photo of a card read into a CardGrid, so that I can check what the reader sees.

#### Acceptance Criteria

1. WHEN `read_card_photo` receives a PNG path under the Repo_Root and a Card_Profile given inline, as a path under the Repo_Root, or by default as `public/profiles/demo-12x16.json`, THE Loom_MCP SHALL return the CardGrid as one Bit_Line of exactly one character per end, as produced by `src/codec-view`, in a Tool_Result that is not an error.
2. IF the reader returns a failure (`invalid-profile`, `invalid-image`, `peg-holes-not-found`, `ambiguous-orientation`, `resolution-too-low` or `card-outside-image`), THEN THE Loom_MCP SHALL return a Tool_Error whose reason code equals the reader's failure reason and whose hint is a sentence of at most 200 characters naming one photo change that addresses that reason, and SHALL return no Bit_Line.

### Requirement 5: render_cloth

**User Story:** As a weaver, I want to see the woven cloth for a design, so that I can judge it before threading the loom.

#### Acceptance Criteria

1. WHEN `render_cloth` receives a Pattern inline or as a design file path under the Repo_Root, a Card_Profile, and the options repeat (integer 1 to 64, default 1), thread size in pixels (integer 3 to 16), warp colour and weft colour (each written as `#rrggbb`), THE Loom_MCP SHALL return a Tool_Result with one image content block holding a PNG of the woven cloth, and in `structuredContent` the integer number of picks in the Pattern, the integer number of Gaps and the integer number of floats, each 0 or more. An input that fails validation SHALL return a Tool_Error that names the first invalid option and leaves no file written.

### Requirement 6: diff_designs

**User Story:** As an archivist, I want two designs compared, so that I can see which picks and ends changed.

#### Acceptance Criteria

1. WHEN `diff_designs` receives two Patterns, each given inline or as a path under the Repo_Root, and a Card_Profile, THE Loom_MCP SHALL return, if `diffPatterns` returns a Diff, the `diffToText` output of that Diff and its Diff counts (changed holes, added cards, removed cards) in `structuredContent`, and otherwise a Tool_Error whose reason code is the refusal reason from `src/codec-view` and whose hint states the refusal's values, with neither the diff text nor the counts returned.

### Requirement 7: export_bmp

**User Story:** As a card maker, I want a Pattern saved as a 1-bit BMP, so that I can load it on an electronic Jacquard loom.

#### Acceptance Criteria

1. WHEN `export_bmp` receives a Pattern, a Card_Profile and a file name, THE Loom_MCP SHALL write an uncompressed 1-bit BMP with one pixel per end and one row per pick, saved under that file name inside the Out_Directory, and return the path of the written file and its size in bytes, where the returned size equals the size of the file on disk.

### Requirement 8: Safety limits

**User Story:** As a user who lets an agent call these tools, I want the server confined to the repository and bounded in size, so that a tool call cannot touch other files or exhaust memory.

#### Acceptance Criteria

1. IF a path is outside the Repo_Root, contains a `..` segment, resolves through a symlink to a location outside the Repo_Root, or names a write target outside the Out_Directory, THEN THE Path_Guard SHALL reject the path before any file is opened, read or written, and THE Loom_MCP SHALL return a Tool_Error with reason code `path_not_allowed`.
2. IF an inline JSON input, a JSON file, a PNG file, a PNG pixel count, a Pattern pick count or a rendered image size exceeds the limit set for it in the design, THEN THE Loom_MCP SHALL, before parsing the JSON, decoding the PNG, rendering the image or writing any file, return a Tool_Error with reason code `too_large` and leave all files unchanged.
3. THE Loom_MCP SHALL make no network request, start no shell or child process, and read no environment variable, at startup or during any tool call.

### Requirement 9: Registration, documentation and proof

**User Story:** As a maintainer, I want the server registered, documented and tested through its real transport, so that I can trust and reuse it.

#### Acceptance Criteria

1. THE Loom_MCP SHALL be registered under the name `loom-mcp` in `.kiro/settings/mcp.json` with command `node` and the server file as its only argument, with no secret in the entry, and with the existing Context7 entry byte-for-byte unchanged. THE Loom_MCP SHALL also ship the steering document `.kiro/steering/loom-mcp.md` with manual inclusion, stating for each tool in one sentence when to use it, and a README in `tools/loom-mcp` that covers what the server is, the command to run it, the configuration entry needed to add it to another MCP_Client, the list of every tool, and the limits from Requirement 8.
2. THE Loom_MCP package SHALL have its own `typecheck` and `test` scripts, and its tests SHALL start the server over stdio and call every tool through the SDK client against `tests/fixtures/*.png` and `public/profiles/demo-12x16.json`, with at least one failing-input case per tool asserting an error result, and with unit tests for the Path_Guard and the PNG decoder. THE root `typecheck` SHALL exclude `tools/`, and the root `test:run` SHALL run the same set of test files as before this requirement.

