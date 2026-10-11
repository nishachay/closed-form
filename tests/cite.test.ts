import { describe, expect, it } from 'vitest';
import { citationOrder, detachedCitations, parseCitations, renderCitations, stripCitations } from '../src/lib/cite.js';
import { entrySchema } from '../src/lib/entry.js';
import { isError, lintCitations, lintText } from '../scripts/lint-ste.js';
import entry144 from '../src/content/entries/144.json';

type E = Record<string, unknown> & { explanation: string; claims: { text: string; sourceLine?: string; paper?: number }[] };
/** Entry 144 with its own markers removed, so each test adds exactly the marker it checks. */
const base = (): E => {
  const e = JSON.parse(JSON.stringify(entry144)) as E;
  e.explanation = stripCitations(e.explanation);
  expect(e.explanation).toContain('form an orthonormal basis.');
  return e;
};

describe('inline citation syntax', () => {
  it('parses markers attached before punctuation, outside math', () => {
    const t = 'The copies form a basis[2]. It is ergodic[3,4], and $x[1]$ is math. Not [5] here.';
    const ms = parseCitations(t);
    expect(ms.map((m) => m.claims)).toEqual([[2], [3, 4]]);
  });

  it('strips markers and leaves the prose untouched', () => {
    expect(stripCitations('A basis[2]. Ergodic[3,4], yes.')).toBe('A basis. Ergodic, yes.');
    expect(stripCitations('No markers, $[0,1]$ stays.')).toBe('No markers, $[0,1]$ stays.');
  });

  it('flags detached markers but not matrices or intervals', () => {
    expect(detachedCitations('A claim [2].')).toHaveLength(1);
    expect(detachedCitations('A claim[2] and more.')).toHaveLength(1);
    expect(detachedCitations('A = [[1, 1], [0, 1]] and the interval [0, 1].')).toHaveLength(0);
    expect(detachedCitations('A claim[2].')).toHaveLength(0);
  });

  it('numbers citations in reading order', () => {
    const order = citationOrder(['First[5]. Then[2,5].', 'Later[9].']);
    expect([...order.entries()]).toEqual([
      [5, 1],
      [2, 2],
      [9, 3],
    ]);
  });

  it('renders a raised numeral link with no brackets and an accessible description', () => {
    const order = citationOrder(['A basis[2].']);
    const html = renderCitations('A basis[2].', order, (s) => s);
    expect(html).toContain('class="cite"');
    expect(html).toContain('href="#cite-1"');
    expect(html).toContain('aria-describedby="cite-1-q"');
    expect(html).toContain('id="cref-1"');
    expect(html).not.toMatch(/\[\d/);
    expect(html.endsWith('</span>.')).toBe(true);
  });
});

describe('citation lint', () => {
  it('markers do not count toward the 25-word limit', () => {
    const s = Array.from({ length: 25 }, (_, i) => `w${i}`).join(' ');
    expect(lintText(`${s}[1][2].`.replace('][', ','), 'explanation').filter(isError)).toHaveLength(0);
  });

  it('a marker must reference an existing claim', () => {
    const e = base();
    e.explanation = e.explanation.replace(/form an orthonormal basis\./, 'form an orthonormal basis[99].');
    const issues = lintCitations(e);
    expect(issues.some((i) => i.kind === 'cite-missing-claim')).toBe(true);
    expect(entrySchema.safeParse(e).success).toBe(false);
  });

  it('a cited claim must carry a sourceLine', () => {
    const e = base();
    const ext = e.claims.findIndex((c) => !c.sourceLine) + 1;
    e.explanation = e.explanation.replace(/form an orthonormal basis\./, `form an orthonormal basis[${ext}].`);
    expect(lintCitations(e).some((i) => i.kind === 'cite-no-source-line')).toBe(true);
  });

  it('flags a marker not attached to a sentence', () => {
    const e = base();
    e.explanation = e.explanation.replace(/form an orthonormal basis\./, 'form an orthonormal basis [2].');
    expect(lintCitations(e).some((i) => i.kind === 'cite-detached')).toBe(true);
    expect(entrySchema.safeParse(e).success).toBe(false);
  });

  it('only the explanation may cite', () => {
    const e = base();
    e.headline = 'A smooth map with one filling orbit[2].';
    expect(lintCitations(e).some((i) => i.kind === 'cite-outside-explanation')).toBe(true);
  });

  it('checks the paper index of a cited claim in a multi-paper result', () => {
    const e = base();
    e.explanation = e.explanation.replace(/form an orthonormal basis\./, 'form an orthonormal basis[2].');
    const tex = 'There exist a smooth volume-preserving diffeomorphism and a real function such that';
    expect(lintCitations(e, [tex, 'other']).some((i) => i.kind === 'warning-cite-no-paper')).toBe(true);
    e.claims[1].paper = 2;
    expect(lintCitations(e, [tex, 'unrelated text']).some((i) => i.kind === 'cite-wrong-paper')).toBe(true);
    e.claims[1].paper = 1;
    expect(lintCitations(e, [tex, 'unrelated text']).filter(isError)).toHaveLength(0);
  });

  it('a well-cited entry passes', () => {
    const e = base();
    e.explanation = e.explanation.replace(/form an orthonormal basis\./, 'form an orthonormal basis[2].');
    expect(lintCitations(e).filter(isError)).toHaveLength(0);
    expect(entrySchema.safeParse(e).success).toBe(true);
  });
});
