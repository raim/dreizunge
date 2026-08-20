# Session 37 — `v81_b` → `v81_h`

Two user-reported defects from the `v81_b` device pass, then the `§T7` ruling the user gave during
the session. All reproduced or measured before editing, all guarded. Nothing else was started.

## What shipped

| release | what |
|---|---|
| `v81_c` | arriving at a chapter is not finishing it — the comprehension lesson was being skipped |
| `v81_d` | a word is graded only on questions a round can BUILD — words that could never turn green |
| `v81_e` | `§T7` reading 1 (user ruling, HIGHLIGHT ONLY) — a wrong answer takes a word out of green |
| `v81_f` | a tap on a word with NO question opens the lesson that TEACHES it (user ruling) — dead taps 181 → 79 |
| `v81_g` | the storyline BAR measures completion, the LABEL keeps counting unlocked chapters (user ruling) |
| `v81_h` | a hidden lesson's words leave the story panel (user ruling) — dead taps reach ZERO |

Full write-ups are in `build_history/roadmap_v81.md` under `# SHIPPED IN THE v81 LINE`. This file
records what a future session needs that the entries do not carry: how to SEE it, and what is owed.

## ⚠️ THE DEVICE CHECKLIST — how to see each release work

**One block per release, all six, in order. None of these is exercisable headlessly** — every one is
a claim about what a learner sees or what a tap does, which is why they are owed as a browser pass
rather than as a test.

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

**`v81_e`, a wrong answer un-greens a word.** Find a word showing GREEN on a progress card.

- Tap it, and answer the question WRONG. The word must turn AMBER (partial) — not red: you have
  answered these questions correctly before and red would claim otherwise.
- Tap the same word again. It must bring back **the question you just got wrong**, not one you
  already have right. (Headlessly this is only guaranteed at the pool level — see the note in
  `unit-tap-word` — so the end-to-end landing is worth watching on the device.)
- Answer it correctly. The word must go back to GREEN.
- ⚠️ **CHECK THE CONTAINMENT BY EYE TOO:** getting a question wrong must NOT change the chapter's
  progress bars, its completion, the pass mark, or whether the story is readable. That is the whole
  of the ruling. If a story ever re-locks after a wrong answer, reading 1 has become reading 2 and
  the release should be pulled.
- Wipe the chapter's progress and re-open it: no word may come back amber.

**`v81_f`, dead taps.** On a progress card, tap a word that has never given you a question — a
conjugation infinitive, or a wrong option from a word-forms exercise.

- It must now OPEN A LESSON (the one that teaches that word) instead of doing nothing.
- It may land at the top of the round rather than on a question about that word: that is the
  intended fallback, not a bug, and it is what the function has always done when the lesson teaches
  a word without holding an exact question for it.
- ⚠️ **79 words (11.4%) still do nothing, and correctly**: their only teaching lesson is HIDDEN.
  If a tap ever opens a hidden lesson, that is a real bug — pull it.

**`v81_g`, the storyline bar and its label.** Open any storyline you have NOT started. The bar must
be EMPTY. Before `v81_g` every deck showed some green immediately, and all 27 single-chapter decks
showed a FULL bar and `1/1`.

- Finish one chapter of a three-chapter deck: bar ~33%, label `2/3`.
- Finish the second: bar ~67%, label `3/3`. **The label and the bar now say different things on
  purpose** — `3/3` means "all three chapters are open to you", the bar means "two are finished".
  If that reads badly on the device, the LABEL is the part to revisit; the bar is the ruled part.
- Only finishing the LAST chapter fills the bar. Before, it filled with a chapter still unplayed.

**`v81_h`, hidden lessons.** Open a chapter you have RE-CREATED at some point (its old lessons were
kept but hidden — 29 of the 32 topics with hidden lessons are these).

- The story panel must no longer highlight words that only the superseded lessons taught.
- Combined with `v81_f`, **no marked word should be a dead tap any more** — every highlight either
  opens a question or opens the lesson that teaches it.
- Switch to TEACHER MODE: the hidden lessons' words come BACK on the panel. That is deliberate — the
  hidden rule is a learner-visibility rule everywhere else in the client.

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

## `PLAN §C1` / `§0.3` — RULED AND SHIPPED as `v81_g`

The measurement, the ruling and what changed are in the roadmap's `v81_g` entry. **Its device steps
live with the other five, in the checklist above** — they were written here while this was still a
measurement rather than a release, and a checklist you can miss by reading top-to-bottom is a
checklist that gets half-done.

## What is owed after this session

- **A device pass on `v81_c` … `v81_h`**, per the checklist above. All six changes are on screens
  the v80 line already changed, so this folds into the device pass already owed for `v81_a`.
- **The `§T5`/`§T4` numbers are now stale where they touch the denominator** — `v81_d` moves GREEN
  from 18.6% to 27.8% and the mean questions-per-word from 2.20 to 1.79. No ruling is reversed, but
  re-measure before re-opening the word gate or `§T5.4`.
- **DEAD TAPS, 26.1%, open and unfixed.** Pre-existing, measured this session, not introduced by
  `v81_d` (181 before, 181 after). Every TRACK T mark is tappable; a quarter resolve to no question.
- **`§T7` is CLOSED**, but reading 2 (mastery decay) is not ruled and remains blocked on `§8/B4`.
  ⚠️ If it is ever re-opened, note that the roadmap's original reader list was INCOMPLETE: the round
  BUILDERS read the solved store too, so un-solving would also change which questions get asked.
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
