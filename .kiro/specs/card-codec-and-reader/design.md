# Design Document

## Overview

This design covers `src/codec` and `src/reader`, plus the changes they force on `scripts/make_fixtures.ts`, the demo profile, and the test support code.

- **Codec.** Pure TypeScript with no dependencies. It validates a `CardProfile` and a `CardGrid`, and converts a `CardGrid` to and from an ends list. The hook-position-to-end mapping is an explicit table inside the profile (`endOrder`). Nothing in the codec assumes row-major order.
- **Reader.** A pipeline of small pure functions over typed arrays: greyscale, threshold, dark regions, peg hole pair, orientation, pose, sampling. Only one file (`canvasSource.ts`) touches a browser API.
- **Zero new dependencies.** Runtime code uses only the language and the Canvas 2D API. Tests use `vitest` and `fast-check`, which are already installed, plus Node built-ins (`node:zlib`, `node:fs`). No `tsx`, no image library, no PNG library.

### Key decisions

| Decision | Choice | Reason |
|---|---|---|
| End-order representation | Explicit table `endOrder[hookRow][hookColumn] = endIndex` in the profile JSON | One representation covers every loom. A named preset would be a second code path. |
| Row-major helper | Lives in `tests/support`, not in `src/codec` | R1.2 forbids the codec from assuming row-major order anywhere except through the profile. |
| Peg holes | Tuple of exactly two `{ positionMm, diameterMm }` | R2.6, R2.7. Two points fix rotation, scale and position. |
| Orientation | Decided from measured peg hole diameters by one dimensionless formula | R18.1 to R18.6. No fixed pixel count. |
| Peg hole pose | Similarity transform (rotation, uniform scale, translation) from two points | R9.4. Perspective is out of scope. |
| Reader input | `PixelData` (width, height, RGBA `Uint8ClampedArray`), typed as `unknown` at the boundary | R6.1, R12.3. The reader checks it and never throws. |
| Generator and codec | `scripts/make_fixtures.ts` imports `src/codec` | One source of truth for the end-order mapping. |
| Import extensions | Relative imports inside `src/codec` end in `.ts` | The script runs under Node type stripping, which does not resolve extensionless imports. See "Project changes". |

## Architecture

### Module and file layout

```
src/codec/
  types.ts               CardProfile, PegHole, CardGrid, Pattern, Ends, Violation, Result
  validateCardProfile.ts validateCardProfile, parseCardProfile
  validateCardGrid.ts    validateCardGrid
  endsCodec.ts           encodeCardGrid, decodeEnds, endsPerPick
  index.ts               re-exports (with .ts extensions)

src/reader/
  types.ts               PixelData, GreyImage, DarkMap, DarkRegion, Pose, ReadResult, ReadFailure
  pixelData.ts           isPixelData
  canvasSource.ts        loadPixelData            (the only file that uses a browser API)
  greyscale.ts           toGreyscale
  threshold.ts           chooseThreshold, classifyDark
  regions.ts             findDarkRegions, equivalentDiameterPx
  orientation.ts         orientationSeparation, decideOrientation
  pegHoles.ts            findPegHolePair
  pose.ts                poseFromPegHoles, cardToImage, normalizeDegrees, angleDifferenceDegrees
  sampling.ts            samplingRadiusPx, decidePunched, sampleCardGrid
  readCard.ts            readCard
  index.ts               re-exports

tests/
  codec/                 validateCardProfile.test.ts, validateCardGrid.test.ts, endsCodec.test.ts
  reader/                pixelData, canvasSource, greyscale, threshold, regions, orientation,
                         pegHoles, pose, sampling, readCard, accuracy, benchmark  (*.test.ts)
  scripts/               make_fixtures.test.ts
  structure/             modules.test.ts, propertyNames.test.ts, dependencies.test.ts
  support/               png.ts, profiles.ts, images.ts      (helpers, not test files)
  fixtures/              regenerated PNG + JSON files
```

### Dependency rules

```
reader  -> codec              (types and validation only)
codec   -> nothing in src/
scripts/make_fixtures.ts -> src/codec
tests   -> src/*, scripts/make_fixtures.ts, tests/support
```

`src/reader` imports only from `src/codec` (R15.2). `src/codec` imports nothing outside itself and uses no browser API, React, or file input and output (R15.1).

### Data flow: RGBA pixel data to CardGrid

```
 unknown profile ---> parseCardProfile ----(violations)----> failure invalid-profile
 unknown pixels  ---> isPixelData --------(false)-----------> failure invalid-image
        |
        v
  PixelData (w, h, RGBA bytes)
        | toGreyscale
        v
  GreyImage (w*h levels 0..255)
        | chooseThreshold  (Otsu, exact integer arithmetic)
        | classifyDark     (dark iff level < threshold)
        v
  DarkMap (w*h bytes, 1 = dark)
        | findDarkRegions  (4-connected flood fill)
        | drop regions that touch the image edge, drop tiny regions
        v
  DarkRegion[]  (area, centroid, bounds)
        | findPegHolePair  (distance, direction, diameter fit)  --(none)--> failure peg-holes-not-found
        v
  PegHolePair (two regions, pixelsPerMm, upright hypothesis, fit)
        | decideOrientation (separation formula)  --(ambiguous)--> failure ambiguous-orientation
        v
  upright | upside-down
        | poseFromPegHoles
        v
  Pose (tiltDegrees, pixelsPerMm, originPx, orientation)
        | sampleCardGrid  (one disc per hook position, majority rule)  --(outside)--> failure card-outside-image
        v
  CardGrid (hookRows x hookColumns)  ---> ReadResult { ok: true, grid, pose }
```

The same `DarkMap` is used for peg detection and for sampling. Sampling therefore never reads the peg holes or lacing holes (R11.3): it reads only the positions generated from `firstHoleCentreMm`, the pitches, and the grid size.

Memory for a 1920 x 1080 image: the RGBA input (8.3 MB), `levels` (2.1 MB), `dark` (2.1 MB), and an `Int32Array` flood-fill stack sized to the number of dark pixels. There is no per-pixel object allocation.

## Components and Interfaces

### Codec types (`src/codec/types.ts`)

```ts
export type PointMm = { x: number; y: number };

/** A fixed alignment hole. Not part of the pattern. */
export type PegHole = { positionMm: PointMm; diameterMm: number };

export type CardProfile = {
  name: string;
  status?: string;
  cardWidthMm: number;
  cardHeightMm: number;
  hookRows: number;
  hookColumns: number;
  holeDiameterMm: number;
  horizontalPitchMm: number;
  verticalPitchMm: number;
  firstHoleCentreMm: PointMm;
  /** endOrder[hookRow][hookColumn] = end index, a permutation of 0..hookRows*hookColumns-1. */
  endOrder: number[][];
  /** Exactly two peg holes with different diameters (see R2.7, R2.8). */
  pegHoles: [PegHole, PegHole];
  lacingHoles: { diameterMm: number; positionsMm: PointMm[] };
};

export type CardGrid = boolean[][];   // hookRows x hookColumns, true = punched = hook lifts
export type Pattern = CardGrid[];     // one card per pick
export type Ends = boolean[];         // length hookRows * hookColumns, ends[endIndex]

export type ViolationKind =
  | 'not-an-object' | 'missing-field'
  | 'not-a-positive-integer' | 'not-a-positive-number' | 'hole-outside-card'
  | 'end-order-shape' | 'end-order-duplicate' | 'end-order-unassigned' | 'end-order-out-of-range'
  | 'peg-hole-count' | 'peg-holes-coincide' | 'peg-diameters-too-close'
  | 'not-an-array' | 'wrong-hook-row-count' | 'wrong-hook-column-count' | 'not-a-boolean'
  | 'wrong-ends-length';

export type Violation = {
  kind: ViolationKind;
  /** Where the problem is, for example "hookRows", "endOrder[3][5]", "grid[2]", "ends[17]". */
  location: string;
  message: string;
  expected?: number;
  actual?: number;
};

export type Result<T> = { ok: true; value: T } | { ok: false; violations: Violation[] };
```

The demo profile JSON becomes (all values keep the ILLUSTRATIVE, UNVERIFIED marker; `endOrder` is the row-major table, shown abbreviated):

