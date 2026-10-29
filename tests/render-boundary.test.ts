import { describe, expect, it } from 'vitest';
import { renderMath } from '../src/lib/katex.js';
import { entrySchema, evidenceSchema, sourceSchema } from '../src/lib/entry.js';

/** Entry text is inserted with set:html, so renderMath is the last escaping boundary. */
describe('renderMath escapes raw HTML outside math', () => {
  it('escapes an injected event handler instead of passing it through', () => {
    const hostile = '<img src=x onerror="alert(1)"> and <script>alert(2)</script>';
    const html = renderMath(hostile);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('keeps only the bare sup/sub/i/em tags ingest allows', () => {
    const html = renderMath('a<sup>2</sup> and <i>x</i> but <em class="evil">no</em>');
    expect(html).toContain('<sup>2</sup>');
    expect(html).toContain('<i>x</i>');
    expect(html).not.toContain('<em class=');
    expect(html).toContain('&lt;em class=&quot;evil&quot;&gt;');
  });

  it('escapes even when $ is unbalanced', () => {
    expect(renderMath('cost is $5 <b>bold</b>')).toContain('&lt;b&gt;');
  });

  it('escapes a math segment KaTeX cannot render', () => {
    const html = renderMath('x $<script>alert(1)</script>$ y');
    expect(html).not.toContain('<script>');
  });

  it('still renders real math', () => {
    expect(renderMath('the sum $x^2$ holds')).toContain('katex');
  });
});

describe('entry link validation', () => {
  it('rejects non-http(s) evidence links', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
      expect(evidenceSchema.safeParse({ kind: 'paper', url }).success).toBe(false);
    }
    expect(evidenceSchema.safeParse({ kind: 'paper', url: 'https://arxiv.org/abs/1234.5678' }).success).toBe(true);
  });

  it('rejects non-http(s) source links', () => {
    expect(sourceSchema.safeParse({ id: 1, cite: 'X', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(sourceSchema.safeParse({ id: 1, cite: 'X', url: 'https://example.com/paper' }).success).toBe(true);
  });

  it('entrySchema type is unaffected for ordinary entries', () => {
    expect(entrySchema).toBeDefined();
  });
});
