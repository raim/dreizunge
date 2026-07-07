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

## post-v50 — Dialect M1.5: opt-in AI example sentences (review-gated)
The safe bridge toward M2. `generateDialectExample(word, gloss, glossaryRows, base)` (server): a
tightly constrained prompt few-shot-grounded in the glossary (mimic orthography, glossary words
only), returns one D:/G: pair; a guardrail rejects any sentence not containing the target word.
`/api/dialect-examples` (job-based) generates for up to `max` words and adds a review-gated
`_aiExamples` lesson — every sentence `aiGenerated:true` + `needsReview:true`, titled "🤖 … (review)".
KEY SAFETY: `_runQc` now sends `aiGenerated` dialect items to FULL pair QC (both sides), not
sourceOnly — the model authored them so the dialect side is no longer ground truth. Client: an opt-in
checkbox in the dialect panel (off by default) chains generation after import and polls the job.
Tests: `unit-dialect-examples` (parse, guardrail, QC-routing, endpoint markers) + `e2e-dialect-import`
extended (real job cycle; fake-ollama gained a dialect-example branch). New en-only keys:
form.dialect_examples, dialect.status.examples_*, dialect.toast.examples_*. Checklist §53. Static
rebuilt. **Quality needs live tuning (fluent-but-wrong hazard) — opt-in + marked + review-gated.**
Still v50. Next: M2 (reviewed generated stories; Qwen experiment = north star) when ready.

## post-v50 — Dialect M2: gated story generation (the review gate is the feature)
Built M2 as a GATE, not just generation (per spec: model may author dialect prose only for a
human-approved dialect). Pieces:
- `topic._dialect.curated` (default false) is the hard gate. `/api/dialect-story` returns 403 unless
  curated. `/api/dialect-curate` sets it and REFUSES to curate a dialect with no reviewable AI sample
  (the M1.5 `_aiExamples` lesson) — can't approve unseen output.
- `generateDialectStory(glossaryRows, base, note)`: constrained few-shot (STORY/GERMAN blocks).
  Result stored on the topic as `aiGenerated:true` + `_dialect.aiStory.needsReview:true` (not
  trusted). QC on aiGenerated dialect content already checks both sides (from M1.5).
- Client "🗣 dialect studio" strip on the dialect lesson-set page (updateDialectStudio + three
  handlers): suggest examples → approve (enabled once examples exist) → generate story (enabled once
  curated). Uses inline display toggling (avoided the .open-class trap from the earlier panel bug);
  verified in jsdom.
- Tests: `e2e-dialect-import` extended (403 pre-curation, curation-requires-sample, gated
  generation, story marked); `unit-dialect-examples` M2 section (endpoint guards). fake-ollama gained
  a dialect-story branch. New en-only keys: dialect.studio.*, dialect.status.story_start,
  dialect.toast.{curated,uncurated,story_done}. Checklist §54. Static rebuilt.
**Dialect track M1 → M1.5 → M2 all shipped.** Quality of generated content still needs live tuning +
native review — which is exactly what the gate is built around. Still v50.

## post-v50 — FIX: generated examples/story were stored but not viewable
User generated example sentences (in lessons.json) but had nowhere to SEE them. Root gap: the
`_aiExamples` lesson was stored but the client only checked for its existence (studio gating) — it
never rendered the sentences, and the lesson showed as a normal playable path node (mixing
unverified AI content into play). Fixes:
- **Review list in the dialect studio:** `updateDialectStudio` now renders the generated example
  sentences (🗣 dialect / German / "for: <word>") and the generated story (dialect + German) as a
  readable, scrollable list in the amber studio strip — so a human can actually read and judge them.
- **Hide review-only content from play:** `lessonCountsFor` now returns false for `_aiExamples`
  lessons (non-teacher) — they're review-only in the studio, not normal playable lessons, so
  unreviewed AI content doesn't get quizzed as if trusted. (Teacher/edit mode still sees them.)
- Tests: `unit-hidden-lessons` gains an `_aiExamples`-hidden assertion. New en-only keys
  dialect.review.{examples_hdr,for_word,story_hdr}. Static rebuilt.
