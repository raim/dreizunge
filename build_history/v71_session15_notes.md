# v71_p — session 15 notes

Result-card width alignment, and the book-generation batch (3 items).

Suite **153**, `check-inline` 0 on both builds.

---

## 1. Result card now the same column as the storyline page

Reported: the card was narrower and its storyboard rendered smaller than the identical board on the
storyline page. Measured:

| | max-width | padding | content box |
|---|---|---|---|
| `.sl-screen` | 540px | `0 0 40px` | **540px** |
| `#complete-screen` (before) | 520px | `24px 20px 40px` | **480px** |

60px narrower, which at `width:100%` is exactly why the storyboard looked shrunken.

Fixed by matching the storyline container rather than nudging the number: same 540px cap, same zero
outer horizontal padding (so the header is full-bleed white with a bottom border, as on the
storyline page), and the inset moved into a new `.comp-body` that mirrors `.sl-screen-body`'s
`12px 16px 0`. The header deliberately sits OUTSIDE that body — full-bleed there too.

## 2. Chapter-title post-pass: 3 attempts

The reported failure printed `Titles   :   |  ` — the response **parsed** as an array of the right
length whose titles were all empty strings. So a retry catching only parse errors would not have
retried at all: the acceptance test has to be on the CONTENT.

Now up to three attempts, accepting on `named === n`, keeping the best partial across attempts (a
partial set still beats falling back to "Chapter 3"), and failing loudly only if nothing usable
came back. The single call moved into `_generateChapterMetaOnce` so the loop has something to
retry; it still passes `think: false`, and the v60.5 guard was re-pointed to follow it rather than
dropped with the refactor.

## 3. Shared lesson-type picker, and "Add lessons"

The two-button arc chooser ("more vocab + retrain" vs "words and synonyms") could only express two
fixed bundles. Replaced by `ADD_LESSON_TYPES` — one named table — rendered as a tick-list by
`renderLessonTypeChecks`, wrapped in `_pickLessonTypes` for modal use. `_pickArcMode` is **gone**,
not left beside it: two ways to express the same intent is how the storyline page and the book form
drift into offering different sets.

Offered: standard, review, word_forms, synonyms, grammar, conjugation, comprehension, error_hunt,
math. The story-dependent types carry `needsStory` and are hidden for a chapter without one — the
same gate the add-lesson menu applies. Ticking nothing is refused rather than quietly running the
default set: an empty run costs a long wait for nothing.

`standard` and `review` are not registry types (both are `generateOneLesson` with different
options — this chapter's vocabulary vs a review over prior chapters), so they are listed explicitly
rather than derived from `LESSON_TYPE_META`.

### "Re-create all lessons" → "Add lessons"

The storyline bottom-row button (🔁 → ➕) now opens the picker and posts `{ addTypes, add: true }`.

**Adding no longer hides.** The old path marked every existing lesson `_hidden`, which silently
discards the learner's progress against them. Hiding is now confined to the legacy `arcMode` path,
kept for older clients.

**Every chapter, including the first.** The old arc reinforced only from chapter 2 on, assuming
chapter 1 had no prior vocabulary to review. An explicit tick-list removes that assumption: asking
for word_forms on a storyline means all of it. A type that fails on one chapter is logged and
skipped rather than abandoning the rest of the selection.

Unknown types are filtered against `ADD_LESSON_GENERATORS` before any generation is attempted.

---

## Not done in this release

- **The learning-arc form still uses the old two-option `<select>`** (`pdf-arc-mode` /
  `gen-arc-mode`). The picker and its renderer are built and shared-ready, but wiring the book form
  to it means changing what `arcMode`/`arcTypes` mean on the book-generation path, which is a
  bigger surface than the storyline button. The storyline half is live; the book half is next.
- The roadmap note you asked for — *later, have the model design lesson sets as a learning arc
  toward understanding the text* — is written into the roadmap with this release.

## How to see it work

1. Open a result card next to its storyline page: same width, same header band, storyboard the
   same size in both.
2. Storyline page bottom row: the ➕ button opens a tick-list. Pick two types → both are added to
   **every** chapter, and the lessons that were already there are still visible.
3. Pick nothing → the button warns instead of running.
4. Generate a book whose chapter titles previously came back empty — the log should show
   `Attempt 1/3: 0/N titles came back named` and try again.

## Still owed

- Tutor batch (5, incl. thinking-on default) · cores/threads setting · error-hunt word alignment ·
  book learning-arc form wiring · cosmetics (6).
- Translate pass: `v71_l`'s four keys plus **three new here** (`sl.add_lessons_btn`,
  `sl.add_lessons_hint`, `sl.add_lessons_none`).
- Decisions outstanding: drill traceability, `el/storyboard.title`.

## Tests

`unit-add-lessons` (new, 5 sections): the picker exists and the old chooser is gone; the type table
covers the generatable set with story-gating; the storyline button posts a tick-list in ADD mode;
the server keeps existing lessons and has no `i >= 1` gate in the tick-list branch; and the
chapter-title retry accepts on content rather than on parseability.

`smoke-render` §13 gained the width parity check — asserted on the CSS numbers, since a storyboard
rendering smaller than an identical board elsewhere is a visual effect no headless check sees.

Revert-verified: letting ADD hide existing lessons fails; dropping the empty-title acceptance test
fails; narrowing the card back to 520px fails.
