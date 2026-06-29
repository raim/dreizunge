# Roadmap v48

> **Prioritized next:** German-dialect lessons — see `build_history/spec_dialect_lessons_m1.md`
> (M1: faithful lessons from uploaded glossary/parallel text; generated dialect stories deferred to
> M2). A dialect scaffold already exists in code (`userDialect` hint + user-story/translation import
> + `sysLessonFromText`); the M1 gaps are a glossary-table importer and anchoring lessons strictly to
> uploaded ground truth instead of the model's dialect knowledge.

## Build plans (queued, not started)

### Dynamic mixed lessons as the default progression model — DISCUSSED, not started
Shift the play model from "complete each lesson in a locked path" to "play variable-length mixed
rounds drawn from the whole set until a target fraction of ALL questions is solved." Each lesson
node shows partial coverage (e.g. "9/29 solved") instead of locked/done. Builds directly on the
existing `mixed` lesson (`buildMixedExercises` already pools siblings, prefers ⭐, skips
flagged/hidden, tags `_srcLessonIdx`). Do not start until the data-model decisions (esp. "what
counts as solved") are made.

**What changes, concretely:**
- **Progress model: per-question, not per-lesson.** Today `progress.completed[topic][lessonId]`
  is a per-lesson flag/score. The new model needs per-*question* solved-state, e.g.
  `progress.solved[topic][questionKey]`. That means every exercise needs a **stable id** — today
  exercises are re-derived/shuffled on each play (script lessons especially), so a content-hash key
  (type + target/correct + direction) is needed so "solved" survives re-derivation and reshuffles.
  This is the core enabling change.
- **Per-lesson coverage indicator.** Each lesson node shows `solved / total` of *its* questions
  (resolved via `_srcLessonIdx` when played in a mixed round), e.g. a partial ring or "9/29".
  Replaces the binary done-node for the mixed-default mode; the linear path can remain as an
  optional/teacher view.
- **Variable-length mixed rounds.** A "Play" button assembles a round of N (the Quick/Normal/Full
  length idea from this session) weighted toward **unsolved** questions, with some review of solved
  ones. Generalizes `buildMixedExercises` from "perType per sibling" to "weighted sample over the
  whole pool by solved-state."
- **Completion = a defined fraction of ALL questions.** The set is "done" at e.g. 80% solved
  (configurable), not 100% of every lesson. A set-level progress bar tracks the fraction.

**Open design questions (decide before building):**
1. **What counts as "solved"?** One correct answer (coverage model) vs. spaced-repetition mastery
   (needs N correct, decays over time → SRS). Coverage is far simpler and matches the stated goal
   ("solved a defined fraction"); SRS is a bigger system. Recommend coverage first, SRS as a later
   layer.
2. **Stable question identity.** Required for per-question progress. Define a content-hash key and
   make `buildExercises` / the intro re-derivation attach it. The hardest enabling piece.
3. **Default vs opt-in.** "Default playing model" — does the locked linear path go away, or become a
   toggle? Recommend: mixed-default for learners, linear/locked still available (and teacher mode
   keeps the full per-lesson path for editing/QC).
4. **Round assembly weighting.** Pure unsolved-first, or unsolved-heavy with light review? Avoid
   starving review entirely; a 70/30 unsolved/review split is a reasonable default.
5. **Coverage-aware sampling** (ties to the deferred round-length feature): a short round shouldn't
   repeatedly miss the same questions — sample to spread coverage across lessons/letters.
6. **Interaction with hidden/flagged.** Hidden lessons already excluded from pooling + play; flagged
   questions already de-prioritized — both carry over. Decide whether flagged questions count toward
   the denominator (recommend: no, exclude from "all questions").

**Why it's tractable:** `buildMixedExercises` + `_srcLessonIdx` + the per-item flag/⭐ ranking are
already in place; the genuinely new work is (a) stable question ids and (b) per-question progress
storage + the coverage UI. Sequence: stable ids → per-question solved store → coverage indicator on
nodes → weighted round assembly → set-level fraction + "keep playing" loop.

**Interim shipped (v47.x):** as a stopgap before the full model, **script lessons** now apply the
difficulty cut-off (`introMaxLetters`, 8/12/16) a *second* time — at play time — capping the
presented questions to a difficulty-scaled **random subset** (so a 12-letter lesson plays ~12
questions, not ~29; replays reshuffle). Implemented in `buildIntroScriptExercises`; **script lessons
only** for now. The general per-lesson/global "round length" version (all lesson types) is part of
this plan.


---

- **Dialect lessons M1 — WAITING ON USER MATERIAL.** Decisions locked (glossary-table-first;
  East-Tyrolean pilot; dialect=target / High-German=source; 3-col table dialect|de|note; one row =
  one verbatim vocab item; approximate `de` voice toggle). Do NOT start coding until the user
  supplies real East-Tyrolean rows — the importer's column/orthography handling should be built and
  tested against actual data, not guessed shapes. Full spec + parsing rules + data model + task
  scope in `spec_dialect_lessons_m1.md`. Then: M1.5 opt-in AI example sentences (QC-gated), M2
  generated dialect stories (per-dialect `curated:true`, native-reviewed; high risk).


Carries forward from v47. **v47 shipped** (see `build_history/v47_session1_notes.md`): a batch
of UX / i18n fixes (import Merge/Replace dialog, storyline lesson-type icons, Arabic-as-target
RTL split), Japanese furigana support (paste-time `<ruby>`→bracket normalization + katakana
readings + a protect-and-restore sentence tokenizer), and the **intro "learn the script"
course phase 1 (Cyrillic)** — a new LLM-free `intro_script` lesson type. `APP_VERSION` is now
`v47`.

Most of v47's work is **headless-verified for logic only** (pure helpers + structural guards +
client/server parity asserts). The biggest carried-forward debt is therefore a **browser pass**
over the v47 UI changes, plus the usual content/i18n follow-ups.

