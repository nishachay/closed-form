/**
 * Full-sentence quotes for cited claims (`claims[].sourceQuote`).
 *
 * A claim's `sourceLine` is one physical LaTeX line, so it often stops mid-sentence
 * ("The theorem does not establish the"). The reader is shown `sourceQuote` instead:
 * the whole sentence (or two) of the paper's LaTeX that contains the sourceLine,
 * copied verbatim. "Verbatim" here means: LaTeX comments removed and every run of
 * whitespace (line breaks included) written as a single space; math and markup are
 * kept exactly, so KaTeX renders the math and the source check still matches.
 *
 * Deterministic, no model involved. The explain pipeline fills it for every cited
 * claim; for a hand-written entry run:
 *
 *   CF_SOURCE_DIR=<openai/math checkout> pnpm source-quotes [--entry <path>] [--check]
 *
 * When no clean sentence can be found (the line sits in a display formula, a sentence
 * longer than the cap, a quote taken from the catalog abstract…) the claim keeps no
 * sourceQuote and the page shows the sourceLine, as before. Those are listed.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseCitations } from '../src/lib/cite.js';
import { flattenTex, loadTexByPaper, quoteFound, quoteSkeleton, stripTexComments, texSkeleton } from './lint-ste.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Longest quote of two or more sentences, and of a single sentence (characters). */
export const MAX_QUOTE = 420;
export const MAX_SINGLE = 600;

/** Words that end in "." without ending a sentence (compared lowercase, without the dot). */
const ABBREVIATIONS = new Set(
  (
    'e.g i.e cf vs etc al resp viz approx w.r.t a.e a.s i.i.d ' +
    'thm thms lem lems prop props cor cors def defs rem rems ex conj alg ' +
    'sec secs ch chap app fig figs eq eqs eqn eqns tab ref refs no nos vol vols pp p ed eds ' +
    'dr prof mr mrs ms st jr inc ltd co univ dept ' +
    'thm.\\ lem.\\ prop.\\ cor.\\'
  ).split(/\s+/),
);

/** Environments that are display math: a hard break, never part of a quoted sentence. */
const DISPLAY_ENVS = /^(equation|align|gather|multline|eqnarray|displaymath|flalign|alignat|math|split|subequations|dmath|IEEEeqnarray)\*?$/;

export interface Unit {
  start: number;
  end: number;
  /** Text ends with sentence punctuation. */
  terminal: boolean;
  /** The break before / after this unit (paragraph, structure, or display math). */
  breakBefore: 'sentence' | 'paragraph' | 'math' | 'start';
  breakAfter: 'sentence' | 'paragraph' | 'math' | 'end';
}

/**
 * Split flattened LaTeX into sentence units. Breaks: sentence punctuation followed by a
 * space and a capital (not after an abbreviation or an initial, never inside math);
 * blank lines; \begin/\end of non-math environments, \item, sectioning commands; and
 * display math, which is skipped entirely.
 */
