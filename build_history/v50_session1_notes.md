# v50 — session 1 notes (Commit A: stable per-question IDs)

On top of v49 (green baseline confirmed at start: `node test/run.js` + `node test/check-inline.js`
both clean). This session lands **Commit A** of the dynamic-mixed-lessons keystone from
roadmap_v50: a durable per-question identity + a solved store. **Purely additive — no behaviour
change yet.** The version is still v49 (this is mid-flight toward v50; bump at the v50 cut).

## The problem it solves
Exercises are re-derived every play via `shuffle`/`pick`/`.slice(0,12)`, so the same underlying
question (a vocab pair, a cloze sentence, a synonym set) looks different and is ordered differently
each time, and a random subset is even dropped. "Solved" had nothing durable to attach to, and
progress was only lesson-level booleans/score objects. Commit A gives every question a stable id.

## What shipped (client-only, in `index.html`)
- **`qid(ex, lessonId)`** — a stable id `"<lessonId>:<type>:<hash(canonical)>"`, derived only from
  the source lesson + the exercise *kind* + the identity-bearing content, never the shuffled
  choices/distractors or `math_order.numbers`. Helpers: `_qidHash` (djb2→base36) and
  `_qidCanonical` (per-type canonical key). Placed next to the flag/rating resolvers, since it's
  the same "resolve an exercise to a durable identity" idea.
  - Canonical keys: translation/order/read/listen → `_intro|target|source`; `word_form` →
    `sentence|correct`; `syn_select` → `mode|base` (syn vs antonym distinct); article/plural/
    type_plural → tagged `target`; conjugation (mcq+type) → `infinitive|pronoun` (each pronoun a
    distinct question); `math_calc` → `a|op|b`; `math_order` → `direction|sorted-correct` (NOT the
    shuffled numbers); `math_latex` → `correct`; default → target/source/correct.
  - Design decision baked in: the exercise TYPE is part of the id, so two skills on the same item
    (listen-MCQ vs type-answer on one word) are distinct → coverage counts skills, not just items.
  - Pooled (mixed) exercises resolve `lessonId` via `_srcLessonIdx` → their SOURCE lesson, so ids
    don't collide across lessons and a mixed round's solves land on the real source questions.
- **Solved store** — `APP.progress.solved[topic] = { qid: 1, … }`, a monotonic per-topic set
  (one correct ever = solved, the coverage model). `_solvedMap` / `isSolved` / `markSolved`.
  `markSolved` never records a **flagged** question (excluded from the coverage denominator by
  design) and persists (`saveProg`) only on the first solve of a given qid.
- **Wiring:** `markSolved(ex)` is called in the correct-answer branch of the grader (right after
  `C.correct++`). Persistence rides the existing `imp3_prog` localStorage blob (loaded via
  `loadProg`, which preserves the new `solved` key). Both clear-progress paths (storyline-level and
  per-topic) now also drop `APP.progress.solved[topic]`.

## Behaviourally inert
Nothing consumes `solved` yet — round assembly, the completion fraction, and per-lesson coverage
indicators are **Commit B**. So there is no browser-visible change and no LIVE-TEST-CHECKLIST entry
this session (the keystone is fully headless-testable and adds no UI).

## Test
`unit-qid-stability` (registered in `test/run.js`):
1. qid ignores shuffled choices / math numbers / distractors;
2. qid distinguishes skill vs skill, item vs item, lesson vs lesson; deterministic; well-formed;
3. `markSolved` is monotonic, per-topic, and excludes flagged questions;
4. **end-to-end:** the REAL `buildStandardExercises` pipeline, run 50× with independent RNG,
   yields a **bounded, stable universe of qids** — re-derivation never invents a new id for the
   same content (24 ids for the test lesson, stable across all runs);
5. source guards: `markSolved` wired to the correct-answer path; both clear-progress paths drop
   the solved store.

## i18n / static / version
Commit A added no ui.json keys; Commit B added two (en-only): `coverage.solved_of`,
`coverage.node_title` (list them for the TranslateGemma pass). `docs/index.html` rebuilt (carries
the qid + coverage modules). Version unchanged (v49);
bump to v50 at the Commit B / release point.

