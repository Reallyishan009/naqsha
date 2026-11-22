import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { CLOTH_CARD_ID, scrollClothIntoView } from '../../../src/ui/screens/weave/scrollToCloth.ts';
import type { ClothScrollDeps } from '../../../src/ui/screens/weave/scrollToCloth.ts';

type Call = { block?: string; behavior?: string };

function fakeDeps(bottom: number | null, present = true) {
  const calls: Call[] = [];
  const heights: number[] = [];
  const asked: string[] = [];
  const deps: ClothScrollDeps = {
    byId: (id) => {
      asked.push(id);
      return present ? { scrollIntoView: (arg?: boolean | ScrollIntoViewOptions) => void calls.push(arg as Call) } : null;
    },
    headerBottomPx: () => bottom,
    setHeaderHeight: (px) => void heights.push(px),
  };
  return { deps, calls, heights, asked };
}

describe('scrollClothIntoView (the one helper behind every Try it button)', () => {
  it('scrolls the cloth card to the top of the view, smoothly', () => {
    const f = fakeDeps(96);
    expect(scrollClothIntoView(false, f.deps)).toBe(true);
    expect(f.asked).toEqual([CLOTH_CARD_ID]);
    expect(f.calls).toEqual([{ block: 'start', behavior: 'smooth' }]);
    expect(f.heights).toEqual([96]);
  });

  it('scrolls instantly under reduced motion', () => {
    const f = fakeDeps(96);
    scrollClothIntoView(true, f.deps);
    expect(f.calls).toEqual([{ block: 'start', behavior: 'auto' }]);
  });

  it('does nothing and does not throw when the cloth card is missing', () => {
    const f = fakeDeps(96, false);
    expect(scrollClothIntoView(false, f.deps)).toBe(false);
    expect(f.calls).toEqual([]);
  });

  it('does not throw when the page throws', () => {
    const deps: ClothScrollDeps = {
      byId: () => {
        throw new Error('no document');
      },
      headerBottomPx: () => null,
      setHeaderHeight: () => undefined,
    };
    expect(scrollClothIntoView(true, deps)).toBe(false);
  });

  it('R4.9 the behaviour follows reduced motion and the measured header is passed on, for any header height', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.oneof(fc.constant(null), fc.double({ min: 0, max: 400, noNaN: true })), (reduced, bottom) => {
        const f = fakeDeps(bottom);
        expect(scrollClothIntoView(reduced, f.deps)).toBe(true);
        expect(f.calls[0]?.behavior).toBe(reduced ? 'auto' : 'smooth');
        expect(f.heights).toEqual(bottom === null ? [] : [bottom]);
      }),
    );
  });
});
