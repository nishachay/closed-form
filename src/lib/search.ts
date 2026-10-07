/**
 * Prefix search over id, title, summary and field (§13).
 * Multiple words are ANDed. Greek maps both ways: `pi` matches `π`
 * and `zeta` matches `ζ` (normalize folds glyphs to names on both sides).
 */

const GREEK: Record<string, string> = {
  π: 'pi',
  ζ: 'zeta',
  ε: 'epsilon',
  λ: 'lambda',
  μ: 'mu',
  σ: 'sigma',
  τ: 'tau',
  φ: 'phi',
  ψ: 'psi',
  ω: 'omega',
  χ: 'chi',
  θ: 'theta',
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
};

export function normalizeSearchText(s: string): string {
  let out = s.toLowerCase();
  for (const [glyph, name] of Object.entries(GREEK)) {
    out = out.split(glyph).join(` ${name} `);
  }
  return out;
}

function hayWords(haystack: string): string[] {
  return normalizeSearchText(haystack).split(/[^a-z0-9]+/).filter(Boolean);
}

/** True when every query word prefix-matches some haystack word. */
export function matchesQuery(haystack: string, query: string): boolean {
  const words = hayWords(haystack);
  const qs = normalizeSearchText(query).split(/[^a-z0-9]+/).filter(Boolean);
  if (qs.length === 0) return true;
  return qs.every((q) => words.some((w) => w.startsWith(q)));
}
