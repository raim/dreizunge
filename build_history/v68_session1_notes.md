# v68 — the mixed-lesson "stuck" bug (root cause: duplicate lesson IDs) + three quick items

## THE BUG: duplicate lesson IDs — 90 of 278 topics affected

You reported being stuck in `sl_2123771959`: clicking a lesson opened a result card, Next opened
result cards of lessons you had never solved, and the threshold could never be reached.

Your uploaded `lessons.json` showed the cause immediately. In "Verwüstete Agrarlandschaften" the
lessons were `id=1, id=6 (word_forms), id=6 (synonyms)` — **two lessons sharing id 6**. Learner
progress is keyed by lesson id (`progress.completed[topic][lesson.id]`), so finishing word_forms
also marked synonyms done. That is exactly "result cards for lessons I haven't solved", and it makes
a set look complete while coverage never actually rises.

**Not a mixed-lesson bug at all** — there is no lesson of type `mixed` anywhere in that storyline.
The mixed-lesson machinery was a red herring; the data was corrupt.

**Scale:** 90 of 278 topics, 96 colliding ids in your library.

**Two causes, both fixed:**
1. the startup backfill only assigned ids to lessons that were *missing* one — it never checked for
   collisions;
2. its id was hashed from `topic + type + 'auto'`, so two lessons of the **same type** in one topic
   were guaranteed to collide by construction. (Hence the repeated word_forms/synonyms pattern.)

The replacement pass is collision-aware, varies the id with the lesson index, and verifies the
candidate is unused before assigning. Run against your library: **96 duplicates repaired, 0
remaining**. The first holder of a duplicated id keeps it, so progress for that lesson survives;
later holders are renamed, which orphans any progress recorded against the collided id. That is the
right trade — the collided state was already wrong, crediting lessons that were never played, so a
small honest reset beats keeping bogus completions.

Guarded by the new `unit-lesson-id-integrity` test, which boots the server against a deliberately
corrupted store (including a triple collision and a missing id) and asserts the repair.

## Also fixed

**Source language reset to "all" on reload.** The *target* filter survives only because it is
re-derived from the persisted form language; the source filter had no such path and silently fell
back to `all` every reload. It is now persisted explicitly (`imp3_libsrc`) and restored at boot.

**New default models.** Story/lessons/translation/tutor default to `qwen3.6:35b-a3b`; QC defaults to
`translategemma:12b`. One subtlety: if `OLLAMA_MODEL` is set explicitly, QC follows it, preserving
the long-standing "one model for everything" override — otherwise the e2e harness (and anyone
pinning a single model) would silently get a QC model that isn't installed.

## NOT YET DONE — assessed, queued

- **Error-hunt add-lesson timeout.** Needs the same treatment as the other reasoning failures:
  error-hunt generation is a long structured task, and on a reasoning model it will exceed the
  budget. Likely `think:false` plus a larger budget for that generator specifically.
- **PDF text cleanup** (strip nav/headers/bylines, join formatting newlines). Your example makes the
  shape clear. I'd do it in two stages: a deterministic pre-pass (collapse single newlines inside
  sentences, drop lines with no sentence-ending punctuation and few letters) *then* ask the model to
  drop remaining non-narrative fragments — deterministic first so the model isn't asked to fix what
  code can do reliably.
- **Provenance/user line to the bottom**, styled like the generation stats, on storyline and chapter
  pages.
- **Flagging/starring in student mode**, recording which mode produced the flag (existing flags
  become `teacher`).
- **Storyboard generation at the end of book/multi-chapter jobs.**
- **"All types" option for book/multi-chapter jobs** (parity with single-story generation).

These are independent and mostly small; the ID corruption was blocking real use, so it took the
session. Suite **117 green**.
