# v71_l — session 11 notes

Three things: the returning corpus merged and the suite re-greened against it, the **QC-flag policy**
settled, and the **comprehension lesson type** added.

Suite **151** (was 150 at `v71_k`), `check-inline` 0 on both builds.

---

## 1. New data merged

**`ui.json` — complete for the first time.** 583 en keys on arrival, 0 outstanding, 0 placeholder
mismatches, no en key lost or altered. One entry came back English and the `v71_k` guard caught it:
`el/storyboard.title = "Storyboard"`. Deleted for refill per the standing convention — **but this
needs a human call**: Greek may legitimately use the Latin loanword, in which case it belongs in the
guard's exemption list instead.

**`lessons.json`** — 294 topics, 82 storylines, 23 storyboards (was 291/81/22), same schema 30. The
`v71_k` frame logic was re-validated against the whole new corpus: **0 backwards spans, 0 chapters
that would render blank**, including new shapes like `Verlorene Antworten` (5 panels tagged
`[1,1,1,2,2]` for 2 chapters).

**`learners.json`** — inspected, not yet acted on. It confirms the drill complaint precisely: the
`it|de` ledger holds exactly ONE vocab entry with `wrong > 0`, `studiare {seen:1, wrong:1}`. That
single entry *is* the whole it←de drill pool, which is why the drill and the tutor both circle it.
Queued as its own job.

## 2. Two failing tests — both test-premise problems, not code

Recorded because the first diagnosis was wrong and the correction matters.

**`unit-replay-focus`** was reported mid-session as "a genuine defect". It was not. The test assumed
"one derivation == universe" for deterministic builders; true until the corpus contained flagged
items, and the 29 July QC pass produced **455 of 5,269**. It was measuring how much of the corpus
had been QC'd, not whether the builder samples.

**`smoke-render`** asserted `disabled === false` to prove the below-mark lock clears. `disabled` is
set by *two* branches — the lock, and "nothing left to do" — and the grown corpus made the test pick
a different storyline that legitimately lands in the second. Now asserts `locked` is cleared plus
the title is no longer "Keep going!", which is the actual claim.

Both were assertions coupled to corpus content, so they would have kept breaking on every data drop.

## 3. QC flags no longer affect the learner (policy decision)

**Only human decisions withhold an item.** `item.qc` is an unreviewed MODEL suggestion: the question
is asked AND counted. `userFlag`/`userDelete` are human decisions: neither asked nor counted.

The investigation found the rule spelled out **three times, three different ways**:

| Site | Old rule | Scope |
|---|---|---|
| `buildExercises` play filter | `userFlag \|\| qc \|\| userDelete` | **static build only** |
| `_lessonQidUniverse` denominator | `userFlag \|\| qc \|\| userDelete` | both |
| `markSolved` | `userFlag` only | both |

So a *live* learner was asked questions that could never count, while a *static* learner was not
asked them at all — same corpus, two coverage stories. And `markSolved` would record a solve for an
item the denominator had excluded.

All three now call one predicate, **`_itemWithheld`**, and the play filter runs in both builds.
Human flags finally bite in live, which they never did (6 items, so no practical disruption — but
the flags now mean something).

**Restored to the denominators: 450 items across 157 lessons in 80 topics.** Coverage percentages in
those topics will DROP back: they were inflated by the QC pass shrinking the denominator, not by
anyone learning less. Median 38% of a flagged lesson had been excluded, 41 lessons over half, some
entirely — all from one automated pass, with no suggestion accepted.

## 4. Comprehension lesson type (🧠 `comprehension`)

Multiple-choice questions about the STORY — events, motives, implications — explicitly not
vocabulary or grammar. **Story-based, counted like any other lesson, hidden where no story exists.**

Unlike every other builder, this one derives nothing: the generator authors the questions against
the story and they are stored verbatim. That shifts the risk onto REJECTION — a question whose
answer is not among its options is unanswerable, and shipping it hands the learner a round they
cannot win. `buildComprehensionExercises` drops five malformed shapes; the editor shows the dropped
ones with a warning so they can be repaired rather than silently vanishing.

