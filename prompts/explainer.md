# Explainer — writing rules for `explanation` (appended to the reader prompt)

The entry's main body is one field, `explanation`: continuous prose that makes a smart
adult who has never seen the symbols understand the result and feel why it matters.
It replaces the four fixed `sections`. Leave `sections` out (or set it to `[]`).
Every other field (headline, scope, plain, doesNot, origin, scorecard, visual, hypeCheck,
glossary, sources, claims, evidence) is still required and written as before.

## Before you write: answer these privately

Do not print the answers. Use them to plan the prose.

1. **The claim.** What is the single most important claim? One sentence, no symbols.
2. **The example.** What is the simplest concrete example, with real numbers? Pick one
   small enough that every number in it can be recomputed exactly with a few lines of
   code (a fraction, an area, a count, a small matrix). Do the arithmetic carefully.
   Use only numbers you have computed or that the source states. Round consistently
   and say "about" when you round.
3. **The history.** What was known before, and where did progress stop? Use only
   results, names, years and bounds that the paper, its bibliography, or the task's
   existing sources state. Quote bounds exactly as the source gives them.
4. **The difficulty.** What single difficulty made the problem hard, and how did the
   paper remove it? Say it in plain words: what the obstacle is like, not the proof
   machinery. No lemma names, no estimates, no proof sketch.
5. **The force.** How do you restate the result so someone who has never seen the
   symbols feels its force? Usually: return to the example and show what the
   theorem forbids or guarantees there.
6. **The gap.** What would a careful reader still not understand from the claim
   alone? A condition, a limit, something the result does not give. This becomes
   part of the explanation, not a warning box.

## How to write it

- Continuous prose: 5 to 9 paragraphs separated by one blank line. No headings, no
  bullets, no numbered lists, no bold.
- Short sentences in active voice. Aim for 20 words or fewer; 25 is the hard limit.
  One idea per sentence. Split any sentence that carries two steps of an argument.
- Open with the concrete example, not with history or definitions.
- Define each unavoidable term in plain words the first time you use it. Avoid every
  term you can. Each defined term also goes in the `glossary`.
- Weave caveats into the understanding. A limit belongs at the point where the reader
  would otherwise over-read the claim, as part of the same thought. Never tack it on
  at the end as "A careful reader should know…".
- End with how certain the result is, stated plainly from the LEAN FACTS block and the
  Lean scope doc only: which statement a computer proof checker (Lean) has checked,
  what lies outside that check, and that no specialist review has been published
  (unless a source in the task says otherwise). Do not write the word "verified".
- Use no hype words (breakthrough, revolutionary, groundbreaking, unprecedented,
  game-changing, stunning, mind-blowing, historic, finally) and no speculation about
  what the result might lead to.

## Invent nothing

- Every fact (dates, bounds, names, counts, what is proved) must trace to the paper,
  its bibliography, the official summary, the LEAN FACTS block, the release provenance,
  or an existing entry source. List each source you rely on in `sources`.
- Every factual sentence must be checkable: add a `claims` item for it, quoting the
  supporting line verbatim from the source LaTeX where one exists.
- If the result cannot be made clear without inventing a fact or an example the
  source does not support, say so plainly in the explanation instead of filling the gap.
- Wording must match the trust status: "proves" only with a Lean proof listed in the
  LEAN FACTS; otherwise "claims to prove".

## Shape example (entry 017, abridged)

> Write π as a fraction and you will always be a little wrong. … There is a basic
> yardstick. … So π has at least one lucky fraction.
>
> …
>
> How sure is this? The main theorem has a Lean formalization. … The step about the
> sum is outside that check. No specialists have published a review yet.

The full gold example (entry 017) is appended to the task after the schema.
