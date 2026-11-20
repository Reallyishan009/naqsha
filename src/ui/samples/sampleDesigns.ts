import { decodeEnds, endsPerPick } from '../../codec/index.ts';
import type { CardProfile, Ends, Pattern } from '../../codec/index.ts';
import type { SampleDesign } from '../types.ts';

/** Number of times the motif repeats along the picks (R4.5). */
const REPEATS = 3;

/** Diamond: the filled core reaches |u| + |v| = 0.35, the outline is a band of half-width 0.1 around 0.85. */
const DIAMOND_CORE = 0.35;
const DIAMOND_OUTLINE = 0.85;
const DIAMOND_OUTLINE_HALF_WIDTH = 0.1;

/**
 * Floral: each flower is a centre of |u| + |v| <= 0.2 with four round petals of radius 0.27 centred at (+-0.5, +-0.5),
 * so the petals stand apart from the centre and from each other. Flowers sit in cells twice as wide as a repeat, and a
 * small leaf (a diamond of reach 0.45) sits on the boundary between two flowers.
 */
const FLORAL_CENTRE = 0.2;
const FLORAL_PETAL_OFFSET = 0.5;
const FLORAL_PETAL_RADIUS = 0.27;
const FLORAL_LEAF = 0.45;

/** Border: a solid band on each edge, a zigzag band set in from it, and a plain line closing the inner side. */
const BORDER_EDGE_ENDS = 2;
const BORDER_ZIGZAG_START = 4;
const BORDER_ZIGZAG_THICKNESS = 2;
const BORDER_LINE_OFFSET = 12;

/**
 * Where an end and a pick sit in the motif. The cloth is made of square warp and weft threads, so the diamond and the floral are
 * tiled along the ends in cells that are `period` ends wide, the same size as one repeat along the picks.
 * `u` and `v` run from -1 to 1 across a cell; `floralU` runs from -2 to 2 across a floral cell, which is two repeats
 * wide, with the flower in the middle (|floralU| <= 1) and a leaf at the boundary; `edgeDistance` counts ends from the nearer edge of the card;
 * `zigzagStep` is the distance of the pick from the middle of the repeat, in picks.
 */
type Position = { u: number; floralU: number; v: number; edgeDistance: number; zigzagStep: number };

/** Whether the end at this position lifts on this pick. Reads only the position, never a card dimension. */
function lifted(design: SampleDesign, position: Position): boolean {
  const { u, floralU, v, edgeDistance, zigzagStep } = position;
  const au = Math.abs(u);
  const av = Math.abs(v);
  const sum = au + av;
  switch (design) {
    case 'diamond':
      return sum <= DIAMOND_CORE || Math.abs(sum - DIAMOND_OUTLINE) <= DIAMOND_OUTLINE_HALF_WIDTH;
    case 'border': {
      const zigzagOffset = edgeDistance - BORDER_ZIGZAG_START - zigzagStep;
      return (
        edgeDistance < BORDER_EDGE_ENDS ||
        (zigzagOffset >= 0 && zigzagOffset < BORDER_ZIGZAG_THICKNESS) ||
        edgeDistance === BORDER_LINE_OFFSET
      );
    }
    case 'floral': {
      const flowerU = Math.abs(floralU);
      if (flowerU > 1) return 2 - flowerU + av <= FLORAL_LEAF;
      const petalU = flowerU - FLORAL_PETAL_OFFSET;
      const petalV = av - FLORAL_PETAL_OFFSET;
      return flowerU + av <= FLORAL_CENTRE || petalU * petalU + petalV * petalV <= FLORAL_PETAL_RADIUS * FLORAL_PETAL_RADIUS;
    }
    default: {
      const unreachable: never = design;
      return unreachable;
    }
  }
}

/**
 * Builds a Sample_Design for the profile: 3 * P picks, P = max(2, hookRows), one card per pick (R4.3, R4.5).
 * The ends list is turned into a card with decodeEnds, so endOrder is applied and no end index is computed here.
 * Pure and deterministic (R4.6). A profile that decodeEnds cannot use gives an empty pattern; the caller loads
 * the profile with parseCardProfile first.
 */
export function generateSample(profile: CardProfile, design: SampleDesign): Pattern {
  const endCount = endsPerPick(profile);
  const period = Math.max(2, profile.hookRows);
  const pattern: Pattern = [];
  for (let pickIndex = 0; pickIndex < REPEATS * period; pickIndex++) {
    const s = pickIndex % period;
    const v = (2 * s + 1 - period) / period;
    const zigzagStep = Math.floor(Math.abs(2 * s + 1 - period) / 2);
    const ends: Ends = [];
    for (let end = 0; end < endCount; end++) {
      const cellEnd = end % period;
      const u = (2 * cellEnd + 1 - period) / period;
      const floralU = (2 * (end % (2 * period)) + 1 - 2 * period) / period;
      const edgeDistance = Math.min(end, endCount - 1 - end);
      ends.push(lifted(design, { u, floralU, v, edgeDistance, zigzagStep }));
    }
    const decoded = decodeEnds(profile, ends);
    if (!decoded.ok) return [];
    pattern.push(decoded.value);
  }
  return pattern;
}
/** The picks of the diamond sample that are lost in the "design with lost cards" sample: two inside the chain and the last. */
export function lostCardPicks(pickCount: number): number[] {
  return pickCount < 6 ? [] : [4, 15, pickCount - 1].filter((pick, index, picks) => pick < pickCount && picks.indexOf(pick) === index);
}
/**
 * The diamond sample with three cards lost, so a design with gaps can be tried without a damaged card. A lost
 * card is an empty grid, which no card profile accepts, so the simulator and the Code view show it as damaged.
 * The diamond repeats and mirrors, so every lost card has a suggestion.
 */
export function sampleWithLostCards(profile: CardProfile): Pattern {
  const pattern = generateSample(profile, 'diamond');
  const lost = new Set(lostCardPicks(pattern.length));
  return pattern.map((card, pick) => (lost.has(pick) ? [] : card));
}