```json
{
  "name": "demo-12x16",
  "status": "ILLUSTRATIVE, UNVERIFIED, replace with measured values",
  "cardWidthMm": 60, "cardHeightMm": 45,
  "hookRows": 12, "hookColumns": 16,
  "holeDiameterMm": 2.0, "horizontalPitchMm": 3.0, "verticalPitchMm": 3.0,
  "firstHoleCentreMm": { "x": 7.5, "y": 6.0 },
  "endOrder": [[0, 1, 2, "...", 15], [16, 17, "...", 31], "...", [176, "...", 191]],
  "pegHoles": [
    { "positionMm": { "x": 3.0,  "y": 22.5 }, "diameterMm": 2.5 },
    { "positionMm": { "x": 57.0, "y": 22.5 }, "diameterMm": 3.0 }
  ],
  "lacingHoles": { "diameterMm": 2.0, "positionsMm": [ ... ] }
}
```

### Codec functions

```ts
// validateCardProfile.ts
export const MIN_PEG_DIAMETER_DIFFERENCE = 0.1;
export function validateCardProfile(input: unknown): Violation[];       // R2.1; never throws (R2.9)
export function parseCardProfile(input: unknown): Result<CardProfile>;  // ok iff validateCardProfile is empty

// validateCardGrid.ts
export function validateCardGrid(profile: CardProfile, input: unknown): Violation[];  // R3

// endsCodec.ts
export function endsPerPick(profile: CardProfile): number;                            // hookRows * hookColumns
export function encodeCardGrid(profile: CardProfile, grid: unknown): Result<Ends>;    // R4
export function decodeEnds(profile: CardProfile, ends: unknown): Result<CardGrid>;    // R5
```

Precondition for `validateCardGrid`, `encodeCardGrid` and `decodeEnds`: `profile` came from `parseCardProfile`. Data that crosses a trust boundary (a grid or an ends list from JSON) is typed `unknown` and checked.

**Encoding.** For every hook position, `ends[profile.endOrder[hookRow][hookColumn]] = grid[hookRow][hookColumn]`. **Decoding** is the inverse: `grid[hookRow][hookColumn] = ends[profile.endOrder[hookRow][hookColumn]]`. No inverse table is built, and no arithmetic on indices is used.

**Profile validation rules** (each rule adds violations, none stops the others):

1. Not a plain object: one `not-an-object` violation, return.
2. Missing field: `missing-field` at that field. A missing `endOrder` is reported here (R1.4), and no default order is used.
3. `hookRows`, `hookColumns`: positive integers (R2.2).
4. `cardWidthMm`, `cardHeightMm`, `holeDiameterMm`, both pitches, `lacingHoles.diameterMm`, each peg `diameterMm`: positive finite numbers (R2.3).
5. Hole fit (R2.4): with `r = holeDiameterMm / 2`, report when the first column's left edge `x0 - r < 0`, the last column's right edge `x0 + (hookColumns-1)*pitchH + r > cardWidthMm`, the first row's top edge `y0 - r < 0`, or the last row's bottom edge `y0 + (hookRows-1)*pitchV + r > cardHeightMm`. Pitches are positive, so these four checks cover every hook position. The location names the extreme hook position, for example `hook[0][15]`.
6. `endOrder` (R2.5): must be `hookRows` arrays of `hookColumns` integers (`end-order-shape`). Then every value must lie in `0 .. hookRows*hookColumns-1` (`end-order-out-of-range`, located at the cell), appear at most once (`end-order-duplicate`, located at the second cell), and every end index must appear (`end-order-unassigned`, located at the end index).
7. Peg holes (R2.6, R2.7): each must have `positionMm` with finite `x` and `y`, and `diameterMm`. The list must have length 2 (`peg-hole-count`) and the two positions must differ (`peg-holes-coincide`).
8. Peg diameter difference (R2.8): with `a`, `b` the two diameters, report `peg-diameters-too-close` when `|a - b| < 0.1 * max(a, b) * (1 - 1e-9)`. The `1e-9` factor stops floating-point error from rejecting a difference of exactly 10% (for example 2.7 and 3.0). Equal diameters are included.

### Reader types (`src/reader/types.ts`)

```ts
export type PixelData = { width: number; height: number; data: Uint8ClampedArray }; // RGBA, row-major
export type GreyImage = { width: number; height: number; levels: Uint8Array };
export type DarkMap   = { width: number; height: number; dark: Uint8Array };         // 1 = dark, 0 = light
export type PointPx   = { x: number; y: number };   // continuous coordinates: pixel (x, y) covers [x, x+1) x [y, y+1)

export type DarkRegion = {
  area: number;            // pixel count
  centroid: PointPx;       // mean of pixel centres
  minX: number; minY: number; maxX: number; maxY: number;  // inclusive pixel bounds
  touchesEdge: boolean;    // minX == 0 || minY == 0 || maxX == width-1 || maxY == height-1
};

export type Orientation = 'upright' | 'upside-down';

export type Pose = {
  tiltDegrees: number;     // -180 < tilt <= 180, positive = clockwise
  pixelsPerMm: number;
  originPx: PointPx;       // image position of the card's top-left corner
  orientation: Orientation;
};

export type ReadFailure =
  | { reason: 'invalid-profile'; violations: Violation[] }
  | { reason: 'invalid-image'; detail: string }
  | { reason: 'peg-holes-not-found' }
  | { reason: 'ambiguous-orientation'; separation: number }
  | { reason: 'card-outside-image' };

export type ReadResult =
  | { ok: true; grid: CardGrid; pose: Pose }
  | { ok: false; failure: ReadFailure };
```

The pose maps card millimetres to image pixels (the same convention the generator uses):

```
x_img = originPx.x + s * ( x_mm * cos(t) - y_mm * sin(t) )
y_img = originPx.y + s * ( x_mm * sin(t) + y_mm * cos(t) )        s = pixelsPerMm, t = tiltDegrees in radians
```

With y pointing down, a positive `t` turns the card clockwise on screen.

### Reader functions

```ts
// pixelData.ts
export function isPixelData(value: unknown): value is PixelData;
//   true iff width and height are positive integers and data is a Uint8ClampedArray of length width*height*4. Never throws.

// canvasSource.ts   (the only browser-API file)
export type ImageSource = HTMLImageElement | ImageBitmap | Blob;
export type Context2DLike = {
  drawImage(image: CanvasImageSource, dx: number, dy: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): { width: number; height: number; data: Uint8ClampedArray };
};
export type CanvasLike = { getContext(kind: '2d'): Context2DLike | null };
export function loadPixelData(
  source: ImageSource,
  createCanvas?: (width: number, height: number) => CanvasLike,   // injected in tests; default uses OffscreenCanvas or a canvas element
): Promise<PixelData>;                                            // rejects if the browser cannot decode the source

// greyscale.ts
export function toGreyscale(pixels: PixelData): GreyImage;

// threshold.ts
export function chooseThreshold(grey: GreyImage): number;                  // integer 0..255; dark iff level < threshold
export function classifyDark(grey: GreyImage, threshold: number): DarkMap;

// regions.ts
export function findDarkRegions(map: DarkMap): DarkRegion[];               // in scan order of each region's first pixel
export function equivalentDiameterPx(region: DarkRegion): number;          // 2 * sqrt(area / PI)

// orientation.ts
export type DiameterPair = readonly [number, number];                      // [role 0, role 1]
export type OrientationDecision = { kind: 'upright' | 'upside-down' | 'ambiguous'; separation: number };
export const MIN_SEPARATION = 0.5;
export function orientationSeparation(expected: DiameterPair, measuredUpright: DiameterPair): number;
export function decideOrientation(expected: DiameterPair, measuredUpright: DiameterPair): OrientationDecision;

// pegHoles.ts
export type PegHolePair = {
  uprightRegions: readonly [DarkRegion, DarkRegion];  // regions in peg role 0 and role 1 under the upright hypothesis
  pixelsPerMm: number;
  fit: number;                                        // mean relative diameter error, lower is better
};
export function findPegHolePair(profile: CardProfile, regions: readonly DarkRegion[]): PegHolePair | null;

// pose.ts
export function normalizeDegrees(angle: number): number;                   // result in (-180, 180]
export function angleDifferenceDegrees(a: number, b: number): number;      // result in [0, 180], modulo 360
export function poseFromPegHoles(profile: CardProfile, pair: PegHolePair, orientation: Orientation): Pose;
export function cardToImage(pose: Pose, pointMm: PointMm): PointPx;

// sampling.ts
export const SAMPLING_RADIUS_FRACTION = 0.6;
export function samplingRadiusPx(profile: CardProfile, pose: Pose): number;
export function decidePunched(darkCount: number, sampleCount: number): boolean;   // darkCount * 2 > sampleCount
export function sampleCardGrid(profile: CardProfile, pose: Pose, map: DarkMap): CardGrid | null;  // null = card-outside-image

// readCard.ts
export function readCard(profile: unknown, pixels: unknown): ReadResult;          // never throws (R12.3)
```

