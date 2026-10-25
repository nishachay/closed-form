/**
 * SEO + programmatic hub pages, as pure functions over catalog + entries.
 *
 * No Astro imports, so vitest covers every rule here: title and description
 * limits, hub membership, the "no thin hubs" floor and related-entry ranking.
 * Hub intros are generated from data only; nothing here touches entry text.
 */
import type { Catalog, Family } from './catalog.js';
import type { Entry } from './entry.js';
import { toPlain } from './plain.js';
import { slugify } from './slug.js';

export const SITE_NAME = 'Closed Form';
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;
/** Hubs with fewer entries than this are never generated (no thin pages). */
export const HUB_MIN = 5;
/** Hubs holding more than this share of all results would near-duplicate the archive; skipped. */
export const HUB_MAX_SHARE = 0.7;

const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ');
export const plainTitle = (f: Pick<Family, 'title'>) => toPlain(stripTags(f.title)).replace(/\s+/g, ' ').trim();

/** Cut at a word boundary so the result (with an ellipsis) is at most `max` chars. */
export function clipWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  let cut = clean.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  if (sp > max * 0.5) cut = cut.slice(0, sp);
  return `${cut.replace(/[\s,;:·—–-]+$/, '')}…`;
}

/**
 * <title> for a page: the first suffix that fits within 60 chars wins, so short
 * names keep the brand and long names keep their keywords.
 */
export function fitTitle(name: string, suffixes: string[] = [` — ${SITE_NAME}`]): string {
  const clean = name.replace(/\s+/g, ' ').trim();
  for (const s of [...suffixes, '']) {
    if (clean.length + s.length <= TITLE_MAX) return `${clean}${s}`;
  }
  return clipWords(clean, TITLE_MAX);
}

/** Entry <title>: "<problem> — AI result explained", shortened to fit. */
export function entryTitle(f: Pick<Family, 'title'>): string {
  return fitTitle(plainTitle(f), [' — AI result, explained', ' — explained by AI', ' — explained', ` | ${SITE_NAME}`]);
}

export function clipDescription(text: string, max = DESCRIPTION_MAX): string {
  return clipWords(toPlain(stripTags(text)), max);
}

/** Entry meta description: the plain headline plus what the page offers, ≤155. */
export function entryDescription(f: Family, entry: Entry | null): string {
  const lead = toPlain(entry?.headline ?? stripTags(f.summary)).replace(/\s+/g, ' ').trim();
  const tail = f.trust === 'formal' ? ' Plain-English explainer, Lean status and sources.' : ' Plain-English explainer with sources.';
  const base = lead.length + tail.length <= DESCRIPTION_MAX ? `${lead}${tail}` : lead;
  return clipWords(base, DESCRIPTION_MAX);
}

// ---------------------------------------------------------------------------
// Hubs
// ---------------------------------------------------------------------------

export type HubKind = 'topic' | 'era' | 'trust' | 'significance';

export interface Hub {
  kind: HubKind;
  slug: string;
  /** Display name, e.g. "Erdős problems". */
  name: string;
  /** H1 on the page. */
  heading: string;
  /** One handwritten sentence on what this hub is (site copy, not entry text). */
  blurb: string;
  /** Page path without base, e.g. /topic/erdos-problems/. */
  path: string;
  ids: string[];
}

interface TopicDef {
  slug: string;
  name: string;
  blurb: string;
  /** Matched against the plain title (and summary when `summary` is true). */
  re: RegExp;
  summary?: boolean;
}

/**
 * Problem families and topics people search for. Patterns are deliberately
 * narrow: a wrong member is worse than a missing one.
 */
