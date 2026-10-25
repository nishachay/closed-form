/**
 * llms.txt (https://llmstxt.org): a plain-markdown map of the site for language models.
 * Every count and link is generated from the catalog; page links point at the .md versions.
 */
import type { APIRoute } from 'astro';
import { mdContext } from '../lib/md/load.js';
import { buildLlmsTxt } from '../lib/md/site-files.js';

export const GET: APIRoute = async () =>
  new Response(buildLlmsTxt(await mdContext()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
