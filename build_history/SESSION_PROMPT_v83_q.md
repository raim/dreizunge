# Session prompt — written at the `v83_q` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_p.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_r`, `v83_s`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_q`** release —
**`install.sh`, a one-line `curl \| sh` local installer** (README.md's new "Option A"). Completely
UNRELATED to `PLAN §7.0`/Track A — a distribution/onboarding convenience the user asked for directly
("let's move to something completely different"). Clones the repo (or updates an existing checkout),
installs Ollama via Ollama's OWN official installer if not already present, confirms it's reachable,
pulls `qwen2.5:7b` (README.md's own already-documented quick-start model) if not already pulled, and
starts the server. Every mutating step is idempotency-gated; verified with a REAL end-to-end run
(fresh install AND a second, update-existing-checkout run) against the real GitHub repo, which also
surfaced that the public repo was still several releases behind local `HEAD` (`v83_h`…`v83_p` are all
local-only commits — this project only pushes when the user asks).

**Before `v83_q`, `PLAN §7.0`'s own real-world evaluation was also written up properly** (a separate,
code-free roadmap commit, right before `v83_q`): the user ran `apply-cp-lessons.js` twice against the
same chapter, comparing `qwen2.5:7b` (2 clear CP2 accuracy errors) against `qwen3.6:35b-a3b` (zero
errors, more sophisticated context-tracking) — read that note (`roadmap_v83.md`, right after the
multi-chapter note) before assuming anything about model-choice tradeoffs for this pipeline; it's
real evidence, not a guess. Two gaps that evidence surfaced remain OPEN: no function-word filtering,
and confidence not surviving into CP4's written lesson.

**`v83_o`/`v83_p`, condensed — two real bugs, both found by the user actually using the tool**:
`v83_o` fixed CP2 sending no `think:false`, which crashed against a real reasoning model
(`qwen3.6:35b-a3b`) with "Ollama returned empty response" — the exact, previously-solved `v71_o`
failure mode CP2 had never inherited. `v83_p` fixed a register mismatch the user caught reading real
output word-by-word (*"we still have 'venne/kommen'..."*) — CP2's sense gloss now matches the
token's own grammatical register, and CP4's `target` field now uses the SURFACE form (not the
dictionary lemma) paired against it; fixing that ALSO required fixing a second bug it silently
introduced in `apply-cp-lessons.js`'s own cross-chapter dedup (which had been comparing by `target`).
Neither bug was reachable by this session's own testing — one needs a real reasoning model to fail
against, the other needs a human's actual linguistic judgment.

**`v83_h`–`v83_o`, condensed — the whole `PLAN §7.0` arc**: CP1 (`v83_h`) — stable text records, no
model call. CP2 (`v83_i`, `think:false` fix at `v83_o`, register fix at `v83_p`) — the model-in-the-
loop stage, one real LLM call per sentence. CP3 (`v83_j`, surface/sense same-occurrence fix at
`v83_p`) — curriculum plan, no model call. CP4 (`v83_k`, target-field fix at `v83_p`) — one lesson
family, proven playable, still unreachable by anyone through the UI. CP5 (`v83_l` silent, `v83_m`
visible) — the FIRST stage to touch `index.html`/`server.js`. `apply-cp-lessons.js` (`v83_n`, two bug
fixes at `v83_o`/`v83_p`) — the FIRST script that WRITES real, additive, `_pipeline:'cp4'`-tagged
lessons into `lessons.json`, with cross-chapter dedup. A separate, code-free roadmap note (between
`v83_m` and `v83_n`) distinguishes SIMPLE cross-chapter dedup (built) from the harder, explicitly-
deferred "genuine cross-chapter curriculum sequencing." Full write-ups in `roadmap_v83.md`'s
`# SHIPPED IN THE v83 LINE`.

⚠️ **Check `git status --short lessons.json` at the start of this session.** If it shows modified,
that is very likely the user's own real, uncommitted CP4-pipeline evaluation data — not yours to
revert, commit, or "fix around" without asking. `v83_o`/`v83_p` both excluded it from their commits;
the same dance (back up, `git checkout --`, build/test, restore) is documented in both write-ups.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`…`v83_q` were built, and
   `PLAN §7.0`'s own migration sequence (§0) — **including the multi-chapter note AND the real-world
   evaluation note right after it**, before touching any further `PLAN §7.0` work. `install.sh`
   (`v83_q`) is unrelated to any of that — see its own entry near the bottom of `# SHIPPED`.
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 261 checks
node test/run.js --quick                  → expect 229
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 659 `en` keys** (unchanged since
`v83_m`). Five CP-pipeline files exist alongside `lessons.json`: `canonical-text.json` (CP1,
COMMITTED, 24 chapters); `canonical-analysis.json` (CP2), `curriculum-plan.json` (CP3),
`curriculum-lesson.json` (CP4) — none committed by default. `apply-cp-lessons.js` (`v83_n`) is the
ONLY thing that can add a real lesson to `lessons.json`, only with explicit `--write`. `install.sh`
(`v83_q`) is a NEW, unrelated file at the repo root — the one-line installer, see its own section
below.
`APP_VERSION = 'v83_q'`.

⚠️ **A CP4-pipeline lesson's `vocab[i]` shape changed at `v83_p`**: it now has `{target, source,
lemma, conceptId}` — `target` is the SURFACE form, `lemma` is a NEW, separate field carrying the
dictionary form. A lesson generated BEFORE `v83_p` (the user's own two evaluation runs, `v83_n`'s
qwen2.5:7b and `v83_o`'s qwen3.6:35b-a3b) will still have the OLD shape (`target` = lemma, no
separate `lemma` field) — do not assume every `_pipeline:'cp4'` lesson in a real corpus has the new
shape without checking its own `provenance.pipelineVersion`/generation date first.

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
2. **Guard at the layer where the claim is observable** (rule 34).
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`).
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`).
6. **Never put emoji in a Python string literal** (rule 25).
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`,
   `v83_i`, `v83_n`, `v83_o`). **`v83_p`'s own sharpening: a live model call ALSO needs a real
   HUMAN reading the output closely** — `v83_o`'s fix made the pipeline WORK against a real model;
   `v83_p`'s fix made what it PRODUCED actually correct. Neither bug was reachable by any amount of
   testing against the fake harness, and neither was reachable by just "running it and seeing it
   didn't crash" — `v83_p`'s bug produced a perfectly well-formed, non-crashing, WRONG lesson.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** Applies equally to the user's own uncommitted `lessons.json` evaluation data.
