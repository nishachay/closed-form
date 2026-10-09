/**
 * AI explain pipeline (§11).
 *
 * ingest ──► gather ──► reader ──► checker ──► lint/validate ──► files ──► PR
 *
 * Provider-agnostic OpenAI-compatible client. Credentials come ONLY from the
 * environment (`LLM_BASE_URL`, `LLM_API_KEY`, `READER_MODEL`, `CHECK_MODEL`, and the
 * optional checker endpoint `CHECK_BASE_URL` / `CHECK_API_KEY`, which fall back to
 * the reader's); nothing is committed. `--dry-run` uses no key and touches no network.
 *
 * Free tiers: the reader can be Gemini's OpenAI-compatible endpoint
 * (https://generativelanguage.googleapis.com/v1beta/openai/) and the checker an
 * OpenRouter `:free` model (https://openrouter.ai/api/v1). Requests send only
 * `model`, `messages` and `response_format: json_object`, which both accept.
 * 429/503 are retried with exponential backoff honouring Retry-After; a daily-quota
 * error stops the run cleanly, keeping entries already written.
 *
 * Usage:
 *   pnpm explain --ids 007,017 | --batch 10 | --traces | --all [--concurrency 20] [--dry-run]
 *   pnpm calibrate [--apply]
 *
 * Never run `--all` for real without a `--dry-run` first.
 */
import { createHash } from 'node:crypto';
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { entrySchema, AI_ROLES, type Entry } from '../src/lib/entry.js';
import { hasErrors, lintClaimQuotes, lintEntry, lintSources, stripInlineTags } from './lint-ste.js';
import type { Catalog, Family } from '../ingest/types.js';
import { OPENAI_MATH_META } from '../ingest/openai-math.js';

/**
 * Structural aiRole gate (the substantive check is the checker's job — see
 * prompts/checker.md). aiRole must come from the sources, never guessed:
 * missing/invalid role, empty evidence, or no paper evidence fails the entry
 * to failures.jsonl for a human.
 */
export function verifyAiRole(entry: {
  aiRole?: unknown;
  evidence?: { kind?: unknown }[];
}): string[] {
  const errors: string[] = [];
  if (!(AI_ROLES as readonly string[]).includes(String(entry.aiRole))) {
    errors.push(`aiRole missing or invalid (must be one of ${AI_ROLES.join(', ')}, from the sources — never guessed)`);
  }
  if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
    errors.push('evidence must list at least the source paper');
  } else if (!entry.evidence.some((e) => e.kind === 'paper')) {
    errors.push('evidence must include the source paper the aiRole claim rests on');
  }
  return errors;
}

