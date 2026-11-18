# Design Document

## Overview

`src/simulator` turns a CardProfile and a slot list into images of the cloth forming pick by pick. The design has three layers:

1. **Prepare** (once per slot list): validate the profile with `parseCardProfile`, classify each slot with `validateCardGrid`, and get each valid card's lift set from `encodeCardGrid`. All three come from `src/codec`.
2. **Render** (once per frame): a pure function that writes RGBA bytes for one frame into a typed array. It touches only the picks visible in the viewport, so its cost does not grow with the pick index.
3. **Play**: a small player that maps elapsed time to a frame, renders it, and copies it to a canvas with `putImageData`. This is the only code that uses a browser API.

There are no new dependencies. The simulator imports only from `src/codec`.

**Face assumption.** A lifted end shows the warp on the face (R2.3). There is no face-down setting.

### Key decisions

| Decision | Choice | Reason |
|---|---|---|
| Input type | `SlotList = ReadonlyArray<CardGrid \| null>` in `src/simulator/types.ts`; runtime values are still checked as `unknown` | R1.1; `Pattern` in `src/codec` is unchanged |
| Lift sets | Computed once in `prepareCloth` with `encodeCardGrid`, stored as one `Uint8Array` per pick | Reuses the codec's `endOrder` handling (R2.2); keeps rendering O(viewport) |
| Pixels | Written by our own code into a `Uint32Array` view of the RGBA buffer; no canvas drawing calls | Identical bytes on every run and in Node (R8) |
| Shading | Integer lookup tables per thread size | No floating-point drift, no `Math.random` (R8.3) |
| Frames | `rest(p)`, `lift(p)`, `pass(p, step)`; animating pick `p` ends at `rest(p + 1)` | Any frame is a pure function of its id (R7, R9) |
| Floats for highlighting | Measured per frame, scanning at most `maxLength + 1` picks beyond the viewport | Bounded cost without storing run lengths for every crossing |

## Architecture

### Files

```
src/simulator/
  types.ts        SlotList, PickRow, PreparedCloth, Weft, RenderSettings, Frame, SimImage, SimFailure, Result types
  prepare.ts      prepareCloth
  settings.ts     parseRenderSettings, parseColour
  floats.ts       computeFloats, floatLengthAt (window-bounded)
  style.ts        shadeTable, zari and gap pixel rules, fixed palette
  render.ts       renderFrame
  frames.ts       framesForPick, frameAt, PASS_STEPS
  player.ts       createPlayer (scheduler, clock and paint are injected)
  canvas.ts       paintToCanvas (putImageData), browserScheduler (requestAnimationFrame) -- the only browser-API file
  index.ts        re-exports
tests/simulator/  one test file per source file, plus benchmark.test.ts
```

### Data flow

```
profile, slots ─► prepareCloth ─► PreparedCloth { baseEnds, picks[], gaps[] }
                                        │
settings ─► parseRenderSettings ─► RenderSettings
                                        │
frame ────────────────────────────► renderFrame ─► SimImage (RGBA bytes)
                                                        │
player: clock ─► frameAt ─► renderFrame ─► paintToCanvas (putImageData)
```

## Components and Interfaces

```ts
// types.ts
export type SlotList = ReadonlyArray<CardGrid | null>;

export type PickRow =
  | { kind: 'woven'; lift: Uint8Array }                 // lift[e] = 1 when end e is lifted
  | { kind: 'missing' }
  | { kind: 'damaged'; violations: Violation[] };

export type GapReport = { pick: number; kind: 'missing' | 'damaged'; violations: Violation[] };

export type PreparedCloth = {
  profile: CardProfile;
  baseEnds: number;                                      // hookRows * hookColumns
  picks: ReadonlyArray<PickRow>;
  gaps: ReadonlyArray<GapReport>;
};

export type Weft = { kind: 'plain'; colour: string } | { kind: 'zari'; tone: 'gold' | 'silver' };

export type RenderSettings = {
  warpColour: string;                                    // '#rrggbb'
  weftPlan: ReadonlyArray<Weft>;                         // non-empty, repeats over picks
  threadSizePx: number;                                  // integer 3..16 (R6.3)
  repeat: number;                                        // integer 1..64, default 1
  viewport: { width: number; height: number };           // integers 1..4096
  floatHighlight: { maxLength: number } | null;          // maxLength integer 1..64
};

export type Frame =
  | { pick: number; phase: 'rest' }                      // picks 0..pick-1 woven
  | { pick: number; phase: 'lift' }                      // shed open for pick `pick`
  | { pick: number; phase: 'pass'; step: number };       // weft part-way, step 0..PASS_STEPS-1

export type SimImage = { width: number; height: number; data: Uint8ClampedArray };

export type SimFailure =
  | { reason: 'invalid-profile'; violations: Violation[] }
  | { reason: 'invalid-settings'; setting: string; message: string }
  | { reason: 'pick-out-of-range'; pick: unknown; pickCount: number };

export type SimResult<T> = { ok: true; value: T } | { ok: false; failure: SimFailure };
```

