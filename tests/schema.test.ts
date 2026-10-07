import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { entrySchema, splitSentences } from '../src/lib/entry.js';
import catalog from '../src/data/catalog.json';
import entry017 from '../src/content/entries/017.json';

describe('017 gold standard (§10, Appendix A + collection extension)', () => {
  it('validates against the entry schema', () => {
    const res = entrySchema.safeParse(entry017);
    if (!res.success) console.error(JSON.stringify(res.error.issues, null, 2));
    expect(res.success).toBe(true);
  });

  it('carries collection/lab/science/field/aiRole/evidence', () => {
    expect(entry017.collection).toBe('openai-math-2026');
    expect(entry017.lab).toBe('openai');
    expect(entry017.science).toBe('mathematics');
    expect(entry017.field).toBe('Number theory');
    expect(['autonomous', 'ai-led', 'ai-assisted']).toContain(entry017.aiRole);
    expect(entry017.aiRole).toBe('autonomous');
    expect(Array.isArray(entry017.evidence)).toBe(true);
    expect(entry017.evidence.length).toBeGreaterThanOrEqual(1);
    for (const e of entry017.evidence as { kind: string; url: string }[]) {
      expect(['paper', 'lean', 'trace', 'other']).toContain(e.kind);
      expect(e.url).toMatch(/^https:\/\//);
    }
    const kinds = new Set((entry017.evidence as { kind: string }[]).map((e) => e.kind));
    expect(kinds.has('paper')).toBe(true);
    expect(kinds.has('trace')).toBe(true);
  });

  it('field matches scorecard.field and catalog subject', () => {
    const fam = (catalog.families as { id: string; subject: string }[]).find((f) => f.id === '017');
    expect(entry017.field).toBe(entry017.scorecard.field);
    expect(entry017.field).toBe(fam?.subject);
  });

  it('pins source version', () => {
    expect(entry017.sourceCommit).toBe(catalog.source.commit);
    expect(entry017.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('meets §7/§8 shape rules', () => {
    expect(entry017.headline.length).toBeLessThanOrEqual(120);
    expect(entry017.doesNot.startsWith('This does not')).toBe(true);
    const plain = splitSentences(entry017.plain);
    expect(plain.length).toBeGreaterThanOrEqual(3);
    expect(plain.length).toBeLessThanOrEqual(5);
    expect(entry017.glossary.length).toBeGreaterThanOrEqual(3);
    expect(entry017.glossary.length).toBeLessThanOrEqual(8);
    expect(entry017.sections.map((s: { title: string }) => s.title)).toEqual([
      'The story',
      'Why it matters',
      'Where it leads',
      'What it says about AI',
    ]);
    const ids = new Set(entry017.sources.map((s: { id: number }) => s.id));
    for (const p of entry017.visual.points as { source: number }[]) {
      expect(ids.has(p.source)).toBe(true);
    }
  });
});

describe('schema rejects bad entries (§10, §18)', () => {
  const base = entry017 as Record<string, unknown>;

  it('rejects missing scope', () => {
    const { scope: _omit, ...rest } = base;
    expect(entrySchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing collection/lab/science/field/aiRole/evidence', () => {
    for (const key of ['collection', 'lab', 'science', 'field', 'aiRole', 'evidence']) {
      const copy = { ...base };
      delete copy[key];
      expect(entrySchema.safeParse(copy).success).toBe(false);
    }
  });

  it('rejects invalid aiRole and empty evidence', () => {
    expect(entrySchema.safeParse({ ...base, aiRole: 'human-only' }).success).toBe(false);
    expect(entrySchema.safeParse({ ...base, evidence: [] }).success).toBe(false);
    expect(
      entrySchema.safeParse({ ...base, evidence: [{ kind: 'paper', url: 'not-a-url' }] }).success,
    ).toBe(false);
  });

  it('rejects field != scorecard.field', () => {
    const copy = JSON.parse(JSON.stringify(base));
    copy.field = 'Topology';
    expect(entrySchema.safeParse(copy).success).toBe(false);
  });

  it('rejects firstStep without sources', () => {
    const copy = JSON.parse(JSON.stringify(base));
    copy.sources = [];
    expect(entrySchema.safeParse(copy).success).toBe(false);
  });

  it('rejects hype words', () => {
    const copy = JSON.parse(JSON.stringify(base));
    copy.headline = 'A revolutionary breakthrough in pi theory';
    expect(entrySchema.safeParse(copy).success).toBe(false);
  });

  it('rejects reviewed without reviewer', () => {
    const copy = JSON.parse(JSON.stringify(base));
    copy.status = 'reviewed';
    expect(entrySchema.safeParse(copy).success).toBe(false);
  });
});

describe('exported JSON schema', () => {
  it('exists and requires the collection fields', () => {
    const raw = readFileSync('schema/entry.schema.json', 'utf-8');
    const schema = JSON.parse(raw);
    for (const key of ['collection', 'lab', 'science', 'field', 'aiRole', 'evidence']) {
      expect(schema.required).toContain(key);
      expect(schema.properties[key]).toBeDefined();
    }
    expect(schema.properties.aiRole.enum).toEqual(['autonomous', 'ai-led', 'ai-assisted']);
  });
});
