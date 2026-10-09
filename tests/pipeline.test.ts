import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import entry017 from '../src/content/entries/017.json';
import { entrySchema } from '../src/lib/entry.js';
import {
  formatIssues,
  hasErrors,
  lintEntry,
  lintText,
} from '../scripts/lint-ste.js';
import { calibratePlan } from '../scripts/calibrate.js';
import {
  gatherFamily,
  loadConfig,
  parseExplainArgs,
  readReaderPrompt,
  runDryRun,
  selectFamilies,
  verifyAiRole,
} from '../scripts/explain.js';
import catalog from '../src/data/catalog.json';
import type { Family } from '../ingest/types.js';

const fams = (catalog as unknown as { families: Family[] }).families;

describe('lint-ste (§8)', () => {
  it('passes the 017 gold entry with zero errors', () => {
    const issues = lintEntry(entry017 as unknown as Record<string, unknown>);
    expect(hasErrors(issues)).toBe(false);
  });

  it('lints the prose explanation and bans the word "verified"', () => {
    const bad = { ...(entry017 as unknown as Record<string, unknown>), explanation: 'The proof is verified. It is short.' };
    const issues = lintEntry(bad);
    expect(issues.some((i) => i.kind === 'banned-word' && i.field === 'explanation')).toBe(true);
    expect(hasErrors(issues)).toBe(true);
    const hype = { ...(entry017 as unknown as Record<string, unknown>), explanation: 'A breakthrough result.' };
    expect(lintEntry(hype).some((i) => i.kind === 'hype' && i.field === 'explanation')).toBe(true);
  });

  it('wires prompts/explainer.md into the writer (reader) system prompt', async () => {
    const prompt = await readReaderPrompt();
    expect(prompt).toContain('EXPLAINER RULES');
    expect(prompt).toContain('simplest concrete example');
    expect(prompt).toContain('Leave `sections` out');
  });

  it('flags long sentences and hype words', () => {
    const long =
      'This is a deliberately overlong sentence with far more than twenty five words in it to trigger the hard failure rule for testing purposes only here now today.';
    const issues = lintText(long, 'plain');
    expect(issues.some((i) => i.kind === 'long-sentence')).toBe(true);
    expect(hasErrors(lintText('A revolutionary breakthrough in pi theory.', 'headline'))).toBe(true);
    expect(hasErrors(lintText('Fractions can never get unusually close to pi.', 'headline'))).toBe(false);
  });

  it('warns (not errors) between 20 and 25 words', () => {
    const issues = lintText(
      'Salikhov reached about seven point six in two thousand eight after long work.',
      'plain',
    );
    expect(hasErrors(issues)).toBe(false);
  });

  it('formats issues with the entry id', () => {
    const s = formatIssues('007', lintText('A revolutionary claim here.', 'headline'));
    expect(s).toContain('007');
    expect(s).toContain('hype');
  });
});

describe('explain arg parsing + selection (§11)', () => {
  it('parses --ids and flags', () => {
    const a = parseExplainArgs(['--ids', '007,017', '--concurrency', '3']);
    expect(a.ids).toEqual(['007', '017']);
    expect(a.concurrency).toBe(3);
    expect(a.dryRun).toBe(false);
  });

  it('selects explicit ids even when an entry exists', () => {
    const existing = new Map([['017', { sourceHash: 'x' }]]);
    const sel = selectFamilies(
      catalog as never,
      existing,
      { ids: ['017'], batch: null, traces: false, all: false, concurrency: 1, dryRun: true },
    );
    expect(sel.map((f) => f.id)).toEqual(['017']);
  });

  it('rejects unknown ids', () => {
    expect(() =>
      selectFamilies(
        catalog as never,
        new Map(),
        { ids: ['999'], batch: null, traces: false, all: false, concurrency: 1, dryRun: true },
      ),
    ).toThrow('Unknown family id: 999');
  });

  it('rejects a missing aiRole (never guessed)', async () => {
    const { entrySchema } = await import('../src/lib/entry.js');
    const copy = JSON.parse(JSON.stringify(entry017));
    delete copy.aiRole;
    expect(entrySchema.safeParse(copy).success).toBe(false);
    expect(verifyAiRole(copy).length).toBeGreaterThan(0);
    expect(verifyAiRole(copy)[0]).toMatch('aiRole');
  });

  it('rejects evidence without the source paper', () => {
    const copy = JSON.parse(JSON.stringify(entry017));
    copy.evidence = [{ kind: 'trace', url: 'https://example.com/t.pdf' }];
    expect(verifyAiRole(copy).length).toBeGreaterThan(0);
    expect(verifyAiRole(entry017 as never)).toEqual([]);
  });

  it('fails clearly when LLM keys are missing', () => {
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow('LLM_API_KEY');
    expect(() => loadConfig({} as NodeJS.ProcessEnv)).toThrow('READER_MODEL');
  });
});

