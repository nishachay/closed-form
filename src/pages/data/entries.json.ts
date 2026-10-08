import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import type { Entry } from '../../lib/entry.js';

export const GET: APIRoute = async () => {
  const raw: Array<{ data: Entry }> = await getCollection('entries');
  const entries = raw.map((r) => r.data).sort((a, b) => a.id.localeCompare(b.id));
  return new Response(JSON.stringify(entries, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
