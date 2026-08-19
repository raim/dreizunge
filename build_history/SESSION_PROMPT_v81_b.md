# Session prompt — written at the `v81_b` cut (end of session 36)

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v80_z.md` was the
previous one — superseded by this file and renamed, not kept alongside.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v81_a`** cut.

> **THE DOCUMENT SET IS TWO FILES.**
> - **`build_history/roadmap_v81.md`** — durable. Protocol, standing rules, the open sections,
>   **TRACK T**, and the folded **THE LARGER PLAN**. Searched, never read cold.
> - **this prompt** — the only document that describes "now".
>
> **`roadmap_v80.md` is KEPT, not superseded.** The whole v80 line's release history
> (`v80_a` … `v80_z`) lives there under `# SHIPPED IN THE v80 LINE`. Go there for how something was
> built or why a guard is shaped the way it is. `HANDOVER.md` and `implementation_plan.md` no longer
> exist — folded in at `v80_d`. **Do not recreate them.**

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v81.md` — its **index table** and the **⚠️ Session protocol** block first,
   then **TRACK T** (the current focus), then the standing RULES.
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 230 checks
node test/run.js --quick                  → expect 206
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **323 topics, 91 storylines, 33 languages, 617 `en` keys**.
`APP_VERSION = 'v81_b'`.

> **These four expectations and the four corpus numbers are GUARDED** by `unit-roadmap-version`
> against the actual suite and against the data files. **If that test fails, the number in THIS file
> is the thing to fix.**

- `unit-static-freshness` red → `node build-static.js`. **Read what it NAMES first.**
- `unit-script-choice` red saying topics are unstamped → `node backfill-script.js --write`.
- **Order matters: backfill FIRST, build-static SECOND.** A fixer is not a diagnosis (rule 23).

## The five habits that cost this project the most

1. **Measure before editing.** A warning in the notes is a claim about a DESIGN, not about the
   problem (rule 35).
2. **Guard at the layer where the claim is observable** (rule 34). **A guard that pins SOURCE TEXT
   for a claim about BEHAVIOUR cannot fail** — this cost two releases (`v80_c`, `v80_s`). Render and
   inspect, then **MUTATION-TEST**: break the rule and check the guard goes red. If it does not, the
   guard is wrong, however green the suite is.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.** "The
   tests still pass" is a weaker claim — at `v80_q` the whole suite was green with a real
   contamination bug in place, found only by diffing 59 real chapter/user pairs.
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`). Any test that
   samples the corpus must accumulate across builds and be verified over ~15 consecutive runs. Six
   successive versions of `unit-tap-word` were flaky, and **every failure was the TEST being wrong
   about correct behaviour.**
5. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc. And
   **check what a mechanical rewrite DID** — `v80_d`'s blanket replace mangled six sentences
   including a heading.

---

# WHERE TO START

## 1. ⚠️ THREE RULINGS THE USER OWES — nothing large should start before these

- **`§T7`, the SCOPING question** (roadmap TRACK T). *"A wrong answer should decrease the solved
  counter."* **HIGHLIGHT-ONLY** (contained, one session, needs a second per-word counter) or **THE
  WHOLE COVERAGE MODEL** (its own release, and it MUST re-run `probe_gates_v80c1.js` and
  `probe_gates_v77.js`)? The solved store is MONOTONIC and is read by coverage, chapter completion,
  the pass mark, `storyUnlocked` and both resume scans — so reading 2 means **a finished chapter can
  become unfinished and an unlocked story can RE-LOCK mid-session.** Reading 1 is what TRACK T needs;
  reading 2 is mastery decay, which is `PLAN §9b/D2` and already blocked on `§8/B4`.
- **The WORD GATE switch** (`v81_a`, shipped OPT-IN). Whether to turn it on, and at what fraction.
  **Switching it on at 1.0 today would re-lock 95% of earned stories** — measured. The numbers are in
  the roadmap's T4 entry.
- ~~Entry cards for chapters > 1~~ **✅ RULED AND SHIPPED at `v81_b`**: a later chapter lands on its
  PROGRESS CARD; the entry card is the first chapter's alone. See the roadmap's `v81_b` entry.

## 2. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 3. BUILDABLE NOW, no ruling needed

