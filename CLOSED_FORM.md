# Closed Form ∎ — Master Spec

> Every problem AI has solved, explained for everyone, with honest trust labels.

This is the one document you need to build, run and grow Closed Form. Give it to any coding agent (opencode, Claude Code, Cursor) or any person, and they have everything: the idea, the reasons, the product, the content rules, the data, the AI pipeline, the design, the tech stack, the tests and the plan.

When this file disagrees with an older file (`OPENCODE_PROMPT.md`, `DESIGN_UPDATE.txt`, `PIPELINE.md`), **this file wins**.

Version 1.0 · 7 October 2026 · Owner: Nishachay Shelke

---

## Table of contents

1. The idea in one page
2. Why now, and who else is doing it
3. The name and the brand
4. Principles (the rules we never break)
5. Audience and what each person needs
6. The trust model
7. What an explained entry contains
8. Writing rules
9. Data layer (no AI)
10. Entry schema
11. The AI pipeline
12. Prompts (reader and checker)
13. Information architecture and UX
14. Design system
15. Accessibility
16. Tech stack
17. Repository structure
18. Tests and acceptance criteria
19. Build phases (for the coding agent)
20. Launch and growth
21. Operations: corrections, versions, review
22. Risks and how we handle them
23. What success looks like
24. Non-goals
25. Open decisions
26. Appendix A: the 017 gold-standard entry
27. Appendix B: instructions for the coding agent

---

## 1. The idea in one page

On **6 October 2026**, OpenAI published `openai/math` on GitHub (Apache-2.0): **722 research manuscripts**, grouped into **372 result families** across **17 fields**, written by an unreleased internal model. **162** papers have a main result listed in the Lean formalization catalogue. OpenAI says unformalized results may contain errors and that none are peer-reviewed yet.

The papers are written for specialists. The public sees headlines ("AI solves hundreds of open problems") but cannot read the papers or judge the claims.

**Closed Form** is a calm public archive that turns each result into a page a curious adult can read in three minutes:

- **What it claims**, in one plain sentence
- **How sure we can be**, with an honest trust label
- **Where the question came from**, with a short sourced history
- **What changes if it is true**, and what it does *not* do
- **The original papers**, one click away

It starts with the OpenAI release (Volume 1). Later volumes can cover other AI math releases with the same format.

**The goal:** become the place people link to when they want to understand an AI math claim, the "museum label" for AI mathematics.

---

## 2. Why now, and who else is doing it

### Timing
The release is one day old. Media coverage repeats the same numbers (722 / 372 / 162). The debate is about trust: what is checked and what is not. Nobody yet explains the individual results to non-experts. That gap will close in weeks, not months.

### Existing projects (checked 7 Oct 2026)

| Project | What it does | What it lacks |
|---|---|---|
| kisonecat.github.io/openai-math (Jim Fowler) | Subject index of all 722 papers, family counts, Lean counts per field, latest papers | No explanations, no trust story |
| ameskandari.github.io/ai4math ("The Machine Manuscripts") | Full catalogue with abstracts, Lean filter, a Verification page, one page per family | Index plus verification; no plain-language explanations |
| News and blogs (CellCog, Unite.AI, explainx, reposquare, Stanford Tech Review) | One article each: counts, a few highlighted claims, Lean gap analysis | One-off articles, not an archive |
| openai/math itself | Source of truth, overview PDF, Lean catalogue, 10 reasoning summaries | Written for mathematicians |

**Our difference:** not the index (others have it), not trust labels alone (others are adding them). It is the **plain-language explainer for each result, with sourced history and honest limits**. Everything in this spec protects that difference.

---

## 3. The name and the brand

### Decision: keep **Closed Form**

Why it works:
- In mathematics, a *closed form* is an exact, finite answer. The name says "the answer, stated plainly."
- It suggests a problem that is now *closed*, but it does not claim the result is true. The trust label does that job.
- It's short, sounds serious, and doesn't sound like AI slop.
- A nice coincidence: Doron Zeilberger, one of the mathematicians in our π story, wrote a paper titled *"Closed Form (Pun Intended!)"* (1993).
- No active product or site with this name came up in a search (one inactive Virginia LLC from 2022).

The risk, and what to do about it:
- "Closed form" is a common math term, so search results are full of definitions. **Always pair the name with a descriptor:** "Closed Form — AI mathematics, explained." Use that in `<title>`, OG images and the X bio.
- Check domains before launch (not checked yet): `closedform.org`, `closedform.xyz`, `closed-form.org`, `readclosedform.com`. GitHub Pages works first: `<user>.github.io/closed-form/`.

Backups if a domain or handle is taken: **Open Since** (focuses on problem age), **The Last Page**.

### Brand elements
- **Logo:** a solid vermilion square (∎, the "end of proof" mark) + "Closed Form" in Schibsted Grotesk 600.
- **Favicon:** the vermilion square.
- **Tagline:** "Every problem AI has solved, explained for everyone."
- **Footer line (always):** "Closed Form explains AI-made mathematics in plain words. Source papers from openai/math (Apache-2.0). Not affiliated with OpenAI."
- **Tone:** calm, exact, plain. Never OpenAI marketing, never an attack piece.

---

## 4. Principles (the rules we never break)

