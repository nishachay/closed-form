# Closed Form: instructions for coding agents

- `CLOSED_FORM.md` is the full spec and source of truth. Read §0 and Appendix B before writing code.
- Work one phase at a time (§19). Show a short plan first, then build.
- After each working step: build, run tests, commit with a clear message.
- Keep the Schibsted Grotesk design (§14). Never hard-code counts.
- Never commit secrets. Never run the AI pipeline on `--all`.
- If something in the spec is wrong or impossible, stop and say so.

## Writing entries (any AI tool or model)

This section is model-agnostic. opencode, Gemini CLI, Codex, Claude Code and Cursor all read this file. Nothing here depends on one provider.

Closed Form explains each of the 372 openai/math (2026) results in plain English, with honest trust labels.

### Sources
Read from openai/math at commit `fd4aeeb2ee4fc729c18d98444fed42fd0529eeeb`:
- the paper LaTeX for the result
- `lean/docs/<ID>.md`, when it exists (it says what Lean actually proves)

### Pick the next IDs
List the IDs in the catalog. Leave out any that already have `src/content/entries/<ID>.json`. Leave out IDs with no paper source. Then pick in this order:
1. IDs that have `lean/docs/<ID>.md` (Lean-checked results first), lowest first.
2. Then the rest, lowest first.
Take 5. Known gaps to fill: 141, 142, 143, 147.

### Which model does what
- Write entries with the strongest model you have. Claude in Antigravity while the plan still offers it (promo plans lose Claude on 2 Nov 2026); after that, the newest Gemini Pro.
- Review with a different model family from the writer (Claude writes, Gemini reviews; Gemini writes, Claude/GPT/Grok reviews). The writer never reviews its own batch.
- The scripts are the final gate: `pnpm source-quotes --check`, `pnpm -s lint-ste` and `pnpm -s test` must pass before a PR is opened.

### Hard rules for every entry
1. Copy the structure of an existing entry, such as `src/content/entries/144.json` or `152.json`. Keep the same fields.
2. `status` is `"ai-draft"`. Never say "verified" or "human-reviewed".
3. Use "proves" only for what `lean/docs/<ID>.md` covers. Otherwise use "claims".
4. `doesNot` must start with the exact words `This does not`.
5. Copy the `origin` sentence exactly from an existing entry. Never reword it.
6. Every `sourceLine` and every quote must appear word for word in the paper LaTeX.
7. Recompute every number in the worked example yourself.
8. Define every technical word in plain language the first time you use it.
9. No hype: no "breakthrough", "stunning" or "revolutionary". Don't overstate scope.
10. Credit the authors and the AI role exactly as the paper states them.
11. The `explanation` is continuous first-principles prose: a concrete example, what was known before and after, the key obstacle, and honest certainty. No bullet lists or fixed sections.
12. Inline citations: a sentence in the `explanation` that states what a paper claims or proves ends with a marker `[n]`, where n is the 1-based position of the supporting item in `claims` (several: `[2,5]`). Write it against the last word, before the full stop: `…in every dimension[4].` Only cite claims that have a `sourceLine`. Never put a marker on an example, intuition, analogy or background. Never invent a citation: if no claim supports a result sentence, leave it unmarked. If you add, remove or reorder `claims`, renumber every marker. Markers go only in the `explanation`.
13. Every cited claim also carries `sourceQuote`: the full sentence (or two) of the paper LaTeX that contains its `sourceLine`, because readers see it when they tap the numeral. Do not type it by hand. Run `CF_SOURCE_DIR=<openai/math checkout> pnpm source-quotes --entry src/content/entries/<ID>.json`; it copies the sentence verbatim (comments removed, line breaks as single spaces, math kept). If it reports a fallback for a claim, the page shows the `sourceLine` instead; that is allowed, but prefer a `sourceLine` that sits inside one ordinary sentence.

### Loop for one entry
1. Read the LaTeX and the Lean doc.
2. Write `src/content/entries/<ID>.json`.
3. Run `pnpm source-quotes --entry src/content/entries/<ID>.json` (rule 13).
4. Review it against rules 1-13. Check every quote against the source.
5. Fix what failed.
6. Run `pnpm -s lint-ste`, then `pnpm -s test`. All must pass. If the 007 tests say the paper LaTeX is missing, run `git submodule update --init source/openai-math` or set `CF_SOURCE_DIR`.

### Batch loop
- 5 entries per branch, named `entries/batch-N`.
- Commit, push and open a pull request. NEVER merge. A human merges.
- Never run several full builds at the same time.
- Best practice: one model writes and a different model reviews.

### Never
Don't merge, delete files or branches, change repo settings, or post anywhere.

### Review command (different model)
On the batch branch, tell the reviewer: `Review the entries changed on this branch against AGENTS.md rules 1-13. Open every sourceLine in the paper LaTeX and confirm it is word for word. Check every [n] marker points at a claim that supports that sentence. Recompute the worked example. Fix only real errors, rerun source-quotes, lint-ste and test, then commit and push.`

### Daily command
Inside the repo, tell your writer: `Follow AGENTS.md and do the next 5 entries.`
