# PR notes — collected deviations for the v1-site PR description

## Phase 2 deviations (from commit 6033908)

1. **§0 routes instead of §13 routes.** Spec §13/§17 says `/entry/NNN/`,
   `/field/<slug>/`, `/og/NNN.png`. Built instead (per §0, which overrides §13):
   entries at `/e/<global-id>/` (e.g. `/e/openai-math-2026-017/`),
   `/collection/<collection>/`, `/lab/<lab>/`, `/science/<science>/`,
   `/science/<science>/<field>/` (17 fields). `/archive/` stays the all-results page.
   Share links and sitemap use the `/e/<global-id>/` URLs.

2. **Lab-neutral chrome.** Spec §13 home says kicker
   "Vol. 1 · The OpenAI collection · October 2026" and H1
   "Every problem AI has solved, explained for everyone."
   Built instead: kicker "Vol. 1 · October 2026", H1
   "Every discovery AI makes, explained and checked.",
   header/nav with no lab or collection names. Lab + science live in labels,
   filters, the collection page, and entry meta. Home OG card is lab-neutral too.

## Phase 3 deviations

- **OG renderer: hand-built SVG + resvg-js (no Satori).** Spec §14.6/§16 says
  "Satori + resvg". The 393 cards are hand-built SVG strings rendered with
  `@resvg/resvg-js` at build time. Reason: deterministic offline build with no
  extra layout engine; Satori adds a React/jsx-runtime + fontkit chain for no
  visible gain on this fixed card layout. Card content follows §14.6 exactly
  (∎ Closed Form / Open-since-or-Entry line / headline ≤ 3 lines /
  trust dot + label · field on light bg, 1200×630 PNG).
- **RSS ordering proxy.** Spec §13 says "RSS of newly explained or reviewed
  entries" newest-first, but entries carry no publish date (only optional
  `reviewedAt`). Feed sorts `reviewedAt` desc when present, else numeric id desc.
  With one explained entry (017) this is a single-item feed.
- **Public data routes.** Spec §13 lists `/data/catalog.json, /data/entries.json`.
  Built: `/data/entries.json` (explained entries, full schema) and
  `/data/fields.json` (17 fields with collection/lab/science + counts + trust
  split). Full catalog (372 families + papers) stays in the repo at
  `src/data/catalog.json`, not re-exposed, to avoid shipping a duplicate 9k-line
  file. Both public files documented on `/about/`.
