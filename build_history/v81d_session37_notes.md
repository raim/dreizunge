# Session 37 — `v81_b` → `v81_d`

Two user-reported defects from the `v81_b` device pass. Both reproduced, both measured before
editing, both fixed and guarded. Nothing else was started.

## What shipped

| release | what |
|---|---|
| `v81_c` | arriving at a chapter is not finishing it — the comprehension lesson was being skipped |
| `v81_d` | a word is graded only on questions a round can BUILD — words that could never turn green |

Full write-ups are in `build_history/roadmap_v81.md` under `# SHIPPED IN THE v81 LINE`. This file
records what a future session needs that the entries do not carry: how to SEE it, and what is owed.

## How to see it work (browser — neither is exercisable by eye headlessly)

**`v81_c`, the comprehension skip.** Open a storyline and pick any chapter after the first that you
have partly worked — the ordinary lessons done, the comprehension lesson not. You now land on its
PROGRESS CARD (that part is `v81_b` and unchanged).

- The card title must read **"Keep going!"**, not "Lesson complete!". Before this release every one
  of the 72 such chapters in the corpus said "Lesson complete!" on arrival, having played nothing.
- Press **→ (Next)**. It must open **the comprehension lesson of THIS chapter**. Before, it opened
  the NEXT CHAPTER (52 of 72) or fell back to the storyline deck (20 of 72).
- Then finish that comprehension lesson and press Next again: the old behaviour returns, i.e. the
  next chapter opens. Passing the chapter is unchanged; only skipping it is gone.

**`v81_d`, words that would not green.** Open a chapter with a CONJUGATION or SYNONYMS lesson and
look at the highlighted story on the progress card.

- Tap a conjugated form and answer its question correctly. The word must go **GREEN**, not amber.
  Before, a form was graded 2 (`mcq_conjugation` + `type_conjugation`) while only the MCQ could ever
  be built, so it stuck at partial for ever.
- Same for a synonym word in a lesson that has no antonyms.
- A word you have not touched is still RED, and a word with several genuinely buildable questions
  still needs all of them (`§T5.1` is unchanged: green = ALL).

**Regression to watch on a device (`v81_d` nearly broke this):** open a STORYLINE and expand the
full-chain story panel. The darker shade must still appear on chapters other than the open one. The
first version of the filter blanked it across the whole chain.

## Probes added (all report, none assert)

| probe | what it answers |
|---|---|
| `probe_comp_skip_v81c.js` | drives `showComplete(true)` over every later chapter and CLICKS `comp-next`; reports where the click goes and what the card says. `PROBE_CLIENT=` to diff builds |
| `probe_word_green_v81c.js` | declared probe keys vs `_lessonQidUniverse` — which questions a word is graded on that no round can build. `LIMIT=n` to sample |
| `probe_word_green_impact_v81d.js` | the colouring over `learners.json` **through `_wordProgress`/`_wordState`**. `PROBE_CLIENT=` to diff |
| `probe_tap_reachable_v81d.js` | highlighted words whose tap resolves to nothing |

⚠️ `probe_learner_known_v80l.js` **re-derives the colouring inline** from `_storyWordSources` + `qid`
rather than calling `_wordProgress`, so it is blind to any change inside the collector — it did not
move at all across `v81_d`. Use `probe_word_green_impact_v81d.js` for questions about what the screen
paints. (Session-28 rule 1, in a file that claims in its own header to drive the product helpers.)

## New i18n keys

**None.** `v81_c`'s title change reuses the existing `complete.keep_going`, which is already
translated in all 33 languages. No translate pass is owed for this session.

## What is owed after this session

- **A device pass on `v81_c` / `v81_d`**, per the two checklists above. Both changes are on screens
  the v80 line already changed, so this folds into the device pass already owed for `v81_a`.
- **The `§T5`/`§T4` numbers are now stale where they touch the denominator** — `v81_d` moves GREEN
  from 18.6% to 27.8% and the mean questions-per-word from 2.20 to 1.79. No ruling is reversed, but
  re-measure before re-opening the word gate or `§T5.4`.
- **DEAD TAPS, 26.1%, open and unfixed.** Pre-existing, measured this session, not introduced by
  `v81_d` (181 before, 181 after). Every TRACK T mark is tappable; a quarter resolve to no question.
- Everything already owed at the `v81_b` cut and untouched here: the pass mark, `PLAN §F3`'s
  regeneration check, the translate pass, the `cyrillic-sr` native-speaker check.

## `unit-tap-word` flake — repaired, and it was NOT ours

The suite carried a 1-in-40 flake. Diagnosed rather than retried: it failed on its own non-vacuity
assertion because the fixture was accepted on the UNION of a word's questions across builds, while §4
needs two askable in ONE round. **Verified pre-existing by running the same 40-iteration protocol
against the pre-`v81_d` client: 1 failure in 40 there too, same assertion, same fixture ("le
silence").** Repaired by selecting the fixture on co-occurrence and deriving the solved set from an
observed co-occurring pair. 0 in 40 after; mutation-tested.

**Why this mattered enough to fix mid-session:** a flaky guard poisons the "a red baseline is a
finding until proven otherwise" rule that this project runs on. A future session hitting it would
have spent the diagnosis budget on a product bug that does not exist — which is exactly what the
prompt's habit 4 says happened six times already.

## Two method notes worth carrying

1. **Order assertions so each mutation is attributable.** `unit-next-chapter-entry` §8 first had the
   title check before the Next checks; mutating the Next fix failed on the TITLE assertion, which
   aborts the file — so the Next assertions were never shown to be capable of failing. Reordered,
   each mutation now fails on its own.
2. **The guard that fired was right and my change was wrong.** `unit-story-highlight-sources` §4 went
   red on the first version of `v81_d`; the reflex reading was "the fixture is synthetic". It was
   not — `_lessonQidUniverse` genuinely cannot see a chapter that is not `APP.lessonData`, and the
   chain panel renders exactly that case (rule: a red baseline is a finding until proven otherwise).