## Commit B — coverage-based progression (shipped this session)
Consumes the Commit A solved store to drive the mixed flow. All client-only, additive; the
locked path and teacher mode are untouched.
- **Denominator (qid universe):** `_lessonQidUniverse(idx)` derives a lesson's full producible
  question set by running the REAL builder repeatedly and unioning the qids until the set stops
  growing (convergence: 15 consecutive no-growth runs, cap 120), so there's zero builder-logic
  drift. The union is **monotonic** (seeded from any prior cached value → never shrinks) so the
  "100%" target can't wobble under the learner. Flagged/qc/deleted source items are excluded
  (matches `markSolved`). Mixed lessons recurse into their non-hidden, non-mixed siblings. Cached
  per `(topic, lessonIdx, teacher)`; invalidated in `goLessonSet` (open a set) and `_postLessonEdit`
  (content changed). Empirically the universe converges to a near-stable size (±≤2 for a realistic
  lesson; the monotonic cache pins it within a session).
- **Fractions:** `lessonCoverage(idx)` and `topicCoverage()` → `{solved,total,pct}` (solved qids ∩
  universe). `coverageComplete()` = topic solved-fraction ≥ `_coverageTarget()` (default 1.0;
  override via `d.coverageTarget`).
- **Round assembly:** `assembleCoverageRound(pool, size)` replaces the mixed builder's final
  `shuffle(pool)` — splits by solved-state, takes ~70% unsolved / 30% review, backfills a short
  bucket from the other, dedupes, shuffles. Unsolved-first so a short round advances coverage
  instead of re-asking solved items. `buildMixedExercises` now calls it (round size = whole pool,
  or `lesson.roundSize` if set).
- **Wiring:** `setComplete` uses `coverageComplete()` for a mixed-driven set (a visible mixed
  lesson, non-teacher, current topic) — so story-unlock + 100% now mean "solved ≥ target of the
  question universe", not "played the mixed lesson once". The path progress bar shows
  "N of M solved · P%" for such sets; the mixed node shows a 📊 N/M chip.
- **Tests:** `unit-coverage` — universe convergence + caching + monotonicity; lesson/topic
  fractions track the solved store; `coverageComplete` respects the target; assembly is
  unsolved-first ~70/30, backfills, dedupes, bounded by pool. `unit-mixed-lessons` and
  `unit-mixed-rating` updated to inject an identity `assembleCoverageRound` stub (they test
  pooling/selection, not coverage weighting).
- **i18n (en-only):** `coverage.solved_of`, `coverage.node_title`.
- **Checklist:** §47 (browser-only: coverage bar, node chip, unsolved-first rounds, durable
  solving, coverage story-unlock, flagged-excluded, edit-updates-denominator, clear resets,
  locked-path unaffected).

## Still open for Commit C / later (carried)
Coverage-aware sampling *within* a single script/intro lesson's play-cap (the v48 cap is still
plain random — a short round of ONE script lesson can miss letters; Commit B's coverage-aware
assembly operates at the mixed-pool level, not inside a single lesson's builder). Optional: a
teacher/opt-in toggle if coverage should ever apply outside the mixed-driven case. Content-qid for
the future cross-storyline user layer (see roadmap design note).

## (Original Commit B plan, now delivered — kept for reference)
Coverage-aware round assembly (≈70/30 unsolved/review, coverage-aware sampling so short rounds
don't keep missing the same items), a set-level completion fraction (solved qids ÷ derivable-qid
universe, flagged excluded), and per-lesson coverage indicators — wired into the existing mixed
flow (opt-in / additive, not a rewrite of the locked path). Builds directly on `qid` + the solved
store. Open sub-task: a stable way to enumerate a lesson's full qid *universe* for the denominator
(derive once, cache) — the end-to-end test already shows the universe converges quickly, so a
bounded multi-derive-and-union is a viable cheap approach if a single deterministic derivation
isn't wired.

## v50 — mixed visibility refinement (this session, after Commit B)
User rule: "a mixed lesson should only hide the lessons it drew from; error hunts and any lessons
added AFTER the mixed lesson remain visible (error hunts are a final test)."
- **Old behaviour:** any set with a visible mixed lesson collapsed the learner's path to ONLY the
  mixed lesson(s) — every other lesson (including error hunts and later lessons) was hidden.
