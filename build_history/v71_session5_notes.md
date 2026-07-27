# v71_f — repeat focuses on unsolved questions (classic lessons)

> "If we press the 'repeat' button, does it focus on vocabulary from the current lesson that we
> haven't seen yet? The focus could be stronger."

Suite **145** (was 144), `--quick` **125**, `check-inline` 0 on both builds, static rebuilt
byte-identically, both report `v71_f`.

## 1. The previous session's answer was half wrong — measured, not assumed

`v71_d` §4 reported that classic replays "just re-sample". That came from a stale code comment in
`showComplete`. The truth is more interesting: `buildExercises` **already** ends in
`assembleCoverageRound(_exs, 12, 1 - FAMILIAR_SHARE)`, so the round *was* ordered unsolved-first
(v69.2 / v69_h). **The ordering was never the problem. The POOL was.**

Measured on a shipped 12-vocab standard lesson, before any change:

```
universe = 12 questions      one derivation yields = 6
with half the universe solved, that pool contained 2 unsolved items
```

`buildStandardExercises` samples **one exercise type per vocab item**, so a single derivation
surfaces only part of what the lesson can ask. `assembleCoverageRound` can only order what it is
handed — it was doing its job faithfully on a pool from which most of the unsolved material had
already been discarded at random. Hence a replay spending ~half its slots on solved questions while
unsolved ones sat unreachable.

Convergence for a perfect learner replaying to the pass mark, before:

| target | rounds |
|---|---|
| 80% | avg 2.84 (worst 4) |
| 100% | avg 5.48 (**worst 10**) |

## 2. The fix

Before ordering, top the pool up with the unsolved questions this derivation missed, by re-deriving
the builder until they surface. This is not a new idea — it is exactly what `buildMixedExercises`
does for the mixed round and what `_lessonQidUniverse` does for the denominator, for the same reason:
**builders sample, so convergence is the established way to reach the whole set.** Merged by qid, so
nothing is duplicated; `assembleCoverageRound` still decides the blend, so the deliberate ~15% review
share is untouched.

After:

| target | rounds | |
|---|---|---|
| 80% | **2.00** (worst 2) | was avg 2.84, worst 4 |
| 100% | **2.00** (worst 2) | was avg 5.48, worst 10 |

A replay now reaches **all** remaining unsolved questions in one round (measured: 6 of 6).

### Scoped to REPLAYS on purpose

The first version topped up unconditionally, which also doubled a **first-play** round from 6 to 12
questions. That is a different change from the one requested — a longer lesson, not a better-focused
repeat — and not one to make silently. The top-up now runs only when something in the lesson is
already solved. First play is byte-for-byte the previous behaviour, and the common path costs
nothing.

### Guards

- `APP._topUpUnsolved` re-entry flag: the re-derivations call the builder again and must not recurse.
  Cleared in a `finally`.
- Runs strictly **after** `if (APP._derivingUniverse) return _exs;` — the denominator must never be
  computed from a coverage-biased pool, or the target would move under the learner. Asserted by
  source position, not just presence.
- Whole block is `typeof`-guarded and wrapped in try/catch: a top-up failure can never break a round.

## 3. Tests

`test/unit-replay-focus.test.js` — 7 sections, run against a **real lesson from the shipped corpus**,
because the sampling under test is a property of the actual builders and a hand-made fixture would
not exercise it.

Section 1 pins the **premise** (one derivation < universe). If that ever stops being true the fix is
unnecessary and the file should be revisited rather than left passing vacuously.

Revert-verified, all failing as named assertions:

| revert | caught by |
|---|---|
| top-up removed | `the replay round reaches most of the remaining unsolved questions (got 2 of 6 available)` |
| top-up also on first play | `a first-play round stays a normal round (12 questions, universe 12)` |
| re-entry guard never cleared | `at 80% the pass mark is reached within 3 replays every time (worst 4)` |

The first revert reproduces the exact "2 of 6" figure measured before the fix, which is the
strongest evidence the guard is measuring the real thing.

## 4. A latent fixture bug this surfaced

`smoke-render` §9 hot-swaps `APP.lessonData.lessons[0]` and then expects the crossword to credit the
new lesson's questions. `_lessonQidUniverse` caches on `topic|lessonIdx|teacher|audio` and cannot
notice a content swap, so the crossword was checking the new lesson's qids against the **old**
lesson's universe.

It passed before only because nothing had populated that cache key yet; `v71_f` makes
`buildExercises` populate it, so the staleness became visible. **Not a product bug** — the app calls
`_invalidateQidUniverse()` on content change (`_postLessonEdit`) and on loading a set, and no real
path swaps lesson content without it. The fixture now does what the app does, with a comment saying
why.

Worth keeping in mind: any test that mutates lesson content in place must invalidate the universe,
or it is testing a coverage denominator that no longer matches the lesson.

## 5. Owed

- **Browser pass**: replay a chapter below the pass mark and confirm the second round is visibly new
  material. The measurements here are headless.
- The stale comment in `showComplete` that produced the wrong diagnosis in `v71_d` §4 still says
  "rounds re-sample on every play". It is now doubly wrong and should be corrected next time that
  function is touched.
- Everything still owed from `v71_b`–`v71_e`.
