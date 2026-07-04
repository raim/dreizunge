# Roadmap v51

**v50 shipped.** This file supersedes `roadmap_v50.md` (now historical). It carries the session
protocol (unchanged) and every still-open item forward. Start a fresh session by reading this file,
then `LIVE-TEST-CHECKLIST.md`, then the latest `v*_session*_notes.md`.

## What shipped in v50 (summary)
A big progression + personalization release on top of v49:
- **Stable per-question IDs (Commit A):** `qid()` gives every exercise a content-derived,
  shuffle-independent, skill-distinct id; a per-topic `solved` store records solved-on-correct
  (flag-excluded, monotonic). The keystone for coverage.
- **Coverage-based progression (Commit B):** mixed-driven sets complete by COVERAGE (solved ÷ the
  topic's question universe) instead of one pass — `_lessonQidUniverse` (monotonic, convergence-
  derived denominator with zero builder drift), `lessonCoverage`/`topicCoverage`/`coverageComplete`,
  and `assembleCoverageRound` (~70/30 unsolved/review, unsolved-first) wired into the mixed builder.
  Path bar shows "N of M solved · P%"; the mixed node shows a 📊 N/M chip.
- **Mixed visibility rule:** a mixed lesson hides only the (poolable) lessons BEFORE it; the mixed
  lesson, everything after it, and error-hunt "final test" lessons in ANY position stay visible.
  Pooling + hiding agree (both keyed off the mixed lesson's position; error hunts never pooled).
- **Learned-vocabulary ledger:** `APP.progress.learned["lang|srcLang"]` accumulates learned
  vocab/sentences across all lessons (per pair, wrong-word tracking, flag-excluded, lifetime).
- **"My story" generation (hybrid i):** ✨ my story generates from the learner's learned words —
  the story reuses them (wrong-first) and lessons reinforce them via the existing chainVocab/
  reinforce path. Topic-less (synthesizes "My review — <lang> (date)"), force-regenerates.
  *(Prompt/story quality still needs live-model tuning — checklist §50.)*
- **QC coverage expansion (from v49 line, confirmed):** grammar + conjugation lessons QC'd.
- Version now DERIVES from `server.js` `APP_VERSION` (bump once, static follows).
APP_VERSION = v50; docs rebuilt; ui.json (all v50 keys translated across 29 langs) + lessons.json
(250 topics) refreshed from the user.

**i18n:** all v50 en-only keys are now translated (coverage.solved_of, coverage.node_title,
form.new_story, form.my_story, toast.my_story_soon). No en-only debt outstanding at v50 cut.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session:** read THIS file (the highest-numbered `build_history/roadmap_v*.md` is
the current one), then `build_history/LIVE-TEST-CHECKLIST.md`, then the most recent
`build_history/v*_session*_notes.md`. Establish the green baseline (`node test/run.js` +
`node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- Add or update a **unit test** for any new behavior. When adding a lesson type, exercise type,
  generator, or registry entry, update the matching registry test (`unit-*-registry`).

**Definition of Done — before calling any change finished, check ALL that apply:**
1. **Tests** — suite green + `check-inline` 0; new/changed behavior has a guarding test.
2. **LIVE-TEST-CHECKLIST.md** — if the change is browser-only or Ollama-only (UI, RTL, TTS,
   rendering, anything not exercisable headlessly), ADD a numbered section describing exactly what
   to click and what to expect. *This is the one most often forgotten.* Anything you label
   "browser-verify owed" in notes MUST have a matching checklist entry.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to other
   languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass is
   run. Changed English values won't be re-translated automatically (script keys off *missing*, not
   *changed*) — call those out explicitly or hand-edit if language-neutral.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script, furigana
   tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release. NOTE (v49): the static
   build now DERIVES the version from `server.js`'s `APP_VERSION` at build time (see
   `unit-version-derivation`), so a single bump in `server.js` + a `build-static.js` re-run is
   enough — no more hand-editing `build-static.js`.
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).

(If you add a new standing rule, append it here so the next session inherits it.)

---

## What shipped in v49 (summary)
A bug-fix + polish batch on top of v48. Highlights:
- **RTL fixes:** order/glyph-order exercises now key `tgt-rtl` off the *opened lesson* (not the
  generation-form target), and word_forms/synonyms sentence/gloss/tiles joined the content-aware
  `dir="auto"` model — Arabic content right-aligns correctly.
- **Sound-test row:** always-on single-line compact row under the "I learn" column — "Test" +
  target flag · 🔊 1,2,3 · "Bad? Mute:" · mute — with the two formerly-orphaned strings reused as
  hover tooltips (`tts.voice_warn_q` on Test, `tts.voice_mute_hint` on Mute, the latter re-punctuated
  to a period across all 29 langs). Flag-lag fixed (row refresh moved before selectLang's fragile
  helpers).
- **Title/motto:** lowercase "dreizunge" + localized `app.motto` ("we are the world"); version
  moved to the motto's tooltip.
- **QC skip (bug 6):** storyline/chapter QC skips lessons that passed a clean full pass and haven't
  been edited since (`ls.qcAt`, invalidated by a content-only `qcSignature`); explicit single-lesson
  and flagged-only runs always re-check; **shift-click** the 🔍 buttons forces a full re-check
  (`force`); a `skipped` count shows in the toast.
- **QC coverage expansion:** `grammar` and `conjugation` lessons are now QC'd (translation pair via
  `qcCheckPair`; article/plural and per-form morphology remain future dedicated prompts). They were
  previously falling through to the vocab/sentences scan and getting **zero** QC. `math`, both
  error-hunt types, and `mixed` are now explicitly out of scope (were implicitly skipped). QC flags
  render + dismiss in the grammar/conjugation editor branches; badge counts include them.
- **Tech debt:** static version drift fixed (derived from `server.js`).
APP_VERSION = v49; docs rebuilt.

**i18n keys added in v49 (en-only — run the TranslateGemma pass):**
`app.motto`, `tts.test_lbl` (value "Test"), `tts.mute_hint_short` (value "Bad? Mute:"),
`qc.toast.skipped`, `qc.toast.forced`, `qc.btn.force_hint`.
Also **changed** (language-neutral / already-translated, no pass needed): `tts.voice_mute_hint`
trailing colon → period across all 29 langs.

---

## OPEN — near-term (do these next)

### 0. Browser / Ollama verification pass — IN PROGRESS (user)
The interactive checklist (`LIVE-TEST-CHECKLIST.md`) is the gate. Browser-only sections need only
the static build; the Ollama sections need a local model. **Expect to tune the QC prompts** —
qwen2.5:7b (and similar small models) are unreliable on "is this distractor also valid?" and
synonym/antonym judgments. **New in v49 to verify:** §§41–45 (order RTL, word_forms/synonyms RTL,
sound-test row incl. tooltips + flag-follow, motto, QC-skip incl. shift-click force). Also verify
the v49 **QC coverage expansion** live: grammar + conjugation lessons now get flagged, and the
flags render/dismiss in their editor branches — watch for false positives from a weak model.

### 1. UI translation re-pass with TranslateGemma — OWED (user)
The v48-b pass filled the missing keys (0 missing across 29 langs at v49 start). Still owed: run the
pass on the **six new v49 en-only keys** listed above. The script-bleed sanity check (Chinese into
Korean/Hebrew, Cyrillic into Arabic under the old qwen model) is in the v48-b/v49 notes if it needs
re-running on the next ui.json.

### 2. Library tag/language filter persistence — NEEDS REPRO
Reported: navigating back to main loses the tag/language selection. The in-memory filters persist
and `_renderTagFilterBar` re-selects, so the reset isn't obvious. Likely culprit: `_restoreFormLang()`
(🌍 Home / back paths) resets `APP.lang`/`srcLang` to *form* defaults — intended for the generation
form but it may reset the selectors the library reads. HELD pending exact repro (which control
resets, via which button). Candidate fix once confirmed: persist the three lib filters and/or
decouple them from `_restoreFormLang`. **Note (v49):** the flag-lag fix reordered `selectLang` (tts
refresh moved before `repopulateContinueSelect`/`updateDocDir`) — unrelated to the filter logic, but
touch this area carefully.

---

## OPEN — waiting on user material

### Dialect lessons M1 — IMPORTER CORE STARTED (East-Tyrolean material received)
Full spec + parsing rules + data model in **`build_history/spec_dialect_lessons_m1.md`**. Decisions
locked: glossary-table-first; East-Tyrolean pilot; dialect = target / High German = source; 3-col
table `dialect | de | note`; one row = one verbatim vocab item; approximate `de` voice toggle.
Safety spine: **user is the source of truth, the model is a packager/aligner, never an author.**
**Material received:** Bernd Kranebitter's "Dialekt Wörterbuch Osttirol" (CC BY-NC, used with
explicit permission — see `ATTRIBUTIONS.md`). A broader online source (mein-osttirol.rocks, 1165
entries) is pending a permission request to its operators (NOT to be scraped/imported until
permission is on file).
**SHIPPED this step (headless core):** `dialect-glossary.js` — a deterministic, no-LLM importer:
detects delimiter (tab/pipe/**equals**/comma/2-space), skips title/CC-license/header lines, parses
rows verbatim (no split/normalize beyond trim), keeps duplicates but reports them, and SURFACES a
suspicious "glued" row (the real PDF collided `Mangale…MannFock` artifact) as an anomaly for the
human to fix rather than auto-splitting it. `dialectVocabItems()` → `{target, source, note?,
_dialect:true}`. Tested against the real Osttirol material (`unit-dialect-glossary`,
`test/fixtures/osttirol-glossary.txt`).
**NEXT (M1 remainder):** (1) the `dialect` topic data model (`{id,label,base:'de',source:'de',note,
glossary,attribution,curated}`) + a `fromDialectMaterial` generation mode that builds vocab lessons
from rows with zero LLM; (2) `sourceOnly` QC direction (verify the German gloss, never rewrite the
dialect token); (3) the UI panel ("🗣 Dialect": name it, paste/upload glossary, column-map confirm,
optional note) + saved-list badge; (4) the "≈ German voice (approximate)" TTS toggle (default-on,
labeled) — to be evaluated on real words. Then M1.5 (opt-in AI example sentences, QC-gated), M2
(generated dialect stories, per-dialect `curated:true`, native-reviewed).

---

## OPEN — discussed, not started

### Dynamic mixed lessons as the DEFAULT progression model
Shift from "complete each lesson in a locked path" to "play variable-length mixed rounds from the
whole set until a target fraction of ALL questions is solved," with per-lesson coverage indicators.
**Interim shipped in v48:** (a) a `mixed` lesson present → non-teacher plays only it, once-through
unlocks the story; (b) script lessons cap play-time questions to a difficulty-scaled random subset.
The full model still needs the keystone: **stable per-question IDs** (exercises re-derive/reshuffle
today, so "solved" has nothing durable to attach to) + a per-question solved store + coverage UI +
weighted round assembly + a set-level completion fraction. **Commit A (landed, v50 wip):** `qid()` +
`_qidCanonical`/`_qidHash` give every exercise a stable `<lesson>:<type>:<hash>` id (content-derived,
shuffle-independent, skill-distinct), plus `APP.progress.solved[topic]` (monotonic, flag-excluded)
recorded on correct answers — purely additive, nothing consumes it yet, proven stable by
`unit-qid-stability` (real builder × 50 shuffles → one bounded id universe). **Commit B (landed,
v50 wip):** coverage model consumes the solved store — `_lessonQidUniverse` (monotonic, cached,
convergence-derived denominator with zero builder drift), `lessonCoverage`/`topicCoverage`/
`coverageComplete`, and `assembleCoverageRound` (~70/30 unsolved/review, unsolved-first) wired into
`buildMixedExercises`. `setComplete` uses coverage for a mixed-driven set (story-unlock + 100% now
mean "solved ≥ target of the question universe", not "played once"); path bar shows "N of M solved ·
P%" and the mixed node a 📊 N/M chip. Guarded by `unit-coverage`; browser checks in §47. **Commit C
(next, optional):** coverage-aware sampling *inside* a single script/intro lesson's play-cap (still
plain random — a short one-lesson round can miss letters), and any teacher/opt-in toggle if coverage
should apply outside the mixed-driven case. Open design Qs — resolved as defaults this cycle:
what counts as "solved" (**one correct = coverage model**, chosen); default vs opt-in vs teacher
path (**opt-in / additive via the existing mixed flow**); round weighting (**≈70/30 unsolved/
review**); **coverage-aware sampling** (the v48 script play-cap is plain random — a short round can
miss letters); flagged questions excluded from the denominator (**done in Commit A's markSolved**).
Builds on existing `buildMixedExercises` + `_srcLessonIdx`.

#### Design note — two identity concepts (instance qid vs content qid)
When the future **user-management / long-term progress** layer lands (cross-storyline "repeat
questions the user has seen before" / SRS), it needs a *different* id from the one Commit A built —
plan for both now so the seam is understood:
- **Instance qid** (Commit A, shipped): `"<lessonId>:<type>:<hash(canonical)>"`. Lesson-scoped on
  purpose. Answers "have you finished *this* lesson / this set" → coverage bars, story-unlock,
  Commit B round assembly. The lesson prefix means the *same* word in two storylines is two
  different ids (correct within a storyline; prevents collisions).
- **Content qid** (future, NOT built yet): `"<lang>:<srcLang>:<type>:<hash(canonical)>"` — drop the
  lesson prefix, add the language pair. This makes the same skill on the same pair **collide on
  purpose across storylines**, which is exactly what "you've seen this before" / SRS keys off.
  It's a small additive function that reuses the SAME `_qidCanonical` + `_qidHash`; don't build it
  until a consumer exists (avoid unused abstraction / drift).
- The language pair MUST be in the content qid (the instance qid gets it for free via the lesson
  prefix) — else the same English gloss across different target languages would wrongly merge.
- **Edit-stability caveat:** both ids are content-derived, so editing a question's text changes its
  id and breaks the "seen before" link for that item (fine for SRS = re-learn). If edits must ever
  preserve cross-storyline history, that needs a real STORED stable id on the source item in
  `lessons.json` (a genuine future decision + data migration — not needed for Commit A/B).

---

## OPEN — user progress & user-specific content (NEW, v50)

### Learned-vocabulary ledger — FOUNDATION SHIPPED (v50)
`APP.progress.learned["<lang>|<srcLang>"] = { vocab:{ target:{source,seen,wrong} }, sentences:{…} }`
accumulates every word/sentence the learner is taught across ALL lessons and topics (via
`recordLearnedFromLesson`, called from `showComplete`), tracks wrong-answered words for future
focus, excludes flagged items, and is per-language-pair (NOT cleared by a per-topic progress reset —
it's a lifetime record). `learnedSummary()` gates UI. **Nothing consumes it for generation yet** —
that's the plan below. Guarded by `unit-learned-vocab`.

### "My story" — generate from what the learner has learned (FIRST VERSION SHIPPED, v50)
Goal: a story/lesson generated from the learner's cumulated vocabulary & sentences, to RETRAIN what
they've learned, focusing on words they got wrong. **Shipped (hybrid, option i — story-seed +
reinforce-as-context):** selecting `✨ my story` (the `__my__` sentinel, shown when ≥8 words learned
for the pair) now runs a real generation. Client `myStoryPayload()` sends the learned slice
(`fromLearned:{vocab:[{target,source,wrong}]}`, wrong-first, capped 60) instead of `continuedFrom`;
server `generate()` (a) seeds the STORY prompt from the known words with extra attention to
wrong-answered ones, and (b) routes the same slice into the existing `chainVocab`/`vocabMode:
'reinforce'` channel so the LESSONS weave those words into sentences. Topic-less: the server
synthesizes a "My review — <lang> (date)" topic and force-regenerates (no same-day cache hit). The
whole downstream pipeline (translation, vocab extraction, lessons) is unchanged. Plumbing guarded by
`unit-my-story`; **story/prompt QUALITY needs live-model tuning (checklist §50).**
**Future upgrade — reinforce-as-drill (option ii):** currently the wrong words are woven into
sentences as *context* (reinforce mode = "do not list as vocab items"). A stronger retraining mode
would inject the wrong words as the lesson's *quizzed* vocab items (MCQs etc.), not just context —
needs a small new injection in `generateOneLesson` + live tuning. Also open: whether "my story" can
optionally produce a pure review lesson-set (skip the story) — deferred (the story route reuses the
most and is the more rewarding framing).

### LLM-free progress-dependent drill lessons (MID/LONG-TERM)
Distinct from "my story" (which is LLM-generated): generate **review/drill lessons directly from
the learner's failed questions — with NO LLM step at all**. The data is already on hand: the
learned-vocabulary ledger (`APP.progress.learned["lang|srcLang"]`) tracks a per-word `wrong` count,
and the solved store tracks per-question `qid`s. A drill lesson would be assembled purely
client-side by pulling the high-`wrong` words (and/or unsolved qids) straight into the existing
exercise BUILDERS (`buildStandardExercises` etc.), which already turn `{target,source}` pairs into
MCQs / type-answer / order exercises without any model call. So this is fast, offline, free, and
deterministic — the natural complement to the coverage model.
Why it's compelling: unlike reinforce/extend (which weave words as *context*), this DRILLS the
exact words the learner got wrong as *quizzed* items, and needs no generation latency or model
tuning. It works even in the static (no-backend) build.
Sketch: a "review my mistakes" action that (a) collects the current pair's wrong words from the
ledger (weighted by `wrong`, padded with related known words so a short list still makes a full
round), (b) synthesizes an in-memory lesson `{type:'standard', vocab:[…]}`, (c) runs it through the
normal play UI. Could also become a coverage-aware "weak spots" round inside the mixed flow. Open
Qs: how many words per round + padding strategy; whether it persists as a saved lesson or is
ephemeral; how solving there feeds the solved store / clears the `wrong` flag once re-learned;
presentation (a button on the result card or the path). Depends only on shipped pieces (learned
ledger + solved store + builders) — no server work, no LLM. Good candidate for an early, low-risk
win when the user-progress track resumes.

### Milestone stories — "unlock" curated reading based on learned vocabulary (LONG-TERM)
As the learner's ledger grows, unlock hidden, human-authored (or curated existing) content in the
target language that they should now be able to read: short stories, essays, real short-form
literature, or pieces that summarize what they've learned / explain target-language concepts they can
now understand. Framed as LEARNING MILESTONES (a reward + a comprehension check at the edge of their
vocabulary). Data model sketch: a pool of curated pieces each tagged with a required-vocabulary set
(or a difficulty/known-word threshold); a piece unlocks when the learner's ledger covers ≥ X% of its
required words. Distinct from generated stories — these are vetted, `curated:true`, native-authored.
Open Qs: authoring/ingestion pipeline for the pieces + their vocab tags; unlock threshold; whether
unlocked pieces feed back into the ledger; presentation (a "library"/"bookshelf" of unlocked reading).
Depends on the learned-vocabulary ledger (shipped) and benefits from the cross-storyline content-qid
identity (see the design note under mixed lessons).

---

## OPEN — scripts

- **Hindi matras/conjuncts.** Basic Devanagari table shipped (44 letters, recognition only). Matras
  (positional vowel signs) and conjuncts (क्ष) need a different lesson type — larger effort, only if
  demand warrants.
- **Thai** — still the only empty stub in `scripts.json`. Fill the table (like the others) when
  wanted; same posture (native review of romanizations). Bounded, headlessly testable — a good
  small win.
- **Native review of romanizations** — Hangul, Hebrew, Arabic, Devanagari translits are
  high-confidence but worth a native pass.
- **Plan A — multi-language transliteration/sound matrix.** Speak an accurate *pronunciation* per
  (script, letter, UI-language) via a per-(script, letter, UI-lang) matrix in scripts.json, sourced
  from CLDR/ICU + LLM + native review. Big data effort; deferred.

---

## OPEN — larger tracks (carried, not scheduled)

- **`examples.json` stock via batch-gen + QC** ("greetings and introductions" seed) — Priority 1 in
  the v48 roadmap. Generate a stock set offline, QC-gate it, measure `_genMeta` quality on a weak
  model. (Partly gated on §0 — batch-gen quality wants a live weak model.)
- **Map-tree UI on the main page** — Priority 2 (visual topic tree).
- **Platform track** — Priority 3, large; see `platform_plan.md`. Keep client↔server coupling from
  deepening so a future clean API boundary stays feasible.
- **QC coverage — remaining work.** v49 added grammar + conjugation (translation pair). Still open:
  a dedicated **article/plural** correctness check for grammar and a **per-form conjugation**
  correctness check (both need new prompts, best tuned against a live model). `math` and the two
  error-hunt types stay intentionally out of scope.
- **Static-build flag handling — content-merge review UI.** Beyond flags-only merge, support merging
  a re-import with a review UI (TODO later).

---

## Tech debt
- ~~**Version drift in `build-static.js`.**~~ ✅ Fixed in v49 — the static build parses `APP_VERSION`
  out of `server.js` at build time and interpolates it into both spots. Guarded by
  `unit-version-derivation`. A single `server.js` bump + `build-static.js` re-run now suffices.
- **Three "set done"/visibility checks were duplicated** → consolidated into `lessonCountsFor` /
  `countedLessons` / `setComplete` in v48. If a new visibility rule is added, change it there only.
- **Orphaned `ui.json` keys (general cleanup).** As of v49, `tts.voice_search` ("How to get better
  speech output") is the one remaining unreferenced key — kept for potential reuse. (Its siblings
  `tts.voice_warn_q` and `tts.voice_mute_hint` were reused as the sound-test Test/Mute tooltips.)
  When doing a general ui.json clean, sweep for any other keys not referenced in `index.html` /
  `server.js` / `build-static.js` and drop them across all languages in one pass.

---

## Reference docs (build_history/)
- `spec_dialect_lessons_m1.md` — dialect M1 spec (decisions locked, awaiting material).
- `LIVE-TEST-CHECKLIST.md` — browser/Ollama checklist (§§1–45).
- `ui_translation_flags.txt` — ui.json keys to re-translate (TranslateGemma).
- `roadmap_v49.md`, `roadmap_v48.md` — historical; the larger original plan text (examples.json,
  map-tree, platform, intro phase-2, etc.) lives in v48 in full if more detail is needed.
- `v47x_session_integration_review.md`, `v47x_furigana_seam_audit.md` — cross-feature audits.
- `v49_session1_notes.md` — the full v49 change log.
- `START-HERE.md` — pointer (should point at this file as the current roadmap).
