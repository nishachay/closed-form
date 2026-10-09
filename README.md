# Closed Form ∎ — AI mathematics, explained

[![Deploy](https://github.com/nishachay/closed-form/actions/workflows/deploy.yml/badge.svg)](https://github.com/nishachay/closed-form/actions/workflows/deploy.yml)
[![Code: MIT](https://img.shields.io/badge/code-MIT-blue.svg)](LICENSE)
[![Content: CC BY 4.0](https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey.svg)](LICENSE-CONTENT.md)

**Live site: https://nishachay.github.io/closed-form/**

Every maths problem AI has solved, explained for everyone, with honest trust
labels. Each entry starts from a concrete example, says what was known before,
names the obstacle the paper removed, and is plain about how certain the result is.

The site is built from the [`openai/math`](https://github.com/openai/math)
release (Vol. 1: 372 result families, 722 papers). Explanations are written by
an AI pipeline and checked by a second AI pass against the source papers. They are not
peer-reviewed. Found a mistake? Every entry has a "Report an error" link.
`CLOSED_FORM.md` is the full spec.

## Quickstart

```sh
git clone https://github.com/nishachay/closed-form.git
cd closed-form
git submodule update --init --depth 1   # openai/math source, ~2.4 GB
corepack enable
pnpm install
pnpm test     # vitest unit tests
pnpm build    # static site in dist/
pnpm preview  # serve the build locally
```

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

Entries are now written by hand from the paper sources and opened as pull
requests. The old `scripts/explain.ts` still reads `LLM_BASE_URL`, `LLM_API_KEY`,
`READER_MODEL` and `CHECK_MODEL` if you run it locally, but no scheduled CI job
runs it. Never commit a key. No key is needed for ingest, tests or the site build.

## Deploy

Push to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`
(`actions/deploy-pages`, base `/closed-form`). New entries arrive as PRs, and
merging publishes them.

## Public data

- `/data/catalog.json` — all 372 families with papers, subjects, trust.
- `/data/entries.json` — explained entries in full.
- `/data/fields.json` — the 17 fields with counts and trust split.
- `/feed.xml` — newly explained entries, newest first.

## Contributing

Corrections, bug reports and pull requests are welcome. Read
[CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).
Report security problems privately, as described in [SECURITY.md](SECURITY.md).

## License

Code is [MIT](LICENSE). Written explanations are
[CC BY 4.0](LICENSE-CONTENT.md). Source papers, Lean proofs and traces belong to
`openai/math` under Apache-2.0. Not affiliated with OpenAI.