export function sentenceUnits(flat: string, paragraphBreaks: Set<number>): Unit[] {
  const units: Unit[] = [];
  let unitStart = 0;
  let before: Unit['breakBefore'] = 'start';
  let inline: '' | '$' | '\\(' = '';
  const push = (end: number, after: Unit['breakAfter'], terminal: boolean) => {
    // Trim leading space and \label{…} from the start, trailing space from the end.
    let s = unitStart;
    for (;;) {
      while (s < end && flat[s] === ' ') s++;
      const lab = /^\\label\{[^}]*\}/.exec(flat.slice(s, Math.min(end, s + 200)));
      if (lab) s += lab[0].length;
      else break;
    }
    let e = end;
    while (e > s && flat[e - 1] === ' ') e--;
    if (e > s) units.push({ start: s, end: e, terminal, breakBefore: before, breakAfter: after });
  };
  let i = 0;
  const n = flat.length;
  /**
   * Display math is part of its sentence (the quote renders it). It ends the sentence when
   * the formula itself ends with a full stop and a capital follows. Returns where to resume.
   */
  const displayEnd = (body: string, after: number): number => {
    const tail = body.replace(/(\\(label|tag)\{[^}]*\}|\\(nonumber|notag|qedhere)|\s)+$/g, '');
    const next = flat.slice(after, after + 3);
    if (/[.?!]$/.test(tail) && (after >= n || paragraphBreaks.has(after) || /^ (?:[A-Z\\$(`"“‘']|$)/.test(next))) {
      push(after, 'sentence', true);
      unitStart = after;
      before = 'sentence';
    }
    return after;
  };
  /** Unclosed display math: everything after it is unusable. */
  const bail = (at: number): Unit[] => {
    push(at, 'math', false);
    return units;
  };
  while (i < n) {
    if (paragraphBreaks.has(i)) {
      push(i, 'paragraph', false);
      inline = '';
      unitStart = i;
      before = 'paragraph';
      i++;
      continue;
    }
    const c = flat[i];
    if (c === '\\') {
      const rest = flat.slice(i, i + 80);
      // Escaped characters (\$, \%, a forced line break \\ …) are text, never a sentence end.
      if (/^\\[$%&#_{}\\ ,;:!]/.test(rest)) {
        i += 2;
        continue;
      }
      if (inline === '\\(' && rest.startsWith('\\)')) {
        inline = '';
        i += 2;
        continue;
      }
      if (!inline && rest.startsWith('\\(')) {
        inline = '\\(';
        i += 2;
        continue;
      }
      if (inline) {
        i++;
        continue;
      }
      // Display math: \[ … \]
      if (rest.startsWith('\\[')) {
        const close = flat.indexOf('\\]', i + 2);
        if (close < 0) return bail(i);
        i = displayEnd(flat.slice(i + 2, close), close + 2);
        continue;
      }
      const env = /^\\(begin|end)\{([^}]+)\}/.exec(rest);
      if (env) {
        if (env[1] === 'begin' && DISPLAY_ENVS.test(env[2])) {
          const endTag = `\\end{${env[2]}}`;
          const close = flat.indexOf(endTag, i);
          if (close < 0) return bail(i);
          i = displayEnd(flat.slice(i + env[0].length, close), close + endTag.length);
          continue;
        }
        push(i, 'paragraph', false);
        i += env[0].length;
        // Optional argument of a theorem-like environment: \begin{theorem}[Main] — part of the break.
        if (env[1] === 'begin') {
          const opt = /^\s*\[[^\]]*\]/.exec(flat.slice(i, i + 300));
          if (opt) i += opt[0].length;
          const arg = /^\{[^}]*\}/.exec(flat.slice(i, i + 200));
          if (arg && /^(tabular|array|minipage|thebibliography)/.test(env[2])) i += arg[0].length;
        }
        unitStart = i;
        before = 'paragraph';
        continue;
      }
      const struct = /^\\(item|section|subsection|subsubsection|paragraph|subparagraph|chapter|part|caption|maketitle|title|author|footnote|bibitem|noindent|medskip|bigskip|smallskip|newpage|clearpage)(?![a-zA-Z])\*?/.exec(rest);
      if (struct) {
        push(i, 'paragraph', false);
        i += struct[0].length;
        // Skip a heading/title argument: [..] and {..} (one level of nested braces).
        const opt = /^\s*\[[^\]]*\]/.exec(flat.slice(i, i + 300));
        if (opt) i += opt[0].length;
        if (/^(section|subsection|subsubsection|paragraph|subparagraph|chapter|part|title|author|bibitem)$/.test(struct[1])) {
          const arg = /^\s*\{(?:[^{}]|\{[^{}]*\})*\}/.exec(flat.slice(i, i + 600));
          if (arg) i += arg[0].length;
        }
        unitStart = i;
        before = 'paragraph';
        continue;
      }
      i++;
      continue;
    }
    if (c === '$') {
      if (flat[i + 1] === '$') {
        if (inline) {
          i += 2;
          continue;
        }
        const close = flat.indexOf('$$', i + 2);
        if (close < 0) return bail(i);
        i = displayEnd(flat.slice(i + 2, close), close + 2);
        continue;
      }
      inline = inline === '$' ? '' : inline ? inline : '$';
      i++;
      continue;
    }
    if (!inline && (c === '.' || c === '?' || c === '!')) {
      let j = i + 1;
      while (j < n && /[)\]'"’”}]/.test(flat[j])) j++;
      const next = flat.slice(j, j + 3);
      const endsHere = j >= n || paragraphBreaks.has(j) || (next[0] === ' ' && /^ (?:[A-Z0-9\\$(`"“‘']|$)/.test(next));
      if (endsHere && !(c === '.' && isAbbreviation(flat, i))) {
        push(j, 'sentence', true);
        unitStart = j;
        before = 'sentence';
        i = j;
        continue;
      }
    }
    i++;
  }
  push(n, 'end', false);
  // A unit ending exactly at a break still counts as terminal when its text does.
  for (const u of units) if (!u.terminal && /[.?!][)\]'"’”}]*$/.test(flat.slice(u.start, u.end))) u.terminal = true;
  return units;
}

function isAbbreviation(flat: string, dot: number): boolean {
  const m = /([A-Za-z.\\]+)$/.exec(flat.slice(Math.max(0, dot - 12), dot));
  if (!m) return false;
  const w = m[1].replace(/^\\/, '');
  if (/^[A-Z]$/.test(w)) return true; // an initial: "J. Smith"
  if (/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(w)) return true; // "e.g", "i.e", "a.e"
  return ABBREVIATIONS.has(w.toLowerCase());
}

/** Unescaped `$` count is even and braces balance. */
export function balanced(s: string): boolean {
  let dollars = 0;
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '$') dollars++;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth < 0) return false;
    }
  }
  return dollars % 2 === 0 && depth === 0;
}

