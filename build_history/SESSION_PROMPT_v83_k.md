# Session prompt — written at the `v83_k` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_j.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_l`, `v83_m`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_k`** release —
`PLAN §7.0` **CP4**: vocabulary lesson through the existing contract, report-only, **NO model call**,
**NEVER touches `lessons.json`**. Fourth buildable slice of Track A's accepted parallel-curriculum
direction; sits ON TOP of `v83_j`'s CP3 output. **A genuine change in kind from CP1–3**: this is the
first stage that emits something LESSON-shaped, not a pure report — but nothing reachable by a real
learner changed; it is a new, inert, parallel route, and "validate it" was proven by running an
emitted lesson through the REAL, unmodified client player code.

**`v83_a`–`v83_g`, condensed** (full write-ups in `roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE` —
read there before touching ANY of this): `v83_a` cut this base line from `v82` to hand off `PLAN
§12`. `v83_b` shipped `PLAN §12` (the text-selection tutor) whole. `v83_c`–`v83_g` are one continuous
arc of user follow-ups on the progress card and question cards, ending with the story panel's border
shifting red→green with comprehension-specific progress (`v83_g`). **Two things worth knowing before
assuming a NEW bug report needs a code fix**: this line diagnosed a "broken" popup string as a
long-running un-restarted server process (`v82_i`), and a "can't reach it from my phone" report as
`localhost` meaning the phone itself. Both are in `v83_g`'s own write-up.

