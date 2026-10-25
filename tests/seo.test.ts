import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalog.json';
import type { Catalog } from '../src/lib/catalog.js';
import type { Entry } from '../src/lib/entry.js';
import {
  buildHubs,
  clipDescription,
  DESCRIPTION_MAX,
  entryDescription,
  entryTitle,
  fitTitle,
  HUB_MIN,
  hubIntro,
  introText,
  relatedIds,
  TITLE_MAX,
  topicsFor,
} from '../src/lib/seo.js';
import { serializeJsonLd } from '../src/lib/jsonld.js';

const catalog = catalogJson as unknown as Catalog;
const dir = join(process.cwd(), 'src/content/entries');
const explained = new Map<string, Entry>(
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const e = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Entry;
      return [e.id, e];
    }),
);

describe('titles and descriptions', () => {
  it('every entry title is unique and at most 60 chars', () => {
    const titles = catalog.families.map((f) => entryTitle(f));
    for (const t of titles) expect(t.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('every entry description is at most 155 chars and non-empty', () => {
    for (const f of catalog.families) {
      const d = entryDescription(f, explained.get(f.id) ?? null);
      expect(d.length).toBeGreaterThan(40);
      expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
  });

  it('fitTitle keeps the brand when it fits and clips at a word otherwise', () => {
    expect(fitTitle('About')).toBe('About — Closed Form');
    const long = fitTitle('word '.repeat(30));
    expect(long.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(long.endsWith('…')).toBe(true);
    expect(clipDescription('a '.repeat(200)).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });
});

describe('hubs', () => {
  const hubs = buildHubs(catalog, explained);

  it('never generates a thin hub', () => {
    expect(hubs.length).toBeGreaterThan(0);
    for (const h of hubs) expect(h.ids.length).toBeGreaterThanOrEqual(HUB_MIN);
  });

  it('hub paths are unique and members exist in the catalog', () => {
    expect(new Set(hubs.map((h) => h.path)).size).toBe(hubs.length);
    const ids = new Set(catalog.families.map((f) => f.id));
    for (const h of hubs) for (const id of h.ids) expect(ids.has(id)).toBe(true);
  });

  it('Erdős topic only holds results that mention Erdős', () => {
    const erdos = hubs.find((h) => h.slug === 'erdos-problems');
    expect(erdos).toBeDefined();
    for (const id of erdos!.ids) {
      const f = catalog.families.find((x) => x.id === id)!;
      expect(/erd[őo]s/i.test(`${f.title} ${f.summary}`)).toBe(true);
    }
  });

  it('prime topic does not match "prime-to-p"', () => {
    const f001 = catalog.families.find((f) => f.id === '001')!;
    expect(topicsFor(f001)).not.toContain('prime-numbers');
  });

  it('intros are generated from data and state the count', () => {
    for (const h of hubs) {
      const fams = h.ids.map((id) => catalog.families.find((f) => f.id === id)!);
      const text = introText(hubIntro(fams, explained, { scope: 'here', showFields: true }));
      expect(text).toContain(String(fams.length));
      expect(text.length).toBeGreaterThan(80);
    }
  });
});

describe('related entries', () => {
  it('every entry gets 3 to 6 related results, never itself', () => {
    for (const f of catalog.families) {
      const rel = relatedIds(catalog, explained, f.id, 5, 3);
      expect(rel.length).toBeGreaterThanOrEqual(3);
      expect(rel.length).toBeLessThanOrEqual(6);
      expect(rel).not.toContain(f.id);
    }
  });
});

describe('json-ld', () => {
  it('escapes markup so a block cannot close its script tag', () => {
    const out = serializeJsonLd({ name: '</script><b>x</b>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out).name).toBe('</script><b>x</b>');
  });
});
