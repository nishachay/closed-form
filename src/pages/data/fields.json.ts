import type { APIRoute } from 'astro';
import { catalog } from '../../lib/site.js';
import { buildFieldsJson } from '../../lib/share.js';

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(buildFieldsJson(catalog), null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
