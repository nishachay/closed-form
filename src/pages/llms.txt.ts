/**
 * llms.txt (https://llmstxt.org): a plain-markdown map of the site for language models.
 * Every count and link is generated from the catalog.
 */
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { absoluteUrl, catalog, computeStats, fieldUrl } from '../lib/site.js';
import { buildHubs, type HubKind } from '../lib/seo.js';
import type { Entry } from '../lib/entry.js';

export const GET: APIRoute = async () => {
  const raw: Array<{ data: Entry }> = await getCollection('entries');
  const explained = new Map(raw.map((i) => [i.data.id, i.data]));
  const hubs = buildHubs(catalog, explained);
  const stats = computeStats();
  const section = (kind: HubKind, title: string) => {
    const items = hubs.filter((h) => h.kind === kind);
    if (!items.length) return '';
    return `## ${title}\n\n${items.map((h) => `- [${h.name}](${absoluteUrl(h.path)}): ${h.ids.length} results. ${h.blurb}`).join('\n')}\n\n`;
  };
  const fields = catalog.subjects
    .map((s) => `- [${s}](${absoluteUrl(fieldUrl(s))}): ${catalog.families.filter((f) => f.subject === s).length} results`)
    .join('\n');
  const body = `# Closed Form

> Plain-English explanations of every AI-made mathematics result in the OpenAI math collection: ${stats.results} results from ${stats.papers} papers across ${stats.subjects} fields. Each entry says what the paper claims, what was known before, what it does not show, and how far it can be trusted (Lean-checked or claimed). Explanations are written by AI and checked against the paper; papers are by OpenAI (Apache-2.0); explanations are CC BY 4.0.

Each result has a page at ${absoluteUrl('/e/')}<collection>-<NNN>/ (for example ${absoluteUrl('/e/openai-math-2026-001/')}). Trust labels: "Formal proof listed" means OpenAI lists a Lean proof; "Claimed, not checked" means the result rests on the written paper.

## Start here

- [Home](${absoluteUrl('/')})
- [Archive of all results](${absoluteUrl('/archive/')}): searchable, with trust filters
- [Browse by topic](${absoluteUrl('/topics/')})
- [About and methodology](${absoluteUrl('/about/')})
- [RSS feed](${absoluteUrl('/feed.xml')})

## Data

- [All entries as JSON](${absoluteUrl('/data/entries.json')})
- [Catalog as JSON](${absoluteUrl('/data/catalog.json')})
- [Fields as JSON](${absoluteUrl('/data/fields.json')})

${section('topic', 'Topics and problem families')}${section('era', 'By how long the question was open')}${section('significance', 'By significance')}${section('trust', 'By trust label')}## Fields

${fields}

## Optional

- [Source code](https://github.com/nishachay/closed-form)
- [Original papers: openai/math](https://github.com/openai/math)
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
