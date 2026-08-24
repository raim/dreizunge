# Session prompt — written at the `v83_l` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_k.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_m`, `v83_n`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_l`** release —
`PLAN §7.0` **CP5**: silent shadow-mode consumption of the curriculum plan. **The FIRST CP stage that
touches `index.html`/`server.js` at all** — CP1–4 were entirely standalone files nothing loaded — but
still ZERO visible effect, by explicit user ruling (asked directly, since this stage's risk profile
is genuinely different from CP1–4's pure backend work): mirror the project's own already-shipped
B4/BKT shadow pattern, not a visible signal. Proven byte-identical rendering with/without CP data
available, checked against real rendered output, not assumed.

**`v83_a`–`v83_g`, condensed** (full write-ups in `roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE` —
read there before touching ANY of this): `v83_a` cut this base line from `v82` to hand off `PLAN
§12`. `v83_b` shipped `PLAN §12` (the text-selection tutor) whole. `v83_c`–`v83_g` are one continuous
arc of user follow-ups on the progress card and question cards, ending with the story panel's border
shifting red→green with comprehension-specific progress (`v83_g`) — **this is the SAME border colour
`v83_l`'s own test now proves CP5 never touches.**

**`v83_h`–`v83_k`, condensed — `PLAN §7.0` CP1–CP4, all report-only or inert, standing on each
other**: `v83_h` shipped `canonical-text.js` — stable chapter→sentence→token records (committed
`canonical-text.json`, 24 chapters), deterministic, no model call. `v83_i` shipped
`canonical-analysis.js` on top — the ONLY model-in-the-loop stage so far: one real LLM call per
sentence proposing lemma/form/sense, with `confidence:'unresolved'` distinct from `'low'` for
anything the model never answered. `v83_j` shipped `curriculum-plan.js` on top of that — back to no
model call: aggregates CP2's proposals into ordered `vocab`/`phrase` concepts with prerequisites.
`v83_k` shipped `curriculum-lesson.js` on top of THAT — the first stage to emit something
LESSON-shaped, proven playable by running it through the REAL, unmodified `buildStandardExercises`,
but still never touching `lessons.json` and reachable by nothing. `ui.json` needed no special
handling since `v83_j` — the user's own `translate-ui.js` pass finished and landed as its OWN commit
(`2aba0d3`) between `v83_i` and `v83_j`.

**`v83_l`, in brief**: *"ok, continue"* confirmed proceeding to CP5; then, because CP5 is the first
stage with ANY live-app surface, a scoping question was asked before building rather than guessed:
silent shadow-mode wiring (chosen) vs. visibly surfacing something. **What shipped**: a new READ-ONLY
`GET /api/cp-shadow/:chapterId` route (server.js) — `cp5ShadowFor(chapterId)` reads a new
env-overridable `CURRICULUM_PLAN_FILE` fresh from disk each call (no hot-reload — this artifact isn't
live-edited), returns `{available:false}` for the (overwhelmingly common) case of an unanalysed
chapter, and reuses `curriculum-plan.js`'s OWN `compareWithExistingLessons` for a real comparison
when data exists. server.js requiring a CP-stage file is the OPPOSITE direction of the "don't require
server.js" constraint those files carry — the same already-established pattern as requiring `llm.js`.
Client-side, `refreshCp5Shadow(d)` (index.html) is fire-and-forget, hooked into `showComplete()`
right after the `v83_g` border-colour block, records into a new `APP.progress.cp5Shadow` store
(mirroring `bktShadow`'s shape) on success, and is a PROVABLE no-op — no store write, no `saveProg`
call, never throws — on every degenerate case (unavailable, failed fetch, offline/static build, no
`APP.progress` yet).

**A real mutation-testing gap, found and fixed while building THIS release's own test**: the first
draft of the "renders identically" proof read DOM state synchronously right after `showComplete()`
returned — a deliberate mutation writing into the border colour from inside the fire-and-forget
fetch's `.then()` callback PASSED ANYWAY, because that callback runs on a later tick than the test
checked. Fixed by `await settle()`-ing before capturing state in both renders; re-run against the
same mutation, correctly RED afterward. **Any future test of an async side-channel's "this doesn't
change anything" claim must actually wait for the async work, not just avoid triggering it.**

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`…`v83_l` were built, and
   `PLAN §7.0`'s own migration sequence (§0, "THE LARGER PLAN" section) before touching CP6.
   (Nothing is in TRACK T right now — steps 1–4 and `§T7` all shipped in the v81 line.)
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 259 checks
node test/run.js --quick                  → expect 228
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 657 `en` keys** (unchanged since
`v83_c`). FOUR CP-pipeline files exist alongside `lessons.json`, none part of its schema:
**`canonical-text.json`** (CP1, COMMITTED — 24 chapters); **`canonical-analysis.json`** (CP2),
**`curriculum-plan.json`** (CP3), **`curriculum-lesson.json`** (CP4) — none of the latter three
committed by default. `v83_l` adds NO new data file — CP5 reads `curriculum-plan.json` if and only if
it exists (it does not, by default), and its own new client-side store (`APP.progress.cp5Shadow`) is
per-learner runtime state, not a repo file. **CP5's shadow read is silent and invisible** — do not
expect to SEE anything different in the app; verify it by reading `APP.progress.cp5Shadow` in
devtools or by re-running `unit-cp5-shadow.test.js`, not by looking at the screen.
`APP_VERSION = 'v83_l'`.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past
`v83_f`** — check its reported version against `APP_VERSION` before assuming it's current, and ask
before restarting it (their own terminal, their own call, per `v83_g`'s own exchange on this).

> **These four expectations and the four corpus numbers are GUARDED** by `unit-roadmap-version`
> against the actual suite and against the data files. **If that test fails, the number in THIS file
> is the thing to fix.**

- `unit-static-freshness` red → `node build-static.js`. **Read what it NAMES first.**
- `unit-script-choice` red saying topics are unstamped → `node backfill-script.js --write`.
- **Order matters: backfill FIRST, build-static SECOND.** A fixer is not a diagnosis (rule 23).

## The habits that cost this project the most

*(Full incident history for each numbered rule lives in `roadmap_v82.md`'s "Rules earned in session
N" blocks — this is the short form, not a replacement for reading those before citing one.)*

1. **Measure before editing.** A warning in the notes is a claim about a DESIGN, not about the
   problem (rule 35).
2. **Guard at the layer where the claim is observable** (rule 34). `v83_k`'s version: "validate it"
   proven by running a lesson through the REAL client exercise builder. **`v83_l`'s own addition: an
   ASYNC side-channel's "this changes nothing" claim must be checked with the test AWAITING the async
   work, not read synchronously before it lands** — a real mutation-testing gap this release found
   and fixed in its own test, not a hypothetical.
2b/2c. Rewrite superseded invariants explicitly; extract shared logic on a second use.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`).
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`).
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`,
   `v83_i`). CP3–CP5 all make NO model call — say so explicitly and test that they don't.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** A THROWAWAY server on a spare port is the reusable pattern for any live check.
