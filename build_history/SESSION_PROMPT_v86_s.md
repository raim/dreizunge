# Session prompt — written at the `v86_s` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_s`**. `v86_o`/`p`/`q` shipped
item W ("text explorer" mode) and three follow-up rounds; `v86_r` fixed an unrelated real bug. This
cut (`v86_s`) is a fourth item-W follow-up round, found while the user live-tested a specific real
chapter (`tp_17877511606660000499`).

**What shipped this cut (`v86_s`)**:

**Layout fidelity fixed.** The user reported the text-explorer view lost the original text's line/
paragraph layout compared to the normal highlighted view. Root cause, confirmed against real cached
data (not assumed): the FIRST draft's own code comment claiming "CP1 doesn't preserve mid-paragraph
newlines" was simply wrong — checked and a `\n` mid-sentence DOES survive verbatim in
`sentence.text`; the renderer just never converted it to `<br>`. A second, genuinely real gap: a
single `\n` BETWEEN two sentences (no blank line) is indistinguishable from a plain space at CP1's
own record level. Fixed entirely client-side, no CP1 change: `_teStoryHtml` now reconstructs
paragraph/line structure directly from the raw story text (`d.story`) via the same forward-only
alignment technique already used per-token, one level up per-sentence — a blank line becomes a real
`<p>`, a single `\n` becomes `<br>`, matching `_storyParasHtml`'s own two-tier rule exactly.

**A deeper CP2 gap recorded, not built.** Asked to compare `inflections`' own per-word data against
CP2's for "aiutateci"/"trovarlo" on the same chapter — real data showed CP2's `form` field is
systematically coarser (no clitic-pronoun decomposition, no explanation field). Recorded as item AG
in the roadmap, scoped explicitly as "enrich CP2" per the user's own direction — NOT a parallel
mechanism, since CP2 feeds the whole PLAN §7.0 pipeline. Not started; needs a live-model measurement
of whichever enrichment is eventually tried, the same way `v83_n`→`v83_p` measured CP2's original
design.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. Item
   W's own section (✅ SHIPPED across four cuts now) if you need that history; **items AG/AH/AI**
   (added post-release, doc-only, no version bump) if you're picking up any of the CP2-quality/
   cost/curation-UI follow-ups.
3. `INTERNALS.md` **§6b** is now current through `v86_s` for BOTH the comic-panel subsystem AND item
   W's whole CP1/CP2 browser-integration surface (added in the same doc-only pass as AG/AH/AI,
   after several cuts of flagging it — done now, not carried forward again).

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 293 checks
node test/run.js --quick                  → expect 251
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **One kind of "expected" failure can show up in a full run, NOT a regression, and it is
REPRODUCIBLE (not intermittent), inherited unchanged across SEVEN cuts now (`v86_m`→`v86_s`)**:
`unit-article-choices`, which reads the LIVE `lessons.json` directly — one `it`-language article
lesson somewhere in the live corpus can't build a full 3-way MCQ. Still not investigated. This is by
a wide margin the single most-carried-forward open item in this whole line — do this one next.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 704 `en` keys** — an inherently live
snapshot for the topic/storyline counts; re-measure fresh if `unit-roadmap-version` disagrees. No new
`en` keys this cut (no user-facing string change — a rendering-logic fix + a roadmap analysis entry).
`lessons.json`/`canonical-analysis.json` untouched this cut (confirmed clean via `git status --short`
throughout). `docs/index.html` rebuilt after the `APP_VERSION` edit. `APP_VERSION = 'v86_s'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items 11-14 added across the
`v86_o`-`v86_r` cuts — see those releases' own sections for the reasoning)

1. **Measure before editing** — confirmed hard this cut: the first draft's own code comment about
   CP1 data loss was WRONG, and only checking the real cached data (not trusting the earlier
   comment, even one written in this same codebase) found the real, different root cause.
2. **Guard at the layer where the claim is observable.**
3. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change.**
4. **A test that reads the LIVE corpus directly can fail from the user's own real-time usage alone —
   but re-run it a few times before assuming that's the explanation.**
5. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it** — this
   cut's own fix was verified by rendering the REAL cached data before and after, not just by the
   new unit tests passing.
6. **A live model call needs a live test AND a real human reading the output.**
7. **Ask before restarting a dev server you did not start, and before writing to lessons.json.**
8. **When a fix targets ONE known write path to some piece of state, check whether OTHER write paths
   to the SAME state exist before considering the class of bug closed.**
9. **A track explicitly tagged "(multi-session)" in the roadmap is a standing judgment call already
   made — don't override it with same-session optimism without a real reason.**
10. **Mutation-test every guard you write or rely on.**
11. **A cost/product tradeoff surfaced by real usage is a real design decision — lay out the options
    and their real costs, don't just build the first thing asked.**
12. **When enriching a shared pipeline stage (CP2) for one consumer's need, check what ELSE consumes
    it before designing the enrichment** — new this cut: the user's own explicit reason for directing
    "enrich CP2" rather than building a parallel per-word mechanism just for item W.

# WHERE TO START

- **The `unit-article-choices` reproducible red** — SEVEN cuts running now. Top priority.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, real comparison data
  already in the roadmap, needs a prompt-design decision and a live-model measurement before any
  code ships (see item AG's own section for the two concrete candidate enrichments).
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip" for
  any reuse mechanism; no code started, needs a product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a human correction survive a chapter re-analysis today? no — the `stale` mechanism
  invalidates the whole chapter); not started.
- **Job cancellation is cosmetic-only, app-wide** (found at `v86_p`, not fixed).
- **Item AE (mobile-backgrounding)** is still open — blocked on the user hitting it again with the
  `v86_j` diagnostic logging in place.
- **Item AB's "stuck mid-sentence" half** remains open — needs live reproduction.
- **Item AD (source-language furigana)** is scoped (needs a live-model check, and a toggle-sharing
  design question settled).
- **Item R** (unfinished-project persistence) is the remaining client-facing half of item S.
- **Item P** needs a live-model check before any code ships.
- **Item C (comic/PDF upload-card UX)** still needs the user's own confirmation of the recommendation.
- **Item A (move comic images out of `lessons.json`)** needs the user's own go-ahead before touching
  the 6 existing topics.
- **Item D (Tier 2 image-coordinate highlighting)** is buildable now that Tier 1 genuinely works.
- **Items B, E, G** are each independently startable.
- **Item F's "add explanations" half** remains open and unscoped in detail.
- **Item W's own natural follow-up**: extend the text-explorer toggle to the question panel's own
  story view (`_exStoryPanelHtml`), which never got it (only the completion/progress card panel did).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_s` for both the
comic-panel subsystem and item W's whole CP1/CP2 browser-integration surface; other sections are
kept current inline as each cut touches them.
