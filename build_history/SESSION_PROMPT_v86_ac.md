# Session prompt — written at the `v86_ac` cut

*(Rename this file for the version the session WRAPS UP WITH — `git mv` + edit, never keep the old
one alongside. Keep using the double-letter suffix scheme (`v86_ad`, `v86_ae`, …) unless a future
session has a good reason to switch to `v87_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Picking up from **`v86_ac`**. `v86_aa`/`v86_ab` fixed
two real prompt-compliance bugs in the text-explorer/inflections pipeline. This cut (`v86_ac`) is the
natural follow-up: once a prompt is fixed, a chapter analysed under the OLD prompt needs a way to be
redone.

**IMPORTANT — the user is now translating `ui.json` locally, by hand.** Before adding or editing ANY
`en` key, tell them explicitly and let them pause first — do not silently edit `ui.json` mid-session.

**What shipped this cut (`v86_ac`)**:

User: *"In teacher mode on the lesson-set card, I expected to be able to generate the text analysis
annotation, but I can't find it. Also there should be a way to re-generate it, e.g. now that the
prompt has changed, I want to delete the old and re-generate a new text analysis annotation for
`tp_17880367188140000070`."* Then, converging independently on the exact design shipped: *"We can
just use the same button, but reroute via a warning that this would override an existing text
annotation."*

The "can't find it" half needed no code: the 🔤 button (`analyzeChaptersRun`, `v86_p`) already existed
on the lesson-set card, gated only on `canGenerate && s.id` — genuinely reachable, just a small icon
among several. The "re-generate" half: `POST /api/analyze-chapter/:chapterId` now accepts
`{force:true}`, which a new `deleteAnalysisChapter()` uses to clear the cached CP2 result FIRST, so
the route's existing short-circuit naturally re-runs it. Client-side, a SINGLE-chapter
`analyzeChaptersRun` call now pre-checks `GET /api/analysis/:id`; if already analysed, `confirm()`s
before sending `{force:true}` — decline makes NO server call at all. A multi-chapter BATCH call is
unchanged (no pre-check, no confirm, silent skip-if-cached) — the SAME button now does double duty,
directly resolving both halves of the report with the one control the user already knew to look for.

## Orient yourself, in this order

1. **This file**, whole.
2. `build_history/roadmap_v86.md` — its **index table** and **⚠️ Session protocol** block first. This
   cut's own section (`v86_ac`) plus `v86_aa`/`v86_ab` for the two related prompt-compliance fixes it
   follows up on; `v86_v`-`v86_z` for the rest of this session's comic-panel/text-explorer history.
3. `INTERNALS.md` **§6b** is current through `v86_s` for item W's whole CP1/CP2 browser-integration
   surface; the comic-panel subsystem's own row predates `v86_o` and needs another catch-up pass
   (last done through `v86_x`) — the `v86_z`/`v86_aa`/`v86_ab`/`v86_ac` additions are not in there.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 298 checks
node test/run.js --quick                  → expect 255
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

`unit-observations-log` is a KNOWN pre-existing intermittent flake (documented since `v81_b`/`v86_b`)
— reproduce standalone 5-10× before treating a failure there as real. `unit-ui-journeys`/
`unit-word-progress`/`unit-tap-word` have each flaked once in earlier cuts THIS session too, all
confirmed pre-existing/unrelated (`buildExercises`'s own corpus-sampling randomness).

Corpus at this cut: **336 topics, 97 storylines, 33 languages, 714 `en` keys** — one new `en` key
this cut (`text_explorer.confirm_reanalyze`); the OTHER 33 languages do NOT have it yet — **the user
is translating `ui.json` locally by hand right now**, so do not assume a missing non-`en` key for
this string is a bug to fix; it is expected until they get to it. Topic/storyline counts are an
inherently live snapshot (the user's own live server generates content concurrently — re-measure
fresh at commit time if `unit-roadmap-version` disagrees; no drift observed between `v86_ab` and
`v86_ac`'s own commits). `docs/index.html` rebuilt (client code change + the new `en` key).
`lessons.json`/`canonical-analysis.json` untouched by this cut's own edits. `APP_VERSION = 'v86_ac'`.

> **The baseline block and corpus numbers above are GUARDED** by `unit-roadmap-version` against the
> actual suite and the data files. **If that test fails, the number in THIS file is the thing to
> fix**, not the guard.

## The habits that cost this project the most (full incident history: `roadmap_v85.md`'s "Rules
earned in session N…the v85 line" blocks — now 46+ standing rules, plus items added at the `v86_v`-
`v86_ac` cuts — see those releases' own sections for the reasoning)

1. **When a user reports "I can't find X," check whether X already exists and is just easy to miss
   before adding new UI** — the 🔤 button was already there, correctly gated; the real, valuable fix
   was making it do MORE (double as re-analyze), not adding a second control next to it.
2. **The user may independently converge on the exact design you were about to propose** — when that
   happens, build what they said, don't re-derive or re-pitch your own version first.
3. **A "delete then let the existing short-circuit re-run it" design needs no new branch in the main
   code path** — `deleteAnalysisChapter()` + the UNCHANGED `shadow.available` check downstream is
   simpler and less risky than a parallel "force" branch duplicating the job-kickoff logic.
4. **A destructive single-chapter action reachable from a button also used for safe batch operations
   needs its OWN confirm gate, scoped ONLY to the single-item case** — a batch call must stay silent,
   or looping a confirm() per item becomes its own bug.
5. **When ui.json is being hand-edited by the user concurrently, treat missing non-en translations
   for a brand-new key as expected, not a defect** — and always tell them before adding a new `en`
   key, giving them a chance to pause first.
6. **A live interactive click-through is not always possible or necessary** — when no LLM backend is
   reachable in the sandbox, say so plainly rather than skipping verification silently; mutation-tested
   unit + real-server e2e coverage of the exact same code paths is the honest substitute, not a
   downgrade to pretend didn't happen.
7. **Mutation-test every guard you write or rely on.**

# WHERE TO START

- **A possible follow-up refinement, NOT built**: constrain inflection wrong-choice generation so a
  distractor category must genuinely apply to the TARGET language's own morphology (found via the
  "datief" report at `v86_ab` — Dutch has no noun case at all). Needs a product decision on scope.
- **The 3 chapters cached in `canonical-analysis.json` still have stale English `"form"` values**
  from before `v86_aa`'s fix. The user can now re-analyse `tp_17880367188140000070` themselves via
  this cut's own confirm-gated 🔤 button — no code action needed, just noting it's finally possible.
- **Item AG (CP2 enrichment — clitic pronouns, explanation field)** — scoped, needs a prompt-design
  decision and a live-model measurement before any code ships.
- **Item AH (three CP2 speed/reuse ideas, evaluated)** — recommendation is "hint, not skip"; needs a
  product decision on which mode(s) to build.
- **Item AI (teacher/curator-editable CP1/CP2 analysis)** — scoped, one open design question
  flagged (does a correction survive a chapter re-analysis? no, today); not started.
- **`INTERNALS.md`'s comic-panel subsystem row** needs `v86_v`-`v86_ac`'s own additions added —
  cheap, doc-only, keeps accumulating faster than it gets caught up (last full pass was through
  `v86_x`).
- **The wizard-page alternative for the review card** — explicitly NOT chosen at `v86_x`; revisit
  only if asked specifically.
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

`INTERNALS.md` §6b has the full feature → function map — current through `v86_s` for item W's whole
CP1/CP2 browser-integration surface; the comic-panel subsystem's own row predates `v86_o` and needs
another catch-up pass (last full pass through `v86_x`); other sections are kept current inline as
each cut touches them.
