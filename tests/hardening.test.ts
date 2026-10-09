/**
 * Pipeline hardening: Lean facts from repo files, checker rubric, source/quote lints,
 * separate checker endpoint, retry/backoff and quota stop.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import catalog from '../src/data/catalog.json';
import type { Family } from '../ingest/types.js';
import {
  CHECKER_RUBRIC,
  LEAN_RULE,
  MAX_TRIES,
  QuotaExhaustedError,
  applyLeanEvidence,
  buildCheckerUser,
  buildReaderUser,
  chatBody,
  chatComplete,
  endpointFor,
  isDailyQuota,
  leanEvidence,
  leanFacts,
  leanFactsText,
  loadConfig,
  retryDelayMs,
  type Gathered,
} from '../scripts/explain.js';
import {
  hasErrors,
  hasNoUrlMarker,
  lintClaimQuotes,
  lintSources,
  quoteFound,
  texSkeleton,
} from '../scripts/lint-ste.js';

const fams = (catalog as unknown as { families: Family[] }).families;
const fam = (id: string) => fams.find((f) => f.id === id) as Family;

const baseEnv = { LLM_API_KEY: 'reader-key', READER_MODEL: 'gemini-2.5-flash', CHECK_MODEL: 'some/model:free' };

describe('checker endpoint fallback', () => {
  it('falls back to LLM_BASE_URL / LLM_API_KEY when CHECK_* are unset', () => {
    const cfg = loadConfig({ ...baseEnv, LLM_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai/' });
    expect(endpointFor(cfg, 'checker')).toEqual({
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: 'reader-key',
    });
    expect(endpointFor(cfg, 'reader')).toEqual(endpointFor(cfg, 'checker'));
  });

  it('treats empty CHECK_* (missing GitHub secrets) as unset', () => {
    const cfg = loadConfig({ ...baseEnv, CHECK_BASE_URL: '', CHECK_API_KEY: '' });
    expect(cfg.checker).toEqual({ baseUrl: 'https://api.openai.com/v1', apiKey: 'reader-key' });
  });

  it('uses CHECK_BASE_URL / CHECK_API_KEY when set, independently', () => {
    const both = loadConfig({
      ...baseEnv,
      LLM_BASE_URL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      CHECK_BASE_URL: 'https://openrouter.ai/api/v1',
      CHECK_API_KEY: 'or-key',
    });
    expect(endpointFor(both, 'checker')).toEqual({ baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'or-key' });
    expect(endpointFor(both, 'reader')).toEqual({
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      apiKey: 'reader-key',
    });
    const keyOnly = loadConfig({ ...baseEnv, CHECK_API_KEY: 'k2' });
    expect(keyOnly.checker).toEqual({ baseUrl: 'https://api.openai.com/v1', apiKey: 'k2' });
  });
});

describe('chat client (free tiers)', () => {
  it('sends only model, messages and response_format', () => {
    const body = chatBody('m', [{ role: 'user', content: 'x' }], true);
    expect(Object.keys(body).sort()).toEqual(['messages', 'model', 'response_format']);
    expect(Object.keys(chatBody('m', [], false)).sort()).toEqual(['messages', 'model']);
  });

  it('honours Retry-After seconds / HTTP date / Gemini retryDelay, else backs off exponentially', () => {
    expect(retryDelayMs(0, '7')).toBe(7000);
    expect(retryDelayMs(0, new Date(10_000).toUTCString(), '', 4_000)).toBe(6000);
    expect(retryDelayMs(0, null, '{"retryDelay": "37s"}')).toBe(37_000);
    expect(retryDelayMs(0, null)).toBe(2000);
    expect(retryDelayMs(3, null)).toBe(16_000);
    expect(retryDelayMs(10, null)).toBe(120_000);
  });

  it('detects daily quota wording from Gemini and OpenRouter', () => {
    expect(isDailyQuota('Quota exceeded for metric: generate_content_free_tier_requests, limit: 250, GenerateRequestsPerDayPerProjectPerModel')).toBe(true);
    expect(isDailyQuota('{"error":{"message":"Rate limit exceeded: free-models-per-day."}}')).toBe(true);
    expect(isDailyQuota('Rate limit exceeded: 20 requests per minute')).toBe(false);
  });

  const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });

  it('retries 429/503 with the Retry-After delay, then succeeds; trims the trailing slash', async () => {
    const urls: string[] = [];
    const waits: number[] = [];
    const replies = [
      json(429, 'slow down', { 'retry-after': '3' }),
      json(503, 'overloaded'),
      json(200, { choices: [{ message: { content: '{"ok":true}' } }] }),
    ];
    const out = await chatComplete(
      { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/', apiKey: 'k' },
      'gemini-2.5-flash',
      [{ role: 'user', content: 'hi' }],
      true,
      {
        fetchImpl: (async (u: string) => {
          urls.push(u);
          return replies.shift()!;
        }) as unknown as typeof fetch,
        sleep: async (ms) => {
          waits.push(ms);
        },
      },
    );
    expect(out).toBe('{"ok":true}');
    expect(urls[0]).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(waits).toEqual([3000, 4000]);
  });

  it('stops at once on a daily quota error (no retries)', async () => {
    let calls = 0;
    await expect(
      chatComplete({ baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'k' }, 'x:free', [], true, {
        fetchImpl: (async () => {
          calls++;
          return json(429, 'Rate limit exceeded: free-models-per-day');
        }) as unknown as typeof fetch,
        sleep: async () => {},
      }),
    ).rejects.toBeInstanceOf(QuotaExhaustedError);
    expect(calls).toBe(1);
  });

  it(`gives up after ${MAX_TRIES} tries; a persistent 429 is a quota stop`, async () => {
    let calls = 0;
    await expect(
      chatComplete({ baseUrl: 'https://x', apiKey: 'k' }, 'm', [], true, {
        fetchImpl: (async () => {
          calls++;
          return json(429, 'too many requests');
        }) as unknown as typeof fetch,
        sleep: async () => {},
      }),
    ).rejects.toBeInstanceOf(QuotaExhaustedError);
    expect(calls).toBe(MAX_TRIES);
  });

  it('reads a streamed reply and drops reasoning deltas; adds stream/max_tokens only when asked', async () => {
    expect(chatBody('m', [], true, { LLM_STREAM: '1', LLM_MAX_TOKENS: '32768' })).toMatchObject({ stream: true, max_tokens: 32768 });
    const sse =
      'data: {"choices":[{"delta":{"reasoning_content":"thinking"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"{\\"ok\\":"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":"true}"},"finish_reason":"stop"}]}\n\n' +
      'data: [DONE]\n\n';
    const out = await chatComplete({ baseUrl: 'https://x', apiKey: 'k' }, 'm', [], true, {
      fetchImpl: (async () => new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })) as unknown as typeof fetch,
      sleep: async () => {},
    });
    expect(out).toBe('{"ok":true}');
  });

  it('fails clearly when the reply was cut off at the token limit', async () => {
    await expect(
      chatComplete({ baseUrl: 'https://x', apiKey: 'k' }, 'm', [], true, {
        fetchImpl: (async () => json(200, { choices: [{ message: { content: '{"id":"003",' }, finish_reason: 'length' }] })) as unknown as typeof fetch,
        sleep: async () => {},
      }),
    ).rejects.toThrow(/token limit/);
  });

  it('does not retry other 4xx errors', async () => {
    let calls = 0;
    await expect(
      chatComplete({ baseUrl: 'https://x', apiKey: 'k' }, 'm', [], true, {
        fetchImpl: (async () => {
          calls++;
          return json(400, 'Invalid JSON payload received. Unknown name "seed"');
        }) as unknown as typeof fetch,
        sleep: async () => {},
      }),
    ).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });
});

describe('Lean facts are fixed input, evidence is deterministic', () => {
  it('007: facts name the doc and both Comparator challenges', () => {
    const f = leanFacts(fam('007'));
    expect(f.trust).toBe('formal');
    expect(f.yamlListedPapers).toBe(0);
    expect(f.leanDocUrl).toBe('https://github.com/openai/math/blob/main/lean/docs/007.md');
    const text = leanFactsText(f);
    expect(text).toContain('OrdinaryTwoPointCorrelations.json');
    expect(text).toContain('OAI.OrdinaryTwoPointCorrelations.liouville_log_saving');
  });

  it('a family with no Lean doc gets no lean evidence', () => {
    const claimed = fams.find((f) => f.trust === 'claimed' && !f.leanDoc)!;
    expect(leanEvidence(claimed)).toEqual([]);
    expect(leanFactsText(leanFacts(claimed))).toContain('Lean scope doc: none');
  });

  it('overwrites whatever lean evidence the model wrote, keeping other items', () => {
    const f = fam('102');
    const modelEvidence = [
      { kind: 'paper', url: f.papers[0].pdf },
      { kind: 'lean', url: 'https://example.com/made-up', label: 'Lean proof of everything', note: 'All results formalized.' },
      { kind: 'trace', url: f.trace! },
    ];
    const out = applyLeanEvidence(modelEvidence, f);
    expect(out.slice(0, 2).map((e) => e.kind)).toEqual(['paper', 'trace']);
    const lean = out.filter((e) => e.kind === 'lean');
    expect(lean).toHaveLength(1 + 5);
    expect(lean.some((e) => e.url.includes('example.com'))).toBe(false);
    expect(lean[0]).toMatchObject({ url: 'https://github.com/openai/math/blob/main/lean/docs/102.md', label: 'Lean scope doc' });
    expect(applyLeanEvidence(modelEvidence, f)).toEqual(out);
  });

  it('reader and checker prompts carry the facts and the rule', () => {
    const f = fam('007');
    const g: Gathered = { id: '007', texFiles: [], texChars: 0, truncated: false, sourceText: 'TEX', sourceHash: 'h', evidence: [] };
    const reader = buildReaderUser(f, g, '{}', '{}', 'c');
    expect(reader).toContain('LEAN FACTS');
    expect(reader).toContain(LEAN_RULE);
    expect(reader).toContain('OrdinaryElliott.json');
    const checker = buildCheckerUser('{}', g, f);
    expect(checker).toContain('LEAN FACTS');
    expect(checker).toContain(LEAN_RULE);
  });

  it('checker rubric covers implication direction, prior work and definitions', () => {
    expect(CHECKER_RUBRIC).toMatch(/IMPLICATION DIRECTION/);
    expect(CHECKER_RUBRIC).toMatch(/stronger than/);
    expect(CHECKER_RUBRIC).toMatch(/PRIOR WORK[\s\S]*introduction/);
    expect(CHECKER_RUBRIC).toMatch(/DEFINITIONS[\s\S]*paper's/);
    expect(readFileSync('prompts/checker.md', 'utf-8')).toContain('CHECKER_RUBRIC');
  });
});

describe('source url lint', () => {
  it('fails a url-less source without a marker', () => {
    const issues = lintSources({ sources: [{ id: 1, cite: 'A. Author, A paper (1999)' }] });
    expect(issues).toHaveLength(1);
    expect(issues[0].kind).toBe('source-no-url');
    expect(hasErrors(issues)).toBe(true);
  });

  it('passes with a url, noUrl: true, or "(no online copy found)" in cite', () => {
    expect(
      lintSources({
        sources: [
          { id: 1, cite: 'x', url: 'https://doi.org/10.1/x' },
          { id: 2, cite: 'y', noUrl: true },
          { id: 3, cite: 'z, Notas (1992) (no online copy found)' },
        ],
      }),
    ).toEqual([]);
    expect(hasNoUrlMarker({ noUrl: 'yes' })).toBe(false);
    expect(lintSources({ sources: [{ id: 4, cite: 'w', url: '  ' }] })).toHaveLength(1);
  });
});

describe('claim quote lint', () => {
  const tex = String.raw`
Elliott extended the correlation problem to bounded multiplicative
functions \cite{Elliott92}. % a comment that is not paper text
For \textsc{Max-Cut}, Khot, Kindler, Mossel, and O'Donnell's reduction gives
NP-hardness at every fixed ratio in \((\alpha_{\mathrm{GW}},1)\). Tao and Ter\"av\"ainen
and Matom\"aki and Radziwi\l\l\ proved it~\cite[Theorem~1]{MR16}.
Theorem~\ref{thm:ugc} turns established conditional hardness results
into NP-hardness results.`;

  it('matches modulo whitespace, LaTeX markup, accents and citation keys', () => {
    const skel = texSkeleton(tex);
    expect(quoteFound('Elliott extended the correlation problem to bounded multiplicative functions [Elliott92].', skel)).toBe(true);
    expect(quoteFound('For Max-Cut, Khot, Kindler, Mossel, and O’Donnell’s reduction gives NP-hardness at every fixed ratio in …', skel)).toBe(true);
    expect(quoteFound('Tao and Teräväinen and Matomäki and Radziwiłł proved it [MR16, Theorem 1].', skel)).toBe(true);
    expect(quoteFound('Theorem … turns established conditional hardness results into NP-hardness results.', skel)).toBe(true);
  });

  it('fails a paraphrase, a reversed statement, or comment text', () => {
    const skel = texSkeleton(tex);
    expect(quoteFound('Elliott extended the problem to bounded multiplicative functions.', skel)).toBe(false);
    expect(quoteFound('NP-hardness results turn into established conditional hardness results.', skel)).toBe(false);
    expect(quoteFound('a comment that is not paper text', skel)).toBe(false);
    expect(quoteFound('…', skel)).toBe(false);
  });

  it('gap segments must appear in order', () => {
    const skel = texSkeleton(tex);
    expect(quoteFound('turns established … Elliott extended', skel)).toBe(false);
  });

  it('flags missing quotes as errors and skips when no paper text is available', () => {
    const entry = {
      claims: [
        { text: 'a', verdict: 'supported', sourceLine: 'Elliott extended the correlation problem' },
        { text: 'b', verdict: 'supported', sourceLine: 'Something the paper never says' },
        { text: 'c', verdict: 'external', sourceId: 1 },
      ],
    };
    const issues = lintClaimQuotes(entry, tex);
    expect(issues.map((i) => i.field)).toEqual(['claims[1]']);
    expect(issues[0].kind).toBe('claim-not-verbatim');
    expect(hasErrors(issues)).toBe(true);
    expect(lintClaimQuotes(entry, null)).toEqual([]);
  });

  it('every published entry passes the source url lint', async () => {
    const { readdirSync } = await import('node:fs');
    for (const f of readdirSync('src/content/entries').filter((x) => x.endsWith('.json'))) {
      const e = JSON.parse(readFileSync(`src/content/entries/${f}`, 'utf-8')) as Record<string, unknown>;
      expect(lintSources(e), f).toEqual([]);
    }
  });
});
