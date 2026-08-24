# Session prompt — written at the `v83_m` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_l.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_n`, `v83_o`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_m`** release —
`PLAN §7.0` CP5 made **VISIBLE**: a small, clearly-labelled "🧪 Experimental word analysis" row in
the progress card's nav popup, shown ONLY when CP1-4 has been run against that chapter (which is
almost none of the corpus by default). This is a direct follow-up to `v83_l`'s own CP5 (silent
shadow-mode wiring), upgraded per the user's own explicit choice after trying the silent version and
asking "what's next" — not a new migration stage.

**`v83_a`–`v83_g`, condensed**: `v83_a` cut this line from `v82`. `v83_b` shipped `PLAN §12` (the
text-selection tutor). `v83_c`–`v83_g` are one arc of progress-card/question-card follow-ups, ending
with the story panel's border shifting red→green with comprehension progress (`v83_g`) — **the SAME
border colour every CP5 test since `v83_l` proves stays untouched.** Full write-ups in
`roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE`.

**`v83_h`–`v83_l`, condensed — `PLAN §7.0` CP1–CP5, Track A's whole migration sequence so far**:
`v83_h` (CP1) shipped `canonical-text.js` — stable chapter→sentence→token records, deterministic, no
model call, committed `canonical-text.json` (24 chapters). `v83_i` (CP2) shipped
`canonical-analysis.js` on top — the ONLY model-in-the-loop stage: one real LLM call per sentence,
`confidence:'unresolved'` distinct from `'low'` for anything unanswered. `v83_j` (CP3) shipped
`curriculum-plan.js` — back to no model call, aggregates CP2's proposals into ordered `vocab`/
`phrase` concepts with prerequisites. `v83_k` (CP4) shipped `curriculum-lesson.js` — the first stage
to emit something lesson-shaped, proven playable through the REAL `buildStandardExercises`, but never
touching `lessons.json` and reachable by nothing. `v83_l` (CP5) was the FIRST stage to touch
`index.html`/`server.js` at all: a new read-only `GET /api/cp-shadow/:chapterId` route (server.js
requiring `curriculum-plan.js`'s `compareWithExistingLessons` directly — the safe direction) and a
fire-and-forget client hook, `refreshCp5Shadow`, wired into `showComplete()`. **Asked the user
directly before building `v83_l`** whether CP5 should be silent or visible — silent was chosen then;
`v83_m` (this release) is the visible follow-up, asked for separately, later. `ui.json` needed no
special handling since `v83_j` — the user's own `translate-ui.js` pass landed as its own commit
(`2aba0d3`) between `v83_i` and `v83_j`.

**`v83_m`, in brief**: `#comp-cp5-row` (inside `#comp-nav-modal`, NOT the main card). Two correctness
properties the silent version never needed: (1) the row must reset SYNCHRONOUSLY on every
`showComplete()` render, BEFORE the async lookup starts — the popup's DOM persists across an in-app
navigation, so a stale row from a chapter that HAD data would otherwise keep showing on a different
chapter that has none; (2) a response that resolves LATE, after the learner has navigated to a
different chapter, must never paint onto the wrong chapter's row — `_renderCp5Row` checks
`cp.chapterId` against `APP.lessonData`'s CURRENT id before touching anything. Both mutation-tested
RED when removed. **A real bug caught by an EXISTING standing guard**: the first version of the reset
used a bare `catch(_) {}`, which `unit-card-errors.test.js`'s `v77_b`-era "no silent catch survives in
showComplete" structural check correctly flagged RED — fixed to the same `_cardNote(...)` convention
every other `try`/`catch` in that function already uses. **Worth remembering: run the FULL suite, not
just your own new test, before calling a change done** — this was caught by someone else's guard, not
mine.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`…`v83_m` were built, and
   `PLAN §7.0`'s own migration sequence (§0, "THE LARGER PLAN" section) before touching CP6.
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 259 checks
node test/run.js --quick                  → expect 228
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 659 `en` keys** (two new keys this
release: `complete.cp5_label`, `complete.cp5_summary` — the FIRST user-facing strings the whole `PLAN
§7.0` line has ever needed). Four CP-pipeline files exist alongside `lessons.json`, none part of its
schema: `canonical-text.json` (CP1, COMMITTED, 24 chapters); `canonical-analysis.json` (CP2),
`curriculum-plan.json` (CP3), `curriculum-lesson.json` (CP4) — none of the latter three committed by
default. **`#comp-cp5-row` will show NOTHING for virtually every chapter you open** — that is correct,
not a bug; see the `v83_l`/`v83_m` write-ups for how to generate real data for one chapter to see it
render (run the CP1→CP2→CP3 CLI chain into a scratch dir, point `CURRICULUM_PLAN_FILE` at the result
when starting the server).
`APP_VERSION = 'v83_m'`.

⚠️ **A pre-existing, UNRELATED flake was observed during this release's own full-suite run**:
`e2e-teacher-dashboard` failed ONCE in the full sequential run, then passed cleanly 5/5 times in
isolation immediately after. Nothing about its own test touches the progress card or CP5. Not chased
— flagged here per the project's own flaky-test protocol, in case it recurs and is worth a closer
look at that point.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past
`v83_f`** — check its reported version against `APP_VERSION` before assuming it's current, and ask
before restarting it.

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
2. **Guard at the layer where the claim is observable** (rule 34). `v83_l`'s addition: an ASYNC
   side-channel's "this changes nothing" claim must be checked with the test AWAITING the async work.
   `v83_m`'s own reminder: **a change you believe is done still needs the FULL suite run, not just
   your own new test** — `unit-card-errors.test.js`'s pre-existing structural guard caught a real bug
   (`catch(_) {}` in new code) that this release's own brand-new test never would have.
2b/2c. Rewrite superseded invariants explicitly (don't just loosen — `v83_m`'s §5 rewrite is the
   freshest example); extract shared logic on a second use.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`).
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`).
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc — `v83_m`
   used a `\U0001f9ea` escape inside a Python JSON-rewrite script instead, for the SAME reason.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`,
   `v83_i`). CP3–CP5 all make NO model call.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
9. **A test file's `--write`/output path must never be the real, COMMITTED artifact** (`v83_h`).
10. **Mutation-testing a `--write` CLI must redirect BOTH input and output to scratch copies BEFORE
   mutating** (`v83_i`, incident; `v83_j`/`v83_k`, applied correctly).
11. **When a change is the FIRST of its kind to touch the live app (even read-only), ASK how far it
   should go before building** (`v83_l`) — and when the user LATER asks for the other option (`v83_m`
   picking up the "visible" branch declined at `v83_l`), that is a full, separate scoping decision
   with its own new correctness properties (the reset/stale-chapter guards), not a trivial toggle.

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
curriculum plan, one parallel-route lesson family, and a (now visible, opt-in) shadow read against
the progress card — nothing gated, nothing retired. CP6 is last: *"retire nothing by assumption.
Consider retiring legacy generation only after the new route has measured multilingual coverage,
quality, recovery/re-analysis, and player compatibility."* **This is explicitly NOT "build CP6 now"**
— the plan's own text is a CONDITION, not a next implementation slice. There is currently NO measured
evidence at scale (CP1's sample is 24 chapters in 14 languages; CP2–5 have never run beyond small test
fixtures). **The honest next conversation, if continuing, is "what would it take to gather that
evidence" — likely a real, paid CP2/CP4 run over a much larger sample — not code to write.** Do not
start ANY retirement work without an explicit, separate product ruling.

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
  `cyrillic-sr` table** — the MAIN `en`-only-key translate pass finished and landed at `v83_j`.
- **A device pass on the WHOLE `v81_a`…`v81_ad` UI-redesign arc — never done by the user.**
- **A device pass on the WHOLE `v83_b`…`v83_g` progress-card/question-card arc, AND now `v83_m`'s
  new CP5 row** — every check so far is an AGENT's browser pass, not the user's own.

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

- **`canonical-text.js`/`build-canonical-text.js`** (`v83_h`, CP1) — no model call. Committed output.
- **`canonical-analysis.js`/`build-canonical-analysis.js`** (`v83_i`, CP2) — model-in-the-loop.
- **`curriculum-plan.js`/`build-curriculum-plan.js`** (`v83_j`, CP3) — no model call.
- **`curriculum-lesson.js`/`build-curriculum-lesson.js`** (`v83_k`, CP4) — no model call, never
  writes `lessons.json`. Do NOT `require` server.js from ANY of the four standalone CP files.
- **`GET /api/cp-shadow/:chapterId`** / `cp5ShadowFor` (server.js, `v83_l`) — READ-ONLY, reads
  `CURRICULUM_PLAN_FILE` (env-overridable). Uses `curriculum-plan.js`'s `compareWithExistingLessons`.
- **`refreshCp5Shadow(d)` / `_cp5ShadowStore()` / `_renderCp5Row(cp)`** (index.html, `v83_l`/`v83_m`)
  — fire-and-forget. Writes `APP.progress.cp5Shadow` always; paints `#comp-cp5-row` (nav popup) ONLY
  when data is available AND the chapter is still the one currently open. Reset happens SYNCHRONOUSLY
  in `showComplete()`, inline, before the async lookup starts.