```ts
// prepare.ts
export function prepareCloth(profile: unknown, slots: unknown): SimResult<PreparedCloth>;
// settings.ts
export function parseRenderSettings(input: unknown): SimResult<RenderSettings>;
export function parseColour(value: unknown): [number, number, number] | null;
// floats.ts
export type Float = { set: 'warp' | 'weft'; pick: number; end: number; length: number };  // start position
export function computeFloats(cloth: PreparedCloth, repeat?: number): Float[];
// render.ts
export function renderFrame(cloth: PreparedCloth, settings: RenderSettings, frame: unknown): SimResult<SimImage>;
// frames.ts
export const PASS_STEPS = 8;
export function framesForPick(cloth: PreparedCloth, pick: number): Frame[];
export function frameAt(cloth: PreparedCloth, startPick: number, endPick: number, picksPerSecond: number, elapsedMs: number): Frame;
// player.ts
export type Scheduler = { request(cb: (timeMs: number) => void): number; cancel(id: number): void };
export function createPlayer(options: {
  cloth: PreparedCloth; settings: RenderSettings;
  paint: (image: SimImage) => void; scheduler: Scheduler;
}): { play(startPick: number, endPick: number, picksPerSecond: number): void;
      pause(): void; resume(): void; seek(pick: number): void; current(): Frame };
// canvas.ts (browser only)
export function paintToCanvas(context: { putImageData(data: ImageData, x: number, y: number): void }): (image: SimImage) => void;
export const browserScheduler: Scheduler;   // requestAnimationFrame / cancelAnimationFrame
```

`prepareCloth` and `renderFrame` take `unknown` where values cross a trust boundary and never throw (R11.1). A slot that is `null` or `undefined` is missing; any other slot that fails `validateCardGrid` is damaged (R1.3). The prepared cloth copies what it needs, so the inputs are never modified (R1.6).

## Algorithms

### Layout of a frame

- `t = threadSizePx`. Each end is a column `t` px wide; each pick is a row `t` px tall. The cloth is `baseEnds * repeat * t` px wide, drawn from `x = 0` and cropped at the viewport's right edge. End `e` of repeat `r` covers `x` from `(r * baseEnds + e) * t`.
- The **fell** sits at `fellY = height - shedHeight`, with `shedHeight = min(6 * t, floor(height / 3))`. The cloth is above the fell and the open warp (the shed) is below it.
- Woven row `i` (counting up from the fell, `i = 0` nearest) shows pick `p - 1 - i` for frame `rest(p)`, `lift(p)` or `pass(p, s)`. Rows for picks below 0 show the loom background colour. Only `ceil(fellY / t)` rows are drawn, so the cost does not depend on `p` (R7.2, R10.2).

### Crossing cells

For a woven pick, the cell of end `e` is warp-on-face when `lift[e] = 1`, else weft-on-face (R2.3). The cell is filled with the face thread's colour times a shade factor:

- `shadeTable(t)[i] = 160 + floor(95 * 4 * i * (t - 1 - i) / (t - 1)^2)` for `t` from 3 to 16 (edges 160, centre 255). Thread sizes below 3 are rejected (R6.3).
- A warp-on-face cell shades by its column `i = x mod t`, so it reads as a vertical thread; a weft-on-face cell shades by its row `i = y mod t`, so it reads as a horizontal thread. The over-under order is visible because the face thread's shading runs in its own direction (R6.1, R6.2).
- Channel value = `(c * shade) >> 8`, integer only.

### Zari