- **New behaviour (position-based, single rule in `lessonCountsFor`):** a mixed lesson pools from
  and hides only the siblings BEFORE it. The mixed lesson itself, error-hunt / ai_error_hunt
  "final test" lessons, and any lessons placed AFTER the mixed lesson stay visible & playable.
  This keeps pooling and hiding in agreement: `buildMixedExercises` now pools only earlier
  siblings (`i > lessonIdx` skipped), and `_lessonQidUniverse`'s mixed branch unions only earlier
  siblings — so the coverage denominator matches what's actually pooled.
- **Completion:** `setComplete` for a mixed-driven set now requires coverage target met AND every
  other surviving counted lesson done (error hunts + any later lessons) — the story unlocks only
  after both the mixed practice and the follow-on lessons/tests.
- **Why position-based:** the mixed lesson already pooled from siblings by builder output; making
  both pooling and visibility key off "before the mixed lesson" is the simplest rule that (a)
  keeps error hunts (they build []), (b) keeps later-added lessons visible, and (c) never quizzes
  content the learner can't otherwise reach. Typical authoring order (lessons → mixed → error hunt)
  already matches this.
- **Tests:** `unit-mixed-lessons` and `unit-mixed-rating` fixtures reordered (mixed AFTER its
  sources; a later lesson added to prove it's not pooled). `unit-hidden-lessons` rewritten from
  brittle source-regex to behavioural checks (earlier hidden, mixed/later/error-hunt visible,
  teacher-all-visible, no-mixed classic). `unit-coverage` gained a check that the mixed universe
  unions only earlier siblings. `_firstVisibleMixedIdx` helper added.
- **Checklist:** §48. No new i18n keys. Static rebuilt.

## v50 — learned-vocabulary ledger + "my story" staging (this session)
- **Learned ledger (foundation):** `APP.progress.learned["<lang>|<srcLang>"]` accumulates
  vocab + example sentences across ALL lessons/topics via `recordLearnedFromLesson` (called from
  `showComplete`). Tracks a per-word `seen` and `wrong` count (wrong-answered words captured on
  the play session as `C._wrongTargets`), excludes flagged items, pulls from every lesson type
  (vocab/sentences/synonyms/grammar/conjugation, and the distinct words played in a mixed round).
  Per-language-pair, persisted in imp3_prog. DELIBERATELY NOT cleared by per-topic progress reset
  (it's a lifetime cross-topic record; the per-topic solved store IS cleared). `learnedSummary()`
  gates UI. Nothing consumes it for generation yet.
- **"my story" selector option (staged):** the "continue story from" selector's hardcoded
  "— new story —" is now localized (`form.new_story`), and a `✨ my story` option
  (`form.my_story`, value `__my__`) appears when ≥8 words are learned for the current pair.
  `doGenerate` intercepts `__my__` and shows `toast.my_story_soon` — the generator-from-ledger
  wiring is a planned follow-up (roadmap "My story").
- **Roadmap:** added "user progress & user-specific content" section — learned ledger (shipped),
  "My story" generate-from-learned (next, with the server/client wiring sketch), and
  "Milestone stories" (long-term: unlock curated human-written/existing reading based on learned
  vocabulary, as learning milestones).
- **i18n (en-only):** `form.new_story`, `form.my_story`, `toast.my_story_soon`.
- **Tests:** `unit-learned-vocab` (ledger accumulation, per-language, seen/wrong tracking,
  flag-exclusion, all lesson types, selector wiring, i18n). **Checklist:** §49. Static rebuilt.

## v50 — "my story" generation wired (hybrid option i, this session)
Turned the staged `__my__` option into a working generator. Chosen design (with the user):
**hybrid option (i) — story-seed + reinforce-as-context** (reuse the existing pipeline; no new
pipeline). Two seams in `generate()` (server.js), everything downstream unchanged:
- **Story seam:** when `fromLearned` is present (and no userStory/prevStory), `storyUserMsg` is
  built from the learner's known words ("reuse as many as possible") with extra attention to the
  wrong-answered ones — instead of a topic or previous story.
- **Lesson seam:** the learned slice (sorted most-wrong-first) is fed into the existing
  `chainVocab` with `vocabMode:'reinforce'`, so the lesson generator weaves those words into
  sentences (reinforce-as-context — the same mechanism used for cross-chapter reinforcement).
- **Request path:** `/api/generate` accepts + hard-sanitizes `fromLearned` (cap 60, target≤80/
  source≤120 chars, wrong 0–999, empty-target filtered — it's untrusted prompt input). Topic-less
  my-story synthesizes `resolvedTopic = "My review — <lang> (date)"`; `topicKey`/cache/generate
  now use `resolvedTopic` (not `topic.trim()`), fixing a throw for the topic-less case. Client
  forces regenerate for my-story so a same-day review isn't a cache hit.
- **Client:** `myStoryPayload(lang,srcLang,cap)` builds the ledger slice (wrong-first, then
  most-seen), `doGenerate` sends `body.fromLearned` (and NOT `__my__` as continuedFrom), routes
  through single-generate (not the book path), and keeps the empty-ledger "coming soon" fallback.
- **Tests:** `unit-my-story` (client payload shaping + wiring; server sanitize/caps; both seams
  populated; topic-less synthesis). `unit-learned-vocab` updated (my-story now wired, not a stub).
- **No new i18n keys.** **Checklist §50** (Ollama — incl. the owed prompt-QUALITY pass). Static
  rebuilt (ledger + payload present; generation path naturally absent from the no-backend static
  build). **CAVEAT: story/prompt quality needs live-model tuning; headless tests cover plumbing
  only.**

## v50 — fix: error hunts stay visible even BEFORE a mixed lesson
Bug: the position-based visibility rule hid every lesson before the mixed lesson except a nested
mixed — so an error_hunt / ai_error_hunt generated BEFORE the mixed review was wrongly hidden.
But the mixed lesson never pools from error hunts (their builders return [] → skipped in
buildMixedExercises), so hiding one violates "hide only what it pools from". Fix: added a
`_NEVER_POOLED` set ({mixed, error_hunt, ai_error_hunt}); `lessonCountsFor` now keeps those types
visible regardless of position (in addition to everything at/after the mixed lesson). Pooling and
visibility stay in agreement (an earlier error hunt is neither pooled nor hidden). `setComplete`
already requires every surviving counted lesson done, so a now-visible earlier error hunt correctly
becomes part of the completion requirement. Test: `unit-hidden-lessons` gained earlier-error-hunt
(both types) cases. Checklist §48 updated (error hunt visible in ANY position). Static rebuilt.

## v50 — RELEASE CUT
Bumped `APP_VERSION` v49 → v50 in server.js; build-static auto-derived (both static spots read
v50). Integrated user-refreshed data: **ui.json** (all v50 en-only keys now translated across 29
languages — coverage.solved_of, coverage.node_title, form.new_story, form.my_story,
toast.my_story_soon; `form.my_story` en reworded by user to "✨ my story ✨"), and **lessons.json**
(250 topics, +5 new incl. a "Mein Review" my-story output and German story chapters — all
well-formed). Updated the three tests that asserted the v50 keys were en-only → now assert
"translated across (nearly) all languages". Wrote roadmap_v51.md (protocol + open items carried,
v50 marked shipped), repointed START-HERE. Full suite green; static rebuilt.

### Still owed after v50 (carried to roadmap_v51)
- LIVE browser/Ollama verification of §§41–50 (esp. §50 my-story prompt QUALITY tuning).
- "My story" reinforce-as-**drill** (option ii) upgrade; optional pure-review lesson-set variant.
- Milestone stories (unlockable curated reading) — long-term.

## v50.x — my-story respects the vocab-mode selector (b)
The 🔁 reinforce / ○ neutral / ➕ extend selector now genuinely controls my-story (previously it
was shown but ignored — the client suppressed vocabMode for my-story and the server force-set
'reinforce'). Change: client sends the selector value for my-story too; server honours an explicit
vocabMode for `fromLearned` (default 'reinforce' when none), and the story-seed prompt has an
EXTEND variant ("use known words as a base but introduce NEW vocabulary") vs the reinforce/neutral
variant ("reuse as many known words as possible"). neutral seeds the story from learned words but
sends no chain-vocab hint into the lessons. Reuses the existing chainVocab/vocabMode channel; no
new lesson-gen logic. Test `unit-my-story` updated (respects mode, extend branch, neutral no-hint).
Checklist §50 gained the mode-control item. (Story QUALITY per mode still needs live tuning.)