Wired at every point a lesson type touches:

- `LESSON_TYPE_META`, `LESSON_DESC_KEY`, `EX_RENDERERS`, `_qidCanonical`
- `_FLAG_ARRAYS` + `_resolveExItem` — without these a question resolves to null and no flag, QC note
  or delete could ever reach it
- editor branch with per-option radio for the correct answer, plus sync (`cq`) and delete paths
- three menus, `VALID_FORMATS`, **both** server route clamps, the add-lesson registry
- `prompts.json` → `comprehension`, and `generateComprehension` (3 attempts)

Question count scales with story length (3–8, ~one per 90 words). Padding a short chapter to a fixed
count produces exactly the trivia the prompt forbids.

Deliberately left OUT of `_MODE_FORMATS`: that row drives reinforce/extend vocab mode, which a
story-comprehension lesson does not consume.

**A real bug the existing guards caught:** `e2e-book-formats` failed with *"picker option
'comprehension' is accepted by the client clamp (a miss = dead menu entry)"* — the exact v68.1
failure mode. Three clamps needed the new format: `VALID_FORMATS` and **both** server routes. The
guard now asserts both routes by count, since fixing only one was the original v68.1 bug.

---

## How to see it work (browser + a live model — nothing here is exercisable headlessly)

1. Open a chapter that HAS a story → add-lesson menu shows **🧠 Comprehension**. Open one without a
   story → the option is absent, and a previously-selected `comprehension` resets to Standard.
2. Generate one. Check the questions actually require having read the text: if any can be answered
   from the options alone, the prompt needs work — see the caveat below.
3. Play it. Options shuffle between plays; progress must still credit correctly (qid ignores option
   order by design).
4. Open the lesson editor on it: questions, options, correct-answer radio, Why field, flag/delete.
   A question with no correct option marked shows a red warning and is skipped in play.
5. Coverage: finishing it should move the chapter bar like any other lesson.

**Caveat — the prompt is untested against a live model.** Shape and wiring are verified end to end,
but no comprehension lesson has been produced by an actual model. The distractor-quality rules
("never make the correct option the longest") are the kind of instruction models drift on, so the
first generation run is a real test, not a formality.

## Still owed

- **Translate pass.** Four new en keys: `lesson.type.comprehension`,
  `lesson.type.desc.comprehension`, `form.format.comprehension`, `ex.badge.comprehension`. Plus the
  `el/storyboard.title` decision.
- **Browser passes** on `v71_i`, `v71_j`, `v71_k` (all touch the result card) and now `v71_l`.
- **`⚠ Repaired 1 DUPLICATE lesson id(s)`** on loading the new `lessons.json` — someone's progress on
  that lesson silently reset. Pre-existing data issue, worth a look.
- The triage queue from session 11: result-card arc (5 TODOs), drill/ledger correctness (3),
  error-hunt word alignment, book generation (3), tutor (4), cosmetics (6).

## Tests

| Guard | What it pins |
|---|---|
| `unit-comprehension` (new) | playable path; five malformed shapes rejected; `answer`-string fallback; shuffle vs. stable identity; counts toward coverage; flags reach questions; the full clamp/gate chain incl. both server routes |
| `unit-replay-focus` | rewritten: the withheld-item policy end to end — qc asked+counted, userFlag/userDelete neither, teacher sees all |
| `unit-static-flags` | re-pointed from the open-coded triple to `_itemWithheld`; asserts no open-coded copy survives |
| `unit-renderex-registry`, `unit-add-lesson-registry`, `unit-dialect-panel`, `e2e-book-formats` | extended for the new type |
| `unit-qid-stability`, `unit-coverage`, `unit-mixed-coverage-round` | pointed at the real `_itemWithheld` rather than re-stubbing the rule |

Revert-verified: putting `qc` back into the withheld rule fails; restoring the static-only play
filter fails; accepting a question with no correct option fails; removing the no-story reset fails.
