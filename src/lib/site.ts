/**
 * Build-time catalog access. All counts computed, never hard-coded (§4.7).
 */
import { getCollection } from 'astro:content';
import catalogJson from '../data/catalog.json';
import type { Catalog, Family } from './catalog.js';
import type { Entry } from './entry.js';
import { globalIdFor } from './ids.js';
import { slugify } from './slug.js';

export const catalog = catalogJson as Catalog;

export const families: Family[] = [...catalog.families].sort((a, b) => a.id.localeCompare(b.id));

export const familiesById = new Map(families.map((f) => [f.id, f]));

/** Explained entries by NNN id (Astro content collection, zod-validated). */
export async function loadExplained(): Promise<Map<string, Entry>> {
  const raw: Array<{ data: Entry }> = await getCollection('entries');
  return new Map(raw.map((item) => [item.data.id, item.data]));
}

export async function loadExplainedIds(): Promise<Set<string>> {
  return new Set((await loadExplained()).keys());
}

export interface Stats {
  papers: number;
  results: number;
  formalPapers: number;
  subjects: number;
}

export function computeStats(list: Family[] = families): Stats {
  const papers = list.flatMap((f) => f.papers);
  return {
    papers: papers.length,
    results: list.length,
    formalPapers: papers.filter((p) => p.lean).length,
    subjects: new Set(list.map((f) => f.subject)).size,
  };
}

/** Families of one collection (multi-lab ready). */
export function collectionFamilies(): Family[] {
  return families;
}

export function fieldSlug(subject: string): string {
  return slugify(subject);
}

/** Resolve `/science/mathematics/<field-slug>/` back to the subject name. */
export function subjectBySlug(slug: string): string | null {
  return catalog.subjects.find((s) => slugify(s) === slug) ?? null;
}

/** Prefix an app-absolute path with the configured base (GH Pages safe). */
export function appUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${b}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Absolute URL for share links and canonical tags. */
export function absoluteUrl(path: string): string {
  const site = (import.meta.env.SITE as string | undefined) ?? 'https://example.github.io';
  return `${site.replace(/\/$/, '')}${appUrl(path)}`;
}

export function entryUrl(family: Pick<Family, 'id'>, collection: string = catalog.collection): string {
  return appUrl(`/e/${globalIdFor(collection, family.id)}/`);
}

export function fieldUrl(subject: string, science: string = catalog.science): string {
  return appUrl(`/science/${science}/${slugify(subject)}/`);
}

/** Prev/next neighbors in catalog order (global ids sort with NNN). */
export function neighbors(id: string): { prev: Family | null; next: Family | null } {
  const i = families.findIndex((f) => f.id === id);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? families[i - 1] : null,
    next: i < families.length - 1 ? families[i + 1] : null,
  };
}
