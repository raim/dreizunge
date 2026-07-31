# v71_q — session 16 notes

**Final release of this thread.** Model settings, plus two of the five cosmetics. Two cosmetics were
deliberately NOT attempted — see "Deliberately deferred".

Suite **154**, `check-inline` 0 on both builds.

---

## 1. Tutor reasons by default

`OLLAMA_THINK = { story: false, lessons: false, tutor: true }`.

The asymmetry is the point. The tutor answers open questions about a learner's own sentences, where
reasoning visibly helps — with it on it produced exactly the kind of understanding questions the
comprehension lessons aim at. Story and lesson generation emit structured JSON on a token budget,
where reasoning starves the answer: that is the v60.5 finding, and the direct cause of the `v71_o`
empty-response bug.

## 2. CPU threads in the model menu

Ollama's `num_thread`, settable at runtime beside the timeout field. Blank = auto.

The design point: **unset means the option is absent from the request**, not 0 and not a guessed
number. Pinning Ollama to a value this app invented would be worse than the conservative default it
picks for itself. `setNumThread` normalises `0`, `''`, junk and negatives all to `null` (auto)
rather than to `NaN` or a number.

Reported default appeared to be 2, which leaves most of a machine idle during generation.

## 3. Synonym reveal shown bare

A wrong synonym answer showed `Correct answer:` followed by a `<strong>`-wrapped list of words with
glosses. The label said nothing the list did not, and the wrapper fought the list's own layout.
Now shown bare, like the comprehension reason.

## 4. Provenance labelled

`prov.by` `"by {user}"` → **`"User: {user}"`**, `prov.from` `"from"` → **`"Source"`**. Both rendered
as "von" in German, which is what made the line unreadable — two different relationships sharing one
word.

**58 stale translations dropped** across 29 languages: every language that had translated the OLD
wording now held a string that no longer matches its English source. Deleted so the next translate
pass refills them against the new text rather than preserving "von · von".

---

## Deliberately deferred (NOT done)

**Crossword translation highlight.** The request — *"show the translation of the correct word
highlighted instead of the empty underline"* — does not map cleanly onto what the code does. Clues
come from three sources with different shapes: vocabulary (`target ← source`), synonyms
(`base ← gloss`), and word_forms, where the clue IS a blanked sentence containing the `___`. The
"empty underline" is almost certainly that word_forms blank — but a word_forms item has no
translation stored, only the sentence and its choices, so there is nothing to put in the gap
without generating it. **Needs a decision:** should this apply only to vocabulary/synonym entries
(where a translation exists), or should word_forms clues gain a translation field?

**Global QC checkbox menu.** Bigger than it looks — it needs a scope picker (which item kinds), a
re-check-already-QCed toggle, and changes to how QC jobs are batched. Not something to start with
limited context left; it deserves the same treatment the lesson-type picker got in `v71_p`.

---

## Two corrections made after the release write-up

**Mixed lessons DO include comprehension** — verified behaviourally, not assumed. `buildMixedExercises`
pools every earlier non-mixed sibling through `lessonTypeMeta(sib.type).build(...)`, so any registered
type is picked up automatically. A round over a standard + comprehension pair produced
`["comprehension_mcq","comprehension_mcq","listen_type","listen_type"]` with a universe of 4. The
only condition is ordering: the comprehension lesson must sit at a LOWER index than the mixed one.

**The story caps are a TODO, not a design decision.** `v71_o` capped the comprehension story
context at 6,000 chars in two places as a fix for the empty-response bug. That was the wrong
instrument — the actual cause was the token budget, raised in the same release. The caps should be
removed and the timeout raised instead; now in the roadmap with both line references and the
warning that `collectChainStory`'s oldest-end trimming must survive the change.

**The roadmap was not complete.** Three items lived only in these notes: the crossword translation
highlight, the global QC checkbox menu, and hiding editing controls in live/non-teacher mode. All
three are now in the roadmap with their blocking questions. The entry claiming the tutor-thinking
default and the threads setting were "not yet done" was also stale — both shipped in `v71_q`.

## Handover to a fresh session

Read in order: this file, `v71_session15_notes.md`, then `roadmap_v71.md`'s session protocol.

**Queued, roughly by value:**
1. **Error-hunt word alignment** — the `processo`/`processi` bug. The generator corrupts a LATER
   occurrence, but the checker marks the FIRST one, because it locates errors by word search rather
   than positional diff. Needs a real token-level alignment. Fixture is in the session-11 message.
2. **Tutor investigation (4)** — context mismatch (`ctx: Bartrick` while discussing another topic),
   token usage in the log and the user file, the reply lost after a parallel job, and giving the
   tutor knowledge of available courses.
3. **Book learning-arc form** — wire `pdf-arc-mode` / `gen-arc-mode` to the shared picker built in
   `v71_p`. Needs `arcMode`/`arcTypes` to become a list along the book path.
4. The two deferred cosmetics above, plus **hiding all editing controls in live mode when teacher
   mode is off** (not attempted this session).
5. **Decisions waiting:** drill traceability (`v71_n` notes), `el/storyboard.title`.

**Translate pass owed — 378 outstanding entries**, from: `v71_l` (4 comprehension keys), `v71_p`
(3 add-lessons keys), `v71_q` (4 threads keys + 58 dropped provenance strings), plus the earlier
`el/storyboard.title`.

**Browser passes owed on `v71_i` through `v71_q`.** Most touch the result card or the model menu.

## Tests

`unit-model-settings` (new): the per-role reasoning defaults with the asymmetry asserted explicitly;
`num_thread` present only when set, on both call paths, with the setter's normalisation exercised
behaviourally (0/''/junk/negative → auto); the endpoint accepting a threads-only POST; the menu
control and its four strings; the bare synonym reveal; and the provenance relabelling with the
assertion that **no** language still holds a translation of the old wording.

Revert-verified: turning tutor reasoning off fails; passing `num_thread` unconditionally fails.
