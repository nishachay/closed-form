import { describe, expect, it } from 'vitest';
import { fillSourceQuotes, prepareTex, sentenceQuote } from '../scripts/source-quote.js';
import { flattenTex, isError, lintSourceQuotes } from '../scripts/lint-ste.js';
import { renderQuote } from '../src/lib/katex.js';

const TEX = String.raw`\section{Introduction}
We study the zeta function. % a comment that must not leak
The theorem does not establish the
Riemann hypothesis, e.g.\ its generalized versions, which place zeros on $\Re s=1/2$.
See Thm.~\ref{thm:main} and the work of J. Smith et al. for background.
The bound $x \le 1.5$ holds for every $x$ in the set.

\begin{theorem}\label{thm:main}
Every Dirichlet $L$-function has no zero in $\Re s>7/8$.
\end{theorem}
The classical criterion reduces the theorem to
\[
  \sup_n M(n)<\infty.
\]
A second sentence follows the display.
Moreover we get
\begin{equation}
  a = b,
\end{equation}
where $a$ is the first quantity and $b$ the second.
`;

const quote = (line: string) => sentenceQuote(prepareTex(TEX), line);

describe('sourceQuote extraction', () => {
  it('expands a cut-off LaTeX line to the whole sentence, joining line breaks', () => {
    const r = quote('The theorem does not establish the');
    expect(r).toEqual({
      ok: true,
      quote: String.raw`The theorem does not establish the Riemann hypothesis, e.g.\ its generalized versions, which place zeros on $\Re s=1/2$.`,
    });
  });

  it('does not split at abbreviations, initials or a decimal point in math', () => {
    expect(quote('and the work of J. Smith')).toEqual({
      ok: true,
      quote: String.raw`See Thm.~\ref{thm:main} and the work of J. Smith et al. for background.`,
    });
    expect(quote('holds for every')).toEqual({ ok: true, quote: String.raw`The bound $x \le 1.5$ holds for every $x$ in the set.` });
  });

  it('strips comments and stops at environment boundaries and labels', () => {
    expect(quote('We study the zeta function.')).toEqual({ ok: true, quote: 'We study the zeta function.' });
    expect(quote('Every Dirichlet $L$-function has no zero')).toEqual({
      ok: true,
      quote: String.raw`Every Dirichlet $L$-function has no zero in $\Re s>7/8$.`,
    });
  });

  it('keeps a displayed formula that is part of the sentence', () => {
    const r = quote('The classical criterion reduces the theorem to');
    expect(r).toEqual({ ok: true, quote: String.raw`The classical criterion reduces the theorem to \[ \sup_n M(n)<\infty. \]` });
    expect(quote('A second sentence follows the display.')).toEqual({ ok: true, quote: 'A second sentence follows the display.' });
    const w = quote('where $a$ is the first quantity');
    expect(w.ok && w.quote.startsWith('Moreover we get \\begin{equation}')).toBe(true);
  });

  it('every quote is an exact passage of the flattened LaTeX', () => {
    const flat = flattenTex(TEX);
    for (const line of ['The theorem does not establish the', 'holds for every', 'The classical criterion reduces the theorem to']) {
      const r = quote(line);
      expect(r.ok && flat.includes(r.quote)).toBe(true);
    }
  });

  it('falls back when the line is not in the paper', () => {
    expect(quote('Something the paper never says').ok).toBe(false);
  });
});

describe('fillSourceQuotes and lint', () => {
  const entry = () => ({
    id: '999',
    explanation: 'It leaves the hypothesis open[1]. The wall is fixed[2].',
    claims: [
      { text: 'a', verdict: 'supported', sourceLine: 'The theorem does not establish the' },
      { text: 'b', verdict: 'supported', sourceLine: 'Every Dirichlet $L$-function has no zero in $\\Re s>7/8$.' },
      { text: 'c', verdict: 'supported', sourceLine: 'We study the zeta function.' },
    ] as Record<string, unknown>[],
  });

  it('fills only cited claims and the result passes lint', () => {
    const e = entry();
    const rep = fillSourceQuotes(e, [TEX]);
    expect(rep).toMatchObject({ cited: 2, quoted: 2, fallbacks: [] });
    expect(e.claims[0].sourceQuote).toMatch(/^The theorem does not establish the Riemann hypothesis/);
    expect(e.claims[2].sourceQuote).toBeUndefined();
    expect(lintSourceQuotes(e, [TEX]).filter(isError)).toHaveLength(0);
  });

  it('flags a quote that is not verbatim or that drops its sourceLine', () => {
    const e = entry();
    fillSourceQuotes(e, [TEX]);
    e.claims[0].sourceQuote = 'The theorem does not establish the Riemann hypothesis.';
    e.claims[1].sourceQuote = 'We study the zeta function.';
    const kinds = lintSourceQuotes(e, [TEX]).map((i) => i.kind);
    expect(kinds).toContain('quote-not-verbatim');
    expect(kinds).toContain('quote-missing-line');
  });

  it('warns when a cited claim has no sourceQuote', () => {
    const kinds = lintSourceQuotes(entry(), [TEX]).map((i) => i.kind);
    expect(kinds.filter((k) => k === 'warning-cite-no-quote')).toHaveLength(2);
  });
});

describe('renderQuote', () => {
  it('renders display math, text markup and references readably', () => {
    const html = renderQuote("See Thm.~\\ref{thm:main} and \\emph{the} ``case'' \\cite{X} --- done: \\[ \\sup_n M(n)<\\infty. \\]");
    expect(html).toContain('katex-display');
    expect(html).toContain('See Thm. … and the “case” — done:');
    expect(html).not.toContain('\\emph');
    expect(html).not.toContain('\\cite');
  });
});
