import type { APIRoute } from 'astro';
import { catalog } from '../../lib/site.js';

/** Full catalog, generated at build time from src/data/catalog.json (§20). */
export const GET: APIRoute = () => {
  return new Response(JSON.stringify(catalog, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
