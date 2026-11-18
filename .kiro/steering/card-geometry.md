---
inclusion: fileMatch
fileMatchPattern: "src/{codec,reader}/**"
---

# Naqsha — Card Geometry Steering

Applies when working in `src/codec` and `src/reader`.

## Rules

1. **One card is one pick.** The hole grid on a card is the set of hook positions for that single pick, so every hole position is an end. A card has `hookRows` x `hookColumns` positions, so there are `hookRows * hookColumns` ends per pick.
2. **A punched hole means the hook lifts.** A punched position is `true` in a card grid, and the matching end is lifted for that pick. An unpunched position is `false`, and the end stays down.
3. **A pattern is a list of cards, one per pick.** Each card is a grid of booleans (`hookRows` x `hookColumns`), `true` = punched.
4. **The card layout is a configurable profile, never hard-coded.** Looms differ, so the layout lives in a data file that is loaded at runtime (the demo profile is `public/profiles/demo-12x16.json`). All code in `src/codec` and `src/reader` must take the profile as an input parameter. Do not write card dimensions, hole counts, pitches, or hole positions as literals or module-level constants in that code.
5. Positions in a profile are in millimetres, measured from the top-left corner of the card. Within a card, hook row 0 is the top row and hook column 0 is the left column. The end index within a pick is `hookRow * hookColumns + hookColumn`.

## Layout

> **Every value below is ILLUSTRATIVE, UNVERIFIED, replace with measured values.** No real card has been measured yet. These numbers describe a small demo profile (12 hook rows x 16 hook columns) so that code and fixtures have something to run against. Do not treat them as real loom data.

| Field | Illustrative value | Status |
|---|---|---|
| Card width (mm) | 60 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |
| Card height (mm) | 45 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |
| Hook rows | 12 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |
| Hook columns | 16 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |
| Hole diameter (mm) | 2.0 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |
| Horizontal pitch (mm) | 3.0 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |
| Vertical pitch (mm) | 3.0 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |
| First hole centre (mm) | x 7.5, y 6.0 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |
| Peg hole positions (mm) | (3.0, 22.5) and (57.0, 22.5), diameter 2.5 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |
| Lacing hole positions (mm) | (15.0, 2.0), (45.0, 2.0), (15.0, 43.0), (45.0, 43.0), diameter 2.0 | ILLUSTRATIVE, UNVERIFIED, replace with measured values |

Peg holes and lacing holes are fixed on every card. They are not part of the pattern. The reader can use them to find the card and correct tilt. The codec must ignore them when decoding the pattern.

## Replacing the illustrative values

When a real card is measured, create a new profile file with the measured values and a descriptive `name`. Remove the `status` marker from that profile only after every value has been checked against the physical card.
