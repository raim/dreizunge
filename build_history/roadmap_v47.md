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
- ✅ **Pill polish (v47).** The pill now: has a **close** button (`closeStaticPill` — dismiss
  until the next flag/rating/edit); shows **flag (⚑) and star (⭐) counts** next to the
  download button; triggers on **edit/delete** too (`_markStaticEdited` hooked into
  `_syncEditorFromDOM`; edited topics are included in the download via `_topicPendingOrEdited`);
  and has a **shortened** message with all pill/button/issue text moved to `ui.json`
  (`static.pill.*`, English only — other languages generated offline).
- ✅ **Star ("good example") in the editor (v47).** The standard editor previously dropped
  `userRating` from its synthetic item, so a star set during play didn't show — fixed.
  Starred entries now get a gold `starred` style + a "⭐ Good example" note across
  vocab/sentences, word_forms, synonyms, and math; the synonyms ⭐/⚑ icons were moved to the
  right (next to 🗑) to match other types. Chapter/lessonset nodes show a `⭐ N` count
  alongside the flag count. Guarded by `unit-static-flags`.
- **Owed / browser-verify:** all of the above is headless-verified for *logic* only (pure
  helpers + a save/reload/reapply round-trip + structural guards in `unit-static-flags`); the
  actual pill/editor rendering, the blob download, the GitHub link, and persistence-across-
  reload need a browser pass. Also TODO: i18n for the non-English pill strings (English in
  `ui.json`; other langs generated offline); and styling polish on the floating pill
  (position/size are a first cut).
- ✅ **Import merge mode (v47).** A submitted flag file imports via the existing **⬆ Import**
  button: `/api/lessons/import` now honors `body.mergeFlags`, and the client auto-sets it when
  the file is a flag submission (`exportedBy:'dreizunge-static-user'`, and the pill marks
  `mergeFlags:true`). In merge mode a matched topic keeps the maintainer's content and only the
  community `userFlag`/`userRating`/`_miscFlags` are applied, matched by item identity
  (target/sentence/base) not index — drift-safe and idempotent (`mergeFlagsIntoTopic`,
  server.js). Full library exports (no marker) still overwrite as before. Guarded by
  `unit-import-merge` (pure helper); the endpoint routing on `body.mergeFlags` is server-owed.
  Note: merge mode is **flags-only** — a submitter's *content* edit is applied only if they
  also flagged it (the flag carries the comment/correct value the maintainer applies); to take
  a submission's content wholesale, import it without the merge marker (overwrite).
- ✅ **Soft-delete in static (v47).** Deleting a question in the static build no longer
  destroys it — it toggles a `userDelete` marker (entry shown **red** + a note; click 🗑 again
  to undo), hidden from non-teacher play, counted in the pill (🗑 N), and it rides the
  export/persistence/merge exactly like a flag (full round-trip for vocab/sentences/word_forms/
  synonyms; grammar/conj/math mark + ride the overwrite export but aren't in the
  persist/merge arrays). Live build still hard-deletes.
- ✅ **Pill download = all complete storylines (v47).** The pill now always exports **every
  complete storyline** (all its chapters, for full context) that has any flagged/rated/edited
  chapter, plus flagged orphan topics — no longer scoped to one storyline or the last-flagged
  chapter. The submit link is hidden when a new flag/edit makes the last download stale, and
  re-revealed (refreshed) on the next download.
- ✅ **Import: merge vs replace is an explicit choice (v47).** Importing a flag submission now
  prompts (`toast.import_merge_confirm`): OK = merge flags/ratings/deletes only (keep your
  content), Cancel = full replace. Non-submission files replace as before.
- ✅ **Content edits persist across reloads + surfaced on merge (v47).** Content edits
  (`item.editedAt`) are now persisted to localStorage (`dz_static_edits`) by **position**
  (topicId·lessonIdx·kind·index — edits can change the identity field, so index keying is the
  stable choice) and re-applied on load (re-marking the topic dirty so the pill still prompts).
  On import **merge** mode now also carries the `editedAt` **marker** (with an index fallback
  when the edited item's identity changed) so the maintainer sees the ✎ edited badge — the
  proposed *content* is still NOT auto-applied (that's the review-UI TODO below); to take the
  new text, use full-replace or the side-by-side review UI when built.
- ✅ **Export only the user's OWN signals, not pre-existing ones (v47).** The static bundle
  ships with whatever flags/ratings/edits the maintainer baked into `lessons.json` (their own
  review plus community submissions they imported and rebuilt). Those were being counted and
  exported as if the end-user made them. Now a "pristine" snapshot of the baked signals is taken
  once at load (by position, before any localStorage delta is applied), and the pill count +
  export only include signals NOT in that snapshot — i.e. what this user added on top. Exported
  topics are also stripped of pre-existing markers (`_stripPreExisting`) so the submission file
  carries only the user's flags/ratings/deletes/edits (edited *content* is kept; only baked
  markers are removed). Stars (⭐) remain a submitted signal. Play-hiding still respects baked
  flags (the maintainer's quality calls hide items for everyone).
- ✅ **Pill scope = explicit tags, not every edit (v47).** The download pill submits what you
  deliberately tagged — flags (⚑), ratings (⭐), delete-candidates (🗑) — plus story (📖) and
  summary (📝) edits, and the complete storylines those belong to. **Plain item content edits
  no longer pull their topic into the export**: they persist locally and ride along only inside
  a topic that's already in scope (e.g. one you flagged). This fixes "tagged a few → downloaded
  100+ topics": accumulated translation fixes across many sessions were all being swept in
  because `_topicPendingOrEdited` treated any content-edited (dirty) topic as pending. Scope is
  now `_topicHasPending(l) || l.storyEditedAt`. (Possible follow-up: an opt-in "include all my
  edits" toggle for users who *do* want to submit their whole edit history.)
- ✅ **Story & summary edits handled like question edits (v47).** The "Read the story" pencil
  on a chapter now actually works (it was activating edit mode on a collapsed/hidden body — it
  now expands first). A story edit (topic-level `d.story`) sets `storyEditedAt`, shows the pill,
  persists across reloads (the topic-level `__doc` entry in `dz_static_edits`), rides the
  export, and carries a marker on merge. Storyline **summary** edits (the ✏️ on the storyline
  summary, teacher-mode) now likewise set `summaryEditedAt`, show the pill (📝 N), persist
  across reloads (`dz_static_summaries`, storyline-keyed), and ride the export as `storylines`
  (the import upserts them onto the maintainer's storylines). As with item content, the merge
  path carries the *marker*; the proposed text lands via full-replace or the review UI.
- **TODO (later) — content merge with a review UI.** Beyond flags-only merge, support
  merging a submission's *content* edits with a side-by-side interface that shows the original
  vs the edited item and lets the maintainer accept/reject each change (a 3-way/diff review,
  not last-write-wins). The `editedAt` markers above already tell the maintainer *which* items
  to review; this UI shows the actual proposed text and applies accepted changes. (Larger UI
  task — pairs naturally with the P2 map-tree / list views.)

## Suggested sequence
P1 (examples.json batch-gen + QC) → minor features #1–#3 (small, high-value, mostly reuse) →
P2 (map-tree UI) → P3 (platform) as a separate track once the above land and the platform
decisions in `platform_plan.md` §2 are made.
