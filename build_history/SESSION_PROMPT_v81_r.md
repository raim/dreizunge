# Session prompt — written at the `v81_r` cut (end of session 41)

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v81_q.md` was the
previous one — superseded by this file and renamed, not kept alongside.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v81_r`** cut.

**Session 41 shipped `v81_r`: `PLAN §C0.3`, a FIFTH surface seamed — the teacher dashboard,
chosen directly by the user.** After `v81_q`, the plan's own remaining named examples (QC/editing,
library browsing) turned out on measurement NOT to be clean separable screens — `lesson-set` and
`storyline-screen` each mix browsing with scattered edit/QC controls, matching the plan's own words
that these are "scattered controls or panels." Rather than guess which to scope first, three
measured options plus a lock-behaviour-only option were put to the user directly; **the ruling:
`teacher-screen` first** — smallest, not on the plan's original four-name list, but the only
remaining screen with zero seam coverage. `showTeacher()` added as a thin delegate to the existing
`openTeacherDashboard()`; both external callers rerouted (2 sites — the entry button and the
dashboard's own refresh button); no `build-static.js` reroute needed, since the static build hides
the entry button entirely (backend/teacher-only). A new journey added to
`test/unit-ui-journeys.test.js`, mutation-tested (breaking the delegation turned it red). Along the
way, documented a previously-unwritten harness fact in `INTERNALS.md` §5: `lib-dom`'s fake document
never parses STATIC markup outside the `<script>` block, so a static button's inline `onclick`
cannot be "clicked" by `querySelector` the way a JS-assigned handler like `comp-next`'s can — the
new journey's exit half calls `showGenerationClean()` directly instead, and says why. `storyline-
screen` and `lesson-set` remain the two genuinely open, harder-to-scope surfaces if this track
continues. See the roadmap's `v81_r` entry for the full write-up.

**Session 40 ran across two agents: Codex shipped `v81_k`/`v81_l`, then ran out of session budget
mid-work; Claude Code picked up the uncommitted state and shipped `v81_m` through `v81_q`.**
`v81_q`: `PLAN §C0.4` — `_renderCompStoryboard` and its two single-caller helpers DELETED, a
**genuine, considered exception to "measure, don't ask"**: the roadmap's own `v80_z` entry carried
an explicit standing warning against exactly this deletion ("deleting it was never the ask... a
guard that did not say so would let a future session remove it"). A caller search found zero live
callers anywhere — including the storyline page, which `v80_z` believed still used it (confirmed
false by reading: it embeds the raw board SVG directly, unframed). Rather than pick a reading, both
possibilities (proven-dead vs. a silent regression in real, tested functionality) were presented to
the user; **the user ruled: delete.** Five test files touched for five different reasons — one
deleted outright (`unit-storyboard-frames.test.js`, 155 lines that tested the helpers only in
isolation, never proving they were wired into anything — the "tests the helper, not the caller"
shape that let this go unnoticed), one section rewritten to keep what's still true (`unit-learner-nav`
§4c), one executed section removed (`smoke-render` §12), one dead line removed
(`unit-card-errors.test.js`), one comment left alone as valid history (`lib-dom.js`). Also updated
`roadmap_v80.md`'s `v80_z` entry itself with a pointer, rather than leaving its warning looking
silently contradicted.

**`v81_p`: `PLAN §C0.3`'s SECOND bounded surface** — "progress/card state plus story navigation." All
10 remaining EXTERNAL callers of `showComplete(...)` rerouted onto `showProgressCard(...)` (9 in
`index.html`, 1 in `build-static.js`, same "both files" pattern as `v81_o`). Two internal self-calls
inside `showComplete`'s own body deliberately left untouched — implementation detail, not an entry
point. Mostly guarded by EXISTING behavioural tests (DOM clicks), which is why few pins broke despite
the size; two did break in `unit-learner-nav.test.js` and both were true positives, fixed. Mutation-
tested five structurally distinct call sites; one was caught by a DIFFERENT test file than first
suspected (`unit-next-chapter-entry.test.js`, not `unit-learner-nav.test.js`) — re-run against the
right file rather than concluding the site was unguarded. **Found, not fixed:** `build-static.js`'s
`loadSaved` is missing the entire `_isLaterChapter()` branch `index.html` has — a real, pre-existing
static/live divergence, left for its own measurement.

**`v81_o`: `PLAN §C0.3`'s FIRST bounded surface** — generation is now FULLY behind the router seam, per
the plan's own ordering ("start with generation and settings"; settings was already done at `v81_n`).
All 14 remaining callers of `goLanding`/`goLandingClean` (3 + 3 JS, 7 inline HTML "home" buttons)
rerouted onto `showGeneration()`/`showGenerationClean()` — the latter a NEW seam function, kept
separate because `goLandingClean` additionally resets the URL hash and folding it into
`showGeneration` would have silently dropped that. `build-static.js`'s OWN re-implementation of
`loadSaved` needed the same fix — INTERNALS' documented "both files" risk, not hypothetical:
`unit-learner-nav`'s static-parity check caught the miss immediately. Three pre-existing source-text
pins in `unit-learner-nav.test.js` broke as a result (true positives, all fixed, all now point at
`showGenerationClean()` with a comment naming this release). Mutation-tested three ways, all caught.
An unrelated one-off e2e flake (`e2e-lesson-edit-roundtrip`) surfaced once during a full-suite run
and did not reproduce in 3 standalone re-runs — not this release's doing, noted rather than chased.

**`v81_n`: `PLAN §C0.2`, the router seam.** `APP.screen` is the one authoritative route state, written
only by `show(id)` (already the single funnel for all 21 existing screen transitions — a one-line
change). Four explicit renderers (`showProgressCard`/`showStory`/`showGeneration`/`showSettings`)
exist as thin, documented delegates to the functions that already render their screen — nothing
about HOW a screen renders changed. **Deliberately narrow at the time**: only the two call sites that
were each their underlying function's SOLE caller got rerouted (`compNext.onclick` → `showStory()`,
the settings pill → `showSettings()`); `showComplete`'s 15+ other callers were left for later, and
`goLanding`'s callers are the ones `v81_o` above just finished. Mutation-tested six ways; one
mutation (dropping `showSettings`'s event argument) passed on the first attempt because the test
harness models no real event bubbling — closed with a direct spy rather than left uncovered. Also
found and fixed, unrelated to this change: `test/unit-next-chapter-unlocked.test.js` was a dead test
for code deleted at `v80_e`, never registered in `test/run.js`, deleted in its own commit.

**`v81_m`: `PLAN §C0.1`, journey-transition tests** — test-only, no functional change. Locks the
rendered/interactive outcome of the learner walk (progress card → story-unlock → lesson →
`confirmQuit()` back), the generation landing→cached-generation→landing walk, and the settings
popover open/close, all of which `§C0.2`'s router seam had to preserve (and now does). Verified
independently before committing: ran standalone and inside the full suite (both green), and
mutation-tested one assertion (forcing `_showUnlock` to always route past the story-unlock screen)
to confirm it is not vacuous.

**Session 40 also shipped `v81_l`: `PLAN §8/B4`, BKT in shadow mode.** A newly appended graded
observation now recomputes canonical skill mastery from the append-only log using a fixed, explicit
prior (`.20`) and the plan's `.15/.10/.20` learn/slip/guess parameters. `APP.progress.bktShadow`
stores the derived skill state, tagged-topic comparisons, and only changed disagreement pairs with
the existing completion/pass-mark result. It is shown nowhere and cannot affect a gate, renderer,
picker, or progression. Pending/legacy topics without reviewed vocabulary IDs remain incomparable.
The BKT and live observation guards were mutation-tested. Full / quick suite: **235 / 209**; corpus
unchanged at **323 topics, 91 storylines, 33 languages, 617 `en` keys**.

**Session 39 shipped `v81_k`: `PLAN §8/B2–B3`, the target-language skill registry and vocabulary
tagging foundation.** `skills.json` is server-side, separate from `lessons.json`; model-proposed
`<target>:vocab:<dictionary-form>` IDs become usable only after explicit review/registration or a
reversible alias. A disposable browser pass registered `it:vocab:successione`, played it, and
confirmed the first-attempt observation with that exact canonical ID.

**Session 38 shipped two things and started nothing else.** `v81_i`: one user ruling, delivered
directly rather than queued — the lesson-path's SEQUENTIAL lock ("previous lesson done") is
removed, since it was already unenforced everywhere except this one render
(`_firstUnfinishedLessonIdx`'s `_playable` never read it, `tapWord` bypasses it: 438 of 447 taps,
98%, on a fresh learner). The STORY GATE (`_storyLocked`, `v80_b`) is untouched and is now the only
lock a lesson-path node can carry. `v81_j`: `PLAN §8/B1`, the observations log — an append-only
`APP.progress.observations`, one record per graded answer, wired into `check()`. It was the largest
buildable-now item at the `v81_i` cut, flagged as the only one whose value decays while it waits.
No UI; ships silently. `skillId`/`userId` are `null` by design (skill tagging is `§8/B2`, auth is
`PLAN §9` R3 — neither exists yet).

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
license skipping measurement. **Seven of the eight need a device pass; see
`build_history/v81h_session37_notes.md` for `v81_c`…`v81_h` (what to click, including the
containment check that matters most on `v81_e`) and `build_history/v81i_session38_notes.md` for
`v81_i`. `v81_j` ships no UI — nothing to click; see `build_history/v81j_session38_notes.md` if you
want to eyeball the log in the console anyway.**

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
node test/run.js                          → expect 235 checks
node test/run.js --quick                  → expect 209
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut (unchanged this session): **323 topics, 91 storylines, 33 languages, 617 `en` keys**.
`APP_VERSION = 'v81_r'`.

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
   touched by that release's change): **0 failures in 40 consecutive runs.** `v81_j`'s own new file
   (`unit-observations-log.test.js`, which drives a real round through `check()`) ran clean **15
   times in a row** before shipping. `v81_m`'s `unit-ui-journeys.test.js` (inherited mid-flight from
   a different agent) was mutation-tested before being trusted and committed, not merely inherited —
   don't skip verification just because a guard already exists and already reads green. `v81_n`
   mutation-tested its own six claims and one PASSED that should not have: dropping `showSettings`'s
   forwarded event argument produced no observable difference, because the harness models no real
   event bubbling. **A mutation surviving is not proof the code is right — it may mean the test
   cannot see that particular failure mode.** Add a more direct assertion (here, a call-count spy)
   rather than accept the green. `v81_o` re-confirmed rule 34 from the OTHER direction: rerouting
   `goLanding`/`goLandingClean` callers broke THREE pre-existing SOURCE-TEXT pins in
   `unit-learner-nav.test.js` that had nothing to do with this session's own new tests — a reminder
   that "run the file I touched" is not the same precaution as "run the full suite before shipping."
   All three were true positives, not flakes, and all three needed the regex updated, not reverted.
   `v81_p` added a THIRD angle on the same rule: estimating the blast radius by grepping for source
   pins BEFORE editing found one real pin — the full-suite run afterward found two more the grep
   missed. **The grep is a sanity check, not a substitute for the run.** And a mutation that a test
   file does NOT catch is not automatically proof the call site is unguarded — one of five mutations
   here was silent in the file first suspected and caught cleanly by a different one
   (`unit-next-chapter-entry.test.js`); the fix was re-running against the right file, not concluding
   the site needed a brand-new guard. `v81_q` adds a rule of its own: **a zero-callers finding is not
   by itself permission to delete.** `_renderCompStoryboard` had zero callers AND a standing roadmap
   warning explicitly anticipating that exact finding and pre-emptively saying not to act on it alone
   ("deleting it was never the ask"). The caller search was necessary but not sufficient — what
   settled it was asking the user, presenting BOTH readings (dead vs. a silent regression) rather
   than picking one, and getting an explicit ruling. Measure, then check for a standing warning
   before assuming a measurement is the whole story, then ask if the two disagree.
5. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc. And
   **check what a mechanical rewrite DID** — `v80_d`'s blanket replace mangled six sentences
   including a heading.

---

# WHERE TO START

## 1. ✅ NO RULING IS CURRENTLY OWED — the queue is clear

*(`v81_i`'s sequential-lock removal was a ruling delivered directly by the user, not drawn from
this list — nothing below was open because of it, so nothing here changes. `v81_j`–`v81_l` (Track B)
and `v81_m`–`v81_r` (`PLAN §C0.1`–`§C0.4`, plus the FIFTH surface) all came from §3 below and are
struck there as they shipped. `v81_q`'s DELETE decision and `v81_r`'s "which surface next" choice
were both direct user rulings, given when the evidence alone could not settle the question — see the
roadmap's `v81_q` and `v81_r` entries.)*

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

- ~~`PLAN §8/B1`, the observations log; B2/B3 registry and new-vocabulary tags; B4 shadow BKT~~
  **✅ SHIPPED at `v81_j`–`v81_l`.** `APP.progress.observations` remains append-only; reviewed
  vocabulary IDs now feed `APP.progress.bktShadow`, which compares BKT only with the existing gate
  and controls nothing. `error_hunt`/`ai_error_hunt` and the crossword still grade differently and
  are NOT wired. The next Track B candidate is B5, a read-only aggregate surface, but it needs real
  reviewed evidence to be useful.
- **`PLAN §7.0` CP1, canonical text + report-only analysis records** — now the first buildable slice
  of the accepted parallel curriculum pipeline. It defines stable chapter/sentence/span/token IDs
  and provenance, but must not change existing lessons, player, learner progress, or publishing.
  See the durable roadmap diagram and migration sequence; CP1 comes before a new generator.
- ~~`PLAN §C0.1`, UI journey transition tests~~ **✅ SHIPPED at `v81_m`.** `test/unit-ui-journeys.test.js`
  locks the learner, generation, and settings entry/exit behaviour that `§C0.2`'s router seam must
  preserve.
- ~~`PLAN §C0.2`, the router seam~~ **✅ SHIPPED at `v81_n`.** `APP.screen` is the one authoritative
  route state; `showProgressCard`/`showStory`/`showGeneration`/`showSettings` exist as thin delegates.
- ~~`PLAN §C0.3`, generation moved behind the seam (first bounded surface)~~ **✅ SHIPPED at `v81_o`.**
  All 14 remaining `goLanding`/`goLandingClean` callers rerouted onto `showGeneration()`/
  `showGenerationClean()` (a new seam function — `goLandingClean` also resets the URL hash, kept
  distinct rather than silently dropping that). `build-static.js`'s own `loadSaved` reimplementation
  updated to match. Generation + settings, the plan's own FIRST surface, is now fully done.
- ~~`PLAN §C0.3`, progress/card state + story navigation (second bounded surface)~~ **✅ SHIPPED at
  `v81_p`.** All 10 remaining EXTERNAL `showComplete` callers rerouted onto `showProgressCard()` (9
  in `index.html`, 1 in `build-static.js`). `showComplete`'s own two internal self-calls are
  deliberately left as-is — implementation detail, not an entry point. **Nothing from `PLAN §C0`'s
  original example list remains un-seamed.** `unit-ui-journeys.test.js` is still the acceptance test
  for the FOUR original screens; extend it rather than bypass it if you touch any of them again.
  Found but NOT fixed at `v81_p`: `build-static.js`'s `loadSaved` is missing the whole
  `_isLaterChapter()` branch — a genuine static/live divergence, needs its own measurement before
  its own release.
- ~~`PLAN §C0.4`, remove proven-dead paths~~ **✅ SHIPPED at `v81_q`** (partially — one path found and
  removed by USER RULING, not a general sweep). `_renderCompStoryboard` + its two single-caller
  helpers deleted; zero live callers confirmed, but a standing `v80_z` warning meant the finding
  alone wasn't enough — the user was asked and ruled delete. **This is not "C0.4 is done"** — it is
  one dead path found and removed while working the C0.2/C0.3 surfaces, not an exhaustive dead-code
  sweep of the app. No new dead paths are known right now.
- ~~`PLAN §C0.3`, a FIFTH surface — the teacher dashboard~~ **✅ SHIPPED at `v81_r`**, by direct user
  ruling (not on the plan's original four-name list). `showTeacher()` delegates to
  `openTeacherDashboard()`; both external callers rerouted. **`storyline-screen` and `lesson-set`
  remain the two genuinely open surfaces** (the plan's "QC/editing" and "library browsing"
  examples) — measurement at `v81_r` found neither is a clean separable screen yet: both mix
  browsing with scattered edit/QC controls in one screen, so scoping either correctly is real work,
  not a rename. If this track continues, that scoping is the next step, not a guess at which
  control belongs to which future screen.
- **`PLAN §C1`'s FIRST gate bug** — *"browsed forward to the story card and back, solved no
  comprehension lesson, yet could proceed."* **⚠️ THREE readings are already DEAD ENDS** — see the
  `v80_b` entry in `roadmap_v80.md` before spending time (a third, `v81_j`, was added this session:
  the story-unlocked-page round trip, and cross-chapter browsing in BOTH the live and static
  builds — all driven through the real call chain, not traced by hand, all clean). **What is still
  unmodelled is the "Back LINK" specifically, distinct from the "← Back" button the third reading
  already covers — get the exact click sequence from the user before trying a fourth reading.**
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
- **`e2e-lesson-edit-roundtrip` flakes inside the FULL suite, still unfixed.** Re-confirmed at the
  `v81_r` baseline check: failed 1 of 235 on the first full-suite run of the session, then passed
  235/235 on an immediate re-run, and 3/3 standalone. Consistent with the `v81_q`-era note (2 of 4
  runs then), still nothing to do with the router-seam work — pure server-side lesson editing.
  Likely a port or teardown race with an adjacent e2e boot under load; not investigated further.
  Reproduce with several consecutive `node test/run.js` (not `--quick`, since `e2e-*` files are
  skipped there) before assuming a fix worked, and before blaming any future session's change.

## 4. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — the article prompt fix shipped at `v80_j` and is **UNVERIFIED BY DESIGN**.
  Regenerate MANY lessons, then re-run `probe_article_symmetry_v80j.js` against its baseline: **1.0%
  overall but BIMODAL** (191 chapters at 0%, two at 100%). **One lesson proves nothing** —
  `tp_17869977371640000022` went 7-of-8 to 0-of-8 BEFORE the fix shipped.
- **`summary.title` was retired at `v80_y`**; `lesson.read_summary` replaces it in all 32 languages.
  No translate pass is owed for it.
- **The translate pass** for the remaining `en`-only keys, `translate-ui.js --langnames`, the
  `hr` `ui.json` pass, and a **native-speaker check of the `cyrillic-sr` table**.
- **A device pass on `v81_a` … `v81_r`.** The v80 line changed every card and every question screen: the story
  panel is on all of them, never collapsed, three-state coloured, tappable, with a translate toggle;
  the progress bars moved to the bottom; the storyboard row became clickable chapter icons.
  `v81_i` adds one more thing to look at: ordinary lessons on the node path are clickable out of
  order now — see `build_history/v81i_session38_notes.md` for what should still stay locked.
  `v81_j`–`v81_p` ship no VISUAL change — the router seam changes which function ends up calling
  `show()`/`goLandingClean()`/`showComplete()`, never what gets rendered. **Worth a specific
  spot-check anyway**: the seven "🌍 home" buttons and the three JS generation-flow entries
  (`v81_o`), and the drill-completion flow, the story-unlocked page's Back/Next, the summary/finished
  cards' Forward/Back, and the ✕ quit button (`v81_p`) — all mechanically rewired across many
  scattered sites. `v81_q` removes code, not UI — the completion card's storyboard was ALREADY chapter
  icons since `v80_z`, so there is nothing new to look at, but it's worth confirming the card still
  looks exactly the same as before this cut. `v81_r` also ships no VISUAL change to the teacher
  dashboard's own rendering — only worth spot-checking that the "🎓 Learners" entry button and the
  dashboard's own 🔄 refresh button still open/refresh it (both now call `showTeacher()` instead of
  `openTeacherDashboard()` directly), which needs a teacher-mode session against a live backend to
  reach at all.

## 5. NOT yours to start

Import "new" mode is POSTPONED. **Track A's CP1 report-only analysis (`PLAN §7.0`) is now authorised;
new input/UI import mode remains postponed.** **Mastery-driven progression (`PLAN §9b/D2`) remains a
user product decision**: B4 now runs in shadow mode, but it
must accumulate a meaningful disagreement log before that decision is reconsidered. The
learner/teacher rework — `_canEdit()` is done; `Edit / rename topic` stays visible by user ruling.

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
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path (`v81_j`–`v81_l`). See `INTERNALS.md` §6b before extending it:
  only `check()`-graded exercises are logged, only resolved vocabulary IDs feed BKT, and no BKT
  value may become a reader of progression without a separate product ruling; `learners.js`'s
  `MAX_STATE_BYTES` growth ceiling remains unaddressed.
- `APP.screen` / `showProgressCard`/`showStory`/`showGeneration`/`showGenerationClean`/`showSettings`/
  `showTeacher` (`v81_n`–`v81_r`, `PLAN §C0.2`/`§C0.3`) — the router seam. See `INTERNALS.md` §6b
  before extending it: `showComplete`'s own TWO internal self-calls are deliberately NOT rerouted
  (implementation detail, not an entry point — `unit-coverage-threshold` pins one); `showSettings`
  deliberately does not correspond to a `.screen` (settings gets one under `PLAN §C4`, a separate
  track); `showGenerationClean` is NOT the same as `showGeneration` — it also resets the URL hash,
  and `build-static.js` has its OWN copy of that call site (keep both in sync); `showTeacher` has NO
  `build-static.js` copy to keep in sync — the static build hides its entry button entirely. **Nothing
  from `PLAN §C0`'s original four-name list has any external caller left un-seamed as of `v81_p`;
  `v81_r` added a FIFTH surface, chosen directly by the user rather than drawn from that list.**
- `test/unit-ui-journeys.test.js` (`v81_m`–`v81_r`, `PLAN §C0`) — the route-parity reference for the
  FOUR original screens plus the teacher dashboard. Extend it, don't bypass it, if you touch any of
  them again. ⚠️ Also grep the WHOLE suite for the function being rerouted before shipping ANY future
  reroute — `v81_o` broke three source-text pins in `unit-learner-nav.test.js` this file does not
  cover; `v81_p` broke two more the same way, and the pre-edit grep estimate missed two of the three
  actual breaks across both releases — the full-suite run is what caught them, not the grep. `v81_r`'s
  new journey needed a DIFFERENT exit technique than the other four — see `INTERNALS.md` §5, the
  STATIC-markup-is-never-parsed bullet.
- `build-static.js`'s `loadSaved` is missing the entire `_isLaterChapter()` branch `index.html` has
  (found at `v81_p`, not fixed) — a learner opening a later chapter in the STATIC build may not land
  on the progress card the way `v81_b`'s ruling intended. Needs its own measurement before a fix.
- `_renderCompStoryboard`, `_sbPanelSpans`, and `_sbFrameState` no longer exist (`v81_q`, `PLAN
  §C0.4`, direct user ruling — see the roadmap's `v81_q` entry and `INTERNALS.md` §6b). If you find a
  comment or an old branch still naming them, it's stale; the completion card's storyboard slot has
  been the chapter icon row since `v80_z`, and the storyline page renders the raw board SVG directly,
  unframed — neither path ever needs these three back. `_sbPanelChapter` is NOT part of this and
  stays, still driving the storyline page's own `_sbNavClick`/`_sbMarkCurrentPanels`.
