/**
 * schema.org JSON-LD builders (pure). Rendered as non-executing
 * <script type="application/ld+json"> blocks, so they add no runtime JS.
 */
import type { Family } from './catalog.js';
import { toPlain } from './plain.js';

export type JsonLd = Record<string, unknown>;

const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

/** Safe for embedding inside a <script> element. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function organizationLd(site: string): JsonLd {
  return { '@context': 'https://schema.org', ...organization(site) };
}

export function organization(site: string): JsonLd {
  return {
    '@type': 'Organization',
    '@id': `${site}/#org`,
    name: 'Closed Form',
    url: `${site}/`,
    founder: { '@type': 'Person', name: 'Nishachay', url: 'https://x.com/ni5hachay', sameAs: ['https://github.com/nishachay', 'https://x.com/ni5hachay'] },
    sameAs: ['https://github.com/nishachay/closed-form'],
  };
}

export function website(site: string, description: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site}/#website`,
    name: 'Closed Form',
    url: `${site}/`,
    description,
    inLanguage: 'en',
    publisher: organization(site),
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${site}/archive/?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbs(items: Array<{ name: string; url: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
  };
}

/** The explainer page as a TechArticle that cites the result's paper(s) as ScholarlyArticles. */
export function entryArticle(opts: {
  site: string;
  url: string;
  headline: string;
  description: string;
  image: string;
  family: Family;
  keywords: string[];
}): JsonLd {
  const { site, url, family } = opts;
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    '@id': `${url}#article`,
    headline: opts.headline.length > 110 ? `${opts.headline.slice(0, 109)}…` : opts.headline,
    description: opts.description,
    url,
    mainEntityOfPage: url,
    image: opts.image,
    inLanguage: 'en',
    isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/',
    articleSection: family.subject,
    keywords: opts.keywords.join(', '),
    author: { '@id': `${site}/#org` },
    publisher: organization(site),
    isPartOf: { '@id': `${site}/#website` },
    about: { '@type': 'Thing', name: toPlain(stripTags(family.title)) },
    citation: family.papers.map((p) => ({
      '@type': 'ScholarlyArticle',
      name: toPlain(stripTags(p.title)),
      url: p.pdf,
      ...(p.date ? { datePublished: p.date } : {}),
      publisher: { '@type': 'Organization', name: 'OpenAI' },
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
    })),
  };
}

/** A hub or field page: a CollectionPage with an ItemList of its entries. */
export function collectionPage(opts: {
  url: string;
  name: string;
  description: string;
  site: string;
  items: Array<{ name: string; url: string }>;
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${opts.url}#page`,
    name: opts.name,
    description: opts.description,
    url: opts.url,
    inLanguage: 'en',
    isPartOf: { '@id': `${opts.site}/#website` },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: opts.items.length,
      itemListElement: opts.items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
    },
  };
}