---

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it
without being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n
listing, version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session:** read THIS file (the highest-numbered `build_history/roadmap_v*.md`
is the current one), then `build_history/LIVE-TEST-CHECKLIST.md`, then the most recent
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
   rendering, anything not exercisable headlessly), ADD a numbered section describing exactly
   what to click and what to expect. *This is the one most often forgotten.* Anything you label
   "browser-verify owed" in notes MUST have a matching checklist entry.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to
   other languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass
   is run. Changed English values won't be re-translated automatically (script keys off
   *missing*, not *changed*) — call those out explicitly or hand-edit if language-neutral.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script,
   furigana tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release.
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version
   bump write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables
   are still owed (browser pass, i18n, native-speaker content checks).

(If you add a new standing rule, append it here so the next session inherits it.)

---

## Priority 0 (new) — Browser-verify the v47 batch

Everything in v47 was built and tested headlessly. Before building more on top, do one focused
browser/Ollama session to confirm the live behavior of:

- **Import Merge/Replace dialog** — the `showChoiceDialog` modal renders, all three paths
  (Merge → flags-only, Replace → overwrite, dismiss → abort) behave, and the import endpoint
  receives the right `mergeFlags`.
- **Storyline lesson-type icon row** — emoji-only row renders per chapter card with working
  `title` tooltips.
- **Arabic-as-target RTL** — an English→Arabic lesson keeps an LTR interface with Arabic
  *content* (questions, sentence-ordering tokens, target boxes) right-aligned; an Arabic-UI
  session mirrors fully.
- **Japanese furigana** — paste a `<ruby>` story and a bracket story; furigana shows in
  play, sentence-ordering splits keep each `BASE[reading]` group whole (incl. katakana
  loanwords), TTS speaks the base only. Test both Ollama-generated and hand-pasted stories.
- **Intro `intro_script` (Cyrillic)** — on an en→ru storyline the "🔡 Learn the script"
  add-lesson option appears; generating it builds a playable lesson (glyph↔sound MCQs +
  listen items); the lesson plays, and it survives the static build (`SCRIPTS_DATA` baked).
  Check the lesson **editor** view for an `intro_script` lesson (currently routed to the
  standard branch — see intro phase-2 "letter-table editor" below).

Why P0: the entire v47 surface is unverified live; cheap to clear and it de-risks everything
that follows.

---

## Priority 1 — `examples.json` stock via batch-gen + QC ("greetings and introductions")

**This is the content engine that finishes Major A.** The `{EXAMPLE}` mechanism already
consumes per-(prompt, language) examples; right now they live inline in `prompts.json`. P1
produces a real, curated stock and promotes it to a dedicated `examples.json`.

Plan:
1. **Promote storage.** Move the `examples` blocks out of `prompts.json` into `examples.json`
   (`{ "<prompt>": { "default": …, "<lang>": … } }`); have `promptExample()` read it. Keep
   `default` fallbacks so behavior stays identical when a pair is unseeded.