9. **A test file's `--write`/output path must never be the real, COMMITTED artifact** (`v83_h`) —
   every CP1–4 CLI gained `--out`/`--in`.
10. **Mutation-testing a `--write` CLI must redirect BOTH input and output to scratch copies BEFORE
   mutating** (`v83_i`, incident; `v83_j`/`v83_k`, applied correctly). CP5 has no write path at all
   (a GET-only route), so this specific rule did not apply, but its SIBLING did (rule 2 above).
11. **When a change is the FIRST of its kind to touch the live app (even read-only), ASK how far it
   should go before building** (`v83_l`, new) — CP1–4 were unambiguous (standalone, inert, report-
   only); CP5 genuinely had two reasonable shapes (silent vs. visible), and the user's own answer
   changed the entire implementation. Don't infer a UI-facing scope decision from a terse "continue".

---

# WHERE TO START

## 1. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 2. `test/lib-dom.js`'s `textContent` ordering bug — a fix is IN PROGRESS, elsewhere

Found while building `v83_b`'s own test: trailing text after a child element comes back
mis-ordered. **The user has since started that task in a separate session.** Check whether it has
landed before touching this yourself.

## 3. `PLAN §7.0` CP6 — the LAST slice, if the user wants to continue Track A

CP1–CP5 are done: stable records, lemma/form/phrase/sense/frequency/script proposals, a proposed
curriculum plan, ONE parallel-route lesson family, and a silent shadow-mode read against the progress
card — nothing visible, nothing gated, nothing retired. CP6 is last: *"retire nothing by assumption.
Consider retiring legacy generation only after the new route has measured multilingual coverage,
quality, recovery/re-analysis, and player compatibility."* **This is explicitly NOT "build CP6 now"**
— the plan's own text is a CONDITION ("only after... measured"), not a next implementation slice the
way CP1–5 each were. Track A's own report-only/inert nature this whole line means there is currently
**no measured evidence** of multilingual coverage or quality to retire anything against — CP1's
sample is 24 chapters in 14 languages, CP2–5 have never been run at scale. **The honest next
conversation with the user, if they want to keep going, is "what would it take to gather that
evidence" — likely a real, paid CP2/CP4 run over a much larger sample — not code to write.** Do not
start ANY retirement work without an explicit, separate product ruling; the plan is unusually
explicit that this is a LATER, conditional decision, not a queued slice.

