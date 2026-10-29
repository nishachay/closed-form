import { describe, expect, it } from 'vitest';
import { matchesQuery, normalizeSearchText } from '../src/lib/search.js';

describe('archive search normalization', () => {
  it('folds accents so ASCII finds accented names', () => {
    expect(matchesQuery('Erdős–Szekeres type bounds', 'Erdos')).toBe(true);
    expect(matchesQuery('Szemerédi regularity', 'szemeredi')).toBe(true);
  });

  it('still matches the accented form itself', () => {
    expect(matchesQuery('Erdős–Szekeres type bounds', 'Erdős')).toBe(true);
  });

  it('keeps Greek mapping in both directions', () => {
    expect(matchesQuery('the π function', 'pi')).toBe(true);
    expect(matchesQuery('the pi function', 'π')).toBe(true);
  });

  it('folds precomposed and combining forms identically', () => {
    expect(normalizeSearchText('Erdős')).toBe(normalizeSearchText('Erdős'.normalize('NFD')));
  });

  it('empty query matches everything', () => {
    expect(matchesQuery('anything', '')).toBe(true);
  });
});