A zari weft uses a base colour (gold `#c9a227`, silver `#b8bcc4`) and the weft shading. In addition, the centre row of each zari weft cell (`y mod t = floor(t / 2)`) is set to the highlight colour (gold `#fff2c4`, silver `#ffffff`) at columns where `u mod 4 = 0`, with `u = x mod (baseEnds * t)` measured from the start of each repeat, so zari rows tile exactly (R14.2). This makes the colour vary along the weft, which a plain weft cell never does, because a plain weft cell is constant along `x` (R5.5). Zari appears only where the weft is on the face.

### Gap rows

A gap row fills all `t` rows of its pick with a fixed two-colour hatch that varies diagonally, which no crossing cell can do (a warp cell is constant along `y` and a weft cell is constant along `x`):

- Missing: grey `#808080` where `(u + y) mod 6 < 2`, else white (one diagonal set, `/`).
- Damaged: dark red `#b00020` where `(u + y) mod 6 < 2` or `(u - y) mod 6 < 2`, else white (cross-hatch, `X`).
- `u = x mod (baseEnds * t)` is measured from the start of each repeat, so gap rows tile exactly (R14.2). The hatch may restart at a repeat boundary; it stays diagonal, which is what keeps it distinct from cloth.

The hatch is drawn the same whatever the other picks are, and the row keeps its place in the pick sequence (R4.1 to R4.4). A damaged card is never partly drawn (R4.5).

### The shed

Below the fell, every end is drawn as a vertical warp thread. In `lift(p)` and `pass(p, s)` frames, the ends in pick `p`'s lift set are drawn as raised (their colour blended halfway towards white). In `pass(p, s)`, pick `p`'s weft is drawn across the middle of the shed from `x = 0` to `x = floor((s + 1) * clothWidth / PASS_STEPS)`. Gap picks have no `lift` or `pass` frames (R9.3).

### Frames and time

- `framesForPick(cloth, p)` for a woven pick is `lift(p)`, `pass(p, 0..PASS_STEPS-1)`, then the next pick starts at `rest(p + 1)`. For a gap pick it is empty: the sequence goes from `rest(p)` straight to `rest(p + 1)`.
- `frameAt` gives each pick an equal time slot of `1000 / picksPerSecond` ms. Inside a woven pick's slot, the slot is split evenly over `rest`, `lift` and the `PASS_STEPS` pass frames. The frame comes from the elapsed time, not from a frame counter, so when rendering falls behind the player skips frames instead of slowing down (R10.3). After `endPick` it returns `rest(endPick)`.
- The player renders only in scheduler callbacks, keeps only the start time, the range and the rate, and `seek(p)` renders `rest(p)`. Its output for a frame is always `renderFrame` of that frame, so a seek and a play from 0 land on the same pixels (R7.3, R7.4).

### Repeat

Each pixel row is built for one base width (`baseEnds * t` px) and then copied across the remaining width with `copyWithin`. Every pattern (shading, zari highlight, gap hatch) is measured from the start of its repeat, so every row tiles. With float highlighting off this makes column `x` equal to column `x mod (baseEnds * t)` (R14.2). With highlighting on, weft floats are measured across the tiled width (R14.4), so the highlighted pixels may differ near repeat boundaries.

### Floats

- `computeFloats` scans every woven pick for weft runs of length >= 2 and every end for warp runs of length >= 2, stopping at gap picks (R3.1, R3.2). It is used for reports and tests, not per frame.
- For highlighting, `renderFrame` measures each visible cell's float length by scanning along the thread, up to `maxLength + 1` threads in each direction, stopping at gap picks. Cells in a float longer than `maxLength` are blended halfway towards `#ff00c8` (R3.3). The scan is bounded, so the cost stays independent of `p`.

### Speed

Each frame writes `width * height` pixels once through a `Uint32Array` view (packed colours are prepared once per settings, with byte order detected once). Rows inside one pick that share a shade index are built once and copied. The target is under 16 ms per 1920 x 1080 frame on a mid-range 2020 phone (R10.1); this is a risk until measured (see "Decisions to confirm").

## Data Models

- **PreparedCloth**: one `PickRow` per slot. Memory for lift sets is `slots * baseEnds` bytes (2,000 picks x 192 ends = 384 KB; 10,000 x 2,688 = 27 MB).
- **SimImage**: `width * height * 4` bytes of RGBA, row-major, alpha 255.
- **Fixed palette** (not settings): loom background `#efe9dd`, gap colours, zari colours, highlight colour. These are colours, not card dimensions (R12.5).

