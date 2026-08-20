# Session prompt — written at the `v81_i` cut (end of session 38)

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v81_h.md` was the
previous one — superseded by this file and renamed, not kept alongside.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v81_i`** cut.

**Session 38 shipped one user ruling, delivered directly rather than queued, and started nothing
else.** `v81_i`: the lesson-path's SEQUENTIAL lock ("previous lesson done") is removed — it was
already unenforced everywhere except this one render (`_firstUnfinishedLessonIdx`'s `_playable`
never read it, `tapWord` bypasses it: 438 of 447 taps, 98%, on a fresh learner). The STORY GATE
(`_storyLocked`, `v80_b`) is untouched and is now the only lock a lesson-path node can carry.

**Session 37 shipped two user-reported bug fixes plus the `§T7` ruling.** `v81_c`: arriving at a
later chapter is not finishing it — the progress card's Next was skipping the comprehension lesson
(52 of 72 chapters walked on to the NEXT chapter) and the card announced "Lesson complete!" on
arrival. `v81_d`: a word is graded only on questions a round can BUILD — 52% of highlighted words
could never turn green because the denominator counted unbuildable questions. `v81_e`: the user
ruled `§T7` reading 1 (HIGHLIGHT ONLY) and it shipped — a wrong answer demotes a word from green to
amber without touching the solved store. `v81_f`: a tap on a word with no question now opens the
lesson that TEACHES it (dead taps 181 → 79). `v81_g`: the storyline bar measures COMPLETION, so no
deck shows green before anything is played. `v81_h`: a hidden lesson's words leave the story panel,
which takes dead taps to zero.

**⚠️ A STANDING USER RULE was given in session 37 and is IN FORCE UNTIL REVOKED** — one learner only,
so progress impact is not a blocker on shipping. See the roadmap's STANDING RULE block; it does NOT
license skipping measurement. **All seven need a device pass; see
`build_history/v81h_session37_notes.md` for `v81_c`…`v81_h` (what to click, including the
containment check that matters most on `v81_e`) and `build_history/v81i_session38_notes.md` for
`v81_i`.**

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