2. **Batch runner (offline script).** Generate lessons for the single controlled topic
   **"greetings and introductions"** across all (or a curated subset of) language pairs ×
   in-scope lesson types, at a fixed difficulty. Reuse the generation engine directly; log
   `_genMeta` (attempts / valid / rejected / reject reasons) per run.
3. **Auto-QC pass.** Run outputs through the existing validators (e.g.
   `validateWordFormsItems`) + the QC checks; bucket into pass / salvageable / reject with
   reasons.
4. **Manual triage.** Review the auto-passed/borderline items; hand-pick clean GOOD examples
   and instructive BAD examples per (prompt, language). (Native review is required — this is
   the human gate the roadmap has been deferring; "greetings" is a good controlled topic
   because the vocabulary is small and checkable.)
5. **Populate `examples.json`** with the curated GOOD/BAD stock; the `{EXAMPLE}` mechanism
   picks them up with no further code.
6. **Measure** (the deferred A-phase-3 gate): on a weak local model, compare `_genMeta`
   reject rates for a seeded pair vs the default. This is the evidence that decides whether
   to keep expanding seeds.

Why high: it directly unblocks the only-content-now remainder of Major A, produces the
quality data that's been owed, and the controlled topic keeps the QC tractable.

Depends on / continues: v46 Major A; `build_history/v46_session3_notes.md`;
`prompt_examples_audit.md`.

---

## Priority 2 — Map-tree UI on the main page

Visualize project data on the language tree, with a list view when two languages are
selected.

- **Tree view:** per node (language) / per pair, overlay data — number of lessons, lesson
  stats, counts of flagged and starred questions, generation health.
- **List view (two languages selected):** the same data as a sortable list for that pair.
- Reuses existing per-item **flag** + **star rating** data and lesson metadata; mostly a
  read/aggregate + visualization task on the client.

(Visualization-heavy — front-end design work; keep it on the existing single-file client.)
Pairs naturally with the **content-merge review UI** (below): both are list/diff views over
per-item signals.

---

## Priority 3 — Platform track (parallel, large; see `platform_plan.md`)

Multi-user accounts, central repository for submitting flags/edits/new lesson sets, a token
economy (earn by solving / buy), and web + mobile. This is a separate, much larger effort
tracked in `build_history/platform_plan.md`. **Constraint on all feature work:** keep it
compatible with a future clean API boundary (don't deepen client↔server coupling), so the
platform's Phase 0 stays cheap.

---

## Intro "learn the script" course — phase 2+ (carried forward)

Phase 1 (Cyrillic) shipped in v47: `scripts.json`, the `intro_script` lesson type
(server `generateIntroScript` + shared `introScriptExercises` / client
`introScriptExercisesFrom` + `buildIntroScriptExercises`), `LESSON_TYPE_META` +
`ADD_LESSON_GENERATORS` rows, `GET /api/scripts` + `loadScripts()`, static-build baking
(`window.SCRIPTS_DATA`), gated add-lesson UI (`needsIntroScript` + `scriptHasTable`), and
`unit-intro-script`. Exercises reuse `mcq_source_target` / `mcq_target_source` / `listen_mcq`.

Remaining:
- ✅ **Intro reinforce UI (shipped v47.x).** The 🔁reinforce/➕extend selector is now format-aware:
  it shows for `intro_script` (and vocab-style formats) on a story-continued chapter and is hidden
  for Math and for non-continued sets. Implemented by tagging each reinforce row with
  `data-has-prior` and toggling visibility on format change (alongside the math-instruction row).
  The storyline-aware reinforce(prior-chapter letters)/extend(new-this-chapter) semantics genuinely
  need prior chapters, so gating on a continued chapter is correct — this just made the row
  format-aware so it stops showing for Math and surfaces for intro_script.

- ✅ **Length cap by difficulty (shipped v47.x).** Script lessons quiz only a difficulty-scaled
  random subset of letters (introMaxLetters: 1≈8, 2≈12, 3≈16) instead of the whole 28–46-letter
  alphabet, while distractors still draw from the full alphabet (introScriptExercisesFrom's
  `distractorPool`). Mirrored on the server (`generateIntroScript` caps + passes `difficulty`).

### New plan A — multi-language transliteration/sound matrix for scripts.json
**Assessment.** `scripts.json` today gives each letter a single `translit` (Latin romanization)
and `name` (English letter name, e.g. "ghayn"). This is **UI-language-agnostic only by
accident**: the romanization is Latin-based so it's *passable* for any Latin-script UI, but it's
not localized. Two real gaps for a non-English learner:
1. **Letter names** ("alif", "ghayn", "tsadi") are English/scholarly — a German or Spanish UI
   would want localized or phonetic-in-their-language names.
2. **The "sound"** is taught as a romanization, but the *closest sound* is best explained
   relative to the learner's own language (Arabic غ ≈ French/German guttural r; the helpful
   comparison differs per UI language). The current single translit can't express that.

