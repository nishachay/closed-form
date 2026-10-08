/**
 * UTC paper-date helpers (v5 eyebrow, card dates, archive "newest" sort).
 * A family's date is its earliest paper date; undated papers are ignored.
 */
import type { Family } from './catalog.js';

export function paperTime(iso: string | null): number {
  if (!iso) return NaN;
  const t = Date.parse(`${iso}T00:00:00Z`);
  return Number.isNaN(t) ? NaN : t;
}

export function familyTime(family: Family): number {
  const ts = family.papers.map((p) => paperTime(p.date)).filter((t) => !Number.isNaN(t));
  return ts.length > 0 ? Math.min(...ts) : NaN;
}

/** "Sep 24, 2026" in UTC. Empty string when undated. */
export function formatDay(iso: string | null): string {
  const t = paperTime(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Sep 10 – Oct 6, 2026" hero range across the catalog, UTC. */
export function collectionRange(families: Family[]): string {
  const ts = families.flatMap((f) => f.papers.map((p) => paperTime(p.date))).filter((t) => !Number.isNaN(t));
  if (ts.length === 0) return '';
  const lo = new Date(Math.min(...ts));
  const hi = new Date(Math.max(...ts));
  const m = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `${m(lo)} – ${m(hi)}, ${hi.getUTCFullYear()}`;
}
