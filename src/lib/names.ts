/**
 * Catalog names, counts and URLs with no Astro imports, so build-time endpoints
 * and vitest share them. src/lib/site.ts re-exports these for pages.
 */
import catalogJson from '../data/catalog.json';
import type { Catalog, Family } from './catalog.js';
import { globalIdFor } from './ids.js';
import { slugify } from './slug.js';
import { appUrl } from './urls.js';

const defaultCatalog = catalogJson as unknown as Catalog;

export interface Stats {
  papers: number;
  results: number;
  formalPapers: number;
  subjects: number;
}

export function computeStats(list: Family[] = defaultCatalog.families): Stats {
  const papers = list.flatMap((f) => f.papers);
  return {
    papers: papers.length,
    results: list.length,
    formalPapers: papers.filter((p) => p.lean).length,
    subjects: new Set(list.map((f) => f.subject)).size,
  };
}

export function entryUrl(family: Pick<Family, 'id'>, collection: string = defaultCatalog.collection): string {
  return appUrl(`/e/${globalIdFor(collection, family.id)}/`);
}

export function fieldUrl(subject: string, science: string = defaultCatalog.science): string {
  return appUrl(`/science/${science}/${slugify(subject)}/`);
}

/** Human names for hub pages (slugs stay in URLs only). */
export const LAB_NAMES: Record<string, string> = { openai: 'OpenAI' };
export const labName = (lab: string = defaultCatalog.lab) => LAB_NAMES[lab] ?? lab;
export const scienceName = (s: string = defaultCatalog.science) => s.charAt(0).toUpperCase() + s.slice(1);
/** "openai-math-2026" → "OpenAI Math 2026". */
export const collectionName = (c: string = defaultCatalog.collection) =>
  c
    .split('-')
    .map((w) => LAB_NAMES[w] ?? (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
