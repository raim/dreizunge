# Session prompt — written at the `v83_o` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_n.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_p`, `v83_q`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_o`** release —
a BUG FIX, found by the user running `apply-cp-lessons.js` for real: `canonical-analysis.js`'s
`analyzeSentence` (CP2) now sends `think:false` on every model call. Without it, a reasoning-capable
model (the user hit this with `qwen3.6:35b-a3b`) burns its whole token budget "thinking" and the call
fails with `Ollama returned empty response` — the EXACT, already-diagnosed `v71_o` bug this project's
OWN legacy generator solved years ago (`server.js`'s `OLLAMA_THINK` table), which CP2 had simply
never adopted because it was built and tested only against the fake-Ollama harness, which cannot
simulate a reasoning model at all.

**`v83_h`–`v83_n`, condensed — the whole `PLAN §7.0` arc so far**: CP1 (`v83_h`) — stable text
records, no model call. CP2 (`v83_i`) — the model-in-the-loop stage, one real LLM call per sentence
(now bug-fixed at `v83_o`). CP3 (`v83_j`) — curriculum plan, no model call. CP4 (`v83_k`) — one
lesson family, proven playable, still unreachable by anyone. CP5 (`v83_l` silent, `v83_m` visible) —
the FIRST stage to touch `index.html`/`server.js`, a small "🧪 Experimental" row in the progress
card's nav popup. `apply-cp-lessons.js` (`v83_n`) — the FIRST script that WRITES real, additive,
`_pipeline:'cp4'`-tagged lessons into `lessons.json`, with cross-chapter dedup. A separate,
code-free roadmap note (between `v83_m` and `v83_n`) distinguishes that SIMPLE dedup from the harder,
explicitly-deferred "genuine cross-chapter curriculum sequencing." Full write-ups in
`roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE`.

**`v83_o`'s own fix, plus what it caught**: `unit-canonical-analysis.test.js` gained a §10 that
inspects the ACTUAL HTTP request body via `fake-ollama.js`'s own request log to confirm `think:false`
is really on the wire — mutation-tested (removing it goes RED). **A separate, useful side-finding
while checking the full suite after the fix**: `unit-replay-focus.test.js` failed, but only because
the user's own uncommitted, locally-generated CP4 test lesson (still sitting in THEIR `lessons.json`
from evaluating `v83_n`) has an unusual shape (`sentences: []`, several rare/function-word items) that
perturbs that test's corpus-wide simulation. Confirmed NOT a `v83_o` regression (reverting
`lessons.json` to committed state makes it pass again) — `lessons.json` is excluded from the `v83_o`
commit entirely, same treatment `ui.json` got at `v83_h`/`v83_i`. **If a CP4-pipeline lesson is EVER
considered for permanent inclusion, it may need to be a nicer fixture first** — real sentences, fewer
rare/function-word-only items — before the rest of the suite can assume its shape.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted CP4-pipeline evaluation data (see above) — not
yours to revert, commit, or "fix" without asking. Ask what they want done with it before touching it.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`…`v83_o` were built, and
   `PLAN §7.0`'s own migration sequence (§0) — **including the multi-chapter note right after the
   migration sequence list**, before touching any further multi-chapter work.
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 260 checks
node test/run.js --quick                  → expect 228
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 659 `en` keys** (unchanged since
`v83_m`). Five CP-pipeline files exist alongside `lessons.json`: `canonical-text.json` (CP1,
COMMITTED, 24 chapters); `canonical-analysis.json` (CP2), `curriculum-plan.json` (CP3),
`curriculum-lesson.json` (CP4) — none committed by default. `apply-cp-lessons.js` (`v83_n`) is the
ONLY thing that can add a real lesson to `lessons.json`, only with explicit `--write`.
`APP_VERSION = 'v83_o'`.

⚠️ **`node test/run.js` will show a red `unit-replay-focus` (or similar corpus-shape-sensitive test)
if the user's own uncommitted CP4 test lesson is present in `lessons.json` at the time** — this is
NOT a code regression; verify by checking `git diff --stat lessons.json` first, and if it's non-empty,
that is very likely why. Do not "fix" the test to tolerate that shape without being asked to.

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

1. **Measure before editing.**
2. **Guard at the layer where the claim is observable** (rule 34). `v83_o`'s version: the `think:false`
   fix was verified by inspecting the ACTUAL HTTP REQUEST BODY (via fake-ollama.js's own request log),
   not by reading the source and trusting the argument was passed through correctly.
2b/2c. Rewrite superseded invariants explicitly; extract shared logic on a second use.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`).
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`).
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`,
   `v83_i`, `v83_n`). **`v83_o`'s own sharpening: the fake-Ollama harness cannot simulate a
   REASONING model at all** — this exact bug was invisible to every test until a real user ran a real
   reasoning-capable model. A test suite passing 100% against a scripted fake is NOT the same claim as
   "this works against real models," and CP2 specifically is the one stage in this whole track that
   makes a real model call — treat it with proportionally more suspicion of "have we actually tried
   this against a real, current-generation model" than the deterministic stages.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** `v83_o`'s version: the SAME caution applies to a user's own uncommitted `lessons.json`
   test data — check `git status`/`git diff --stat` before assuming an unexpected diff is yours to
   revert or fix around.