So yes, a **per-(script, letter, UI-language) matrix** is the right future structure, e.g.
`letters[i].i18n = { de: {name, hint}, fr: {…}, … }`, with `translit` kept as the neutral
fallback. **What exists to source it:**
- **Unicode CLDR** — character labels / transliteration data, and locale data; some script and
  character naming.
- **ICU `Transliterator`** (script↔Latin, e.g. `Any-Latin`, `Arabic-Latin`) — deterministic
  romanization, good for the neutral `translit` but not for per-language *sound hints*.
- **ISO romanization standards** (ISO 233 Arabic, ISO 9 Cyrillic, Hepburn JA, RR Korean) — what
  the current tables already follow.
- The per-language **sound hint** ("like X in <your language>") has no clean dataset; realistically
  LLM-generated then **native-reviewed** (same gate as `examples.json`), or sourced from existing
  language-course material.
**Plan:** (1) add an optional `i18n` block per letter (neutral `translit`/`name` stay as
fallback); (2) make `introScriptExercisesFrom` prefer `letter.i18n[uiLang].name`/sound when
present; (3) seed `de`/`fr`/`es` for one script (Cyrillic or Greek) via CLDR/ICU + LLM, native-
review, measure; (4) expand. Until then the Latin romanization is the universal fallback — fine
for Latin-script UIs, weakest for CJK UIs. Pairs with the examples.json curation pipeline (P1).

### New plan C — QC coverage for synonyms, word_forms, and script lessons
**✅ synonyms + word_forms SHIPPED (server-side, Ollama-verify owed); script = human-QC (done).**
`_runQc` now dispatches by lesson type: `vocab/sentences` → `qcCheckPair` (as before);
**`word_forms` → `qcCheckCloze`** (checks the marked-correct option fits the blank, distractors
are genuinely wrong, translation matches, explanation is right); **`synonyms` → `qcCheckSynonymSet`**
(gloss accuracy, each synonym/antonym/homophone really belongs); `intro_script` → skipped (curated
data, human-QC via the per-letter flag/star/edit affordances already shipped). Both new checkers
reply OK-or-one-sentence-suggestion, parsed by `_qcParseOkOrSug`, and write `item.qc = {sug, field:
'note', at}`. The editor renders a read-only QC note (suggestion + dismiss ✕) in the word_forms and
synonyms branches via `_qcNoteHtml`/`qcDismissAny` — no one-click auto-apply because these fixes
span multiple fields, so the maintainer edits manually then dismisses. Headless test
(`unit-qc-dispatch`) covers the parser + per-type dispatch with stubbed checkers; the LLM prompts
themselves need an Ollama pass (LIVE-TEST). Pairs with "minor #2 QC expansion".

#### (original assessment) The QC pass (`server.js _runQc` -> `qcCheckPair`) only
iterates **`vocab` and `sentences`**, checking a `target` <-> `source` translation pair via the
translation LLM (returns OK / `T:` corrected target / `S:` corrected source, written to
`item.qc = {sug, field, at}` and surfaced in the editor as a suggestion). So today:
- DONE: vocab, sentences — covered.
- GAP: **synonyms** (`ls.words`: `{base, gloss, synonyms:[{w,g}], antonyms, homophones}`) — not a
  plain target/source pair, so untouched. Needs a *set-shaped* check: is each `w` a real synonym
  of `base` in the target language, is `g`/`gloss` an accurate source gloss, are antonyms truly
  antonyms? A different prompt returning per-entry verdicts, written as `word.qc` / per-`w` qc.
- GAP: **word_forms** (`ls.items`: `{sentence (with blank), translation, choices, correctIndex,
  explanation}`) — not covered. Needs a *cloze* check: does `choices[correctIndex]` correctly
  fill the blank, are the distractors actually wrong (but plausible), does `translation` match,
  is `explanation` correct? Verdict written as `item.qc` keyed to the item.
