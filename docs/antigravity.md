# Writing entries with Antigravity CLI

Uses the Google AI Pro plan, so no API keys and no extra cost. On promo plans (e.g. Jio), Claude disappears on 2 Nov 2026: until then Claude writes and Gemini reviews; after that Gemini Pro writes and a non-Gemini model reviews.

## One-time setup
1. Install Antigravity CLI (`agy`) from https://antigravity.google and sign in with the Google account that has AI Pro.
2. Run `/usage` inside `agy` to see which Claude model your plan has (Opus 5.5 on paid plans, Opus 4.6 on promo plans until 2 Nov 2026).
3. In the repo: `git pull && git submodule update --init source/openai-math && pnpm install`.

## Each session (quota refills every 5 hours)
1. `git checkout main && git pull`
2. Start `agy` in the repo, pick the best Claude listed, and say: `Follow AGENTS.md and do the next 5 entries.`
3. When it has pushed the branch, switch the model to **Gemini Pro** and paste the Review command from AGENTS.md.
4. It pushes the fixes and opens the PR. Hark checks the PR and merges when everything passes.

If the Claude quota runs out mid-batch, stop and wait for the refill rather than switching writers mid-batch.