9. **A test file's `--write`/output path must never be the real, COMMITTED artifact** (`v83_h`).
10. **Mutation-testing a `--write` CLI must redirect BOTH input and output to scratch copies BEFORE
   mutating** (`v83_i`, incident; every release since, applied correctly).
11. **When a change is the FIRST of its kind to touch the live app, or to WRITE to a real corpus, ASK
   how far it should go before building** (`v83_l`/`v83_m`, `v83_n`).
12. **When the user's own estimate of a task's difficulty is wrong, say so plainly** (`v83_n`).

---

# WHERE TO START

## 1. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 2. `test/lib-dom.js`'s `textContent` ordering bug — a fix is IN PROGRESS, elsewhere

Found while building `v83_b`'s own test. **The user has since started that task in a separate
session.** Check whether it has landed before touching this yourself.

## 3. `PLAN §7.0` — the natural next slices, if the user wants to continue

- **Evaluate more real CP4 output.** The user is actively comparing qwen2.5:7b vs qwen3.6:35b-a3b
  output quality on the SAME chapter right now — a direct continuation of this exact thread, not a
  new ask. Read back whatever they generated next; the last reviewed sample (qwen2.5:7b) had TWO
  clear lemmatization/sense errors out of 8 words and one bare-function-word item ("ein") — see if the
  larger model does better, and whether a SYSTEMATIC pattern (not just "small models sometimes err")
  emerges worth fixing in CP2's own prompt or CP3's concept selection.
- **Browser reachability** (UI checkbox + background job for CP2's slow calls) and **CP6** (still a
  CONDITION, not a queued slice) both remain open, neither authorised without the user naming it.
- **The multi-chapter roadmap note's HARDER half** — genuine cross-chapter curriculum sequencing —
  stays explicitly deferred.

## 4. BUILDABLE NOW, no ruling needed

- **`PLAN §C1`'s FIRST gate bug**, **the dead-taps HIGHLIGHTING question**, **`PLAN §F2`'s second
  half**, **`PLAN §D4`'s one measured rough edge** — see `roadmap_v83.md`'s own detail for each;
  unchanged since `v83_n`.

## 5. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — UNVERIFIED BY DESIGN, needs a real regenerate-and-remeasure pass.
- **`translate-ui.js --langnames`, the `hr` `ui.json` pass, native-speaker check of `cyrillic-sr`.**
- **Device passes** on the `v81` UI arc and the `v83_b`…`v83_m` progress-card arc.
- **Deciding what to do with the CP4 test lesson(s) they've generated** — keep, discard, regenerate
  with the larger model, or use as the seed for fixing CP2/CP3's known gaps (function-word filtering,
  confidence not surviving into CP4's written output — both named in `v83_n`'s own write-up).

## 6. NOT yours to start