`readCard` runs the data flow above in order and returns the first failure. It validates the profile before touching pixels, so `invalid-profile` takes priority over `invalid-image`.

## Algorithms

### Greyscale (R7)

```
level = floor( (299 * r + 587 * g + 114 * b + 500) / 1000 )        alpha is ignored
```

The weights sum to 1000, so a pixel with `r = g = b = v` gives exactly `v` (R7.3). The result is never above 255 and never decreases when a channel grows (R7.4). All arithmetic is integer.

### Threshold choice (R8)

The algorithm is Otsu's method on the 256-bin grey-level histogram of the image itself, with exact integer arithmetic and a defined tie rule. No constant threshold is used (R8.1).

1. Build `hist[0..255]` and `N = width * height`. Let `S = sum(i * hist[i])`.
2. For each candidate split `t` from 0 to 254, let `n0 = sum(hist[0..t])`, `S0 = sum(i * hist[i], i <= t)`, `n1 = N - n0`, `S1 = S - S0`. Skip `t` if `n0 = 0` or `n1 = 0`.
3. The score is the between-class variance (up to a constant factor):

   ```
   score(t) = (S0 * n1 - S1 * n0)^2 / (n0 * n1)
   ```

   Scores are compared exactly with `BigInt` cross-multiplication (`num_a * den_b > num_b * den_a`), so no rounding can change the winner. This is only 255 comparisons per image.
4. Let `tLow` be the first `t` with the highest score. Extend to `tEnd` while the next histogram bin is empty (`tEnd < 254` and `hist[tEnd + 1] = 0`). Every split in `tLow .. tEnd` gives the same classes, so take the middle of the gap: `t* = floor((tLow + tEnd) / 2)`.
5. The threshold is `t* + 1`, and a pixel is dark when `level < threshold` (R8.2).
6. If no split has both classes non-empty (the image has a single grey level, or no pixels), the threshold is `0` and no pixel is dark (R8.4).

Why this satisfies R8.3: adding a constant `d` to every level (without clipping) shifts the histogram. `S0 * n1 - S1 * n0` is unchanged because the `d * n0 * n1` terms cancel, so every score is identical, the winning split shifts by `d`, and the same pixels are dark. Why R8.1 can be tested: the threshold is a function of the histogram only, so shuffling the pixels cannot change it.

Measured on the current fixtures with a throwaway script (not repo code): the threshold falls between 131 and 142. The card surroundings (grey level 70) fall on the dark side with the holes. They form one dark region that touches the image edge, which R9.1 excludes.

### Dark regions (R9.1)

`findDarkRegions` labels 4-connected dark pixels with an explicit-stack flood fill on a copy of the `dark` array (no recursion). For each region it records area, centroid (mean of `x + 0.5`, `y + 0.5`), inclusive bounds, and `touchesEdge`.

Before peg detection, `readCard` keeps regions that satisfy `!touchesEdge && area >= MIN_REGION_AREA_PX`, sorted by area descending, at most `MAX_CANDIDATE_REGIONS`. On the noisy fixtures this removes about 90 speckle regions and leaves 69 candidates (63 punched holes, 4 lacing holes, 2 peg holes in `pick0-noisy`).

### Peg hole pair (R9.2 to R9.4, R9.7)

Notation: the profile's pegs are role 0 and role 1, with positions `p0`, `p1` and diameters `d0`, `d1` (mm). `L = |p1 - p0|` (positive, because R2.7 rejects coincident pegs). `phi = atan2(p1.y - p0.y, p1.x - p0.x)`.

For every unordered pair of candidate regions `(i, j)`, `i < j`, with centroids `ci`, `cj`:

1. `v = cj - ci`. Skip the pair if `|v| = 0`. Set `s = |v| / L` (pixels per millimetre implied by the pair).
2. Hypothesis A assigns `i` to role 0 and `j` to role 1. Its tilt is `thetaA = normalize(atan2(v.y, v.x) - phi)`. Hypothesis B assigns them the other way round, so `thetaB = normalize(thetaA + 180)`.
3. The **upright hypothesis** is whichever of A and B has `|theta| <= TILT_SEARCH_LIMIT_DEGREES` (15). If neither does, skip the pair. At most one can, because the two tilts differ by 180 degrees. `uprightRegions = [region in role 0, region in role 1]` under that hypothesis. The other hypothesis is the **upside-down hypothesis**: the same two regions with the roles swapped.
4. Expected diameters in pixels: `e0 = d0 * s`, `e1 = d1 * s`. Measured diameters of the upright pair: `u0`, `u1` (`equivalentDiameterPx`).
5. `cUp = |u0 - e0| + |u1 - e1|` and `cDown = |u1 - e0| + |u0 - e1|`.
6. `fit = min(cUp, cDown) / (e0 + e1)`. This is the mean relative diameter error and does not depend on which way up the card is. Accept the pair if `fit <= FIT_MAX` (0.15).

The accepted pair with the lowest `fit` wins (ties go to the pair found first). If no pair is accepted, the result is `null` and the reader fails with `peg-holes-not-found` (R9.7). The search uses only profile data, never a fixed pixel scale, tilt, or position (R9.2, R6.6). It is `O(n^2)` with `n <= 400`, at most 79,800 pairs of cheap arithmetic.

How decoys are rejected (R9.3): a punched hole or lacing hole has the wrong diameter for its role. With the demo profile at 6 px/mm, a 12 px hole against a 15 px and an 18 px peg gives `fit = (3 + 6) / 33 = 0.27`, above 0.15. Pairs of decoys that are the right distance apart also need a direction within 15 degrees of the peg axis. This rule depends on peg diameters differing from punched hole diameters. A profile whose pegs have the same diameter as its punched holes is not rejected by validation, and for such a card detection relies on distance and direction alone. The test arbitraries keep each peg diameter at least 20% away from the punched hole diameter.

### Orientation (R18)

Let `e0, e1` be the expected peg diameters in pixels (`d0 * s`, `d1 * s`) and `u0, u1` the measured diameters under the upright hypothesis. Define:

```
cUp   = |u0 - e0| + |u1 - e1|          error if the card is upright
cDown = |u1 - e0| + |u0 - e1|          error if the card is upside down

separation q = (cDown - cUp) / (2 * |e0 - e1|)         always in [-1, 1]

q >=  MIN_SEPARATION (0.5)  ->  upright
q <= -MIN_SEPARATION        ->  upside-down
otherwise                   ->  ambiguous  (fail with ambiguous-orientation)
```

This is the rule R18.6 asks for. It depends only on the profile's two diameters and the measured scale. Every term is a diameter in pixels, so multiplying all four inputs by the same factor leaves `q` unchanged, and no fixed pixel count appears.

Worked examples at 6 px/mm with the demo diameters (`e = [15, 18]`):

| Measured `[u0, u1]` | cUp | cDown | q | Decision |
|---|---|---|---|---|
| `[15.1, 17.9]` | 0.2 | 5.8 | +0.93 | upright |
| `[17.9, 15.1]` | 5.8 | 0.2 | -0.93 | upside-down |
| `[16.5, 16.5]` | 3.0 | 3.0 | 0 | ambiguous |

Error budget: if the two measurements err by `+x` and `-x` in the worst direction, `q = 1 - 2x / g` with `g = |e0 - e1|`, so the decision holds while `x <= g / 4`. A shared bias `x` on both diameters gives `q = 1 - x / g`, which holds while `x <= g / 2`. The first measurements show a shared bias of about +0.2 to +0.6 px (a 15 px peg measures 15.2 to 15.6 px, because pixels at 37% hole coverage count as dark). For the demo pegs, `g = 3 px`, so `q` stays at about 0.8 or higher. For a profile at the 10% limit (for example 2.7 and 3.0 mm at 6 px/mm), `g = 1.8 px`, and the same bias gives `q` of about 0.67 to 0.89.

