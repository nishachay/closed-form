import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { catalog } from '../lib/site.js';
import type { Entry } from '../lib/entry.js';
import { buildFeedItems, buildFeedXml } from '../lib/share.js';

export const GET: APIRoute = async () => {
  const site = import.meta.env.SITE ?? 'https://nishachay.github.io';
  const base = import.meta.env.BASE_URL ?? '/';
  const raw: Array<{ data: Entry }> = await getCollection('entries');
  const items = buildFeedItems(
    catalog,
    raw.map((r) => r.data),
    site,
    base,
  );
  return new Response(buildFeedXml(items, site, base), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
};
