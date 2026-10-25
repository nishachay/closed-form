/** ai.txt: how AI systems may use this content. Keep in sync with robots.txt and llms.txt. */
import type { APIRoute } from 'astro';
import { mdContext, siteUpdated } from '../lib/md/load.js';
import { buildAiTxt } from '../lib/md/site-files.js';

export const GET: APIRoute = async () =>
  new Response(buildAiTxt(await mdContext(), await siteUpdated()), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
