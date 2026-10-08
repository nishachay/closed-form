/**
 * Significance calibration (§6.3, §11.5).
 *
 * One pass over every scorecard: compares the current significance spread to
 * the target (Landmark 5% / Major 20% / Solid 45% / Niche 30%) and prints a
 * diff. Entry files change only with --apply.
 *
 * Refuses to apply below 10 entries: with fewer entries the percentage
 * targets cannot rank anything sensibly (a single entry would rewrite the
 * hand-written 017 gold standard to Solid).
 *
 * Usage: pnpm calibrate [--apply]
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entriesDir = join(root, 'src/content/entries');

export const LEVELS = ['Landmark', 'Major', 'Solid', 'Niche'] as const;
export type Level = (typeof LEVELS)[number];

/** Target share per §6.3. */
export const TARGET_SHARE: Record<Level, number> = {
  Landmark: 0.05,
  Major: 0.2,
  Solid: 0.45,
  Niche: 0.3,
};

export interface CalibrateMove {
  id: string;
  from: Level;
  to: Level;
}

export interface CalibratePlan {
  total: number;
  current: Record<Level, number>;
  target: Record<Level, number>;
  moves: CalibrateMove[];
  applied: boolean;
  note?: string;
}

const isLevel = (s: unknown): s is Level => (LEVELS as readonly string[]).includes(String(s));

/**
 * Largest-remainder apportionment of `total` across the target shares,
 * then deterministic moves: entries keep their relative order, the top
 * slice becomes Landmark, then Major, Solid, the rest Niche. Rank order is
 * the current level first (Landmark first), then id — a stable, documented
 * proxy until reviewer scores exist.
 */
export function calibratePlan(
  entries: { id: string; significance: string }[],
): Omit<CalibratePlan, 'applied'> {
  const total = entries.length;
  const current = { Landmark: 0, Major: 0, Solid: 0, Niche: 0 } as Record<Level, number>;
  for (const e of entries) {
    if (isLevel(e.significance)) current[e.significance] += 1;
  }
  if (total === 0) {
    return { total, current, target: { ...current }, moves: [], note: 'no entries to calibrate' };
  }

  const quotas = LEVELS.map((l) => TARGET_SHARE[l] * total);
  const base = quotas.map(Math.floor);
  let rest = total - base.reduce((a, b) => a + b, 0);
  const remainders = quotas
    .map((q, i) => ({ i, r: q - Math.floor(q) }))
    .sort((a, b) => b.r - a.r || a.i - b.i);
  const target = { Landmark: 0, Major: 0, Solid: 0, Niche: 0 } as Record<Level, number>;
  LEVELS.forEach((l, i) => {
    target[l] = base[i];
  });
  for (let k = 0; k < rest; k++) {
    target[LEVELS[remainders[k % remainders.length].i]] += 1;
  }

  const rank: Record<string, number> = { Landmark: 0, Major: 1, Solid: 2, Niche: 3 };
  const ordered = [...entries].sort(
    (a, b) => (rank[a.significance] ?? 9) - (rank[b.significance] ?? 9) || a.id.localeCompare(b.id),
  );
  const want: Level[] = [];
  for (const l of LEVELS) {
    for (let k = 0; k < target[l]; k++) want.push(l);
  }
  const moves: CalibrateMove[] = [];
  ordered.forEach((e, i) => {
    if (isLevel(e.significance) && e.significance !== want[i]) {
      moves.push({ id: e.id, from: e.significance, to: want[i] });
    }
  });
  return { total, current, target, moves };
}

export function formatPlan(p: CalibratePlan): string {
  const lines = [
    `calibrate: ${p.total} entries`,
    `current: ${LEVELS.map((l) => `${l}=${p.current[l]}`).join(' ')}`,
    `target:  ${LEVELS.map((l) => `${l}=${p.target[l]}`).join(' ')}`,
  ];
  for (const m of p.moves) lines.push(`  ${m.id}: ${m.from} -> ${m.to}`);
  if (p.moves.length === 0) lines.push('  no changes');
  if (p.note) lines.push(`note: ${p.note}`);
  lines.push(p.applied ? 'applied' : 'dry run (use --apply to write)');
  return lines.join('\n');
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const files = (await readdir(entriesDir)).filter((f) => f.endsWith('.json'));
  const rows: { id: string; significance: string; file: string }[] = [];
  for (const file of files) {
    const raw = JSON.parse(await readFile(join(entriesDir, file), 'utf-8')) as {
      id?: string;
      scorecard?: { significance?: string };
    };
    rows.push({
      id: String(raw.id ?? file),
      significance: String(raw.scorecard?.significance ?? 'Niche'),
      file,
    });
  }

  const plan = calibratePlan(rows);
  let applied = false;
  let note: string | undefined;
  if (apply) {
    if (rows.length < 10) {
      note = `too few entries (${rows.length}) for a meaningful spread; nothing applied`;
    } else {
      for (const m of plan.moves) {
        const row = rows.find((r) => r.id === m.id);
        if (!row) continue;
        const raw = JSON.parse(await readFile(join(entriesDir, row.file), 'utf-8')) as {
          scorecard: { significance: string };
        };
        raw.scorecard.significance = m.to;
        await writeFile(join(entriesDir, row.file), JSON.stringify(raw, null, 2) + '\n', 'utf-8');
      }
      applied = plan.moves.length > 0;
    }
  }
  console.log(formatPlan({ ...plan, applied, note }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