If `e0 = e1` (impossible for a validated profile), `orientationSeparation` returns 0 and the decision is `ambiguous`.

When the decision is `upside-down`, the reader does not reject the card. It swaps the two roles and reads it (R18.3).

### Pose (R9.4, R18.7)

With the roles decided, let `a` be the region in role 0 and `b` the region in role 1 (the `uprightRegions` for `upright`, swapped for `upside-down`), with centroids `ca`, `cb`:

```
s       = |cb - ca| / |p1 - p0|
tilt    = normalize( atan2(cb - ca) - atan2(p1 - p0) )      in degrees, range (-180, 180]
origin  = ca - s * R(tilt) * p0                              R(t) = [[cos t, -sin t], [sin t, cos t]]
```

An upside-down card therefore reports a tilt near 180. `angleDifferenceDegrees(a, b)` returns `|normalize(a - b)|`, so 179 and -179 differ by 2 (R18.7).

### Sampling (R10, R11)

For hook position `(hookRow, hookColumn)`:

```
pointMm   = ( firstHoleCentreMm.x + hookColumn * horizontalPitchMm,
              firstHoleCentreMm.y + hookRow    * verticalPitchMm )
centre    = cardToImage(pose, pointMm)
radiusPx  = SAMPLING_RADIUS_FRACTION * (holeDiameterMm / 2) * pixelsPerMm        (0.6 of the hole radius)
```

1. **Bounds first (R10.4).** For every hook position, require `centre.x - radiusPx >= 0`, `centre.x + radiusPx <= width`, and the same for `y` and `height`. If any position fails, return `null` (`card-outside-image`) before reading a single pixel. Every pixel centre inside such a disc is then inside the image.
2. **Sampling area (R10.3).** The pixels whose centres `(x + 0.5, y + 0.5)` lie within `radiusPx` of `centre`. Because the fraction is 0.6, the disc lies inside the hole and cannot reach a neighbouring hole (pitch is at least the hole diameter in valid cards). If no pixel centre falls inside, the single pixel containing `centre` is used.
3. **Decision (R11.1).** `punched = darkCount * 2 > sampleCount`. Exactly half dark is not punched.

The result has `hookRows` rows of `hookColumns` booleans, so it passes `validateCardGrid` (R11.2). Tilt correction (R10.1, R10.2) comes from `cardToImage`: no image is resampled.

### Constants

| Constant | Value | File | Meaning |
|---|---|---|---|
| `MIN_PEG_DIAMETER_DIFFERENCE` | 0.1 | validateCardProfile.ts | R2.8 |
| `MIN_REGION_AREA_PX` | 4 | readCard.ts | smallest dark region kept as a candidate |
| `MAX_CANDIDATE_REGIONS` | 400 | readCard.ts | bound on the pair search |
| `TILT_SEARCH_LIMIT_DEGREES` | 15 | pegHoles.ts | tilt window for the upright hypothesis (R9.5 requires 10; the extra 5 is a margin) |
| `FIT_MAX` | 0.15 | pegHoles.ts | mean relative diameter error allowed for a peg hole pair |
| `MIN_SEPARATION` | 0.5 | orientation.ts | R18 decision margin |
| `SAMPLING_RADIUS_FRACTION` | 0.6 | sampling.ts | R10.3 |

None of these is a card dimension (R14.2). They may be tuned while implementing only if the change is reported to you. The accuracy targets in R13 do not move.

## Project changes this design needs

These are the changes outside `src/codec` and `src/reader`. They become explicit tasks in `tasks.md`.

1. **`tsconfig.json`:** add `"allowImportingTsExtensions": true` (already `noEmit`) and `"erasableSyntaxOnly": true`. Relative imports inside `src/codec` use the `.ts` extension, so that `scripts/make_fixtures.ts`, which runs under Node type stripping, can import `src/codec`. Other modules keep extensionless imports. `erasableSyntaxOnly` rejects `enum`, `namespace` and parameter properties, which type stripping cannot run.
2. **Demo profile:** `pegHoles` becomes the two-element array with diameters 2.5 and 3.0 mm; add the row-major `endOrder` table (R1.3, R19.4). Keep the ILLUSTRATIVE, UNVERIFIED marker.
3. **`src/codec/types.ts`:** replace `pegHoles: { diameterMm; positionsMm[] }` with `pegHoles: [PegHole, PegHole]`, add `endOrder`, `PegHole`, `Ends`, `Violation`, `Result`.
4. **`scripts/make_fixtures.ts`:**
   - Import `CardProfile` and the codec functions from `../src/codec/index.ts`. Validate the profile with `parseCardProfile` before rendering.
   - Draw each peg at its own position and diameter (R19.1).
   - Write `ends: encodeCardGrid(profile, card)` into each ground-truth JSON, next to `card` (R19.2).
   - Add a `pixelsPerMm` render option, default 6, recorded in the ground truth (R19.8). R14.3 and R18.8 need it. `PIXELS_PER_MM` stays as the default and `BORDER_MM` stays in millimetres, so the border scales with the option.
   - `renderCard` keeps working for any tilt, including 170 to 190 degrees.
   - Regenerate every file in `tests/fixtures/` and keep two runs byte-identical (R19.6).
5. **`tests/scripts/make_fixtures.test.ts`:** update for the new profile fields without weakening a check (R19.7). Add tests for R19.1, R19.2, R19.4 to R19.6 (see the properties below).
6. **Steering docs:** `card-geometry.md` (peg row of the Layout table, the rule that gives the end index formula, which now lives in the profile, and a note that peg hole diameters must differ from the punched hole diameter for reliable detection), `structure.md` (module key exports: the codec and reader lists are out of date), and `tech.md` (the `.ts` extension rule for `src/codec`).
7. **No change to `package.json` dependencies.** `tests/structure/dependencies.test.ts` checks that `dependencies` still holds only `react` and `react-dom` (R6.5, R16.3).

## Data Models

The data types are in "Components and Interfaces". Two data files matter:

- **Profile file** (`public/profiles/*.json`): shape of `CardProfile`. Loaded at runtime and parsed by `parseCardProfile`.
- **Ground-truth file** (`tests/fixtures/*.json`), written by the generator:

```ts
type GroundTruth = {
  profile: string;            // profile name; the test loads public/profiles/<name>.json
  image: string;
  pickIndex: number;
  hookRows: number; hookColumns: number; endsPerPick: number;
  card: CardGrid;             // the oracle for accuracy tests (R13.4)
  ends: boolean[];            // the same card as an ends list in the profile's order (R19.2)
  options: { noise: number; tiltDegrees: number; shade: number; seed: number; pixelsPerMm: number };
};
```

## Error Handling

| Situation | Where it is detected | Result |
|---|---|---|
| Profile is not valid | `parseCardProfile` at the start of `readCard` | `invalid-profile` with the violations |
| Pixel data malformed (bad size, wrong length, not an object) | `isPixelData` | `invalid-image` with a short detail text |
| No pair of regions fits the peg holes (blank, uniform or unrelated image) | `findPegHolePair` returns `null` | `peg-holes-not-found` |
| Peg diameters cannot be told apart | `decideOrientation` returns `ambiguous` | `ambiguous-orientation` with the separation |
| A hook position's sampling area leaves the image | `sampleCardGrid` returns `null` | `card-outside-image` |
| Grid or ends list from outside is malformed | `validateCardGrid`, `decodeEnds` | `Result` with violations. Nothing throws. |
| Browser cannot decode an image source | `loadPixelData` | The promise rejects. The caller handles it, and `readCard` is not involved. |

`readCard` has no `try` or `catch`. It does not throw because every input is checked before use and every array index is guarded by a bounds check. The property test `R12.3` is the check on that claim. On any failure no `CardGrid` is returned (R12.4). A programming error (for example a negative array length) surfaces as an exception in tests rather than being hidden.

## Testing Strategy

### Rules for every test

