/**
 * Inline citations in an entry's `explanation`.
 *
 * Stored syntax (JSON): a bracketed, 1-based index into the entry's `claims[]`,
 * written directly against the end of the sentence or clause it supports, before
 * the punctuation: `…form an orthonormal basis[2].` Several claims: `[2,3]` (no
 * spaces). Only claims that carry a `sourceLine` may be cited, because the reader
 * is shown that exact line from the paper.
 *
 * Readers never see the brackets: the entry page renders each marker as a small
 * raised numeral (numbered 1, 2, 3… in reading order) that opens the quoted line.
 */

/** A well-formed marker: attached to a word, followed by punctuation. */
export const CITE_RE = /(?<=[^\s[(])\[(\d{1,3}(?:,\d{1,3})*)\](?=[.,;:!?…])/g;

/** Anything that looks like a marker (used by lint to find detached ones). */
const LOOSE_RE = /\[(\d{1,3}(?:,\s?\d{1,3})*)\]/g;

/** Text outside `$…$` math, as [start, end) ranges. Unbalanced `$` = treat all as text. */
function textRanges(text: string): [number, number][] {
  const idx: number[] = [];
  for (let i = 0; i < text.length; i++) if (text[i] === '$' && text[i - 1] !== '\\') idx.push(i);
  if (idx.length % 2 === 1) return [[0, text.length]];
  const out: [number, number][] = [];
  let pos = 0;
  for (let k = 0; k < idx.length; k += 2) {
    out.push([pos, idx[k]]);
    pos = idx[k + 1] + 1;
  }
  out.push([pos, text.length]);
  return out;
}

export interface CiteMarker {
  /** Offset of `[` in the text. */
  index: number;
  raw: string;
  /** 1-based claim indices, in the order written. */
  claims: number[];
}

/** Well-formed markers outside math, in reading order. */
export function parseCitations(text: string): CiteMarker[] {
  const out: CiteMarker[] = [];
  for (const [a, b] of textRanges(text)) {
    const seg = text.slice(a, b);
    for (const m of seg.matchAll(CITE_RE)) {
      out.push({ index: a + (m.index ?? 0), raw: m[0], claims: m[1].split(',').map(Number) });
    }
  }
  return out;
}

/** Bracketed numbers outside math that are NOT well-formed markers (lint: detached). */
export function detachedCitations(text: string): string[] {
  const good = new Set(parseCitations(text).map((m) => m.index));
  const out: string[] = [];
  for (const [a, b] of textRanges(text)) {
    const seg = text.slice(a, b);
    for (const m of seg.matchAll(LOOSE_RE)) {
      const at = a + (m.index ?? 0);
      if (good.has(at)) continue;
      // Matrices and intervals ("[[1, 1], …]", "[0, 1]") are not markers: they sit inside other brackets
      // or contain a space after the comma.
      if (/,\s/.test(m[0]) || text[at - 1] === '[' || text[at + m[0].length] === ']') continue;
      out.push(text.slice(Math.max(0, at - 30), at + m[0].length + 2));
    }
  }
  return out;
}

/** The text with every marker removed (for word counts, plain text, search, meta). */
export function stripCitations(text: string): string {
  if (!text) return text;
  let out = '';
  let last = 0;
  for (const m of parseCitations(text)) {
    out += text.slice(last, m.index);
    last = m.index + m.raw.length;
  }
  return out + text.slice(last);
}

export interface ClaimLike {
  text: string;
  sourceLine?: string;
  sourceId?: number;
  paper?: number;
}

/**
 * Reading-order numbering: the first claim cited is shown as 1, the next new one
 * as 2, and so on. Returns claim index (1-based) → display number.
 */
export function citationOrder(texts: string[]): Map<number, number> {
  const order = new Map<number, number>();
  for (const t of texts) {
    for (const m of parseCitations(t)) {
      for (const c of m.claims) if (!order.has(c)) order.set(c, order.size + 1);
    }
  }
  return order;
}

/**
 * Replace markers in one paragraph's text parts with the rendered numeral(s).
 * `renderMathSegment` renders a `$…$` segment; text parts pass through as-is
 * (the same contract as renderMath). Math is never touched.
 */
export function renderCitations(
  text: string,
  order: Map<number, number>,
  renderText: (s: string) => string,
  /** Display numbers already rendered on the page; the first occurrence gets id="cref-N" (the "back to text" target). */
  seen: Set<number> = new Set(),
): string {
  const markers = parseCitations(text);
  if (markers.length === 0) return renderText(text);
  let html = '';
  let last = 0;
  for (const m of markers) {
    html += renderText(text.slice(last, m.index));
    html += markerHtml(m.claims, order, seen);
    last = m.index + m.raw.length;
  }
  return html + renderText(text.slice(last));
}

function markerHtml(claims: number[], order: Map<number, number>, seen: Set<number>): string {
  const nums = claims.map((c) => order.get(c)).filter((n): n is number => n !== undefined);
  const links = nums
    .map((n) => {
      const id = seen.has(n) ? '' : ` id="cref-${n}"`;
      seen.add(n);
      return `<a class="cite-a"${id} href="#cite-${n}" data-cite="${n}" aria-describedby="cite-${n}-q" aria-haspopup="dialog" aria-expanded="false"><span class="sr">Source </span>${n}</a>`;
    })
    .join('<span class="cite-sep" aria-hidden="true">,</span>');
  return `<span class="cite">${links}</span>`;
}
