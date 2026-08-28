# Session prompt — written at the `v86_o` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_d`, `v86_e`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_o`**. The prior session
(`v86_n`) reconciled item W ("text explorer" mode) with `PLAN §7.0` CP5 and shipped step 1 of its
4-step recommended path (a new `OLLAMA_ANALYSIS_MODEL` role, groundwork only). This cut built **all
three remaining steps** — the real feature.

**What shipped this cut (`v86_o`, one release)**:

1. **Step 2 — a background job + per-chapter cache (server.js).** `_runAnalysisJob` runs CP1
   (`buildCanonicalText`, instant) then CP2 (`analyzeChapter`, one model call per sentence,
   sequential) for one chapter on demand, caching the result to `canonical-analysis.json`
   (env-overridable via `CANONICAL_ANALYSIS_FILE`) — mirrors `_runComicExtractJob`'s exact
   `newJob`/`jobStep`/`jobDone`/`jobFail` shape. A new `analyzingChapters` lock (`chapterId -> jobId`,
   same pattern as the existing `generatingTopics`) means two concurrent requests for the SAME
   chapter share one job instead of duplicating a multi-minute CP2 run. Each cached record is
   enriched with CP1's own raw sentence `text`/`paraBreakBefore` so the client never needs a second
   CP1 pass.
2. **Step 3 — `GET /api/analysis/:chapterId` + `POST /api/analyze-chapter/:chapterId` (server.js).**
   The GET mirrors `cp5ShadowFor`'s own shape (absent → `available:false`) plus a new `stale` field
   (re-hashes the chapter's live story via CP1 on every read; a post-analysis story edit marks the
   cache stale WITHOUT deleting it). The POST is the trigger: a fresh cache hit short-circuits with
   `200 {cached:true}` (no job at all), otherwise it starts/reuses a job and returns `202 {jobId}`,
   polled via the existing `/api/job/:id`.
3. **Step 4 — the client "text explorer" view (index.html).** A 🔍 toggle next to the translation
   flags in the progress card's story panel. Built DIRECTLY from the cached per-sentence data via
   forward-only substring alignment (each token's `surface` located by `indexOf` from where the last
   token ended) — NOT a shared-word-list regex pass like `_highlightVocabHtml`, since per-token
   analysis has no such list and the same surface form can carry a different analysis per occurrence.
   Click shows lemma/form/sense/confidence in a popup. The poller reuses the SAME mobile-
   backgrounding-safe shape (+ shared `visibilitychange` hook) the three comic pollers already use.

**Two real bugs found and fixed by this cut's own tests** (not just written to pass — see the
roadmap's own `v86_o` section for the full story): a test-isolation leak (a first test draft wrote
real fixture data into the actual project-root `canonical-analysis.json` because `boot()` was never
given a scratch `CANONICAL_ANALYSIS_FILE`), and a genuine self-mutation bug in
`_ensureTextExplorerData` (the "already in flight" guard matched the entry it had JUST created,
short-circuiting every single call including the first).

**Live-verified, not just fake-LLM-tested** — CP2's own real cost was the thing to budget for. A
separate, isolated server instance (own port, own scratch cache file, real Ollama, never touching the
user's own long-running dev server) analysed the SAME chapter (`tp_17865786341910000220`, "Vittoria
Ingannevole") the `v83_n`→`v83_p` note already measured: **~13-14 minutes wall-clock for 4 sentences /
26 tokens** on this container's CPU-only inference (`ollama ps` showed `size_vram:0`) — consistent
with the prior "12+ minutes" finding, not a new problem. **Zero apparent wrong lemma/form/sense**
across all 26 tokens, matching the original run's 0/8 finding, PLUS 4 well-formed multi-word phrases
the earlier measurement didn't separately call out. The already-known gap (no function-word filtering
— bare `EIN` still surfaces as its own item) is unchanged, not a regression.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first, then
   item W's own section (now marked ✅ SHIPPED, with a pointer to the `v86_o` write-up) if you need the
   history, then the rest of the "OPEN AT THE v86 CUT" section, unchanged from `v86_n` otherwise.