- Property names start with the requirement criterion ID and state the requirement in plain words (R17.2). Example: `R5.4 decoding an encoded CardGrid returns the original CardGrid`.
- Properties run through `fc.assert` with no `try` or `catch`. A failure report must include the shrunk counterexample, the seed and the path (R17.6). Fixed regressions are kept with the `examples` option.
- Pure-function properties use `numRuns: 100` and fast-check's default random seed. Properties that render images use `numRuns: 25` and a pinned fast-check `seed` (R14.4, R17.4). The renderer's own seed is taken from the generated input, so the pixels are reproducible. These numbers are the baseline. Lowering them is a weakening and needs your agreement (see `testing.md`).
- Arbitraries come from `tests/support/profiles.ts` and take no hard-coded dimensions (R17.3).

### Test support (no new dependencies)

| File | Contents |
|---|---|
| `tests/support/png.ts` | `decodePng(bytes): PixelData` for the 8-bit greyscale, filter-0 PNGs the generator writes. Uses `node:zlib` only (R17.5). Throws on anything else. |
| `tests/support/profiles.ts` | `rowMajorEndOrder(rows, columns)`, `endOrderArbitrary`, `profileArbitrary` (valid profiles of 2 to 10 hook rows and 2 to 12 hook columns, pitches 2.5 to 4 mm, permuted end-order, two pegs in the side margins at least 1.5 mm from the card edge and the holes, at least 30% of the card width apart, diameters at least 20% away from the punched hole diameter and at least 15% apart), `cardGridArbitrary(profile)`, `endsArbitrary(profile)`, `mutateProfile(...)` helpers for the violation properties. |
| `tests/support/images.ts` | `greyToPixelData`, `padPixelData`, `renderCardPixels(profile, card, options)` (calls `renderCard` from `scripts/make_fixtures.ts`), `disc map` builders for analytic dark maps. |

### Fixture and structural tests (not properties)

- `tests/reader/accuracy.test.ts` (R13): loads each fixture's ground-truth JSON, loads `public/profiles/<profile>.json`, decodes the PNG, runs `readCard`, and compares the grid with `card`. It requires 100% for `pick0-clean`, `pick1-clean`, `pick2-clean` and `pick0-tilted`, and at least 95% for `pick0-noisy` and `pick0-noisy-tilted`. On failure the message states the fixture, the measured accuracy and the mismatched `(hookRow, hookColumn)` positions (R13.5). The same file checks the estimated tilt against `options.tiltDegrees` within 0.5 degrees (R9.6) and the scale against `options.pixelsPerMm` within 1% (R9.4).
- `tests/reader/readCard.test.ts` also holds the example test for R18.4 and R18.8: the profile has peg diameters 2.5 and 2.8 mm (a 10.7% difference), the test first asserts `validateCardProfile(profile)` is empty, renders it with a pinned seed at a low `pixelsPerMm`, and expects `ambiguous-orientation`. The scale is fixed during implementation by running the generator and recording the highest scale at which the pegs are still found but cannot be told apart. The test does not use an invalid profile.
- `tests/reader/benchmark.test.ts` (R16.2): renders a card, pads it to 1920 x 1080, times `readCard`, and prints the time. It fails only if the read itself fails, never on the time.
- `tests/structure/modules.test.ts`: import scan for R15.1 and R15.2, browser-API scan for R6.3, a scan for `any` for R15.5, and a check that no source in `src/codec` or `src/reader` names `demo-12x16` or imports from `public/` (a partial check for R14.2, because scanning for number literals would give false alarms; R14.3 is the real check).
- `tests/structure/propertyNames.test.ts`: every test that calls `fc.assert` has a title that starts with an ID like `R5.4` (R17.2), and every exported function in `src/codec` and `src/reader` other than `loadPixelData` is named in a test file that calls `fc.assert` (R17.1).
- `tests/structure/dependencies.test.ts`: `package.json` `dependencies` holds only `react` and `react-dom` (R6.5, R16.3).

### Accuracy risk and what happens if a target is missed

Measured with a throwaway script on the existing fixtures: the threshold lands at 131 to 142, speckle on the noisy images is removed by the 4 px minimum area, and the pegs measure within about 0.6 px of their true size. The sampling disc holds about 40 pixels, and a false "punched" needs more than 20 of them to be dark, which should not happen at the noise level in the fixtures. These are estimates. The first implementation will measure the real accuracy. If `pick0-noisy-tilted` comes in under 95%, I will report the counterexample and the cause. I will not lower the target or edit the fixture. Options at that point would be tuning `SAMPLING_RADIUS_FRACTION`, or, with your approval, changing R8 to allow a local threshold, because shading across the image is the likeliest cause.

## Requirement map

| Requirement | Functions and files | Tests |
|---|---|---|
| R1 End-order mapping | `types.ts` (`endOrder`), `validateCardProfile`, `encodeCardGrid`, `decodeEnds` | `validateCardProfile.test.ts`, `endsCodec.test.ts` |
| R2 Validate a CardProfile | `validateCardProfile`, `parseCardProfile` | `validateCardProfile.test.ts` |
| R3 Validate a CardGrid | `validateCardGrid` | `validateCardGrid.test.ts` |
| R4 Encode | `encodeCardGrid`, `endsPerPick` | `endsCodec.test.ts` |
| R5 Decode | `decodeEnds` | `endsCodec.test.ts` |
| R6 Pixel data | `isPixelData`, `loadPixelData`, `readCard` | `pixelData.test.ts`, `canvasSource.test.ts`, `readCard.test.ts`, `modules.test.ts`, `dependencies.test.ts` |
| R7 Greyscale | `toGreyscale` | `greyscale.test.ts` |
| R8 Threshold | `chooseThreshold`, `classifyDark` | `threshold.test.ts` |
| R9 Find the card | `findDarkRegions`, `equivalentDiameterPx`, `findPegHolePair`, `poseFromPegHoles` | `regions.test.ts`, `pegHoles.test.ts`, `readCard.test.ts`, `accuracy.test.ts` |
| R10 Tilt and hook positions | `cardToImage`, `samplingRadiusPx`, `sampleCardGrid` | `pose.test.ts`, `sampling.test.ts`, `readCard.test.ts` |
| R11 Punched or not | `decidePunched`, `sampleCardGrid` | `sampling.test.ts`, `readCard.test.ts` |
| R12 Failures | `readCard`, `ReadFailure` | `readCard.test.ts` |
| R13 Accuracy | `readCard` on `tests/fixtures/` | `accuracy.test.ts` |
| R14 Profile is an input | every function takes `profile`; no card literals | `readCard.test.ts` (R14.3), `modules.test.ts` |
| R15 Boundaries and naming | file layout above | `modules.test.ts` |
| R16 Performance | single-pass typed-array loops | `benchmark.test.ts`, `dependencies.test.ts` |
| R17 Testing | `tests/support/*` | `propertyNames.test.ts` |
| R18 Upside-down card | `orientationSeparation`, `decideOrientation`, `poseFromPegHoles`, `angleDifferenceDegrees` | `orientation.test.ts`, `pose.test.ts`, `readCard.test.ts`, `accuracy.test.ts` |
| R19 Generator follows the profile | `scripts/make_fixtures.ts`, demo profile, `card-geometry.md` | `tests/scripts/make_fixtures.test.ts` |

### Criteria checked without a property of their own

| Criterion | How it is checked |
|---|---|
| R13.2 `pick0-tilted` at 100% | `accuracy.test.ts`, one example test per fixture. |
| R13.6 targets and fixtures not changed to pass | Process rule from `testing.md`. R19.6 makes a fixture edit visible, because regenerated bytes must match the committed files. |
| R14.1 profile is a parameter of every layout-dependent function | The signatures above. Every reader and codec function that uses layout takes `profile: CardProfile`. Checked by `tsc` and code review. |
| R15.3 types in each module's `types.ts` | The file layout above. Checked by code review. |
| R15.4 glossary terms | Code review against `weaving-glossary.md`. `modules.test.ts` also fails if `src/codec` or `src/reader` uses the words `pegHole` or `peg hole` outside `pegHoles.ts`, `orientation.ts`, `pose.ts`, `readCard.ts`, `types.ts` and `validateCardProfile.ts`. |
| R16.1 300 ms on a mid-range 2020 phone | Manual. Run the benchmark build on a device and record the time. Node timing is informational (R16.2). |
| R17.7 clean, noisy, tilted, noisy and tilted covered | `accuracy.test.ts` reads one fixture of each condition. |
| R17.8 no weakening without telling you | Process rule from `testing.md`. The baseline `numRuns` and seeds are stated in "Testing Strategy". |
| R19.3 generator has no demo literals and renders any valid profile | Property 80 and Property 81 render profiles from `profileArbitrary`, which differ from the demo profile in every listed field. |

