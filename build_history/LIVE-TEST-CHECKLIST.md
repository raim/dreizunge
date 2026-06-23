# Dreizunge — live verification checklist

Everything here needs a **real model (qwen2.5:7b) and/or a real browser** and so
can't be covered by the headless suite. Run `node test/run.js` first — it should
be green before you bother with any of this. Then work top to bottom.

## 0. Setup

- [ ] Ollama running with the model pulled: `ollama pull qwen2.5:7b`
- [ ] Start the server against a **scratch** store (don't pollute `lessons.json`):
      `LESSONS_FILE=/tmp/live.json OLLAMA_MODEL=qwen2.5:7b OLLAMA_LESSON_MODEL=qwen2.5:7b node server.js`
- [ ] Open the app, set **I speak = English**, **I learn = German** (de→en) unless a
      step says otherwise. Watch the server console — most pass/fail signals show there.

---

## 1. Item 4 — conjugation prompt (rewritten)

Generate a lesson with format **Conjugation** (de→en), then open it.

- [ ] The question shows the **infinitive** (e.g. *gehen*), not a conjugated form.
- [ ] Pronouns are grouped **only where canonical** — German shows `er/sie/es` as ONE
      row, but `ich`, `du`, `wir`, `ihr` and plural `sie` are each their **own** row even
      when the form repeats (e.g. `ihr geht` and `er/sie/es geht` → two rows, not one).
      An en→de batch groups English `I/you/we/they` and `he/she/it`.
- [ ] The conjugated forms are in the **target** language (German for de→en).
- [ ] `form` contains only the verb form, never the pronoun (`gehe`, not `ich gehe`).
- [ ] Client guard (`mergeConjugationForms`): regardless of how the model groups,
      German never fuses anything but `er/sie/es`, and model **over**-grouping (e.g.
      `er/sie/es/ihr` in one row) is split back apart. Other languages keep the model's
      grouping as-is.

## 2. Item 4 — chapter-title post-pass

Generate a **multi-chapter generated book** (Generate → set Chapters ≥ 3, topic e.g.
"a walk in the city"). After the job finishes:

- [ ] Each chapter gets a coherent **target-language** title (German), not English,
      and not the `"<topic> — N"` placeholder.
- [ ] The storyline gets a single overall title + icon.
- [ ] Console: no `Chapter-title post-pass failed` / `Storyline title post-pass failed`.
      If malformed JSON appears, confirm the robust parse chain recovers or falls back
      cleanly (placeholder kept) rather than crashing the job.

## 3. Item 4 — vocab arc lessons (now restructured — see §4/§5)

Generate a multi-chapter book with **arc mode = vocab** (the default). Per chapter:

- [ ] **Chapter 1**: exactly **one** lesson — the standard vocab lesson for that story.
- [ ] **Chapters 2+**: exactly **two** lessons — (a) the new chapter's vocab, and
      (b) a **review** lesson. Confirm (b) actually drills words from **earlier**
      chapters (weaves prior vocab into sentences), not just chapter-1 words.
- [ ] The old separate "New words / Review words" pair is gone (no double-vocab on ch.1).

## 4. New behaviour — generated story continuation

Same multi-chapter generated book. Read the chapters in order:

- [ ] The story **continues** across chapters — same characters/setting/plot thread —
      rather than restarting the topic each chapter.
- [ ] Later chapters don't re-introduce the base topic as if new.
- [ ] (Console, optional) the per-chapter story step shows
      `Continuing from: "…" (using full …)` for chapters 2+.
- [ ] Try a book that **continues from an existing storyline** (pick a parent in
      "continue story from", then set Chapters ≥ 2): chapter 1 should already build on
      the selected parent's story (full context), not start fresh.

## 5. New behaviour — whole-storyline review lesson quality

In the chapter-2+ review lesson from §3/§4:

- [ ] It reinforces vocab spanning **all** prior chapters of the storyline (not only the
      immediately previous one). Longer books → the review should reflect the whole chain.
- [ ] It does **not** include the current chapter's brand-new words as "review" (those
      belong to the chapter's own new-vocab lesson).
- [ ] **Grammar arc** (set arc mode = grammar): chapter 1 has no reinforcement lesson;
      chapters 2+ add the grammar/conjugation reinforcement. Confirm this matches intent
      (we gated grammar-arc reinforcement to ch.2+ for consistency — revert if undesired).

## 5b. Grammar reinforce — noun normalization (live-LLM, item 5)

Generate a **grammar-arc** book of **3+** chapters (so chapter 3's grammar
reinforcement receives prior-chapter nouns), then open the later grammar lessons.

- [ ] Far fewer rejected items than before — the server log's
      `Grammar: N valid (M rejected)` line should show low M even when prior chapters
      surfaced inflected/plural/verb forms.
- [ ] Prior words appear in their **base singular noun** form (e.g. a prior
      `verbesserten` shows up drilled as `die Verbesserung`, `Häuser` as `das Haus`).
- [ ] Pure verbs / adjectives with no related noun are **skipped**, not forced into the
      gender drill.
- [ ] Known limitation (don't be surprised): German adjectival/participial nouns with
      article-dependent gender (`ein Begeisterter` vs `der/die Begeisterte`) are still
      not handled well — flagged as an open TODO, ideally excluded from the drill.

---

## 6. Item 1 — export (browser-only)

From a storyline header and from a single saved card, click the **⬇** export button:

- [ ] The **format menu** (md / html / json) pops up and is positioned sensibly
      (anchored to the button, on-screen).
- [ ] Each format triggers an actual **file download** (Blob) with sane contents.
- [ ] Storyline header shows **⬇ 🔗** (one download arrow + share), not two arrows.
- [ ] **Static build parity**: `node build-static.js lessons.json docs`, open
      `docs/index.html` directly (file://, no server). md/html render **client-side**
      and should be **byte-identical** to the live server's `/api/export` output for the
      same storyline. (A quick diff of a saved md export from each mode is the strong check.)

## 7. Item 2 — storyline screen render (browser-only)

Create the genuinely tricky case the resolvers defend against: generate the **same**
first chapter name in two languages (e.g. a PDF/topic that yields "Kapitel 1" for both
de→en and fr→en), each continued by a second chapter.

- [ ] Opening the de storyline screen shows **only** the de chapters; the fr same-named
      chapter is not pulled in (no duplicate / cross-language card).
- [ ] Landing-page storyline grouping, deleting a storyline, and "next chapter" navigation
      all respect the same-language boundary.
- [ ] A legacy chapter chained only by `continuedFrom` **name** (no `continuedFromId`)
      still chains correctly.

## 8. Item 3 — arc-mode option labels (browser-only)

- [ ] The `#pdf-arc-mode` and `#gen-arc-mode` selects show the emoji option labels
      ("➕🔁 New + review vocabulary", "🏷🔤 Grammar + conjugation").
- [ ] Switch the **UI language** away from English: the options should re-render via
      `t()` (English fallback until the keys are translated — confirm no raw
      `form.arc_mode_*` key strings appear).

## 8b. New feature — drag-to-highlight chapter selection (browser-only)

Upload a PDF (or txt/md) so the chapters panel opens, then click **✏️ Highlight chapters**.

- [ ] The full extracted document text appears in a scrollable view with newlines/
      paragraphs preserved; below it an (initially empty) chapter list.
- [ ] **Drag-select** a passage → on release it gets a yellow highlight and appears in
      the list as "①  <snippet>  N w".
- [ ] Select several passages in any order — the list orders them by **document
      position** (top-to-bottom), not click order.
- [ ] Edge trimming: a selection that starts/ends in whitespace is trimmed; a
      whitespace-only drag adds nothing.
- [ ] **Overlapping** drags merge into one highlight; two **adjacent** drags stay
      separate.
- [ ] **✕** on a list row removes that chapter; **Clear all** empties it.
- [ ] **Use these as chapters (N)** replaces the chunk list with exactly your N
      selections (verify titles/word counts), returns to the chapter list, and a toast
      confirms. Then **Generate** runs the normal book pipeline over those chapters.
- [ ] **Back to chapter list** leaves the existing chunks untouched (no apply).
- [ ] Selecting then applying skips junk between passages (e.g. page numbers / headers
      left between two highlighted body sections are excluded from every chapter).
- [ ] Backwards drag (right-to-left / bottom-to-top) yields the same span as forward.
- [ ] Re-opening the editor after applying still works; **Drop document** (clear upload)
      resets the editor and hides the panel.

## 8c. Lesson editor — unsaved edits survive delete/move (browser-only, item 3)

Open a lesson's editor (✏️ on a lesson node), then **without saving**:

- [ ] Edit text in several entries (e.g. change two vocab targets and a sentence),
      then click 🗑 on a **different** entry → the edits you made are **still there**
      after the row is removed (previously they reverted).
- [ ] Same for the **↑/↓ reorder** buttons: pending edits survive the move.
- [ ] Editing the **lesson title/icon** then deleting an entry keeps the title/icon edit.
- [ ] Works across types: vocab, sentences, grammar, conjugation, synonyms, math.
- [ ] A save (💾) is still required to persist — closing without saving still drops
      the in-memory edits (expected).

## 9. Item 6 — rating labels (browser-only, quick)

Complete a lesson to reach the rating screen:

- [ ] Difficulty / fun / coherence tooltips show real words ("Too easy", "Just right",
      "Boring", "Very fun", "Incoherent", …) — no raw `rating.*` keys.
- [ ] The lesson-set screen with no topic shows "Lesson set", not `lesson.set`.

---

### If something fails
Capture the server console block for that step and the saved store entry
(`/tmp/live.json`). Most generation issues are visible as a `⚠ … failed — continuing…`
line plus the raw model output just above it.

## 10. TTS voice-quality warning (browser-only, item 1)

On the landing page, pick a target language under **I learn**, then look just below
the language selector:

- [ ] On a setup with a good voice (e.g. Chrome with Google voices) → **no** warning.
- [ ] On a setup with only robotic/espeak voices or none for that language (e.g.
      Firefox on Linux) → the amber warning appears with the question, a **Test, 1, 2, 3**
      button, and an Ecosia link.
- [ ] **Test, 1, 2, 3** speaks in the chosen target language's voice (numbers in that
      language). Switching **I learn** updates which voice is tested and re-evaluates
      the warning.
- [ ] The Ecosia link reads `speech output with <browser> in <OS>` with your actual
      browser/OS, and opens in a new tab.
- [ ] No premature flash: if voices load slowly, the warning shouldn't flicker on then
      off (it waits for `voiceschanged` / a 1.5 s settle).
- [ ] Appears the same way on the **static** `docs/index.html` build.
- [ ] Heuristic sanity: if it warns on a setup you consider fine (or vice-versa), note
      the voice list (`speechSynthesis.getVoices()`) — the robotic-name list / match
      logic may need tuning.

## 11. v45 batch — browser-verify-owed (this session)

Headless tests cover the logic; these need a real browser. The server-side pieces
(math count, ui.json reload, upload filename) are headless-verified and need no
browser check.

### 11a. Source-language grouping of the saved list
- [ ] Open the **library** with lessons in more than one source (home) language and
      "all languages" selected. Sections are grouped/ordered by **source** language
      (header shows the source flag/name), newest-first within each section.
- [ ] No repeated headers for the same source language.
- [ ] The target-language filter chip still filters as before (grouping ≠ filtering).

### 11b. Icon-only strings hard-coded (removed from ui.json)
- [ ] Flag buttons still show ⚐ / ⚑ (unflagged / flagged) on exercises and the story.
- [ ] The flagged feedback head shows ⚑; library title shows 📚; import button ⬆;
      continue-story buttons show ↪ (the inline lesson-set button still reads "↪ ↪",
      unchanged from before).
- [ ] Spot-check a non-English UI language — these glyphs render identically (they
      were icon-only in all 29 languages).

### 11c. Globe favicon
- [ ] The browser tab shows a 🌐 globe icon (app and the static `docs/index.html`).

### 11d. Lesson-row subtitle
- [ ] On a chapter/lesson-set page, each lesson row's subtitle shows useful info:
      arc lessons read e.g. "🔁 reinforce vocab · 🟡 Intermediate" / "➕ extend vocab · …";
      plain lessons show the difficulty (e.g. "🟢 Beginner").
- [ ] Lessons with neither mode nor a known difficulty fall back to the old per-type
      description (no blank subtitle).

## 12. word_forms lesson type (browser-verify owed)

Generation + validation are headless-verified (unit-word-forms, e2e-word-forms);
these need a real browser and ideally a real Ollama (qwen2.5:7b).

### 12a. Generate (real Ollama)
- [ ] On a topic with a story, add a **Word Forms** lesson (➕ → Word Forms). The
      job completes and a 🧩 lesson appears.
- [ ] Open the lesson JSON / editor: each item's `sentence` contains `___`, has 4
      distinct `choices`, a valid `correctIndex`, and a `translation`. The sentences
      are recognizably from the story (not invented).
- [ ] If the model returns junk, the server logs `Word-forms: N rejected` with
      reasons and retries up to 3× (or fails cleanly) — no malformed lesson saved.

### 12b. Play
- [ ] Playing the lesson shows the sentence with a visible blank, the translation
      hint, and 4 form choices.
- [ ] Selecting the original (story) word scores correct; a wrong form scores wrong
      and reveals the correct one. TTS speaks the correct form.

### 12c. Edit
- [ ] In the editor, the 🧩 lesson lists items with editable sentence / translation /
      4 choices and a ● radio marking the correct choice.
- [ ] Changing a field, moving the ● radio, or deleting an item then saving (💾)
      persists; reopening shows the change. The play side reflects the new correct
      answer.

### 12d. Labelling
- [ ] The lesson row shows "🧩 Word Forms" with the difficulty subtitle; the
      add-lesson dropdowns show a localized "Word Forms" entry (both the lesson-card
      and storyline-panel selects), in non-English UI languages too.

### 12e. Explanation field + grammar/conjugation hidden
- [ ] After answering a word_forms question (right or wrong), the feedback shows a
      short "💡 …" explanation in the source language.
- [ ] The editor shows an editable **Explanation** field per item; edits persist on save.
- [ ] The lesson-type pickers no longer offer Grammar or Conjugation: check
      #format-select and both add-lesson dropdowns (lesson-card + storyline panel).
- [ ] "All types" generation now produces standard + word_forms + synonyms +
      error_hunt (no grammar/conjugation).
- [ ] Existing grammar/conjugation lessons (from before) still play and edit fine,
      and re-generating a flagged one keeps its original type.

## 13. synonyms in-context rework (browser-verify owed)

Generation + sentence-attach + builder are headless-verified (unit-synonyms,
unit-syn-context, e2e-synonyms); these need a real browser / Ollama.

### 13a. Play
- [ ] Playing a synonyms lesson shows, per question, the base word inside a story
      sentence (base highlighted) with a "similar to / opposite to «word»" prompt and
      4 choices.
- [ ] Picking the correct synonym/antonym scores right; a distractor scores wrong and
      reveals the correct word. No distractor is itself a valid answer.
- [ ] Words with no story sentence (rare) still play — just without the sentence line.
- [ ] Reinforce-mode arcs draw the context sentence from earlier chapters where the
      word isn't in the current story.

### 13b. Editor
- [ ] Each entry shows 🗑 "delete entry", an editable Sentence field, and a ＋ button
      on Synonyms / Antonyms / Homophones that appends an empty row.
- [ ] Adding words (incl. a homophone), editing the sentence, and deleting a whole
      entry all persist on save (💾) and survive reopening.

### 13c. Labelling
- [ ] Synonyms badge/labels still read "🟢 Similar" / "🔴 Opposite" (reused entries),
      including in non-English UI languages.

## 14. learning arcs: bottom row + re-create-all (browser/Ollama-verify owed)

Backend + wiring are headless-verified (e2e-recreate, unit-recreate-ui); the UX and
real generation need a browser + Ollama.

### 14a. Storyline bottom row
- [ ] Open a storyline screen: a bottom row shows Continue / Download / Clear progress
      / Delete / 🔁 Re-create all lessons. Re-create + Continue hide when generation is
      unavailable (static build).
- [ ] Continue opens the continue-story flow from the last chapter; Download opens the
      export menu for the chain; Clear progress (after confirm) zeroes the storyline's
      progress bar; Delete removes the storyline.

### 14b. Re-create all lessons
- [ ] Click 🔁 Re-create all lessons, confirm. The button shows live step text while
      the job runs, then the screen refreshes.
- [ ] Each chapter's ORIGINAL lessons are still present but hidden (🫥 / hidden-node),
      and new lessons appear: a vocab gate per chapter + a reinforcement lesson from
      chapter 2 on. Hidden originals don't play (unless teacher mode).
- [ ] Re-create again: it re-hides and adds another fresh set (old ones stay hidden,
      not duplicated into play).

### 14c. Arc settings fused
- [ ] The PDF-upload and LLM-generate panels both show the single "🎯 Build a learning
      arc per chapter" label (one ui entry now), with the same vocab/grammar mode select.

## 15. remaining minors (browser-verify owed)

### 15a. Flag count on the edit pencil
- [ ] A lesson with QC suggestions and/or user flags shows a small red count next to
      the ✏️ pencil (not the 🔍 QC button). The count = QC-tagged + user-flagged items.
- [ ] Opening the editor and resolving flags lowers the count after save/re-render.

### 15b. Editors close on navigation
- [ ] Open a lesson editor, then navigate away (📖 storyline, 📚 another lessonset,
      🌍 home, or completing a lesson). The editor is closed when you return / arrive,
      not left hanging over the new screen.
- [ ] Same for the storyline in-screen title editor when leaving the storyline screen.

### 15c. Firefox TTS warning (the original report)
- [ ] On Firefox with poor speech (local speech-dispatcher/espeak voices), the TTS
      voice-quality warning now appears under the target-language picker (it didn't
      before). The "Test voice" button + the Ecosia search link show.
- [ ] On Chrome/Edge/Safari with a decent local or cloud voice, NO warning appears
      (no regression).
- [ ] On Firefox with a genuine cloud voice installed for the language, no warning.

## 16. chapter navigation cross-language fix (browser-verify owed)

- [ ] Open the de→en "Das kleine i" storyline. Each chapter's ← / → links stay within
      the German version: "8 oder ∞" now shows a → to "Die Wahrheit"; "Die Wahrheit"'s
      ← goes back to "8 oder ∞" (not into the French "La petit i" / "Zero").
- [ ] The French version "La petit i" navigates only among its own chapters; its first
      chapter shows no phantom "previous".
- [ ] Renaming a parent chapter still shows the current name on the ← link, and the
      links load the right chapter (by id).

## 17. word_form prompt + UI polish batch (browser/Ollama-verify owed)

### 17a. word_form generation quality (real Ollama)
- [ ] Distractors are real, correctly-spelled target-language words — no invented forms
      ("froont"), no words from the learner's own language.
- [ ] Exactly one choice fits; no ambiguous blanks where two forms both read correctly
      (e.g. present/past when the sentence doesn't force tense).
- [ ] The answer word does not also appear elsewhere in the sentence.
- [ ] Choice count varies (2–6) — fewer when the model has few good forms, not padded.

### 17b. word_form play + editor
- [ ] Playing a word_form lesson shows the sentence + choices with NO question header
      (filling the blank is self-evident); the 💡 explanation still shows after answering.
- [ ] In the editor, each choice has a ✕ to delete it and a ＋ to add one; deleting the
      correct choice re-points "correct" sensibly; saving persists.

### 17c. Hidden lessons
- [ ] Every lesson (not just AI error hunt) shows the 👁/🫥 hide/unhide button.
- [ ] After "re-create all lessons", the hidden originals can be unhidden via 👁, and
      hidden lessons don't appear in play (unless teacher mode).

### 17d. Flag count on the pencil
- [ ] On the chapter/storyline lesson list, the QC+user-flag count shows as a red number
      on the ✏️ pencil (it renders now — previously broken by escaping). The 🔍 QC button
      has no count there.

### 17e. Storyline bottom row + re-create options
- [ ] The storyline bottom row buttons are icon-only (↪ ⬇ 🧹 🗑️ 🔁), matching the
      chapter/library rows, with mouse-over titles.
- [ ] Clicking 🔁 opens an arc-mode picker (Vocabulary vs Grammar) before running;
      cancel/✕/backdrop aborts; the button shows ⏳ while generating.

### 17f. Navigation + favicon
- [ ] Intentional mixed-language storylines navigate end-to-end (no same-language guard).
- [ ] The browser tab icon is 🌍 (matches the in-app home icon), not 🌐.

## 18. cleanups + user-flagging editor side (browser/Ollama-verify owed)

### 18a. Arc reinforcement alignment
- [ ] Generating a book/arc with the "Word forms + synonyms" mode (formerly "Grammar +
      conjugation") produces word_forms + synonyms reinforcement lessons, not grammar/
      conjugation. The arc-mode label reads "Word forms + synonyms".

### 18b. User-flag correct version (editor)
- [ ] In the lesson editor, opening a flag box shows a comment field AND a "Correct
      version" field. Saving stores both.
- [ ] When a flagged item has a correct version, a green "You suggested: …" row appears
      with an apply button; applying writes it to the target, marks the item edited, and
      clears the flag (just like a QC fix).
- [ ] The flag count badge on the pencil still reflects user flags.

## 19. user flagging — play side (browser/Ollama-verify owed)

### 19a. Flag during play (live)
- [ ] Each exercise shows a ⚐ flag button; clicking it opens a comment + "correct
      version" form. Saving turns it ⚑ and (if already answered) the feedback shows the
      flagged note instead of scoring.
- [ ] The flag persists: reopen the lesson editor and the same item shows the user flag
      with the comment + correct version; applying the correct version fixes the target.
- [ ] Flagging a word_forms / synonyms question stores the flag (count rises on the
      pencil) even though those aren't yet editable in the editor flag box.
- [ ] A flag set in the editor shows as ⚑ when that item is played.

### 19b. Static build
- [ ] In docs/index.html (no server), flagging a question still works (no error); the
      flag is included when you export the lesson/topic JSON.

### 19c. Legacy system
- [ ] Story flagging (the whole-story ⚑) still works (it intentionally still uses the
      old flag storage); question flags no longer write to it.

## 20. flag UI in word_forms / synonyms editors (browser-verify owed)
- [ ] In a word_forms lesson editor, each item has a ⚑ flag button opening a comment +
      "correct version" box; saving marks the item flagged (red ⚑) and persists.
- [ ] Same for each synonyms word-group entry.
- [ ] A correct version shows as a green "you suggested: …" note (no auto-apply button
      for wf/syn, since there's no single target field).
- [ ] Editing fields and then opening/saving a flag does NOT lose the field edits.
- [ ] A flag set during play on a word_forms/synonyms question shows up here.

## 21. static teacher-mode editing (static-build browser-verify owed)
Build: `node build-static.js lessons.json docs` then open docs/index.html (no server).
- [ ] Non-teacher mode: lessons have NO edit affordances — no ✏️ pencil, hide, delete,
      reorder, no play-time ⚐ flag button. (Generate/QC/continue already absent.)
- [ ] Toggle 🔓 Teacher mode ON: the edit row appears on each lesson (✏️ hide 🗑 ↑ ↓),
      and the play-time ⚐ flag button reappears; the QC 🔍 button does NOT (LLM-only).
- [ ] Open the editor: item fields are editable; QC suggestions (it.qc) and existing
      user flags (it.userFlag, with comment + correct version) are visible; flagging,
      delete, reorder, hide all work without console errors (no /api 404 failures).
- [ ] Edit some items + add a flag, then Export (⬇ → JSON). The exported JSON reflects
      the edits and includes the flags (edits mutate STATIC_LESSONS by reference).
- [ ] Toggle teacher mode OFF again: all edit affordances disappear.
- [ ] Live build still behaves as before (editing always available; QC works).

## 22. follow-up batch (browser/Ollama-verify owed)
- [ ] word_forms (real model): translations are in the learner's language and are NOT
      the target sentence with the blank filled; explanation may be empty (no 💡 shown).
- [ ] Continue-story dropdown shows only same target+source-language stories unless
      "show other languages" is ticked (then cross-language entries are tagged).
- [ ] A LaTeX (LLM) math lesson opens in the editor and lists its exercises with flag +
      delete (no number-pool/regenerate controls); procedural math lessons still show them.

## 23. word_forms reliability with a weak model (Ollama-verify owed)
- [ ] Generating a word_forms lesson with a small model (e.g. qwen2.5:7b) now SUCCEEDS
      (previously failed all 3 attempts): duplicate choices get deduped, a missing ___
      blank is auto-inserted when the answer is in the sentence, and off-story sentences
      are accepted.
- [ ] Resulting items look sane: one correct form + at least one clearly-wrong form
      (often a verb in the wrong tense); translations are in the learner's language.

## 24. static story edit + chapter export (browser/visual verify owed)
- [ ] Static build, TEACHER MODE: the story ✏️ pencil appears; edit the story, hit 💾 —
      it saves (no "failed" message), the change shows, and it's included in a JSON
      export. In non-teacher static mode the pencil is hidden.
- [ ] HTML/Markdown chapter export: error_hunt and ai_error_hunt lessons now show their
      errors (wrong word struck through, correct word green), and each lesson shows a
      meta line (type · difficulty · reinforce/extend). word_forms/synonyms not empty.

## 25. static export (client) + storyline summary edit (browser verify owed)
- [ ] STATIC build, export a chapter to HTML/Markdown: ai_error_hunt (and error_hunt)
      now show their errors (wrong struck, correct green) — no longer empty lists.
- [ ] STATIC build, storyline page: the summary ✏️ pencil is HIDDEN without teacher mode;
      in teacher mode it appears, and clicking 💾 Save works (no "failed to fetch") and the
      edited summary persists in the session.
