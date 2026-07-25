# Roadmap v69

> **STATE AT HANDOFF: CUT AS `v69_t` (point release on v69, per the v56 numbering convention);
> suite 142 checks green; check-inline 0 on both builds.**
> v69_b adds (see `v69_session1_notes.md`): article-symmetry rule in all three vocab prompts;
> coverage-driven single-pass mixed rounds + the drill credit-back that finally makes the drill
> raise the launching chapter's coverage; the drill-card exit + coverage-replay fallback (the
> reported double dead end); and the pass mark baked into the static build (live/static parity).
> v69_c adds: the Latin two-case glyph spoken once; beginner-mode exercise-type restriction;
> and the fix for the third stuck report — progress-before-drill Next ordering, coverage-aware
> rounds, exact universe derivation — plus the storyline page's per-chapter provenance cleanup.
> v69 is a stability + queued-items release built in three sessions on the v68 tree
> (`v68_session2_notes.md`, `v68_session3_notes.md`). Headlines: the two provenance-stamp
> contract bugs and their boot heals; the **completion-crash cluster** (a TDZ ReferenceError
> crashed EVERY lesson completion — the reported "stuck"; plus the silently-dead pass-mark gate
> and the mixed-driven resume trap); and all six items queued in `v68_session1_notes.md`
> (error-hunt timeout, format-whitelist parity incl. all_types for books, provenance line at the
> bottom, book-job storyboard post-pass, student-mode flagging with mode provenance, and stage 1
> of the PDF text cleanup).

**v68 shipped** (duplicate-lesson-id repair). This file supersedes `roadmap_v65.md` (v66–v68 were
cut without successor roadmaps; every open item from roadmap_v65 is carried forward below).

## ✅ v69 — what shipped (details in the two session-notes files)
- **Provenance stamps**: live writes carry `source: 'recorded at generation'`; pasted stories stamp
  `origin:'user-pasted'` (corpus vocabulary); `fixMetaSource()` boot heal repairs pre-v69 live rows
  (incl. legacy `'user-provided'` origins, classified via storyline sourceFile). Guards:
  `unit-meta-source-heal`, stamp tests extended.
- **Completion-crash cluster**: `showComplete` TDZ fixed (declaration now precedes the v66.1 Next
  wiring); the undefined-`d` bug that silently disabled the v60.8/v66.1 pass-mark gate fixed (the
  gate FIRES for the first time — expect "keep going" + drill below threshold);
  `_firstUnfinishedLessonIdx` resumes an incomplete mixed-driven set at the mixed lesson even when
  every counted lesson carries a done-flag; `startLesson` signals failure and both loadSaveds route
  a stranded learner to storyline/landing — no path shows a learner the lesson-set page. Guards:
  `unit-learner-nav` §6.
- **Error-hunt generator**: `think:false` + reasoning-grade timeout (the last unguarded long call).
- **Format parity**: picker ⊆ client clamp ⊆ both route whitelists (`word_forms`/`synonyms` were
  dead menu entries); `all_types` + every format verified end-to-end for book jobs
  (`e2e-book-formats`).
- **Storyline provenance line** at the bottom (`#sl-screen-prov` above `#sl-screen-stats`).
- **Book-job storyboard post-pass** via shared `_storyboardForStoryline` (route + post-pass cannot
  drift); never overwrites an existing board; fake-ollama serves valid panels.
- **Student-mode flagging/starring** with `_flagMode()` provenance on all four write sites, a
  👤 student chip in the editor, and the `fixFlagModes()` boot migration (pre-v69 flags →
  `'teacher'`; 40 stamped in the shipped corpus).
- **Deterministic upload cleanup** `cleanExtractedText()` (join hard wraps incl. blank-line quote
  splits; drop letter-less lines/URLs/bylines/short headers), lossless 🧹 toggle, default ON for
  PDFs. Guard: `unit-pdf-cleanup`.
