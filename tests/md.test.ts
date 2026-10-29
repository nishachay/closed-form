import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalogJson from '../src/data/catalog.json';
import type { Catalog } from '../src/lib/catalog.js';
import type { Entry } from '../src/lib/entry.js';
import { buildHubs } from '../src/lib/seo.js';
import { inline, mdPathFor, htmlPathOf } from '../src/lib/md/format.js';
import { ABOUT_COPY, allDocs, MD_ROUTES, MD_SKIP, renderMd, type MdContext } from '../src/lib/md/registry.js';
import {
  AI_SEARCH_BOTS,
  AI_TRAINING_BOTS,
  buildAiTxt,
  buildLlmsFull,
  buildLlmsTxt,
  buildRobots,
  LLMS_FULL_MAX,
  siteDescription,
} from '../src/lib/md/site-files.js';
import { computeStats } from '../src/lib/names.js';

const SITE = 'https://closedform.nishachay.tech';
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
const ctx: MdContext = { catalog, explained, lastmod: new Map([['/', '2026-10-20T10:00:00+05:30']]) };
const docs = allDocs(ctx);

/** HTML routes under src/pages: "index", "e/[gid]", "science/[science]/[field]"… */
function htmlRoutes(root = join(process.cwd(), 'src/pages')): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.astro')) out.push(relative(root, p).replace(/\\/g, '/').replace(/\.astro$/, ''));
    }
  };
  walk(root);
  return out.sort();
}

