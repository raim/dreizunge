# Session prompt — written at the `v82_e` cut

*(Rename this file for the version the session WRAPS UP WITH. `SESSION_PROMPT_v82_d.md` was the
previous one — superseded by this file and renamed, not kept alongside. Keep using the double-
letter suffix scheme (`v82_f`, `v82_g`, …) unless a future session has a good reason to switch to
`v83_a` instead.)*

I'm continuing development of Dreizunge (a single-file `index.html` client + `server.js`,
zero-dependency Node language-learning app). Fresh session picking up from the **`v82_e`** cut.

**`v82_e`, in brief** (full write-up in `roadmap_v82.md`): built `PLAN §D4` phase 1 — a new lesson
type, `writing`, the app's first lesson type graded by a LIVE model call at PLAY time rather than
generated once and played from static content. The task is generated normally (through the existing
`ADD_LESSON_GENERATORS` machinery); a new stateless `/api/writing-feedback` route grades the
submission (typos + grammar only, phase 1's scope) and returns to a `renderWriting()` play screen
with its own submit/feedback/revise flow, bypassing `buildExercises`/`EX_RENDERERS` the same way
`error_hunt` does. Two real bugs found and fixed along the way, both BY the process of adding this
type rather than by inspection: `openAddLesson`'s dialect gate silently un-hid `.opt-needs-story`
options (comprehension had this bug since `v71_l`; adding `writing` to the same two-class shape
forced the second look), and `/api/lessons/edit`'s field whitelist was missing `writing`'s own
fields — the exact `v75_e` "accepted with 200, dropped silently" failure mode, caught fresh by
`e2e-lesson-edit-roundtrip`'s registry-coverage check before it could ship. Also **measured, not
assumed**, which model should grade: the QC-role model (`translategemma:12b`) ignored the requested
output format and was 4x slower than the default lesson model (`qwen3.6:35b-a3b`), which followed it
exactly — switched, live-verified both ways first. Full round trip (generate → submit → feedback →
persist → restore-on-revisit → revise-and-resubmit → offline degradation) verified in a real browser
against the real server and real model, not just the fake-ollama e2e test. See `roadmap_v82.md`'s
own entry for the near-miss workflow note (a stale server found already running, a genuinely
concurrent generation job observed mid-verification) and the exact corpus-count bookkeeping it
caused.

**`v82_c`, in brief** (full write-up in `roadmap_v82.md`): a new lesson type, `inflections` —
closes the `v80_f` coverage gap (36.4% of taught words absent from the story in any form) by
scanning the ALREADY-GENERATED story for inflected surface forms and building two MCQs per word
(lemma, grammatical form), registering in `_storyWordSources` so the words become highlighted and
tappable — without touching story generation or the standard vocab lesson's own dictionary-form
teaching. Plus three follow-ups found along the way: a story-panel alignment gap (`renderStoryText`
never reached `_storyWordSources`), a Japanese-specific word-boundary matching bug (live-tested
against a real Japanese story), and a furigana pipeline that turned out to be nearly nonfunctional
(11 of 12 LLM-generated Japanese stories had no working furigana — two separate, A/B-tested fixes).

**`v82_d`, in brief**: three more user-reported fixes, all against `v82_c`'s own new material —
`inflection_form`'s answer read-out was spoken in the wrong voice (target instead of source
language); the entry card's section order had drifted from the progress card's (a `v77_o`-era order
that never followed two later reorderings of its sibling); and the progress card's ← skipped past
intervening chapters straight to the storyline-wide summary. The third one is worth reading in full
in `roadmap_v82.md` — the FIRST fix (routing ← through `loadSaved`, mirroring how → already works)
looked right by symmetry and passed its own tests, but the user caught that it was still wrong one
level down (chapter 2's ← landed on chapter 1's ENTRY card, not its PROGRESS card) and gave a precise
correction. Worth internalizing: passing tests confirm a fix does what IT claims, not that the claim
itself was the right one — the user's read of what the app should do was still the deciding signal.

**⚠️ A near-miss on user data at the `v82_c` cut, not a loss, but a workflow lesson worth carrying
forward**: this dev workflow (mutate `lessons.json` through a running server, restart the server to
pick up code changes) can silently overwrite a concurrent edit, because the server holds the whole
array in memory and never re-reads from disk except at startup. It happened once (the user's own
browser edits on the Scheißland topic got clobbered by a stale restart) and was caught and fixed —
by the user themselves, via `b321857`, before that session even noticed. **Restart-then-verify
against the live API before any further mutating call** is the habit this earned, not a one-off.

