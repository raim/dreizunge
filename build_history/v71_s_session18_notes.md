# v71_s — session 18 notes

Comprehension lessons: a conceptual error, fixed in three stages.

Suite **155** (+1 new file), `check-inline` 0 on both builds.

---

## 0. Why this ahead of the backlog

Reported as a conceptual error, and it was worse than a missing feature — it was **shipped
behaviour that could not work**. A comprehension lesson asks about the chapter's story; the story
only appears on the completion card; the card only appears once every counted lesson is done —
comprehension included. Learners were being asked about text they had never been shown.

They could only guess, and a guess still writes to the solved store and the learned ledger, so the
data was quietly acquiring false "known" signals for as long as this stayed live.

Taken ahead of the open items because **migration is cheap right now**: only 7 comprehension
lessons exist across 6 topics, and every one already sits LAST in its chapter, so the ordering this
release wants is already the de-facto convention. Nothing needed rewriting. That stops being true
as soon as more are generated. Nothing in the backlog blocked it or was blocked by it.

## 1. The circularity was TWO layers, not one

Reordering the lessons would not have fixed it. Both of these had to move:

| layer | mechanism | why it mattered |
|---|---|---|
| lesson | `setComplete` requires every counted lesson | comprehension was one of them |
| coverage | `topicCoverage` unions the universe over every counted lesson | comprehension qids sat inside the very denominator gating the unlock |

Missing the coverage layer leaves the circle intact at any pass mark below 1.0: the learner reaches
the lesson booleans but never the percentage.

### The fix

`storyUnlocked(d)` — the narrowed gate — runs through the SAME `_setCompleteRaw` via a
`skipStoryGated` parameter, never a second copy of the rule (`_itemWithheld`'s three spellings are
the standing warning here). `storyUnlockLessons(d)` is a filter of `countedLessons`, not a parallel
visibility rule. `_STORY_GATED_TYPES` is a named table, so a second gated type is a one-line change.

`setComplete` is unchanged in meaning — the whole chapter, comprehension included — so chapter
progression, the green dots and `chapterComplete` still require it. `storyUnlocked` deliberately
does NOT stamp `_recordChapterDone`: it is not chapter completion, and stamping it would make a
chapter read as finished on the storyline page before its comprehension lesson had been opened.

Also: comprehension is locked on the path until the story unlocks, and `_firstUnfinishedLessonIdx`
skips it — otherwise v60 nav auto-starts the learner into the very lesson being protected.

## 2. The story panel

Rendered at the END of `ex-area`: question → choices → feedback → **Check** → flags → story.
Answer controls above the story, per the user's explicit call — a story of a few hundred words
above them pushes the buttons off a phone screen. `<details open>`: on a comprehension question the
text is the material, not a supplement, but it folds away once read.

Solved-word highlighting and paragraph structure reuse the result card's treatment.

**Deliberately NO translation toggle**, unlike the result card's panel. There it rewards a finished
chapter; here it would let a learner answer questions about the target-language text without ever
reading the target language, which is the one thing a comprehension lesson is for. Flagged as a
product decision, not a bug — easy to reverse.

Two new **en-only** UI keys → the translate queue: `ex.comprehension.story`,
`ex.comprehension.story_listen`.

## 3. "Repeat until correct", and mixed pooling

**The 100% rule is implemented at the WRITE site.** `done[L.id]` has ~12 readers; gating the write
means the flag keeps meaning exactly what it always meant and every reader — `setComplete`, the
path lock, the resume scan, the chapter gate — inherits the requirement without learning a second
rule. Understanding a text is pass/fail in a way vocabulary practice is not: three of five
questions is not understanding, and the chapter's 80% pass mark is the wrong instrument. Fails
OPEN on any error: never trap a learner in a lesson because coverage could not be computed.

**Mixed lessons no longer pool comprehension** (`_NEVER_POOLED` + one `_mixedSkips` predicate). A
mixed round could otherwise ask story questions pre-unlock — the same error by a side door. Three
sites each spelled `type === 'mixed'` separately (two pooling loops + the mixed coverage universe);
they now share one predicate, because a mixed universe that counts questions the round will never
ask can never reach its target. No corpus data hits this today — the two comprehension lessons
sharing a chapter with a mixed lesson sit AFTER it — so it is fixed by shape, not by measurement.

## 4. Two bugs found by writing the tests