- **Corpus**: user's live library adopted (post-v68 upload), healed (22 source stamps, 40 flag-mode
  stamps), verified surgical both times.

## 🔭 What's left / carried forward (union of roadmap_v65 + the v68/v69 queues)

### Near-term, concrete
- **✅ FIXED in v69_q — a book chapter could overwrite a sibling sharing its title.** Root cause was
  deeper than first diagnosed: `generate()` saves the story EARLY (crash-resilience) with no id, so
  `upsert` name-dedups THERE — two same-titled chapters merged before `_persistGenerated` ran. Fix:
  mint the id at the early save (reusing an existing row's id only when title AND chain-parent
  match, so a real regenerate still updates in place but two siblings never merge), thread the
  parent's id through `_persistGenerated`, and record `continuedFromId` so chaining is never
  name-based. **Uncovered while fixing:** `_newTopicId` was nested inside `boot()` (which encloses
  most of the file), so it was invisible to `generate()` at module scope — my new call was the
  first from outside boot and threw "not defined"; the minter is now at module scope. Guard:
  `e2e-book-duplicate-titles` (3 chapters, 2 sharing a title → 3 distinct topics; verified to fail
  without the fix; a single-topic regenerate still updates in place, not duplicates).
- **NOTE (not a bug): cleanup floor working as intended.** Same run: chunk 4 hit the v69_o heavy
  path ("kept 62–64 of 197") and was applied-flagged, correctly. The user's earlier concern is
  resolved; leaving this note so the next session does not re-investigate it.

- **✅ DONE in v69_l — one definition of "chapter complete".** `setComplete()` is now the single
  rule (every counted lesson played AND coverage at or above the pass mark). Because it is only
  authoritative for the ACTIVE topic, its verdict is PERSISTED per chapter
  (`APP.progress.chapterDone[topic] = { done, n, at }`) and read back by the storyline lock, the
  green dot and the completion card's story-progress row via one shared `chapterComplete()`.
  `n` is the counted-lesson count at stamp time, so a chapter that changes shape (a lesson added or
  removed) invalidates the stamp and falls back to done-flags rather than trusting it. No global
  swap, no render cost, works in the static build (progress is client-side). Guard:
  `unit-chapter-complete`.
- **✅ DONE in v69_m — PDF cleanup stage 2, the model pass.** `POST /api/clean-text` removes
  non-narrative fragments the deterministic pass cannot classify (ads, "read also" teasers, photo
  captions, subscription prompts — text that reads as grammatical prose). Contract is DELETION
  ONLY and the server VERIFIES it: `cleanTextChanges()` checks the result is a word-level
  SUBSEQUENCE of the input, which rejects rewriting, rewording, translating and reordering in one
  cheap test, plus a floor (keep ≥40%) against summarising. Retries with specific feedback, same
  shape as the error-hunt generator. Client: an opt-in ✨ button beside the 🧹 toggle, per chunk,
  undoable, hidden without a backend (so never in the static build). Guard: `e2e-text-cleanup`.
- **UI translation — ✅ DONE in v69_d.** All 30 languages complete (`--check`: "All translations
  complete!"). The run needed a QC pass: 71 defects repaired (broken placeholders, cross-script
  corruption, icon drift, German errors) — see `v69_ui_translation_qc.md` and
  `tools/qc-ui-translations.js`. **Still open from that report:** German register split (22 *Sie*
  vs 22 *du*), untranslated leftovers (nl 30, lb 28, da 26, ro 24), and the unused `toast.no_voice`
  key deletion — ✅ DONE in v69_e (verified unreferenced in client, server, builder and tests before
  removal; 521 keys remain). **Translation QC is now permanent tooling (v69_f):**
  `node translate-ui.js --qc [--fix] [--retranslate]`, checks in `ui-qc.js`, shared with the
  translation writer so generated values are validated before they are written.
  ✅ **Cleared in v69_k:** the user's run filled the 2 new keys; `--check` clean, `--qc` reports
  **0 errors and 0 warnings** — versus 71 defects on the previous (pre-tooling) run. The hardened
  prompt plus write-time validation did their job on first contact.
