/**
 * Deterministic ingest (§9, no AI).
 * Reads `source/openai-math` via `ingest/openai-math.ts` and writes
 * `src/data/catalog.json`.
 *
 * Usage: pnpm ingest
 */
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OPENAI_MATH_META, parseOpenaiMath } from '../ingest/openai-math.js';
import type { Catalog } from '../ingest/types.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'source/openai-math');
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
  console.log(`commit=${commit}`);
  console.log(`wrote ${outPath}`);
}

await main();
