/**
 * Share helpers (Phase 3): RSS feed + public JSON builders.
 *
 * Pure functions over catalog + explained entries so vitest can cover them
 * without a running Astro build.
 */
import type { Catalog } from "./catalog.js";
import type { Entry } from "./entry.js";
import { globalIdFor } from "./ids.js";
import { slugify } from "./slug.js";
import { trustLevel } from "./trust.js";

export function entryAbsoluteUrl(
  site: string,
  base: string,
  collection: string,
  id: string,
): string {
  const b =
    base.endsWith("/") && base !== "/"
      ? base.slice(0, -1)
      : base === "/"
        ? ""
        : base;
  return `${site.replace(/\/$/, "")}${b}/e/${globalIdFor(collection, id)}/`;
}

export interface FeedItem {
  id: string;
  headline: string;
  url: string;
  pubDate: string;
}

const TZ_OFFSET_MIN: Record<string, number> = {
  UTC: 0,
  GMT: 0,
  Z: 0,
  IST: 330,
  PST: -480,
  PDT: -420,
  EST: -300,
  EDT: -240,
  CET: 60,
  CEST: 120,
};

/**
 * Epoch ms for a stored timestamp, or NaN. Accepts ISO 8601 (with Z or +hh:mm
 * offset, or date only) and the display text form "Wed 2026-10-07 7:18 PM IST".
 * Never compare these strings lexically: offsets and weekday names break the order.
 */
export function parseStamp(raw: string | undefined): number {
  if (!raw) return NaN;
  const iso = Date.parse(raw);
  if (!Number.isNaN(iso) && /^\d{4}-\d{2}-\d{2}(T|$)/.test(raw)) return iso;
  const m = raw
    .trim()
    .match(
      /^(?:[A-Za-z]{3,9},?\s+)?(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?\s*([A-Za-z]{1,4}|[+-]\d{2}:?\d{2})?$/,
    );
  if (!m) return NaN;
  let h = Number(m[4]);
  if (m[7]) {
    const pm = m[7].toLowerCase() === "pm";
    if (h < 1 || h > 12) return NaN;
    h = (h % 12) + (pm ? 12 : 0);
  }
  let off = 0;
  const z = m[8];
  if (z) {
    if (/^[+-]/.test(z)) {
      const d = z.replace(":", "");
      off =
        (z[0] === "-" ? -1 : 1) *
        (Number(d.slice(1, 3)) * 60 + Number(d.slice(3, 5)));
    } else if (z.toUpperCase() in TZ_OFFSET_MIN)
      off = TZ_OFFSET_MIN[z.toUpperCase()];
    else return NaN;
  }
  return (
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      h,
      Number(m[5]),
      Number(m[6] ?? 0),
    ) -
    off * 60000
  );
}

/**
 * Newest first by first-publication date (§13): publishedAt, which is preserved
 * per entry, never a catalogue-refresh timestamp that would re-date old entries.
 * reviewedAt is a review event, not publication; it only breaks ties for entries
 * missing publishedAt. Dates are parsed to real instants before comparing.
 */
export function buildFeedItems(
  catalog: Catalog,
  explained: Entry[],
  site: string,
  base: string,
): FeedItem[] {
  const published = (e: Entry) =>
    parseStamp((e as { publishedAt?: string }).publishedAt);
  const reviewed = (e: Entry) =>
    parseStamp((e as { reviewedAt?: string }).reviewedAt);
  const fallback = parseStamp(catalog.source.fetchedAt);
  const when = (e: Entry) => {
    const p = published(e);
    if (!Number.isNaN(p)) return p;
    const r = reviewed(e);
    return Number.isNaN(r) ? fallback : r;
  };
  const cmp = (x: number, y: number) =>
    Number.isNaN(x) ? 0 : Number.isNaN(y) ? 0 : y - x;
  return [...explained]
    .sort((a, b) => {
      const pa = published(a);
      const pb = published(b);
      if (!Number.isNaN(pa) && Number.isNaN(pb)) return -1;
      if (Number.isNaN(pa) && !Number.isNaN(pb)) return 1;
      if (cmp(pa, pb)) return cmp(pa, pb);
      const ra = reviewed(a);
      const rb = reviewed(b);
      if (!Number.isNaN(ra) && Number.isNaN(rb)) return -1;
      if (Number.isNaN(ra) && !Number.isNaN(rb)) return 1;
      if (cmp(ra, rb)) return cmp(ra, rb);
      return b.id.localeCompare(a.id);
    })
    .map((e) => ({
      id: e.id,
      headline: e.headline,
      url: entryAbsoluteUrl(site, base, catalog.collection, e.id),
      pubDate: new Date(when(e)).toISOString(),
    }));
}

export function buildFeedXml(
  items: FeedItem[],
  site: string,
  base: string,
): string {
  const b =
    base.endsWith("/") && base !== "/"
      ? base.slice(0, -1)
      : base === "/"
        ? ""
        : base;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const channelLink = `${site.replace(/\/$/, "")}${b}/`;
  const rows = items
    .map(
      (i) => `    <item>
      <title>${esc(`${i.id} · ${i.headline}`)}</title>
      <link>${esc(i.url)}</link>
      <guid>${esc(i.url)}</guid>
      <pubDate>${esc(new Date(i.pubDate).toUTCString())}</pubDate>
    </item>`,
    )
    .join("\n");
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
        formal: fams.filter((f) => f.trust === "formal").length,
        partial: fams.filter((f) => f.trust === "partial").length,
        claimed: fams.filter((f) => f.trust === "claimed").length,
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
  return `${firstStep ? `Open since ${firstStep}. ` : ""}${headlineOrTitle} ∎ ${url}`;
}

export function trustLongLabel(key: string): string {
  return trustLevel(key).label;
}
