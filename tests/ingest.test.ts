import { describe, expect, it } from 'vitest';
import catalog from '../src/data/catalog.json';
import {
  cleanInlineHtml,
  extractLeanDoc,
  mapTrust,
  parseDateFromDir,
} from '../ingest/openai-math.js';

// §18: ingest counts 372 / 722 / 162 / 17 and 127 / 108 / 137.
describe('catalog counts (§9, §18)', () => {
  it('has 372 families', () => {
    expect(catalog.families).toHaveLength(372);
  });

  it('has 722 papers', () => {
    const n = catalog.families.reduce((acc: number, f: { papers: unknown[] }) => acc + f.papers.length, 0);
    expect(n).toBe(722);
  });

  it('has 162 Lean-listed papers', () => {
    const n = catalog.families
      .flatMap((f: { papers: { lean: boolean }[] }) => f.papers)
      .filter((p) => p.lean).length;
    expect(n).toBe(162);
  });

  it('has 17 subjects', () => {
    expect(catalog.subjects).toHaveLength(17);
  });

  it('trust split is 127 / 108 / 137', () => {
    const count = (t: string) => catalog.families.filter((f: { trust: string }) => f.trust === t).length;
    expect(count('formal')).toBe(127);
    expect(count('partial')).toBe(108);
    expect(count('claimed')).toBe(137);
  });

  it('carries collection identity + source version', () => {
    expect(catalog.collection).toBe('openai-math-2026');
    expect(catalog.lab).toBe('openai');
    expect(catalog.science).toBe('mathematics');
    expect(catalog.license).toBe('Apache-2.0');
    expect(catalog.source.repo).toBe('openai/math');
    expect(catalog.source.commit).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('catalog integrity (computed, never hard-coded)', () => {
  it('every family has a valid id, subject, papers and links', () => {
    const subjects = new Set(catalog.subjects);
    for (const f of catalog.families as {
      id: string;
      subject: string;
      papers: { pdf: string; date: string | null; lean: boolean }[];
      lean: number;
      trust: string;
      leanDoc: string | null;
    }[]) {
      expect(f.id).toMatch(/^\d{3}$/);
      expect(subjects.has(f.subject)).toBe(true);
      expect(f.papers.length).toBeGreaterThan(0);
      for (const p of f.papers) {
        expect(p.pdf.startsWith('https://github.com/openai/math/blob/main/preprints/')).toBe(true);
        if (p.date !== null) expect(p.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      const leanCount = f.papers.filter((p) => p.lean).length;
      expect(f.lean).toBe(leanCount);
      expect(f.trust).toBe(mapTrust(f.lean, f.leanDoc));
      if (f.leanDoc) expect(f.leanDoc).toMatch(/^lean\/docs\/\d{3}\.md$/);
    }
  });

  it('017 is Number theory + partial with trace', () => {
    const f = (catalog.families as { id: string; subject: string; trust: string; trace?: string }[]).find(
      (x) => x.id === '017',
    );
    expect(f?.subject).toBe('Number theory');
    expect(f?.trust).toBe('partial');
    expect(f?.trace).toContain('reasoning_traces/irrationality-exponent-of-pi.pdf');
  });
});

describe('adapter units', () => {
  it('parses folder date suffix', () => {
    expect(parseDateFromDir('Foo-September-24-2026')).toBe('2026-09-24');
    expect(parseDateFromDir('Foo-October-3-2026')).toBe('2026-10-03');
    expect(parseDateFromDir('Foo-September-17-2026')).toBe('2026-09-17');
    expect(parseDateFromDir('NoDate')).toBeNull();
    expect(parseDateFromDir('Foo-Foo-99-2026')).toBeNull();
  });

  it('maps trust per §6.1', () => {
    expect(mapTrust(1, null)).toBe('formal');
    expect(mapTrust(2, 'lean/docs/003.md')).toBe('formal');
    expect(mapTrust(0, 'lean/docs/017.md')).toBe('partial');
    expect(mapTrust(0, null)).toBe('claimed');
  });

  it('cleans LaTeX + keeps only allowed tags + unescapes', () => {
    expect(cleanInlineHtml('a $`x`$ b')).toBe('a $x$ b');
    expect(cleanInlineHtml('a <i>π</i> <b>bold</b> <sup>2</sup>')).toBe('a <i>π</i> bold <sup>2</sup>');
    expect(cleanInlineHtml('x &gt; 0 and <i>q</i>-power')).toBe('x > 0 and <i>q</i>-power');
    expect(cleanInlineHtml('<sub><i>p</i></sub> and <script>evil</script>')).toBe('<sub><i>p</i></sub> and evil');
  });

  it('strips trailing Lean link into leanDoc', () => {
    const { summary, leanDoc } = extractLeanDoc('Proves X. ([Lean](lean/docs/017.md))');
    expect(leanDoc).toBe('lean/docs/017.md');
    expect(summary).toBe('Proves X.');
    const plain = extractLeanDoc('Proves Y.');
    expect(plain.leanDoc).toBeNull();
  });
});