## Error Handling

| Situation | Result |
|---|---|
| Profile fails `parseCardProfile` | `invalid-profile` with the violations (R1.2) |
| Colour not `#rrggbb`, empty weft plan, thread size, repeat, viewport or highlight limit out of range | `invalid-settings` naming the setting (R5.4, R6.3, R14.1) |
| Frame pick not an integer from 0 to the slot count, or a bad phase or step | `pick-out-of-range` (R7.5) |
| Missing or damaged slot | Not a failure; drawn as a gap row and listed in `gaps` (R11.3) |
| Any other input | Never throws (R11.1) |

## Testing Strategy

- Properties use fast-check, run through `fc.assert` with no `try`/`catch`, and have titles that start with the criterion ID (R13.1). Pure-function properties use the default `numRuns`; image properties use `numRuns: 25` and a pinned seed.
- Arbitraries reuse `profileArbitrary` and `cardGridArbitrary` from `tests/support/profiles.ts`, plus new `slotListArbitrary` (with missing and damaged slots), `weftPlanArbitrary` and `renderSettingsArbitrary` with small viewports so properties stay fast (R13.2).
- Pixel checks read crossing colours at cell centres and compare whole rows; they never compare against stored image files.
- `tests/simulator/benchmark.test.ts` renders frames across a generated 2000-pick slot list at 1920 x 1080 and prints the median and worst frame time; it fails only if a render fails (R10.4).
- The existing structure tests (`tests/structure/`) already check module boundaries, browser APIs, `any` and property names. Their allowed lists gain `src/simulator` (imports only `src/codec`; browser APIs only in `canvas.ts`) (R12).

## Correctness Properties

Each property is a fast-check property. The test title is the heading text after `Property N:`, without the final full stop. **Demo** marks the properties needed for the demo. **Cut last** marks the ones that can be dropped last if time runs short; dropping one is reported, never silent.

### Property 1: R1.2 an invalid profile fails with invalid-profile and nothing is rendered.

**Demo.** For any profile mutated to fail `parseCardProfile`, `prepareCloth` returns `invalid-profile` with the same violations.

**Validates: Requirements 1.2**

### Property 2: R1.3 every slot is classified as woven, missing or damaged by validateCardGrid.

**Demo.** For any profile and slot list with valid, `null` and damaged slots, each `PickRow.kind` matches the slot, damaged rows carry exactly the `validateCardGrid` violations, and `gaps` lists exactly the gap picks in order.

**Validates: Requirements 1.3**

### Property 3: R1.6 preparing and rendering do not change the profile or the slot list.

**Cut last.** Deep-equal to clones taken before the calls.

**Validates: Requirements 1.6**

### Property 4: R2.2 the lift set of a pick is exactly the ends encodeCardGrid marks as lifted.

**Demo.** For any profile with a permuted `endOrder` and any card, `lift[e] = 1` exactly when `encodeCardGrid` gives `true` at end `e`.

**Validates: Requirements 2.2**

### Property 5: R2.3 a crossing shows the warp on the face exactly when its end is lifted.

**Demo.** For any profile, slot list and settings with distinct warp and weft colours, the pixel at each visible crossing centre has the shaded warp colour when the end is lifted and the shaded weft colour otherwise.

**Validates: Requirements 2.3**

### Property 6: R2.5 changing one slot changes only that pick's row.

**Demo.** For any slot list, pick `p` and replacement slot (another card, `null`, or a damaged value), the two renders differ only inside pick `p`'s row and, for frames of pick `p`, the shed. This also checks that a gap keeps its place (R4.4). Float highlighting is off in this property; highlighting depends on neighbouring picks by design and is checked by Property 9.

**Validates: Requirements 2.5**

### Property 7: R3.1 computeFloats finds exactly the runs a direct scan finds.

**Cut last.** Compared with a reference scan written in the test.

**Validates: Requirements 3.1**

### Property 8: R3.2 no float crosses a gap pick.

**Cut last.** Every warp float from `computeFloats` covers only woven picks.

**Validates: Requirements 3.2**

### Property 9: R3.3 highlighted pixels are exactly the cells of floats longer than the limit.

**Cut last.** For any visible cell, it is highlighted exactly when its float, measured by the reference scan, is longer than `maxLength`.

