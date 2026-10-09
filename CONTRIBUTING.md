# Contributing to Closed Form

Thanks for helping. Closed Form explains AI-solved maths results in plain
language, so accuracy matters more than speed.

## Ways to help

- **Report an error in an entry.** Every entry page has a "Report an error"
  link. It opens an issue with the entry number filled in. Quote the sentence
  and say what is wrong. A source or a worked counter-example helps most.
- **Fix the site.** Bugs in layout, search, accessibility or the build.
- **Improve the pipeline.** Prompts in `prompts/`, scripts in `scripts/`.

Please open an issue before starting a large change, so we can agree on it first.

## Local setup

```sh
git clone https://github.com/nishachay/closed-form.git
cd closed-form
git submodule update --init --depth 1   # openai/math source, ~2.4 GB
corepack enable
pnpm install
pnpm test        # unit tests
pnpm typecheck   # astro check
pnpm build       # static site in dist/
pnpm preview     # open the build locally
```

## Before you open a pull request

- `pnpm test`, `pnpm typecheck` and `pnpm build` pass.
- `pnpm lint-ste` shows no errors if you touched an entry.
- One topic per pull request, with a clear description of what changed and why.

## Rules for explanations

- Follow `prompts/explainer.md`: a concrete example first, short active
  sentences, unavoidable terms defined, honest limits.
- Never call a result "verified". Say what was checked and by what
  (a Lean proof, a computer search, a human paper), and nothing more.
- Every quote must appear in the cited source paper.
- Recompute every number in a worked example.

## Licensing

By contributing, you agree that code you add is released under the MIT License
and written explanations under CC BY 4.0. See `LICENSE-CONTENT.md`.

## Conduct

Everyone taking part follows our [Code of Conduct](CODE_OF_CONDUCT.md).
