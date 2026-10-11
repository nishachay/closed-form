/**
 * STE lint (§8) as a runnable script + importable module.
 *
 * Checks the writing rules over entry JSON: sentences ≤25 words (20 is the
 * target, 25 is the hard fail), no hype words. Exit 1 on errors. The optional
 * prose `explanation` gets the same rules, plus no "verified" (prompts/explainer.md).
 *
 * Also deterministic source checks (errors):
 * - every `sources` item has a `url`, unless marked `noUrl: true` or its cite says
 *   "no online copy";
 * - every claim `sourceLine` appears verbatim in the paper's LaTeX (see
 *   `quoteSkeleton`: whitespace, LaTeX markup and citation keys are ignored; "…"
 *   skips a formula). Skipped when the paper LaTeX is not available offline.
 *
 * Usage:
 *   pnpm lint-ste [--entry <path>]   # default: all src/content/entries/*.json
 *   CF_SOURCE_DIR=<openai/math checkout>  # default source/openai-math
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HYPE_WORDS, countWords, splitSentences } from '../src/lib/entry.js';
import { detachedCitations, parseCitations, stripCitations } from '../src/lib/cite.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface LintIssue {
  field: string;
  kind:
    | 'long-sentence'
    | 'hype'
    | 'warning-long-sentence'
    | 'source-no-url'
    | 'claim-not-verbatim'
    | 'banned-word'
    | 'cite-missing-claim'
    | 'cite-no-source-line'
    | 'cite-detached'
    | 'cite-outside-explanation'
    | 'cite-wrong-paper'
    | 'warning-cite-no-paper';
  message: string;
}

const HYPE_RE = new RegExp(
  HYPE_WORDS.filter((w) => w !== 'solves forever')
    .map((w) => `\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
    .join('|'),
  'i',
);

export function lintText(text: string, field: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const lower = text.toLowerCase();
  if (lower.includes('solves forever')) {
    issues.push({ field, kind: 'hype', message: `${field} contains hype word: solves forever` });
  }
  const m = text.match(HYPE_RE);
  if (m) {
    issues.push({ field, kind: 'hype', message: `${field} contains hype word: ${m[0].toLowerCase()}` });
  }
  // Citation markers ([2]) never count as words.
  for (const s of splitSentences(stripCitations(text))) {
    const n = countWords(s);
    if (n > 25) {
      issues.push({ field, kind: 'long-sentence', message: `${field} sentence exceeds 25 words (${n}): ${s.slice(0, 80)}…` });
    } else if (n > 20) {
      issues.push({ field, kind: 'warning-long-sentence', message: `${field} sentence over 20-word target (${n}): ${s.slice(0, 80)}…` });
    }
  }
  return issues;
}

export function lintEntry(entry: Record<string, unknown>): LintIssue[] {
  const out: LintIssue[] = [];
  for (const key of ['headline', 'scope', 'plain', 'doesNot', 'hypeCheck']) {
    if (typeof entry[key] === 'string') out.push(...lintText(entry[key] as string, key));
  }
  const sc = (entry as { scorecard?: { significanceWhy?: unknown } }).scorecard;
  if (sc && typeof sc === 'object') {
    if (typeof sc.significanceWhy === 'string') {
      out.push(...lintText(sc.significanceWhy, 'scorecard.significanceWhy'));
    }
  }
  // Prose explanation (prompts/explainer.md): same sentence and hype rules, and never "verified":
  // certainty is stated from the Lean doc in plain words, not with that label.
  if (typeof entry.explanation === 'string') {
    out.push(...lintText(entry.explanation, 'explanation'));
    if (/\bverified\b/i.test(entry.explanation)) {
      out.push({ field: 'explanation', kind: 'banned-word', message: 'explanation uses the word "verified"; state what Lean checks instead' });
    }
  }
  const sections = (entry as { sections?: { title?: unknown; body?: unknown }[] }).sections ?? [];
  sections.forEach((s, i) => {
    if (typeof s.body === 'string') {
      out.push(...lintText(s.body, `sections[${i}](${String(s.title ?? '?')})`));
    }
  });
  return out;
}

const ERROR_KINDS: ReadonlySet<LintIssue['kind']> = new Set([
  'hype',
  'long-sentence',
  'source-no-url',
  'claim-not-verbatim',
  'banned-word',
  'cite-missing-claim',
  'cite-no-source-line',
  'cite-detached',
  'cite-outside-explanation',
  'cite-wrong-paper',
]);

export function isError(i: LintIssue): boolean {
  return ERROR_KINDS.has(i.kind);
}

export function hasErrors(issues: LintIssue[]): boolean {
  return issues.some(isError);
}

/** Explicit "no online copy" marker: `noUrl: true`, or the cite says so. */
export function hasNoUrlMarker(source: { noUrl?: unknown; cite?: unknown }): boolean {
  return source.noUrl === true || /no online copy/i.test(String(source.cite ?? ''));
}

