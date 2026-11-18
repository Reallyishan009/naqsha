# Naqsha — Weaving Glossary Steering

This glossary defines domain terms as used in this codebase. **Use these exact terms in all variable names, function names, type names, and comments.** Do not substitute synonyms (e.g. use `weft` not `horizontal thread`, `warp` not `vertical thread`).

## Terms

| Term | Definition |
|---|---|
| **warp** | The set of longitudinal threads held under tension on the loom, running along the length of the cloth; indexed by *end* number. |
| **weft** | The transverse thread inserted across the warp during each *pick*; runs along the width of the cloth. |
| **pick** | One pass of the weft across the warp; a single row in the weave matrix. |
| **end** | One individual warp thread; identified by its position (column index) in the weave grid. |
| **hook** | The mechanical element on a Jacquard head that is either raised or lowered by a *peg hole* reading; one hook controls one *end*. |
| **harness** | The assembly of hooks, needles, and cords linking the Jacquard head to the warp threads. |
| **card** | One physical punch card encoding a single *pick*; a rectangular card with *peg holes* in fixed grid positions. |
| **card chain** | The ordered sequence of *cards* laced together to encode a full weave *repeat*. |
| **lacing** | The physical joining of *cards* end-to-end to form a *card chain*; also the cord used for that joining. |
| **peg hole** | A punched hole in a *card*; its presence (1) raises the corresponding *hook*, its absence (0) leaves it down. |
| **lift** | The act of raising a subset of *warp* ends for one *pick*; determined by which *hooks* are activated. |
| **face** | The side of the cloth intended to be visible; determines which thread (warp or weft) appears on top at each intersection. |
| **float** | A warp or weft thread that passes over two or more consecutive threads on the opposite axis without interlacing. |
| **repeat** | The smallest rectangular unit of the weave pattern that tiles to produce the full cloth design; measured in ends × picks. |
| **naksha** | The weave pattern or design itself; the arrangement of lifts across a full *repeat* (Urdu/Hindi: नक्शा). |
| **naqshband** | The craftsperson who reads a design and translates it into a *card chain* by punching the *peg holes* (Urdu: नक्शबंद). |
| **zari** | Metallic thread (gold or silver) used as weft in certain picks; represented in the simulator as a distinct thread type. |

## Naming Rule

Every identifier and comment in this codebase that refers to one of the above concepts **must** use the exact term from this glossary.

Correct:
```ts
function countFloats(pattern: WeavePattern): number
const pickIndex: number
type PegHole = 0 | 1
```

Incorrect:
```ts
function countOverlaps(pattern: WeavePattern): number  // "overlaps" not a glossary term
const rowIndex: number                                 // use pickIndex
type HoleValue = 0 | 1                                 // use PegHole
```

When a concept does not appear in this glossary, choose the most precise plain-English name and add it to this document.