Import "new" mode is POSTPONED. CP1–5 (`PLAN §7.0`) are DONE. `apply-cp-lessons.js`'s BROWSER
integration needs the user to ask by name. **CP6 is a CONDITIONAL, not a queued slice.**
**Mastery-driven progression (`PLAN §9b/D2`) remains a user product decision.**

**⚠️ THE TRACK T COLOURING NUMBERS MOVED AT `v81_d`** — GREEN 18.6% → **27.8%**, PARTIAL 19.5% →
**11.8%**, mean questions per word 2.20 → **1.79**. **No ruling is reversed; none may be re-opened
without re-measuring** via `probe_word_green_impact_v81d.js`.

**Do not re-derive the per-text learning scheme measurements.** A chapter's lessons teach **9.2% of
its story's tokens, 8.2% of its distinct words**, rarest words least covered (**5.1%**). Inflection
share: **47.3% of taught words findable in the story, 36.4% ABSENT in any form** — **the ceiling is a
GENERATION problem**, and `apply-cp-lessons.js` is the first tool that could plausibly move that
number, if it turns out to work well in real use.

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b.**

- **`canonical-text.js`/`build-canonical-text.js`** (`v83_h`, CP1) — no model call. Committed output.
- **`canonical-analysis.js`/`build-canonical-analysis.js`** (`v83_i`, CP2, bug-fixed `v83_o`) —
  model-in-the-loop, now sends `think:false` on every call.
- **`curriculum-plan.js`/`build-curriculum-plan.js`** (`v83_j`, CP3) — no model call. Also carries
  `excludeAlreadyTaughtConcepts` (`v83_n`).
- **`curriculum-lesson.js`/`build-curriculum-lesson.js`** (`v83_k`, CP4) — no model call, never
  writes `lessons.json` on its own.
- **`GET /api/cp-shadow/:chapterId`** / `cp5ShadowFor` (server.js, `v83_l`) — READ-ONLY.
- **`refreshCp5Shadow(d)` / `_renderCp5Row(cp)`** (index.html, `v83_l`/`v83_m`) — the small visible
  row, resets synchronously, never influences the red→green border.
- **`apply-cp-lessons.js`** (`v83_n`) — THE script that writes real lessons. `--topic`/`--storyline`,
  `--write`, `--replace`, `--lessons`/`--out`. Tagged `_pipeline:'cp4'`. Do NOT `require` server.js
  from ANY of the five standalone CP files.
- `test/lib.js`'s `boot({ log, seed, extraEnv })` — `extraEnv` (`v83_l`) merges into the spawned
  server's env.
- `probe_gates_v80c1.js`, `probe_gates_v77.js` (⚠️ diff after progress-card changes, baseline
  `v80i_card_gates.txt`), `probe_word_green_impact_v81d.js`, `probe_word_green_v81c.js`,
  `probe_comp_skip_v81c.js`, `probe_tap_reachable_v81d.js`, `probe_learner_known_v80l.js` (⚠️
  re-derives colouring inline), `probe_inflection_v80f.js`, `probe_article_symmetry_v80j.js`,
  `probe_lesson_script_v80h.js`, `probe_word_forms_defects_v80g.js`, `probe_forks_v79k.js`,
  `probe_coverage_v78n.js` — all report, none assert.
- `_cardErrors()` — assert it is empty after any card render you add.
- `_storyBodyHtml(d, opts)` — the ONE story renderer. `_exStoryPanelHtml(ex)` — question screens' own
  panel, collapsed by default since `v83_f`.
- `_sumCoverageFrac(rows)` / `_redGreenHex(frac)` (`v83_g`) — the progress card's border colour.
- `buildStandardExercises(lesson, lessonIdx)` (client, `index.html`) — proved to play a CP4-emitted
  lesson unmodified at `v83_k`, and a lesson `apply-cp-lessons.js` actually wrote to disk at `v83_n`.
- `_tutorGatherContext()` / `/api/tutor`, `openCompNav()`/`closeCompNav()`/`openSumNav()`/
  `closeSumNav()`/`_closeCardNavPopups()`, `recordObservation(ex, correct)` /
  `APP.progress.observations` / `refreshBktShadow(d)` — see `INTERNALS.md` §6b for each.
