import { describe, expect, it } from 'vitest';
import { truncateRatio } from '../../../src/ui/theme/contrast.ts';

describe('truncateRatio', () => {
  it('R5.5 4.55 gives "4.55"', () => {
    expect(truncateRatio(4.55)).toBe('4.55');
  });

  it('R5.5 4.499 gives "4.49" (never rounded up)', () => {
    expect(truncateRatio(4.499)).toBe('4.49');
  });

  it('R5.5 4.5 gives "4.50"', () => {
    expect(truncateRatio(4.5)).toBe('4.50');
  });

  it('R5.5 a whole ratio keeps two decimals, and a ratio just under the minimum stays under it', () => {
    expect(truncateRatio(21)).toBe('21.00');
    expect(truncateRatio(4.499999999999999)).toBe('4.49');
  });
});