9. **A test file's `--write`/output path must never be the real, COMMITTED artifact** (`v83_h`).
10. **Mutation-testing a `--write` CLI must redirect BOTH input and output to scratch copies BEFORE
   mutating** (`v83_i`, incident; every release since, applied correctly).
11. **When a change is the FIRST of its kind to touch the live app, or to WRITE to a real corpus, ASK
   how far it should go before building** (`v83_l`/`v83_m`, `v83_n`).
12. **When the user's own estimate of a task's difficulty is wrong, say so plainly** (`v83_n`).
13. **A fix to one stage's OUTPUT SHAPE can silently break a DOWNSTREAM consumer that assumed the OLD
   shape** (`v83_p`, new) — changing CP4's `target` field from lemma to surface silently broke
   `apply-cp-lessons.js`'s own cross-chapter dedup, which read `vocab.target` assuming it WAS the
   lemma. Caught only by re-running the FULL test suite for every affected file after the first fix,
   not by reasoning about that one fix in isolation. Any future change to a shared record shape
   (CP1's token record, CP2's analysis record, CP3's concept record, CP4's lesson shape) needs the
   SAME sweep: what else reads this field, and does it still mean what that reader assumes?

---

# WHERE TO START

## 1. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 2. `test/lib-dom.js`'s `textContent` ordering bug — a fix is IN PROGRESS, elsewhere

Found while building `v83_b`'s own test. **The user has since started that task in a separate
session.** Check whether it has landed before touching this yourself.

## 3. `PLAN §7.0` — the natural next slices, if the user wants to continue