export const TOPICS: TopicDef[] = [
  { slug: 'erdos-problems', name: 'Erdős problems', re: /erd[őo]s/i, summary: true, blurb: 'Questions first asked or popularised by Paul Erdős, the prolific 20th-century mathematician who posed hundreds of problems, often with cash prizes.' },
  { slug: 'named-conjectures', name: 'Named conjectures', re: /conjecture/i, blurb: 'Results whose title names a conjecture: a statement mathematicians believed but could not prove.' },
  { slug: 'ramsey-theory', name: 'Ramsey theory', re: /ramsey|van der waerden/i, summary: true, blurb: 'Ramsey theory asks how large a structure must be before some orderly pattern is forced to appear inside it.' },
  { slug: 'prime-numbers', name: 'Prime numbers', re: /\bprime (?:numbers?|factors?|gaps?|divisors?)\b|\bprimes\b|totient|twin prime/i, summary: true, blurb: 'Results about prime numbers: how they are spaced, how they divide other numbers and how they are counted.' },
  { slug: 'graph-theory', name: 'Graph theory', re: /\bgraphs?\b|hypergraph|subgraph|chromatic|\bclique/i, summary: true, blurb: 'A graph is a set of dots joined by lines. Graph theory studies colourings, cycles and patterns in these networks.' },
  { slug: 'distances-and-packing', name: 'Distances and packing', re: /distinct distances|unit[- ]distance|sphere packing|\bpacking|kissing number/i, summary: true, blurb: 'How points can be spread out, how often a distance can repeat and how tightly shapes can be packed.' },
  { slug: 'random-walks-and-markov-chains', name: 'Random walks and Markov chains', re: /markov|random walk|mixing time/i, summary: true, blurb: 'Processes that move step by step at random, and how fast they forget where they started.' },
  { slug: 'curvature-and-geometric-flows', name: 'Curvature and geometric flows', re: /curvature|ricci|minimal surface|mean curvature flow/i, summary: true, blurb: 'How curved a space or surface is, and what happens when a shape is smoothed over time by a flow.' },
  { slug: 'eigenvalues-and-spectral-theory', name: 'Eigenvalues and spectral theory', re: /eigenvalue|spectral gap|laplacian/i, summary: true, blurb: 'Eigenvalues are the special numbers that describe how a system vibrates or spreads. Spectral theory studies them.' },
  { slug: 'elliptic-curves-and-abelian-varieties', name: 'Elliptic curves and abelian varieties', re: /elliptic curve|abelian variet|modular form/i, summary: true, blurb: 'Curves and higher-dimensional shapes defined by polynomial equations that also carry a way to add points.' },
  { slug: 'quantum', name: 'Quantum theory', re: /quantum/i, summary: true, blurb: 'Mathematics behind quantum mechanics and quantum information: states, measurements and quantum channels.' },
  { slug: 'additive-combinatorics', name: 'Additive combinatorics', re: /sumset|szemer[ée]di|arithmetic progression|additive combinatoric|sum-free|sidon/i, summary: true, blurb: 'What patterns, such as evenly spaced runs of numbers, must appear in large sets of integers.' },
  { slug: 'knots-and-3-manifolds', name: 'Knots and 3-manifolds', re: /\bknots?\b|3-manifold|three-manifold/i, summary: true, blurb: 'Knotted loops in space and the three-dimensional shapes they live in.' },
];

export const ERA_FLOOR = 1940;

export function firstYear(entry: Entry | null | undefined): number | null {
  const m = /\b(1[5-9]\d\d|20\d\d)\b/.exec(entry?.scorecard.firstStep ?? '');
  return m ? Number(m[1]) : null;
}

export function eraSlug(year: number): string {
  return year < ERA_FLOOR ? `before-${ERA_FLOOR}` : `${Math.floor(year / 10) * 10}s`;
}

export function eraName(slug: string): string {
  return slug.startsWith('before-') ? `Before ${slug.slice(7)}` : `The ${slug}`;
}

export const TRUST_HUBS: Record<string, { slug: string; name: string; blurb: string }> = {
  formal: { slug: 'lean-checked', name: 'Lean-checked results', blurb: 'OpenAI lists a formal proof for these results: a proof written in the Lean language and checked by a computer, step by step. What exactly Lean checked is stated on each entry.' },
  partial: { slug: 'partly-formalized', name: 'Partly formalized results', blurb: 'Part of the argument has been checked by a computer in Lean; the rest rests on the paper.' },
  claimed: { slug: 'claimed', name: 'Claimed, not yet checked', blurb: 'These results are claimed in a paper but no formal proof is listed, so they rest on the written argument until experts or a proof checker confirm them.' },
};

