/**
 * openai/math adapter.
 *
 * Reads the read-only submodule at `source/openai-math` and outputs the
 * shared collection shape (`ingest/types.ts`) so other labs can plug in
 * beside it later (e.g. `ingest/other-lab.ts` implementing the same
 * `CollectionAdapter` contract).
 *
 * Deterministic: no AI, no network. All counts computed, never hard-coded.
 */
import { readFile, access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { CollectionAdapter, CollectionMeta, Family, Paper, TrustKey, WithdrawnPaper } from './types.js';

export const OPENAI_MATH_META: CollectionMeta = {
  collection: 'openai-math-2026',
  lab: 'openai',
  science: 'mathematics',
  repo: 'openai/math',
  license: 'Apache-2.0',
};

export const GITHUB_BASE = 'https://github.com/openai/math/blob/main';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sept: 9, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse `-Month-D-YYYY` suffix from a preprint dir name → `YYYY-MM-DD` or null. */
export function parseDateFromDir(dir: string): string | null {
  const m = dir.match(/-([A-Za-z]+)-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  const day = Number(m[2]);
  const year = Number(m[3]);
  if (day < 1 || day > 31) return null;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Clean inline HTML/LaTeX per §9:
 * - Convert `$`...`$` → `$...$`
 * - Unescape entities
 * - Keep only <sup>/<sub>/<i>/<em> (open + close), strip all other tags
 */
export function cleanInlineHtml(input: string): string {
  let s = input;
  // $`...`$ → $...$
  s = s.replace(/\$`(.+?)`\$/g, (_m, inner: string) => `$${inner}$`);
  // Unescape numeric entities first
  s = s.replace(/&#(\d+);/g, (_m, n: string) => {
    try {
      return String.fromCodePoint(Number(n));
    } catch {
      return _m;
    }
  });
  s = s.replace(/&#x([0-9a-fA-F]+);/g, (_m, h: string) => {
    try {
      return String.fromCodePoint(parseInt(h, 16));
    } catch {
      return _m;
    }
  });
  const named: Record<string, string> = {
    '&gt;': '>',
    '&lt;': '<',
    '&amp;': '&',
    '&quot;': '"',
    '&apos;': "'",
    '&nbsp;': ' ',
    '&emsp;': ' ',
    '&ensp;': ' ',
    '&thinsp;': ' ',
  };
  for (const [k, v] of Object.entries(named)) {
    s = s.split(k).join(v);
  }
  // Keep only allowed tags; strip the rest (with attributes).
  s = s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (m, tag: string) => {
    const t = String(tag).toLowerCase();
    if (t === 'sup' || t === 'sub' || t === 'i' || t === 'em') {
      return m.startsWith('</') ? `</${t}>` : `<${t}>`;
    }
    return '';
  });
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/** Strip trailing `([Lean](lean/docs/NNN.md))` into leanDoc. */
export function extractLeanDoc(summary: string): { summary: string; leanDoc: string | null } {
  const m = summary.match(/\s*\(\[Lean\]\(lean\/docs\/(\d{3})\.md\)\)\s*\.?\s*$/);
  if (!m) return { summary: summary.trim(), leanDoc: null };
  const leanDoc = `lean/docs/${m[1]}.md`;
  const rest = summary.slice(0, m.index).trim();
  return { summary: rest, leanDoc };
}

export function mapTrust(leanCount: number, leanDoc: string | null): TrustKey {
  if (leanCount > 0) return 'formal';
  if (leanDoc) return 'partial';
  return 'claimed';
}

interface RawPaper {
  title: string;
  pdfPath: string;
  abstract: string;
}

interface RawFamily {
  id: string;
  title: string;
  summary: string;
  leanDoc: string | null;
  papers: RawPaper[];
}

/** Parse CONTENTS.md <td> blocks into families + papers. */
export function parseContents(contentsMd: string): RawFamily[] {
  const blocks = [...contentsMd.matchAll(/<td>([\s\S]*?)<\/td>/g)].map((m) => m[1]);
  const families: RawFamily[] = [];
  let current: RawFamily | null = null;

  const familyRe = /\*\*(\d{3})\.\s+(.*?)\.\*\*\s*([\s\S]*)/;
  const paperRe = /&emsp;\[([^\]]+)\]\((preprints\/[^)]+)\)/;

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;
    const fm = block.match(familyRe);
    if (fm && block.includes('**')) {
      const id = fm[1];
      const title = cleanInlineHtml(fm[2].trim());
      const rest = fm[3] ?? '';
      // Summary is everything after `Title.**`, up to end of block.
      // Remove newlines, clean.
      const { summary, leanDoc } = extractLeanDoc(cleanInlineHtml(rest));
      current = { id, title, summary, leanDoc, papers: [] };
      families.push(current);
      continue;
    }
    const pm = block.match(paperRe);
    if (pm && current) {
      const title = cleanInlineHtml(pm[1].trim());
      const pdfPath = pm[2].trim();
      // Abstract = block text after the link line.
      const afterLink = block.slice((pm.index ?? 0) + pm[0].length);
      const abstract = cleanInlineHtml(afterLink);
      current.papers.push({ title, pdfPath, abstract });
    }
  }
  return families;
}