- SPECIAL: **script (`intro_script`)** — the `letters` are **curated data, not LLM-generated**, so
  "QC" here means *correctness of the romanization/sound/name* per script — exactly the
  external-verification concern (Hangul/Hebrew/Greek). Two options: (a) an LLM "is `translit`/
  `name` the right value for glyph `ch` in <script>?" pass (cheap, catches gross errors, but the
  LLM is itself unreliable on transliteration — modest value); (b) treat it as **human QC**:
  ship the per-letter flag/star/edit affordances (done) and rely on native review, optionally
  importing an authoritative table (CLDR/ICU, see Plan A) to diff against. Recommend (b) primary,
  (a) only as a coarse pre-filter.
**Plan:** generalize `_runQc`'s per-lesson loop to dispatch by type to a checker:
`vocab/sentences` -> `qcCheckPair` (today); `synonyms` -> `qcCheckSynonymSet`; `word_forms` ->
`qcCheckCloze`; `intro_script` -> skip LLM (human-QC) or a coarse glyph->translit sanity check.
Each writes `*.qc` in a shape the editor already renders. Needs Ollama to build + verify (same
gate as the existing QC), so it's a server-side pass with its own unit test for the dispatch +
qc-shape (the LLM call itself stays integration-tested). Pairs with "minor #2 QC expansion".

### Script-lesson editing — future (per user)
Glyph (`ch`) and lowercase are now **read-only** in the editor; `name`/`translit`/`ipa` stay
editable for fixing romanizations (e.g. the Hangul/Hebrew values pending native review). Once a
script's data is verified, lock it down further: editing should be limited to **(1) reorder** and
**(2) swap which glyphs are in the lesson** via a picker that selects from the script's full
alphabet (no free-text of the curated romanization). I.e. a glyph-selection grid (toggle letters
in/out, drag to reorder) replacing the per-field inputs, gated behind a "data verified" state so
free-text edits aren't possible once the table is trusted.

### New plan B — auto-add script lessons in multi-chapter (arc) generation
**✅ SHIPPED (server-side, browser/Ollama-verify owed).** Implemented in the generate-book chapter
loop: when arc is on, the target uses a script the source doesn't (`needsIntroScript`), and the
`arcScript` opt-in is set (defaults on for differing-script pairs), each chapter gets an
**extend-mode** `intro_script` lesson **prepended** (`data.lessons.unshift`) covering the letters
new to that chapter. Server helpers added: `_scriptCharSet`, `chainGlyphSet` (prior-chapter
glyphs), `introExtendLetters` (this chapter minus prior, capped by difficulty), `buildArcIntroLessons`.
Client: a "🔡 Teach the script per chapter" checkbox under the arc toggle (shown only when scripts
differ + multi-chapter), `arcScript` plumbed into both generate-book call sites. Skips a chapter
with <4 new letters. Server unit test covers extend-per-chapter + gating + cap. Still owes an
Ollama-backed end-to-end pass (LIVE-TEST §33c).
Original assessment retained below for reference.

#### (original assessment)
**Assessment — feasible, server-side.** Multi-chapter stories are generated by the server
(`/api/generate-book`, background job looping chapters with arc reinforce/extend for vocab). The
server already has `generateIntroScript`, `scriptsForLang`/`needsIntroScript`, the chapter chain
walk (`continuedFromId`, the prior-chapter vocab collector at server.js ~252), and the per-chapter
upsert. So the hook is clean: in the generate-book chapter loop, **after** a chapter's vocab/word-
form/synonym lessons are generated, if `needsIntroScript(target, src)` and the arc is on, build an
`intro_script` lesson in **extend** mode (letters new to this chapter vs. all prior chapters) and
**prepend** it to that chapter's `lessons` array so it plays first.
**Design:**
- Gate: only when target/source **scripts differ** (`needsIntroScript`) and `arc` is enabled
  (reuse the arc flag already in `gbody`).
- Per chapter, compute **extend letters** = glyphs appearing in *this* chapter's generated
  content minus glyphs from *all prior* chapters (server already collects prior-chapter text for
  the vocab reinforce/AVOID logic — extend that to a per-script glyph set). Cap by difficulty
  (introMaxLetters). For chapter 1 this is "all letters introduced so far".
- Build via `generateIntroScript`-style logic but seeded with the computed extend letters +
  full-alphabet distractor pool; set `_arcMode:'extend'`.
- **Prepend** (unshift) into the chapter's lessons so the script primer comes before vocab —
  "generated after, ordered before."
