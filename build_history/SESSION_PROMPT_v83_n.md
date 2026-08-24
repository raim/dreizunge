# Session prompt — written at the `v83_n` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_m.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_o`, `v83_p`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_n`** release —
**`apply-cp-lessons.js`**: the FIRST script in the whole `PLAN §7.0` track that WRITES real,
additive, playable lessons into the actual `lessons.json`. Everything through CP1–5 (`v83_h`…`v83_m`)
was deliberately inert or report-only. This is NOT a numbered CP stage — it's a follow-up to CP4,
built as a standalone script first (so it can be run and inspected from a terminal), meant to become
the shared engine a future browser "add lessons" checkbox will eventually call into.

**`v83_a`–`v83_g`, condensed**: `v83_a` cut this line from `v82`. `v83_b` shipped `PLAN §12` (the
text-selection tutor). `v83_c`–`v83_g` are one arc of progress-card/question-card follow-ups, ending
with the story panel's border shifting red→green with comprehension progress (`v83_g`). Full
write-ups in `roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE`.

**`v83_h`–`v83_m`, condensed — `PLAN §7.0` CP1–CP5, the report-only/inert half of Track A**: `v83_h`
(CP1) — stable chapter→sentence→token records, no model call, committed `canonical-text.json`.
`v83_i` (CP2) — the only model-in-the-loop stage: one real LLM call per sentence, honest about what
it couldn't resolve. `v83_j` (CP3) — aggregates CP2's proposals into ordered `vocab`/`phrase`
concepts with prerequisites, no model call. `v83_k` (CP4) — the first stage to emit something
lesson-shaped, proven playable through the REAL `buildStandardExercises`, but never touching
`lessons.json` and reachable by nothing. `v83_l`/`v83_m` (CP5) — the progress card silently, then
visibly (small "🧪 Experimental" row in the nav popup), reads CP1-4 data read-only, with a
mutation-tested "changes nothing else" proof both times.

**Then a planning conversation, before any more code** (this is what actually produced `v83_n`): the
user asked whether this pipeline reaches the browser today (no — confirmed plainly), what it would
take to get there (a UI trigger + a background job for CP2's slow calls + a decision about
additive-vs-replace + skill-registry wiring + sentence generation — none built yet), whether it works
across multiple chapters (batch already did at the CLI level; genuine cross-chapter awareness did
not), and specifically whether "just don't re-teach an already-covered word" would be simple. That
last question corrected an over-broad earlier estimate in the SAME conversation — the full learning
"arc" (deciding what to teach WHEN, prerequisite-aware, across a whole story) is genuinely CP3-sized;
the narrower dedup is not. Recorded as its own roadmap note (a standalone, code-free commit,
distinguishing the two) BEFORE `v83_n` was built, specifically so the two don't get conflated later.

**`v83_n`, in brief**: `curriculum-plan.js` gained `excludeAlreadyTaughtConcepts` — the simple dedup
filter the note called for. `apply-cp-lessons.js` chains CP1→CP2→CP3→(dedup)→CP4 for `--topic <id>`
or every chapter of `--storyline <id>` in order, and appends an ADDITIVE, `_pipeline:'cp4'`-tagged
lesson per topic — proven byte-for-byte to never touch an existing lesson or an unrelated topic.
Cross-chapter dedup tracks BOTH pre-existing legacy lessons AND lessons this same run just added to
earlier chapters. Idempotent by default (skips a topic that already has a cp4 lesson, checked BEFORE
the expensive model-calling chain runs); `--replace` regenerates. **A real bug found and fixed while
building this**: the first version of `--replace` treated the OLD lesson being replaced as
"already taught" by itself, so every replace run starved itself down to an empty lesson — fixed by
excluding that one lesson from the dedup union specifically under `--replace`, and mutation-tested
(a replace run now provably recovers the same vocabulary, not less).

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`…`v83_n` were built, and
   `PLAN §7.0`'s own migration sequence (§0) — **including the multi-chapter note right after the
   migration sequence list**, before touching ANY further multi-chapter work.
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
`v83_m` — `apply-cp-lessons.js` has no UI surface, so no new strings). Five CP-pipeline files exist
alongside `lessons.json`: `canonical-text.json` (CP1, COMMITTED, 24 chapters); `canonical-analysis.json`
(CP2), `curriculum-plan.json` (CP3), `curriculum-lesson.json` (CP4) — none committed by default.
**`apply-cp-lessons.js` is the ONLY thing in this whole track that can add a real, playable lesson to
`lessons.json`** — and it only does so when explicitly run with `--write`, never automatically.
`APP_VERSION = 'v83_n'`.

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

1. **Measure before editing.** `v83_n`'s version: before writing a script that mutates `lessons.json`
   for the first time, READ a real topic's actual shape (field names, id conventions, `_genMeta`
   fallback behaviour) rather than guessing from memory of what earlier stages produced.
2. **Guard at the layer where the claim is observable** (rule 34). `v83_n`'s additive-only claim was
   checked BYTE-FOR-BYTE against a real written file, not inferred from "the code only pushes."
2b/2c. Rewrite superseded invariants explicitly; extract shared logic on a second use.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`).
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`).
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc, or a
   `\UXXXXXXXX` escape in a Python script (`v83_m`'s ui.json edit did the latter).
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`,
   `v83_i`, `v83_n`) — `v83_n`'s own CP2 call is exercised via the real fake-Ollama chain, not stubbed.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.**