async function failToHuman(id: string, error: unknown): Promise<never> {
  await mkdir(pipelineDir, { recursive: true });
  await appendFile(
    join(pipelineDir, 'failures.jsonl'),
    JSON.stringify({ id, error }) + '\n',
  );
  throw new Error(`Entry ${id} failed for human review: ${JSON.stringify(error).slice(0, 200)}`);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entriesDir = join(root, 'src/content/entries');
const pipelineDir = join(root, 'pipeline');

/** Cap on LaTeX fed to the reader; the rest is noted, not silently used. */
export const MAX_TEX_CHARS = 60000;

export interface ExplainArgs {
  ids: string[];
  batch: number | null;
  traces: boolean;
  all: boolean;
  concurrency: number;
  dryRun: boolean;
}

export function parseExplainArgs(argv: string[]): ExplainArgs {
  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
  };
  const ids = (get('--ids') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const batchRaw = get('--batch');
  return {
    ids,
    batch: batchRaw !== null ? Number(batchRaw) : null,
    traces: argv.includes('--traces'),
    all: argv.includes('--all'),
    concurrency: Number(get('--concurrency') ?? '5'),
    dryRun: argv.includes('--dry-run'),
  };
}

export interface LlmEndpoint {
  baseUrl: string;
  apiKey: string;
}

export interface LlmConfig {
  /** Reader endpoint (LLM_BASE_URL / LLM_API_KEY). Kept flat for back-compat. */
  baseUrl: string;
  apiKey: string;
  /** Checker endpoint: CHECK_BASE_URL / CHECK_API_KEY, each falling back to the reader's. */
  checker: LlmEndpoint;
  readerModel: string;
  checkerModel: string;
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/** Reads credentials from env only. Throws a clear error naming what is missing. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): LlmConfig {
  const missing: string[] = [];
  if (!env.LLM_API_KEY) missing.push('LLM_API_KEY');
  if (!env.READER_MODEL) missing.push('READER_MODEL');
  if (!env.CHECK_MODEL) missing.push('CHECK_MODEL');
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        `Set them (or GitHub secrets of the same names) before a real run. ` +
        `--dry-run needs no key.`,
    );
  }
  // Empty strings count as unset: GitHub passes missing secrets as "".
  const baseUrl = env.LLM_BASE_URL || DEFAULT_BASE_URL;
  const apiKey = env.LLM_API_KEY as string;
  return {
    baseUrl,
    apiKey,
    checker: {
      baseUrl: env.CHECK_BASE_URL || baseUrl,
      apiKey: env.CHECK_API_KEY || apiKey,
    },
    readerModel: env.READER_MODEL as string,
    checkerModel: env.CHECK_MODEL as string,
  };
}

/** Endpoint for a role. */
export function endpointFor(cfg: LlmConfig, role: 'reader' | 'checker'): LlmEndpoint {
  return role === 'reader' ? { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey } : cfg.checker;
}

/**
 * Lean facts for a family, from repo files only (ingest: formalization.yaml,
 * lean/docs/<id>.md and the Comparator challenges that doc links to). The reader and
 * checker get these as fixed input; they may not assert Lean status beyond them.
 */
export interface LeanFacts {
  trust: string;
  yamlListedPapers: number;
  totalPapers: number;
  leanDocUrl: string | null;
  comparator: { file: string; url: string; theorems: string[]; support: boolean }[];
}

export function leanFacts(family: Family): LeanFacts {
  const leanDocUrl =
    family.leanDocUrl ?? (family.leanDoc ? `https://github.com/openai/math/blob/main/${family.leanDoc}` : null);
  return {
    trust: family.trust,
    yamlListedPapers: family.lean,
    totalPapers: family.papers.length,
    leanDocUrl,
    comparator: (family.comparator ?? []).map((c) => ({ ...c })),
  };
}

/** Plain-text block of the Lean facts for the prompts. */
export function leanFactsText(f: LeanFacts): string {
  const lines = [
    `- trust label: ${f.trust}`,
    `- papers listed in lean/formalization.yaml: ${f.yamlListedPapers} of ${f.totalPapers}`,
    `- Lean scope doc: ${f.leanDocUrl ?? 'none'}`,
  ];
  if (f.comparator.length === 0) lines.push('- Comparator challenges linked from the doc: none');
  for (const c of f.comparator) {
    lines.push(
      `- Comparator challenge ${c.file}${c.support ? ' (supporting result only, not a main theorem)' : ''}: ` +
        `theorems ${c.theorems.length > 0 ? c.theorems.join(', ') : '(none named)'}`,
    );
  }
  return lines.join('\n');
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Deterministic Lean evidence: one item for the doc, one per Comparator challenge.
 * Overwrites whatever the model wrote for kind "lean" after the model call.
 * Wording states only what the files show; it never says what is or is not covered.
 */
export function leanEvidence(family: Family): { kind: 'lean'; url: string; label: string; note: string }[] {
  const f = leanFacts(family);
  const out: { kind: 'lean'; url: string; label: string; note: string }[] = [];
  const main = f.comparator.filter((c) => !c.support);
  if (f.leanDocUrl) {
    const parts: string[] = [];
    if (f.yamlListedPapers > 0) {
      parts.push(`${plural(f.yamlListedPapers, 'paper', 'papers')} of ${f.totalPapers} listed in lean/formalization.yaml.`);
    } else {
      parts.push('No paper listed in lean/formalization.yaml.');
    }
    parts.push(
      main.length > 0
        ? `The scope doc links ${plural(main.length, 'Comparator challenge', 'Comparator challenges')} for main results.`
        : 'The scope doc links no Comparator challenge for main results.',
    );
    out.push({ kind: 'lean', url: f.leanDocUrl, label: 'Lean scope doc', note: parts.join(' ') });
  }
  for (const c of f.comparator) {
    const name = c.file.split('/').pop() ?? c.file;
    out.push({
      kind: 'lean',
      url: c.url,
      label: `Comparator challenge ${name}${c.support ? ' (supporting result)' : ''}`,
      note:
        c.theorems.length > 0
          ? `Names ${plural(c.theorems.length, 'theorem', 'theorems')}: ${c.theorems.join(', ')}.`.slice(0, 500)
          : 'Names no theorem.',
    });
  }
  return out;
}

/** Replace every kind "lean" evidence item with the deterministic ones (keeps others in order). */
export function applyLeanEvidence<T extends { kind: string }>(evidence: T[], family: Family): (T | ReturnType<typeof leanEvidence>[number])[] {
  return [...evidence.filter((e) => e.kind !== 'lean'), ...leanEvidence(family)];
}

export interface Gathered {
  id: string;
  texFiles: string[];
  texChars: number;
  truncated: boolean;
  sourceText: string;
  sourceHash: string;
  evidence: { kind: string; url: string; label?: string }[];
}

async function readTexTree(dir: string): Promise<string[]> {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = (await readdir(dir)).sort();
  } catch {
    return [];
  }
  for (const e of entries) {
    const p = join(dir, e);
    const { stat } = await import('node:fs/promises');
    const s = await stat(p);
    if (s.isDirectory()) out = out.concat(await readTexTree(p));
    else if (e.endsWith('.tex')) out.push(p);
  }
  return out;
}

/**
 * Gather per §11.1: every paper's .tex from the submodule, abstract fallback,
 * family summary, trust, reasoning trace. sourceHash = sha256 of the exact
 * gathered source text (tex joined, or abstracts+summary on fallback).
 *
 * NOTE: the 017 seed's stored sourceHash predates this definition and will
 * not match a fresh gather — a real run treats 017 as source-changed and
 * reprocesses it. Safe direction; noted in PR_NOTES.md.
 */
export async function gatherFamily(
  sourceDir: string,
  family: Family,
  summary: string,
): Promise<Gathered> {
  const dirs = new Set<string>();
  for (const p of family.papers) {
    const m = p.pdf.match(/preprints\/([^/]+)\//);
    if (m) dirs.add(join(sourceDir, 'preprints', m[1]));
  }
  let texFiles: string[] = [];
  for (const d of dirs) texFiles = texFiles.concat(await readTexTree(d));
  texFiles.sort();

  let sourceText: string;
  if (texFiles.length > 0) {
    const parts: string[] = [];
    for (const f of texFiles) parts.push(await readFile(f, 'utf-8'));
    sourceText = parts.join('\n');
  } else {
    sourceText = family.papers.map((p) => p.abstract).join('\n\n') + '\n\n' + summary;
  }
  const truncated = sourceText.length > MAX_TEX_CHARS;
  if (truncated) sourceText = sourceText.slice(0, MAX_TEX_CHARS);
  const sourceHash = createHash('sha256').update(sourceText).digest('hex');

  const evidence: Gathered['evidence'] = family.papers.map((p) => ({
    kind: 'paper',
    url: p.pdf,
    label: p.title.replace(/<[^>]+>/g, ''),
  }));
  if (family.trace) {
    evidence.push({ kind: 'trace', url: family.trace, label: 'Reasoning summary' });
  }
  evidence.push(...leanEvidence(family));
  return {
    id: family.id,
    texFiles: texFiles.map((f) => f.replace(sourceDir + '/', '')),
    texChars: sourceText.length,
    truncated,
    sourceText,
    sourceHash,
    evidence,
  };
}

export function buildReaderUser(
  family: Family,
  gathered: Gathered,
  schemaText: string,
  example017: string,
  sourceCommit: string,
): string {
  return [
    `FAMILY ${family.id} — ${family.title.replace(/<[^>]+>/g, '')}`,
    `collection: ${OPENAI_MATH_META.collection} | lab: ${OPENAI_MATH_META.lab} | science: ${OPENAI_MATH_META.science} | field: ${family.subject}`,
    `trust: ${family.trust} (computed, never softened)`,
    `sourceCommit: ${sourceCommit} | sourceHash: ${gathered.sourceHash}`,
    `evidence (copy unchanged): ${JSON.stringify(gathered.evidence)}`,
    '',
    'LEAN FACTS (fixed input from repo files; the ONLY Lean information you may state):',
    leanFactsText(leanFacts(family)),
    LEAN_RULE,
    '',
    RELEASE_PROVENANCE,
    '',
    'OFFICIAL SUMMARY (in its own words, NOT plain language):',
    family.summary.replace(/<[^>]+>/g, ''),
    '',
    `SOURCE LATEX${gathered.truncated ? ' (truncated, capped)' : ''}:`,
    gathered.sourceText,
    '',
    'ENTRY SCHEMA (output must validate against this):',
    schemaText,
    '',
    'GOLD EXAMPLE (entry 017, match this quality):',
    example017,
  ].join('\n');
}

/** Shared rule for reader and checker: Lean status comes from the facts, never from the model. */
export const LEAN_RULE =
  'Do not assert any Lean or Comparator status beyond these facts: do not say a theorem is or is not ' +
  'formalized, machine-checked or Comparator-checked unless a fact above names it. Do not map theorem ' +
  'names to paper theorem numbers. If unsure, say only that a Lean scope doc and Comparator challenges are listed.';

/**
 * Checker rubric appended to prompts/checker.md (the CHECK_MODEL system prompt).
 * Added after fact-checks of 007, 087 and 102 found a reversed implication, missing
 * prior work the paper cites, and Lean claims the repo files did not support.
 */
export const CHECKER_RUBRIC = [
  'ADDITIONAL REQUIRED CHECKS (fail or fix the entry; never skip):',
  '(a) IMPLICATION DIRECTION. For every "implies", "follows from", "stronger than", "weaker than",',
  '    "generalizes", "special case of", "if … then", "equivalent to" claim, find the source line and',
  '    confirm the direction. A reversed or overstated direction is unsupported: rewrite it the right way round.',
  '(b) PRIOR WORK. Read the introduction. Every result it presents as the closest, preceding or',
  '    best-known previous work (names, years, bounds) must be mentioned in the story or',
  '    "Why it matters", with a `sources` entry. Add missing ones from the paper text only.',
  '(c) DEFINITIONS. Every definition in the entry (body text and glossary) must match the paper\'s',
  '    own definition: same objects, same quantifiers, same conditions. Fix any that differ.',
  '(d) LEAN STATUS. Lean/Comparator wording must not go beyond the LEAN FACTS block. Delete anything more.',
  '(e) QUOTES. Each supported claim\'s `sourceLine` must be copied verbatim from the SOURCE LATEX',
  '    (whitespace may differ; use "…" only to skip a formula). Each external claim needs a `sourceId`.',
  '(f) SOURCES. Every `sources` item needs a `url`, unless no online copy exists: then set `noUrl: true`',
  '    and end `cite` with "(no online copy found)".',
  '(g) EXPLANATION. Check every sentence of `explanation` like any other text. Recompute each number in',
  '    its worked example; drop or fix any you cannot reproduce. Bounds must match the source digits exactly.',
  '    Certainty wording must come from the LEAN FACTS only, and the word "verified" is not allowed.',
].join('\n');


/**
 * Release-level provenance, quoted verbatim from openai/math README.md
 * ("How the results were produced"). The per-paper LaTeX lists only "OpenAI"
 * as author, so without this fixed input the checker rejects every aiRole.
 */
export const RELEASE_PROVENANCE = [
  'RELEASE PROVENANCE (fixed input, quoted verbatim from the openai/math README; a valid source for aiRole):',
  '"This repository contains mathematical manuscripts and supporting proof artifacts produced by an internal OpenAI model."',
  '"The vast majority of results were obtained with the same procedure using an unreleased internal OpenAI model. On average, each result used three hours of ChatGPT Pro thinking compute with that model."',
  '"Exceptions to this fixed procedure include work on a zero-free region for the Riemann zeta function and proof of the Hodge Conjecture for CM abelian varieties. Additionally, the writeup for the Re(s) > 11/12 zero-free region for the Riemann zeta function was human edited for readability."',
  'RULE: for families produced by the fixed procedure, aiRole "autonomous" is supported by this block; quote it as the sourceLine. For the named exceptions (Riemann zeta zero-free region, Hodge Conjecture for CM abelian varieties), do not claim "autonomous".',
].join('\n');

export function buildCheckerUser(draft: string, gathered: Gathered, family?: Family): string {
  return [
    'DRAFT ENTRY (JSON):',
    draft,
    '',
    ...(family
      ? ['LEAN FACTS (fixed input from repo files):', leanFactsText(leanFacts(family)), LEAN_RULE, '']
      : []),
    RELEASE_PROVENANCE,
    '',
    'SOURCE LATEX:',
    gathered.sourceText,
    '',
    'Return JSON: { claims: [...], entry: {...} } per the system prompt.',
  ].join('\n');
}

interface ChatMsg {
  role: 'system' | 'user';
  content: string;
}

/** The run must stop: a provider's daily (or persistent) quota is exhausted. */
export class QuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExhaustedError';
  }
}

/** True when a 429 body names a per-day / exhausted quota (Gemini, OpenRouter wording). */
export function isDailyQuota(body: string): boolean {
  return /per.?day|perday|daily|free-models-per-day|RESOURCE_EXHAUSTED[\s\S]*quota|quota[\s\S]{0,80}exceeded[\s\S]{0,200}(day|limit: ?0)/i.test(body);
}

/**
 * Milliseconds to wait before retry: Retry-After (seconds or HTTP date), else Gemini's
 * `retryDelay: "37s"` in the body, else exponential backoff. Capped at `capMs`.
 */
export function retryDelayMs(
  attempt: number,
  retryAfter: string | null,
  body = '',
  now = Date.now(),
  baseMs = 2000,
  capMs = 120_000,
): number {
  let ms: number | null = null;
  if (retryAfter) {
    const secs = Number(retryAfter);
    if (Number.isFinite(secs)) ms = secs * 1000;
    else {
      const t = Date.parse(retryAfter);
      if (!Number.isNaN(t)) ms = Math.max(0, t - now);
    }
  }
  if (ms === null) {
    const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(body);
    if (m) ms = Number(m[1]) * 1000;
  }
  if (ms === null) ms = baseMs * 2 ** attempt;
  return Math.min(capMs, Math.max(0, ms));
}

export const MAX_TRIES = 5;

export interface ChatOptions {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxTries?: number;
}

/** Request body: only fields Gemini's OpenAI-compatible layer and OpenRouter both accept. */
export function chatBody(
  model: string,
  messages: ChatMsg[],
  jsonMode: boolean,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
  // Opt-in extras (both off by default so Gemini/OpenRouter bodies stay minimal):
  // LLM_STREAM=1 streams the reply (long reasoning models otherwise hit
  // fetch's 300 s header timeout); LLM_MAX_TOKENS lifts a provider's low default
  // output cap, which truncated whole entries into unparseable JSON.
  const maxTokens = Number(env.LLM_MAX_TOKENS || 0);
  return {
    model,
    messages,
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    ...(maxTokens > 0 ? { max_tokens: maxTokens } : {}),
    ...(env.LLM_STREAM === '1' ? { stream: true } : {}),
  };
}

/** Reads an OpenAI-style SSE stream; returns the answer text (reasoning deltas are dropped) and finish reason. */
export async function readStream(res: Response): Promise<{ content: string; finish: string | null }> {
  const text = await res.text();
  let content = '';
  let finish: string | null = null;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t.startsWith('data:')) continue;
    const payload = t.slice(5).trim();
    if (payload === '[DONE]') break;
    try {
      const j = JSON.parse(payload) as { choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[] };
      const c = j.choices?.[0];
      if (c?.delta?.content) content += c.delta.content;
      if (c?.finish_reason) finish = c.finish_reason;
    } catch {
      // ignore keep-alive or partial lines
    }
  }
  return { content, finish };
}

