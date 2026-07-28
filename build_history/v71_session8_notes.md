# v71_i — round length: no padding with repeats, capped mixed sitting

Two connected changes from the triage, both measured against the user's uploaded `lessons.json`
(storyline `sl_1725748570`, "Evolution der Theorie", 8 chapters). Suite **148** (was 148 with one
new file replacing none — 2 new tests, see below), `--quick` **128**, `check-inline` 0 on both
builds, static rebuilt byte-identically, both report `v71_i`.

## Context: the measurement that reframed four todos

Before coding, the chapter coverage model was measured on real data:

| | |
|---|---|
| chapter coverage denominator | 66–80 questions (union of all counted lessons) |
| one lesson played perfectly | **33–44%** of the chapter |
| pass mark | 80% |

So "one lesson should pass the mark" is arithmetically impossible for a *standard* lesson — the mark
is a chapter-level target and one lesson is a fraction of a chapter. That is why the user's chosen
mechanism (mixed-lesson auto-length) is the right one: a mixed lesson pools the whole chapter.

## B — a replay round is no longer padded with already-answered questions

**Reproduced** on ch2 lesson 1 (37 questions): replaying to 100% asked **48 questions, 11 of them
repeats (23%)**, with the tail rounds running 12 questions of which 9–11 were already solved.

The cause was NOT the replay focus — v71_f works, early rounds are 0/12 repeats and repeat correctly
advances 0→1→2 through coverage-short lessons. The cause was `assembleCoverageRound` always
returning `N = 12` and backfilling leftover slots with review once the unsolved pool ran short.

**Fix:** when the round wanted `N × RATIO` unsolved questions and fewer remain, let the round be
SHORT rather than padded.

| | before | after |
|---|---|---|
| questions to finish a 37-question lesson | 48 | **41** |
| repeats | 11 (23%) | **4 (10%)** |
| final round | 12, padded | **5**, no padding |

### Narrowed to an opt-in (the important design decision)

The first version applied the trim unconditionally and broke a deliberate v69_h invariant, asserted
in two suites in exactly these words:

> `backfill keeps the round full — nothing is excluded outright`
> `round never exceeds the pool`

That rule exists so a round always fills and the coverage denominator can never strand below the
mark. Rather than overwrite two guards protecting a stated invariant, the change was **narrowed to
an explicit opt-in parameter** (`trimToUnsolved`, the 4th argument):

- `buildStandardExercises` → `assembleCoverageRound(_exs, 12, 1 - _famShare, true)` — opts in.
- `buildMixedExercises` → `assembleCoverageRound(pool2, cap)` — does NOT. Its composition is
  unchanged, and v69_h's invariant still governs it.

An explicit parameter rather than inferring from the ratio: inference would be a hidden coupling
between two unrelated knobs.

Stranding is impossible even where it applies: the trim only runs while unsolved questions are in
the round (guarded by `unsolvedOnly.length`), so every trimmed round still advances coverage. It is
skipped entirely for a pure-review pool, so replaying a finished lesson still gives a full round.

## A — mixed auto-length: it already existed; the SITTING needed capping

The significant finding: **v69.1 already implements the user's request.** `buildMixedExercises`
sizes the round as `ceil(target × chapterUniverse) − solved`, measured against all unhidden lessons
in the chapter — explicitly NOT against the mixed lesson itself, which is what the user asked for.

Measured on ch2 (denominator 77, target 80%): one perfect mixed play → **81% chapter coverage**.
Exactly the requested behaviour, already shipping.

The real problem was the one flagged during triage: that round was **62 questions** — a 15-minute
sitting, not a lesson. `MIXED_ROUND_CAP = 30` bounds it:

```
play 1: 30 questions, 0 already-solved | chapter 39%
play 2: 30 questions, 0 already-solved | chapter 78%
play 3:  2 questions, 0 already-solved | chapter 81%   <- mark reached
```

**Zero repeats across all three plays**, and the last round shrinks to just the 2 remaining
questions. The cap costs no progress — only the sitting is shorter. Chapters needing ≤ 30 still
reach the mark in a single pass, unchanged.

Note for the deferred item 8 (bulk mixed generation): because the sizing already worked, the
`perType: 3` selector was never governing coverage-driven rounds — it only applies to the fallback
path once the target is already met. That item is less blocked than the triage assumed.

## Tests

New `unit-round-length.test.js` (5 sections, live DOM, real corpus lesson):
replay-to-completion waste ratio; the final round shrinking to exactly the unsolved count; a fully
solved lesson still yielding a full review round; a first play unchanged; and the opt-in narrowing
proven **behaviourally** (same 10-item pool → 10 questions without the flag, 2 with it).

`unit-mixed-coverage-round.test.js` gains §4 for the cap: a chapter needing 80 questions yields
exactly `MIXED_ROUND_CAP` in one sitting, all distinct. The suite reads the real constant out of
`index.html` rather than hard-coding 30, so retuning the cap cannot silently invalidate the guard.

**Revert-verified**, all failing as named assertions:
| revert | caught by |
|---|---|
| trim disabled | `under a fifth of the questions asked are repeats (got 20%)` |
| padding restored | `with 5 unsolved left the round is 5 questions, not padded to 12` |
| cap removed | `a chapter needing 80 questions yields a round of exactly the cap (30)` |

### A flaky test, caught and fixed

The opt-in guard originally drove the property through `buildExercises`, and **failed intermittently**
(6-vs-6 instead of 6-vs-1) — the standard builder samples one exercise type per vocab item, so
whether the sampled pool happened to contain an unsolved question varied run to run. It surfaced in
`--quick` after passing in the full suite, which is exactly the kind of thing that gets rerun and
ignored. Rewritten to drive `assembleCoverageRound` directly with a constructed pool: the property
under test belongs to that function, not to the sampler. Verified stable over 8 consecutive runs.

## Owed

- **Browser pass**, including v71_h which is still untested there.
- **`MIXED_ROUND_CAP = 30` is a guess**, chosen as ~2.5x a standard round against the user's data.
  It is a single named constant and the test reads it, so retuning is cheap — worth feeling out in
  the browser.
- Deferred from the triage: final story-complete card, storyboard-frame result cards, crossword
  clue-bar fixed height, bulk mixed generation.
