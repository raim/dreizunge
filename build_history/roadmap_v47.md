# Roadmap v47

Carries forward from v46 (Major B complete; Major A phase-1 done — the `{EXAMPLE}` mechanism
is wired for `wordForms`/`synonyms`/`grammar`/`conjugation`, with a `de` wordForms seed
pending native review). v47 turns toward **content, main-page UX, and the platform question.**

Same working rules as before: pure refactors stay byte-identical; suite green and
`check-inline` at 0 after each step; one change at a time; verify/package at natural
stopping points (not after every micro-step).

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

Why first: it directly unblocks the only-content-now remainder of Major A, produces the
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

---

## Priority 3 — Platform track (parallel, large; see `platform_plan.md`)

Multi-user accounts, central repository for submitting flags/edits/new lesson sets, a token
economy (earn by solving / buy), and web + mobile. This is a separate, much larger effort
tracked in `build_history/platform_plan.md`. **Constraint on all v47 feature work:** keep it
compatible with a future clean API boundary (don't deepen client↔server coupling), so the
platform's Phase 0 stays cheap.

---

## Minor features

1. ✅ **DONE — QC button in the storyline-page header.** Added `#sl-screen-qc-btn` to the
   storyline-screen header, wired in `_renderStorylineScreen` to `qcRun({storylineId})` —
   the same action as the main-page storyline QC. Shown only when a backend can generate.
   (Headless: wiring + syntax verified; the QC run itself is browser/Ollama-owed.)
2. **TODO (needs Ollama) — Expand QC to all lesson types except `math` and the two
   error-hunt types.** QC is server-side: `_runQc` loops only over `vocab`/`sentences` and
   calls `qcCheckPair(target, source)` — a translation-pair checker. `grammar`/`conjugation`
   have a checkable target↔source (noun/infinitive ↔ translation) and could be added to that
   loop with low risk; `synonyms` (base+gloss+arrays) and `word_forms` (sentence/choices)
   need their **own** QC checks. All of it changes the LLM path, so it must be verified live
   against Ollama before shipping — deliberately not done blind in a headless session. Note:
   the client lesson-level QC button (index.html ~`qcRun({topicId,lessonIdx})`) is gated to
   `L.vocab||L.sentences` and must be widened in step with the server.
3. ✅ **DONE — Live-mode storyline page: lesson-type dropdown per chapter/lesson-set.**
   Added `lessonSetTypes(s)` (pure; distinct types in first-seen order) + a collapsible
   chip list rendered per chapter card in `_renderStorylineScreen`, labelled via the Major B
   registry (`lessonTypeEmoji`/`lessonTypeLabel`). Guarded by `unit-storyline-screen-extras`
   (the pure helper is unit-tested; the dropdown rendering is browser-verify-owed).

---

## Static-build flag handling (v47 — partially done)

The static build has no backend, so per-item `userFlag` / `userRating` and a lesson's
`_miscFlags` can't be saved server-side — they ride the JSON export. v47 makes that loop
usable for crowd-sourced corrections:

- ✅ **Hide flagged items in static play.** In the static build, non-teacher play no longer
  quizzes items that carry a `userFlag` or a QC suggestion (`buildExercises` filters built
  exercises via `_exFlagTarget`). Teacher mode and the lesson editor still show them so the
  flag content can be reviewed/fixed. (Covers vocab/sentences/word_forms/synonyms — the
  per-item-flaggable types; grammar/conjugation flags are `_miscFlags`, not per-item.)
- ✅ **"Download & submit" pill (floating, global).** A fixed snackbar (`#static-flag-banner`,
  body-level so it shows on **any** screen — play, editor, or home) tallies pending per-item
  flags/ratings (`_countStaticPending`) and refreshes immediately after any play/editor
  flag/rating mutation (hooked into `_persistPlayFlags` / `_persistEditorFlags`) and on every
  screen change (`show`). Download exports the affected lessons; after a download it reveals
  a **"Submit as issue"** link to `github.com/raim/dreizunge/issues/new` (pre-titled; the user
  drags the exported JSON into the issue — GitHub can't take the file via URL).
- ✅ **Dynamic per-storyline download.** Yes, this is feasible and is implemented: when every
  pending-flag topic belongs to a single storyline, the pill scopes the download to that
  storyline's chapters and labels the button with its title; otherwise it exports all
  flagged topics. (Per-storyline grouping when several storylines are flagged — e.g. one
  button each — is a possible follow-up.)
- ✅ **Persist across reloads (localStorage).** Pending per-item flags/ratings + `_miscFlags`
  are mirrored to `localStorage` (`dz_static_flags`), keyed by topicId · lessonIdx · kind ·
  item-identity, written on every mutation and re-applied once on first use
  (`_ensureStaticFlagsLoaded`). Survives refresh / browser / machine restart; per-browser &
  per-device (cross-device is the accounts/repo feature). localStorage, not a cookie (~5MB,
  not sent to the server). Round-trip unit-tested in `unit-static-flags`.
- **Owed / browser-verify:** all of the above is headless-verified for *logic* only (pure
  helpers + a save/reload/reapply round-trip unit-tested in `unit-static-flags`); the actual
  pill rendering, the blob download, the GitHub link, and persistence-across-reload need a
  browser pass. Also TODO: i18n for the new pill/button strings (currently English); a
  maintainer-side importer that merges a submitted JSON's flags/ratings back into
  `lessons.json`; and styling polish on the floating pill (position/size are a first cut).

## Suggested sequence
P1 (examples.json batch-gen + QC) → minor features #1–#3 (small, high-value, mostly reuse) →
P2 (map-tree UI) → P3 (platform) as a separate track once the above land and the platform
decisions in `platform_plan.md` §2 are made.