/** Parse overview.tex: subjects in order + id → subject. */
export function parseSubjects(overviewTex: string): { subjects: string[]; idToSubject: Map<string, string> } {
  const subjects: string[] = [];
  const idToSubject = new Map<string, string>();
  const re = /\\cataloguesection\{([^}]+)\}\{(\d+)\}|\\resultentry\{(\d{3})\}/g;
  let current: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(overviewTex)) !== null) {
    if (m[1]) {
      current = m[1].trim();
      if (!subjects.includes(current)) subjects.push(current);
    } else if (m[3] && current) {
      idToSubject.set(m[3], current);
    }
  }
  return { subjects, idToSubject };
}

/** Parse lean/formalization.yaml → set of preprint dir names with formal proof. */
export function parseFormalization(yamlText: string): Set<string> {
  const dirs = new Set<string>();
  const doc = parseYaml(yamlText) as { sources?: { id?: string }[] };
  for (const s of doc?.sources ?? []) {
    if (!s?.id) continue;
    // id like `../preprints/<dir>/<file>`
    const parts = s.id.split('/');
    const idx = parts.indexOf('preprints');
    if (idx >= 0 && parts[idx + 1]) dirs.add(parts[idx + 1]);
  }
  return dirs;
}

/** Parse README reasoning-traces table → family id → trace path. */
export function parseTraces(readmeMd: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /\|\s*(\d{3})\s*\|\s*\[[^\]]*\]\((reasoning_traces\/[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(readmeMd)) !== null) {
    map.set(m[1], m[2]);
  }
  return map;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

const MONTH_NUM: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

/** Parse one preprint README; returns a withdrawal record when it is a withdrawal notice. */
export function parseWithdrawalReadme(dir: string, md: string): (WithdrawnPaper & { dir: string }) | null {
  const head = /^#\s*\[Withdrawal notice:\s*(.+?)\]\(/m.exec(md);
  if (!head) return null;
  const on = /\*\*Withdrawn on ([A-Za-z]+) (\d{1,2}), (\d{4})\.?\*\*/.exec(md);
  const withdrawnOn = on && MONTH_NUM[on[1].toLowerCase()]
    ? `${on[3]}-${MONTH_NUM[on[1].toLowerCase()]}-${on[2].padStart(2, '0')}`
    : null;
  const afterDate = on ? md.slice(md.indexOf(on[0]) + on[0].length) : md;
  const body = afterDate.split(/^##\s/m)[0] ?? '';
  const reason = body
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' ');
  const archived = /\[Pre-withdrawal PDF\]\(([^)]+)\)/.exec(md);
  return {
    dir,
    title: head[1].trim(),
    withdrawnOn,
    reason,
    notice: `${GITHUB_BASE.replace('/blob/main', '/tree/main')}/preprints/${dir}`,
    archivedPdf: archived ? archived[1] : null,
  };
}

/** Every withdrawal notice under preprints/. */
export async function parseWithdrawals(sourceDir: string): Promise<Array<WithdrawnPaper & { dir: string }>> {
  const root = join(sourceDir, 'preprints');
  let dirs: string[] = [];
  try {
    dirs = await readdir(root);
  } catch {
    return [];
  }
  const out: Array<WithdrawnPaper & { dir: string }> = [];
  for (const dir of dirs.sort()) {
    let md = '';
    try {
      md = await readFile(join(root, dir, 'README.md'), 'utf-8');
    } catch {
      continue;
    }
    const w = parseWithdrawalReadme(dir, md);
    if (w) out.push(w);
  }
  return out;
}

export async function parseOpenaiMath(sourceDir: string): Promise<{ subjects: string[]; families: Family[] }> {
  const [contentsMd, overviewTex, formalYaml, readmeMd] = await Promise.all([
    readFile(join(sourceDir, 'CONTENTS.md'), 'utf-8'),
    readFile(join(sourceDir, 'overview.tex'), 'utf-8'),
    readFile(join(sourceDir, 'lean/formalization.yaml'), 'utf-8'),
    readFile(join(sourceDir, 'README.md'), 'utf-8'),
  ]);

  const rawFamilies = parseContents(contentsMd);
  const { subjects, idToSubject } = parseSubjects(overviewTex);
  const leanDirs = parseFormalization(formalYaml);
  const traces = parseTraces(readmeMd);

  const families: Family[] = [];
  for (const rf of rawFamilies) {
    const subject = idToSubject.get(rf.id) ?? 'Unknown';
    // Fallback: if CONTENTS lacked the Lean link but the doc file exists, use it.
    let leanDoc = rf.leanDoc;
    if (!leanDoc && (await fileExists(join(sourceDir, `lean/docs/${rf.id}.md`)))) {
      leanDoc = `lean/docs/${rf.id}.md`;
    }

    const papers: Paper[] = rf.papers.map((p) => {
      const dir = p.pdfPath.split('/')[1] ?? '';
      return {
        title: p.title,
        pdf: `${GITHUB_BASE}/${p.pdfPath}`,
        abstract: p.abstract,
        lean: leanDirs.has(dir),
        date: parseDateFromDir(dir),
      };
    });

    const lean = papers.filter((p) => p.lean).length;
    const tracePath = traces.get(rf.id);
    families.push({
      id: rf.id,
      title: rf.title,
      summary: rf.summary,
      subject,
      papers,
      lean,
      leanDoc,
      ...(tracePath ? { trace: `${GITHUB_BASE}/${tracePath}` } : {}),
      trust: mapTrust(lean, leanDoc),
    });
  }

  families.sort((a, b) => a.id.localeCompare(b.id));
  return { subjects, families };
}

export const openaiMathAdapter: CollectionAdapter = {
  id: 'openai-math',
  meta: OPENAI_MATH_META,
  parse: parseOpenaiMath,
};
