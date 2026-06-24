# Next session — Major B (full unify), start at phase 2

**Decision (this session):** do **Major B** next, not A. Rationale: A (#3/#4 examples)
will likely introduce new lesson types, and B makes adding/composing a type a one-entry
change instead of editing four hand-kept dispatch chains. A is deferred but already has
groundwork: see `build_history/prompt_examples_audit.md`.

## What B is
A **pure refactor** — behavior must stay byte-identical; `node test/run.js` green and
`node test/check-inline.js index.html` at 0 after **every** step. Route the lesson-type
dispatchers through the existing `LESSON_TYPE_META` registry (~line 1053) /
`lessonTypeMeta()` instead of hand-kept if/else chains. Do **one dispatcher at a time —
no big-bang.** Full spec: `roadmap_v46.md` → "v46 major — unify lesson types into a
registry".

## Phasing
1. ✅ DONE — client `build` registry (`buildExercises` → `lessonTypeMeta(type).build`),
   guarded by `unit-build-registry`. (This unblocked Major C, also shipped.)
2. ✅ DONE — `renderEx` registry. The 16-branch `if(ex.type===…)` chain folded into
   `EX_RENDERERS[ex.type]` (per-exercise-type renderer map; distinct keyspace from
   `LESSON_TYPE_META`). Guarded by `unit-renderex-registry`.
3. ✅ DONE — editor registry. `renderLessonEditor`'s 9-branch `ls.type` body → per-type
   `editorBranch` hooks on `LESSON_TYPE_META`; `_syncEditorFromDOM`'s two save-side guards
   → `editorReadInputs` (math) / `editorAfterSync` (error_hunt) hooks. Extracted branch
   functions live after `buildPath` (static slice). Guarded by `unit-editor-registry`;
   render + save behaviour verified byte-identical old-vs-new.
4. ✅ DONE — Server `generate`/`validate` registry. The add-lesson `fmt` if/else chain
   folded into `ADD_LESSON_GENERATORS[fmt]` (server.js): thin per-format adapters over a
   single context object, preserving the generators' heterogeneous signatures. Per-type
   validators stay inside the generators (salvage philosophy). Guarded by
   `unit-add-lesson-registry`; argument mapping verified byte-identical for all 7 formats.

**Major B is COMPLETE.** All four lesson-type dispatchers — `buildExercises` (build),
`renderEx` (exercise renderers), the editor (`renderLessonEditor` / `_syncEditorFromDOM`),
and the server add-lesson handler — now route through registries. Adding/composing a lesson
type is a registry-row change instead of editing four hand-kept chains.

## Next major (per roadmap sequencing)
With B done, the unblocked high-value work is **A** (per-target-language prompt examples;
groundwork in `build_history/prompt_examples_audit.md`) and **E** (batch-gen + QC). See the
priority table in `roadmap_v46.md`.

## Hard caveats (these bite)
- **Static-slice rule:** any registry entry or builder reachable in the static build must
  be defined **after** `function buildPath(` (index.html ~3313). `build-static.js` slices
  on `@static-exclude` markers; `unit-static-markers` guards it. Rebuild `docs` after any
  client change and check-inline `docs/index.html`.
- **`/api/lessons/edit` merge allow-list:** a type with its own top-level fields must be
  in the merge allow-list (server ~2890) or it's silently dropped on save. (This session
  added `words`/`items` for synonyms/word_forms rating/flag round-trip — keep that.)
- **Export twin:** export logic is duplicated in `export-lessons.js` (server) and the
  `_ce*` functions in index.html (static). Any export-touching change must hit both.
- Every step: add/keep a test, register in `test/run.js`, keep the suite green.

## How to kick off a fresh chat
Major B is complete. To start the next major, upload the latest `dreizunge_v46.zip` and say:
"Continue Dreizunge. Read build_history/roadmap_v46.md. Major B is done; start Major A
(per-target-language prompt examples) — see build_history/prompt_examples_audit.md. Follow
the phasing in the roadmap; keep the suite green and check-inline at 0 after each step."

## v46 work already shipped (context for the fresh session)
todos_v46: #1 arc terminology, #2 storyline locking (data repair + render hardening),
#6 rating system, #7 rating-aware mixed pool, #11 flag surfacing, #12 edit report.
See `build_history/v46_session1_notes.md`. App is at APP_VERSION 'v46'.
