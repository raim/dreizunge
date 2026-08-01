# v71_r — session 17 notes

One change, found by the baseline being red rather than by a report.

Suite **154**, `check-inline` 0 on both builds.

---

## 0. The baseline was not green, and that was the finding

`node test/run.js` opened the session with
`FAILED 1 of 154: unit: replay focuses on unsolved questions (v71_f)` —
§8 asserting `grammar: one derivation already yields the whole universe (14/25)`.

No code had changed. Only `lessons.json` (12:28) and `learners.json` (12:32) were newer than the
rest of the tree (12:17), so this was the user's live corpus arriving on the `v71_q` code.

§8 picks *the first grammar lesson in the corpus*, which is the documented fixture-is-not-a-constant
trap. **But the guard fired for a true reason**, and treating it as a stale fixture would have
buried a live defect. That distinction is the whole session.

## 1. Grammar and conjugation were sampling at random

```js
return shuffle(exs).slice(0, 14);     // buildGrammarExercises, buildConjugationExercises
```

Both builders derive their **entire** question set deterministically and then threw away a random
remainder. Two consequences, both real:

**They ignored the `_derivingUniverse` contract.** `_lessonQidUniverse` sets that flag with the
comment *"builders: full set, no cap, no coverage bias"* and re-derives up to 120 times until the
union stops growing. Grammar answered a random 14 every time, so the coverage denominator was
rediscovered by brute force instead of being handed over once.

**A replay re-asked solved questions.** Measured on `ls_1785500580472_1_grammar` (10 items →
universe 25, round 14):

```
play 1: answered 14 distinct, 11 left unsolved
replay 1: 14 questions, 6 previously-unsolved (8 re-asked)
replay 2: 14 questions, 6 previously-unsolved (8 re-asked)
=> ~53% of every grammar replay was material already answered
```

This is exactly the defect `v71_f` fixed for standard lessons. It survived here because `v71_g`
recorded grammar as "deterministic, no top-up needed" — half right, and the wrong half.

**Scope:** 14 of 20 grammar lessons in the current corpus exceed the cap (28 of 36 grammar +
conjugation lessons once conjugation is included). Below 14 exercises the cap never bites, which is
why the old corpus passed.

### The fix

A shared `_cutCoverageRound(exs, cap)` used by both builders:

```js
function _cutCoverageRound(exs, cap) {
  if (APP._derivingUniverse) return exs;          // honour the contract
  const famShare = (typeof FAMILIAR_SHARE === 'number') ? FAMILIAR_SHARE : 0.15;
  if (typeof assembleCoverageRound === 'function') return assembleCoverageRound(exs, cap, 1 - famShare, true);
  return shuffle(exs).slice(0, cap);
}
```

**No top-up is needed here, and that is the point.** `buildStandardExercises` re-derives because it
samples *within* the pool — one exercise type per vocab item, so unsolved questions are genuinely
absent. Grammar's pool is already the whole universe; only the ordering and the cut were wrong.
Adding the v71_f re-derivation loop would have been a loop that can never find anything.

One helper rather than two copies, for the reason `_itemWithheld` exists: three spellings of one
coverage rule is how v71_l happened.

### Result

```
universe 25; single derivation now yields 25 (complete)
first play: 14 questions (unchanged)
round 1: 14 questions, coverage 14/25
round 2: 11 questions, coverage 25/25
100% coverage in 2 rounds; 25 asked, 0 repeats
```

Matches the standard-lesson figure from `v71_f` (2 rounds). First play is deliberately unchanged in
length: with nothing solved every question is equally new, so the round is still 14.

## 2. §8 rewritten to assert the true property

The old §8 lumped three builders under one claim. There are **two** shapes, and conflating them is
what hid the defect:

| | shape | why no top-up | asserted |
|---|---|---|---|
| synonyms, word_forms | `return shuffle(exs)` — uncapped | a **play** build already *is* the universe | §8a |
| grammar, conjugation | `_cutCoverageRound(exs, 14)` — capped | pool is complete; the **cut** must be unsolved-first | §8b, §8c |

