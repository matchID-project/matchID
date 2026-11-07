import { describe, expect, it } from 'vitest';
import { smartNumber } from '../../src/components/tools/stats.js';

describe('smartNumber', () => {
  it('returns non-numbers unchanged', () => {
    expect(smartNumber('12 %')).toBe('12 %');
    expect(smartNumber(undefined)).toBeUndefined();
  });

  it('formats numbers with k/M/G suffixes', () => {
    expect(smartNumber(999)).toBe('999');
    expect(smartNumber(1500, 1)).toBe('1.5k');
    expect(smartNumber(2000000)).toBe('2M');
    expect(smartNumber(3200000000, 1)).toBe('3.2G');
  });

  it('drops trailing zero decimals', () => {
    expect(smartNumber(12, 2)).toBe('12');
    expect(smartNumber(12.5, 1)).toBe('12.5');
  });
});