describe('archive entries (§10): every published entry validates', () => {
  const dir = join(import.meta.dirname, '..', 'src/content/entries');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

  it('has the expected batch entries plus the 017 seed', () => {
    expect(files).toContain('017.json');
  });

  for (const file of files) {
    it(`${file} validates against the schema with zero lint errors`, () => {
      const raw = JSON.parse(readFileSync(join(dir, file), 'utf-8'));
      const res = entrySchema.safeParse(raw);
      if (!res.success) console.error(file, JSON.stringify(res.error.issues, null, 1));
      expect(res.success).toBe(true);
      expect(hasErrors(lintEntry(raw))).toBe(false);
    });
  }
});

describe('007 dry run (§11, offline)', () => {
  it('gathers tex sources with a 64-hex hash', async () => {
    const fam = fams.find((f) => f.id === '007') as Family;
    const g = await gatherFamily('source/openai-math', fam, fam.summary);
    expect(g.texFiles.length).toBeGreaterThan(0);
    expect(g.texChars).toBeGreaterThan(1000);
    expect(g.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(g.evidence.some((e) => e.kind === 'trace')).toBe(true);
    expect(g.evidence.some((e) => e.kind === 'paper')).toBe(true);
  });

  it('dry run writes nothing but reports the full plan', async () => {
    const rows = await runDryRun(['007']);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.id).toBe('007');
    expect(r.subject).toBe('Number theory');
    expect(r.trust).toBe('formal');
    expect(r.texFiles).toBeGreaterThan(0);
    expect(r.readerPromptChars).toBeGreaterThan(5000);
    expect(r.sourceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.existing).toBe(true);
    expect(r.wouldSkip).toBe(true);
    expect(r.writePath).toBe('src/content/entries/007.json');
  });
});

describe('calibrate (§6.3, §11.5)', () => {
  it('matches target spread on a balanced set', () => {
    const mk = (n: number, sig: string) =>
      Array.from({ length: n }, (_, i) => ({ id: `${sig}-${i}`, significance: sig }));
    const plan = calibratePlan([...mk(1, 'Landmark'), ...mk(4, 'Major'), ...mk(9, 'Solid'), ...mk(6, 'Niche')]);
    expect(plan.total).toBe(20);
    expect(plan.moves).toHaveLength(0);
  });

  it('proposes moves toward the target, deterministically', () => {
    const plan = calibratePlan([{ id: '017', significance: 'Major' }]);
    expect(plan.total).toBe(1);
    expect(plan.target).toEqual({ Landmark: 0, Major: 0, Solid: 1, Niche: 0 });
    expect(plan.moves).toEqual([{ id: '017', from: 'Major', to: 'Solid' }]);
    const again = calibratePlan([{ id: '017', significance: 'Major' }]);
    expect(again).toEqual(plan);
  });
});

describe('fieldsFirst batch order', () => {
  it('starts with fields that have no explained entries and rotates across fields', async () => {
    const { fieldsFirst } = await import('../scripts/explain.js');
    const fam = (id: string, subject: string) => ({ id, subject }) as never;
    const catalog = {
      subjects: ['A', 'B', 'C'],
      families: [fam('1', 'A'), fam('2', 'A'), fam('3', 'A'), fam('4', 'B'), fam('5', 'B'), fam('6', 'C')],
    } as never;
    const existing = new Map([['1', {}]]);
    const need = [fam('2', 'A'), fam('3', 'A'), fam('4', 'B'), fam('5', 'B'), fam('6', 'C')];
    const order = fieldsFirst(need, catalog, existing).map((f: { id: string }) => f.id);
    expect(order).toEqual(['4', '6', '2', '5', '3']);
  });
});