- **Re-evaluate CP4 output with the register fix in place.** The user's own two evaluation runs
  (`v83_n` qwen2.5:7b, `v83_o` qwen3.6:35b-a3b) both predate `v83_p` — worth re-running (`--replace`)
  to see the corrected target/source pairing on real output, not just the hand-built test fixtures.
- **Browser reachability** (UI checkbox + background job for CP2's slow calls) and **CP6** (still a
  CONDITION, not a queued slice) both remain open, neither authorised without the user naming it.
- **The multi-chapter roadmap note's HARDER half** — genuine cross-chapter curriculum sequencing —
  stays explicitly deferred.
- **The function-word filtering gap**, named in `v83_n`'s own write-up ("ein" proposed as a
  standalone vocabulary item) — still open, unaffected by `v83_p`'s fix.
- **Confidence not surviving into CP4's written lesson** — also named in `v83_n`, also still open.

## 4. BUILDABLE NOW, no ruling needed

- **`PLAN §C1`'s FIRST gate bug**, **the dead-taps HIGHLIGHTING question**, **`PLAN §F2`'s second
  half**, **`PLAN §D4`'s one measured rough edge** — see `roadmap_v83.md`'s own detail for each;
  unchanged since `v83_n`.

## 5. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — UNVERIFIED BY DESIGN, needs a real regenerate-and-remeasure pass.
- **`translate-ui.js --langnames`, the `hr` `ui.json` pass, native-speaker check of `cyrillic-sr`.**
- **Device passes** on the `v81` UI arc and the `v83_b`…`v83_m` progress-card arc.
- **Deciding what to do with the CP4 test lesson(s) they've generated** — keep, discard, regenerate
  with `v83_p`'s fix, or use as the seed for fixing CP2/CP3's still-open gaps (function-word
  filtering, confidence not surviving into CP4's written output).

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
- **`canonical-analysis.js`/`build-canonical-analysis.js`** (`v83_i`, CP2) — model-in-the-loop.
  `think:false` on every call (`v83_o`). `parseAnalysisReply` now carries `surface` per token
  (`v83_p`) — the token's own literal text, known even when unresolved.
- **`curriculum-plan.js`/`build-curriculum-plan.js`** (`v83_j`, CP3) — no model call.
  `excludeAlreadyTaughtConcepts` (`v83_n`). `surface`/`sense` chosen from the SAME occurrence
  (`v83_p`) — never independently, or the register mismatch reappears one level down.
- **`curriculum-lesson.js`/`build-curriculum-lesson.js`** (`v83_k`, CP4) — no model call, never
  writes `lessons.json`. `vocab[i] = {target: surface, source: sense, lemma, conceptId}` (`v83_p`) —
  target/source are register-matched; lemma is a separate field.
- **`GET /api/cp-shadow/:chapterId`** / `cp5ShadowFor` (server.js, `v83_l`) — READ-ONLY.
- **`refreshCp5Shadow(d)` / `_renderCp5Row(cp)`** (index.html, `v83_l`/`v83_m`) — the small visible
  row, resets synchronously, never influences the red→green border.
- **`apply-cp-lessons.js`** (`v83_n`) — THE script that writes real lessons. `--topic`/`--storyline`,
  `--write`, `--replace`, `--lessons`/`--out`. `vocabTargetsOf` (its cross-chapter dedup identity
  function) compares by `lemma` first, falling back to `target` for legacy lessons (`v83_p` — this
  MUST stay lemma-first, or dedup silently breaks for every inflected word again). Do NOT `require`
  server.js from ANY of the five standalone CP files.
- **`install.sh`** (`v83_q`, repo root) — the one-line `curl \| sh` installer, UNRELATED to any of
  the `PLAN §7.0` files above. Every mutating step is idempotency-gated (see `INTERNALS.md`'s own
  entry for the exact list) — if you touch this file, re-verify EACH gate still fires (a real
  `sh -n` check plus the structural assertions in `test/unit-install-script.test.js` are necessary
  but not sufficient; the real proof was an actual end-to-end run against the real GitHub repo,
  documented in `v83_q`'s own roadmap write-up — repeat that manually after any real change here).
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