- **✅ DONE in v69_n — teacher dashboard (overview + flag triage).** Teacher-only screen off the
  library header, hidden without a backend. Panel 1 reads `GET /api/learners`: per learner, chapters
  **finished** and chapters **started** (both — see the bug below), words known, and their hardest
  words. Panel 2 reads the new `GET /api/flag-summary`, which unifies item-level flags
  (`item.userFlag`, inside lessons), lesson `_miscFlags` and story-level flags (the flags store)
  into one list, newest first, with STUDENT reports leading; clicking one opens the chapter in the
  existing editor. **Fixed as part of it:** `summarize()` reported
  `chaptersCompleted = Object.keys(progress.completed).length`, i.e. chapters TOUCHED — a learner
  who opened ten and finished none read "10". It now prefers the v69_l per-chapter verdict, falls
  back to "every lesson flagged done" when the library is supplied, and claims nothing when
  completion is unknowable. Guards: `e2e-teacher-dashboard`, a section in `smoke-render`, and a
  rewritten `unit-learners` assertion that used to encode the bug.
- **TLS guidance / warning banner** when accounts are used over plain HTTP on a non-loopback host.

### Product ideas / larger
- **Stage 3 — concept graph.** Concept ontology + `teaches:`/`prerequisites:` per lesson; mastery
  over concepts rather than chapters. Still the big, separable authoring project.
- **Per-learner preferences** (tutor model, difficulty) now that accounts exist.
- **More word-game lesson types**: crossword from the lesson's words, a wordle-like lesson, other
  word-play games — all client-side over the stored vocab, no model calls.
- **✅ DONE in v69_c — beginner mode restricts lesson TYPES.** At difficulty ≤ 1
  `buildStandardExercises` drops `order` (production, not a four-option pick) always, and
  `listen_type` when there is no audio (muted or voiceless), because its muted render degrades to
  type-the-translation. Guard: `unit-beginner-types`.
- **✅ DONE in v69_c — Latin script lesson speaks one case.** `_glyphSpeakForm()` collapses a
  true case pair at the SPEAK sites only ("A a" → "A"); the card still displays both, since qid
  stability and the server/client `intro_script` parity depend on that string. Guard:
  `unit-intro-script`.
- The 🗣 pill could host the tts language/voice selects the way the backend pill hosts the model
  picker (v55_o) — deliberately unbundled.

### Waiting on user / external
- **mein-osttirol.rocks dictionary** (1165 entries): NOT to be imported until permission from
  info@mein-osttirol.rocks is on file.
- **Native review** of the eight `latin.sounds.*` columns (owed since v53).

### Standing deliverables owed at/after this cut
- The **translate pass** above (i18n debt).
- **Browser verification via normal use** of the v69 browser-visible changes — the "how to see it
  work" descriptions are in `v68_session2_notes.md` (completion card, mixed resume, no lesson-set
  page for learners) and `v68_session3_notes.md` (bottom provenance line, auto-storyboard,
  student ⭐/⚑ + student chip, 🧹 upload cleanup toggle, below-threshold "keep going" + drill).

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
2. **Browser-only behavior → session notes** *(amended 2026-07-20; the former
   LIVE-TEST-CHECKLIST.md is a closed archive — do NOT add sections to it)*. If the change is
   browser-only or Ollama-only (UI, RTL, TTS, rendering, anything not exercisable headlessly),
   the session notes MUST contain a short "how to see it work" description — what to click and
   what to expect — so the user can verify it in normal use. Keep it terse; the burden of proof
   shifted from a formal checklist run to the user's routine usage, but the DESCRIPTION of intended
   behavior is still owed.
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