- `test/lib.js`'s `boot({ log, seed, extraEnv })` — `extraEnv` (`v83_l`) merges into the spawned
  server's env, for env-configurable inputs that don't get their own per-boot isolated file.
- `probe_gates_v80c1.js` — the `PLAN §C1` gate probe. Reports, does not assert.
- `probe_gates_v77.js` — re-run **and diff** after any progress-card change. **⚠️ It SELECTS its
  chapters from the corpus, so a data drop moves the selection.** Baseline: `v80i_card_gates.txt`.
- `probe_word_green_impact_v81d.js` — what TRACK T's colouring paints. `PROBE_CLIENT=` diffs builds.
- `probe_word_green_v81c.js` — declared probe keys vs the BUILDABLE universe (60.8% at `v81_d`).
- `probe_comp_skip_v81c.js` — drives `showComplete(true)` over every later chapter and CLICKS
  `comp-next`. Unaffected by `v83_c`'s popup relocation.
- `probe_tap_reachable_v81d.js` — highlighted words whose tap resolves to nothing.
- `probe_learner_known_v80l.js` — the older colouring probe. ⚠️ RE-DERIVES the colouring inline.
- `probe_inflection_v80f.js`, `probe_article_symmetry_v80j.js`, `probe_lesson_script_v80h.js`,
  `probe_word_forms_defects_v80g.js`, `probe_forks_v79k.js`, `probe_coverage_v78n.js`.
  **All report; none assert.**
