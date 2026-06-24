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

## Minor features (do alongside the above)

1. **QC button in the storyline-page header.** Same function as the main-page storyline QC:
   check all lessons in the open storyline. (Reuse the existing storyline-QC code path;
   just add the trigger in the storyline page header.)
2. **Expand QC to all lesson types — except `math` and the two error-hunt types**
   (`error_hunt`, `ai_error_hunt`). With Major B's registry, this is the natural place to
   hang a per-type `qc` hook; types without a meaningful automated check (math, the
   error-hunts) opt out.
3. **Live-mode storyline page: lesson-type dropdown per chapter/lesson-set.** In the
   live-mode storyline view where chapters/lesson-sets are listed, add a drop-down that
   shows the **types of lessons** contained in that set.

---

## Suggested sequence
P1 (examples.json batch-gen + QC) → minor features #1–#3 (small, high-value, mostly reuse) →
P2 (map-tree UI) → P3 (platform) as a separate track once the above land and the platform
decisions in `platform_plan.md` §2 are made.