1. **Trust is the product.** The trust label is never hidden, softened or styled away.
2. **Never call a result true because a company published it.** Use "claims", "the paper proves (if correct)" and similar wording to match the trust level.
3. **Never invent history.** Every date, name and earlier record has a source, or it is deleted.
4. **One claim per entry.** The strongest main result, stated once.
5. **Plain first, precise always.** Simple words, but never wrong.
6. **The explainer is a translation, not a replacement.** The original papers are always one click away.
7. **Show progress honestly.** "1 of 372 explained" is fine. Never pad.
8. **Static, cheap, durable.** The site must still work in 10 years with no server.

---

## 5. Audience and what each person needs

| Who | Arrives from | Needs |
|---|---|---|
| Curious non-mathematician | X, news, a friend's link | The claim in one line, whether to believe it, why anyone cares |
| Tech and AI people | X, Hacker News | How much AI did, the trust status, compute and origin, share-worthy facts |
| Journalists | Search | Accurate wording to quote, trust status, sources, a clear "does not" |
| Mathematicians outside the subfield | Search, the map | A fast map, the scope of the claim, links to the PDFs and Lean files |
| Students | Search | Definitions and the history of the problem |

Design for the first person; never mislead the last.

---

## 6. The trust model

### 6.1 Formal status (computed from data, never written by AI)

| Key | Label (long) | Label (short) | Rule |
|---|---|---|---|
| `formal` | Formal proof listed | Formal proof | At least one paper in the family is in `lean/formalization.yaml` |
| `partial` | Partly formalized | Partly formal | No listed paper, but the family has a Lean doc (`lean/docs/NNN.md`) |
| `claimed` | Claimed, not checked | Not checked | Neither |

Counts on 7 Oct 2026: **127 formal · 108 partial · 137 claimed** (372 total).

**Important wording:** a listing in `formalization.yaml` is *not* proof that it compiles or that the Lean statement matches the paper. That's why the label says "Formal proof **listed**", not "verified". The About page explains this.

### 6.2 Review status (how far our explainer has been checked)

| Key | Shown as | Meaning |
|---|---|---|
| `sample` | "Sample entry, written by hand" | Hand-written seed (017) |
| `ai-draft` | "AI draft — not checked yet" | The reader model wrote it. Never published to main. |
| `ai-checked` | "Checked by AI against the paper — not yet reviewed by a person" | The checker model confirmed each claim |
| `reviewed` | "Reviewed by a person" (+ reviewer name, date) | A person read it against the source |

Any entry not marked `reviewed` shows a notice: **"This entry has not been reviewed by a person yet."**
An AI never sets `reviewed`. Only a merged PR with a named reviewer does.

### 6.3 Significance (our judgement, always with a reason)

`Landmark` · `Major` · `Solid` · `Niche`, plus a one-sentence `significanceWhy`. Target spread after calibration: about 5% / 20% / 45% / 30%. Significance always reads as **"if the proof holds."**

---

## 7. What an explained entry contains

The page order is fixed. Every item is required unless marked optional.

| # | Part | Field | Rule |
|---|---|---|---|
| 1 | **Headline** | `headline` | The claim in one plain sentence, ≤ 120 characters. State the result, not the method. |
| 2 | **Scope** | `scope` | One sentence on the main conditions ("Only for elliptic curves over the rationals."). Stops readers from treating the claim as absolute. |
| 3 | **Plain** | `plain` | 3–5 short sentences: the core of the result. |
| 4 | **Trust** | computed + `status` | Formal status label + review status notice. |
| 5 | **Scorecard** | `scorecard` | First step (year + who) · Field · Significance + why · Trust. |
| 6 | **Visual** *(optional)* | `visual` | A record chart when there is a sourced history of numeric bounds. The claim bar is in accent. |
| 7 | **The story** | `sections[0]` | First question → earlier progress → why it was stuck → this claim. Narrative, not technical. |
| 8 | **Why it matters** | `sections[1]` + `doesNot` | One or two concrete consequences + one explicit "This does not …" sentence. |
| 9 | **Where it leads** | `sections[2]` | Modest. Only next steps the paper mentions or that are well known. |
| 10 | **What it says about AI** | `sections[3]` + `origin` | What the model did, whether Lean exists, whether specialists have reviewed it. Plus the fixed origin sentence. |
| 11 | **Hype check** | `hypeCheck` | One sober paragraph on the remaining doubt. Always more cautious than the rest of the page. |
| 12 | **Words used** | `glossary` | 3–8 terms, each with a one-sentence plain definition. |
| 13 | **Sources** | `sources` | A citation for every historical fact. |
| 14 | **The original** | from catalog | Each paper's PDF + date + Lean badge, Lean notes, reasoning summary if any. |

**Scope vs hype check:** these are different things. *Scope* = what the theorem covers. *Hype check* = whether the proof holds. Keep scope at the top and the hype check at the bottom.

**Definitions twice:** a short definition in brackets the first time a term appears ("irrationality exponent (a score for how well fractions can approximate a number)"), *and* in the glossary.