**`v83_h`–`v83_j`, condensed — `PLAN §7.0` CP1–CP3, all still report-only, all standing on each
other**: `v83_h` shipped `canonical-text.js` — stable chapter→sentence→token records + provenance
(`canonical-text.json`, committed, 24 chapters), a pure/deterministic transform, no model call.
`v83_i` shipped `canonical-analysis.js` on top of it — the FIRST model-in-the-loop stage: one real
LLM call per sentence (via the shared `llm.js`) proposing lemma/form/sense per token plus multiword
phrases, with a strict uncertainty contract (`confidence:'unresolved'` for a token the model never
answers for, distinct from `'low'`), proven over a real HTTP call to a scripted fake backend.
`v83_j` shipped `curriculum-plan.js` on top of THAT — back to NO model call: aggregates CP2's
proposals into `vocab`/`phrase` CONCEPTS with evidence-derived `suitableFamilies`/`planReason`,
prerequisite-respecting ordering (Kahn's-algorithm style), and a read-only comparison against real
`lessons.json` lessons. `ui.json` needed no special handling by `v83_j` — the user's own
`translate-ui.js` pass finished and landed as its OWN separate commit (`2aba0d3`) between `v83_i` and
`v83_j`; check `git log --oneline -- ui.json` if a future `ui.json` state looks unexpected.

**`v83_k`, in brief**: *"continue"* — the user confirmed proceeding to CP4 immediately after being
told it was next. One new standalone file, back to making NO model call (same as CP3, unlike CP2):
`curriculum-lesson.js` → `emitVocabLesson(plan, opts)` turns a CP3 chapter plan's VOCAB concepts into
ONE lesson object shaped EXACTLY like server.js's own `generateOneLesson` output (`id`/`type`/
`title`/`desc`/`icon`/`vocab`/`sentences`), plus the plan's §0-mandatory provenance fields
(`sourceSpans`/`planReason`/`pipelineVersion`) that had nowhere lesson-shaped to land until now.
Capped at 8 vocab items (parity with the legacy cap). **Two fields deliberately left empty, not
faked**: `sentences: []` (a real example needs translating the exact story sentence — a narrow NEW
model call this stage does not make) and `skillLinks: []` (wiring real skill tagging here would
invent a per-generator dialect the plan's own text warns against). **"Validate it" was proven at the
STRONGEST possible layer**: `unit-curriculum-lesson.test.js` extracts the REAL, unmodified
`buildStandardExercises` straight out of `index.html` (same `new Function(...)` pattern
`unit-beginner-types.test.js` already uses) and runs a CP4-emitted lesson through it — REAL playable
exercises come out, not just a shape that looks right on paper. The CLI, `build-curriculum-lesson.js`,
reads CP3's `curriculum-plan.json` and NEVER writes to it or to `lessons.json` — a genuinely PARALLEL
route; the legacy generator is completely untouched and CP4's own output (`curriculum-lesson.json`)
is read by nothing, wired into nothing.

**The standing mutation-testing safety rule (`v83_i`'s incident, `v83_j`/`v83_k` both applied
correctly)**: `--in`/`--out`/`--lessons`/whatever redirect flag a CLI has must be pointed at a SCRATCH
copy BEFORE mutating that CLI to prove a "never writes X" guard actually fires — never trust the
mutation to respect the flags on its own. `v83_k`'s own test did this for `curriculum-plan.json`
(CP4's input) with zero risk to any real file.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`…`v83_k` were built, and
   `PLAN §7.0`'s own migration sequence (§0, "THE LARGER PLAN" section) before touching CP5 or later.
   (Nothing is in TRACK T right now — steps 1–4 and `§T7` all shipped in the v81 line.)
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 258 checks
node test/run.js --quick                  → expect 228
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 657 `en` keys** (unchanged since
`v83_c` — this release has no user-facing string at all, report-only by design). FOUR new files exist
alongside `lessons.json`, none part of its schema: **`canonical-text.json`** (CP1, `v83_h`,
COMMITTED — 24 chapters); **`canonical-analysis.json`** (CP2), **`curriculum-plan.json`** (CP3),
**`curriculum-lesson.json`** (CP4) — **NONE of the latter three committed by default** (each needs
the previous stage's output to exist first, and CP2's needs a live/fake model call). Nothing reads
any of the four yet; nothing is wired into the player. Do not change that without a CP5+ ruling.
`APP_VERSION = 'v83_k'`.

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
2. **Guard at the layer where the claim is observable** (rule 34). `v83_k`'s own version: "validate
   it" was proven by running a CP4-emitted lesson through the REAL client `buildStandardExercises`,
   not by trusting a schema check alone — a schema can look right while the actual player code still
   chokes on it. MUTATION-TEST every guard regardless.
2b/2c. **Rewrite superseded invariants explicitly; extract shared logic on a second use** — no new
   incidents this release, still the standing practice.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`) — a reminder for
   any FUTURE CP4 extension that adds sentence-based exercise types, which this release's vocab-only
   lesson did not exercise.
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`).
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`,
   `v83_i`). CP3/CP4 both make NO model call — say so explicitly and test that they don't, per
   `v83_j`'s own addition to this rule.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** A THROWAWAY server on a spare port is the reusable pattern for any live check.
9. **A test file's `--write`/output path must never be the real, COMMITTED artifact** (`v83_h`) —
   every CP1–4 CLI gained `--out`/`--in` specifically so tests could exercise the real CLI without
   resizing a checked-in artifact.
10. **Mutation-testing a `--write` CLI must redirect BOTH input and output to scratch copies BEFORE
   mutating** (`v83_i`, incident; `v83_j`/`v83_k`, applied correctly each time). Do this for CP5 too.

---

# WHERE TO START

## 1. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 2. `test/lib-dom.js`'s `textContent` ordering bug — a fix is IN PROGRESS, elsewhere

Found while building `v83_b`'s own test: trailing text after a child element comes back
mis-ordered. **The user has since started that task in a separate session.** Check whether it has
landed before touching this yourself.

## 3. `PLAN §7.0` CP5 — the natural next slice, if the user wants to continue Track A

CP1–CP4 are done: stable records, lemma/form/phrase/sense/frequency/script proposals, a proposed
curriculum plan, and ONE parallel-route lesson family (vocabulary) — all report-only or inert, nothing
wired into the player. CP5 is next: *"consume the plan read-only. Let the red→green text progress
card read analysis and skill data with a legacy fallback. BKT remains a measurement until a separate
product ruling."* **This is the FIRST stage that touches something a real learner can see** — even
read-only, it means the progress card (already touched extensively across `v83_c`–`v83_g` this same
line) reads from CP1–4's stores. Read that whole arc's write-ups first — the card's structure changed
significantly this cut. Needs a careful "legacy fallback" design: what does the card do for the
81%+ of the corpus CP1–4 have never analysed? Do NOT start it without the user asking for it by name.

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

Import "new" mode is POSTPONED. **Track A's CP1–4 (`PLAN §7.0`) is DONE, shipped this line; CP5
onward needs the user to say so explicitly (see §3 above).** **Mastery-driven progression (`PLAN
§9b/D2`) remains a user product decision.** The learner/teacher rework — `_canEdit()` is done;
`Edit / rename topic` stays visible by user ruling.

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
  nothing. Do NOT `require` server.js from ANY of the four CP files (binds a port as a side effect).
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
- `buildStandardExercises(lesson, lessonIdx)` (client, `index.html`) — the REAL exercise builder for
  `type:'standard'` lessons. `v83_k` proved a CP4-emitted lesson plays through it unmodified; extract
  via `new Function(...)` for any future CP-stage test that needs the SAME proof for a new type.
- `_tutorGatherContext()` / `/api/tutor` — `uiLang` (reply language) ADDITIVE alongside `srcLang`.
- `openCompNav()`/`closeCompNav()`/`openSumNav()`/`closeSumNav()`/`_closeCardNavPopups()` (`v83_c`/
  `v83_d`) — one popup per card.
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path. See `INTERNALS.md` §6b before extending it.
