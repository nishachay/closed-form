/**
 * Build-time catalog access. All counts computed, never hard-coded (§4.7).
 */
import { getCollection } from 'astro:content';
import catalogJson from '../data/catalog.json';
import type { Catalog, Family } from './catalog.js';
import type { Entry } from './entry.js';
import { slugify } from './slug.js';

export { absoluteUrl, appUrl } from './urls.js';
export { collectionName, computeStats, entryUrl, fieldUrl, LAB_NAMES, labName, scienceName, type Stats } from './names.js';

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

/** Prev/next neighbors in catalog order (global ids sort with NNN). */
export function neighbors(id: string): { prev: Family | null; next: Family | null } {
  const i = families.findIndex((f) => f.id === id);
  if (i < 0) return { prev: null, next: null };
  return {
    prev: i > 0 ? families[i - 1] : null,
    next: i < families.length - 1 ? families[i + 1] : null,
  };
}