So: generate examples → they appear IN THE STUDIO STRIP on the dialect topic's lesson-set page (not
as a playable lesson). Still v50.

## post-v50 — Dialect: REDESIGN to topic-driven stories (retired per-word examples)
User feedback: the per-word example sentences were incoherent. Retired them entirely; the dialect
AI path is now topic-driven story generation (matches the Qwen north-star experiment, which worked
well because coherence is easier than isolated correctness).
- **Retired:** `generateDialectExample`, `/api/dialect-examples`, the `_aiExamples` lesson, the
  import-panel "also suggest examples" checkbox, and their i18n. (`lessonCountsFor` keeps a
  defensive `_aiExamples`→hidden guard for old data.)
- **`generateDialectStory(glossaryRows, base, {topic, instructions, long})`:** now takes a story
  TOPIC and free-text INSTRUCTIONS (e.g. "this is a Bavarian-style dialect"), few-shot-grounded in
  the glossary, asks for a real 5–8 (or 8–14) sentence STORY. Returns STORY + GERMAN blocks.
- **Gate redesign:** story generation is ALWAYS allowed (the story IS the review sample; always
  marked aiGenerated + needsReview, never trusted). `/api/dialect-curate` now APPROVES a generated
  story (requires one to exist; clears needsReview). Generating a NEW story resets approval
  (curated=false) so it must be re-reviewed. No more pre-generation 403.
- **Studio UI:** topic field + instructions textarea + "Generate dialect story" (always enabled w/
  backend) + "Approve this story" (enabled once a story exists). Review area shows the story
  (dialect + German) with ✅/⚠. Fields prefill from the last generation.
- **Tests:** e2e reworked (story-driven; approval-needs-story; regenerate-resets-approval; 404);
  new `unit-dialect-story` (parse, topic/instructions-in-prompt, gate guards, examples-retired);
  fake-ollama story branch updated, example branch removed. New/updated en keys: dialect.studio.*
  reworded; removed the dialect_examples/examples_* keys.
Still v50. Dialect track: M1 (import→lessons→QC→voice) + M2 (topic-driven gated stories). M1.5 as a
separate step is retired/folded away.

