# Writing entries with Antigravity CLI

Uses the Google AI Pro plan (directly billed, not a trial), so no API keys and no extra cost.

## One-time setup
1. Install Antigravity CLI (`agy`) from https://antigravity.google and sign in with the Google account that has AI Pro.
2. Run `/usage` inside `agy`. Claude Opus 5.5 must be listed. If it isn't, the plan is a trial or promo and Claude is not included.
3. In the repo: `git pull && git submodule update --init source/openai-math && pnpm install`.

## Each session (quota refills every 5 hours)
1. `git checkout main && git pull`
2. Start `agy` in the repo, pick **Claude Opus 5.5**, and say: `Follow AGENTS.md and do the next 5 entries.`
3. When it has pushed the branch, switch the model to **Gemini Pro** and paste the Review command from AGENTS.md.
4. It pushes the fixes and opens the PR. Hark checks the PR and merges when everything passes.

If the Claude quota runs out mid-batch, stop. Don't switch the writer to Gemini; wait for the refill.