## Correctness Properties

Each entry is a fast-check property. Properties are numbered only for reference in this document. The test title is the heading text after `Property N:`, without the final full stop, and it starts with the requirement ID. "For any" lists the generators. All use `numRuns: 100` and a random seed, except those described as "Image property", which use `numRuns: 25` and a pinned seed.

### Property 1: R1.1 a profile whose end-order assigns every hook position exactly one end index is accepted.

Test file: `tests/codec/validateCardProfile.test.ts`. For any profile from `profileArbitrary`, `validateCardProfile` returns `[]`.

**Validates: Requirements 1.1**

### Property 2: R1.4 a profile with no end-order mapping is reported invalid and given no default order.

Test file: `tests/codec/validateCardProfile.test.ts`. For any valid profile with `endOrder` deleted, a `missing-field` violation at `endOrder` is returned and `parseCardProfile` is not `ok`.

**Validates: Requirements 1.4**

### Property 3: R2.1 a profile is accepted exactly when validation reports no violations.

Test file: `tests/codec/validateCardProfile.test.ts`. For any valid or mutated profile, `parseCardProfile(x).ok` equals `validateCardProfile(x).length === 0`.

**Validates: Requirements 2.1**

### Property 4: R2.2 a hookRows or hookColumns that is not a positive integer is reported by field name.

Test file: `tests/codec/validateCardProfile.test.ts`. For any valid profile and any value from `fc.oneof(fc.integer({max: 0}), fc.double(), fc.string())` that is not a positive integer.

**Validates: Requirements 2.2**

### Property 5: R2.3 a card size, pitch or diameter that is not a positive finite number is reported by field name.

Test file: `tests/codec/validateCardProfile.test.ts`. Over the nine numeric fields and values `0`, negatives, `NaN`, `Infinity`.

**Validates: Requirements 2.3**

### Property 6: R2.4 a hole that would extend outside the card is reported with its hook position.

Test file: `tests/codec/validateCardProfile.test.ts`. For any valid profile with the first hole centre moved or the card shrunk.

**Validates: Requirements 2.4**

### Property 7: R2.5 an end-order that repeats, omits or exceeds an end index is reported.

Test file: `tests/codec/validateCardProfile.test.ts`. For any valid profile with one cell overwritten by a duplicate, an out-of-range value, or an end index removed.

**Validates: Requirements 2.5**

### Property 8: R2.6 a peg hole without its own position or diameter is reported.

Test file: `tests/codec/validateCardProfile.test.ts`. For any valid profile with a peg field removed.

**Validates: Requirements 2.6**

### Property 9: R2.7 a profile without exactly two distinct peg holes is reported.

Test file: `tests/codec/validateCardProfile.test.ts`. For any valid profile with 0, 1 or 3 peg holes, or both pegs at the same position.

**Validates: Requirements 2.7**

### Property 10: R2.8 peg hole diameters that differ by less than 10% of the larger are reported.

Test file: `tests/codec/validateCardProfile.test.ts`. For any larger diameter and any ratio from 0.905 to 1.0 (equal included).

**Validates: Requirements 2.8**

### Property 11: R2.8 peg hole diameters that differ by at least 11% of the larger are accepted.

Test file: `tests/codec/validateCardProfile.test.ts`. For any larger diameter and any ratio from 0.5 to 0.89, with the profile otherwise valid. An example test covers exactly 10% (2.7 and 3.0 mm), which is accepted.

**Validates: Requirements 2.8**

### Property 12: R2.9 validating any value never throws and a non-profile is reported.

Test file: `tests/codec/validateCardProfile.test.ts`. For any value from `fc.anything()`, validation returns a non-empty list of violations.

**Validates: Requirements 2.9**

### Property 13: R3.1 a grid with hookRows rows of hookColumns booleans is accepted.

Test file: `tests/codec/validateCardGrid.test.ts`. For any valid profile and `cardGridArbitrary(profile)`.

**Validates: Requirements 3.1**

### Property 14: R3.2 a wrong number of hook rows is reported with expected and actual counts.

Test file: `tests/codec/validateCardGrid.test.ts`. For any grid with rows added or removed.

**Validates: Requirements 3.2**

### Property 15: R3.3 a hook row of the wrong length is reported with its hookRow index and both lengths.

Test file: `tests/codec/validateCardGrid.test.ts`. For any grid with one row lengthened or shortened.

**Validates: Requirements 3.3**

### Property 16: R3.4 a value that is not a boolean is reported at its hook position.

Test file: `tests/codec/validateCardGrid.test.ts`. For any grid with one cell replaced by a non-boolean.

**Validates: Requirements 3.4**

### Property 17: R3.5 every violation is reported, not only the first.

Test file: `tests/codec/validateCardGrid.test.ts`. For any grid with `k` rows of the wrong length, exactly `k` `wrong-hook-column-count` violations are returned.

**Validates: Requirements 3.5**

### Property 18: R3.6 any value that is not a grid is reported without throwing.

Test file: `tests/codec/validateCardGrid.test.ts`. For any value from `fc.anything()` that is not a valid grid.

**Validates: Requirements 3.6**

### Property 19: R1.2 encoding follows the profile's end-order and never assumes row-major order.

Test file: `tests/codec/endsCodec.test.ts`. For any profile with a random permutation as `endOrder` and any grid, `ends[endOrder[r][c]]` equals `grid[r][c]` at every position.

**Validates: Requirements 1.2**

### Property 20: R4.1 an encoded CardGrid has one end per hook position, placed at the end index the profile assigns.

Test file: `tests/codec/endsCodec.test.ts`. The length equals `endsPerPick(profile)`.

**Validates: Requirements 4.1**

### Property 21: R4.2 encoding keeps the number of punched holes.

Test file: `tests/codec/endsCodec.test.ts`. The count of `true` in the ends list equals the count in the grid.

**Validates: Requirements 4.2**

### Property 22: R4.3 encoding an invalid grid fails with the validation violations and returns no ends.

Test file: `tests/codec/endsCodec.test.ts`. The violations equal `validateCardGrid`'s.

**Validates: Requirements 4.3**

### Property 23: R4.4 encoding does not change its inputs and gives the same output every time.

Test file: `tests/codec/endsCodec.test.ts`. Deep-equal to a clone before and after, and equal across two calls.

**Validates: Requirements 4.4**

### Property 24: R5.1 decoding places each end at the hook position the profile assigns.

Test file: `tests/codec/endsCodec.test.ts`. For any profile from `profileArbitrary` (with a permuted `endOrder`) and any `endsArbitrary(profile)`, `decodeEnds` succeeds and `grid[r][c]` equals `ends[endOrder[r][c]]` at every hook position.

**Validates: Requirements 5.1**

### Property 25: R5.2 an ends list of the wrong length is rejected with expected and actual lengths.

Test file: `tests/codec/endsCodec.test.ts`. For any valid profile and any boolean list whose length differs from `endsPerPick(profile)` (including empty), the result is not `ok` and holds one `wrong-ends-length` violation with `expected` equal to `endsPerPick(profile)` and `actual` equal to the list length.

**Validates: Requirements 5.2**

### Property 26: R5.3 a non-boolean end is rejected with its end index.

Test file: `tests/codec/endsCodec.test.ts`. For any valid profile, any `endsArbitrary(profile)`, any end index and any non-boolean value (from `fc.anything()` filtered to non-booleans), replacing that end with the value gives a `not-a-boolean` violation located at `ends[<endIndex>]`, and no grid.

**Validates: Requirements 5.3**

### Property 27: R5.4 decoding an encoded CardGrid returns the original CardGrid.

Test file: `tests/codec/endsCodec.test.ts`. For any profile and grid.

**Validates: Requirements 5.4**

### Property 28: R5.5 encoding a decoded ends list returns the original ends list.

Test file: `tests/codec/endsCodec.test.ts`. For any profile and `endsArbitrary(profile)`.

**Validates: Requirements 5.5**

### Property 29: R5.6 a decoded CardGrid passes grid validation.

Test file: `tests/codec/endsCodec.test.ts`. For any valid profile and any `endsArbitrary(profile)`, `validateCardGrid(profile, decoded)` returns `[]`.