- `_cardErrors()` — assert it is empty after any card render you add. `unit-card-errors.test.js`'s
  own structural check (no silent `catch(_){}` inside `showComplete`) will catch a bare catch too.
- `_storyBodyHtml(d, opts)` — **the ONE story renderer**. Fill-height chain REVOKED at `v83_f`.
- `_exStoryPanelHtml(ex)` — question/exercise screens' own panel. Collapsed by default since `v83_f`.
- `_sumCoverageFrac(rows)` / `_redGreenHex(frac)` (`v83_g`) — the progress card's border colour.
  `v83_l`/`v83_m` both proved CP5 never influences it, even with the new visible row.
- `buildStandardExercises(lesson, lessonIdx)` (client, `index.html`) — the REAL exercise builder for
  `type:'standard'` lessons. `v83_k` proved a CP4-emitted lesson plays through it unmodified.
- `_tutorGatherContext()` / `/api/tutor` — `uiLang` (reply language) ADDITIVE alongside `srcLang`.
- `openCompNav()`/`closeCompNav()`/`openSumNav()`/`closeSumNav()`/`_closeCardNavPopups()` (`v83_c`/
  `v83_d`) — one popup per card. `#comp-cp5-row` lives inside `#comp-nav-modal`.
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path, the DIRECT template CP5's shadow (`v83_l`) was built to mirror.
