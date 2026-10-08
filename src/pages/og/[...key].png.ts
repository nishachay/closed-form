import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { catalog, collectionName, computeStats, familiesById } from '../../lib/site.js';
import { globalIdFor, parseGlobalId } from '../../lib/ids.js';
import { slugify } from '../../lib/slug.js';
import { trustLevel } from '../../lib/trust.js';
import { OG_HEIGHT, OG_WIDTH, ogPng, ogSvg, wrapHeadline } from '../../lib/og.js';
import { toPlain } from '../../lib/plain.js';
import type { Entry } from '../../lib/entry.js';

export async function getStaticPaths() {
  const keys = [
    'home',
    `collection-${catalog.collection}`,
    `lab-${catalog.lab}`,
    `science-${catalog.science}`,
    ...catalog.subjects.map((s) => `field-${slugify(s)}`),
    ...catalog.families.map((f) => `entry-${globalIdFor(catalog.collection, f.id)}`),
  ];
  return keys.map((key) => ({ params: { key } }));
}

const ORDER: Record<string, number> = { formal: 0, partial: 1, claimed: 2 };
const sortedCells = (fams: Array<{ trust: string }>) =>
  fams.map((f) => f.trust).sort((a, b) => (ORDER[a] ?? 3) - (ORDER[b] ?? 3));

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '');

export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? '';
  const raw: Array<{ data: Entry }> = await getCollection('entries');
  const explained = new Map(raw.map((i) => [i.data.id, i.data]));
  const stats = computeStats();

  let card;
  if (key === 'home') {
    // Lab-neutral home card (§0): no lab or collection names.
    card = {
      kicker: 'Every result, plain words',
      headlineLines: wrapHeadline('Every problem AI has solved, explained for everyone.', 22),
      footer: `${stats.results} results · ${stats.papers} papers · honest trust labels`,
      cells: sortedCells(catalog.families),
    };
  } else if (key === `collection-${catalog.collection}`) {
    card = {
      kicker: 'Collection',
      headlineLines: wrapHeadline(`${collectionName()}.`),
      footer: `${stats.results} results · ${stats.papers} papers · ${catalog.subjects.length} fields`,
    };
  } else if (key === `lab-${catalog.lab}`) {
    card = {
      kicker: 'Lab',
      headlineLines: wrapHeadline(catalog.lab === 'openai' ? 'OpenAI.' : `${catalog.lab}.`),
      footer: `${stats.results} results · ${stats.papers} papers`,
    };
  } else if (key === `science-${catalog.science}`) {
    card = {
      kicker: 'Science',
      headlineLines: wrapHeadline(
        catalog.science === 'mathematics' ? 'Mathematics.' : `${catalog.science}.`,
      ),
      footer: `${stats.results} results · ${catalog.subjects.length} fields`,
    };
  } else if (key.startsWith('field-')) {
    const slug = key.slice('field-'.length);
    const subject = catalog.subjects.find((s) => slugify(s) === slug);
    if (!subject) return new Response('Unknown OG card', { status: 404 });
    const n = catalog.families.filter((f) => f.subject === subject).length;
    card = {
      kicker: 'Field',
      headlineLines: wrapHeadline(`${subject}.`, 22),
      footer: `${n} results · ${catalog.families.filter((f) => f.subject === subject && f.trust === 'formal').length} with a formal proof`,
      cells: sortedCells(catalog.families.filter((f) => f.subject === subject)),
    };
  } else if (key.startsWith('entry-')) {
    const gid = key.slice('entry-'.length);
    const parsed = parseGlobalId(gid);
    const family = parsed ? familiesById.get(parsed.id) : undefined;
    if (!family) return new Response('Unknown entry', { status: 404 });
    const entry = explained.get(family.id) ?? null;
    const headline = toPlain(entry?.headline ?? stripTags(family.title));
    card = {
      kicker: entry?.scorecard.firstStep
        ? `Open since ${entry.scorecard.firstStep}`
        : family.subject,
      headlineLines: wrapHeadline(headline, 30),
      footer: `${trustLevel(family.trust).label} · ${family.papers.length} ${family.papers.length === 1 ? 'paper' : 'papers'}`,
      tag: `Entry ${family.id}`,
      trust: family.trust,
    };
  } else {
    return new Response('Unknown OG card', { status: 404 });
  }

  const png = ogPng(ogSvg(card));
  return new Response(png as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};

export const _OG_SIZE = { OG_WIDTH, OG_HEIGHT };
