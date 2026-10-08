# Closed Form ∎ — AI mathematics, explained

Every problem AI has solved, explained for everyone, with honest trust labels.

This repo builds a static Astro site from the `openai/math` release (Vol. 1:
372 result families, 722 papers) plus hand/AI-written plain-language entries.
`CLOSED_FORM.md` is the full spec and source of truth.

## Quickstart

```sh
git clone --recurse-submodules -b v1-site https://github.com/nishachay/closed-form.git
cd closed-form
corepack enable
pnpm install
pnpm test     # vitest: 55+ unit tests
pnpm build    # static site in dist/ (395 pages + 393 OG cards)
pnpm preview  # serve the build locally
```

The OpenAI submodule is large (~2.4 GB checked out). A shallow
`git submodule update --init --depth 1` is enough for ingest and gather.

## Scripts

| Command | What it does |
|---|---|
| `pnpm ingest` | Deterministic rebuild of `src/data/catalog.json` from the submodule (no AI). |
| `pnpm explain --ids 007,017 \| --batch 10 \| --traces \| --all [--concurrency 20] [--dry-run]` | Reader → checker pipeline; writes `src/content/entries/NNN.json`. `--dry-run` is offline, keyless and write-free. Never run `--all` without a dry run first. |
| `pnpm calibrate [--apply]` | Re-ranks significance toward the 5/20/45/30 spread. Prints a diff; `--apply` refuses below 10 entries. |
| `pnpm lint-ste [--entry <path>]` | Sentence-length + hype-word lint over entries. |
| `pnpm typecheck` | `astro check`. |
| `npx playwright test` | End-to-end suite in `e2e/` (needs a build first; config serves `pnpm preview`). |

## Pipeline credentials

Real `explain` runs read `LLM_BASE_URL`, `LLM_API_KEY`, `READER_MODEL` and
`CHECK_MODEL` from the environment (GitHub secrets in CI — see
`.github/workflows/explain.yml`). Never commit a key. No key is needed for
ingest, dry runs, tests or the site build.

## Deploy

Push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`
(`actions/deploy-pages`, base `/closed-form`). Entry batches arrive as PRs
from `explain.yml` and merge publishes them.

## Public data

- `/data/catalog.json` — all 372 families with papers, subjects, trust.
- `/data/entries.json` — explained entries in full.
- `/data/fields.json` — the 17 fields with counts and trust split.
- `/feed.xml` — newly explained entries, newest first.

Our explanations are CC BY 4.0. Source papers are `openai/math` (Apache-2.0).
Not affiliated with OpenAI. Found a mistake? Every entry has a
“Report an error” link.
