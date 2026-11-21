import { describe, expect, it } from 'vitest';
import { endsPerPick, type CardGrid, type CardProfile, type Pattern } from '../../../src/codec/index.ts';
import {
  END_PITCH_UNITS,
  LIFT_UNITS,
  MARGIN_UNITS,
  PRESS_UNITS,
  heroLayout,
} from '../../../src/ui/illustrations/heroLayout.ts';
import { heroPose } from '../../../src/ui/illustrations/heroPose.ts';
import { demoProfile } from '../../support/profiles.ts';

const profile = demoProfile();

/** A second card: the same size, with the end order reversed, so a hook position maps to another end. */
const reversedProfile: CardProfile = {
  ...profile,
  endOrder: profile.endOrder.map((row) => row.map((endIndex) => endsPerPick(profile) - 1 - endIndex)),
};

function blankGrid(forProfile: CardProfile): CardGrid {
  return Array.from({ length: forProfile.hookRows }, () => Array.from({ length: forProfile.hookColumns }, () => false));
}

/** A grid with the given hook positions punched. */
function gridWith(forProfile: CardProfile, positions: readonly (readonly [number, number])[]): CardGrid {
  const grid = blankGrid(forProfile);
  for (const [hookRow, hookColumn] of positions) grid[hookRow]![hookColumn] = true;
  return grid;
}

describe('heroPose', () => {
  it('R13.2 the first pick with a punched hook position is chosen', () => {
    const lastRow = profile.hookRows - 1;
    const lastColumn = profile.hookColumns - 1;
    const pattern: Pattern = [blankGrid(profile), blankGrid(profile), gridWith(profile, [[lastRow, lastColumn]]), gridWith(profile, [[0, 0]])];
    const pose = heroPose(profile, pattern);
    expect(pose.kind).toBe('lifted');
    if (pose.kind !== 'lifted') return;
    expect(pose.pickIndex).toBe(2);
    expect(pose.grid).toEqual(pattern[2]);
    expect(pose.endsPerPick).toBe(endsPerPick(profile));
  });

  it('R13.2 the lifted-end count equals the punched count and each lifted end is the end its hook position maps to', () => {
    const positions: [number, number][] = [
      [0, 0],
      [0, profile.hookColumns - 1],
      [profile.hookRows - 1, 1],
      [1, profile.hookColumns - 2],
    ];
    for (const forProfile of [profile, reversedProfile]) {
      const pose = heroPose(forProfile, [gridWith(forProfile, positions)]);
      expect(pose.kind).toBe('lifted');
      if (pose.kind !== 'lifted') return;
      expect(pose.liftedEnds).toHaveLength(positions.length);
      const expected = positions.map(([hookRow, hookColumn]) => forProfile.endOrder[hookRow]![hookColumn]!).sort((a, b) => a - b);
      expect(pose.liftedEnds).toEqual(expected);
    }
    // The two end orders put the same hook positions at different ends.
    const first = heroPose(profile, [gridWith(profile, positions)]);
    const second = heroPose(reversedProfile, [gridWith(reversedProfile, positions)]);
    expect(first).not.toEqual(second);
  });

  it('R13.10 a Pattern with no punched hook position returns plain', () => {
    expect(heroPose(profile, [blankGrid(profile), blankGrid(profile)])).toEqual({ kind: 'plain' });
  });

  it('R13.10 a pick that does not match the profile returns plain, and later good picks are not used', () => {
    // The punched hook position is kept in each bad pick, so the pick is chosen and then rejected.
    const wrongRows = gridWith(profile, [[1, 1]]).slice(1);
    const wrongColumns = gridWith(profile, [[1, 1]]).map((row) => row.slice(1));
    const notBoolean = gridWith(profile, [[1, 1]]) as unknown[][];
    notBoolean[0]![0] = 'x';
    for (const bad of [wrongRows, wrongColumns, notBoolean]) {
      const pattern = [bad as CardGrid, gridWith(profile, [[0, 0]])];
      expect(heroPose(profile, pattern)).toEqual({ kind: 'plain' });
    }
  });

  it('R13.10 an empty Pattern returns plain without throwing', () => {
    expect(heroPose(profile, [])).toEqual({ kind: 'plain' });
    expect(() => heroPose(profile, [[] as unknown as CardGrid, null as unknown as CardGrid])).not.toThrow();
    expect(heroPose(profile, [[] as unknown as CardGrid, null as unknown as CardGrid])).toEqual({ kind: 'plain' });
  });

  it('R13.2 the Pattern is not changed', () => {
    const pattern: Pattern = [gridWith(profile, [[0, 0], [1, 1]])];
    const before = structuredClone(pattern);
    heroPose(profile, pattern);
    expect(pattern).toEqual(before);
  });
});

describe('heroLayout', () => {
  it('R13.2 the layout has one x per end, at MARGIN_UNITS + i * END_PITCH_UNITS', () => {
    for (const forProfile of [profile, reversedProfile]) {
      const layout = heroLayout(forProfile);
      expect(layout.endX).toHaveLength(endsPerPick(forProfile));
      layout.endX.forEach((x, endIndex) => expect(x).toBe(MARGIN_UNITS + endIndex * END_PITCH_UNITS));
    }
  });

  it('R13.8 the width is the ends plus margins and the card height follows the profile aspect ratio', () => {
    const layout = heroLayout(profile);
    expect(layout.viewBox.width).toBe(endsPerPick(profile) * END_PITCH_UNITS + 2 * MARGIN_UNITS);
    expect(layout.card.width / layout.card.height).toBeCloseTo(profile.cardWidthMm / profile.cardHeightMm, 10);
    expect(layout.aspect).toBeCloseTo(layout.viewBox.width / layout.viewBox.height, 10);
    // Every part sits inside the viewBox, and the bands follow each other from the head down.
    const bands = [layout.head, layout.card, layout.needles, layout.hooks, layout.warp];
    for (const box of bands) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(layout.viewBox.width);
      expect(box.y + box.height).toBeLessThanOrEqual(layout.viewBox.height);
    }
    expect(layout.needles.y - (layout.card.y + layout.card.height)).toBe(PRESS_UNITS);
    expect(layout.hooks.height).toBeGreaterThan(LIFT_UNITS);
  });

  it('R13.2 a card with other values gives another layout', () => {
    const wider: CardProfile = { ...profile, cardHeightMm: profile.cardHeightMm * 2 };
    expect(heroLayout(wider).card.height).toBeCloseTo(heroLayout(profile).card.height * 2, 10);
    expect(heroLayout(wider).viewBox.height).toBeGreaterThan(heroLayout(profile).viewBox.height);
  });
});