9. **A test file's `--write`/output path must never be the real, COMMITTED artifact** (`v83_h`) —
   `apply-cp-lessons.js` extends this with INDEPENDENT `--lessons`/`--out` redirects (read vs. write),
   since this is the first CP-track script where the READ side is also a real, shared corpus file.
10. **Mutation-testing a `--write` CLI must redirect BOTH input and output to scratch copies BEFORE
   mutating** (`v83_i`, incident; every release since, applied correctly).
11. **When a change is the FIRST of its kind to touch the live app (even read-only), ASK how far it
   should go before building** (`v83_l`/`v83_m`). `v83_n`'s own version: when a change is the FIRST
   of its kind to WRITE to a real corpus, name that plainly to the user before building it, even when
   they've already said "ok, continue" in general terms — a bigger category of risk deserves its own
   explicit checkpoint, not just riding a prior "continue."
12. **When the user's own estimate of a task's difficulty is wrong, say so — don't just accept the
   frame** (`v83_n`, new) — the user asked if cross-chapter dedup was "simple... perhaps not
   necessary," and the honest answer split that into two different-sized pieces rather than agreeing
   or disagreeing with the premise as posed. This produced the roadmap note that shaped `v83_n`'s own
   scope correctly.

---

# WHERE TO START

## 1. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 2. `test/lib-dom.js`'s `textContent` ordering bug — a fix is IN PROGRESS, elsewhere

Found while building `v83_b`'s own test: trailing text after a child element comes back
mis-ordered. **The user has since started that task in a separate session.** Check whether it has
landed before touching this yourself.

## 3. `PLAN §7.0` — the natural next slices, if the user wants to continue

Two independent directions are both open, and neither is authorised without the user naming it:

- **Browser reachability.** `apply-cp-lessons.js` is the engine; making it reachable from the
  existing generator page needs: a new checkbox in `ADD_LESSON_TYPES`/`ARC_LESSON_TYPES` (gated
  `needsStory:true`, same as `comprehension`/`writing`/`error_hunt`), a background-job wrapper for
  CP2's slow per-sentence calls (the existing bookJobs pattern is the template), and a decision about
  whether the browser path defaults to additive or offers `--replace`-equivalent too.
- **CP6.** Still explicitly a CONDITION, not a queued slice: *"retire nothing by assumption... only
  after the new route has measured multilingual coverage, quality, recovery/re-analysis, and player
  compatibility."* No evidence at that scale exists yet.

