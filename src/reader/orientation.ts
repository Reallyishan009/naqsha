/** Peg hole diameters in pixels, indexed by role: [role 0, role 1]. */
export type DiameterPair = readonly [number, number];

export type OrientationDecision = {
  kind: 'upright' | 'upside-down' | 'ambiguous';
  separation: number;
};

/** The separation must reach this magnitude before the card orientation is decided. */
export const MIN_SEPARATION = 0.5;

/**
 * How strongly the measured peg hole diameters favour the upright hypothesis over upside-down.
 * +1 means the measured diameters equal the expected ones, -1 means they equal the expected ones swapped,
 * 0 means no preference. Returns 0 when the expected diameters are equal (no gap to tell them apart).
 */
export function orientationSeparation(expected: DiameterPair, measuredUpright: DiameterPair): number {
  const [e0, e1] = expected;
  const [u0, u1] = measuredUpright;
  if (e0 === e1) return 0;
  const cUp = Math.abs(u0 - e0) + Math.abs(u1 - e1);
  const cDown = Math.abs(u1 - e0) + Math.abs(u0 - e1);
  return (cDown - cUp) / (2 * Math.abs(e0 - e1));
}

export function decideOrientation(expected: DiameterPair, measuredUpright: DiameterPair): OrientationDecision {
  const separation = orientationSeparation(expected, measuredUpright);
  if (separation >= MIN_SEPARATION) return { kind: 'upright', separation };
  if (separation <= -MIN_SEPARATION) return { kind: 'upside-down', separation };
  return { kind: 'ambiguous', separation };
}