**Validates: Requirements 5.6**

### Property 30: R5.7 decoding does not change its inputs and gives the same output every time.

Test file: `tests/codec/endsCodec.test.ts`. For any valid profile and any `endsArbitrary(profile)`, the profile and the ends list are deep-equal to clones taken before the call, and two calls give deep-equal results.

**Validates: Requirements 5.7**

### Property 31: R6.1 pixel data with a positive integer size and an RGBA array of matching length is accepted.

Test file: `tests/reader/pixelData.test.ts`. For any width and height from 1 to 64 and random bytes.

**Validates: Requirements 6.1**

### Property 32: R6.4 pixel data with a wrong size or length is rejected, for any value, without throwing.

Test file: `tests/reader/pixelData.test.ts`. For any value from `fc.anything()` and for any valid pixel data with the array length changed by a non-zero amount or a width or height of 0, negative, or fractional.

**Validates: Requirements 6.4**

### Property 33: R6.2 converting an image source returns its width, height and bytes using only drawImage and getImageData.

Test file: `tests/reader/canvasSource.test.ts`. For any size and bytes, through a fake canvas that records every call. The only calls are one `drawImage` and one `getImageData(0, 0, width, height)`.

**Validates: Requirements 6.2**

### Property 34: R7.1 greyscale has one level per pixel.

Test file: `tests/reader/greyscale.test.ts`. For any pixel data.

**Validates: Requirements 7.1**

### Property 35: R7.2 alpha does not change the greyscale level.

Test file: `tests/reader/greyscale.test.ts`. For any pixel data with the alpha bytes replaced by other values.

**Validates: Requirements 7.2**

### Property 36: R7.3 equal red, green and blue give that value.

Test file: `tests/reader/greyscale.test.ts`. For any value 0 to 255.

**Validates: Requirements 7.3**

### Property 37: R7.4 raising a colour channel never lowers the grey level.

Test file: `tests/reader/greyscale.test.ts`. For any pixel and any channel increase.

**Validates: Requirements 7.4**

### Property 38: R7.5 greyscale does not change its input and gives the same output every time.

Test file: `tests/reader/greyscale.test.ts`. For any pixel data from 0 x 0 to 64 x 64, the input bytes are equal to a copy taken before the call, and two calls give equal `levels`.

**Validates: Requirements 7.5**

### Property 39: R8.1 the threshold depends only on the histogram.

Test file: `tests/reader/threshold.test.ts`. For any grey image, shuffling its pixels gives the same threshold.

**Validates: Requirements 8.1**

### Property 40: R8.2 a pixel is dark exactly when its level is below the threshold.

Test file: `tests/reader/threshold.test.ts`. For any grey image and any threshold 0 to 255. The output holds only 0 and 1.

**Validates: Requirements 8.2**

### Property 41: R8.3 shifting every level by a constant without clipping keeps the dark and light classification.

Test file: `tests/reader/threshold.test.ts`. For any grey image with levels in `[lo, hi]` and any shift that keeps them in 0 to 255, the dark maps are equal.

**Validates: Requirements 8.3**

### Property 42: R8.4 any image has a threshold from 0 to 255, and an image with one grey level has no dark pixel.

Test file: `tests/reader/threshold.test.ts`. For any size from 0 x 0 to 64 x 64 and any single level.

**Validates: Requirements 8.4**

### Property 43: R8.5 thresholding does not change its input and gives the same output every time.

Test file: `tests/reader/threshold.test.ts`. For any grey image from 0 x 0 to 64 x 64, `chooseThreshold` and `classifyDark` leave `levels` equal to a copy taken before the call, and two calls give the same threshold and equal dark maps.

**Validates: Requirements 8.5**

### Property 44: R9.1 dark regions are the 4-connected components of the dark pixels.

Test file: `tests/reader/regions.test.ts`. For any random dark map, region count, areas, and pixel membership equal those of an independent union-find labelling written in the test.

**Validates: Requirements 9.1**

### Property 45: R9.1 a region is flagged as touching the edge exactly when it holds a pixel on the image edge.

Test file: `tests/reader/regions.test.ts`. For any random dark map.

**Validates: Requirements 9.1**

### Property 46: R9.2 the equivalent diameter of a filled disc matches its true diameter within 5%.

Test file: `tests/reader/regions.test.ts`. For any disc of diameter 6 to 40 px at any sub-pixel position inside the image.

**Validates: Requirements 9.2**

### Property 47: R18.1 swapping the two measured diameters swaps upright and upside-down.

Test file: `tests/reader/orientation.test.ts`. For any expected pair with a gap and any measured pair, `separation` changes sign exactly.

**Validates: Requirements 18.1**

### Property 48: R18.2 measured diameters equal to the expected ones are read as upright.

Test file: `tests/reader/orientation.test.ts`. For any expected pair `[e0, e1]` with `e0`, `e1` from 2 to 200 px and differing by at least 10% of the larger, `decideOrientation(e, e)` returns `upright` with separation exactly 1.

**Validates: Requirements 18.2**

### Property 49: R18.3 measured diameters equal to the expected ones, swapped, are read as upside-down.

Test file: `tests/reader/orientation.test.ts`. For the same expected pairs, `decideOrientation(e, [e1, e0])` returns `upside-down` with separation exactly -1.

**Validates: Requirements 18.3**

### Property 50: R18.4 two equal measured diameters are ambiguous.

Test file: `tests/reader/orientation.test.ts`. For any expected pair and any measured value used twice, separation is 0 and the kind is `ambiguous`.

**Validates: Requirements 18.4**

### Property 51: R18.5 measurement errors within a quarter of the diameter gap never change the decision.

Test file: `tests/reader/orientation.test.ts`. For any expected pair, either true orientation, and any errors with each magnitude at most `|e0 - e1| / 4`.

**Validates: Requirements 18.5**

### Property 52: R18.6 multiplying every diameter by the same factor does not change the separation or the decision.

Test file: `tests/reader/orientation.test.ts`. For any pairs and factors that are powers of two (exact in floating point).

**Validates: Requirements 18.6**

### Property 53: R18.6 the separation always lies between -1 and 1.

Test file: `tests/reader/orientation.test.ts`. For any non-negative pairs.

**Validates: Requirements 18.6**

### Property 54: R9.2 peg holes are found at any scale, tilt and position.

Test file: `tests/reader/pegHoles.test.ts`. Uses analytic `DarkRegion` lists built from a pose, with no image. For any valid profile, pixel scale 2 to 20, tilt within 10 degrees of 0 or 180, and card position, with regions for both pegs placed by that pose (centroid, area from `pi * (s * d / 2)^2` rounded), the pair is found.

**Validates: Requirements 9.2**

### Property 55: R9.3 punched holes and lacing holes are not mistaken for peg holes.

Test file: `tests/reader/pegHoles.test.ts`. Uses analytic `DarkRegion` lists built from a pose, with no image. Same setup with a region for every hook position and every lacing hole added, plus small speckle regions.

**Validates: Requirements 9.3**

### Property 56: R9.4 the pose recovered from the peg hole pair equals the pose that placed them.

Test file: `tests/reader/pegHoles.test.ts`. Uses analytic `DarkRegion` lists built from a pose, with no image. Tilt within 1e-6 degrees (compared modulo 360), scale within 1e-9 relative, origin within 1e-6 px, for both orientations.

**Validates: Requirements 9.4**

### Property 57: R9.7 regions that do not fit the peg holes give no pair.

Test file: `tests/reader/pegHoles.test.ts`. Uses analytic `DarkRegion` lists built from a pose, with no image. For any list of regions whose diameters are 40% or more away from every expected peg diameter, or with fewer than two regions, the result is `null`.

**Validates: Requirements 9.7**

### Property 58: R10.1 mapping card points to the image keeps distances in proportion to the scale.

Test file: `tests/reader/pose.test.ts`. For any pose and two card points, the image distance equals `s` times the millimetre distance.

**Validates: Requirements 10.1**

### Property 59: R18.7 normalised angles lie in (-180, 180] and differ from the input by a multiple of 360.

Test file: `tests/reader/pose.test.ts`. For any finite angle.

**Validates: Requirements 18.7**

### Property 60: R18.7 angle differences are symmetric, between 0 and 180, and unchanged by adding a multiple of 360 to either angle.