describe('markdown registry coverage', () => {
  it('every public HTML route has a markdown renderer or a documented skip', () => {
    const covered = new Set(MD_ROUTES.map((r) => r.route));
    const missing = htmlRoutes().filter((r) => !covered.has(r) && !(r in MD_SKIP));
    expect(missing, `add a renderer in src/lib/md/registry.ts or a reason in MD_SKIP for: ${missing.join(', ')}`).toEqual([]);
    for (const reason of Object.values(MD_SKIP)) expect(reason.length).toBeGreaterThan(5);
  });

  it('every renderer points at a real HTML route', () => {
    const routes = new Set(htmlRoutes());
    for (const r of MD_ROUTES) expect(routes.has(r.route), r.route).toBe(true);
  });

  it('renders one page per entry, generated hub and field, with unique paths', () => {
    const paths = docs.map((d) => d.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter((p) => p.startsWith('/e/')).length).toBe(catalog.families.length);
    const hubs = buildHubs(catalog, explained);
    for (const h of hubs) expect(paths).toContain(h.path);
    expect(paths.filter((p) => /^\/(topic|open-since|significance|trust)\//.test(p)).length).toBe(hubs.length);
    expect(paths.filter((p) => /^\/science\/[^/]+\/[^/]+\/$/.test(p)).length).toBe(catalog.subjects.length);
    for (const p of ['/', '/about/', '/archive/', '/topics/']) expect(paths).toContain(p);
    expect(paths.some((p) => p.includes('404'))).toBe(false);
  });

  it('only hubs that pass the thin-page floor get markdown', () => {
    const hubPaths = new Set(buildHubs(catalog, explained).map((h) => h.path));
    for (const d of docs.filter((x) => /^\/(topic|open-since|significance|trust)\//.test(x.path))) {
      expect(hubPaths.has(d.path), d.path).toBe(true);
    }
  });
});

describe('markdown page format', () => {
  it('maps HTML paths to .md paths', () => {
    expect(mdPathFor('/')).toBe('/index.md');
    expect(mdPathFor('/about/')).toBe('/about.md');
    expect(mdPathFor('/e/openai-math-2026-001/')).toBe('/e/openai-math-2026-001.md');
    expect(mdPathFor('/science/mathematics/algebra/')).toBe('/science/mathematics/algebra.md');
    expect(htmlPathOf('/about')).toBe('/about/');
  });

  it('every page has title, summary, canonical, body and absolute Related links', () => {
    for (const d of docs) {
      const md = renderMd(d);
      const lines = md.split('\n');
      expect(lines[0], d.path).toMatch(/^# \S/);
      expect(lines[2], d.path).toMatch(/^> \S/);
      expect(md).toContain(`Canonical: ${SITE}${d.path}`);
      expect(md).not.toMatch(/\]\(\/(?!\/)/); // no site-relative links
      expect(md).not.toContain('undefined');
      expect(md).not.toContain('[object Object]');
      expect(d.related.length, d.path).toBeGreaterThan(0);
      expect(md).toMatch(/\n## Related\n\n- \[[^\]]+\]\(https?:\/\//);
    }
  });

  it('uses lastmod for Last updated when known', () => {
    expect(renderMd(docs.find((d) => d.path === '/')!)).toContain('Last updated: 2026-10-20');
  });

  it('an entry page carries what the HTML entry shows', () => {
    const f = catalog.families[0];
    const e = explained.get(f.id)!;
    const d = docs.find((x) => x.path === `/e/${catalog.collection}-${f.id}/`)!;
    const md = renderMd(d);
    expect(md).toContain(e.headline);
    expect(md).toContain(e.doesNot);
    expect(md).toContain(e.hypeCheck);
    expect(md).toContain('## Words used');
    expect(md).toContain(f.papers[0].pdf);
    expect(md).toMatch(/\*\*Trust:\*\* (Formal proof listed|Partly formalized|Claimed, no proof listed)/);
    expect(md).not.toMatch(/<\/?(span|a|div)\b/);
  });

  it('keeps about copy word for word with about.astro', () => {
    const html = readFileSync(join(process.cwd(), 'src/pages/about.astro'), 'utf8').replace(/\s+/g, ' ');
    const strings = [
      ABOUT_COPY.headline,
      ABOUT_COPY.lead,
      ABOUT_COPY.around,
      ABOUT_COPY.trustIntro,
      ABOUT_COPY.dont,
      ABOUT_COPY.everyEntry,
      ...ABOUT_COPY.meta,
      ...ABOUT_COPY.explain,
      ...ABOUT_COPY.steps.flat(),
    ];
    for (const s of strings) expect(html, s).toContain(s);
  });

  it('converts inline catalog HTML without touching math', () => {
    expect(inline('A <i>graph</i> with $a<b$ and x<sub>2</sub> &amp; y')).toBe('A *graph* with $a<b$ and x<sub>2</sub> & y');
  });
});

describe('llms.txt, llms-full.txt, ai.txt, robots.txt', () => {
  const stats = computeStats(catalog.families);

  it('llms.txt links pages to their .md versions and lists machine-readable files', () => {
    const t = buildLlmsTxt(ctx);
    expect(t).toContain(`> ${siteDescription(stats)}`);
    expect(t).toContain(`(${SITE}/index.md)`);
    expect(t).toContain(`(${SITE}/archive.md)`);
    expect(t).toContain('## Machine-readable');
    for (const f of ['/llms-full.txt', '/ai.txt', '/sitemap.xml', '/data/entries.json']) expect(t).toContain(`${SITE}${f}`);
    for (const h of buildHubs(catalog, explained)) expect(t).toContain(`${SITE}${h.path.replace(/\/$/, '')}.md`);
  });

  it('llms-full.txt stays under the limit and says what it left out', () => {
    const full = buildLlmsFull(ctx, { generated: '2026-10-26' });
    expect(full.text.length).toBeLessThanOrEqual(LLMS_FULL_MAX);
    expect(full.text).toMatch(/^# Closed Form \(full text\)/);
    expect(full.text).toContain('Generated: 2026-10-26');
    expect(full.text).toContain(`<!-- source: ${SITE}/ -->`);
    expect(full.text).toContain('\n---\n');
    for (const h of buildHubs(catalog, explained)) expect(full.text).toContain(`<!-- source: ${SITE}${h.path} -->`);
    expect(full.entriesIncluded).toBeGreaterThan(0);
    if (full.truncated) expect(full.text).toContain(`${SITE}/data/entries.json`);
    // Never cuts a page in half: each included source block ends in its Related list.
    const chunks = full.text.split('\n---\n\n').slice(1);
    for (const c of chunks) expect(c).toMatch(/## Related\n\n[\s\S]+\n$/);
  });

  it('llms-full.txt includes every entry when the budget allows', () => {
    const full = buildLlmsFull(ctx, { generated: '2026-10-26', max: 100_000_000 });
    expect(full.truncated).toBe(false);
    expect(full.entriesIncluded).toBe(catalog.families.length);
  });

  it('ai.txt has every section and matches the llms.txt description', () => {
    const t = buildAiTxt(ctx, '2026-10-20');
    for (const s of ['[identity]', '[permissions]', '[restrictions]', '[attribution]', '[scope]', '[contact]']) expect(t).toContain(s);
    expect(t).toContain(`description: ${siteDescription(stats)}`);
    expect(t).toContain('CC BY 4.0');
    expect(t).toContain('Apache-2.0');
    expect(t).toContain('https://github.com/nishachay/closed-form');
    expect(t).toContain('Last updated: 2026-10-20');
    expect(t).toMatch(/robots\.txt/);
  });

  it('robots.txt allows everyone, names AI crawlers and points at the sitemap', () => {
    const t = buildRobots();
    expect(t).toMatch(/User-agent: \*\nAllow: \//);
    for (const b of [...AI_SEARCH_BOTS, ...AI_TRAINING_BOTS]) expect(t).toContain(`User-agent: ${b}`);
    expect(t).not.toMatch(/Disallow/);
    expect(t).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(t).toContain(`${SITE}/llms.txt`);
    expect(t).toContain(`${SITE}/ai.txt`);
  });
});