- **8a** — uncapped builders: a play build equals the universe.
- **8b** — capped builders: a *deriving* build equals the universe (the contract).
- **8c** — capped builders: solve everything round 1 asks, replay, and assert **0 repeats**.

Plus a `sawCap` guard that **fails if no lesson in the corpus actually exceeds its cap** — without
it, 8c goes vacuous against a smaller `lessons.json` and we are back to a guard that passes while
grammar samples at random. That is the failure mode this section already had once.

`conjugation` is now covered: it exists in the corpus (16 lessons) but the old selector keyed on
`L.words || L.items || L.grammar` and never looked at `L.conjugations`, so it was silently skipped.

### Revert-verified, both guards independently

- Full revert → `grammar: a DERIVING build must return the full set, uncut (14/25) — the _derivingUniverse contract`
- Partial revert (contract kept, random cut restored) → `grammar: a replay after solving 14 asks ONLY unsolved questions — got 11 repeats in a round of 14 (universe 25)`

Both fail as **named assertions carrying the numbers**, not as a `TypeError` (v70_l rule).

## 3. A trap this session walked into — worth inheriting

Setting `APP.cur = { lessonIdx: li }` in §8 broke a **later, unrelated** section
("a human-flagged item is NOT asked"). `_exFlagTarget` resolves a flagged item through
`APP.cur?.lessonIdx`, and the client declares `APP.cur` with a default `lessonIdx: 0`
(index.html:1651) that the later section had always silently depended on.

Replacing the object destroyed the default; so did `delete APP.cur`. The fix is to **mutate the
field and restore it** — `APP.cur.lessonIdx = li` … `APP.cur.lessonIdx = 0` — which is also exactly
what real play does (`openLesson`: `C.lessonIdx = idx` immediately before `buildExercises(idx)`),
so the harness now mirrors production instead of inventing a state.

**The masking is the lesson:** that section never ran on the pristine tree, because §8 threw before
reaching it. A section failing *after* a fixed failure is not necessarily new — it may simply be
running for the first time. Verified by patching the pristine tree to skip §8 and watching it pass,
before assuming anything.

## How to see it work

1. Open a **grammar** lesson with more than ~7 items (most of them — e.g. *Barbera und Geschichten*
   chapter 1's 🏷️ lesson, 10 items). Play it through: 14 questions, as before.
2. Press **Repeat**. Previously ~half the round was words you had just answered; now the round is
   the questions you have **not** seen, and it is *shorter* than 14 once fewer remain (11 in the
   measured case — the v71_i trim).
3. Two rounds should take the lesson to 100%, instead of grinding.
4. Same for a **conjugation** lesson — unmeasured in a browser, fixed by shape.

## Deliberately not done

- **No change to the cap itself.** 14 is a fatigue limit, and whether it is the right number is a
  separate question from whether the cut is random.
- **The duplicate-target finding below is logged, not fixed** — it is a data issue, not this bug.

## Found on the way, logged not fixed

**Duplicate targets inside a single grammar lesson.** Six lessons carry a repeated `target`
(`notification`, `dream`, `silence`, `Wahrheit`/`Ewigkeit`, `Bierkäsel`, `جامعة`/`مدينة`). Two
exercises collide on one qid, so the round asks the word twice while coverage counts it once — a
round of 12 against a universe of 10. **Pre-existing**: byte-identical on the `v71_q` build, so the
fix neither caused nor cures it. Sits alongside the existing cross-chapter vocab duplication item.

## Tests

`unit-replay-focus` §8 rewritten (8a/8b/8c + the anti-vacuity guard). No new test file: this is the
same guard, asserting what is actually true. No new UI strings, so **nothing added to the translate
queue** — the 378 outstanding entries are unchanged.

## Still owed (unchanged from `v71_q`, minus nothing)

Error-hunt word alignment · tutor investigation (4) · book learning-arc form wiring · the two
deferred cosmetics · hiding editing controls in live/non-teacher mode · decisions on drill
traceability and `el/storyboard.title` · browser passes on `v71_i`–`v71_r`.