- **`PLAN §8/B1`, the observations log** — still **the only item whose value DECAYS while it waits**,
  because the existing `{seen, wrong}` counters cannot be replayed. TRACK T makes it MORE valuable:
  per-word question history is exactly what that design reads.
- **`PLAN §C1`'s FIRST gate bug** — *"browsed forward to the story card and back, solved no
  comprehension lesson, yet could proceed."* **⚠️ TWO readings are already DEAD ENDS** — see the
  `v80_b` entry in `roadmap_v80.md` before spending time. What is unmodelled is the BROWSING
  sequence, not a lesson play.
- **`PLAN §C1`'s single-chapter `1/1` and 100% bar**, and the header off-by-one — plausibly one root
  cause in `_slProgressStats`.
- **`PLAN §F2`'s second half** — the "answer visible in the stem" detector, measured and deliberately
  left unenforced because prefix-matching is mild morphology. Reported by
  `probe_word_forms_defects_v80g.js`.

## 4. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — the article prompt fix shipped at `v80_j` and is **UNVERIFIED BY DESIGN**.
  Regenerate MANY lessons, then re-run `probe_article_symmetry_v80j.js` against its baseline: **1.0%
  overall but BIMODAL** (191 chapters at 0%, two at 100%). **One lesson proves nothing** —
  `tp_17869977371640000022` went 7-of-8 to 0-of-8 BEFORE the fix shipped.
- **`summary.title` was retired at `v80_y`**; `lesson.read_summary` replaces it in all 32 languages.
  No translate pass is owed for it.
- **The translate pass** for the remaining `en`-only keys, `translate-ui.js --langnames`, the
  `hr` `ui.json` pass, and a **native-speaker check of the `cyrillic-sr` table**.
- **A device pass on `v81_a`.** The v80 line changed every card and every question screen: the story
  panel is on all of them, never collapsed, three-state coloured, tappable, with a translate toggle;
  the progress bars moved to the bottom; the storyboard row became clickable chapter icons.

## 5. NOT yours to start

Import "new" mode is POSTPONED. **Track A (ingest, `PLAN §7`)** and **Track B beyond B1** need the
user. **Mastery-driven progression (`PLAN §9b/D2`) must NOT be decided** until `§8/B4` has run BKT in
shadow mode. The learner/teacher rework — `_canEdit()` is done; `Edit / rename topic` stays visible
by user ruling.

**Do not re-derive the per-text learning scheme measurements.** A chapter's lessons teach **9.2% of
its story's tokens, 8.2% of its distinct words**, rarest words least covered (**5.1%**). Inflection
share measured at `v80_f`: **47.3% of taught words are findable in the story, 36.4% ABSENT in any
form**, and a matcher is worth ~10 points, not fifty — **the ceiling is a GENERATION problem.**

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b.**

- `probe_gates_v80c1.js` — the `PLAN §C1` gate probe. Reports, does not assert.
- `probe_gates_v77.js` — re-run **and diff** after any progress-card change. **⚠️ It SELECTS its
  chapters from the corpus, so a data drop moves the selection.** This has looked like a regression
  at two consecutive cuts and been data both times. **Disambiguate by re-running the PREVIOUS client
  against the CURRENT corpus** — one command. Baseline: `v80i_card_gates.txt`.
- `probe_learner_known_v80l.js` — what TRACK T's colouring actually paints: **84% RED, 8.7% green**.
- `probe_inflection_v80f.js`, `probe_article_symmetry_v80j.js`, `probe_lesson_script_v80h.js`,
  `probe_word_forms_defects_v80g.js`, `probe_forks_v79k.js`, `probe_coverage_v78n.js`.
  **All report; none assert.** The article one is explicitly NOT language-blind — its article lists
  must never migrate into the app.
- `_cardErrors()` — assert it is empty after any card render you add.
- `_storyBodyHtml(d, opts)` — **the ONE story renderer** for question panels and progress cards.
- `_wordProgress(d)` / `_wordState(rec)` — **the ONE per-word progress collector.**
- `_storyLockedLesson(L, d)` — the ONE "is this lesson closed" rule.
- `_cardHeader(prefix)` + `.card-screen` — every new card page uses both.
- `scriptPinNote(lang, script, role)` — every prompt emitting target-language text calls it.