/** FAIL any source without a url unless it carries an explicit no-online-copy marker. */
export function lintSources(entry: Record<string, unknown>): LintIssue[] {
  const sources = (entry as { sources?: { id?: unknown; url?: unknown; noUrl?: unknown; cite?: unknown }[] }).sources ?? [];
  const out: LintIssue[] = [];
  for (const s of sources) {
    const url = typeof s.url === 'string' ? s.url.trim() : '';
    if (!url && !hasNoUrlMarker(s)) {
      out.push({
        field: `sources[${String(s.id)}]`,
        kind: 'source-no-url',
        message: `source ${String(s.id)} has no url (add one, or set noUrl: true and say "(no online copy found)")`,
      });
    }
  }
  return out;
}

const LETTER_MAP: Record<string, string> = { ł: 'l', Ł: 'L', ø: 'o', Ø: 'O', ß: 'ss', æ: 'ae', œ: 'oe', ı: 'i', đ: 'd' };

function baseSkeleton(s: string): string {
  const t = s
    // LaTeX letter commands and accents: \l → l, \"a / \'{e} → a / e.
    .replace(/\\(l|L|o|O|ss|ae|oe|i)(?![a-zA-Z])/g, '$1')
    .replace(/\\["'`^~=.uvHcdbk]\s*\{?([a-zA-Z])\}?/g, '$1')
    // Formatting commands keep their argument: \textsc{Max-Cut} → Max-Cut.
    .replace(/\\(?:text[a-z]*|emph|math[a-z]*|operatorname)\*?(?=\s*\{)/g, ' ')
    .replace(/[łŁøØßæœıđ]/g, (c) => LETTER_MAP[c] ?? c)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/~/g, ' ')
    .replace(/[\\_^{}$'`’‘]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return ` ${t} `;
}

/**
 * Paper-side skeleton: drops LaTeX comments and \cite/\ref/\label commands, then
 * reduces to lowercase words. "Verbatim" means the same words in the same order.
 */
/** Catalog summaries/abstracts carry limited HTML (<i>, <sup>…); drop those tags only. */
export function stripInlineTags(html: string): string {
  return html.replace(/<\/?(?:i|em|sup|sub)>/gi, ' ');
}

export function texSkeleton(tex: string): string {
  return baseSkeleton(stripRefs(tex.replace(/(?<!\\)%.*$/gm, '')));
}

function stripRefs(s: string): string {
  return s.replace(/\\(?:cite[a-zA-Z]*|ref|eqref|cref|Cref|label)\s*(?:\[[^\]]*\])?\s*\{[^}]*\}/g, ' ');
}

/** Quote-side skeleton: drops bracketed citation labels like [Tao16, Theorem 1.3]. */
export function quoteSkeleton(quote: string): string {
  return baseSkeleton(stripRefs(quote).replace(/\[[^\]]*\]/g, ' '));
}

/** True when every "…"/"..."-separated segment of `quote` occurs, in order, in the skeleton. */
export function quoteFound(quote: string, texSkel: string): boolean {
  let pos = 0;
  let any = false;
  for (const seg of quote.split(/\.\.\.|…/)) {
    const k = quoteSkeleton(seg);
    if (!k.trim()) continue;
    any = true;
    const i = texSkel.indexOf(k, pos);
    if (i < 0) return false;
    pos = i + k.length - 1;
  }
  return any;
}

/**
 * FAIL any claim whose sourceLine is not in the gathered paper text. `paperTex` null
 * means the text is not available offline: the check is skipped, never guessed.
 */
export function lintClaimQuotes(entry: Record<string, unknown>, paperTex: string | null): LintIssue[] {
  if (paperTex === null || paperTex.trim() === '') return [];
  const skel = texSkeleton(paperTex);
  const claims = (entry as { claims?: { text?: unknown; sourceLine?: unknown }[] }).claims ?? [];
  const out: LintIssue[] = [];
  claims.forEach((c, i) => {
    if (typeof c.sourceLine !== 'string' || !c.sourceLine.trim()) return;
    if (!quoteFound(c.sourceLine, skel)) {
      out.push({
        field: `claims[${i}]`,
        kind: 'claim-not-verbatim',
        message: `claims[${i}] sourceLine not found verbatim in the paper text: ${c.sourceLine.slice(0, 80)}…`,
      });
    }
  });
  return out;
}

async function texFilesUnder(dir: string): Promise<string[]> {
  let names: string[];
  try {
    names = (await readdir(dir)).sort();
  } catch {
    return [];
  }
  let out: string[] = [];
  for (const n of names) {
    const p = join(dir, n);
    const st = await stat(p);
    if (st.isDirectory()) out = out.concat(await texFilesUnder(p));
    else if (n.endsWith('.tex')) out.push(p);
  }
  return out;
}

/** Full (untruncated) LaTeX of the entry's paper evidence, or null if none is on disk. */
export async function loadPaperTex(entry: Record<string, unknown>, sourceDir: string): Promise<string | null> {
  const ev = (entry as { evidence?: { kind?: unknown; url?: unknown }[] }).evidence ?? [];
  const dirs = new Set<string>();
  for (const e of ev) {
    if (e.kind !== 'paper') continue;
    const m = String(e.url ?? '').match(/preprints\/([^/]+)\//);
    if (m) dirs.add(m[1]);
  }
  const parts: string[] = [];
  for (const d of dirs) {
    for (const f of await texFilesUnder(join(sourceDir, 'preprints', d))) parts.push(await readFile(f, 'utf-8'));
  }
  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Inline citations (src/lib/cite.ts). In the explanation, a marker `[n]` must:
 * - point at an existing claim (1-based index into claims[]) that has a sourceLine;
 * - be attached to a sentence: written against the last word, before the punctuation (`basis[2].`).
 * Markers anywhere else (headline, plain, sections…) are errors: only the explanation renders them.
 * Multi-paper results: a cited claim should say which paper it quotes (`paper`), so the popover
 * can name it (warning); when it does and the LaTeX is on disk, the line must be in that paper.
 */
export function lintCitations(entry: Record<string, unknown>, paperTexByIndex?: (string | null)[]): LintIssue[] {
  const out: LintIssue[] = [];
  const claims = (entry as { claims?: { sourceLine?: unknown; paper?: unknown }[] }).claims ?? [];
  const papers = paperTexByIndex?.length ?? 0;
  for (const key of ['headline', 'scope', 'plain', 'doesNot', 'hypeCheck']) {
    const t = entry[key];
    if (typeof t === 'string' && parseCitations(t).length > 0) {
      out.push({ field: key, kind: 'cite-outside-explanation', message: `${key} has a citation marker; only the explanation may cite claims` });
    }
  }
  const text = entry.explanation;
  if (typeof text !== 'string') return out;
  const seen = new Set<number>();
  for (const m of parseCitations(text)) {
    for (const n of m.claims) {
      const c = claims[n - 1];
      if (!c) {
        out.push({ field: 'explanation', kind: 'cite-missing-claim', message: `explanation cites [${n}] but there are only ${claims.length} claims` });
        continue;
      }
      if (typeof c.sourceLine !== 'string' || !c.sourceLine.trim()) {
        out.push({ field: 'explanation', kind: 'cite-no-source-line', message: `explanation cites [${n}] but claims[${n - 1}] has no sourceLine to show` });
        continue;
      }
      if (seen.has(n)) continue;
      seen.add(n);
      if (papers > 1 && typeof c.paper !== 'number') {
        out.push({ field: `claims[${n - 1}]`, kind: 'warning-cite-no-paper', message: `claims[${n - 1}] is cited in a ${papers}-paper result but has no "paper" index` });
      }
      if (typeof c.paper === 'number' && paperTexByIndex) {
        const tex = c.paper >= 1 && c.paper <= papers ? paperTexByIndex[c.paper - 1] : undefined;
        if (tex === undefined) {
          out.push({ field: `claims[${n - 1}]`, kind: 'cite-wrong-paper', message: `claims[${n - 1}].paper = ${c.paper}, but the result has ${papers} paper(s)` });
        } else if (tex !== null && !quoteFound(c.sourceLine, texSkeleton(tex))) {
          out.push({ field: `claims[${n - 1}]`, kind: 'cite-wrong-paper', message: `claims[${n - 1}] sourceLine is not in paper ${c.paper}` });
        }
      }
    }
  }
  for (const d of detachedCitations(text)) {
    out.push({ field: 'explanation', kind: 'cite-detached', message: `citation marker not attached to a sentence (write it before the punctuation, like "basis[2]."): …${d}` });
  }
  return out;
}

/** Per-paper LaTeX (+ that paper's abstract) in catalog order; null where a paper is not on disk. */
export async function loadTexByPaper(
  papers: { pdf: string; abstract?: string }[],
  sourceDir: string,
): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (const p of papers) {
    const m = String(p.pdf ?? '').match(/preprints\/([^/]+)\//);
    const files = m ? await texFilesUnder(join(sourceDir, 'preprints', m[1])) : [];
    if (files.length === 0) {
      out.push(null);
      continue;
    }
    const parts: string[] = [];
    for (const f of files) parts.push(await readFile(f, 'utf-8'));
    parts.push(stripInlineTags(p.abstract ?? ''));
    out.push(parts.join('\n'));
  }
  return out;
}

export function formatIssues(id: string, issues: LintIssue[]): string {
  return issues.map((i) => `${id} [${i.kind}] ${i.message}`).join('\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const entryIdx = args.indexOf('--entry');
  const files =
    entryIdx >= 0 && args[entryIdx + 1]
      ? [args[entryIdx + 1]]
      : (await readdir(join(root, 'src/content/entries')))
          .filter((f) => f.endsWith('.json'))
          .map((f) => join(root, 'src/content/entries', f));

  const sourceDir = process.env.CF_SOURCE_DIR ?? join(root, 'source/openai-math');
  const catalog = JSON.parse(await readFile(join(root, 'src/data/catalog.json'), 'utf-8')) as {
    families: { id: string; summary: string; papers: { abstract: string; pdf: string }[] }[];
  };
  let errors = 0;
  let warnings = 0;
  let quoteChecked = 0;
  for (const file of files) {
    const entry = JSON.parse(await readFile(file, 'utf-8')) as Record<string, unknown>;
    const id = String((entry as { id?: unknown }).id ?? file);
    const paperTex = await loadPaperTex(entry, sourceDir);
    // The reader and checker also see the official summary and abstracts, so quotes may come from them.
    const fam = catalog.families.find((f) => f.id === id);
    const tex = paperTex === null ? null : [paperTex, stripInlineTags(fam?.summary ?? ''), ...(fam?.papers.map((p) => stripInlineTags(p.abstract)) ?? [])].join('\n');
    if (tex !== null) quoteChecked++;
    const texByPaper = fam ? await loadTexByPaper(fam.papers, sourceDir) : undefined;
    const issues = [...lintEntry(entry), ...lintSources(entry), ...lintClaimQuotes(entry, tex), ...lintCitations(entry, texByPaper)];
    if (issues.length > 0) console.log(formatIssues(id, issues));
    errors += issues.filter(isError).length;
    warnings += issues.filter((i) => i.kind.startsWith('warning-')).length;
  }
  console.log(
    `lint-ste: ${files.length} entr${files.length === 1 ? 'y' : 'ies'}, ${errors} errors, ${warnings} warnings ` +
      `(claim quotes checked for ${quoteChecked}; skipped where paper LaTeX is not on disk)`,
  );
  if (errors > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
