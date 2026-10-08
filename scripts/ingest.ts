/**
 * Deterministic ingest (§9, no AI).
 * Reads `source/openai-math` via `ingest/openai-math.ts` and writes
 * `src/data/catalog.json`.
 *
 * Usage: pnpm ingest
 */
import { execSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENAI_MATH_META, parseOpenaiMath, parseWithdrawals } from '../ingest/openai-math.js';
import type { Catalog, Family, WithdrawnPaper } from '../ingest/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = process.env.CF_SOURCE_DIR ?? join(root, 'source/openai-math');
const outPath = join(root, 'src/data/catalog.json');

function sourceCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { cwd: sourceDir, encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

async function main(): Promise<void> {
  const { subjects, families } = await parseOpenaiMath(sourceDir);
  const commit = sourceCommit();

  // Withdrawals: the lab drops withdrawn papers from CONTENTS.md, so we find each one's family
  // in the previous catalog (by preprint folder) and keep the record there for good.
  let previous: Catalog | null = null;
  try {
    previous = JSON.parse(await readFile(outPath, 'utf-8')) as Catalog;
  } catch {
    previous = null;
  }
  const byId = new Map<string, Family>(families.map((f) => [f.id, f]));
  const attach = (familyId: string, w: WithdrawnPaper) => {
    const fam = byId.get(familyId);
    if (!fam) return false;
    fam.withdrawn ??= [];
    if (!fam.withdrawn.some((x) => x.title === w.title)) fam.withdrawn.push(w);
    return true;
  };
  for (const old of previous?.families ?? []) for (const w of old.withdrawn ?? []) attach(old.id, w);
  const unplaced: string[] = [];
  for (const { dir, ...w } of await parseWithdrawals(sourceDir)) {
    const already = families.some((f) => f.withdrawn?.some((x) => x.title === w.title));
    if (already) continue;
    const home = previous?.families.find((f) => f.papers.some((p) => p.pdf.includes(`/preprints/${dir}/`)));
    if (!home || !attach(home.id, w)) unplaced.push(w.title);
  }
  if (unplaced.length) console.warn(`withdrawn papers with no known family: ${unplaced.join(' | ')}`);

  const catalog: Catalog = {
    source: {
      repo: OPENAI_MATH_META.repo,
      commit,
      fetchedAt: new Date().toISOString(),
    },
    license: OPENAI_MATH_META.license,
    collection: OPENAI_MATH_META.collection,
    lab: OPENAI_MATH_META.lab,
    science: OPENAI_MATH_META.science,
    subjects,
    families,
  };

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf-8');

  const papers = families.flatMap((f) => f.papers);
  const leanPapers = papers.filter((p) => p.lean).length;
  const trust = {
    formal: families.filter((f) => f.trust === 'formal').length,
    partial: families.filter((f) => f.trust === 'partial').length,
    claimed: families.filter((f) => f.trust === 'claimed').length,
  };

  console.log(`families=${families.length} papers=${papers.length} leanPapers=${leanPapers} subjects=${subjects.length}`);
  console.log(`trust formal=${trust.formal} partial=${trust.partial} claimed=${trust.claimed}`);
  console.log(`withdrawn=${families.reduce((n, f) => n + (f.withdrawn?.length ?? 0), 0)}`);
  console.log(`commit=${commit}`);
  console.log(`wrote ${outPath}`);
}

await main();
