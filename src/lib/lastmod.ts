/**
 * Honest <lastmod> values for sitemap.xml, from git history (build time only).
 *
 * - An entry page changes when its JSON changes: the last commit touching
 *   src/content/entries/<ID>.json.
 * - A hub or field page changes when any of its entries changes: the newest of them.
 * - Site-wide pages (home, archive, topics, collection) take the newest entry date.
 * If git history is unavailable (e.g. a shallow checkout), no lastmod is emitted
 * rather than a made-up one. The deploy workflow checks out full history.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog } from './catalog.js';
import type { Entry } from './entry.js';
import { globalIdFor } from './ids.js';
import { buildHubs } from './seo.js';
import { slugify } from './slug.js';

function gitDates(root: string, path: string): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const log = execFileSync('git', ['log', '--format=@%cI', '--name-only', '--', path], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let date = '';
    for (const line of log.split('\n')) {
      if (line.startsWith('@')) date = line.slice(1).trim();
      else if (line.trim() && date && !out.has(line.trim())) out.set(line.trim(), date);
    }
  } catch {
    /* no git: leave empty */
  }
  return out;
}

const newest = (dates: Array<string | undefined>) =>
  dates.filter((d): d is string => !!d).sort((a, b) => Date.parse(b) - Date.parse(a))[0];

/** Map of site path (e.g. "/e/openai-math-2026-001/") to ISO date. */
export function buildLastmodMap(root: string, catalog: Catalog): Map<string, string> {
  const entryDir = join(root, 'src/content/entries');
  const dates = gitDates(root, 'src/content/entries');
  const byId = new Map<string, string>();
  for (const [file, d] of dates) {
    const m = /src\/content\/entries\/(\d{3})\.json$/.exec(file);
    if (m) byId.set(m[1], d);
  }
  const map = new Map<string, string>();
  if (byId.size === 0) return map;

  const explained = new Map<string, Entry>(
    readdirSync(entryDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const e = JSON.parse(readFileSync(join(entryDir, f), 'utf8')) as Entry;
        return [e.id, e];
      }),
  );

  for (const f of catalog.families) {
    const d = byId.get(f.id);
    if (d) map.set(`/e/${globalIdFor(catalog.collection, f.id)}/`, d);
  }
  for (const s of catalog.subjects) {
    const d = newest(catalog.families.filter((f) => f.subject === s).map((f) => byId.get(f.id)));
    if (d) map.set(`/science/${catalog.science}/${slugify(s)}/`, d);
  }
  for (const h of buildHubs(catalog, explained)) {
    const d = newest(h.ids.map((id) => byId.get(id)));
    if (d) map.set(h.path, d);
  }
  const all = newest([...byId.values()]);
  if (all) {
    for (const p of ['/', '/archive/', '/topics/', `/collection/${catalog.collection}/`, `/lab/${catalog.lab}/`, `/science/${catalog.science}/`]) {
      map.set(p, all);
    }
  }
  const about = gitDates(root, 'src/pages/about.astro').get('src/pages/about.astro');
  if (about) map.set('/about/', about);
  return map;
}