**Origin sentence (fixed template; facts from OpenAI's announcement only):**
> "This result comes from an unreleased OpenAI model, published in the openai/math release on 6 October 2026."

Never state compute for a single result. OpenAI only published an average (about 3 hours of ChatGPT Pro thinking per result).

**Fallback page (no explainer yet):** a card headed "What the paper claims, in its own words" with the official summary, the trust label, "The plain-language explainer for this entry is still coming", and The original.

---

## 8. Writing rules

Based on ASD-STE100 (Simplified Technical English). If the user's STE100 skill is in `skills/ste100/`, it overrides this section where they differ.

**Always**
- Sentences of 20 words or fewer. One idea per sentence.
- Active voice. Present tense for what the paper claims; past tense for history.
- Common words. Use one term for one thing (don't switch between "bound" and "limit").
- Define every technical term at first use and in the glossary.
- Match the claim wording to the trust level:
  - `formal` → "The paper proves … and a Lean proof is listed."
  - `partial` / `claimed` → "The paper claims to prove …" or "If the proof is correct, …"
- Typographic punctuation: ’ “ ” … – —.
- Spell numbers as the source does. Keep the year on every date.

**Never**
- Invent dates, names, prior results, values or quotes.
- Hype words, with no exceptions: revolutionary, groundbreaking, game-changing, unprecedented, breakthrough, stunning, mind-blowing, historic, finally, solves forever.
- Proof sketches or long technical digressions.
- Treat the official abstract as plain language. It almost never is.
- Add future impact the paper doesn't support.
- More than one main claim.
- Phrases that judge the reader ("simply", "obviously", "of course").

**Self-check before output**
1. Could a smart 16-year-old understand the headline and the plain paragraph?
2. Does every date and name have a source?
3. Is every technical word in the glossary?
4. Is the hype check more cautious than the rest?
5. Is there a scope sentence and a "does not" sentence?

---

## 9. Data layer (no AI)

`scripts/ingest.ts` is deterministic and writes `src/data/catalog.json`. The source is `openai/math`, added as a read-only git submodule at `source/openai-math`.

| Data | Source | How |
|---|---|---|
| Families + papers | `CONTENTS.md` | A family cell starts `**NNN. Title.** summary`. Paper cells follow: `&emsp;[Paper title](preprints/<dir>/<file>.pdf)` + abstract. Convert `` $`...`$ `` → `$...$`. Keep only `<sup>/<sub>/<i>/<em>`. Unescape entities. Strip a trailing `([Lean](lean/docs/NNN.md))` into `leanDoc`. |
| Subjects | `overview.tex` | `\cataloguesection{Subject}{n}` applies to each following `\resultentry{NNN}`. 17 subjects, in order. |
| Lean status | `lean/formalization.yaml` | `sources[].id` = `../preprints/<dir>/<file>`. A paper is `lean: true` when its `<dir>` matches. |
| Paper date | Folder name suffix | e.g. `-September-24-2026` → `2026-09-24`. |
| Reasoning summaries | README table | Families 007, 017, 087, 102, 159, 197, 221, 271, 287, 362 → `reasoning_traces/<slug>.pdf`. |
| Trust | Derived | See 6.1. |
| Links | — | All to `https://github.com/openai/math/blob/main/...`. |
| Source version | git | Store the submodule commit SHA in `catalog.source.commit`. |

**Test assertions:** 372 families · 722 papers · 162 Lean-listed papers · 17 subjects · 127/108/137 by trust. If upstream changes, update the assertions and explain why in the PR.

```ts
type Paper  = { title: string; pdf: string; abstract: string; lean: boolean; date: string | null };
type Family = { id: string; title: string; summary: string; subject: string; papers: Paper[];
                lean: number; leanDoc: string | null; trace?: string;
                trust: 'formal' | 'partial' | 'claimed' };
type Catalog = { source: { repo: string; commit: string; fetchedAt: string };
                 license: string; subjects: string[]; families: Family[] };
```

---

## 10. Entry schema

Entries live in `src/content/entries/NNN.json` (an Astro content collection, validated with zod). The schema is also exported as `schema/entry.schema.json`.

```ts
{
  id: string,                          // /^\d{3}$/
  status: 'sample' | 'ai-draft' | 'ai-checked' | 'reviewed',
  reviewedBy?: string, reviewedAt?: string,          // required when status = reviewed
  headline: string,                    // ≤ 120 chars
  scope: string,                       // one sentence
  plain: string,                       // 3–5 sentences
  doesNot: string,                     // one sentence, starts "This does not"
  origin: string,                      // fixed template, see §7
  scorecard: {
    firstStep?: string,                // "1953"
    firstStepBy?: string,              // "Kurt Mahler, first proven limit"
    field: string,                     // must equal the family's subject
    significance: 'Landmark' | 'Major' | 'Solid' | 'Niche',
    significanceWhy: string
  },
  visual?: { type: 'record', title: string, note?: string, lowerIsBetter?: boolean,
             points: { year: number, value: number, who: string, claim?: boolean, source: number }[] },
  sections: [                          // exactly these 4 titles, in this order
    { title: 'The story', body: string },
    { title: 'Why it matters', body: string },
    { title: 'Where it leads', body: string },
    { title: 'What it says about AI', body: string }
  ],
  hypeCheck: string,
  glossary: { term: string, meaning: string }[],     // 3–8
  sources: { id: number, cite: string, url?: string, quote?: string }[],
  claims?: { text: string, verdict: 'supported' | 'external', sourceLine?: string, sourceId?: number }[],  // from the checker
  sourceHash: string,                  // sha256 of the family's source files
  sourceCommit: string,                // openai/math commit the entry was written against
  model?: { reader: string, checker: string, date: string }
}
```

Validation rules (beyond types): `firstStep` and `firstStepBy` need a matching `sources` entry · every `visual.points[].source` must exist · no hype words · sentence length ≤ 25 words (20 is the target, 25 is the hard fail) · `scorecard.field` equals the catalog subject.

---

## 11. The AI pipeline

```
ingest ──► gather ──► reader ──► checker ──► lint/validate ──► calibrate ──► PR ──► human review ──► publish
 (no AI)              (model A)  (model B,                       (one pass,
                                  fresh context)                  all entries)
```

**Provider-agnostic:** an OpenAI-compatible client with env vars `LLM_BASE_URL`, `LLM_API_KEY`, `READER_MODEL`, `CHECK_MODEL`. No keys in the repo; use GitHub Actions secrets.

```
pnpm explain --ids 007,017 | --batch 10 | --traces | --all  [--concurrency 20] [--dry-run]
pnpm calibrate [--apply]
```

1. **Gather:** every paper's `.tex` source from the submodule (fall back to the abstract), the family summary, the trust status, the reasoning summary if any. Compute `sourceHash`. Skip a family whose existing entry has the same hash.
2. **Reader (model A):** the system prompt is §12.1, plus the schema, the 017 entry as the few-shot example, and the writing rules (§8 or `skills/ste100/`). Read the abstract, introduction, main theorem and historical remarks; skip proof machinery. Output strict JSON.
3. **Checker (model B, fresh context):** gets the draft + the sources. Returns every factual claim as `supported` (with the quoted source line), `external` (needs an outside citation, which must be in `sources`) or `unsupported`. Delete or rewrite unsupported claims. Historical facts without a citation are removed. Sets status `ai-checked`.
4. **Lint and validate:** zod + the rules in §10. Retry up to 2 times with the errors fed back. Then log to `pipeline/failures.jsonl`.
5. **Calibrate:** one pass over every scorecard → re-ranked significance to the target spread. Prints a diff; changes only with `--apply`.
6. **PR:** the GitHub Action `explain.yml` (`workflow_dispatch`, inputs `ids` / `batch`) opens one PR per batch of 10 with `peter-evans/create-pull-request`, titled "Entries: 007, 017, …". The PR body lists each entry's unsupported-claim count and any warnings.
7. **Human review:** a reviewer reads each entry next to the paper, then sets `status: reviewed` + `reviewedBy` + `reviewedAt`. Merge publishes it.

**Order of work:**
1. The 10 reasoning-summary families (007, 017, 087, 102, 159, 197, 221, 271, 287, 362)
2. The famous claims: quasi-Riemann (003), free group factors, the Kaplansky zero-divisor counterexample, the Mahler conjectures, CM Hodge, Wall's D(2), Unique Games-type results (look up exact ids in the catalog)
3. One per field, the highest significance
4. The rest, in batches

**Concurrency and cost:** p-limit, exponential backoff on 429/5xx, and cost + tokens per family logged to `pipeline/runs.jsonl`. Do a `--dry-run` before any real batch.

---

## 12. Prompts

### 12.1 Reader (system prompt)

```
You write entries for Closed Form, a public archive that explains AI-made mathematics
to smart adults who never studied the subject. Voice: a calm, exact museum label.

You receive: the family's official summary, its trust status, the LaTeX source of its
papers, and (sometimes) a reasoning summary.

Do this:
1. Find the single strongest claim. Write it as the headline in ≤120 characters.
2. Write one scope sentence: the main conditions the result needs.
3. Write 3–5 plain sentences on the core result.
4. Build the history ONLY from references the paper itself makes (prior results, years,
   authors), or from standard references you can cite exactly. Put each in `sources`.
   If you cannot cite it, leave it out. Never guess a year or a name.
5. Write the four sections in this order: The story; Why it matters; Where it leads;
   What it says about AI.
6. Write one "This does not …" sentence.
7. Write the hype check. It must be more cautious than everything else.
8. List every technical term you used in the glossary, each with one plain sentence.
   Also define each term in brackets the first time you use it.
9. Match the claim wording to the trust status:
   formal → "proves … (Lean proof listed)"; partial/claimed → "claims to prove …".

Rules: sentences ≤20 words; one idea per sentence; active voice; common words; no hype
words; no proof sketches; the official abstract is NOT plain language; never add impact
the paper does not support.

Output ONLY JSON that matches the schema. Example of the target quality: <017.json>
```

### 12.2 Checker (system prompt)

```
You are a strict fact-checker for Closed Form. You receive a draft entry and the source
LaTeX. You did not write the draft.

For EVERY factual statement in the draft (numbers, years, names, what is proved, scope,
consequences), return:
  { text, verdict: "supported" | "external" | "unsupported", sourceLine?, sourceId? }
- supported: quote the exact source line.
- external: true only if it is cited in the draft's `sources`; check that the citation
  plausibly contains it.
- unsupported: anything else.

Then return a corrected entry: remove or rewrite every unsupported statement. Do not add
new facts. If firstStep/firstStepBy are unsupported, delete them. Check that the claim
wording matches the trust status. Check that the hype check does not overstate.
Set status to "ai-checked". Output JSON: { claims: [...], entry: {...} }.
```

---

## 13. Information architecture and UX

### Routes (all static)

| Route | Purpose |
|---|---|
| `/` | Home: hero, stats, the map, explained-so-far |
| `/archive/` | All 372 results: search, filters, grouped list |
| `/entry/NNN/` | One page per family (explained or fallback) — 372 pages |
| `/field/<slug>/` | One page per field (17) — a filtered archive with an intro line |
| `/about/` | Method, trust labels, how entries are made, credits |
| `/og/NNN.png` | 1200×630 share image per entry |
| `/data/catalog.json`, `/data/entries.json` | Public data (CC BY 4.0 for our text; source remains Apache-2.0) |
| `/feed.xml` | RSS of newly explained or reviewed entries |

Header: **∎ Closed Form** (home) · Archive · About · GitHub.

### Home `/`
1. Kicker: "Vol. 1 · The OpenAI collection · October 2026"
2. H1: "Every problem AI has solved, / explained for everyone." (second line in tertiary color on wide screens)
3. Lede (≤ 42rem).
4. Actions: primary button **Browse all 372 results** → `/archive/`; quiet link **How trust labels work** → `/about/`.
5. Stats (4, or 2×2 on mobile): papers 722 · results 372 · papers with formal proof 162 · explained so far N. Computed, never hard-coded.
6. **The map:** one 13px square per result, grouped into 17 fields, sorted formal → partial → claimed inside each field. Explained results get an accent ring. Hover/focus shows a tooltip (id, title, trust). Click → the entry. A field title → `/archive/?field=…`.
7. **Explained so far:** a list of explained entries + "Full archive →".
8. Footer.

### Archive `/archive/`
- Head: kicker "The archive", H1 "All 372 results", one-line lede.
- **Sticky tools:**
  - Row 1: search + a native field `<select>` with counts
  - Row 2: a segmented control `All · Formal proof · Partly · Not checked · Explained` (with counts) + a live count ("18 of 372 results in Topology") + Reset (only when filtered)
- **List grouped by field:** a caps group header + count, then rows: `id | title + optional "Explained" tag + one-line summary | trust dot + short label`.
- Search: word-prefix matching over id, title, summary and field; multiple words are ANDed; `pi` matches `π`; Greek names map both ways (zeta ↔ ζ).
- URL sync: `?q=&field=&trust=`. Keyboard: `/` focuses search, `Esc` clears, `j/k` and arrows move between rows, `Enter` opens.
- Empty state: names the query and field, with a "clear all filters" button.

### Entry `/entry/NNN/`
Two columns (content | 15rem sticky sidebar with "On this page" + Share on X). One column at ≤ 56rem.
Order: kicker "Entry NNN · Field" → H1 title → headline → scope → plain → notice (if not reviewed) → scorecard → chart → 4 sections (+ does not, + origin) → hype check → words used → sources → the original → prev/next.
Share text: `Open since {firstStep}. {headline} ∎ {url}` (or `{headline} ∎ {url}`).

### About `/about/`
Why Closed Form exists · The trust labels (exact meanings; listed ≠ compiled) · Review status · How entries are made · What we don't do · Report an error · Credits and license.

### Report an error
Every entry has a "Report an error" link → a GitHub issue template prefilled with the entry id and URL. This is the cheapest form of human review.

---

## 14. Design system

**Direction:** a research instrument and a modern journal. Lots of air, hairlines instead of boxes, one accent. Not skeuomorphic, no gradients, no glassmorphism, nothing that looks like generic AI design.

**Process:** before any UI work, run `npx skills add jakubkrehel/skills` and follow better-typography, better-colors, better-layout, better-accessibility and better-ui. Run better-interface as a review before each UI commit, and fix every HIGH finding.

### 14.1 Type: one family
- **Schibsted Grotesk**, variable, self-hosted woff2, subset to Latin + Greek + arrows + math operators (so π, ζ, ↗ render). `font-weight: 400 600`, `font-display: swap`, preloaded.
- **Three weights only:** 400 reading · 500 titles/UI · 600 logo, chart values, tags. No italics.

| Role | Size | Line-height | Weight | Tracking |
|---|---|---|---|---|
| Display H1 | clamp(2.5rem, 1.4rem + 4.6vw, 5.25rem) | 1.04 | 500 | −0.02em |
| Page H1 | clamp(2rem, 1.3rem + 2.8vw, 3.25rem) | 1.1 | 500 | −0.02em |
| Headline | clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem) | 1.4 | 400 | — |
| Row title | 1.125rem | 1.35 | 500 | −0.01em |
| Body | 1.0625rem | 1.6 | 400 | — |
| UI | 0.9375rem | — | 500 | — |
| Label | 0.8125rem | — | 500 | uppercase, 0.05em |
| Stat number | 2.25rem | — | 500 | tabular-nums |

- tabular-nums only on aligned or changing numbers. `text-wrap: balance` on headings, `pretty` on paragraphs. Measure ≤ 42rem.
- Underlines: thickness from-font, offset 0.2em, accent on hover.
- Uppercase labels must not uppercase Greek: wrap Greek runs in `<span class="nc">`.

### 14.2 Color: OKLCH, semantic tokens only
- Primitives (light): sand-0 `oklch(1 0 0)`, sand-50 `0.977 0.005 85`, sand-150 `0.905 0.008 85`, sand-250 `0.83 0.01 85`, sand-400 `0.63 0.01 80`, sand-550 `0.53 0.012 75`, sand-650 `0.43 0.012 75`, sand-950 `0.205 0.012 75`; vermilion-600 `0.565 0.19 33`; green-600 `0.5 0.105 160`; amber-600 `0.6 0.13 70`.
- Components use only these roles: `--color-bg, -bg-surface, -text, -text-secondary, -text-tertiary, -border, -border-strong, -border-control, -rule, -accent, -trust-formal, -trust-partial, -trust-claimed, -trust-claimed-fill`.
- Dark mode via `prefers-color-scheme`: bg 0.165, surface 0.205, text 0.945, secondary 0.79, tertiary 0.66, border 0.28, border-strong 0.35, border-control 0.51; accent `0.69 0.165 36`, formal `0.72 0.12 160`, partial `0.79 0.125 78`, claimed-fill `0.4 0.009 85`.
- Contrast that must keep passing (WCAG 2): light text-tertiary 4.95:1, accent 4.67:1, border-control 3.15:1; dark text-tertiary 6.19:1, accent 6.49:1, border-control 3.2:1.
- Accent only for: the logo square, Explained tags and rings, the claim bar, hover underlines, the focus ring.

### 14.3 Trust colors
One solid color per level everywhere (map squares, 10px dots, legend, segments): formal = green, partial = amber, claimed = claimed-fill. Color is never the only cue: map position (sorted) + a text label on every row + aria-labels.

### 14.4 Components
- **Map cell:** 13px, radius 2px, gap 3px; Explained → 1.5px accent ring at inset −3px; hover outline 2px.
- **Button (primary):** ink background, 10px radius, 46px tall, press scale 0.96 (no motion if reduced motion is on).
- **Search / select:** 46px, 10px radius, border-control; focus = 2px accent outline.
- **Segmented control:** one surface, 3px padding, outer radius 10px, inner 6px, active = ink fill.
- **Rows:** a hairline between rows; hover = surface background; no card per row.
- **Scorecard:** 4 columns (2×2 at ≤ 56rem) with a 1px rule above.
- **Chart:** HTML, not SVG (labels keep real size on mobile). Bars scaled to the max value, value above, year + who below, claim bar in accent, plus a visually hidden `<table>` with the data.
- **Notice:** 2px left rule in accent, text-secondary.
- **Elevation** (tooltip, figure): a layered shadow + `border: 1px solid transparent` (for forced colors).
- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96px. Max widths: 1080px for home/archive, 720px for article text.
- Logical CSS properties throughout.

### 14.5 Motion
Hero fade-up only (≤ 400ms, staggered), plus hover/press transitions of 120–150ms ease-out. Everything is off under `prefers-reduced-motion`. No scroll-jacking.

### 14.6 OG image (1200×630)
Background = light bg. Top left: ∎ Closed Form. Large line: "Open since {firstStep}." (or "Entry NNN"). Below: the headline (max 3 lines). Bottom: a trust dot + label · field. Generated with Satori + resvg at build time.

---

## 15. Accessibility (WCAG 2.2 AA minimum)

- Skip link to `#main`; the H1 is focused on route change (no outline on programmatic focus).
- A visible 2px accent focus ring on every interactive element.
- Tap targets ≥ 44px on touch.
- Labels on the search and select; the result count is `role="status"`.
- Trust is never shown by color alone.
- The chart has a hidden data table; the map cells have aria-labels.
- Works at 320px with no horizontal scroll; zoom to 200% without loss.
- Reduced motion respected everywhere.
- KaTeX output includes MathML.

---

## 16. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Astro** (latest), static output, TypeScript strict, no UI framework | Fast, static, cheap to host forever |
| Styling | Plain CSS with custom properties (tokens above) | No build lock-in |
| Math | **KaTeX** at build time (`katex.renderToString` / rehype-katex) | No client JS for math |
| Content | Astro content collections + **zod** | The schema is enforced at build |
| Search | A small JSON index + vanilla JS (prefix match, AND, π/pi aliases) | 372 items don't need a search service |
| OG images | **Satori + resvg-js** | Build-time PNGs |
| Hosting | **GitHub Pages** via `actions/deploy-pages` (correct `site` + `base`) | Free, durable |
| Pipeline | Node 22 scripts, OpenAI-compatible client, **p-limit**, backoff | Provider-agnostic |
| CI | GitHub Actions: `ci.yml` (test + build), `deploy.yml`, `explain.yml` | |
| Tests | **Vitest** (data, schema, lint), **Playwright** (pages), **Lighthouse CI** | |
| Package manager | pnpm | |
| Analytics | None for v1 (optionally a privacy-friendly counter later) | |

---

## 17. Repository structure

```
closed-form/
├─ source/openai-math/          # git submodule, read-only
├─ scripts/
│  ├─ ingest.ts                 # → src/data/catalog.json
│  ├─ explain.ts                # reader + checker pipeline
│  ├─ calibrate.ts
│  └─ lint-ste.ts
├─ prompts/
│  ├─ reader.md
│  └─ checker.md
├─ skills/ste100/               # user's STE100 writing skill (optional)
├─ schema/entry.schema.json
├─ src/
│  ├─ data/catalog.json
│  ├─ content/entries/NNN.json
│  ├─ components/               # Header, Footer, Map, Row, Segmented, Scorecard, RecordChart, Glossary, Notice, Original, ShareButton
│  ├─ layouts/Base.astro
│  ├─ lib/                      # search, trust, katex, slug
│  ├─ pages/
│  │  ├─ index.astro
│  │  ├─ archive.astro
│  │  ├─ about.astro
│  │  ├─ entry/[id].astro
│  │  ├─ field/[slug].astro
│  │  ├─ og/[id].png.ts
│  │  └─ feed.xml.ts
│  └─ styles/                   # tokens.css, base.css, components.css
├─ public/fonts/SchibstedGrotesk.woff2
├─ pipeline/                    # runs.jsonl, failures.jsonl (gitignored except samples)
├─ tests/                       # vitest + playwright
├─ .github/
│  ├─ workflows/ci.yml, deploy.yml, explain.yml
│  └─ ISSUE_TEMPLATE/report-error.yml
├─ CLOSED_FORM.md               # this file
└─ README.md
```

---

## 18. Tests and acceptance criteria

**Unit (Vitest)**
- Ingest counts: 372 / 722 / 162 / 17 and 127 / 108 / 137
- Trust mapping, date parsing, LaTeX cleanup, the allowed HTML tags
- Schema validation of 017; schema rejects a missing `scope`, a missing citation for `firstStep`, and hype words
- STE lint: sentence length, banned words

**End-to-end (Playwright, built site)**
- `/` shows 372 map cells, the stats match the data, and the field links deep-link to `/archive/?field=…`
- `/archive/` shows 372 rows in 17 groups. Searching `pi` includes 017. "Formal proof" shows only formal rows (127). Reset clears everything. The URL updates.
- `/entry/017/` shows the scope, scorecard, a chart with 4 bars, the hype check, sources and the notice
- `/entry/003/` shows the fallback card
- No horizontal scroll at 390×844 and 320×640
- Keyboard: `/` focuses search, `j/k` move between rows

**Quality bars**
- Lighthouse on `/`, `/archive/`, `/entry/017/`: performance ≥ 90, accessibility ≥ 95, SEO ≥ 95
- `pnpm build` produces 372 entry pages, 17 field pages and 372 OG images
- No client JS on entry pages except share/TOC (≤ 10 KB)

---

## 19. Build phases (for the coding agent)

Work on branch `v1-site`. Build and test after each phase, then commit. At the end, push and open a PR. **Do not merge.**

1. **Foundation:** scaffold, submodule, ingest, catalog types, schema (§10), the 017 seed (Appendix A), unit tests
2. **Site:** tokens, layout, home + map, archive + tools, entry (explained + fallback), field pages, about, KaTeX
3. **Share:** OG images, share link, RSS, public data files
4. **Pipeline:** `explain.ts`, `calibrate.ts`, `lint-ste.ts`, prompts, `explain.yml`. Run `--dry-run` on 007 only. Never run `--all`.
5. **Polish:** Playwright, Lighthouse fixes, a jakubkrehel better-interface review, README, deploy workflow, issue template

If something in this spec is impossible or wrong, stop and explain it in the PR description instead of guessing.

---

## 20. Launch and growth

**Before launch:** the archive is live with correct trust labels + **5–10 strong entries** (017 + the reasoning-trace families). Speed matters more than count.

**Launch post (X):** one thread. Start with the π entry's chart ("Open since 1953 → 42 → 7.6 → 7.1 → 2 (claimed)"), then the trust map screenshot, then the link. Tag no one aggressively; let the work speak.

**Ongoing:**
- One entry thread per day: chart + headline + trust label + link.
- Each entry's OG card does the selling. Make it beautiful.
- Post on Hacker News once there are about 25 entries.
- Invite mathematicians to review entries in their field. Their names appear on the entries they review.
- RSS + public JSON so others can build on it.

---

## 21. Operations: corrections, versions, review

- Every entry stores `sourceHash` + `sourceCommit`. A nightly (or manual) job re-ingests. If a family's hash changes, its entry is flagged: "The source paper changed after this entry was written."
- Corrections: fix through a PR; keep a `changelog` line in the entry; never silently change a published claim.
- If a result is shown to be wrong (a public retraction, an OpenAI revision, a credible refutation), add a top banner "Disputed" or "Withdrawn" with a source. Never delete the page.
- Review queue: a GitHub project board with columns ai-checked → in review → reviewed.

---

## 22. Risks and how we handle them

| Risk | Effect | Mitigation |
|---|---|---|
| The AI invents history | Credibility loss | The checker requires a quote or citation; a schema rule; human review before "reviewed" |
| The site looks more certain than it is | Misleads readers | Trust labels, the review notice, a hype check on every page, "claims to prove" wording |
| Uneven quality across 372 entries | Weak brand | Ship few and excellent; 017 is the gold standard; calibration pass |
| Upstream papers change | Stale entries | sourceHash + flag banner |
| Others copy the idea | Lost lead | Speed; reviewer network; quality of writing |
| Human review is a bottleneck | Slow growth | Publish ai-checked with a clear notice; recruit field reviewers; the "Report an error" link |
| Name lost in search | Low discovery | Always use the descriptor; OG cards; consistent handle |
| API cost | Budget | Dry runs; cost logging; batches of 10 |

---

## 23. What success looks like

- **Week 1:** live with 10 entries; launch thread posted.
- **Month 1:** 50 entries; at least 3 outside reviewers; linked by at least one news article or a mathematician's blog.
- **Quarter 1:** all 372 at ai-checked or better, 50+ reviewed, ready for Volume 2 (the next AI math release).
- **Quality:** zero published factual errors left uncorrected for more than 48 hours.

---

## 24. Non-goals (v1)

No accounts, comments, newsletter, CMS, paid tier or analytics beyond an optional privacy-friendly counter. No proof sketches. No opinion pieces about OpenAI. No Lean compilation of our own (we report the repo's status; we don't verify it).

---

## 25. Open decisions

| Decision | Default until decided |
|---|---|
| Domain name | GitHub Pages URL |
| Text license | CC BY 4.0 for our explanations |
| Publish `ai-checked` entries on main, or only `reviewed`? | Publish with the notice |
| Reader / checker models | Any two different strong models |
| Named reviewers shown on entries? | Yes, with consent |
| Volume 2 scope | Other AI math releases, same format |

---

## Appendix A: the 017 gold-standard entry

Every generated entry is measured against this. Facts marked † must be checked against their source before 017 becomes `reviewed`.

```json
{
  "id": "017",
  "status": "sample",
  "headline": "Fractions can never get unusually close to π.",
  "scope": "The result is about π only. It does not cover other constants.",
  "plain": "Every number can be approached by fractions. For most numbers, the closest fractions miss by about 1 divided by the square of their bottom number. This paper claims to prove that π behaves like most numbers. No fraction gets much closer to π than that rule allows.",
  "doesNot": "This does not prove that π is irrational or transcendental. Those facts were proved in the 1760s and in 1882.",
  "origin": "This result comes from an unreleased OpenAI model, published in the openai/math release on 6 October 2026.",
  "scorecard": {
    "firstStep": "1953",
    "firstStepBy": "Kurt Mahler, first proven limit",
    "field": "Number theory",
    "significance": "Major",
    "significanceWhy": "It ends a 70-year chain of better and better limits on a famous constant."
  },
  "visual": {
    "type": "record",
    "title": "Best proven limit on π’s irrationality exponent",
    "note": "Smaller is better. 2 is the lowest possible value.",
    "lowerIsBetter": true,
    "points": [
      { "year": 1953, "value": 42,     "who": "Mahler",                "source": 1 },
      { "year": 2008, "value": 7.6063, "who": "Salikhov",              "source": 2 },
      { "year": 2020, "value": 7.1032, "who": "Zeilberger and Zudilin", "source": 3 },
      { "year": 2026, "value": 2,      "who": "This paper", "claim": true, "source": 5 }
    ]
  },
  "sections": [
    { "title": "The story", "body": "In 1953, Kurt Mahler proved that the irrationality exponent (a score for how closely fractions can approximate a number) of π is at most 42. Since then, mathematicians made this limit smaller step by step. Salikhov reached about 7.61 in 2008. Zeilberger and Zudilin reached about 7.10 in 2020. Most experts expected the true value to be 2, but no one could prove it." },
    { "title": "Why it matters", "body": "A value of 2 means π is not special in this way. The paper also settles a well-known puzzle: the Flint Hills series, the sum of 1 / (n³ sin²n). Alekseyev showed in 2011 that this sum converges (approaches a fixed value) if the exponent is small enough. This result is small enough." },
    { "title": "Where it leads", "body": "The same methods could apply to other constants, such as log 2 or ζ(3), where the known limits are still far above 2. Family 017 is one of 10 results with a published reasoning summary, so mathematicians can study how the model found the proof." },
    { "title": "What it says about AI", "body": "Strong human experts worked on this problem for decades. If the proof holds, it shows that AI can finish a long line of human work on a classical question. The repository does not list a formal Lean proof for the main paper yet." }
  ],
  "hypeCheck": "Major if the proof holds. It is not yet machine-checked, and specialists have not yet published a review.",
  "glossary": [
    { "term": "Irrational number", "meaning": "A number that is not a fraction of two whole numbers, like π." },
    { "term": "Irrationality exponent", "meaning": "A score for how closely fractions can approximate a number. The lowest possible score is 2." },
    { "term": "Converge", "meaning": "When the sum of an endless list of numbers approaches a fixed value." }
  ],
  "sources": [
    { "id": 1, "cite": "K. Mahler, “On the approximation of π”, Indagationes Mathematicae 15 (1953) †" },
    { "id": 2, "cite": "V. Kh. Salikhov, “On the irrationality measure of π”, Russian Mathematical Surveys 63 (2008) †" },
    { "id": 3, "cite": "D. Zeilberger and W. Zudilin, “The irrationality measure of π is at most 7.103205334137…”, Moscow Journal of Combinatorics and Number Theory 9 (2020) †" },
    { "id": 4, "cite": "M. A. Alekseyev, “On convergence of the Flint Hills series”, arXiv:1104.5100 (2011) †" },
    { "id": 5, "cite": "openai/math, family 017 manuscripts (2026)", "url": "https://github.com/openai/math" }
  ],
  "sourceHash": "<computed>",
  "sourceCommit": "<computed>"
}
```

Note: 017's trust is **partial** (Partly formalized) in the catalog, so the text says "claims to prove".

---

## Appendix B: instructions for the coding agent

1. Read this whole file before writing code.
2. Follow §19 phase by phase. Build and test after each phase; commit with clear messages.
3. Never hard-code counts; compute them from `catalog.json`.
4. Never run the pipeline on `--all`. Use `--dry-run` on 007.
5. Never commit API keys.
6. Use the jakubkrehel skills for UI and fix every HIGH finding. Report checks you could not run as "Not verified".
7. When this spec is wrong or impossible, stop and explain it in the PR description.
8. Push branch `v1-site` and open a PR. Do not merge.
