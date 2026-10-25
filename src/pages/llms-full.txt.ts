/**
 * llms-full.txt: the pages llms.txt links to, rendered by the markdown registry and
 * concatenated, plus as many full entries as fit under the size limit.
 */
import type { APIRoute } from 'astro';
import { mdContext } from '../lib/md/load.js';
import { buildLlmsFull, LLMS_FULL_MAX } from '../lib/md/site-files.js';

export const GET: APIRoute = async () => {
  const full = buildLlmsFull(await mdContext(), { generated: new Date().toISOString().slice(0, 10) });
  if (full.truncated) {
    console.warn(
      `[llms-full.txt] truncated at ${LLMS_FULL_MAX.toLocaleString('en-US')} chars: ${full.entriesIncluded} of ${full.entriesTotal} entries included (${full.text.length.toLocaleString('en-US')} chars). The rest are in /archive.md and /data/entries.json.`,
    );
  }
  return new Response(full.text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
