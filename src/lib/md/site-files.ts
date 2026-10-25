/**
 * Site-level files for language models and crawlers, generated from the catalog:
 * /llms.txt, /llms-full.txt, /ai.txt and /robots.txt. Pages come from the one
 * markdown registry (registry.ts), so every file describes the same site.
 *
 * Keep the three in sync: robots.txt says who may crawl, llms.txt maps the site,
 * ai.txt states how the content may be used. All share SITE_DESCRIPTION.
 * No Astro imports, so vitest covers them.
 */
import { computeStats, fieldUrl, type Stats } from '../names.js';
import { buildHubs, type HubKind } from '../seo.js';
import { absoluteUrl } from '../urls.js';
import { mdPathFor, type MdDoc } from './format.js';
import { allDocs, type MdContext, renderMd } from './registry.js';

export const REPO_URL = 'https://github.com/nishachay/closed-form';
export const SOURCE_REPO_URL = 'https://github.com/openai/math';
/** llms-full.txt stays under this many characters. */
export const LLMS_FULL_MAX = 500_000;

/** The one-paragraph site description shared by llms.txt, llms-full.txt and ai.txt. */
export function siteDescription(stats: Stats): string {
  return `Plain-English explanations of every AI-made mathematics result in the OpenAI math collection: ${stats.results} results from ${stats.papers} papers across ${stats.subjects} fields. Each entry says what the paper claims, what was known before, what it does not show, and how far it can be trusted (Lean-checked or claimed). Explanations are written by AI and checked against the paper; papers are by OpenAI (Apache-2.0); explanations are CC BY 4.0.`;
}

const md = (path: string) => absoluteUrl(mdPathFor(path));

/** Files listed under "## Machine-readable" in llms.txt. */
export function machineReadable(): Array<{ name: string; url: string; note: string }> {
  return [
    { name: 'llms-full.txt', url: absoluteUrl('/llms-full.txt'), note: 'core pages, hubs, fields and as many full entries as fit, in one file' },
    { name: 'ai.txt', url: absoluteUrl('/ai.txt'), note: 'how this content may be used by AI systems' },
    { name: 'Sitemap', url: absoluteUrl('/sitemap.xml'), note: 'every HTML page' },
    { name: 'All entries as JSON', url: absoluteUrl('/data/entries.json'), note: 'every explanation, with claims, quotes and sources' },
    { name: 'Catalog as JSON', url: absoluteUrl('/data/catalog.json'), note: 'every result and paper, with trust labels' },
    { name: 'Fields as JSON', url: absoluteUrl('/data/fields.json'), note: 'results per field' },
    { name: 'RSS feed', url: absoluteUrl('/feed.xml'), note: 'newly explained entries' },
  ];
}

// ---------------------------------------------------------------------------
// llms.txt
// ---------------------------------------------------------------------------

export function buildLlmsTxt(ctx: MdContext): string {
  const { catalog } = ctx;
  const hubs = buildHubs(catalog, ctx.explained);
  const stats = computeStats(catalog.families);
  const section = (kind: HubKind, title: string) => {
    const items = hubs.filter((h) => h.kind === kind);
    if (!items.length) return '';
    return `## ${title}\n\n${items.map((h) => `- [${h.name}](${md(h.path)}): ${h.ids.length} results. ${h.blurb}`).join('\n')}\n\n`;
  };
  const fields = catalog.subjects
    .map((s) => `- [${s}](${md(fieldUrl(s, catalog.science))}): ${catalog.families.filter((f) => f.subject === s).length} results`)
    .join('\n');
  return `# Closed Form

> ${siteDescription(stats)}

Each result has a page at ${absoluteUrl('/e/')}<collection>-<NNN>/ (for example ${absoluteUrl('/e/openai-math-2026-001/')}) and a markdown version at ${absoluteUrl('/e/')}<collection>-<NNN>.md (for example ${md('/e/openai-math-2026-001/')}). Every page listed here links to its markdown version; the HTML page is the same URL without ".md" (and "/index.md" is the home page). Trust labels: "Formal proof listed" means OpenAI lists a Lean proof; "Claimed, not checked" means the result rests on the written paper.

## Start here

- [Home](${md('/')})
- [Archive of all results](${md('/archive/')}): every result with a one-line summary and trust label
- [Browse by topic](${md('/topics/')})
- [About and methodology](${md('/about/')})

## Machine-readable

${machineReadable()
  .map((m) => `- [${m.name}](${m.url}): ${m.note}`)
  .join('\n')}

${section('topic', 'Topics and problem families')}${section('era', 'By how long the question was open')}${section('significance', 'By significance')}${section('trust', 'By trust label')}## Fields

${fields}

## Optional

- [Source code](${REPO_URL})
- [Original papers: openai/math](${SOURCE_REPO_URL})
`;
}