## 4. BUILDABLE NOW, no ruling needed

- **`PLAN §C1`'s FIRST gate bug** — *"browsed forward to the story card and back, solved no
  comprehension lesson, yet could proceed."* **⚠️ THREE readings are already DEAD ENDS** — see the
  `v80_b` entry in `roadmap_v80.md` and the `v81_j` addendum in `roadmap_v81.md`. **What is still
  unmodelled is the "Back LINK" specifically** — get the exact click sequence from the user first.
- **The dead-taps HIGHLIGHTING question** — closed to zero for the tap itself (`v81_f`+`v81_h`), but
  **should the story panel mark a word at all when its ONLY teaching lesson is hidden?** Needs a
  ruling. `probe_tap_reachable_v81d.js` measures it.
- **`PLAN §F2`'s second half** — the "answer visible in the stem" detector, measured and deliberately
  left unenforced. Reported by `probe_word_forms_defects_v80g.js`.
- **`PLAN §D4`'s one measured rough edge** — a minor, low-priority prompt-compliance gap in
  `writing`'s content-vs-language-issue grading. See `roadmap_v82.md`'s `v82_f` entry.

## 5. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — the article prompt fix shipped at `v80_j`, **UNVERIFIED BY DESIGN**. Regenerate
  MANY lessons, re-run `probe_article_symmetry_v80j.js` against its baseline (1.0% overall, BIMODAL).
- **`translate-ui.js --langnames`, the `hr` `ui.json` pass, and a native-speaker check of the
  `cyrillic-sr` table** — the MAIN `en`-only-key translate pass finished and landed at `v83_j`
  (commit `2aba0d3`); these smaller items are still open.
- **A device pass on the WHOLE `v81_a`…`v81_ad` UI-redesign arc — never done by the user.**
- **A device pass on the WHOLE `v83_b`…`v83_g` progress-card/question-card arc** — every check so
  far is an AGENT's browser pass, not the user's own.

## 6. NOT yours to start

Import "new" mode is POSTPONED. **Track A's CP1–5 (`PLAN §7.0`) is DONE, shipped this line; CP6 is a
CONDITIONAL, not a queued slice — see §3 above.** **Mastery-driven progression (`PLAN §9b/D2`)
remains a user product decision.** The learner/teacher rework — `_canEdit()` is done; `Edit / rename
topic` stays visible by user ruling.

**⚠️ THE TRACK T COLOURING NUMBERS MOVED AT `v81_d`** — GREEN 18.6% → **27.8%**, PARTIAL 19.5% →
**11.8%**, mean questions per word 2.20 → **1.79**. **No ruling is reversed; none may be re-opened
without re-measuring** via `probe_word_green_impact_v81d.js`.

**Do not re-derive the per-text learning scheme measurements.** A chapter's lessons teach **9.2% of
its story's tokens, 8.2% of its distinct words**, rarest words least covered (**5.1%**). Inflection
share: **47.3% of taught words findable in the story, 36.4% ABSENT in any form** — **the ceiling is a
GENERATION problem.**

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b** — it is the permanent,
actively-maintained function map. This prompt only keeps the probe scripts, quick reference not
duplicated in INTERNALS.md.

