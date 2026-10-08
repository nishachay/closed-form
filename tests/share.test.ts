import { describe, expect, it } from 'vitest';
import catalog from '../src/data/catalog.json';
import entry017 from '../src/content/entries/017.json';
import { escapeXml, OG_HEIGHT, OG_WIDTH, ogPng, ogSvg, wrapHeadline } from '../src/lib/og.js';
import {
  buildFeedItems,
  buildFeedXml,
  buildFieldsJson,
  entryAbsoluteUrl,
  shareTextFor,
} from '../src/lib/share.js';
import type { Entry } from '../src/lib/entry.js';

const SITE = 'https://example.github.io';
const BASE = '/closed-form';

describe('og cards (§14.6)', () => {
  it('is 1200x630', () => {
    const svg = ogSvg({ kicker: 'K', headlineLines: ['Hi'], footer: 'F' });
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(OG_WIDTH).toBe(1200);
    expect(OG_HEIGHT).toBe(630);
  });

  it('wraps headlines to max 3 lines', () => {
    const long =
      'Fractions can never get unusually close to pi no matter how hard anyone tries ever again truly';
    const lines = wrapHeadline(long);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(lines.join(' ').length).toBeLessThanOrEqual(long.length + 1);
  });

  it('escapes xml in all slots', () => {
    expect(escapeXml('a<b>&"\'c')).toBe('a&lt;b&gt;&amp;&quot;&#39;c');
    const svg = ogSvg({ kicker: 'A&B', headlineLines: ['x<y'], footer: 'f"oo' });
    expect(svg).not.toContain('A&B');
    expect(svg).toContain('A&amp;B');
  });

  it('shows a trust dot for entries, none for the lab-neutral home card', () => {
    const entry = ogSvg({
      kicker: 'Open since 1953',
      headlineLines: ['Fractions can never get unusually close.'],
      footer: 'Partly formalized · Number theory',
      trust: 'partial',
    });
    expect(entry).toContain('<circle');
    const home = ogSvg({
      kicker: 'AI mathematics, explained',
      headlineLines: ['Every discovery AI makes,'],
      footer: '372 results · 722 papers · honest trust labels',
    });
    expect(home).not.toContain('<circle>');
    expect(home).not.toContain('openai');
  });

  it('renders a valid PNG via resvg', () => {
    const png = ogPng(ogSvg({ kicker: 'K', headlineLines: ['Hi'], footer: 'F' }));
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
    expect(png.length).toBeGreaterThan(5000);
  });
});

describe('share links (§13, §0 urls)', () => {
  it('uses /e/<global-id>/ urls', () => {
    expect(entryAbsoluteUrl(SITE, BASE, 'openai-math-2026', '017')).toBe(
      'https://example.github.io/closed-form/e/openai-math-2026-017/',
    );
  });

  it('formats share text per §13', () => {
    expect(shareTextFor('Headline here.', '1953', 'https://x/e/')).toBe(
      'Open since 1953. Headline here. ∎ https://x/e/',
    );
    expect(shareTextFor('Headline here.', undefined, 'https://x/e/')).toBe(
      'Headline here. ∎ https://x/e/',
    );
  });
});

describe('rss feed (§13)', () => {
  const entries = [entry017 as unknown as Entry];

  it('builds newest-first items with /e/ urls', () => {
    const items = buildFeedItems(catalog as never, entries, SITE, BASE);
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://example.github.io/closed-form/e/openai-math-2026-017/');
    expect(items[0].headline).toBe((entry017 as { headline: string }).headline);
  });

  it('sorts reviewedAt desc, else id desc', () => {
    const a = { ...(entry017 as object), id: '003' } as unknown as Entry;
    const b = {
      ...(entry017 as object),
      id: '017',
      reviewedAt: '2026-10-08',
    } as unknown as Entry;
    const items = buildFeedItems(catalog as never, [a, b], SITE, BASE);
    expect(items[0].id).toBe('017');
    const plain = buildFeedItems(
      catalog as never,
      [entry017 as unknown as Entry, a],
      SITE,
      BASE,
    );
    expect(plain[0].id).toBe('017');
  });

  it('emits rss xml with one item per entry', () => {
    const items = buildFeedItems(catalog as never, entries, SITE, BASE);
    const xml = buildFeedXml(items, SITE, BASE);
    expect(xml).toContain('<rss version="2.0">');
    expect(xml).toContain('<channel>');
    expect(xml).toContain('openai-math-2026-017');
    expect(xml).toContain('<pubDate>');
  });
});

describe('public data files (§13)', () => {
  it('catalog.json ships all families', () => {
    const fams = (catalog as { families: { id: string; papers: unknown[] }[] }).families;
    expect(fams).toHaveLength(372);
    const papers = fams.reduce((n, f) => n + f.papers.length, 0);
    expect(papers).toBe(722);
    expect((catalog as { subjects: unknown[] }).subjects).toHaveLength(17);
  });

  it('fields.json has 17 fields with collection/lab/science + counts', () => {
    const rows = buildFieldsJson(catalog as never);
    expect(rows).toHaveLength(17);
    const total = rows.reduce((n, r) => n + r.results, 0);
    expect(total).toBe(372);
    const papers = rows.reduce((n, r) => n + r.papers, 0);
    expect(papers).toBe(722);
    for (const r of rows) {
      expect(r.collection).toBe('openai-math-2026');
      expect(r.lab).toBe('openai');
      expect(r.science).toBe('mathematics');
      expect(r.slug).toMatch(/^[a-z0-9-]+$/);
      expect(r.trust.formal + r.trust.partial + r.trust.claimed).toBe(r.results);
    }
    const nt = rows.find((r) => r.field === 'Number theory');
    expect(nt).toBeDefined();
  });

  it('entries carry the schema collection fields', () => {
    const e = entry017 as unknown as Record<string, unknown>;
    for (const k of ['collection', 'lab', 'science', 'field', 'aiRole', 'evidence']) {
      expect(e[k]).toBeDefined();
    }
  });
});
