# Session prompt — written at the `v83_a` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v82_i.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v83_b`, `v83_c`, …) unless a future session has a good reason to switch to
`v84_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v83_a`** cut —
**a new BASE LINE**, cut at the user's own request rather than at a milestone-completion point, to
hand off a new feature to a clean-context session. No code changed at this cut; only
`roadmap_v83.md`, `INTERNALS.md`, and this file were written.

**The `v82` line, in brief** (full write-up in `roadmap_v82.md`): nine point releases
(`v82_a`…`v82_i`). `PLAN §D4` was built end to end — `writing`, the app's first PLAY-TIME-graded
lesson type, first shipping typos/grammar feedback via a live model call (`v82_e`), then reworked on
the user's own immediate follow-up into a real reading-comprehension question (source-language only)
with LLM correctness judging against the story (`v82_f`) — nothing owed on it structurally, one
measured rough edge left open (see `roadmap_v82.md`'s `v82_i` pointer table). Three independent
fixes followed, each found and fixed for its own reasons rather than requested: sentence-ordering
exercises length-gated to ≤5 words (`v82_g`, user request); the `e2e-lesson-edit-roundtrip` timing
flake FINALLY DIAGNOSED after being reconfirmed-but-not-traced across three prior releases —
`updatedAt`'s millisecond resolution was colliding under load, fixed with a monotonic `stampUpdated()`
helper (`v82_h`); and difficulty-tiered furigana density RESTORED after being found dead at `v82_c`
(`v82_i`) — whose own first attempt at the "advanced/sparse" tier was live-tested and found NOT to
work, then fixed with a concrete worked example and re-verified. **The throughline worth carrying
into this cut**: in both `v82_e`'s and `v82_i`'s corrections, the FIRST reasonable-looking prompt/
model choice was wrong, and only a real generation against the real model — not source-reading, not
a plausible design — caught it. `PLAN §12` below is exactly this kind of feature; budget accordingly.

## This is a new BASE LINE, cut from `v82` at `v83_a`

**Why now**: not a milestone-completion cut in the `v80`→`v81`/`v81`→`v82` sense — the user asked for
a fresh session to hand off a new feature (`PLAN §12` below) and asked for the cut explicitly, having
noticed (correctly) that this session had already run nine point releases across a full lesson-type
build-out plus three independent fixes, which is comparable accumulated-context ground to the two
prior cuts even without a single closing milestone.

**`roadmap_v82.md` is kept, not superseded** — the whole `v82` line's release history (`v82_b` …
`v82_i`) lives there under `# SHIPPED IN THE v82 LINE`. Go there for how something was built or why a
guard is shaped the way it is. **`roadmap_v83.md` is the new current file** — it carries forward the
protocol, standing rules, `§0`/`§0i`, TRACK T, and THE LARGER PLAN unchanged, with a short
"where to find it" pointer table replacing the v82 line's release write-ups, and a NEW `PLAN §12` for
the feature this cut exists to start. See its own header for the exact carried/not-carried split.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v83.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES. (Nothing is in TRACK T right now — steps 1–4 and `§T7` all shipped in
   the v81 line.)
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives. It documents the
   tutor's existing machinery in full (`_tutorGatherContext`, `_tutorRenderScope`, `/api/tutor`) —
   the closest precedent `PLAN §12` has, so read that entry before designing the new route.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 251 checks
node test/run.js --quick                  → expect 224
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **327 topics, 92 storylines, 33 languages, 651 `en` keys** (unchanged from the
`v82_i` cut — no corpus content changed to produce this cut, only the roadmap/session-prompt
documents and the `APP_VERSION` bump below). None yet translated — needs the offline translate pass
before those languages catch up.
`APP_VERSION = 'v83_a'` — bumped here with no other code change, because `unit-roadmap-version`
ties the two together mechanically: the highest-numbered `roadmap_v*.md` file on disk IS what
defines the current base, independent of whether a feature shipped alongside the cut.

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
2. **Guard at the layer where the claim is observable** (rule 34). A guard that pins SOURCE TEXT for
   a claim about BEHAVIOUR cannot fail — cost multiple releases across the v80/v81 lines. Render and
   inspect, then **MUTATION-TEST**: break the rule and check the guard goes red.
3. **For any refactor claiming to preserve behaviour, CAPTURE the old output and DIFF it.** "The
   tests still pass" is a weaker claim — a whole suite has been green with a real contamination bug
   in place before, found only by diffing real data.
4. **`buildExercises` is NON-DETERMINISTIC IN CONTENT, not just order** (`v80_t`). Any test that
   samples the corpus must accumulate across builds and be verified over ~15 consecutive runs — and
   accumulating across builds is NOT the same precondition as co-occurring in ONE build. When a
   section needs the run to contain something specific, STEER it there rather than sampling and
   hoping. Run the suite in the staged release directory too, not only the working tree.
