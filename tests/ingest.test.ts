import { describe, expect, it } from 'vitest';
import catalog from '../src/data/catalog.json';
import {
  cleanInlineHtml,
  extractLeanDoc,
  detectLean,
  mapTrust,
  parseDateFromDir,
  parseDocComparatorLinks,
  parseSupportOnly,
  parseWithdrawalReadme,
} from '../ingest/openai-math.js';
import type { Family } from '../ingest/types.js';

// Ingest counts at openai/math fd4aeeb (Oct 8, 2026 update): 372 / 719 / 172 / 17 and 242 / 0 / 130.
// Trust was 135 / 107 / 130 before Lean docs + Comparator challenges counted as formal (all 107 'partial'
// families have a Lean doc linking a main-result Comparator challenge).
// The Oct 7 withdrawals removed 3 papers (722 → 719); they live on in family 032's `withdrawn` list.
describe('catalog counts (§9, §18)', () => {
  it('has 372 families', () => {
    expect(catalog.families).toHaveLength(372);
  });

  it('has 719 papers', () => {
    const n = catalog.families.reduce((acc: number, f: { papers: unknown[] }) => acc + f.papers.length, 0);
    expect(n).toBe(719);
  });

  it('has 172 Lean-listed papers', () => {
    const n = catalog.families
      .flatMap((f: { papers: { lean: boolean }[] }) => f.papers)
      .filter((p) => p.lean).length;
    expect(n).toBe(172);
  });

  it('has 17 subjects', () => {
    expect(catalog.subjects).toHaveLength(17);
  });

  it('trust split is 242 / 0 / 130', () => {
    const count = (t: string) => catalog.families.filter((f: { trust: string }) => f.trust === t).length;
    expect(count('formal')).toBe(242);
    expect(count('partial')).toBe(0);
    expect(count('claimed')).toBe(130);
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
      leanDocUrl: string | null;
      comparator: { file: string; url: string; support: boolean }[];
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
      expect(f.trust).toBe(mapTrust(f.lean, f.leanDoc, f.comparator.filter((c) => !c.support).length));
      if (f.leanDoc) expect(f.leanDoc).toMatch(/^lean\/docs\/\d{3}\.md$/);
      expect(f.leanDocUrl).toBe(f.leanDoc ? `https://github.com/openai/math/blob/main/${f.leanDoc}` : null);
      if (!f.leanDoc) expect(f.comparator).toEqual([]);
      for (const c of f.comparator) {
        expect(c.file).toMatch(/^lean\/ComparatorChallenges\/[A-Za-z0-9_]+\.json$/);
        expect(c.url).toBe(`https://github.com/openai/math/blob/main/${c.file}`);
      }
    }
  });

  it('017 is Number theory + formal (Lean doc + Comparator) with trace', () => {
    const f = (catalog.families as { id: string; subject: string; trust: string; trace?: string }[]).find(
      (x) => x.id === '017',
    );
    expect(f?.subject).toBe('Number theory');
    expect(f?.trust).toBe('formal');
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

  it('trust rule: yaml listing OR Lean doc + a main-result Comparator challenge', () => {
    expect(mapTrust(0, 'lean/docs/007.md', 1)).toBe('formal');
    expect(mapTrust(0, 'lean/docs/007.md', 0)).toBe('partial');
    // A Comparator challenge without a Lean doc is not enough on its own.
    expect(mapTrust(0, null, 2)).toBe('claimed');
    expect(mapTrust(1, null, 0)).toBe('formal');
  });

  it('007 is formal from its Lean doc + Comparator challenges (not yaml-listed)', () => {
    const f = (catalog.families as unknown as Family[]).find((x) => x.id === '007')!;
    expect(f.lean).toBe(0);
    expect(f.trust).toBe('formal');
    expect(f.leanDocUrl).toBe('https://github.com/openai/math/blob/main/lean/docs/007.md');
    expect(f.comparator.map((c) => c.file)).toContain('lean/ComparatorChallenges/OrdinaryTwoPointCorrelations.json');
    expect(f.comparator.find((c) => c.file.endsWith('OrdinaryTwoPointCorrelations.json'))?.theorems).toEqual([
      'OAI.OrdinaryTwoPointCorrelations.liouville_log_saving',
      'OAI.OrdinaryTwoPointCorrelations.binary_corrected_elliott',
      'OAI.OrdinaryTwoPointCorrelations.affine_corrected_elliott',
    ]);
  });

  it('102 records all five Comparator challenges its Lean doc links', () => {
    const f = (catalog.families as unknown as Family[]).find((x) => x.id === '102')!;
    expect(f.comparator).toHaveLength(5);
    expect(f.comparator.every((c) => !c.support)).toBe(true);
  });

  it('parses Comparator links from a Lean doc, deduped, in order', () => {
    const md = [
      '| Result | Comparator statement |',
      '| A | [A.lean](../ComparatorChallenges/A.lean) |',
      '| B | [B.json](../ComparatorChallenges/B.json) |',
      '| A again | [A.lean](../ComparatorChallenges/A.lean) |',
      'See [the paper](../../preprints/X/paper.pdf).',
    ].join('\n');
    expect(parseDocComparatorLinks(md)).toEqual(['A', 'B']);
    expect(parseDocComparatorLinks('no links')).toEqual([]);
  });

  it('reads supporting-result-only setups from the Comparator README', () => {
    const md = [
      '# Comparator challenges',
      '## Supporting-result comparisons',
      '- `FooSupport.json`: compatibility of x.',
      '- `BarSupport.json`: compactness.',
      '',
      'See the scope notes.',
      '## Other',
      '- `NotThis.json`: no.',
    ].join('\n');
    expect([...parseSupportOnly(md)]).toEqual(['FooSupport', 'BarSupport']);
    expect(parseSupportOnly('# none').size).toBe(0);
  });

  it('detectLean skips linked challenges with no JSON file and flags support-only ones', async () => {
    const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = await mkdtemp(join(tmpdir(), 'cf-lean-'));
    await mkdir(join(dir, 'lean/docs'), { recursive: true });
    await mkdir(join(dir, 'lean/ComparatorChallenges'), { recursive: true });
    await writeFile(
      join(dir, 'lean/docs/001.md'),
      '[Main](../ComparatorChallenges/Main.lean) [Sup](../ComparatorChallenges/SupSupport.lean) [Gone](../ComparatorChallenges/Gone.lean)',
    );
    await writeFile(join(dir, 'lean/ComparatorChallenges/Main.json'), JSON.stringify({ theorem_names: ['OAI.main'] }));
    await writeFile(join(dir, 'lean/ComparatorChallenges/SupSupport.json'), JSON.stringify({ theorem_names: [] }));
    const refs = await detectLean(dir, 'lean/docs/001.md', new Set(['SupSupport']));
    expect(refs.map((r) => [r.file, r.support, r.theorems])).toEqual([
      ['lean/ComparatorChallenges/Main.json', false, ['OAI.main']],
      ['lean/ComparatorChallenges/SupSupport.json', true, []],
    ]);
    expect(await detectLean(dir, null, new Set())).toEqual([]);
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

describe('withdrawals', () => {
  it('keeps the 3 Oct 2026 withdrawals on family 032, outside the paper counts', () => {
    const f = (catalog.families as Array<{ id: string; papers: { title: string }[]; withdrawn?: { title: string; withdrawnOn: string | null; archivedPdf: string | null }[] }>).find((x) => x.id === '032');
    expect(f?.withdrawn).toHaveLength(3);
    for (const w of f!.withdrawn!) {
      expect(w.withdrawnOn).toBe('2026-10-06');
      expect(w.archivedPdf).toMatch(/^https:\/\/github\.com\/openai\/math\/blob\/[0-9a-f]{40}\//);
      expect(f!.papers.some((p) => p.title === w.title)).toBe(false);
    }
  });

  it('parses a lab withdrawal notice README', () => {
    const md = [
      '# [Withdrawal notice: A title](paper.pdf)',
      '',
      'OpenAI  ',
      '**Withdrawn on October 6, 2026.**',
      '',
      'A gap in [another paper](https://x) breaks the proof.',
      '',
      'This withdrawal concerns the proof; it does not assert that the mathematical statement is false.',
      '',
      '## Archived manuscript',
      '',
      '[Pre-withdrawal PDF](https://github.com/openai/math/blob/abc/preprints/A/paper.pdf)  ',
    ].join('\n');
    const w = parseWithdrawalReadme('A-title-October-1-2026', md);
    expect(w?.title).toBe('A title');
    expect(w?.withdrawnOn).toBe('2026-10-06');
    expect(w?.reason).toBe('A gap in another paper breaks the proof. This withdrawal concerns the proof; it does not assert that the mathematical statement is false.');
    expect(w?.archivedPdf).toBe('https://github.com/openai/math/blob/abc/preprints/A/paper.pdf');
    expect(parseWithdrawalReadme('x', '# [Normal paper](p.pdf)')).toBeNull();
  });
});
