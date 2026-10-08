/**
 * Shared collection types.
 *
 * Each lab adapter (openai-math, future labs) parses its own source
 * layout and outputs this shape. `scripts/ingest.ts` orchestrates
 * adapters and writes `src/data/catalog.json`.
 *
 * Design: one Catalog per collection. Multi-lab support = multiple
 * adapters + multiple catalog files, all validated against the same
 * entry schema (`src/lib/entry.ts`).
 */

export type TrustKey = 'formal' | 'partial' | 'claimed';

export interface CollectionMeta {
  /** Stable collection id, e.g. "openai-math-2026". */
  collection: string;
  /** Lab id, e.g. "openai". */
  lab: string;
  /** Science domain, e.g. "mathematics". */
  science: string;
  /** Source repo shorthand, e.g. "openai/math". */
  repo: string;
  /** SPDX license of the source, e.g. "Apache-2.0". */
  license: string;
}

export interface Paper {
  title: string;
  /** Full GitHub URL to the PDF. */
  pdf: string;
  /** Cleaned abstract (limited HTML, see adapter). */
  abstract: string;
  lean: boolean;
  /** ISO date YYYY-MM-DD from folder suffix, or null. */
  date: string | null;
}

export interface Family {
  id: string;
  title: string;
  summary: string;
  subject: string;
  papers: Paper[];
  /** Count of Lean-listed papers in this family. */
  lean: number;
  /** Relative path like "lean/docs/017.md", or null. */
  leanDoc: string | null;
  /** Full GitHub URL to reasoning trace PDF, if any. */
  trace?: string;
  trust: TrustKey;
}

export interface CatalogSource {
  repo: string;
  commit: string;
  fetchedAt: string;
}

export interface Catalog {
  source: CatalogSource;
  license: string;
  collection: string;
  lab: string;
  science: string;
  subjects: string[];
  families: Family[];
}

/** Adapter contract for pluggable labs. */
export interface CollectionAdapter {
  /** Adapter id, matches folder name under `ingest/`, e.g. "openai-math". */
  id: string;
  meta: CollectionMeta;
  parse(sourceDir: string): Promise<{ subjects: string[]; families: Family[] }>;
}