**Also open, from the multi-chapter roadmap note** (`roadmap_v83.md`, right after `PLAN §7.0`'s own
migration-sequence list): the HARDER half — genuine cross-chapter curriculum sequencing (deciding
WHAT to teach WHEN across a whole story's arc) — is explicitly deferred, not authorised by `v83_n`'s
own simpler dedup filter. Revisit only if the dedup alone proves insufficient in real use.

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
- **A device pass on the WHOLE `v83_b`…`v83_m` progress-card/question-card arc**, and now trying
  `apply-cp-lessons.js` on some real chapters to see what the actual lesson quality looks like.

## 6. NOT yours to start

Import "new" mode is POSTPONED. **CP1–5 (`PLAN §7.0`) are DONE.** `apply-cp-lessons.js` (`v83_n`) is
built and tested, but its BROWSER integration (§3 above) needs the user to ask by name — don't build
the UI checkbox / background job without that. **CP6 is a CONDITIONAL, not a queued slice.**
**Mastery-driven progression (`PLAN §9b/D2`) remains a user product decision.** The learner/teacher
rework — `_canEdit()` is done; `Edit / rename topic` stays visible by user ruling.

**⚠️ THE TRACK T COLOURING NUMBERS MOVED AT `v81_d`** — GREEN 18.6% → **27.8%**, PARTIAL 19.5% →
**11.8%**, mean questions per word 2.20 → **1.79**. **No ruling is reversed; none may be re-opened
without re-measuring** via `probe_word_green_impact_v81d.js`.

**Do not re-derive the per-text learning scheme measurements.** A chapter's lessons teach **9.2% of
its story's tokens, 8.2% of its distinct words**, rarest words least covered (**5.1%**). Inflection
share: **47.3% of taught words findable in the story, 36.4% ABSENT in any form** — **the ceiling is a
GENERATION problem**, and `apply-cp-lessons.js` is the first tool that could plausibly move that
number, if it turns out to work well in real use.

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b** — it is the permanent,
actively-maintained function map. This prompt only keeps the probe scripts, quick reference not
duplicated in INTERNALS.md.

- **`canonical-text.js`/`build-canonical-text.js`** (`v83_h`, CP1) — no model call. Committed output.
- **`canonical-analysis.js`/`build-canonical-analysis.js`** (`v83_i`, CP2) — model-in-the-loop.
- **`curriculum-plan.js`/`build-curriculum-plan.js`** (`v83_j`, CP3) — no model call. Also now carries
  `excludeAlreadyTaughtConcepts` (`v83_n`) — the SIMPLE cross-chapter dedup filter.
- **`curriculum-lesson.js`/`build-curriculum-lesson.js`** (`v83_k`, CP4) — no model call, never
  writes `lessons.json` on its own.
- **`GET /api/cp-shadow/:chapterId`** / `cp5ShadowFor` (server.js, `v83_l`) — READ-ONLY.
- **`refreshCp5Shadow(d)` / `_renderCp5Row(cp)`** (index.html, `v83_l`/`v83_m`) — the small visible
  row, resets synchronously, never influences the red→green border.
- **`apply-cp-lessons.js`** (`v83_n`) — THE script that writes real lessons. `--topic`/`--storyline`,
  `--write`, `--replace`, `--lessons`/`--out` (independent read/write redirect). Tagged
  `_pipeline:'cp4'`. Do NOT `require` server.js from ANY of the five standalone CP files.
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
- `_cardErrors()` — assert it is empty after any card render you add.
- `_storyBodyHtml(d, opts)` — **the ONE story renderer**. Fill-height chain REVOKED at `v83_f`.
- `_exStoryPanelHtml(ex)` — question/exercise screens' own panel. Collapsed by default since `v83_f`.
- `_sumCoverageFrac(rows)` / `_redGreenHex(frac)` (`v83_g`) — the progress card's border colour.
- `buildStandardExercises(lesson, lessonIdx)` (client, `index.html`) — the REAL exercise builder for
  `type:'standard'` lessons. `v83_k` proved a CP4-emitted lesson plays through it unmodified; `v83_n`
  reproved it against a lesson actually written to disk by `apply-cp-lessons.js`.
- `_tutorGatherContext()` / `/api/tutor` — `uiLang` (reply language) ADDITIVE alongside `srcLang`.
- `openCompNav()`/`closeCompNav()`/`openSumNav()`/`closeSumNav()`/`_closeCardNavPopups()` (`v83_c`/
  `v83_d`) — one popup per card. `#comp-cp5-row` lives inside `#comp-nav-modal`.
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path, the DIRECT template CP5's shadow (`v83_l`) was built to mirror.
