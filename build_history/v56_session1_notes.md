# v56 — cut. Lesson difficulty fix + release.

First file of the v56 cycle. The v55 line (v55 → v55_z, 24 point releases) is in
`v55_session1_notes.md`; the plan is `roadmap_v56.md`.

## The fix: an added lesson now records its difficulty
User: "I generated a new lesson for 'Constanze am Meer' with diff=3, but it is displayed as
beginner level."

**It was a STORAGE gap, not a display bug — the opposite of the first guess.** Diagnosed from the
data before touching code:
- `topic.difficulty: 1`, and NOT ONE of that topic's lessons carried a `difficulty` field.
- Corpus-wide: only **52 of 763** lessons stored one — and exactly the two types that need it at PLAY
  time (`math` 30, `intro_script` 22). Every other lesson relies on the topic's value.
- The display was **always right**: the lesson list renders `DIFF_SHORT()[L.difficulty || topicDiff]`
  (index.html:1215). With no lesson difficulty it correctly fell back to the topic's "beginner".
- The add-lesson route DID derive the value — `const diff = clamp(request → saved.difficulty → 2)` —
  used it for the prompt, and then dropped it: `{ ...result.lesson, id: newLessonId }`.

**Fix (one line):** `{ difficulty: diff, ...result.lesson, id: newLessonId }`. Written BEFORE the
spread deliberately, so a generator that sets its own difficulty (math, intro_script) still wins.

**No backfill.** Unlike the provenance stamps, the display's `|| topicDiff` fallback already gives
the 711 existing lessons the right answer — they were generated at their topic's difficulty. Adding
data to say what the fallback already says would be churn.

Guarded by `unit-lesson-difficulty`: the route derivation, the storage, the spread ORDER, the
display expression (so nobody "simplifies" it back to the topic's difficulty), the behaviour table
(advanced-on-beginner → advanced; no-difficulty → falls back; beginner-on-advanced → beginner), and
a corpus check that every stored value is within 1..3. Verified it FAILS with the fix reverted.

## Release
APP_VERSION **v56**, suite **104 green**, check-inline 0 on both builds, static rebuilt (carries the
user's real corpus + full 30-language ui.json).

## Owed / next (unchanged from the v55 close, and now the top of the list)
The LIVE-TEST backlog is the main debt: §§72–78 (older sessions) and §79c–§90. Every defect this
session was found by the user in live use, never by the suite. Recommended: clear that backlog before
new features; then `cumulative token usage` (self-contained, server-side, headlessly testable).
Explicitly not next: clickable storyboard panels — its panel↔chapter mapping is unsettled, it breaks
v55_t's fixed-canvas test, and it is entirely browser-verified. See `roadmap_v56.md`.