Corpus at this cut (unchanged this session): **323 topics, 91 storylines, 33 languages, 617 `en` keys**.
`APP_VERSION = 'v81_i'`.

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
   samples the corpus must accumulate across builds and be verified over ~15 consecutive runs. Seven
   successive versions of `unit-tap-word` were flaky, and **every failure was the TEST being wrong
   about correct behaviour.** The seventh was repaired at `v81_d` (0 in 40 now), and its lesson is
   sharper than "accumulate": **accumulating across builds is not the same precondition as
   CO-OCCURRING in one build.** A fixture chosen on the union satisfied the first and not the second.
   Attribution was settled by running the same 40-iteration protocol against the PREVIOUS client —
   1 in 40 there too, so it was pre-existing. Do that before blaming your own change. **It then flaked
   an EIGHTH time at `v81_h`, in a section written that same session**, and the same repair applied:
   ⚠️ **when a section needs the run to contain something, STEER it there and skip the build if it
   cannot — do not sample and hope.** Note also that this one was caught only because the PACKAGED
   copy failed where the source tree had just passed: **run the suite in the staged release
   directory, not only in the working tree.** Re-run as the standing precaution at `v81_i` (not
   touched by that release's change): **0 failures in 40 consecutive runs.**
5. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc. And
   **check what a mechanical rewrite DID** — `v80_d`'s blanket replace mangled six sentences
   including a heading.

---

# WHERE TO START

## 1. ✅ NO RULING IS CURRENTLY OWED — the queue is clear

*(`v81_i`'s sequential-lock removal was a ruling delivered directly by the user, not drawn from
this list — nothing below was open because of it, so nothing here changes.)*

All three items that headed this section at the `v81_b` cut are closed:

- ~~`§T7`, the SCOPING question~~ **✅ RULED at `v81_e`: reading 1, HIGHLIGHT ONLY** — a wrong answer
  takes a word out of green via a PARALLEL `wrong` store; the solved store stays monotonic. `§T7` in
  the roadmap is now marked RULED AND SHIPPED. ⚠️ **Reading 2 (mastery decay) is NOT ruled**, remains
  `PLAN §9b/D2`, and is still blocked on `§8/B4`. If it is ever re-opened, start from the fact that
  the roadmap's original reader list was incomplete — the ROUND BUILDERS read the solved store too.
- ~~The WORD GATE switch~~ **✅ RULED at `v81_a`: leave it off.** ⚠️ Its numbers went stale at
  `v81_d`; re-measure before re-opening.
- ~~Entry cards for chapters > 1~~ **✅ RULED AND SHIPPED at `v81_b`.**

**So the next session can start on something buildable without waiting.** The largest owed item is
not a ruling but a DEVICE PASS — see §4.

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
- ~~`PLAN §C1`'s single-chapter `1/1` and 100% bar, and the header off-by-one~~ **✅ RULED AND SHIPPED
  at `v81_g`**: the BAR now measures completion, the LABEL still counts unlocked chapters (`v77_p`).
  One root cause, and NOT the index off-by-one the plan guessed. `PLAN §C1`'s FIRST gate bug is
  still open and still has two dead-end readings.
- ~~DEAD TAPS, 26.1%~~ **✅ CLOSED — `v81_f` + `v81_h` take them to ZERO.** Kept here only as the
  measurement trail; nothing is owed. (Original note follows.) **✅ MOSTLY FIXED at `v81_f`** by user ruling (route the tap into the teaching
  lesson): 181 dead taps → **79**. **⚠️ WHAT REMAINS IS A DIFFERENT QUESTION, and it is a HIGHLIGHTING
  one:** all 79 are words whose ONLY teaching lesson is HIDDEN. They are marked on the story panel,
  graded by `_wordProgress`, and unreachable — `startLesson` correctly refuses a hidden lesson, so
  `false` is the honest answer for them. **The open decision: should the panel mark a word at all
  when its only teaching lesson is hidden?** Not a tap fix; needs a ruling.
  `probe_tap_reachable_v81d.js` measures it — ⚠️ it now CALLS `tapWord` rather than reading the
  question resolver, because the resolver's answer is deliberately unchanged (still no question for
  all 181); pinned one layer down it reported no improvement from a release that fixed 102 cases.
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
- **A device pass on `v81_a` … `v81_i`.** The v80 line changed every card and every question screen: the story
  panel is on all of them, never collapsed, three-state coloured, tappable, with a translate toggle;
  the progress bars moved to the bottom; the storyboard row became clickable chapter icons.
  `v81_i` adds one more thing to look at: ordinary lessons on the node path are clickable out of
  order now — see `build_history/v81i_session38_notes.md` for what should still stay locked.

## 5. NOT yours to start

Import "new" mode is POSTPONED. **Track A (ingest, `PLAN §7`)** and **Track B beyond B1** need the
user. **Mastery-driven progression (`PLAN §9b/D2`) must NOT be decided** until `§8/B4` has run BKT in
shadow mode. The learner/teacher rework — `_canEdit()` is done; `Edit / rename topic` stays visible
by user ruling.

**⚠️ THE TRACK T COLOURING NUMBERS MOVED AT `v81_d`** — the denominator used to count questions no
round can build. GREEN 18.6% → **27.8%**, PARTIAL 19.5% → **11.8%**, mean questions per word 2.20 →
**1.79**. So `§T5.1`'s "mean 1.70", `§T5.4`'s "84% RED" and `v81_a`'s 95% re-lock were all measured
against the inflated figure. **No ruling is reversed; none may be re-opened without re-measuring**
via `probe_word_green_impact_v81d.js` (NOT `probe_learner_known_v80l.js`, which re-derives the
colouring inline and cannot see inside `_wordProgress`).

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
- `probe_word_green_impact_v81d.js` — what TRACK T's colouring paints, **through `_wordProgress` /
  `_wordState`**. `PROBE_CLIENT=` diffs two builds. Use this one for anything about the screen.
- `probe_word_green_v81c.js` — declared probe keys vs the BUILDABLE universe (60.8% at `v81_d`).
- `probe_comp_skip_v81c.js` — drives `showComplete(true)` over every later chapter and CLICKS
  `comp-next`. Re-run after ANY change to the progress card's Next wiring.
- `probe_tap_reachable_v81d.js` — highlighted words whose tap resolves to nothing.
- `probe_learner_known_v80l.js` — the older colouring probe. ⚠️ **It RE-DERIVES the colouring inline**
  rather than calling `_wordProgress`, so it is blind to changes inside the collector and did not move
  at all across `v81_d`. Its "84% RED, 8.7% green" predates that fix.
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
