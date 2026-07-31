# v71_m — session 12 notes

The **result-card arc**: the card now reads as another view of the storyline page rather than a
dialog that mentions it. Four of the five bundled TODOs are done; the fifth (error-hunt as a
post-story lesson) is untouched and still queued.

Suite **151**, `check-inline` 0 on both builds.

---

## 1. Shared header, shared numbers

The card opens with the storyline page's header **block** — same `sl-screen-hdr`/`sl-screen-title-row`
classes, same 5px progress bar, same `done/total · score%` label. 🌍 goes home, the title goes back
to the storyline (it replaced the "← Back to story" button in `v71_k`).

The progress arithmetic was **extracted** from `_renderStorylineScreen` into `_slProgressStats` /
`_slProgressLabel`, and both pages now call it. Two copies would have drifted the moment either page
changed what "done" means — and on a card that is supposed to be another view of the same storyline,
a differing number is the worst kind of bug: plausible, and wrong.

A solo chapter has no storyline to be a fraction of, so the bar and its label **hide** rather than
showing a meaningless 0%.

## 2. Row order

Header (+ storyline bar) → storyboard with green frames → **chapter-level** progress bars → the
large status line → button row → story panel → learned vocabulary.

The status line moved BELOW the bars it describes: the learner reads the progress, then the verdict
("Keep going!" / "Lesson complete!" / "Story complete!"), then the buttons.

The along-the-storyline bar is **no longer emitted in the card body** — the header carries it, and
the card had been showing the same fraction twice. `_compProgressHtml` gained a `skipStoryRow`
option rather than losing the row, since other callers still want it.

## 3. Pass mark drawn on the bar

The sentence *"You must solve 80% of this chapter to complete it — try the repeat below"* is gone.
In its place the %-solved bar carries a **vertical mark at the threshold**, and the fill runs **red
until the mark is reached, green once it is**.

Two deliberate changes of behaviour beyond the visual:

- The mark shows **whenever a mark applies**, not only when the learner is under it. Knowing where
  the line is *before* you cross it is the useful part; a message that appears only on failure
  teaches the rule at the moment it is least welcome.
- The mark sits on the **%-solved** bar specifically, because that is what the threshold measures —
  putting it on the chapter-lessons bar would mark a line against the wrong quantity.

## 4. Story on white, solved words in yellow

The story panel's green wash is gone (white background; the green border already carried "unlocked",
and the wash made the highlighting muddy). Words the learner has **solved** are highlighted in the
same yellow the storyline and lesson-set pages use, via the same `_highlightVocabHtml` helper.

"Solved" reads the **coverage store**, not `completed` — the highlight marks words they demonstrated,
not lessons they opened. Withheld items (`_itemWithheld`, `v71_l`) are excluded: they are not part of
the record. Highlighting is applied only to the target-language story — the words are
target-language, so running it over a source translation would match nothing, or worse, coincidental
substrings. Any failure falls back to plain text: a story that renders unhighlighted is fine, a
story that fails to render is not.

---

## How to see it work (browser-only)

1. Finish a chapter in a multi-chapter storyline. The card's header should be visually
   indistinguishable from that storyline's page header, **including the same progress fraction** —
   if the two disagree, `_slProgressStats` has a caller that bypassed it.
2. Below it: the full storyboard with green/blue frames (`v71_k`), then chapter bars, then the big
   status line. The storyline fraction must appear **once**, in the header.
3. Look at the %-solved bar: a dark vertical line at your pass mark, bar red below it, green at or
   above. Set a chapter's mark to 100% and the line should disappear (nothing to mark).
4. Open the unlocked story: white background, and the words you have solved highlighted yellow.
   Toggle to the translation — highlighting should switch OFF (target words, source text).
5. A solo chapter (no storyline): header shows the chapter name, no progress bar.

## Still owed

- **The fifth TODO of this arc is not done**: AI/normal error-hunt shown on the result card once the
  story is unlocked, scored as an extra. It is a flow change with a scoring question attached
  (where does the "extra score" live in the user profile?), so it wants its own decision.
- Translate pass: `v71_l`'s four comprehension keys are still en-only. **This release adds none** —
  the pass mark replaced a string rather than adding one, and `complete.below_threshold` is now
  unused (left in `ui.json` deliberately; harmless, and removing a key that translations exist for
  is the `v71_e` trap).
- Comprehension prompt still unexercised against a live model (`v71_l`).
- Browser passes owed on `v71_i`, `v71_j`, `v71_k`, `v71_l`, and now `v71_m` — all the same screen.

## Tests

| Guard | What it pins |
|---|---|
| `smoke-render` §13 (new) | RENDERED card: header bar filled by the shared helper, done/total label present, solo chapter hides it, row order read off the markup, storyline fraction not duplicated in the body |
| `unit-coverage-threshold` | re-pointed from the below-threshold sentence to the drawn mark; asserts the sentence is gone AND the mark is positioned at the threshold |
| `unit-learner-nav` | re-pointed to the highlighted story render: same helper as the other pages, target-language only, plain-text fallback, white panel |

Revert-verified: dropping the header label fails with *"with the same done/total label as the
storyline page"*; moving the status line back above the progress rows fails with *"card rows run
header → storyboard → chapter progress → status line → buttons"*.

One harness note: `showComplete(true)` **replaces** `APP.cur` with an empty exercise list, so a
stray auto-advance timer from an earlier smoke section could fire into `renderEx` and take the file
down. §13 re-arms `APP.cur.exercises` after each call — the failure was in the harness, not the
client, but it cost a debugging round and will recur in any new section that renders a review card.
