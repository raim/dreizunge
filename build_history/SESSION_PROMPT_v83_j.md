# Session prompt — written at the `v83_j` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v83_i.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_k`, `v83_l`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_j`** release —
`PLAN §7.0` **CP3**: proposed curriculum plan (concepts/reasons/prerequisites/ordering/suitable
exercise families), report-only, **NO model call**. Third buildable slice of Track A's accepted
parallel-curriculum direction; sits ON TOP of `v83_i`'s CP2 output.

**`v83_a`–`v83_g`, condensed** (full write-ups in `roadmap_v83.md`'s `# SHIPPED IN THE v83 LINE` —
read there before touching ANY of this): `v83_a` cut this base line from `v82` to hand off `PLAN
§12`. `v83_b` shipped `PLAN §12` (the text-selection tutor) whole. `v83_c`–`v83_g` are one continuous
arc of user follow-ups on the progress card and question cards: a nav/progress-bars popup (`v83_c`),
extended to the entry card (`v83_d`), header-row arrows made progressively heavier (`v83_e`), a
REVOCATION of the fill-height story panel plus question cards defaulting to collapsed (`v83_f`), and
the story panel's border shifting red→green with comprehension-specific progress (`v83_g`). **Two
things worth knowing before assuming a NEW bug report needs a code fix**: this line diagnosed a
"broken" popup string as a long-running un-restarted server process (`v82_i`), and a "can't reach it
from my phone" report as `localhost` meaning the phone itself. Both are in `v83_g`'s own write-up.

**`v83_h`/`v83_i`, condensed — `PLAN §7.0` CP1 and CP2**: `v83_h` shipped `canonical-text.js`/
`build-canonical-text.js` — stable chapter→sentence→token records + provenance over a 24-chapter
representative sample (`canonical-text.json`), a pure/deterministic transform, no model call, never
touching `lessons.json`. `v83_i` shipped `canonical-analysis.js`/`build-canonical-analysis.js` on top
of it — the FIRST model-in-the-loop stage: one real LLM call per sentence (via the shared `llm.js`,
not a new HTTP client) proposing lemma/form/sense per token plus multiword phrases, with a strict
uncertainty contract (`confidence:'unresolved'` for a token the model never answers for, distinct
from `'low'`), proven over a real HTTP call to a scripted fake backend. `ui.json` was left OUT of
both commits deliberately — a live `translate-ui.js --threads 5` process was found running in the
user's own terminal, translating the many `en`-only keys this v83 line accumulated, independent of
this session; check `ps aux | grep translate-ui` before assuming an uncommitted `ui.json` diff is
stray.

