/**
 * Share helpers (Phase 3): RSS feed + public JSON builders.
 *
 * Pure functions over catalog + explained entries so vitest can cover them
 * without a running Astro build.
 */
import type { Catalog } from './catalog.js';
import type { Entry } from './entry.js';
import { globalIdFor } from './ids.js';
import { slugify } from './slug.js';
import { trustLevel } from './trust.js';

export function entryAbsoluteUrl(
  site: string,
  base: string,
  collection: string,
  id: string,
): string {
  const b = base.endsWith('/') && base !== '/' ? base.slice(0, -1) : base === '/' ? '' : base;
  return `${site.replace(/\/$/, '')}${b}/e/${globalIdFor(collection, id)}/`;
}

export interface FeedItem {
  id: string;
  headline: string;
  url: string;
  pubDate: string;
}

/** Newest first: reviewedAt desc when present, else numeric id desc (§13). */
export function buildFeedItems(
  catalog: Catalog,
  explained: Entry[],
  site: string,
  base: string,
): FeedItem[] {
  const fallback = catalog.source.fetchedAt;
  return [...explained]
    .sort((a, b) => {
      const da = (a as { reviewedAt?: string }).reviewedAt ?? '';
      const db = (b as { reviewedAt?: string }).reviewedAt ?? '';
      if (da && db && da !== db) return db.localeCompare(da);
      if (da && !db) return -1;
      if (!da && db) return 1;
      return b.id.localeCompare(a.id);
    })
    .map((e) => ({
      id: e.id,
      headline: e.headline,
      url: entryAbsoluteUrl(site, base, catalog.collection, e.id),
      pubDate: (e as { reviewedAt?: string }).reviewedAt ?? fallback,
    }));
}

export function buildFeedXml(items: FeedItem[], site: string, base: string): string {
  const b = base.endsWith('/') && base !== '/' ? base.slice(0, -1) : base === '/' ? '' : base;
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const channelLink = `${site.replace(/\/$/, '')}${b}/`;
  const rows = items
    .map(
      (i) => `    <item>
      <title>${esc(`${i.id} · ${i.headline}`)}</title>
      <link>${esc(i.url)}</link>
      <guid>${esc(i.url)}</guid>
      <pubDate>${esc(new Date(i.pubDate).toUTCString())}</pubDate>
    </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Closed Form — AI mathematics, explained</title>
    <link>${esc(channelLink)}</link>
    <description>Newly explained entries from Closed Form, newest first.</description>
${rows}
  </channel>
</rss>
`;
}

export interface FieldRow {
  field: string;
  slug: string;
  collection: string;
  lab: string;
  science: string;
  results: number;
  papers: number;
  trust: { formal: number; partial: number; claimed: number };
}

export function buildFieldsJson(catalog: Catalog): FieldRow[] {
  return catalog.subjects.map((subject) => {
    const fams = catalog.families.filter((f) => f.subject === subject);
    return {
      field: subject,
      slug: slugify(subject),
      collection: catalog.collection,
      lab: catalog.lab,
      science: catalog.science,
      results: fams.length,
      papers: fams.reduce((n, f) => n + f.papers.length, 0),
      trust: {
        formal: fams.filter((f) => f.trust === 'formal').length,
        partial: fams.filter((f) => f.trust === 'partial').length,
        claimed: fams.filter((f) => f.trust === 'claimed').length,
      },
    };
  });
}

/** Share text per §13 (URLs are the /e/<global-id>/ form per §0). */
export function shareTextFor(
  headlineOrTitle: string,
  firstStep: string | undefined,
  url: string,
): string {
  return `${firstStep ? `Open since ${firstStep}. ` : ''}${headlineOrTitle} ∎ ${url}`;
}

export function trustLongLabel(key: string): string {
  return trustLevel(key).label;
}
