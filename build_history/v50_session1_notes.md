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

## post-v50 — Dialect M1 importer core (deterministic, no LLM)
East-Tyrolean material received (Bernd Kranebitter, "Dialekt Wörterbuch Osttirol", CC BY-NC, used
with explicit permission → recorded in new `ATTRIBUTIONS.md`). Built the faithful glossary importer
per spec_dialect_lessons_m1.md:
- **`dialect-glossary.js`** (isomorphic, zero-dep): `parseDialectGlossary(text, opts)` detects the
  delimiter (tab/pipe/**equals**/comma/2-space — the real file uses " = "), skips title/CC-license/
  header lines, parses rows VERBATIM (trim only, no split/normalize), keeps duplicate targets but
  reports them, and SURFACES the real PDF collided-row artifact (`Mangale = Männchen, kleiner
  MannFock = Schwein` — two glued entries) as `report.suspicious` rather than auto-splitting it
  (the faithfulness spine: importer never invents rows). `dialectVocabItems(rows)` →
  `{target, source, note?, _dialect:true}`. Note column is opt-in (`opts.threeCol`), so a stray 3rd
  `=`-split rejoins into source verbatim instead of becoming a phantom note.
- **Test** `unit-dialect-glossary` runs against the real material (`test/fixtures/osttirol-
  glossary.txt`, 85 data rows): delimiter detection, license/header skip, verbatim rows (multi-word,
  multi-sense, slash-variants), collided-row surfaced-not-split, duplicates kept+reported, vocab
  shape, note column.
- Roadmap dialect M1 entry updated (importer core shipped; next: dialect topic data model +
  fromDialectMaterial builder, sourceOnly QC, UI panel, approximate-voice toggle). mein-osttirol.rocks
  (1165 entries) pending a permission email to the operators — NOT to be imported until permission
  is on file.
No client/server/data changes yet (parser not wired into the UI) → no static rebuild. Still v50.

## post-v50 — Dialect M1: fixture corrected + data model/builder
- **Fixture fix:** the PDF collided row (`Mangale = Männchen, kleiner MannFock = Schwein`) was two
  glued entries; corrected in `test/fixtures/osttirol-glossary.txt` to two clean rows (`Mangale =
  Männchen, kleiner Mann` + `Fock = Schwein`, space restored). Fixture now 86 clean rows. The
  "surface-not-split" guarantee is still tested via a SYNTHETIC collided input (so the fixture stays
  clean while the anomaly path stays covered). User fixes the same line in their master source.
- **`buildDialectTopic(rows, meta, opts)`** added to `dialect-glossary.js`: rows → a complete,
  playable dialect topic. lang===srcLang===de (dialect as a variety of German); rows chunked into
  `standard` vocab lessons in author order (perLesson default 12); every item + lesson marked
  `_dialect:true`; attribution + a `_dialect` metadata block on the topic (never sent to a model);
  caller supplies a real tp_ id (deterministic fallback for tests); empty input → valid empty topic.
  Tested (`unit-dialect-glossary` §7): topic shape, no row lost, order preserved, markers,
  attribution, caller id, empty case.
- Roadmap M1 entry updated (data model + builder done; next: wire into store, sourceOnly QC, UI
  panel with parse-report confirmation, approximate-voice toggle). No client/server/data changes yet
  → no static rebuild. Still v50.

## post-v50 — Dialect M1: sourceOnly QC direction
Added `qcCheckDialectPair(target, source, lang, srcLang, comment)` (server): the dialect token is
FIXED ground truth — the prompt tells the model never to change/comment on it — and only the gloss
(source) is checked for spelling/writing. It can ONLY return {ok} or {ok:false, field:'source',
sug}; a reply echoing the dialect word or empty is treated OK. `_runQc`'s vocab/sentences loop now
routes any item whose lesson is `_dialect` OR item is `_dialect` to this checker instead of
`qcCheckPair`, so QC can never rewrite a dialect word. Tested in `unit-qc-dispatch` (dialect lesson
→ dialect checker, standard pair-count unchanged, flag is field:'source'). Server-only change → no
static rebuild. Still v50.
Remaining M1: wire buildDialectTopic into the store, the "🗣 Dialect" UI panel (paste/upload +
parse-report confirmation), the approximate-German-voice toggle.