export const SIGNIFICANCE_HUBS: Record<string, { slug: string; blurb: string }> = {
  Landmark: { slug: 'landmark', blurb: 'Results rated Landmark: answers to well-known, long-standing questions in their field.' },
  Major: { slug: 'major', blurb: 'Results rated Major: they settle a recognised open question or substantially improve the best known answer.' },
  Solid: { slug: 'solid', blurb: 'Results rated Solid: real progress on narrower or more technical questions.' },
  Niche: { slug: 'niche', blurb: 'Results rated Niche: specialised questions of interest to a small community.' },
};

const topicCache = new WeakMap<object, string[]>();
export function topicsFor(f: Family): string[] {
  const hit = topicCache.get(f);
  if (hit) return hit;
  const out = computeTopics(f);
  topicCache.set(f, out);
  return out;
}

function computeTopics(f: Family): string[] {
  const t = plainTitle(f);
  const s = toPlain(stripTags(f.summary));
  return TOPICS.filter((d) => d.re.test(t) || (d.summary && d.re.test(s))).map((d) => d.slug);
}

/** Every hub with at least HUB_MIN entries, in a stable order. Fields are separate (existing pages). */
const hubCache = new WeakMap<object, WeakMap<object, Hub[]>>();
export function buildHubs(catalog: Catalog, explained: Map<string, Entry>): Hub[] {
  const byCat = hubCache.get(catalog) ?? new WeakMap<object, Hub[]>();
  hubCache.set(catalog, byCat);
  const hit = byCat.get(explained);
  if (hit) return hit;
  const out = computeHubs(catalog, explained);
  byCat.set(explained, out);
  return out;
}

function computeHubs(catalog: Catalog, explained: Map<string, Entry>): Hub[] {
  const fams = [...catalog.families].sort((a, b) => a.id.localeCompare(b.id));
  const hubs: Hub[] = [];

  for (const d of TOPICS) {
    const ids = fams.filter((f) => topicsFor(f).includes(d.slug)).map((f) => f.id);
    hubs.push({ kind: 'topic', slug: d.slug, name: d.name, heading: d.name, blurb: d.blurb, path: `/topic/${d.slug}/`, ids });
  }

  const eras = new Map<string, string[]>();
  for (const f of fams) {
    const y = firstYear(explained.get(f.id));
    if (y === null) continue;
    const k = eraSlug(y);
    eras.set(k, [...(eras.get(k) ?? []), f.id]);
  }
  const eraKeys = [...eras.keys()].sort((a, b) => (a.startsWith('before') ? -1 : b.startsWith('before') ? 1 : a.localeCompare(b)));
  for (const k of eraKeys) {
    const label = k.startsWith('before') ? `before ${k.slice(7)}` : `the ${k}`;
    hubs.push({
      kind: 'era',
      slug: k,
      name: `Open since ${label}`,
      heading: `Open problems from ${label}`,
      blurb: `Results on questions first raised ${label}, going by the earliest step each entry records.`,
      path: `/open-since/${k}/`,
      ids: eras.get(k)!,
    });
  }

  for (const [key, def] of Object.entries(TRUST_HUBS)) {
    const ids = fams.filter((f) => f.trust === key).map((f) => f.id);
    hubs.push({ kind: 'trust', slug: def.slug, name: def.name, heading: def.name, blurb: def.blurb, path: `/trust/${def.slug}/`, ids });
  }

  for (const [label, def] of Object.entries(SIGNIFICANCE_HUBS)) {
    const ids = fams.filter((f) => explained.get(f.id)?.scorecard.significance === label).map((f) => f.id);
    hubs.push({ kind: 'significance', slug: def.slug, name: `${label} results`, heading: `${label} results`, blurb: def.blurb, path: `/significance/${def.slug}/`, ids });
  }

  const total = catalog.families.length;
  return hubs.filter((h) => h.ids.length >= HUB_MIN && h.ids.length <= total * HUB_MAX_SHARE);
}

export const HUB_KIND_LABEL: Record<HubKind, string> = {
  topic: 'Topic',
  era: 'Era',
  trust: 'Trust',
  significance: 'Significance',
};

export const hubKey = (h: Pick<Hub, 'kind' | 'slug'>) => `${h.kind}-${h.slug}`;

