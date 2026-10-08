/**
 * AI explain pipeline (§11).
 *
 * ingest ──► gather ──► reader ──► checker ──► lint/validate ──► files ──► PR
 *
 * Provider-agnostic OpenAI-compatible client. Credentials come ONLY from the
 * environment (`LLM_BASE_URL`, `LLM_API_KEY`, `READER_MODEL`, `CHECK_MODEL`);
 * nothing is committed. `--dry-run` uses no key and touches no network.
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
import { hasErrors, lintEntry } from './lint-ste.js';
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

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  readerModel: string;
  checkerModel: string;
}

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
  return {
    baseUrl: env.LLM_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: env.LLM_API_KEY as string,
    readerModel: env.READER_MODEL as string,
    checkerModel: env.CHECK_MODEL as string,
  };
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
  if (family.leanDoc) {
    evidence.push({
      kind: 'lean',
      url: `https://github.com/openai/math/blob/main/${family.leanDoc}`,
      label: 'Lean doc',
    });
  }
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

export function buildCheckerUser(draft: string, gathered: Gathered): string {
  return [
    'DRAFT ENTRY (JSON):',
    draft,
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

async function chatComplete(
  cfg: LlmConfig,
  model: string,
  messages: ChatMsg[],
  jsonMode: boolean,
): Promise<string> {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`;
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model,
        messages,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (res.status === 429 || res.status >= 500) {
      lastError = `${res.status} ${await res.text()}`.slice(0, 200);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`LLM request failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!content) throw new Error('LLM returned empty content');
    return content;
  }
  throw new Error(`LLM request failed after retries: ${lastError}`);
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
  const readerMd = await readFile(join(root, 'prompts/reader.md'), 'utf-8');
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
  status: 'written' | 'skipped' | 'failed';
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
    await chatComplete(cfg, cfg.readerModel, [{ role: 'system', content: readerMd }, { role: 'user', content: user }], true),
  );
  const checkedRaw = extractJson(
    await chatComplete(
      cfg,
      cfg.checkerModel,
      [{ role: 'system', content: checkerMd }, { role: 'user', content: buildCheckerUser(draftRaw, gathered) }],
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
        cfg,
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
  final.status = 'ai-checked';
  final.model = { reader: cfg.readerModel, checker: cfg.checkerModel, date: new Date().toISOString().slice(0, 10) };

  const steIssues = lintEntry(final as unknown as Record<string, unknown>);
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

  const readerMd = await readFile(join(root, 'prompts/reader.md'), 'utf-8');
  const checkerMd = await readFile(join(root, 'prompts/checker.md'), 'utf-8');
  const schemaText = await readFile(join(root, 'schema/entry.schema.json'), 'utf-8');
  const example017 = await readFile(join(entriesDir, '017.json'), 'utf-8');

  const limit = pLimit(Math.max(1, args.concurrency));
  const records: RunRecord[] = [];
  await Promise.all(
    selected.map((f) =>
      limit(async () => {
        const ex = existing.get(f.id);
        const g = await gatherFamily(sourceDir, f, f.summary);
        if (ex && ex.sourceHash === g.sourceHash) {
          records.push({ id: f.id, reader: cfg.readerModel, checker: cfg.checkerModel, ms: 0, status: 'skipped', unsupported: 0, warnings: [] });
          return;
        }
        try {
          records.push(await processFamily(cfg, catalog, f, g, readerMd, checkerMd, schemaText, example017));
        } catch (e) {
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
    ...records.map(
      (r) => `- ${r.id}: ${r.status}${r.warnings.length > 0 ? ` (warnings: ${r.warnings.join('; ')})` : ''}`,
    ),
  ].join('\n');
  await writeFile(join(pipelineDir, 'last-run.md'), summary + '\n', 'utf-8');
  console.log(summary);
  if (records.some((r) => r.status === 'failed')) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