Test file: `tests/reader/pose.test.ts`. For any finite angles `a`, `b` and any integers `k`, `m` from -10 to 10, `angleDifferenceDegrees(a, b)` equals `angleDifferenceDegrees(b, a)`, lies in `[0, 180]`, and equals `angleDifferenceDegrees(a + 360k, b + 360m)` within 1e-9 degrees.

**Validates: Requirements 18.7**

### Property 61: R10.3 the sampling radius never exceeds the hole radius in pixels and is positive.

Test file: `tests/reader/sampling.test.ts`. For any valid profile and pose.

**Validates: Requirements 10.3**

### Property 62: R10.4 a card that leaves the image is refused and no pixel outside the image is read.

Test file: `tests/reader/sampling.test.ts`. For any profile, pose and image size, the dark map's array is wrapped in a recording proxy. Either the result is `null` with no reads, or every recorded index is inside `0 .. width*height - 1` and, for each read, the column is in `0 .. width - 1`.

**Validates: Requirements 10.4**

### Property 63: R11.1 a hook position is punched exactly when more than half of its sampling pixels are dark.

Test file: `tests/reader/sampling.test.ts`. For any `darkCount <= sampleCount`, including exactly half, which is not punched.

**Validates: Requirements 11.1**

### Property 64: R11.1 dark discs drawn at punched hook positions are read back as the same CardGrid.

Test file: `tests/reader/sampling.test.ts`. For any profile, grid and pose with the card inside the image, an analytic dark map is drawn from the pose and the profile (a disc of the hole diameter per punched position) and `sampleCardGrid` returns the grid.

**Validates: Requirements 11.1**

### Property 65: R11.2 sampling returns hookRows rows of hookColumns booleans that pass grid validation.

Test file: `tests/reader/sampling.test.ts`. For any valid profile, any pose that keeps the card inside the image, and any dark map of that image size, `sampleCardGrid` returns a grid of `hookRows` rows of `hookColumns` booleans, and `validateCardGrid` returns `[]` for it.

**Validates: Requirements 11.2**

### Property 66: R6.6 padding the image with extra background does not change the read CardGrid.

Test file: `tests/reader/readCard.test.ts`. Image property. Any profile, grid, and padding of 0 to 60 px on each side.

**Validates: Requirements 6.6**

### Property 67: R6.6 the CardGrid is read at any pixel scale from 5 to 12 pixels per millimetre.

Test file: `tests/reader/readCard.test.ts`. Image property. Any profile, grid, and scale from 5 to 12 pixels per millimetre, tilt 0.

**Validates: Requirements 6.6**

### Property 68: R9.5 a card tilted by up to 10 degrees from upright is found and read.

Test file: `tests/reader/readCard.test.ts`. Image property. Any profile, grid, and tilt in `[-10, 10]`. The read grid equals the rendered grid.

**Validates: Requirements 9.5**

### Property 69: R9.7 an image with no peg holes fails with peg-holes-not-found and no grid.

Test file: `tests/reader/readCard.test.ts`. Any uniform image or random-noise image of 16 to 64 px per side, with a valid profile.

**Validates: Requirements 9.7**

### Property 70: R10.2 a tilted card reads the same CardGrid as the same card untilted.

Test file: `tests/reader/readCard.test.ts`. Image property. Any profile, grid, and tilt in `[-10, 10]`.

**Validates: Requirements 10.2**

### Property 71: R11.3 a card with no punched holes is read as all false although its peg and lacing holes are dark.

Test file: `tests/reader/readCard.test.ts`. Image property. Any profile and tilt in `[-10, 10]`, with an all-false grid.

**Validates: Requirements 11.3**

### Property 72: R11.4 reading does not change the pixel data and gives the same result every time.

Test file: `tests/reader/readCard.test.ts`. Image property. Any profile and grid. The pixel bytes are compared with a copy after the read, and two reads give deep-equal results.

**Validates: Requirements 11.4**

### Property 73: R12.1 every result is a success with a grid and a pose, or a failure with one of the five reasons.

Test file: `tests/reader/readCard.test.ts`. Random small images (including random bytes) with a valid profile.

**Validates: Requirements 12.1**

### Property 74: R12.2 an invalid profile fails with invalid-profile and the violations of validateCardProfile.

Test file: `tests/reader/readCard.test.ts`. Any mutated profile.

**Validates: Requirements 12.2**

### Property 75: R12.3 any profile value and any pixel data never throws.

Test file: `tests/reader/readCard.test.ts`. Any `fc.anything()` for both arguments, and valid profiles with pixel data of any size from 0 to 64 and any array length.

**Validates: Requirements 12.3**

### Property 76: R12.4 a failure never carries a CardGrid.

Test file: `tests/reader/readCard.test.ts`. For the inputs of Properties 73 to 75, every result with `ok: false` has no `grid` field.

**Validates: Requirements 12.4**

### Property 77: R14.3 a profile that differs from the demo profile is read with 100% accuracy on a clean render.

Test file: `tests/reader/readCard.test.ts`. Image property. Any `profileArbitrary` profile, any grid, tilt 0.

**Validates: Requirements 14.3**

### Property 78: R18.3 a card rotated by 180 degrees, plus or minus 10, is read as the same CardGrid as the card upright, with orientation upside-down.

Test file: `tests/reader/readCard.test.ts`. Image property. Any profile, grid, and tilt in `[170, 190]`. The pose reports `upside-down` and a tilt within 0.5 degrees of the rendered tilt, compared modulo 360.

**Validates: Requirements 18.3**

### Property 79: R18.5 a CardGrid is never returned from a card read the wrong way up.

Test file: `tests/reader/readCard.test.ts`. Image property. Any profile, grid, tilt in `[-10, 10]` or `[170, 190]` and scale 2 to 10 pixels per millimetre. Either the result is the true grid, or it is a failure. It is never a different grid. This also covers the low-scale case in R18.8.

**Validates: Requirements 18.5**

### Property 80: R19.1 each peg hole is drawn at the position and diameter the profile gives.

Test file: `tests/scripts/make_fixtures.test.ts`. Image property. Any `profileArbitrary` profile. Dark at each peg centre, light just outside each peg's radius, and the dark disc area within 5% of `pi * (s * d / 2)^2`.

**Validates: Requirements 19.1**

### Property 81: R19.2 the ground-truth ends list follows the profile's end-order.

Test file: `tests/scripts/make_fixtures.test.ts`. Any profile and grid. `ends[endOrder[r][c]]` equals `card[r][c]`, checked directly and not through the codec.

**Validates: Requirements 19.2**

### Fixture tests (examples, not properties)

These tests check fixed files, so they are example tests and not fast-check properties.

- `tests/scripts/make_fixtures.test.ts`: the three existing example tests stay and are updated for the new profile fields only (same seed gives identical PNG bytes, a different seed gives different bytes, punched holes are dark on a clean render of one card).
- `R19.4` the demo profile is valid, has peg diameters at least 10% apart, an explicit row-major end-order and its ILLUSTRATIVE marker.
- `R19.5` the Layout table in `card-geometry.md` states the demo profile's peg positions and diameters.
- `R19.6` regenerating the fixtures in memory gives exactly the bytes of the files in `tests/fixtures/`, over `FIXTURE_SET`.
- `tests/reader/accuracy.test.ts`: `R13.1` to `R13.3` accuracy per fixture, `R9.6` tilt within 0.5 degrees of `options.tiltDegrees` (compared modulo 360), `R9.4` scale within 1% of `options.pixelsPerMm`. The accuracy tests report mismatches as described above.

## Decisions

Settled in your design review:

1. **`pixelsPerMm` generator option.** Added to requirements as R19.8.
2. **`.ts` extensions in `src/codec` imports.** Kept, so the generator can import the codec under plain Node without a `tsx` dependency.
3. **Peg diameter limitation.** Peg detection relies on peg diameters differing from the punched hole diameter. Validation does not enforce it. It is documented here and in `card-geometry.md`, and test profiles stay away from it.
4. **Exact 10% boundary.** Accepted (R2.8). The comparison allows for floating-point error.
5. **R18.8 pixel scale.** Chosen during implementation by measurement, and recorded in the test.

Still true: the tilt search window is 15 degrees, with only 10 required and tested, and the noisy accuracy targets are estimates until the first implementation measures them (see "Accuracy risk").