## post-v50 — Dialect: mute TTS + drop {lang} in dialect prompts (user feedback)
Two user-requested fixes for dialect lessons:
1. **Treat dialect as muted (no TTS).** There's no authentic dialect voice, so reading dialect words
   aloud in a German voice was misleading. Now: `buildStandardExercises` filters out listen_mcq +
   listen_type for dialect (they'd be unanswerable without sound); `speak()` and `speakBodyText()`
   return early for `_lessonIsDialect()`; `tRead` hides the 🔊 button for dialect. (Guarded as
   `typeof _lessonIsDialect==='function' && _lessonIsDialect()` so extracted-function unit tests that
   inject builder deps don't throw.) The old approximate-voice badge path is now moot for dialect
   (no listen exercises are produced).
2. **Drop the {lang} in the source→target MCQ for dialect.** "Wie sagt man 'fest' auf {German}?" is
   wrong when the answer is the dialect word, not German. `tMcqEI` now uses no-lang variants for
   dialect: `ex.mcq_source_target.q_nolang` ("How do you say \"{word}\"?") + `ex.badge.
   mcq_source_target_nolang`. Added `ex.type_translate.q_nolang` too for completeness.
Tests: `unit-dialect-mute` (listen dropped, speak muted, 🔊 hidden, MCQ drops {lang}). New en-only
keys: ex.mcq_source_target.q_nolang, ex.badge.mcq_source_target_nolang, ex.type_translate.q_nolang.
Static rebuilt. Still v50.

## post-v50 — Dialect mute: closed the remaining audio leaks
Follow-up to the mute work: found two paths the first pass missed.
1. `lBlock` (the big "🔊 Tap to listen" block) is used not only by listen exercises (dropped for
   dialect) but also by `tMcqIE` ("What does X mean?", a normal MCQ NOT filtered). It rendered a dead
   listen button for dialect. Now `lBlock` returns the word in a plain target-box (no button) for
   dialect.
2. The "Story unlocked" completion panel's 🔊 button (`comp-story-spk`) is now hidden for dialect
   (its speakBodyText was already a no-op, but the button was visibly dead).
Confirmed the {lang} concern is fully covered: only `mcq_source_target` (fixed → q_nolang) is
dialect-reachable with an "auf {lang}" phrasing; `type_translate.q`'s {lang} only appears in the
listen-type muted fallback, and listen-type isn't generated for dialect. `unit-dialect-mute` extended
to cover lBlock + the story-unlock button. Static rebuilt. Still v50.

## ═══ v51 RELEASE CUT ═══
Folded the entire post-v50 dialect track into the v51 release.
- APP_VERSION bumped v50 → v51; docs rebuilt (derives version from server.js).
- roadmap_v52.md written (carries the protocol block verbatim + all open items; adds a v51-shipped
  summary and a "dialect: evaluated ideas from dialects.md" section). START-HERE example repointed to
  roadmap_v52.md. roadmap_v51.md is now historical.
- Shipped in v51: dialect glossary import (M1: parser + buildDialectTopic + /api/dialect-import +
  panel), sourceOnly QC, muted dialect audio + no-{lang} dialect prompts, topic-driven gated dialect
  stories (M2: generateDialectStory + curate gate + studio), per-word examples (M1.5) tried &
  retired. dialects.md reviewed (ideas captured, not adopted wholesale).
- Full suite green + check-inline 0 + stable 6×. Packaged as dreizunge_v51.zip, verified from a clean
  unzip.
- OWED (unchanged by release): i18n translate pass for the new en-only keys (form.use_dialect,
  dialect.*, tts.approx_dialect, ex.mcq_source_target.q_nolang, ex.badge.mcq_source_target_nolang,
  ex.type_translate.q_nolang); browser/Ollama verification LIVE-TEST §§41–55 (esp. dialect story
  QUALITY + my-story prompt quality); mein-osttirol.rocks permission email; library tag/filter
  persistence repro.

## post-v51 — Dialect story: standard→dialect REWRITE method (V2), as an A/B option
Built the "standard → dialect rewrite" approach from the dialects.md review, as a SIDE-BY-SIDE
option (not a replacement) so the user can judge it against direct generation on their own model.
- `generateDialectStoryV2(glossaryRows, base, {topic,instructions,long})` (server): TWO model calls —
  (1) a Standard-German story on the topic (model is reliable here); (2) a CONSTRAINED rewrite into
  dialect using the glossary, preserving sentence count + meaning, "change only what the dialect
  requires, don't invent dialect words you're unsure of." Reframes the model AUTHOR→TRANSFORMER.
  Returns { story, gloss, standardSource, coverage, method:'rewrite' }.
- `dialectGlossaryCoverage(text, rows)`: deterministic faithfulness signal — counts distinct
  glossary dialect words actually present in the output ({used,total,ratio}). The rewrite's real
  win: the aligned Standard-German source makes the output CHECKABLE (coverage now; back-translation
  later) in a way free authoring never was.
- `/api/dialect-story` takes `method:'rewrite'|'direct'` (default direct), stores method +
  standardSource + coverage on `_dialect.aiStory`. Studio has a second "🔁 Generate (rewrite)"
  button; the review area shows the method label, a coverage badge, and a collapsible Standard-German
  source. fake-ollama gained std-story + rewrite branches.
- Tests: `unit-dialect-story` V2 section (coverage counting; two-call flow; endpoint routing);
  `e2e-dialect-import` rewrite section (method reported, coverage attached, source kept). New en-only
  keys: dialect.review.{method_rewrite,method_direct,coverage,show_source}. Static rebuilt. LIVE-TEST
  §56 (A/B the two methods — user evaluation owed). Still v51.

## post-v51 — Option A: gate LLM-authoring lesson types off for dialect topics
Dialect topics must not get lessons whose generators run in the base language (de) — they'd inject
standard-German / mis-judged content, breaking the "no invented dialect" guarantee. Gated both UI +
server (defense in depth):
- **Add-lesson menu:** tagged synonyms/word_forms/error_hunt options `opt-ai-authoring`;
  `openAddLesson` hides+disables them for `_dialect` topics and resets the selector to standard.
  Dialect topics keep Standard (glossary vocab), Math, Mixed review, (intro_script if applicable).
- **AI error-hunt:** the "🔎 AI hunt" checkbox (`gen-ai-hunt-label`) is hidden for dialect when the
  story editor opens (and unchecked); editing the dialect story TEXT stays allowed.
- **Server guards:** `/api/lessons/add-lesson` refuses {synonyms,word_forms,error_hunt,grammar,
  conjugation,all_types} for `_dialect` topics (400); `/api/save-story` skips AI-hunt generation for
  `_dialect`.
- Tests: `e2e-dialect-import` (server refuses each blocked fmt; standard not blocked);
  `unit-dialect-panel` (UI tags + gating logic present). Checklist §57. Static rebuilt. Still v51.
Future (not now): a dialect-native "convert standard↔dialect" deterministic exercise as the proper
dialect "add lesson"; a real dialect error-hunt from APPROVED dialect content (M3-ish).

## post-v51 — CORRECTION: AI error-hunt is a human-edit diff → KEEP it for dialect
I had wrongly gated the AI error-hunt (`ai_error_hunt`) off for dialect, believing it re-invoked a
base-language LLM to corrupt the story. WRONG: `storyDiffSentences` is a pure LCS diff between the
original AI text (`aiStory`) and the HUMAN-corrected story — no LLM. For dialect it's the ideal
review tool: the human fixes the AI's dialect slop and those corrections become the lesson. Reversed
that specific gate:
- Restored the "🔎 AI hunt" checkbox for dialect (removed the toggleStoryRepair hide).
- Restored the save-story path for dialect (removed the `!saved._dialect` guard on the hunt).
- Set `fresh.aiStory = out.story` at dialect-story generation, so a later human edit produces a
  correct diff (original AI vs fixed).
- KEPT the correct gates: the LLM-authoring ADD-LESSON formats (synonyms/word_forms/error_hunt/
  grammar/conjugation) stay blocked for dialect — those DO call base-language generators. The plain
  `error_hunt` add-lesson (LLM-corrupts) stays blocked; the story-edit `ai_error_hunt` (human-
  corrects) is allowed. Important distinction.
- BONUS FIX found along the way: the client read `resp.sentences` from save-story but the server
  returns the diff as `edits` — so the inline hunt update silently no-op'd for ALL topics (only a
  reload showed the new hunt). Now reads `resp.edits || resp.sentences`.
- Tests: `e2e-dialect-import` proves the dialect human-correction hunt end-to-end (aiStory set on
  generation; edit → diff → ai_error_hunt lesson saved). `unit-dialect-panel` updated (AI-hunt NOT
  hidden for dialect; add-lesson authoring types still hidden). Static rebuilt. Still v51.

## post-v51 — Closed the library-filter-persistence roadmap item (not a bug)
Investigated: filter logic is identical across server + static builds; `_restoreFormLang` doesn't
touch the lib filters. The only reset that fires is the static build's `init()` deliberately forcing
libFilter='all'/libSrcFilter='all' + presetting libTagFilter='manually curated' on page LOAD. So a
"lost filter" after reloading docs/index.html is intentional static-init behavior, not a defect;
in-session Home/back preserves the in-memory filters. Roadmap item #2 marked CLOSED (not a bug) by
user decision, with the findings retained so it isn't re-opened. No code change.

## post-v51 — Next-task pointer written
Added a "▶ START HERE NEXT" block at the top of roadmap_v52.md pointing the next (fresh) session at
the LLM-free progress-dependent drill lessons ("review my mistakes") — chosen because all deps are
shipped/tested (learned ledger + solved store + builders), it's deterministic/offline/static-safe,
fully headless-testable, and unblocked by live-model verification. Two design calls pre-made:
ephemeral (in-memory) lesson; solving feeds the existing solved store via the normal qid() path.
Alternative small win noted: fill the Thai script table. Recommend starting a FRESH session (this one
is compacted + dialect-heavy).
