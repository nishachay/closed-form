/**
 * Titles, descriptions and copy shared by an HTML page and its markdown twin
 * (src/lib/md). One source, so /x/ and /x.md never say different things.
 * No Astro imports, so vitest covers it.
 */
import type { Catalog, Family } from './catalog.js';
import type { Hub, HubKind } from './seo.js';
import type { Stats } from './names.js';

export const HOME_TITLE = 'AI mathematics, explained';
export const HOME_FULL_TITLE = 'Closed Form: AI math results, explained in plain English';
export const homeDescription = (stats: Stats) =>
  `All ${stats.results} results an OpenAI model produced on open math problems, from Erdős problems to number theory, explained in plain words with honest trust labels.`;

export const ABOUT_DESCRIPTION = 'Why Closed Form exists, what the trust labels mean, and how entries are made.';

export const ARCHIVE_FULL_TITLE = 'All AI math results: searchable archive — Closed Form';
export const archiveDescription = (results: number) =>
  `Search and filter all ${results} AI-made math results by field and trust label. Every result is explained in plain English, with sources.`;

export const TOPICS_TITLE = 'Browse AI math results by topic';
export const topicsDescription = (results: number) =>
  `Browse ${results} AI-made math results by topic, problem family, decade, field and trust label, each explained in plain English.`;
export const TOPIC_GROUPS: Array<{ kind: HubKind; title: string }> = [
  { kind: 'topic', title: 'Topics and problem families' },
  { kind: 'era', title: 'How long the question was open' },
  { kind: 'significance', title: 'Significance' },
  { kind: 'trust', title: 'Trust label' },
];

export const collectionDescription = (stats: Stats) => `${stats.results} results, ${stats.papers} papers, honest trust labels.`;
export const labDescription = (lab: string) => `AI-made mathematics from ${lab}, explained in plain words with honest trust labels.`;
export const scienceDescription = (science: string) => `AI-made ${science.toLowerCase()}, explained in plain words with honest trust labels.`;

export const fieldTitleName = (subject: string) => `${subject}: AI results explained`;
export const fieldDescription = (subject: string, count: number) =>
  `${count} AI-made results in ${subject.toLowerCase()}, each explained in plain English with its trust label, Lean status and sources.`;

/** Related links on a field page: hubs sharing ≥2 of its results, and the three largest other fields. */
export function fieldRelated(catalog: Catalog, hubs: Hub[], subject: string) {
  const ids = new Set(catalog.families.filter((f) => f.subject === subject).map((f) => f.id));
  const related = hubs
    .map((h) => ({ h, o: h.ids.filter((id) => ids.has(id)).length }))
    .filter((x) => x.o >= 2)
    .sort((a, b) => b.o - a.o)
    .slice(0, 6);
  const otherFields = catalog.subjects
    .filter((s) => s !== subject)
    .map((s) => ({ s, n: catalog.families.filter((f) => f.subject === s).length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 3);
  return { related, otherFields };
}

const PROPER = ['Erdős', 'Ramsey'];

export interface HubMeta {
  /** Hub name with its first word lower-cased unless it is a proper name. */
  lowerName: string;
  /** Scope phrase for hubIntro(). */
  scope: string;
  /** Name fitted into <title>. */
  titleName: string;
  description: string;
}

export function hubMeta(hub: Pick<Hub, 'kind' | 'name' | 'heading' | 'blurb'>, list: Family[]): HubMeta {
  const { kind } = hub;
  const lowerName = hub.name.replace(/^\S+/, (w) => (PROPER.includes(w) ? w : w.toLowerCase()));
  const scope =
    kind === 'era'
      ? `on questions first raised ${hub.name.replace(/^Open since /, '')}`
      : kind === 'topic'
        ? `on ${lowerName}`
        : kind === 'trust'
          ? 'with this trust label'
          : `rated ${hub.name.replace(/ results$/, '')}`;
  const titleName = kind === 'topic' ? `${hub.name}: AI results explained` : kind === 'era' ? `${hub.heading}, explained` : `${hub.name}: AI math`;
  const lead =
    kind === 'topic'
      ? `${list.length} AI-made results on ${lowerName}`
      : kind === 'era'
        ? `${list.length} AI-made results on questions first raised ${hub.name.replace(/^Open since /, '')}`
        : kind === 'trust'
          ? `${list.length} AI-made math results: ${lowerName}`
          : `${list.length} AI-made math results rated ${hub.name.replace(/ results$/, '')}`;
  return { lowerName, scope, titleName, description: `${lead}, each explained in plain English. ${hub.blurb}` };
}

/** Related hubs for a hub page: other hubs sharing ≥2 results (most first), then siblings of the same kind. */
export function hubRelated(hubs: Hub[], hub: Hub): Hub[] {
  const mine = new Set(hub.ids);
  const overlap = (ids: string[]) => ids.filter((id) => mine.has(id)).length;
  const siblings = hubs.filter((h) => h.kind === hub.kind && h !== hub).slice(0, 6);
  const cross = hubs
    .filter((h) => h.kind !== hub.kind)
    .map((h) => ({ h, o: overlap(h.ids) }))
    .filter((x) => x.o >= 2)
    .sort((a, b) => b.o - a.o)
    .slice(0, 4)
    .map((x) => x.h);
  return [...cross, ...siblings];
}

/** Fields most represented in a list of results: [subject, count], most first. */
export function topFields(list: Family[], n = 3): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const f of list) counts.set(f.subject, (counts.get(f.subject) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

/** About page: what each trust label means (site copy). */
export const TRUST_MEANING: Record<string, string> = {
  formal:
    'At least one paper in the result is listed in the repository’s Lean catalogue, or its Lean notes link a Comparator challenge for a main result: a computer-checkable proof. A listing is not the same as an independent check.',
  partial: 'The result links to Lean notes, but no listed proof or Comparator challenge for a main result.',
  claimed: 'Only the written paper exists. No computer has checked it, and it could contain errors.',
};