**Validates: Requirements 3.3**

### Property 10: R4.2 a gap row holds only gap colours and does not depend on other picks.

**Demo.** For any slot list with a gap at `p`, every pixel of pick `p`'s row is a gap-palette colour, and the row is identical when any other slot changes.

**Validates: Requirements 4.2**

### Property 11: R4.3 a missing card and a damaged card draw different gap rows.

**Demo.** The same pick drawn missing and drawn damaged gives different rows.

**Validates: Requirements 4.3**

### Property 12: R5.4 invalid settings fail with invalid-settings naming the setting.

**Demo.** For valid settings with one field replaced by an invalid value (colour, empty weft plan, thread size, repeat, viewport, highlight limit), the failure names that field.

**Validates: Requirements 5.4**

### Property 13: R5.2 pick p uses weft p mod n of the weft plan.

**Cut last.** The weft-on-face crossings of pick `p` show weft `p mod n`.

**Validates: Requirements 5.2**

### Property 14: R5.5 zari picks show the zari highlight and plain picks never do.

**Demo.** Rows of zari picks with a weft-on-face cell contain highlight pixels; rows of plain picks are constant along `x` inside every weft-on-face cell.

**Validates: Requirements 5.5**

### Property 15: R6.1 thread edges are darker than thread centres.

**Cut last.** For every allowed `t`, `shadeTable(t)` is symmetric, lowest at the edges and highest at the centre.

**Validates: Requirements 6.1**

### Property 16: R7.5 a frame outside the slot list fails with pick-out-of-range.

**Demo.** Negative, fractional, too-large and non-number picks, and bad phases or steps, give `pick-out-of-range` and no image.

**Validates: Requirements 7.5**

### Property 17: R7.3 the player reaches the same pixels as rendering the pick directly.

**Demo.** With a fake scheduler and clock, the image the player paints when it reaches `rest(p)`, whether by playing from 0 or by seeking, equals `renderFrame(rest(p))`.

**Validates: Requirements 7.3**

### Property 18: R8.1 the same input renders identical bytes every time.

**Demo.** Two renders of the same frame are byte-identical, also when other frames, slot lists or settings are rendered in between (R7.4).

**Validates: Requirements 8.1**

### Property 19: R9.1 each woven pick animates as lift, the weft pass, then the next rest frame, and a gap pick has no lift or pass.

**Demo.** `framesForPick` returns `lift(p)` then `pass(p, 0..PASS_STEPS-1)` for woven picks and an empty list for gap picks.

**Validates: Requirements 9.1**

### Property 20: R9.4 the fell stays at the same height and the newest pick is next to it.

**Cut last.** For any `p`, the row just above `fellY` belongs to pick `p - 1`.

**Validates: Requirements 9.4**

### Property 21: R10.3 frameAt moves forward with time, skips rather than slows, and stops at the end pick.

**Demo.** `frameAt` is monotonic in elapsed time, its pick equals `startPick + floor(elapsed * rate / 1000)` while in range, and is `rest(endPick)` after the end.

**Validates: Requirements 10.3**

### Property 22: R11.1 the simulator never throws for any input.

**Demo.** `prepareCloth`, `parseRenderSettings` and `renderFrame` with `fc.anything()` arguments return a result.

**Validates: Requirements 11.1**

### Property 23: R14.2 the tiled render equals the base render repeated.

**Demo.** With float highlighting off, every column `x` of a render with repeat `k` equals column `x mod (baseEnds * t)` of the repeat-1 render.

**Validates: Requirements 14.2**

### Property 24: R14.4 with highlighting on, weft floats are measured across repeat boundaries.

**Cut last.** A weft float that touches the right edge of one repeat and the left edge of the next is measured as one float.

**Validates: Requirements 14.4**

## Decisions

Settled in the design review:

1. **Minimum thread size** is 3 px (R6.3); R6.4 is dropped and R4.1 is kept.
2. **Speed: measure first.** If frame times miss the 16 ms budget, no requirement (including R8.2) changes. The measured numbers and a proposed fallback (for example rendering at a lower resolution and letting the canvas scale it) go to the user, and work waits for approval.
3. **Accepted as proposed:** shed height `min(6 t, height / 3)`, viewport sides up to 4,096 px, repeat and highlight limits up to 64, fixed gap, zari, highlight and background colours.