## post-v50 — Dialect M1: wiring + "🗣 Dialect" UI panel (now playable end-to-end)
The imported glossary is now a real, playable feature:
- **Server:** `server.js` requires `dialect-glossary.js`; new `POST /api/dialect-import` parses the
  glossary text (deterministic), builds a topic via `buildDialectTopic` with a real `tp_` id, and
  `upsert`s it into the store. Returns `{ok,id,topic,rows,lessons,report}` — the report carries
  suspicious/duplicate rows for the user to fix. Validates: name required, non-empty text.
- **Client:** a "🗣 I have a dialect glossary" toggle on the generation form reveals a dialect panel
  (name, paste box, 📎 upload, attribution, "Build dialect lessons"). `onUseDialectCb` hides the
  normal generate form while active; `onDialectFileChosen` loads a file + prefills the name;
  `doDialectImport` POSTs to the endpoint, shows the parse report (suspicious rows w/ line numbers,
  duplicate count), toasts success, and refreshes the saved list. The new topic plays as ordinary
  vocab lessons (dialect→standard), words verbatim.
- **i18n:** new en-only keys `form.use_dialect` + `dialect.*` (11 keys) — owed to the translate pass.
- **Tests:** `e2e-dialect-import` (live server, no Ollama): clean import → faithful playable topic +
  persisted attribution + `_dialect` markers; collided row surfaced-not-split; validation. Also
  verified by hand against the real Osttirol glossary via curl (86 rows → 8 lessons, 0 suspicious).
- Static rebuilt (client + ui.json changed; panel is inert without a backend, which is correct —
  import is a backend op). Still v50 (post-release wip).
Remaining M1: the approximate-German-voice TTS toggle. Then M1.5 (assisted example sentences) → M2
(reviewed generated stories; Qwen experiment saved as the north star).

## post-v50 — Dialect M1 COMPLETE: approximate voice (final piece)
Dialect content is a variety of the base language (lang='de'), so TTS already speaks it with the
German voice automatically — the only missing bit was LABELLING it as approximate. Reused the
existing approximate-badge path: `ttsIsApproximate()` now returns true when `_lessonIsDialect()`
(topic `_dialect`, lesson `_dialect`, or dialect-marked vocab items) regardless of any TTS-language
override, and `ttsApproxBadge()` shows a dialect-specific label naming the base voice
("≈ {lang} voice (approximate)"). No new speak path — the German voice was already selected via the
de lang code. New helper `_lessonIsDialect()`. Test `unit-dialect-tts`. New en-only key
`tts.approx_dialect`. Checklist §52. Static rebuilt.
**M1 is now complete** (importer → data model → sourceOnly QC → wiring+panel → approximate voice).
Next: M1.5 (assisted example sentences, QC-gated) → M2 (reviewed generated stories; Qwen experiment
is the north star). i18n owed: form.use_dialect, dialect.* (11), tts.approx_dialect.

## post-v50 — FIX: dialect panel didn't show + Generate no-op'd (live bug)
User reported: ticking the dialect checkbox hid the story input but nothing appeared and Generate
did nothing. Two root causes (both DOM-visibility bugs headless tests missed):
1. The dialect panel reuses `.user-story-panel` (CSS display:none, shown via the `.open` CLASS).
   `onUseDialectCb` toggled inline `style.display` instead — which the CSS display:none wins over —
   so the panel never showed. Fixed to `panel.classList.toggle('open', on)` and removed the panel's
   inline `display:none`.
2. The normal "Generate lessons →" button (`gen-btn`) lives in a row OUTSIDE `gen-form-section`, so
   hiding the section left Generate visible; clicking it ran doGenerate() with no topic → silent
   no-op. Gave the row `id="gen-btn-row"` and hid it in dialect mode.
Verified the toggle in jsdom (panel visible via .open, Generate row hidden, Build button reachable,
restores on untoggle). Added `unit-dialect-panel` (static-analysis regression, no DOM dep): panel
shown via .open not inline style, no blocking inline display:none, Generate row hidden, panel
outside gen-form-section and self-contained. Static rebuilt. Still v50.
