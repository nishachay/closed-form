import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { catalog, computeStats, familiesById } from '../../lib/site.js';
import { globalIdFor, parseGlobalId } from '../../lib/ids.js';
import { slugify } from '../../lib/slug.js';
import { trustLevel } from '../../lib/trust.js';
import { OG_HEIGHT, OG_WIDTH, ogPng, ogSvg, wrapHeadline } from '../../lib/og.js';
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
      kicker: 'AI mathematics, explained',
      headlineLines: wrapHeadline('Every discovery AI makes, explained and checked.'),
      footer: `${stats.results} results · ${stats.papers} papers · honest trust labels`,
    };
  } else if (key === `collection-${catalog.collection}`) {
    card = {
      kicker: `Collection · ${catalog.collection}`,
      headlineLines: wrapHeadline(`The ${catalog.collection} collection.`),
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
      kicker: `Field · ${subject}`,
      headlineLines: wrapHeadline(`${subject}.`),
      footer: `${n} results · ${catalog.collection}`,
    };
  } else if (key.startsWith('entry-')) {
    const gid = key.slice('entry-'.length);
    const parsed = parseGlobalId(gid);
    const family = parsed ? familiesById.get(parsed.id) : undefined;
    if (!family) return new Response('Unknown entry', { status: 404 });
    const entry = explained.get(family.id) ?? null;
    const headline = entry?.headline ?? stripTags(family.title);
    card = {
      kicker: entry?.scorecard.firstStep
        ? `Open since ${entry.scorecard.firstStep}`
        : `Entry ${family.id}`,
      headlineLines: wrapHeadline(headline),
      footer: `${trustLevel(family.trust).label} · ${family.subject}`,
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