**A review render was being judged.** `showComplete(true)` repoints `APP.cur` at the LAST counted
lesson so the vocab recap resolves — the comprehension one, in any chapter ending with one.
Nothing is answered on a review render, so the 100% rule locked Next on an already-finished chapter
and hid the "story complete" ending behind a "Keep going!" card. Caught by `smoke-render`, not by
design. Same shape as v71_n's fix to `recordLearnedFromLesson`: **a review render is not a play**,
and anything judging the learner needs `!C._review`.

**Next pointed back at the lesson just played.** The comprehension done-flag is withheld below
100%, so the lesson stays "unfinished" and `_firstUnfinishedLessonIdx` kept returning it — making
Next mean "replay this same lesson" and stepping straight over the v71_d lock. Now narrowed to -1
in that case, so the card falls through to the below-mark branch: Next greys out and Repeat /
Drill / Crossword present themselves. This one only surfaced because the test asserted the LOCK
rather than the outcome; a weaker test would have passed on the loop.

## 5. A test that would have passed for the wrong reason

The first draft of §3 seeded `coverageThreshold: 1` — and `_setCompleteRaw` skips the coverage
check entirely when the target is 1 (`if (tgt < 1)`). It proved the lesson layer and nothing else,
while appearing to cover both.

§3b was added with a real pass mark: 12 vocab + 6 comprehension questions at 0.8, so whole-chapter
coverage sits at 67% — permanently below the mark — while unlock-only coverage is 100%. That is the
case where the old rule made the story **unreachable no matter how perfectly the vocabulary was
learned**. Verified by neutralising the structural assertions and confirming the behavioural one
catches the revert unaided.

Also fixed in the harness: `solveLesson` was solving a single derivation rather than the lesson's
qid universe — the v71_f sampling behaviour again, silently measuring the wrong thing.

## Revert-verified (six mechanisms, each independently)

| revert | assertion that fires |
|---|---|
| lesson layer not narrowed | story unlocks once the non-comprehension lessons are done |
| coverage layer not narrowed | the narrowed denominator drops the comprehension questions |
| story panel above the controls | and so does the Check button — the story never pushes it off-screen |
| 100% write gate | a partially-solved comprehension lesson is NOT recorded as done |
| Next lock | Next is visibly locked while questions remain unanswered |
| mixed pooling | the mixed round draws nothing from the comprehension lesson |

All named assertions carrying their numbers, none a `TypeError` (v70_l rule).

## How to see it work

Use a chapter that ends with a 📖 comprehension lesson — e.g. *Abenddämmerung in Turin*.

1. Play the vocabulary/grammar lessons. **The story now appears on the completion card before the
   comprehension lesson has been touched** — previously it stayed hidden.
2. The comprehension lesson is unlocked on the path only at that point; before it, it shows locked.
3. Open it: the story sits BELOW the Check button, open by default, collapsible.
4. Get one question wrong. Next is greyed ("Keep going!"), and Repeat / Drill / Crossword offer the
   way back in. The chapter does not complete and the next chapter stays locked.
5. Repeat until every question is answered → the lesson records, Next unlocks, chapter completes.

Teacher mode is exempt from all of it, as with every other lock.

## Deliberately not done

- **No data migration.** All 7 existing comprehension lessons already sit last in their chapter.
- **No change to generation order.** Worth deciding separately whether the generator should
  guarantee the position rather than rely on it — right now the code is order-independent (the
  gate is by TYPE, not by index), which is the safer property.
- **No translation toggle in the play panel** (§2).

## Still owed

Browser passes on `v71_i`–`v71_s` — this release changes a learner-visible FLOW, so it wants a real
pass more than most. Translate queue now 380 (378 + 2 new keys).

Unchanged: story 6,000-char caps (roadmap wants this early; needs a live model to judge) ·
error-hunt word alignment · tutor investigation (4) · book learning-arc form wiring · the two
deferred cosmetics · hiding editing controls in live/non-teacher mode · decisions on drill
traceability and `el/storyboard.title`.

## Found on the way, logged not fixed

**The storyline chapter lock reads raw done-flags** (~line 7080) while line 7045 defines
`_chapterComplete` through the shared `chapterComplete` reader — two rules for one question, the
exact shape v69_l consolidated elsewhere. Pre-existing. It happens to agree with this release
(a withheld done-flag locks the next chapter either way), which is why nothing failed, but it
should be one reader. Worth a deliberate decision rather than an incidental fix.

**Duplicate grammar targets** (from v71_r) still open.