- Make it **opt-in** (a checkbox near the arc toggle, default on for differing-script pairs) so a
  learner who already knows the script can skip it.
**Why server-side:** the lessons must be baked into each chapter as it's persisted by the book
job; doing it client-side post-hoc would race the background job and miss the static/export path.
Needs Ollama to verify end-to-end, so it's its own focused pass (don't ship blind). Mirror the
extend-letter computation in the client helpers already written (`introLetterScope`) to keep
parity, and add a server-side unit test for the per-chapter extend-glyph set.
- **Phase 2 — fill the stub tables.** `scripts.json` already has empty, well-formed stubs for
  `hiragana`, `katakana`, `greek`, `hangul`, `arabic`, `hebrew`, `thai` (so the option stays
  hidden until a table is non-empty). Fill **hiragana / katakana / greek / hangul** first
  (simple 1:1 sound mappings, all have TTS). Each is just data — no code — and `needsIntroScript`
  flips on automatically. For `ja`, the add-lesson path already adds one lesson per script.
- **Phase 3 — Arabic positional forms + Hebrew (RTL).** Add `forms`
  (`isolated/initial/medial/final`) to the Arabic table and an exercise variant that matches a
  positional form to its letter; RTL display reuses v47's `.tgt-rtl` axis. Hebrew similarly.
- **Letter-table editor view.** `intro_script` currently routes to the **standard** editor
  branch, which expects `vocab` and will look wrong. Add a dedicated `editorBranch` that shows
  the `letters` table (read-only, or light edit of `translit`/`name`) instead.
- **"Chapter 0" auto-prepend (optional).** Offer to auto-create an intro-script chapter when a
  brand-new script pair's first storyline is generated (rather than only via the manual
  ➕ add-lesson). Keep it opt-in.
- **Kanji-radicals (stretch, ja).** Beyond kana, a radicals primer for Japanese — larger and
  fuzzier; revisit after kana/greek/hangul land.

---

## Minor features (carried forward)

1. ✅ **DONE (v47) — QC button in the storyline-page header.** `#sl-screen-qc-btn` wired in
   `_renderStorylineScreen` to `qcRun({storylineId})`. (The QC run itself is browser/Ollama-owed.)
2. **TODO (needs Ollama) — Expand QC to all lesson types except `math`, the two error-hunt
   types, and `intro_script`.** QC is server-side: `_runQc` loops only over `vocab`/`sentences`
   and calls `qcCheckPair(target, source)` — a translation-pair checker.
   `grammar`/`conjugation` have a checkable target↔source (noun/infinitive ↔ translation) and
   could be added to that loop with low risk; `synonyms` (base+gloss+arrays) and `word_forms`
   (sentence/choices) need their **own** QC checks. `intro_script` is procedural/curated and
   needs no QC. All of it changes the LLM path, so it must be verified live against Ollama
   before shipping — deliberately not done blind in a headless session. Note: the client
   lesson-level QC button (index.html ~`qcRun({topicId,lessonIdx})`) is gated to
   `L.vocab||L.sentences` and must be widened in step with the server.
3. ✅ **DONE (v47) — Live-mode storyline page: lesson types per chapter.** Now an **icon-only
   row** (v47 cosmetics change), via `lessonSetTypes(s)` + `_lessonTypesDropdownHtml`, labelled
   from the Major B registry. Guarded by `unit-storyline-screen-extras`. (Browser-verify-owed.)

---

## i18n debt (carried forward — English shipped, other langs generated offline)

Several user-facing strings were added in English only and need the offline translation pass
(same workflow as `static.pill.*`):
- `import.choice.*` + `dialog.cancel` (v47 Merge/Replace dialog).
- `lesson.type.intro_script`, `lesson.type.desc.intro_script`, `form.format.intro_script`,
  `intro.need_open_set`, `intro.no_script` (v47 intro course).
- The older `static.pill.*` set, if any languages are still unfilled.

`toast.import_merge_confirm` is now unused (superseded by the dialog) — keep or prune.

---

## Static-build flag handling (status from v47 — mostly done, browser-verify owed)

The static build has no backend, so per-item `userFlag` / `userRating` / `userDelete` and a
lesson's `_miscFlags` ride the JSON export. v47 made that loop usable for crowd-sourced
corrections. **All shipped and logic-verified; the rendering/download/persistence need a
browser pass** (folded into P0 above). Shipped pieces:

