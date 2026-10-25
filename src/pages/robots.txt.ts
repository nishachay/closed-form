/** robots.txt: everyone may crawl, AI search and training crawlers named explicitly. Keep in sync with llms.txt and ai.txt. */
import type { APIRoute } from 'astro';
import { buildRobots } from '../lib/md/site-files.js';

export const GET: APIRoute = () =>
  new Response(buildRobots(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
