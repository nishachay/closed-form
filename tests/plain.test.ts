import { describe, expect, it } from 'vitest';
import { clip, toPlain } from '../src/lib/plain';

describe('toPlain', () => {
  it('converts common inline TeX to Unicode', () => {
    expect(toPlain('Prime-factor statistics of $p-1$')).toBe('Prime-factor statistics of p-1');
    expect(toPlain('zero-free in $\\Re s\\gt 7/8$')).toBe('zero-free in Re s > 7/8');
    expect(toPlain('over $\\mathbb Q(\\sqrt{-3})$')).toBe('over ℚ(√(-3))');
    expect(toPlain('$\\mathsf L=\\mathsf{RL}$')).toBe('L=RL');
    expect(toPlain('$n^2$ and $x_{1}$')).toBe('n² and x₁');
    expect(toPlain('irrationality of $\\pi$')).toBe('irrationality of π');
  });
  it('strips tags and leaves no TeX residue across the catalog', async () => {
    const catalog = (await import('../src/data/catalog.json')).default as { families: Array<{ id: string; title: string; summary: string }> };
    for (const f of catalog.families) {
      expect(toPlain(f.title), f.id).not.toMatch(/[$\\]/);
      expect(toPlain(f.summary), f.id).not.toMatch(/[$\\]/);
    }
  });
});

describe('clip', () => {
  it('cuts on a word boundary with an ellipsis', () => {
    expect(clip('one two three four', 10)).toBe('one two…');
    expect(clip('short', 10)).toBe('short');
  });
});