- **`canonical-text.js` / `build-canonical-text.js`** (`v83_h`, CP1) — pure core + CLI, no model
  call. `canonical-text.json` is COMMITTED (24 chapters).
- **`canonical-analysis.js` / `build-canonical-analysis.js`** (`v83_i`, CP2) — model-in-the-loop core
  (via `llm.js`) + CLI. Output NOT committed by default.
- **`curriculum-plan.js` / `build-curriculum-plan.js`** (`v83_j`, CP3) — deterministic core (NO model
  call) + CLI. Reads CP2's output, `lessons.json` read-only for comparison. Output NOT committed.
- **`curriculum-lesson.js` / `build-curriculum-lesson.js`** (`v83_k`, CP4) — deterministic core (NO
  model call) + CLI. Reads CP3's output. NEVER writes `lessons.json`. Output NOT committed, read by
  nothing.
- **`GET /api/cp-shadow/:chapterId`** / `cp5ShadowFor` (server.js, `v83_l`, CP5) — READ-ONLY, reads
  `CURRICULUM_PLAN_FILE` (env-overridable). Uses `curriculum-plan.js`'s `compareWithExistingLessons`
  directly (server.js requiring a CP file is the SAFE direction — the reverse is forbidden).
- **`refreshCp5Shadow(d)` / `_cp5ShadowStore()`** (index.html, `v83_l`) — fire-and-forget, hooked
  into `showComplete()`. Writes `APP.progress.cp5Shadow` only, never the DOM. Do NOT `require`
  server.js from ANY of the four standalone CP files (binds a port as a side effect); server.js
  requiring one of THEM is fine, already established for `llm.js` and now `curriculum-plan.js` too.
- `test/lib.js`'s `boot({ log, seed, extraEnv })` — `extraEnv` (`v83_l`, new) merges into the spawned
  server's env, for env-configurable inputs that don't get their own per-boot isolated file.
- `probe_gates_v80c1.js` — the `PLAN §C1` gate probe. Reports, does not assert.
- `probe_gates_v77.js` — re-run **and diff** after any progress-card change. **⚠️ It SELECTS its
  chapters from the corpus, so a data drop moves the selection.** Baseline: `v80i_card_gates.txt`.
- `probe_word_green_impact_v81d.js` — what TRACK T's colouring paints, through `_wordProgress` /
  `_wordState`. `PROBE_CLIENT=` diffs two builds.
- `probe_word_green_v81c.js` — declared probe keys vs the BUILDABLE universe (60.8% at `v81_d`).
- `probe_comp_skip_v81c.js` — drives `showComplete(true)` over every later chapter and CLICKS
  `comp-next`. Unaffected by `v83_c`'s popup relocation (same id, same onclick).
- `probe_tap_reachable_v81d.js` — highlighted words whose tap resolves to nothing.
- `probe_learner_known_v80l.js` — the older colouring probe. ⚠️ RE-DERIVES the colouring inline.
- `probe_inflection_v80f.js`, `probe_article_symmetry_v80j.js`, `probe_lesson_script_v80h.js`,
  `probe_word_forms_defects_v80g.js`, `probe_forks_v79k.js`, `probe_coverage_v78n.js`.
  **All report; none assert.**
- `_cardErrors()` — assert it is empty after any card render you add.
- `_storyBodyHtml(d, opts)` — **the ONE story renderer**. Fill-height chain REVOKED at `v83_f`.
- `_exStoryPanelHtml(ex)` — question/exercise screens' own panel. Collapsed by default since `v83_f`.
- `_sumCoverageFrac(rows)` / `_redGreenHex(frac)` (`v83_g`) — the progress card's border colour.
  `v83_l`'s CP5 shadow is proven to never influence this.
- `buildStandardExercises(lesson, lessonIdx)` (client, `index.html`) — the REAL exercise builder for
  `type:'standard'` lessons. `v83_k` proved a CP4-emitted lesson plays through it unmodified.
- `_tutorGatherContext()` / `/api/tutor` — `uiLang` (reply language) ADDITIVE alongside `srcLang`.
- `openCompNav()`/`closeCompNav()`/`openSumNav()`/`closeSumNav()`/`_closeCardNavPopups()` (`v83_c`/
  `v83_d`) — one popup per card.
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path, the DIRECT template `v83_l`'s CP5 shadow was built to mirror.