## This is a new BASE LINE, cut from `v81` at `v82_a`

**Why now**: `PLAN §C4` (the Settings Card) finished at `v81_ad` — the speech-mismatch status pill
was its last acceptance-detail fork. That closes out, in sequence, THREE tracks in a row: `§C0`
(the router seam), `§C5` (splitting generation off the landing page into its own screen), and now
`§C4` (the Settings Card and its floating pills). All three are **fully done, nothing owed on any
of them.** This is the same shape of milestone the `v80`→`v81` cut happened at ("the end of the
TRACK T build-out"), and `roadmap_v81.md` had grown to ~4900 lines by this point — past due for a
cut on both counts.

**`roadmap_v81.md` is kept, not superseded** — the whole `v81` line's release history (`v81_a` …
`v81_ad`, thirty-odd point releases) lives there under `# SHIPPED IN THE v81 LINE`. Go there for how
something was built or why a guard is shaped the way it is. **`roadmap_v82.md` is the new current
file** — it carries forward the protocol, standing rules, `§0`/`§0i`, TRACK T, and THE LARGER PLAN
unchanged, with a short "where to find it" pointer table replacing the v81 line's release write-ups.
See its own header for the exact carried/not-carried split (identical in kind to the `v80`→`v81`
cut's own).

**`v81_ad`** (the release the cut itself happened at) shipped the speech-mismatch status pill,
closing `PLAN §C4` — see `roadmap_v81.md`'s own `v81_ad` entry for the full write-up, or
`roadmap_v82.md`'s pointer table for the short form.

## Orient yourself

1. **This file**, whole.
2. `build_history/roadmap_v82.md` — its **index table** and the **⚠️ Session protocol** block first,
   then the standing RULES. (Nothing is in TRACK T right now — steps 1–4 and `§T7` all shipped in
   the v81 line.)
3. `INTERNALS.md` — constants, silent-failure modes, invariants, harness limits. **§6b is a
   feature → function map** — read it BEFORE grepping for where anything lives. It already documents
   every `§C0`/`§C5`/`§C4` mechanism in full (router seam names, the language-picker sync, the
   Settings Card, the mute pill, the speech-mismatch pill) — this prompt does not re-duplicate that.

## Establish a green baseline before changing anything

```
node test/run.js                          → expect 248 checks
node test/run.js --quick                  → expect 221
node test/check-inline.js                 → expect 0 failures
node test/check-inline.js docs/index.html → expect 0 failures
```

Corpus at this cut: **324 topics, 92 storylines, 33 languages, 647 `en` keys** (`v82_c` added 7 new
`en`-only keys for the `inflections` lesson type; `v82_d` added 1 more — `complete.prev_chapter` —
for the progress-card back-button fix; `v82_e` added 14 more for the `writing` lesson type. None yet
translated — needs the offline translate pass before those languages catch up). **The topic/storyline
counts moved for a reason unrelated to this cut's own feature** — see `roadmap_v82.md`'s `v82_e`
entry: a genuinely concurrent generation job on the dev server, observed mid-verification, not this
session's own data.
`APP_VERSION = 'v82_e'`.

> **These four expectations and the four corpus numbers are GUARDED** by `unit-roadmap-version`
> against the actual suite and against the data files. **If that test fails, the number in THIS file
> is the thing to fix.**

- `unit-static-freshness` red → `node build-static.js`. **Read what it NAMES first.**
- `unit-script-choice` red saying topics are unstamped → `node backfill-script.js --write`.
- **Order matters: backfill FIRST, build-static SECOND.** A fixer is not a diagnosis (rule 23).

## The five habits that cost this project the most

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

---

# WHERE TO START

## 1. ✅ NO RULING IS CURRENTLY OWED — the queue is clear

Nothing is blocked on a decision right now. The largest owed item is a DEVICE PASS (§4 below), not a
ruling.

## 2. The PASS MARK is still owed, and still by the user

`Churros` is 40 items where it was 83 questions, and an item is solved by ANY correct answer, so 80%
is a materially lower bar. Needs a browser pass, not a code change.

## 3. BUILDABLE NOW, no ruling needed

- **Difficulty-tiered furigana density is dead code, found at `v82_c`.** `prompts.json` still holds
  `story.furiganaNote1/2/3` (beginner: annotate every kanji without exception / standard / advanced:
  only rare kanji) from a ~v40-era design where `sysStory` took a `difficulty` parameter and selected
  between them. The CURRENT `sysStory(lang, isContinuation, wordCount, dialect, writingStyle, script)`
  has no `difficulty` parameter at all and always uses the flat fallback (`furiganaNote`, fixed this
  session). Flagged, not restored — a real feature regression, but restoring it is a scoped, separate
  piece of work, not a fix. If picked up: check whether `furiganaNote1/2/3`'s OWN wording needs the
  same "mandatory for the whole story, worked example" treatment `furiganaNote` just got, since they
  share its pre-fix weakness.
- **`PLAN §7.0` CP1, canonical text + report-only analysis records** — the first buildable slice of
  the accepted parallel curriculum pipeline. It defines stable chapter/sentence/span/token IDs and
  provenance, but must not change existing lessons, player, learner progress, or publishing. See the
  durable roadmap diagram and migration sequence in `roadmap_v82.md`'s THE LARGER PLAN section; CP1
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
- **`e2e-lesson-edit-roundtrip` flakes inside the FULL suite, still unfixed.** Last seen: 1 of 235 on
  a first full-suite run, clean on immediate re-run and standalone. Reproduced again at `v82_c`
  purely by adding 3 more field-edit cases for `inflections` (no logic change to the test's own
  timing-sensitive block): baseline 5/20 standalone runs failed BEFORE those cases were added, 3/20
  after — same order of magnitude, confirming the flake is pre-existing and load-shaped, not
  introduced by the new cases. **Reconfirmed again at `v82_e`** after adding 2 more cases for
  `writing`: 4/15 standalone runs failed on the new commit, 2/15 on the exact same PREVIOUS commit —
  same order of magnitude a third time. Nothing to do with UI work — pure server-side lesson editing,
  likely a port/teardown race under load, and specifically the `updatedAt`-moved-non-vacuity
  assertion each time, never the field-persistence assertions themselves. Reproduce with several
  consecutive `node test/run.js` (not `--quick`) before assuming a fix worked, and before blaming any
  future session's change.
- **`PLAN §D4` phase 2 — content feedback for the `writing` lesson type.** Phase 1 (typos + grammar)
  shipped at `v82_e`. Phase 2 ("does this text actually address the task") was explicitly flagged by
  the user as likely needing a stronger model or more careful prompting than phase 1's — worth a
  quick capability check against the current default (`qwen3.6:35b-a3b`) before assuming it needs a
  swap, the same way `v82_e` measured rather than assumed for phase 1's own model choice.

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
actively-maintained function map (router seam, language-picker sync, Settings Card, mute pill,
speech-mismatch pill, and everything else this prompt used to re-list here). This prompt only keeps
the probe scripts, since those are quick reference and not duplicated in INTERNALS.md.

- `probe_gates_v80c1.js` — the `PLAN §C1` gate probe. Reports, does not assert.
- `probe_gates_v77.js` — re-run **and diff** after any progress-card change. **⚠️ It SELECTS its
  chapters from the corpus, so a data drop moves the selection.** Disambiguate by re-running the
  PREVIOUS client against the CURRENT corpus. Baseline: `v80i_card_gates.txt`.
- `probe_word_green_impact_v81d.js` — what TRACK T's colouring paints, through `_wordProgress` /
  `_wordState`. `PROBE_CLIENT=` diffs two builds. Use this one for anything about the screen.
- `probe_word_green_v81c.js` — declared probe keys vs the BUILDABLE universe (60.8% at `v81_d`).
- `probe_comp_skip_v81c.js` — drives `showComplete(true)` over every later chapter and CLICKS
  `comp-next`. Re-run after ANY change to the progress card's Next wiring.
- `probe_tap_reachable_v81d.js` — highlighted words whose tap resolves to nothing.
- `probe_learner_known_v80l.js` — the older colouring probe. ⚠️ It RE-DERIVES the colouring inline
  rather than calling `_wordProgress`, so it is blind to changes inside the collector.
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
  `PLAN §8/B1–B4` evidence path. See `INTERNALS.md` §6b before extending it: only `check()`-graded
  exercises are logged, only resolved vocabulary IDs feed BKT, and no BKT value may become a reader
  of progression without a separate product ruling; `learners.js`'s `MAX_STATE_BYTES` growth ceiling
  remains unaddressed.