5. **A zero-callers finding is not by itself permission to delete** (`v81_q`). Check for a standing
   warning before assuming a measurement is the whole story; ask the user if the two disagree.
6. **Never put emoji in a Python string literal** (rule 25); write them via a `cat` heredoc. And
   check what a mechanical rewrite DID, not just that it ran.
7. **A live model call needs a live test, not a plausible prompt** (`v82_e`, `v82_i`). The first
   reasonable-looking design was wrong both times this line tried it; only generating against the
   real model and reading the actual output caught it.
8. **Ask before restarting a dev server you did not start, and before deleting data you did not
   create** (`v82_e`, `v82_f`). Check `lessons.json`'s mtime and the server's reported version
   before touching either.

---

# WHERE TO START

## 1. `PLAN §12` — the interactive text-selection tutor, the reason for this cut

Read `roadmap_v83.md`'s own `PLAN §12` entry in full before starting — it lays out what already
exists to reuse (the per-word tap mechanism, `/api/tutor`'s live-call shape), what is genuinely new
(a second, coexisting selection mechanism over the same story container; a student-turn-pre-filled
tutor call, not the existing `opening:true` shape), and flags the ONE real ruling needed before the
request payload can even be designed: **does the tutor reply in `APP.uiLang` for this new flow only,
or does the whole tutor move off `srcLang`?** Get that answered by the user before building — it
changes whether `/api/tutor` needs a new optional field or a wider, back-compatible change to
`_tutorGatherContext()` itself.

## 2. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 3. BUILDABLE NOW, no ruling needed

- **`PLAN §7.0` CP1, canonical text + report-only analysis records** — the first buildable slice of
  the accepted parallel curriculum pipeline. It defines stable chapter/sentence/span/token IDs and
  provenance, but must not change existing lessons, player, learner progress, or publishing. See the
  durable roadmap diagram and migration sequence in `roadmap_v83.md`'s THE LARGER PLAN section; CP1
  comes before a new generator.
- **`PLAN §C1`'s FIRST gate bug** — *"browsed forward to the story card and back, solved no
  comprehension lesson, yet could proceed."* **⚠️ THREE readings are already DEAD ENDS** — see the
  `v80_b` entry in `roadmap_v80.md` and the `v81_j` addendum in `roadmap_v81.md` before spending time
  on it (story-unlocked-page round trip and cross-chapter browsing, both builds, all clean). **What
  is still unmodelled is the "Back LINK" specifically, distinct from the "← Back" button the third
  reading already covers — get the exact click sequence from the user before trying a fourth
  reading.**
- **The dead-taps HIGHLIGHTING question** — closed to zero for the tap itself (`v81_f`+`v81_h`), but
  a different, still-open decision remains: **should the story panel mark a word at all when its
  ONLY teaching lesson is hidden?** `probe_tap_reachable_v81d.js` measures it. Needs a ruling before
  building either direction.
- **`PLAN §F2`'s second half** — the "answer visible in the stem" detector, measured and deliberately
  left unenforced because prefix-matching is mild morphology. Reported by
  `probe_word_forms_defects_v80g.js`.
- **`PLAN §D4`'s one measured rough edge** — on a completely off-topic writing answer specifically,
  the grading model sometimes folds a content comment into the language-issues list as a fake
  arrow-format "correction" on a sentence with no actual mistake. Harmless to the learner, a real but
  minor prompt-compliance gap. If picked up: reproduce across more than the three verdicts `v82_f`
  tested before deciding whether it is worth a prompt change, and measure against several REAL
  learner answers, not just synthetic ones — the same "one lesson proves nothing" caution `PLAN §F3`
  already carries elsewhere in this document.

## 4. ⚠️ OWED BY THE USER, not doable in a container

- **`PLAN §F3`** — the article prompt fix shipped at `v80_j` and is **UNVERIFIED BY DESIGN**.
  Regenerate MANY lessons, then re-run `probe_article_symmetry_v80j.js` against its baseline: **1.0%
  overall but BIMODAL** (191 chapters at 0%, two at 100%). **One lesson proves nothing.**
- **The translate pass** for the remaining `en`-only keys, `translate-ui.js --langnames`, the `hr`
  `ui.json` pass, and a **native-speaker check of the `cyrillic-sr` table**.
- **A device pass on the WHOLE `v81_a`…`v81_ad` UI-redesign arc — never done by the user.** The v80
  line changed every card and question screen; `v81` then split generation off the landing page
  (`§C5`) and built the Settings Card with its floating pills, mute-pill consolidation, and the
  language/speech mismatch pills (`§C4`). Every individual release from `v81_x` onward carries its
  own "verified live" paragraph in `roadmap_v81.md` from an AGENT's browser pass — that is not the
  same thing as the user's own device pass, and none of it has happened yet. Read `roadmap_v81.md`'s
  own release entries (`v81_w` onward especially — the first and biggest real visual changes) for
  exactly what to click through; `build_history/v81i_session38_notes.md` also still applies for what
  should stay locked on the lesson path.

## 5. NOT yours to start

Import "new" mode is POSTPONED. **Track A's CP1 report-only analysis (`PLAN §7.0`) is authorised;
new input/UI import mode remains postponed.** **Mastery-driven progression (`PLAN §9b/D2`) remains a
user product decision**: B4 runs in shadow mode, but it must accumulate a meaningful disagreement log
before that decision is reconsidered. The learner/teacher rework — `_canEdit()` is done; `Edit /
rename topic` stays visible by user ruling.

**⚠️ THE TRACK T COLOURING NUMBERS MOVED AT `v81_d`** — the denominator used to count questions no
round can build. GREEN 18.6% → **27.8%**, PARTIAL 19.5% → **11.8%**, mean questions per word 2.20 →
**1.79**. **No ruling is reversed; none may be re-opened without re-measuring** via
`probe_word_green_impact_v81d.js` (NOT `probe_learner_known_v80l.js`, which re-derives the colouring
inline and cannot see inside `_wordProgress`).

**Do not re-derive the per-text learning scheme measurements.** A chapter's lessons teach **9.2% of
its story's tokens, 8.2% of its distinct words**, rarest words least covered (**5.1%**). Inflection
share measured at `v80_f`: **47.3% of taught words are findable in the story, 36.4% ABSENT in any
form**, and a matcher is worth ~10 points, not fifty — **the ceiling is a GENERATION problem.**

## Standing tools — use them

**Before grepping for where something lives, check `INTERNALS.md` §6b** — it is the permanent,
actively-maintained function map. This prompt only keeps the probe scripts, since those are quick
reference and not duplicated in INTERNALS.md.

- `probe_gates_v80c1.js` — the `PLAN §C1` gate probe. Reports, does not assert.
- `probe_gates_v77.js` — re-run **and diff** after any progress-card change. **⚠️ It SELECTS its
  chapters from the corpus, so a data drop moves the selection.** Disambiguate by re-running the
  PREVIOUS client against the CURRENT corpus. Baseline: `v80i_card_gates.txt`.
- `probe_word_green_impact_v81d.js` — what TRACK T's colouring paints, through `_wordProgress` /
  `_wordState`. `PROBE_CLIENT=` diffs two builds. Use this one for anything about the screen.
- `probe_word_green_v81c.js` — declared probe keys vs the BUILDABLE universe (60.8% at `v81_d`).
- `probe_comp_skip_v81c.js` — drives `showComplete(true)` over every later chapter and CLICKS
  `comp-next`. Re-run after ANY change to the progress card's Next wiring.
- `probe_tap_reachable_v81d.js` — highlighted words whose tap resolves to nothing. **Relevant to
  `PLAN §12`**: it already measures which highlighted words go nowhere on tap — a related but
  DIFFERENT question from "which free-text selections should the new popover accept."
- `probe_learner_known_v80l.js` — the older colouring probe. ⚠️ It RE-DERIVES the colouring inline
  rather than calling `_wordProgress`, so it is blind to changes inside the collector.
- `probe_inflection_v80f.js`, `probe_article_symmetry_v80j.js`, `probe_lesson_script_v80h.js`,
  `probe_word_forms_defects_v80g.js`, `probe_forks_v79k.js`, `probe_coverage_v78n.js`.
  **All report; none assert.** The article one is explicitly NOT language-blind — its article lists
  must never migrate into the app.
- `_cardErrors()` — assert it is empty after any card render you add.
- `_storyBodyHtml(d, opts)` — **the ONE story renderer** for question panels and progress cards.
  **`PLAN §12`'s selection listener attaches here.**
- `_wordProgress(d)` / `_wordState(rec)` — **the ONE per-word progress collector.**
- `_storyLockedLesson(L, d)` — the ONE "is this lesson closed" rule.
- `_cardHeader(prefix)` + `.card-screen` — every new card page uses both.
- `scriptPinNote(lang, script, role)` — every prompt emitting target-language text calls it.
- `_tutorGatherContext()` / `_tutorRenderScope()` / `/api/tutor` — **`PLAN §12`'s closest existing
  precedent.** Read before designing the new payload; the `srcLang` vs `APP.uiLang` question above
  lives exactly here.
- `recordObservation(ex, correct)` / `APP.progress.observations` / `refreshBktShadow(d)` — the
  `PLAN §8/B1–B4` evidence path. See `INTERNALS.md` §6b before extending it: only `check()`-graded
  exercises are logged, only resolved vocabulary IDs feed BKT, and no BKT value may become a reader
  of progression without a separate product ruling; `learners.js`'s `MAX_STATE_BYTES` growth ceiling
  remains unaddressed.
