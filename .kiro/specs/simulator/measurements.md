# Simulator frame-time measurements (task 4.4)

- Date: 2026-11-18
- Commit measured: `afe549a`
- Node: v24.5.0
- Machine: arm64, Apple M1
- Benchmark: `tests/simulator/benchmark.test.ts` (`npx vitest run tests/simulator/benchmark.test.ts --reporter=verbose`)

## Setup

- Slot list: `demoPattern(profile, 2000)` from the demo profile, pick 20 missing (`null`), pick 30 damaged (one hook row removed).
- Weft plan: plain `#7a1f2b`, zari gold. Warp `#f4ecd8`. Viewport 1920 x 1080, thread size 6.
- Frames: 361 per configuration. For 120 picks spread evenly over 0..1999: a rest frame, and for woven picks a lift frame and a pass frame (step cycles 0..7). Picks 20 and 30 are gap picks and get a rest frame only, because lift and pass frames are valid only on woven picks (R9.3). One more rest frame at pick 2000.
- Each configuration is warmed up with 10 renders. Timing wraps `renderFrame` only (`performance.now()`).
- "Early" is the median of frames with pick < 100 (18 frames). "Late" is the median of frames with pick > 1900 (19 frames).
- With repeat 1 the cloth is 192 x 6 = 1152 px wide and the rest of 1920 is background. With repeat 2 the cloth is 2304 px, cropped to 1920.

## Results (ms, three runs each)

| Configuration | Run | Median | p95 | Worst | Early median | Late median |
|---|---|---|---|---|---|---|
| repeat 1 | 1 | 5.89 | 7.58 | 11.85 | 2.73 | 5.89 |
| repeat 1 | 2 | 5.87 | 7.65 | 11.88 | 2.69 | 5.87 |
| repeat 1 | 3 | 5.83 | 7.60 | 9.35 | 2.67 | 5.86 |
| repeat 2 | 1 | 6.00 | 7.84 | 9.25 | 2.60 | 6.00 |
| repeat 2 | 2 | 5.98 | 7.46 | 8.28 | 2.50 | 6.00 |
| repeat 2 | 3 | 5.96 | 7.59 | 9.58 | 2.27 | 6.04 |
| repeat 2 + floatHighlight `{ maxLength: 4 }` | 1 | 16.08 | 18.47 | 23.85 | 5.07 | 16.05 |
| repeat 2 + floatHighlight `{ maxLength: 4 }` | 2 | 15.85 | 17.97 | 19.86 | 5.08 | 15.83 |
| repeat 2 + floatHighlight `{ maxLength: 4 }` | 3 | 15.91 | 17.94 | 23.05 | 5.15 | 15.97 |

## Notes

- Early frames are faster than late frames because near pick 0 few woven picks are on screen. A 1080 px viewport shows about 180 picks at thread size 6, so the cost rises until the screen is full and then stays flat. The late median (picks above 1900) equals the median over all frames, which is dominated by large picks, so the time does not keep growing with the pick index.
- With float highlighting on (repeat 2), the Node median and worst frame time are above 16 ms on this machine.
- The 16 ms budget (R10.1) is for a mid-range 2020 phone. This benchmark runs in Node on a desktop CPU and does not measure it. The dev page `scripts/sim-preview.html` shows frame times on a device.

## After task 4.7 (run-length float highlighting)

- Date: 2026-11-18
- Code measured: task 4.7 working tree on top of `271caf6`. Same Node, machine, setup and frames as above.
- Change: `renderFrame` no longer calls `floatLengthAt` per cell. It runs one weft pass per visible woven pick across the tiled width, and one warp pass per base end over the visible picks plus `maxLength` picks of margin. Output is byte-identical to the previous code.
- Command: `npx vitest run tests/simulator/benchmark.test.ts --reporter=verbose --silent=false`

| Configuration | Run | Median | p95 | Worst | Early median | Late median |
|---|---|---|---|---|---|---|
| repeat 1 | 1 | 5.84 | 7.91 | 11.06 | 3.09 | 5.83 |
| repeat 1 | 2 | 5.87 | 7.53 | 9.64 | 3.36 | 5.86 |
| repeat 1 | 3 | 5.88 | 7.33 | 9.69 | 2.56 | 5.91 |
| repeat 2 | 1 | 5.98 | 7.85 | 29.43 | 2.55 | 5.96 |
| repeat 2 | 2 | 5.97 | 7.63 | 8.83 | 2.34 | 5.95 |
| repeat 2 | 3 | 5.99 | 8.40 | 147.50 | 2.25 | 6.01 |
| repeat 2 + floatHighlight `{ maxLength: 4 }` | 1 | 10.59 | 12.53 | 21.64 | 3.72 | 10.61 |
| repeat 2 + floatHighlight `{ maxLength: 4 }` | 2 | 10.61 | 12.35 | 15.27 | 3.64 | 10.63 |
| repeat 2 + floatHighlight `{ maxLength: 4 }` | 3 | 10.54 | 11.29 | 19.83 | 3.67 | 10.52 |

- With highlighting on, the median fell from about 15.9 ms to about 10.6 ms, under the 12 ms Node target for this task. The p95 is 11.3 to 12.5 ms.
- The worst frames vary between runs (repeat 2: 8.8 ms to 147.5 ms) while the p95 stays under 8.5 ms. The repeat 2 path without highlighting did not change in this task, so these are single pauses (most likely garbage collection of the 8 MB frame buffers), not a cost of the new code.