3. `INTERNALS.md` **§6b** is current through `v86_g` for the comic-panel subsystem specifically — it
   has NOT yet been updated for item W's new server routes/client functions this cut; a future session
   should add a row for the CP1/CP2 browser-integration surface (`_runAnalysisJob`,
   `/api/analysis/:id`, `/api/analyze-chapter/:id`, `toggleTextExplorer` and friends) the same way the
   comic-panel subsystem's own rows work — not done this cut, flagged here so it isn't lost.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 289 checks
node test/run.js --quick                  → expect 249
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

⚠️ **One kind of "expected" failure can show up in a full run, NOT a regression, and it is
REPRODUCIBLE (not intermittent), inherited unchanged from `v86_m`/`v86_n`**: `unit-article-choices`,
which reads the LIVE `lessons.json` directly — one `it`-language article lesson somewhere in the live
corpus can't build a full 3-way MCQ. Still not investigated (three cuts running now) — cheap to
diagnose, the test itself names the failure mode; worth doing before or alongside whatever this
session picks up next.

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 701 `en` keys** — an inherently live
snapshot for the topic/storyline counts; re-measure fresh if `unit-roadmap-version` disagrees. `en`
keys grew by 9 this cut (`text_explorer.*`, all new UI strings for the text-explorer view — toggle
title, loading/analyzing/error status lines, lemma/form/sense/confidence labels). `lessons.json` was
never touched this cut (confirmed clean via `git status --short lessons.json` throughout, including
around the live-verification run — that ran against an ISOLATED server instance on a different port
with its own scratch cache file, specifically so it would never interact with the user's own real,
long-running dev server or its data). `APP_VERSION = 'v86_o'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46 standing rules, plus item 8-10 added at the `v86_n`
cut — see that file's own section for the reasoning behind each)

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable.**
3. **A guard that pins the EXACT ARGUMENTS/CONDITION of a call breaks on any legitimate change.**
4. **A test that reads the LIVE corpus directly can fail from the user's own real-time usage alone —
   but re-run it a few times before assuming that's the explanation.**
5. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
6. **A live model call needs a live test AND a real human reading the output.**
7. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** — a GENERATED build artifact (`docs/index.html`) can be freely rebuilt from safe,
   committed sources even when it independently shows as modified. New this cut, same spirit: a
   server-WRITTEN cache file (`canonical-analysis.json`, unlike the read-only `curriculum-plan.json`)
   needs its own scratch/isolated instance for any live-model verification, not the user's real one.
8. **When two roadmap items describe the same underlying capability from two different angles, check
   for overlap BEFORE scoping either one in isolation.**
9. **A track explicitly tagged "(multi-session)" in the roadmap is a standing judgment call already
   made — don't override it with same-session optimism without a real reason.**
10. **Small, mechanical, independently-testable groundwork is a reasonable thing to land in an
    otherwise-investigation-heavy session** — but once that groundwork exists, a FRESH session with a
    full budget can and should build the rest in one cut, as this one did.
11. **Mutation-test every guard you write or rely on — new, concrete evidence this cut**: a fetch
    orchestration guard (`_ensureTextExplorerData`'s "already in flight, don't refetch" check) looked
    correct on inspection and would have shipped broken (it matched the entry it had JUST created,
    short-circuiting the very first call) had the client test not actually exercised it end-to-end
    against a real fetch stub rather than just asserting the function exists and returns a promise.

# WHERE TO START

Item W is done. From the OLD prompt's own "WHERE TO START" list (unchanged, still open):

- **The `unit-article-choices` reproducible red** (inherited from `v86_m`, still not investigated
  across three cuts now) — cheap to diagnose, the test itself names the failure mode, worth doing
  first.
- **Item AE (mobile-backgrounding)** is still open — blocked on the user hitting it again with the
  `v86_j` diagnostic logging in place; do not attempt a fix without that console evidence in hand.
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

New from this cut, small and independently startable if wanted:
- **`INTERNALS.md` §6b** needs a row for item W's own new surface (see "Orient yourself" above) —
  doc-only, cheap.
- **Item W's own natural follow-up**: extend the text-explorer toggle to the question panel's own
  story view (`_exStoryPanelHtml`), which did not get it this cut (only the completion/progress card
  panel did, per the feature's original scope).

## Standing tools — use them

`INTERNALS.md` §6b has the full feature → function map — current through `v86_g` for the comic-panel
subsystem; other sections are kept current inline as each cut touches them.
