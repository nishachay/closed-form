/**
 * What an entry page shows, derived from catalog + entry data. Shared by the
 * HTML page (src/pages/e/[gid].astro) and its markdown twin (src/lib/md), so
 * both list the same sources, quotes and sections. No Astro imports.
 */
import type { Family } from './catalog.js';
import type { Entry } from './entry.js';
import { citationOrder } from './cite.js';
import { toPlain } from './plain.js';

export const REVIEW_NOTE =
  'Drafted by one AI model and checked sentence by sentence against the paper by a different one. Spot a mistake? Report an error.';

/** Source citations: strip the internal † "check me" marker and link arXiv ids. */
export const cleanCite = (cite: string) => {
  const unchecked = /†\s*$/.test(cite);
  const text = cite.replace(/\s*†\s*$/, '');
  const arxiv = /arXiv:(\d{4}\.\d{4,5})/.exec(text);
  return { text, unchecked, href: arxiv ? `https://arxiv.org/abs/${arxiv[1]}` : undefined };
};

/** Full URL of a family's Lean notes ('' when it has none). */
export const leanHref = (f: Pick<Family, 'leanDoc'>) =>
  f.leanDoc ? (f.leanDoc.startsWith('http') ? f.leanDoc : `https://github.com/openai/math/blob/main/${f.leanDoc}`) : '';

/** First sentence of the lab's withdrawal reason, plus its "does not assert false" caveat when present. */
export const shortReason = (r: string) => {
  const plain = toPlain(r);
  const first = plain.split(/(?<=\.)\s+/)[0] ?? plain;
  const caveat = /This withdrawal concerns the proof[^.]*\./.exec(plain)?.[0];
  return caveat && caveat !== first ? `${first} ${caveat}` : first;
};

export function entryView(family: Family, entry: Entry | null) {
  const reviewNote = entry && entry.status !== 'reviewed' ? REVIEW_NOTE : null;
  /** Prose body (entry.explanation): paragraphs split on blank lines. Replaces the four sections. */
  const paragraphs = entry?.explanation
    ? entry.explanation.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    : [];
  const sections = entry?.explanation ? [] : (entry?.sections ?? []);
  /** Inline citations: [n] in the explanation → a raised numeral, numbered in reading order. */
  const citeOrder = citationOrder(paragraphs);
  const paperName = (c: { paper?: number; sourceId?: number }) => {
    // Which paper the line is quoted from: the claim's `paper` index, the only paper, or a
    // sourceId that points at one of this result's papers. Never an outside work it discusses.
    const viaSource = c.sourceId ? entry?.sources.find((x) => x.id === c.sourceId)?.url : undefined;
    const p = c.paper
      ? family.papers[c.paper - 1]
      : family.papers.length === 1
        ? family.papers[0]
        : family.papers.find((x) => viaSource && viaSource === x.pdf);
    return p ? { name: toPlain(p.title), href: p.pdf as string | undefined } : { name: 'The paper', href: undefined };
  };
  const cited = [...citeOrder.entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([claimNo, n]) => {
      const c = entry!.claims![claimNo - 1];
      // The full sentence(s) from the paper when we have them; the single LaTeX line otherwise.
      return { n, quote: c.sourceQuote ?? c.sourceLine ?? '', paper: paperName(c) };
    });
  const aiSection = (entry?.sections ?? []).find((s) => s.title === 'What it says about AI') ?? null;
  /**
   * Sources other than the result's own papers: those are already listed, with dates and Lean
   * status, under "The original", so they are not repeated here. The JSON keeps every source.
   */
  const ownLinks = new Set(
    [...family.papers.map((p) => p.pdf), family.trace, family.leanDoc && leanHref(family)]
      .filter((u): u is string => !!u)
      .map((u) => u.replace(/\/$/, '')),
  );
  const otherSources = (entry?.sources ?? []).filter((s) => {
    const href = s.url ?? cleanCite(s.cite).href;
    return !(href && ownLinks.has(href.replace(/\/$/, '')) && !s.quote);
  });
  const anyUnchecked = !!entry && entry.status !== 'reviewed' && otherSources.some((x) => /†\s*$/.test(x.cite));
  const paperDates = family.papers.map((p) => p.date).filter(Boolean).sort();
  const firstDate = paperDates[0] ?? null;
  const latestDate = paperDates[paperDates.length - 1] ?? null;
  return { reviewNote, paragraphs, sections, citeOrder, cited, aiSection, otherSources, anyUnchecked, firstDate, latestDate };
}