export interface FlatTex {
  flat: string;
  breaks: Set<number>;
  /** flat offset of the start of each physical line of the comment-stripped LaTeX. */
  lineStarts: number[];
  lines: string[];
  units?: Unit[];
}

/** Flatten with bookkeeping: paragraph breaks (blank lines) and where each physical line starts. */
export function prepareTex(tex: string): FlatTex {
  const lines = stripTexComments(tex).split('\n');
  let flat = '';
  const breaks = new Set<number>();
  const lineStarts: number[] = [];
  let blank = 0;
  for (const raw of lines) {
    const line = raw.replace(/[ \t\r\f\v]+/g, ' ');
    const t = line.trim();
    if (t === '') {
      blank++;
      lineStarts.push(flat.length);
      continue;
    }
    if (flat.length > 0) {
      if (blank > 0) breaks.add(flat.length);
      flat += ' ';
    }
    blank = 0;
    lineStarts.push(flat.length);
    flat += t;
  }
  // Must agree with flattenTex (the lint's verbatim check).
  return { flat, breaks, lineStarts, lines };
}

export type QuoteResult = { ok: true; quote: string } | { ok: false; reason: string };

/** Where the sourceLine sits in the flattened paper: [start, end) or null. */
export function locate(ft: FlatTex, sourceLine: string): [number, number] | null {
  const want = sourceLine.replace(/\s+/g, ' ').trim();
  const direct = want.length >= 12 ? ft.flat.indexOf(want) : -1;
  if (direct >= 0) return [direct, direct + want.length];
  // Fuzzy: the smallest window of physical lines whose words contain the sourceLine's words.
  const k = quoteSkeleton(sourceLine);
  if (!k.trim()) return null;
  const lineEnd = (j: number) => (j + 1 < ft.lineStarts.length ? ft.lineStarts[j + 1] : ft.flat.length);
  for (let w = 1; w <= 4; w++) {
    for (let j = 0; j + w <= ft.lines.length; j++) {
      if (!ft.lines[j].trim()) continue;
      const a = ft.lineStarts[j];
      const b = lineEnd(j + w - 1);
      if (quoteFound(sourceLine, texSkeleton(ft.flat.slice(a, b)))) return [a, b];
    }
  }
  return null;
}