- ✅ Hide flagged items in static play (non-teacher); teacher/editor still show them.
- ✅ Floating global "Download & submit" pill: tallies pending ⚑/⭐/🗑, close button, edit/delete
  triggers, GitHub "Submit as issue" link, all text in `ui.json` (`static.pill.*`).
- ✅ Pill download = **every complete storyline** with any flagged/rated/edited chapter (full
  context), plus flagged orphan topics; submit link hidden when a new flag makes it stale.
- ✅ Persist across reloads via `localStorage` (`dz_static_flags` / `dz_static_edits` /
  `dz_static_summaries`); round-trip in `unit-static-flags`.
- ✅ Star ("good example") shown in editor; ⭐ N counts on chapter/lessonset nodes.
- ✅ Import **merge vs replace** is an explicit choice (v47 dialog); merge is flags-only and
  identity-matched (`mergeFlagsIntoTopic`), drift-safe + idempotent; carries `editedAt` markers.
- ✅ Soft-delete (`userDelete`) in static — toggle, hidden from play, counted, rides export/merge.
- ✅ Export only the user's OWN signals (pristine baked-signal snapshot at load); exported
  topics stripped of pre-existing markers.
- ✅ Pill scope = explicit tags (⚑/⭐/🗑 + 📖 story / 📝 summary edits), not every content edit.

**TODO (later) — content merge with a review UI.** Beyond flags-only merge, support merging a
submission's *content* edits with a side-by-side interface (original vs edited, accept/reject
per change — a 3-way/diff review, not last-write-wins). The `editedAt` markers already tell the
maintainer *which* items to review; this UI shows the proposed text and applies accepted
changes. (Larger UI task — pairs naturally with the P2 map-tree / list views.) Possible
follow-ups: per-storyline grouping when several storylines are flagged (one button each); an
opt-in "include all my edits" toggle for users who want to submit their whole edit history.

---

## v47.x follow-up session — content-aware bidi, mute fallbacks, sound-test (shipped on top of v47)

Done on top of v47 (suite green + `check-inline` 0 after each; `APP_VERSION` stays `v47`).
All **browser-verify-owed** for visual confirmation.

- ✅ **Content-aware direction (`dir="auto"`) everywhere prose/answers are shown or typed.**
  Replaced the v47 *target-language*-based `.tgt-rtl` force on exercise content with per-element
  `dir="auto"`, so each field aligns by its OWN text, not the lesson's target language. Covers:
  all six story/summary/chapter **reading** surfaces; exercise **content** (`.qtext`, `.choice`,
  `.tok`, `.placed-tok`, `.target-box-text`, `.sbox-ph`) — so an English prompt left-aligns while
  Arabic choices right-align in the same MCQ; and **edit/typing** areas (story contenteditable,
  summary textarea, paste story/translation boxes, error-hunt corrupted-story textarea, and the
  `type-in` answer inputs) so typing Arabic flips RTL live. `.tgt-rtl` now only adds RTL **flow**
  to the word-order containers (`.sbox`/`.wbank`, so tokens read right-to-left) + the `.it-word`
  fallback. CSS uses `text-align:start` on the content fields to follow the resolved direction.
  Caveat: `dir="auto"` resolves from the first strong character, so a field starting with a Latin
  name before RTL text can resolve LTR (rare; per-element scoping limits it).