**`v83_j`, in brief**: *"ok for CP3"* — the user confirmed continuing Track A immediately after CP2
shipped. One new standalone file, this time making **NO model call at all**: `curriculum-plan.js` →
`buildCurriculumPlan(chapterAnalysis, opts)` aggregates a CP2 chapter analysis record into `vocab`/
`phrase` CONCEPTS — one per distinct resolved lemma / validated phrase, across every sentence.
**`suitableFamilies`/`planReason` are derived ONLY from evidence already in the CP2 record** (multiple
distinct forms → `word_forms`/`inflections`; a "verb" form string → `conjugation`; any non-`high`
occurrence pulls the whole concept's confidence to `'low'`) — nothing is guessed beyond what CP2
already established. **Prerequisites**: a phrase concept depends on the vocab concepts covering its
own constituent tokens' lemmas ("teach the parts before the whole") — the ONE prerequisite
relationship this stage has evidence for, no grammar-level teaching order modeled. **Ordering**:
frequency-desc/position-asc as a base priority, but a Kahn's-algorithm-style pass ALWAYS places
prerequisites before their dependents, even against a large frequency advantage — mutation-tested
directly. `compareWithExistingLessons` is the plan's own "compare with current generated lessons"
step, READ-ONLY against a real `lessons.json` topic, reporting the gap in both directions. The CLI,
`build-curriculum-plan.js`, reads CP2's `canonical-analysis.json` as input and `lessons.json`
read-only for comparison — same `--write`/`--out`/`--in`/`--lessons` redirect convention as CP1/CP2.

**A safety-rule application worth knowing**: `v83_i`'s own mutation-testing incident (a hand-edited
mutation bypassing `--out`/`--in` and briefly writing into the real, committed `canonical-text.json`)
produced a standing rule. This release's own "never writes `lessons.json`" mutation test APPLIED that
rule correctly: `--lessons` was pointed at a SCRATCH copy before mutating, so the mutation's write
landed on the scratch copy, never the real file — verified both ways via `git diff --stat`. Worth
repeating for CP4's own mutation tests too.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES, then `# SHIPPED IN THE v83 LINE` for how `v83_b`…`v83_j` were built, and
   `PLAN §7.0`'s own migration sequence (§0, "THE LARGER PLAN" section) before touching CP4 or later.
   (Nothing is in TRACK T right now — steps 1–4 and `§T7` all shipped in the v81 line.)
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 257 checks
node test/run.js --quick                  → expect 228
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 657 `en` keys** (unchanged since
`v83_c` — this release has no user-facing string at all, report-only by design). THREE new files
exist alongside `lessons.json`, all report-only stores, none part of the `lessons.json` schema:
**`canonical-text.json`** (CP1, `v83_h`, COMMITTED — 24 chapters, 153 sentences, 2266 tokens);
**`canonical-analysis.json`** (CP2, `v83_i`) and **`curriculum-plan.json`** (CP3, `v83_j`) — **NEITHER
committed by default** (model calls are slow for CP2; CP3 needs CP2's output to exist first). Nothing
reads any of the three yet; do not wire any into the player without a CP4+ ruling first.
`APP_VERSION = 'v83_j'`.

⚠️ **The user's own main dev server (port 3000) needs a MANUAL restart to see anything past
`v83_f`** — check its reported version against `APP_VERSION` before assuming it's current, and ask
before restarting it (their own terminal, their own call, per `v83_g`'s own exchange on this).

⚠️ **`ui.json` may be mid-translation in the user's OWN terminal, independent of this session.** A
live `translate-ui.js --threads 5` process was found running in a separate terminal at the `v83_h`/
`v83_i`/`v83_j` cuts (not this session's doing). `ui.json` was deliberately left OUT of all three
commits so this release does not race that work. **Check `ps aux | grep translate-ui` and `git status
--short ui.json` before assuming an uncommitted `ui.json` diff is stray or yours to revert.**

> **These four expectations and the four corpus numbers are GUARDED** by `unit-roadmap-version`
> against the actual suite and against the data files. **If that test fails, the number in THIS file
> is the thing to fix.**

- `unit-static-freshness` red → `node build-static.js`. **Read what it NAMES first.** If it names
  `ui.json` and the user has a live translation pass running (see above), build against the
  COMMITTED `ui.json` (temporarily `git checkout -- ui.json`, build, then restore the working-tree
  copy from a backup — do NOT let a release's `docs/index.html` embed unreviewed, uncommitted
  content, and do NOT lose the user's live progress doing this dance).
- `unit-script-choice` red saying topics are unstamped → `node backfill-script.js --write`.
- **Order matters: backfill FIRST, build-static SECOND.** A fixer is not a diagnosis (rule 23).

## The habits that cost this project the most

*(Full incident history for each numbered rule lives in `roadmap_v82.md`'s "Rules earned in session
N" blocks — this is the short form, not a replacement for reading those before citing one.)*

1. **Measure before editing.** A warning in the notes is a claim about a DESIGN, not about the
   problem (rule 35). `v83_h`'s version: when PORTING logic from one file to another, GENERATE real
   output and inspect it — a clean diff/copy is not the same claim as "it still does the right
   thing".
2. **Guard at the layer where the claim is observable** (rule 34), and **a guard that SCANS SOURCE
   TEXT can trip on its own explanatory comment**, not just on the code it means to check.
   MUTATION-TEST every guard regardless: break the rule and check the guard goes red.
2b. **When a NEW request deliberately supersedes an OLD test invariant, REWRITE the test to state
   what holds NOW, with the supersession explained inline** — don't just loosen or delete.
2c. **When a second request extends a feature you JUST built, extract the shared logic.**
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.**
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`).
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`).
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`, `v83_b`,
   `v83_i`). `v83_j`'s counterpart: when a stage makes NO model call (CP3), say so explicitly and
   test that it doesn't — don't leave the reader to assume every pipeline stage needs a live test.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create.** A THROWAWAY server on a spare port is the reusable pattern for any live check.
9. **A test file's `--write`/output path must never be the real, COMMITTED artifact** (`v83_h`) —
   every CP1/CP2/CP3 CLI gained `--out <path>` (and CP2/CP3 also `--in`) specifically so their test
   suites could exercise the real CLI without resizing a checked-in artifact on every run.
10. **Mutation-testing a `--write` CLI must redirect BOTH input and output to scratch copies BEFORE
   mutating** (`v83_i`, incident; `v83_j`, applied correctly) — a hand-edited mutation that bypasses
   `--out`/`--in`/`--lessons` can write straight into a real, committed file. `v83_i`'s own mutation
   test did exactly this into `canonical-text.json` (caught after the fact via `git status`,
   restored). `v83_j`'s equivalent test for `lessons.json` pointed `--lessons` at a scratch copy
   FIRST, so the same class of mutation never touched the real file at all — do this for CP4 too.

---

# WHERE TO START

## 1. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 2. `test/lib-dom.js`'s `textContent` ordering bug — a fix is IN PROGRESS, elsewhere

Found while building `v83_b`'s own test: trailing text after a child element
(`'x<b>A</b>y'.textContent`) comes back mis-ordered. **The user has since started that task in a
separate session, running independently of this one.** Check whether it has landed before touching.

## 3. `PLAN §7.0` CP4 — the natural next slice, if the user wants to continue Track A

CP1 (`v83_h`), CP2 (`v83_i`), CP3 (`v83_j`) are done: stable records, lemma/form/phrase/sense/
frequency/script proposals, and a proposed curriculum plan (concepts/prerequisites/ordering) — all
report-only, nothing wired into the player. CP4 is next: *"one lesson family through the existing
contract. Start with vocabulary meaning/form, validate it, and retain the legacy generation route in
parallel. Only then add language-specific families such as conjugation, grammar, articles, error
patterns, and comprehension."* **This is the FIRST stage that emits an actual lesson** — a real
change in kind from CP1–CP3's pure reporting, and the first one that needs a decision about HOW a
CP3-planned concept becomes a `lessons.json`-shaped lesson object without disturbing the legacy
generator. Read `PLAN §7.0`'s own migration sequence text in `roadmap_v83.md` §0 closely before
starting — CP4 is where "report-only" ends. Do NOT start it without the user asking for it by name.

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
- **The translate pass** for the remaining `en`-only keys — **IN PROGRESS** in the user's own
  terminal (see the ⚠️ note above). Also owed: `translate-ui.js --langnames`, the `hr` `ui.json`
  pass, a native-speaker check of the `cyrillic-sr` table.
- **A device pass on the WHOLE `v81_a`…`v81_ad` UI-redesign arc — never done by the user.**
- **A device pass on the WHOLE `v83_b`…`v83_g` progress-card/question-card arc** — every check so
  far is an AGENT's browser pass, not the user's own.

## 6. NOT yours to start

Import "new" mode is POSTPONED. **Track A's CP1–CP3 report-only work (`PLAN §7.0`) is DONE, shipped
this line; CP4 onward needs the user to say so explicitly (see §3 above).** **Mastery-driven
progression (`PLAN §9b/D2`) remains a user product decision.** The learner/teacher rework —
`_canEdit()` is done; `Edit / rename topic` stays visible by user ruling.

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
  (via `llm.js`) + CLI. `canonical-analysis.json` is NOT committed by default.
- **`curriculum-plan.js` / `build-curriculum-plan.js`** (`v83_j`, CP3) — deterministic core (NO model
  call) + CLI. Reads CP2's output as input, `lessons.json` read-only for comparison.
  `curriculum-plan.json` is NOT committed by default. Do NOT `require` server.js from ANY of the
  three CP files (binds a port as a side effect).
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
- `_tutorGatherContext()` / `/api/tutor` — `uiLang` (reply language) ADDITIVE alongside `srcLang`.
- `openCompNav()`/`closeCompNav()`/`openSumNav()`/`closeSumNav()`/`_closeCardNavPopups()` (`v83_c`/
  `v83_d`) — one popup per card.
- `_mirrorNavBtn(srcId, dstId)` (`v83_d`, glyph-mirroring dropped `v83_e`).
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path. See `INTERNALS.md` §6b before extending it.