/** The full sentence(s) around the sourceLine, or why there is none. */
export function sentenceQuote(ft: FlatTex, sourceLine: string): QuoteResult {
  const at = locate(ft, sourceLine);
  if (!at) return { ok: false, reason: 'sourceLine not located in the paper LaTeX' };
  const units = (ft.units ??= sentenceUnits(ft.flat, ft.breaks));
  // Units overlapping the located text (ignoring surrounding spaces).
  let [a, b] = at;
  while (a < b && ft.flat[a] === ' ') a++;
  while (b > a && ft.flat[b - 1] === ' ') b--;
  const hit = units.filter((u) => u.end > a && u.start < b);
  if (hit.length === 0) return { ok: false, reason: 'sourceLine sits in display math or markup' };
  const first = hit[0];
  const last = hit[hit.length - 1];
  // The located range must be covered: no part of it inside skipped display math.
  if (first.start > a + 2 || last.end < b - 2) return { ok: false, reason: 'sourceLine runs into display math or a heading' };
  for (let k = 1; k < hit.length; k++) if (hit[k].breakBefore === 'math') return { ok: false, reason: 'sentence is split by display math' };
  if (first.breakBefore === 'math') return { ok: false, reason: 'sentence starts after display math' };
  if (!last.terminal) {
    if (last.breakAfter === 'math') return { ok: false, reason: 'sentence continues into display math' };
    if (last.breakAfter === 'end') return { ok: false, reason: 'no sentence end' };
    // A list item or paragraph without a full stop: whole, but only if it ends cleanly.
    if (/[,:(]$|\b(and|or|of|the|a|an|to|in|with|by|for|that|where|which)$/i.test(ft.flat.slice(last.start, last.end))) {
      return { ok: false, reason: 'sentence is cut by a break' };
    }
  }
  const quote = ft.flat.slice(first.start, last.end);
  const cap = hit.length === 1 ? MAX_SINGLE : MAX_QUOTE;
  if (hit.length > 2) return { ok: false, reason: `sourceLine spans ${hit.length} sentences` };
  if (quote.length > cap) return { ok: false, reason: `sentence too long (${quote.length} chars)` };
  if (!balanced(quote)) return { ok: false, reason: 'unbalanced math or braces' };
  if (!/[A-Za-z]/.test(quote.replace(/\$[^$]*\$/g, ''))) return { ok: false, reason: 'no text outside math' };
  if (!quoteFound(sourceLine, texSkeleton(quote))) return { ok: false, reason: 'quote does not contain the sourceLine' };
  return { ok: true, quote };
}

type Claim = { text?: unknown; sourceLine?: unknown; sourceQuote?: unknown; paper?: unknown };

export interface FillReport {
  id: string;
  cited: number;
  quoted: number;
  fallbacks: { claim: number; sourceLine: string; reason: string }[];
  changed: boolean;
}

/**
 * Set `sourceQuote` on every cited claim that has a clean sentence; drop a stale one that no
 * longer fits. `texByPaper` is the family's LaTeX per paper (catalog order; null = not on disk).
 */
export function fillSourceQuotes(entry: Record<string, unknown>, texByPaper: (string | null)[], cache = new Map<string, FlatTex>()): FillReport {
  const id = String(entry.id ?? '?');
  const claims = (entry.claims as Claim[] | undefined) ?? [];
  const cited = new Set<number>();
  if (typeof entry.explanation === 'string') for (const m of parseCitations(entry.explanation)) for (const c of m.claims) cited.add(c);
  const rep: FillReport = { id, cited: 0, quoted: 0, fallbacks: [], changed: false };
  const prep = (key: string, tex: string) => {
    let ft = cache.get(key);
    if (!ft) {
      ft = prepareTex(tex);
      cache.set(key, ft);
    }
    return ft;
  };
  for (const n of [...cited].sort((x, y) => x - y)) {
    const c = claims[n - 1];
    if (!c || typeof c.sourceLine !== 'string' || !c.sourceLine.trim()) continue;
    rep.cited++;
    const order = typeof c.paper === 'number' ? [c.paper - 1] : texByPaper.map((_, i) => i);
    let res: QuoteResult = { ok: false, reason: 'paper LaTeX not on disk' };
    for (const p of order) {
      const tex = texByPaper[p];
      if (!tex) continue;
      res = sentenceQuote(prep(`${id}#${p}`, tex), c.sourceLine);
      if (res.ok) break;
    }
    if (res.ok) {
      rep.quoted++;
      if (c.sourceQuote !== res.quote) {
        c.sourceQuote = res.quote;
        rep.changed = true;
      }
    } else {
      rep.fallbacks.push({ claim: n - 1, sourceLine: c.sourceLine, reason: res.reason });
      if (c.sourceQuote !== undefined) {
        delete c.sourceQuote;
        rep.changed = true;
      }
    }
  }
  return rep;
}

/** Re-serialise an entry with `sourceQuote` placed right after `sourceLine` in each claim. */
export function orderClaimKeys(entry: Record<string, unknown>): Record<string, unknown> {
  const claims = entry.claims as Record<string, unknown>[] | undefined;
  if (!claims) return entry;
  entry.claims = claims.map((c) => {
    if (!('sourceQuote' in c)) return c;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(c)) {
      if (k === 'sourceQuote') continue;
      out[k] = v;
      if (k === 'sourceLine') out.sourceQuote = c.sourceQuote;
    }
    if (!('sourceQuote' in out)) out.sourceQuote = c.sourceQuote;
    return out;
  });
  return entry;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const entryIdx = args.indexOf('--entry');
  const files =
    entryIdx >= 0 && args[entryIdx + 1]
      ? [args[entryIdx + 1]]
      : (await readdir(join(root, 'src/content/entries')))
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) => join(root, 'src/content/entries', f));
  const sourceDir = process.env.CF_SOURCE_DIR ?? join(root, 'source/openai-math');
  const catalog = JSON.parse(await readFile(join(root, 'src/data/catalog.json'), 'utf-8')) as {
    families: { id: string; papers: { abstract: string; pdf: string }[] }[];
  };
  let cited = 0;
  let quoted = 0;
  let changed = 0;
  const fallbacks: string[] = [];
  for (const file of files) {
    const entry = JSON.parse(await readFile(file, 'utf-8')) as Record<string, unknown>;
    const fam = catalog.families.find((f) => f.id === entry.id);
    if (!fam) continue;
    // LaTeX only (no abstract): the quote must come from the paper itself.
    const tex = await loadTexByPaper(fam.papers.map((p) => ({ pdf: p.pdf })), sourceDir);
    const rep = fillSourceQuotes(entry, tex);
    cited += rep.cited;
    quoted += rep.quoted;
    for (const f of rep.fallbacks) fallbacks.push(`${rep.id} claims[${f.claim}] (${f.reason}): ${f.sourceLine.slice(0, 90)}`);
    if (rep.changed) {
      changed++;
      if (!check) await writeFile(file, JSON.stringify(orderClaimKeys(entry), null, 2) + '\n', 'utf-8');
    }
  }
  if (fallbacks.length > 0) console.log(`Fallbacks (page shows the sourceLine):\n  ${fallbacks.join('\n  ')}`);
  console.log(
    `source-quotes: ${files.length} entries, ${cited} cited claims, ${quoted} with sourceQuote, ${cited - quoted} fallbacks, ` +
      `${changed} file(s) ${check ? 'would change' : 'updated'}`,
  );
  if (check && changed > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
