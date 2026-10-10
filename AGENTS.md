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
List the IDs in the catalog. Leave out any that already have `src/content/entries/<ID>.json`. Leave out IDs with no paper source. Take the lowest 5. Known gaps to fill: 141, 142, 143, 147.

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

### Loop for one entry
1. Read the LaTeX and the Lean doc.
2. Write `src/content/entries/<ID>.json`.
3. Review it against rules 1-11. Check every quote against the source.
4. Fix what failed.
5. Run `pnpm -s lint-ste`, then `pnpm -s test`. Two "007 dry run" test failures are known and older; ignore them. Fix anything else.

### Batch loop
- 5 entries per branch, named `entries/batch-N`.
- Commit, push and open a pull request. NEVER merge. A human merges.
- Never run several full builds at the same time.
- Best practice: one model writes and a different model reviews.

### Never
Don't merge, delete files or branches, change repo settings, or post anywhere.

### Daily command
Inside the repo, tell your tool: `Follow AGENTS.md and do the next 5 entries.`