/** Hubs one result belongs to (for entry pages). */
export function hubsForId(hubs: Hub[], id: string): Hub[] {
  return hubs.filter((h) => h.ids.includes(id));
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function listWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export interface IntroLink {
  text: string;
  id?: string;
}

/**
 * Data-generated intro for a hub or field page, as text parts so the page can
 * link entry titles. Every number is computed from the catalog.
 */
export function hubIntro(
  families: Family[],
  explained: Map<string, Entry>,
  opts: { scope: string; showFields?: boolean },
): IntroLink[] {
  const n = families.length;
  const formal = families.filter((f) => f.trust === 'formal').length;
  const claimed = families.filter((f) => f.trust === 'claimed').length;
  const papers = families.reduce((k, f) => k + f.papers.length, 0);
  const parts: IntroLink[] = [];
  parts.push({ text: `${plural(n, 'AI-made result')} ${opts.scope}, from ${plural(papers, 'paper')} in the OpenAI math collection, each explained in plain English. ` });
  if (formal && claimed) parts.push({ text: `${formal} ${formal === 1 ? 'has' : 'have'} a formal Lean proof listed; ${claimed} ${claimed === 1 ? 'is' : 'are'} claimed in a paper and not yet machine-checked. ` });
  else if (formal) parts.push({ text: `All of them have a formal Lean proof listed. ` });
  else if (claimed) parts.push({ text: `None has a formal proof listed yet; all are claimed in a paper. ` });

  if (opts.showFields) {
    const byField = new Map<string, number>();
    for (const f of families) byField.set(f.subject, (byField.get(f.subject) ?? 0) + 1);
    const top = [...byField.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (top.length > 1) {
      parts.push({ text: `They span ${plural(top.length, 'field')}, led by ${listWords(top.slice(0, 3).map(([s, c]) => `${s.toLowerCase()} (${c})`))}. ` });
    }
  }

  const dated = families
    .map((f) => ({ f, y: firstYear(explained.get(f.id)) }))
    .filter((x): x is { f: Family; y: number } => x.y !== null)
    .sort((a, b) => a.y - b.y || a.f.id.localeCompare(b.f.id));
  if (dated.length) {
    parts.push({ text: `The oldest question here dates back to ${dated[0].y}: ` });
    parts.push({ text: plainTitle(dated[0].f), id: dated[0].f.id });
    parts.push({ text: '. ' });
  }

  const landmarks = families.filter((f) => explained.get(f.id)?.scorecard.significance === 'Landmark' && f.id !== dated[0]?.f.id).slice(0, 2);
  if (landmarks.length) {
    parts.push({ text: landmarks.length === 1 ? 'Rated Landmark: ' : 'Results rated Landmark include ' });
    landmarks.forEach((f, i) => {
      if (i > 0) parts.push({ text: ' and ' });
      parts.push({ text: plainTitle(f), id: f.id });
    });
    parts.push({ text: '.' });
  }
  return parts;
}

export function introText(parts: IntroLink[]): string {
  return parts.map((p) => p.text).join('').trim();
}

/**
 * 3–6 related results: shared topics weigh most, then same field, then same era,
 * ties broken by catalog proximity. Always returns at least `min` when possible.
 */
export function relatedIds(
  catalog: Catalog,
  explained: Map<string, Entry>,
  id: string,
  max = 5,
  min = 3,
): string[] {
  const self = catalog.families.find((f) => f.id === id);
  if (!self) return [];
  const myTopics = new Set(topicsFor(self));
  const myYear = firstYear(explained.get(id));
  const myEra = myYear === null ? null : eraSlug(myYear);
  const scored = catalog.families
    .filter((f) => f.id !== id)
    .map((f) => {
      let s = 0;
      for (const t of topicsFor(f)) if (myTopics.has(t)) s += 3;
      if (f.subject === self.subject) s += 2;
      const y = firstYear(explained.get(f.id));
      if (myEra && y !== null && eraSlug(y) === myEra) s += 1;
      return { id: f.id, s, d: Math.abs(Number(f.id) - Number(id)) };
    })
    .sort((a, b) => b.s - a.s || a.d - b.d);
  const strong = scored.filter((x) => x.s >= 2).slice(0, max);
  const out = strong.length >= min ? strong : scored.slice(0, min);
  return out.map((x) => x.id);
}

export { slugify };
