/**
 * Build-time context for the markdown registry: catalog, explained entries
 * (Astro content collection) and git-based last-modified dates. Built once per build.
 */
import { getCollection } from 'astro:content';
import catalogJson from '../../data/catalog.json';
import type { Catalog } from '../catalog.js';
import type { Entry } from '../entry.js';
import { buildLastmodMap } from '../lastmod.js';
import { absoluteUrl } from '../urls.js';
import { htmlPathOf, mdPathFor } from './format.js';
import { allDocs, type MdContext } from './registry.js';

const catalog = catalogJson as unknown as Catalog;
let ctx: Promise<MdContext> | null = null;

export function mdContext(): Promise<MdContext> {
  ctx ??= (async () => {
    const raw: Array<{ data: Entry }> = await getCollection('entries');
    const explained = new Map(raw.map((i) => [i.data.id, i.data]));
    return { catalog, explained, lastmod: buildLastmodMap(process.cwd(), catalog) };
  })();
  return ctx;
}

let paths: Promise<Set<string>> | null = null;

/** Absolute URL of a page's markdown version, or null when it has none. */
export async function markdownHref(pathname: string): Promise<string | null> {
  paths ??= mdContext().then((c) => new Set(allDocs(c).map((d) => d.path)));
  const p = htmlPathOf(pathname);
  return (await paths).has(p) ? absoluteUrl(mdPathFor(p)) : null;
}

/** Newest content date on the site (YYYY-MM-DD), else today's. */
export async function siteUpdated(): Promise<string> {
  const c = await mdContext();
  return (c.lastmod.get('/') ?? new Date().toISOString()).slice(0, 10);
}