// ---------------------------------------------------------------------------
// llms-full.txt
// ---------------------------------------------------------------------------

export interface LlmsFull {
  text: string;
  /** Entry pages included in full, and how many exist. */
  entriesIncluded: number;
  entriesTotal: number;
  truncated: boolean;
}

const SIG_ORDER: Record<string, number> = { Landmark: 0, Major: 1, Solid: 2, Niche: 3 };

/**
 * Every page llms.txt links to (core pages, hubs, fields), rendered by the
 * registry, then as many entry pages as fit under `max` characters: Landmark
 * results first, then Major, Solid and Niche, by entry number.
 */
export function buildLlmsFull(ctx: MdContext, opts: { generated: string; max?: number }): LlmsFull {
  const max = opts.max ?? LLMS_FULL_MAX;
  // Hubs and fields list entry numbers only here: the archive page already lists every result once.
  const docs = allDocs({ ...ctx, compact: true });
  const isEntry = (d: MdDoc) => d.path.startsWith('/e/');
  const order = ['/', '/about/', '/topics/', '/archive/'];
  const corePages = [
    ...order.map((p) => docs.find((d) => d.path === p)).filter((d): d is MdDoc => !!d),
    ...docs.filter((d) => !isEntry(d) && !order.includes(d.path) && /^\/(topic|open-since|significance|trust)\//.test(d.path)),
    ...docs.filter((d) => !isEntry(d) && d.path.startsWith(`/science/${ctx.catalog.science}/`) && d.path !== `/science/${ctx.catalog.science}/`),
  ];
  const sig = (d: MdDoc) => {
    const id = /-(\d{3})\/$/.exec(d.path)?.[1] ?? '';
    return SIG_ORDER[ctx.explained.get(id)?.scorecard.significance ?? ''] ?? 9;
  };
  const entries = docs.filter(isEntry).sort((a, b) => sig(a) - sig(b) || a.path.localeCompare(b.path));
  const stats = computeStats(ctx.catalog.families);
  const chunk = (d: MdDoc) => `<!-- source: ${absoluteUrl(d.path)} -->\n\n${renderMd(d)}`;
  const sep = '\n---\n\n';

  const parts = corePages.map(chunk);
  let size = parts.reduce((n, p) => n + p.length + sep.length, 0);
  const headerRoom = 2_000;
  let included = 0;
  for (const d of entries) {
    const c = chunk(d);
    if (size + c.length + sep.length + headerRoom > max) break;
    parts.push(c);
    size += c.length + sep.length;
    included++;
  }
  const truncated = included < entries.length;
  const header = [
    '# Closed Form (full text)',
    '',
    `> ${siteDescription(stats)}`,
    '',
    `Generated: ${opts.generated}`,
    `Site: ${absoluteUrl('/')}`,
    `Map: ${absoluteUrl('/llms.txt')}`,
    '',
    `This file holds the markdown version of the core pages, every topic, era, significance and trust hub, and every field page (hubs and fields list entry numbers; the archive page lists every result with its title and summary)${
      truncated
        ? `, plus ${included} of ${entries.length} entry pages in full (Landmark results first, then Major, Solid and Niche). It is kept under ${max.toLocaleString('en-US')} characters, so the other ${entries.length - included} entries are not included here. Every entry is listed with a one-line summary in the archive (${absoluteUrl('/archive.md')}), each has its own markdown page at ${absoluteUrl('/e/')}<collection>-<NNN>.md, and all of them are in ${absoluteUrl('/data/entries.json')}.`
        : `, plus all ${entries.length} entry pages.`
    } Each page starts with a "<!-- source: URL -->" line naming its HTML page; pages are separated by "---".`,
    '',
  ].join('\n');
  return { text: `${header}${sep}${parts.join(sep)}`, entriesIncluded: included, entriesTotal: entries.length, truncated };
}

// ---------------------------------------------------------------------------
// ai.txt
// ---------------------------------------------------------------------------

export function buildAiTxt(ctx: MdContext, updated: string): string {
  const stats = computeStats(ctx.catalog.families);
  return `# ai.txt for Closed Form
# How AI systems may use this site's content.
# Generated from code (src/lib/md/site-files.ts). Keep in sync with /robots.txt
# (who may crawl) and /llms.txt (map of the site); all three share one description.

[identity]
name: Closed Form
url: ${absoluteUrl('/')}
description: ${siteDescription(stats)}
llms: ${absoluteUrl('/llms.txt')}
llms-full: ${absoluteUrl('/llms-full.txt')}

[permissions]
# Allowed for AI systems, search engines and assistants:
summarise: yes
quote: yes, with attribution
cite: yes
index-for-search: yes
use-in-answers: yes
training: yes, under the licences in [attribution]

[restrictions]
# Do not invent quotes, results or claims and attribute them to Closed Form or to the papers.
fabricated-quotes: no
# Do not present this content as the model's own work.
present-as-own: no
# Keep trust labels with any result you repeat: "Formal proof listed" and "Claimed, not checked" are not the same.
drop-trust-labels: no

[attribution]
# Credit "Closed Form" and link the canonical HTML page (the URL without ".md").
credit: Closed Form
link: canonical HTML URL of the page used, e.g. ${absoluteUrl('/e/openai-math-2026-001/')}
explanations-licence: CC BY 4.0
papers: by OpenAI, Apache-2.0 (${SOURCE_REPO_URL})

[scope]
# Covers every page and file on ${absoluteUrl('/')}: HTML pages, their .md versions,
# llms.txt, llms-full.txt and the JSON data under /data/.
content: ${stats.results} explained results from ${stats.papers} papers in the OpenAI math collection

[contact]
repository: ${REPO_URL}
issues: ${REPO_URL}/issues

Last updated: ${updated}
`;
}

// ---------------------------------------------------------------------------
// robots.txt
// ---------------------------------------------------------------------------

/** AI search and answer crawlers, then AI training crawlers. All allowed: the content is openly licensed. */
export const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User'];
export const AI_TRAINING_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot'];

export function buildRobots(): string {
  const group = (bots: string[]) => `${bots.map((b) => `User-agent: ${b}`).join('\n')}\nAllow: /`;
  return `# Closed Form. Explanations are CC BY 4.0; papers are by OpenAI (Apache-2.0).
# Map of the site for language models: ${absoluteUrl('/llms.txt')}
# How AI systems may use the content: ${absoluteUrl('/ai.txt')}
# Keep in sync with /llms.txt and /ai.txt (src/lib/md/site-files.ts).

User-agent: *
Allow: /

# AI search and answer crawlers
${group(AI_SEARCH_BOTS)}

# AI training crawlers (allowed: the content is openly licensed)
${group(AI_TRAINING_BOTS)}

Sitemap: ${absoluteUrl('/sitemap.xml')}
`;
}