export async function chatComplete(
  endpoint: LlmEndpoint,
  model: string,
  messages: ChatMsg[],
  jsonMode: boolean,
  opts: ChatOptions = {},
): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxTries = opts.maxTries ?? MAX_TRIES;
  const url = `${endpoint.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  let lastError = '';
  let last429 = false;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    let res: Response;
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${endpoint.apiKey}` },
        body: JSON.stringify(chatBody(model, messages, jsonMode)),
      });
    } catch (e) {
      lastError = `network: ${String(e)}`.slice(0, 300);
      last429 = false;
      if (attempt < maxTries - 1) await sleep(retryDelayMs(attempt, null));
      continue;
    }
    if (res.status === 429 || res.status === 503 || res.status >= 500) {
      const body = await res.text();
      lastError = `${res.status} ${body}`.slice(0, 300);
      last429 = res.status === 429;
      if (res.status === 429 && isDailyQuota(body)) {
        throw new QuotaExhaustedError(`daily quota exhausted for ${model}: ${lastError}`);
      }
      if (attempt < maxTries - 1) await sleep(retryDelayMs(attempt, res.headers.get('retry-after'), body));
      continue;
    }
    if (!res.ok) throw new Error(`LLM request failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    let content = '';
    let finish: string | null = null;
    if ((res.headers.get('content-type') ?? '').includes('text/event-stream')) {
      try {
        ({ content, finish } = await readStream(res));
      } catch (e) {
        lastError = `stream: ${String(e)}`.slice(0, 300);
        last429 = false;
        if (attempt < maxTries - 1) await sleep(retryDelayMs(attempt, null));
        continue;
      }
    } else {
      const data = (await res.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
      content = data.choices?.[0]?.message?.content ?? '';
      finish = data.choices?.[0]?.finish_reason ?? null;
    }
    if (finish === 'length') {
      // Truncated output is never a valid entry; retrying wastes quota, so fail clearly.
      throw new Error(`LLM output hit the token limit (finish_reason=length) for ${model}; raise LLM_MAX_TOKENS`);
    }
    if (!content) {
      lastError = 'empty content';
      last429 = false;
      if (attempt < maxTries - 1) await sleep(retryDelayMs(attempt, null));
      continue;
    }
    return content;
  }
  if (last429) throw new QuotaExhaustedError(`rate limit persisted after ${maxTries} tries for ${model}: ${lastError}`);
  throw new Error(`LLM request failed after ${maxTries} tries: ${lastError}`);
}

export function extractJson(text: string): string {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (m ? m[1] : text).trim();
}

function pLimit(n: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task = () => {
        active++;
        fn().then(
          (v) => {
            active--;
            resolve(v);
            queue.shift()?.();
          },
          (e) => {
            active--;
            reject(e);
            queue.shift()?.();
          },
        );
      };
      if (active < n) task();
      else queue.push(task);
    });
  };
}

/**
 * Writer system prompt: prompts/reader.md (fields, provenance, sources) followed by
 * prompts/explainer.md (how to write the prose `explanation` body).
 */
export async function readReaderPrompt(): Promise<string> {
  const reader = await readFile(join(root, 'prompts/reader.md'), 'utf-8');
  const explainer = await readFile(join(root, 'prompts/explainer.md'), 'utf-8');
  return `${reader}\n\n---\n\nEXPLAINER RULES (prompts/explainer.md):\n\n${explainer}`;
}

async function loadCatalog(): Promise<Catalog> {
  const raw = await readFile(join(root, 'src/data/catalog.json'), 'utf-8');
  return JSON.parse(raw) as Catalog;
}

async function loadExisting(): Promise<Map<string, { sourceHash?: string }>> {
  const map = new Map<string, { sourceHash?: string }>();
  let files: string[] = [];
  try {
    files = (await readdir(entriesDir)).filter((f) => f.endsWith('.json'));
  } catch {
    return map;
  }
  for (const f of files) {
    try {
      const raw = JSON.parse(await readFile(join(entriesDir, f), 'utf-8')) as {
        id?: string;
        sourceHash?: string;
      };
      if (raw.id) map.set(raw.id, { sourceHash: raw.sourceHash });
    } catch {
      /* ignore unreadable entries */
    }
  }
  return map;
}

/** Families needing work, in catalog order. */
export function selectFamilies(
  catalog: Catalog,
  existing: Map<string, { sourceHash?: string }>,
  args: ExplainArgs,
  pendingHashes?: Map<string, string>,
): Family[] {
  const byId = new Map(catalog.families.map((f) => [f.id, f]));
  if (args.ids.length > 0) {
    return args.ids.map((id) => {
      const f = byId.get(id);
      if (!f) throw new Error(`Unknown family id: ${id}`);
      return f;
    });
  }
  const TRACES = ['007', '017', '087', '102', '159', '197', '221', '271', '287', '362'];
  let pool = catalog.families;
  if (args.traces) pool = pool.filter((f) => TRACES.includes(f.id));
  if (!args.all && !args.traces && args.batch === null) {
    throw new Error('Nothing selected: pass --ids, --batch N, --traces or --all.');
  }
  const need = pool.filter((f) => {
    const ex = existing.get(f.id);
    if (!ex) return true;
    const fresh = pendingHashes?.get(f.id);
    return fresh !== undefined && fresh !== ex.sourceHash;
  });
  if (args.batch !== null) {
    if (!Number.isInteger(args.batch) || args.batch <= 0) throw new Error('--batch needs a positive integer');
    return need.slice(0, args.batch);
  }
  return need;
}

export interface DryRunRow {
  id: string;
  subject: string;
  trust: string;
  papers: number;
  texFiles: number;
  texChars: number;
  truncated: boolean;
  sourceHash: string;
  existing: boolean;
  wouldSkip: boolean;
  readerPromptChars: number;
  writePath: string;
}

/** Offline plan for the selected ids: gather + prompt sizes, no network, no writes. */
export async function runDryRun(ids: string[]): Promise<DryRunRow[]> {
  const catalog = await loadCatalog();
  const existing = await loadExisting();
  const fams = selectFamilies(catalog, existing, {
    ids,
    batch: null,
    traces: false,
    all: false,
    concurrency: 1,
    dryRun: true,
  });
  const readerMd = await readReaderPrompt();
  const schemaText = await readFile(join(root, 'schema/entry.schema.json'), 'utf-8');
  const example017 = await readFile(join(entriesDir, '017.json'), 'utf-8');
  const sourceDir = join(root, 'source/openai-math');
  const rows: DryRunRow[] = [];
  for (const f of fams) {
    const fam = catalog.families.find((x) => x.id === f.id) as Family;
    const summary = fam.summary;
    const g = await gatherFamily(sourceDir, fam, summary);
    const user = buildReaderUser(fam, g, schemaText, example017, catalog.source.commit);
    const ex = existing.get(f.id);
    rows.push({
      id: f.id,
      subject: fam.subject,
      trust: fam.trust,
      papers: fam.papers.length,
      texFiles: g.texFiles.length,
      texChars: g.texChars,
      truncated: g.truncated,
      sourceHash: g.sourceHash,
      existing: !!ex,
      wouldSkip: !!ex && ex.sourceHash === g.sourceHash,
      readerPromptChars: readerMd.length + user.length,
      writePath: join('src/content/entries', `${f.id}.json`),
    });
  }
  return rows;
}

interface RunRecord {
  id: string;
  reader: string;
  checker: string;
  ms: number;
  status: 'written' | 'skipped' | 'failed' | 'not-run';
  unsupported: number;
  warnings: string[];
}

async function processFamily(
  cfg: LlmConfig,
  catalog: Catalog,
  family: Family,
  gathered: Gathered,
  readerMd: string,
  checkerMd: string,
  schemaText: string,
  example017: string,
): Promise<RunRecord> {
  const t0 = Date.now();
  const user = buildReaderUser(family, gathered, schemaText, example017, catalog.source.commit);
  const draftRaw = extractJson(
    await chatComplete(endpointFor(cfg, 'reader'), cfg.readerModel, [{ role: 'system', content: readerMd }, { role: 'user', content: user }], true),
  );
  const checkedRaw = extractJson(
    await chatComplete(
      endpointFor(cfg, 'checker'),
      cfg.checkerModel,
      [{ role: 'system', content: checkerMd }, { role: 'user', content: buildCheckerUser(draftRaw, gathered, family) }],
      true,
    ),
  );

  let parsed = JSON.parse(checkedRaw) as { claims?: unknown; entry?: unknown; failed?: unknown; reason?: unknown };
  if (parsed.failed === true) {
    await failToHuman(family.id, `checker failed entry: ${String(parsed.reason ?? 'aiRole or claim unsupported by sources')}`);
  }
  let entry = parsed.entry;
  let attempt = 0;
  for (;;) {
    const res = entrySchema.safeParse(entry);
    if (res.success) {
      entry = res.data;
      break;
    }
    if (attempt >= 2) {
      await mkdir(pipelineDir, { recursive: true });
      await appendFile(
        join(pipelineDir, 'failures.jsonl'),
        JSON.stringify({ id: family.id, error: res.error.issues.map((i) => i.message), attempt }) + '\n',
      );
      throw new Error(`Validation failed after 2 retries for ${family.id}`);
    }
    attempt++;
    const fix = extractJson(
      await chatComplete(
        endpointFor(cfg, 'checker'),
        cfg.checkerModel,
        [
          { role: 'system', content: checkerMd },
          {
            role: 'user',
            content:
              `Previous output failed validation with these errors:\n` +
              res.error.issues.map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n') +
              `\nFix exactly these errors and nothing else. Previous output:\n${JSON.stringify(parsed)}`,
          },
        ],
        true,
      ),
    );
    parsed = JSON.parse(fix) as { claims?: unknown; entry?: unknown; failed?: unknown; reason?: unknown };
    if (parsed.failed === true) {
      await failToHuman(family.id, `checker failed entry on retry: ${String(parsed.reason ?? 'unsupported')}`);
    }
    entry = parsed.entry;
  }

  const final = entry as Entry;
  const roleErrors = verifyAiRole(final as { aiRole?: unknown; evidence?: { kind?: unknown }[] });
  if (roleErrors.length > 0) {
    await failToHuman(family.id, roleErrors);
  }
  // Lean evidence is overwritten from repo facts, whatever the models wrote.
  final.evidence = applyLeanEvidence(final.evidence, family) as Entry['evidence'];
  final.status = 'ai-checked';
  final.model = { reader: cfg.readerModel, checker: cfg.checkerModel, date: new Date().toISOString().slice(0, 10) };

  const steIssues = [
    ...lintEntry(final as unknown as Record<string, unknown>),
    ...lintSources(final as unknown as Record<string, unknown>),
    ...lintClaimQuotes(
      final as unknown as Record<string, unknown>,
      gathered.texFiles.length > 0
        ? [gathered.sourceText, stripInlineTags(family.summary), ...family.papers.map((p) => stripInlineTags(p.abstract))].join('\n')
        : null,
    ),
  ];
  if (hasErrors(steIssues)) {
    await mkdir(pipelineDir, { recursive: true });
    await appendFile(
      join(pipelineDir, 'failures.jsonl'),
      JSON.stringify({ id: family.id, error: steIssues.map((i) => i.message) }) + '\n',
    );
    throw new Error(`STE lint failed for ${family.id}`);
  }

  // claims[] holds only surviving supported/external verdicts (unsupported
  // statements are deleted by the checker, never listed), so nothing to count.
  const out = { ...final };
  await writeFile(join(entriesDir, `${family.id}.json`), JSON.stringify(out, null, 2) + '\n', 'utf-8');
  return {
    id: family.id,
    reader: cfg.readerModel,
    checker: cfg.checkerModel,
    ms: Date.now() - t0,
    status: 'written',
    unsupported: 0,
    warnings: steIssues.map((i) => i.message),
  };
}

async function main(): Promise<void> {
  const args = parseExplainArgs(process.argv.slice(2));

  if (args.dryRun) {
    const ids =
      args.ids.length > 0
        ? args.ids
        : (() => {
            throw new Error('--dry-run needs --ids (e.g. --dry-run --ids 007).');
          })();
    const rows = await runDryRun(ids);
    for (const r of rows) console.log(JSON.stringify(r));
    console.log(
      `dry run: ${rows.length} famil${rows.length === 1 ? 'y' : 'ies'}, no network, no writes. ` +
        `Real run would need ${['LLM_API_KEY', 'READER_MODEL', 'CHECK_MODEL'].join(', ')}.`,
    );
    return;
  }

  const cfg = loadConfig();
  const catalog = await loadCatalog();
  const existing = await loadExisting();
  const sourceDir = join(root, 'source/openai-math');

  // Pre-gather for skip decisions (cheap, local).
  const pendingHashes = new Map<string, string>();
  const needsHash = args.ids.length > 0 ? args.ids : catalog.families.map((f) => f.id);
  for (const id of needsHash) {
    const f = catalog.families.find((x) => x.id === id);
    if (!f) throw new Error(`Unknown family id: ${id}`);
    pendingHashes.set(id, (await gatherFamily(sourceDir, f, f.summary)).sourceHash);
  }
  const selected = selectFamilies(catalog, existing, args, pendingHashes);

  const readerMd = await readReaderPrompt();
  const checkerMd = (await readFile(join(root, 'prompts/checker.md'), 'utf-8')) + '\n\n' + CHECKER_RUBRIC + '\n';
  const schemaText = await readFile(join(root, 'schema/entry.schema.json'), 'utf-8');
  const example017 = await readFile(join(entriesDir, '017.json'), 'utf-8');

  // Once a quota is exhausted, no new family starts; finished entries stay written.
  let quotaStop: string | null = null;
  const limit = pLimit(Math.max(1, args.concurrency));
  const records: RunRecord[] = [];
  await Promise.all(
    selected.map((f) =>
      limit(async () => {
        if (quotaStop) {
          records.push({ id: f.id, reader: cfg.readerModel, checker: cfg.checkerModel, ms: 0, status: 'not-run', unsupported: 0, warnings: ['quota stop'] });
          return;
        }
        const ex = existing.get(f.id);
        const g = await gatherFamily(sourceDir, f, f.summary);
        if (ex && ex.sourceHash === g.sourceHash) {
          records.push({ id: f.id, reader: cfg.readerModel, checker: cfg.checkerModel, ms: 0, status: 'skipped', unsupported: 0, warnings: [] });
          return;
        }
        try {
          records.push(await processFamily(cfg, catalog, f, g, readerMd, checkerMd, schemaText, example017));
        } catch (e) {
          if (e instanceof QuotaExhaustedError) {
            quotaStop ??= e.message;
            records.push({ id: f.id, reader: cfg.readerModel, checker: cfg.checkerModel, ms: 0, status: 'not-run', unsupported: 0, warnings: [e.message] });
            return;
          }
          records.push({ id: f.id, reader: cfg.readerModel, checker: cfg.checkerModel, ms: 0, status: 'failed', unsupported: 0, warnings: [String(e)] });
        }
      }),
    ),
  );

  await mkdir(pipelineDir, { recursive: true });
  for (const r of records) {
    await appendFile(join(pipelineDir, 'runs.jsonl'), JSON.stringify(r) + '\n');
  }
  const written = records.filter((r) => r.status === 'written');
  const summary = [
    `## Entries: ${written.map((r) => r.id).join(', ') || '(none)'}`,
    '',
    ...(quotaStop
      ? [
          `Stopped early: provider quota exhausted. Entries written before the stop are kept; ` +
            `${records.filter((r) => r.status === 'not-run').length} not run — re-run later.`,
          '',
        ]
      : []),
    ...records.map(
      (r) => `- ${r.id}: ${r.status}${r.warnings.length > 0 ? ` (warnings: ${r.warnings.join('; ')})` : ''}`,
    ),
  ].join('\n');
  await writeFile(join(pipelineDir, 'last-run.md'), summary + '\n', 'utf-8');
  console.log(summary);
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `quota_stop=${quotaStop ? 'true' : 'false'}\nwritten=${written.length}\n`);
  }
  // A quota stop is a clean stop: exit 0 so the workflow opens a PR with what finished.
  if (quotaStop) return;
  if (records.some((r) => r.status === 'failed')) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