- ✅ **Muted listen exercises fall back to no-audio equivalents.** When the global mute is on,
  `listen_mcq` renders as a read-the-target MCQ (show the target word, pick the source) and
  `listen_type` renders as translate-by-typing (show the source, type the target) — same data,
  same check path, no audio dependency. Toggling mute mid-question re-renders the current listen
  exercise so it swaps live (only before it's answered). New strings `ex.badge.type_translate`,
  `ex.type_translate.q` (English; i18n-owed).
- ✅ **Sound-test popup cleanup + mute affordances.** The voice-test phrase is now numbers only
  (`tts.voice_test_phrase` = "1, 2, 3.", button label "🔊 1, 2, 3"); the Ecosia "how to get
  better speech" link is replaced by a short "If the sound is bad, you can mute it:" hint
  (`tts.voice_mute_hint`) + the standard mute button. The mute button is also added to the
  **bottom row of every question card** (next to Check), syncing via the existing
  `updateMuteButtons()` (all `.mute-btn`). `buildEcosiaQuery` is now unused in-app but kept
  (still unit-tested in `unit-tts-voice`); `detectBrowser`/`detectOS` still feed the warn heuristic.
- **i18n-owed:** `ex.badge.type_translate`, `ex.type_translate.q`, `tts.voice_mute_hint`
  (English shipped; other languages generated offline). Also: the `tts.voice_test`/`_phrase`
  edits only touched the English label — re-check other languages still read sensibly (they're
  mostly digits, so likely fine).

## New plan — letter-ordering answer mode for keyboard/script mismatch
**✅ SHIPPED (v47.x, browser-verify owed — LIVE-TEST §35).** Implemented as a manual ⌨️ toggle
(`APP.noKeyboard`, persisted) next to the in-lesson mute button rather than auto-detecting the
keyboard (browsers can't reliably report the active layout). When on, every type-the-target
exercise (`listen_type`, `type_plural`, `type_conjugation`, and the muted `listen_type` fallback)
renders as a **glyph-ordering** exercise reusing the word-order machinery (addTok/updateSbox/
C.placed) with the bank tokens = the target's grapheme clusters (`glyphTokens`, Intl.Segmenter
with a combining-mark fallback so Arabic harakat stay attached: قِطَّة → قِ/طَّ/ة). `check()` joins
the placed glyphs without spaces and compares with the same diacritic leniency as the typed path.
Unit-tested (`unit-no-keyboard`: tokenizer round-trip + gating). Original plan retained below.

#### (original plan)

**Problem.** A European learner doing an Arabic (or Greek/Cyrillic/Hangul/Hebrew/Japanese)
lesson typically lacks a keyboard for the target script, so any *type-the-target* exercise
(`listen_type`, and the muted `listen_type` translate-by-typing fallback above, plus
`type_plural`/`type_conjugation`) is unanswerable. Offer a **letter-ordering** answer instead:
like sentence-ordering, but the tokens are the individual letters of the target word/phrase,
shuffled — the learner taps letters into order. No target keyboard required.

**Design.**
- **Trigger.** A per-target-language "I don't have this keyboard" preference (persisted, like
  `imp3_*`), defaulting **on** when the target uses a non-Latin script the UI language doesn't
  (reuse `needsIntroScript` / `scriptsForLang` from the intro course) — with a manual toggle so
  Latin-diacritic learners or those with the right keyboard can turn it off. Browser keyboard
  layout isn't reliably detectable, so make it a preference, seeded by the script heuristic.
- **Builder/renderer.** Generalize the existing word-order machinery (`mkOrder` / `tOrder` /
  `addTok` / `selTok` / sbox state) to operate on **letters** of `ex.correct` instead of words:
  a `letter_order` exercise (or an `orderMode:'letters'` flag on the type exercises). Split the
  target into grapheme tokens (care with Arabic combining marks / Japanese kana+furigana — reuse
  `jaTokenize`-style grapheme awareness; for Arabic, split on base letters keeping diacritics
  attached). Shuffle, tap-to-place, check against the joined target. Reuse the v47 RTL container
  flow so Arabic letters order right-to-left.
- **Where it applies.** Replace the *type* step in `listen_type` (and its muted fallback),
  `type_plural`, `type_conjugation`, and optionally offer it as an alternative to MCQ for the
  intro `intro_script` course. Keep MCQ/type when a keyboard is available.
- **Scope.** Phase 1: a `letter_order` renderer + builder reusing word-order code, wired into
  `listen_type`/muted-fallback for a single RTL script (Arabic) end-to-end, behind the
  script-seeded preference. Phase 2: kana/Hangul grapheme splitting; intro-course integration.
  Guard with a unit test (grapheme split correctness per script + client/server parity if the
  builder is shared), following the `unit-furigana` / `unit-intro-script` pattern.

This dovetails with the intro "learn the script" course (shared grapheme/letter tables) and the
muted-fallback work above (both are "make the lesson answerable without audio / without the
right keyboard").

---

## Suggested sequence

P0 (browser-verify the v47 + v47.x batches + i18n for the new strings) → P1 (examples.json
batch-gen + QC) → **letter-ordering answer mode phase 1 (Arabic)** (high user value, reuses
word-order + intro-course code) → minor #2 (QC expansion, needs Ollama) → intro phase 2 (fill
kana/greek/hangul tables — pure data) → P2 (map-tree UI) + content-merge review UI → intro
phase 3 (Arabic/Hebrew RTL + letter-table editor) + letter-ordering phase 2 → P3 (platform) as
a separate track once the above land and the platform decisions in `platform_plan.md` §2 are made.
