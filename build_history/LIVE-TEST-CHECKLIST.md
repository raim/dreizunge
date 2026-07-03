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

## 23b. Major A — de word_forms example native review (review owed)
- [ ] **Review the German seed in `prompts.json` `wordForms.examples.de`** (added v46
      session 3). The headless suite only checks it is *structurally* valid via
      `validateWordFormsItems`; native/pedagogical quality is unverified. Confirm: the GOOD
      item (`Die ___ schliefen auf dem warmen Dach.` → `Katzen`) reads naturally and the
      plural is genuinely forced; the BAD item (`Sieben ___ den Kopf.`,
      `schüttelt`/`schüttelte`) is a fair ambiguity example; the English translation/
      explanation are good representative `{S}` content. Only the `de` prompt is affected;
      all other targets fall back to the (unchanged) English default.
- [ ] With a small model learning **German**, confirm the de example does not *worsen*
      output vs. the English default — compare `_genMeta` (attempts / rejected /
      rejectReasons) on a de word_forms generation with the seed vs. without. This is the
      A-phase-3 "measure first" gate before expanding to more languages / lesson types.

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


## 26. v46 session 1 — arc terminology fix + good-example rating (browser/Ollama-verify owed)
- [ ] Generate a multi-chapter storyline (live, real Ollama) with the learning-arc
      checkbox on and arc mode = "Word forms + synonyms": chapters >=2 must produce
      word_forms + synonyms reinforcement lessons, NOT legacy grammar/conjugation.
      Repeat via the PDF/book import arc path. (The headless guard only checks the
      request payload, not the generated lesson types.)
- [ ] Play a lesson, TEACHER/LLM mode: a star button (outline when off, filled gold when
      on) sits next to the flag button. Tapping toggles it and shows the toast; it
      persists across navigation. Works for vocab, sentence, word_forms and synonyms.
- [ ] Lesson editor: every item header shows the star next to the flag; toggling
      persists and the star reflects state on re-open. Confirm for synonyms (words) and
      word_forms (items) items specifically -- these now round-trip in the LIVE build
      (server merge fix), not just static.
- [ ] STATIC build: rate a few questions in teacher mode, export the JSON -- the
      userRating:{at} rides the export; re-import shows the stars. (No server in static,
      so persistence is via export, like flags.)
- [ ] node report-edits.js lessons.json --out report.html opens a readable activity log;
      spot-check that recent edits/flags/ratings appear newest-first.


## 27. v46 Bug #2 — storyline chapter locking (browser-verify owed)
- [ ] STATIC build (or live with teacher mode OFF), open storyline "La petite i"
      (sl_962481837): only the first chapter is unlocked; chapters 2..11 show the lock
      and open one-by-one as you complete each predecessor's lessons.
- [ ] Press "clear progress" on that storyline: all chapters except the first re-lock.
- [ ] Spot-check the other "little i" tellings (Das kleine i / La piccola i / Il piccolo
      io) lock the same way and that completing one language does NOT unlock another.
- [ ] Generate a fresh multi-chapter storyline; confirm chapters still chain/lock even if
      the model emits a broken continuedFrom (the renderer gap-fills from chapter order).


## 28. v46 Tier 2 (#7 + #11) — browser-verify owed
- [ ] TEACHER mode: in a chapter with several lessons, rate a few questions (⭐) and flag
      a couple (⚑), then play the chapter's "Mixed review (no AI)" lesson — the rated
      questions should appear preferentially and flagged ones should be rare/absent
      (only if needed to reach perType).
- [ ] Play a flagged question: a red "Flagged" banner shows its comment + suggested fix
      directly under the question, without opening the flag form. Unflagged questions show
      no banner. (Banner is teacher/edit-mode only.)


## 29. v47 — import Merge/Replace dialog (browser-verify owed)
Import a flag/edit submission JSON (a static "download & submit" export, or any file with
`exportedBy:"dreizunge-static-user"` / `mergeFlags:true`).
- [ ] A modal appears with **Merge** and **Replace** buttons (each with a one-line hint) plus
      Cancel — not a native OK/Cancel confirm.
- [ ] **Merge** applies only the submission's flags/ratings/deletes; your existing content is
      untouched (identity-matched, idempotent — importing twice changes nothing further).
- [ ] **Replace** overwrites the matching topics with the submitted version.
- [ ] **Cancel / Esc / click-outside aborts** the whole import (no silent full-replace).

## 30. v47 — Arabic/RTL + content-aware direction (browser-verify owed)
Use an **English→Arabic** lesson (e.g. import the "Yusuf and the Lost Cat" sample) so UI=LTR
but content=RTL. Then a **Hebrew** target, and (sanity) an Arabic **UI** session.
- [ ] en→ar: the **interface stays LTR** (nav, buttons, badges), but Arabic **content** is
      right-aligned — story text, question prompts that are Arabic, word-bank tokens, target
      boxes, read-the-story body.
- [ ] In a single en→ar MCQ where the **prompt is English** and the **choices are Arabic**:
      the English prompt is left-aligned and the Arabic choices are right-aligned (same card).
- [ ] Word-order (sentence ordering) for Arabic: tokens flow **right-to-left** (first word on
      the right) and each token's text is right-aligned.
- [ ] The storyline **summary** (English) is left-aligned while the **story** (Arabic) is
      right-aligned, in every place each is shown (in-lesson story tab, per-chapter expander,
      "read the full story", summary strip + after editing it).
- [ ] **Editing** flips by content: open the story editor / summary editor / paste boxes and
      type Arabic — the caret/text goes RTL; type English — LTR.
- [ ] Setting the **UI language to Arabic** mirrors the whole interface (document dir=rtl).

## 31. v47 — Japanese furigana (browser/Ollama-verify owed)
Paste a Japanese story with furigana, once as `<ruby>…<rt>…</rt></ruby>` HTML and once in
`漢字[かな]` bracket form; also generate a JA lesson with Ollama.
- [ ] Both paste forms import; furigana shows above kanji in play, and **katakana loanword**
      readings (e.g. ボール[ぼーる]) are kept.
- [ ] Sentence-ordering for JA-as-**target** splits into single kanji/kana words with each
      `BASE[reading]` group kept whole (a katakana group after a hiragana run is NOT merged).
- [ ] TTS speaks the base text, not the bracketed reading.

## 32. v47.x — muted listen fallback + sound-test + card mute (browser-verify owed)
- [ ] **Mute** (any 🔊 button) then start a lesson with **listen** questions:
      `listen_mcq` becomes a *read-the-target* MCQ (shows the word, pick the translation);
      `listen_type` becomes *translate-by-typing* (shows the source, type the target). No
      audio needed; scoring still works.
- [ ] Toggling mute **mid-question** on a listen exercise swaps the variant live (before it's
      answered).
- [ ] **Every question card** has a mute button in the bottom row next to Check; it stays in
      sync with the other mute buttons.
- [ ] **Sound-test popup**: the test phrase speaks **numbers only** (no "Test"); the old
      Ecosia "how to get better speech" link is replaced by **"If the sound is bad, you can
      mute it:"** + a working mute button.

## 33. Intro "learn the script" course — per-script tables (browser-verify owed)
LLM-free. The **🔡 Learn the script** option appears in the "➕ Add lesson" dropdown (lesson-set
card + storyline panel) **only** when the target uses a script the UI language doesn't, and a
table exists. Open/create a lesson set per target below, add the lesson, and play it.

- [ ] **en→ru / en→uk** (Cyrillic, 33): option appears; lesson plays (glyph↔sound MCQs +
      a few listen items). Confident — spot-check only.
- [ ] **en→ja** (Japanese): adds **two** lessons — **Hiragana** (46) and **Katakana** (46).
      Confident — spot-check only.
- [ ] **en→el** (Greek, 24): case pairs show (Α α …). NOTE the deliberate transliteration
      choice — η="ī", ω="ō" (macrons) to keep answers unambiguous since modern Greek merges
      η/ι/υ→"ee" and ο/ω→"o"; consonants use modern values (β=v, φ=f, χ=ch). Confirm this
      reads acceptably for your learners, or ask for a classical variant.
- [ ] **en→ar** (Arabic, 28): RTL; isolated letter forms; distinct academic transliterations
      (ت=t vs ط=ṭ, etc.). Glyphs/choices right-aligned. Confident, but a native eye is welcome.
- [ ] **en→he** (Hebrew, 22): RTL; 22 base consonants (final/sofit forms taught with the base
      letter, not separate; b/v-style dual pronunciations show one value). **Worth a native
      check** of the transliterations.
- [ ] **en→ko** (Hangul, 24): 14 consonants + 10 vowels, Revised Romanization, base values.
      **PLEASE VERIFY WITH A KOREAN SPEAKER** — positional consonant variants (ㄱ g/k, ㄷ d/t,
      ㅂ b/p, ㄹ r/l) are simplified to one value and **ㅇ** (silent initial / "ng" final) is
      labeled "ng". Highest-uncertainty table.
- [ ] **en→th** (Thai): the option should **NOT** appear — Thai is intentionally left
      unfilled (44 consonants with many shared sounds + positional vowels + tone classes need
      a purpose-built design, not a flat letter→sound table).

### 33a. Intro MCQ wiring + listen items + multi-script titles (v47.x fixes — browser-verify)
- [ ] **No answer-revealing question:** the **sound→glyph** question shows the *romanization*
      (e.g. "gh (ghayn)") and asks you to pick the letter — it must NOT show the glyph itself
      with a "tap to listen" block (the old bug: "What does غ mean?" showing غ + listen + glyph
      choices, i.e. pick غ from غ). The **glyph→sound** question shows the letter, choices are
      romanizations. Neither MCQ has a listen block.
- [ ] **Existing lessons auto-heal:** a script lesson added by an older build now renders the
      corrected questions (exercises are re-derived from the letter table on play, not from the
      stale baked `exercises`). No need to delete/re-add the lesson.
- [ ] **Two-script languages (ja):** the two lessons read **"🔡 Hiragana"** and
      **"🔡 Katakana"** in the chapter/path view (not two identical "Learn the script" rows).
- [ ] **Listen item hides the glyph:** in the "tap to listen" question (a separate item type),
      the spoken letter is NOT shown — you rely on audio to pick the glyph.
- [ ] **No-voice device skips listen items:** with **no installed voice** for the target (e.g.
      Arabic with no ar voice) the lesson has **no "tap to listen" questions** (only the two MCQ
      directions). You do NOT need to press mute to avoid them.
- [ ] **Muted fallback:** mute, then play — listen questions become "Which letter makes the
      sound '…'?" (shows the transliteration, pick the glyph), never revealing the answer.

### 33b. Content-aware script lessons (v47.x)
- [ ] **Only scripts present in the set are added.** Open a Japanese set whose content has **no
      katakana** (only hiragana + kanji) and add the script lesson → you get **only a Hiragana**
      lesson, not Katakana. A set that contains a katakana word (e.g. ボール) → **both**. A brand-
      new/empty set → falls back to all of the language's scripts.
- [ ] **reinforce / extend are storyline-aware.** On a chapter that continues a story (so the
      🔁reinforce/➕extend selector shows): **reinforce** builds a lesson of the letters introduced
      in **earlier chapters** (review, title "· review"); **extend** builds the letters that are
      **new in this chapter** and weren't in earlier chapters (title "· new letters");
      **neutral** teaches the full alphabet. The **first** chapter (no prior) falls back to the
      full alphabet for reinforce/extend (nothing to scope from). Each falls back to the full
      alphabet if fewer than 4 letters would be in scope. The 🔁reinforce/➕extend selector now
      appears for `intro_script` (and the vocab-style formats) on a **continued** chapter, and is
      **hidden for Math** and for non-continued sets (where reinforce/extend have no prior
      chapters to scope against). Switching the format dropdown shows/hides the row live.
- [ ] **Length scales with difficulty.** A script lesson quizzes a *subset* of letters, not the
      whole alphabet: 🟢≈8, 🟡≈12, 🔴≈16 letters (set via the add-lesson difficulty). Noticeably
      shorter than before, but wrong-answer choices still include letters from across the whole
      alphabet (not just the quizzed subset).
- [ ] **Play length is capped too.** When you *play* a script lesson you answer only ≈8/12/16
      questions (matching the difficulty), not ~2×letters+5 — even though each letter generates
      both MCQ directions plus listen items. Replaying the same lesson gives a different random
      subset. (Script lessons only; other lesson types still play all their questions.)
- [ ] **Result card handles script lessons.** Finishing a script lesson: the completion card's
      "Words from this lesson" box shows the **letters** covered (glyph + sound), not an empty box;
      and if a script lesson is the next one, the **Next** button names it (e.g. "→ 🔡 Arabic"),
      not "→ Vocabulary". A hidden next lesson is skipped (static mode). (Same fix gives word_forms
      and synonyms lessons their items/words on the card.)
- [ ] **Script lessons are editable.** Open a script lesson's ✏️ editor: each **letter** shows
      its glyph (read-only) and editable fields (Name, Sound, IPA), plus ↑↓ reorder, 🗑 delete,
      ⚑ flag, and ⭐ star — same as vocab. Edit a transliteration / reorder / delete a letter,
      save, replay: the quiz reflects the change (exercises rebuild from the edited letter table).
      The glyph itself can't be typed over. The "⚑ only" filter shows just flagged letters. In the
      static build, delete marks a letter as a delete-candidate (rides the export).

### Languages to externally verify (summary)
- **Korean (Hangul)** — primary: get a native speaker to confirm jamo sounds / ㅇ / positional consonants.
- **Hebrew** — secondary: confirm the 22 transliterations and that base-only (no sofit) is acceptable.
- **Greek** — confirm the modern-value + macron-disambiguation choice suits your learners.
- Cyrillic / Japanese kana / Arabic — high confidence; spot-check only.

### 33c. Arc-integrated script lessons (Plan B — needs Ollama to verify end-to-end)
Generate a **multi-chapter** story for an en→non-Latin target (e.g. **en→Arabic**) with the
learning **arc** enabled.
- [ ] A **"🔡 Teach the script per chapter"** checkbox appears under the arc toggle **only** for
      a target whose script differs from the source (en→ar yes; en→it no), and only for >1 chapter.
      Default checked.
- [ ] With it on, **each generated chapter** has a **🔡 script lesson prepended** (plays FIRST,
      before the vocab/word-form/synonym lessons).
- [ ] The prepended lesson is **extend mode**: chapter 1 introduces the alphabet seen so far;
      each later chapter's script lesson covers **only letters new to that chapter** (not repeating
      letters taught in earlier chapters). Letter count respects difficulty (≈8/12/16).
- [ ] A chapter that introduces **fewer than 4 new letters** gets **no** script lesson (nothing to
      teach) rather than an empty one.
- [ ] Unchecking the box (or en→Latin target) generates **no** script lessons — vocab/arc only.
- [ ] PDF-import multi-chapter flow: script primer is added automatically for differing-script
      targets (no separate checkbox there).

### 34. QC for synonyms + word_forms (Plan C — needs Ollama to verify the prompts)
Run QC (the ⚙ QC action) over a topic containing a **word_forms** and a **synonyms** lesson.
- [ ] **word_forms**: items with a wrong marked-correct option, a distractor that also fits, a
      mismatched translation, or a bad explanation get a 🟧 QC note in the editor describing the
      problem; clean items get none. The note is read-only (no one-click fix) with a ✕ dismiss.
- [ ] **synonyms**: entries with a wrong gloss, a non-synonym in the synonyms list, a bad antonym,
      or a wrong homophone get a QC note; clean entries get none.
- [ ] **intro_script** lessons are NOT flagged by QC (curated data — use the per-letter flag/edit).
- [ ] Re-running QC on a now-corrected item clears its earlier QC note.
- [ ] The lesson's flag badge counts QC notes on `items`/`words` (not just vocab/sentences).

### 35. No-keyboard → glyph ordering (browser-only)
For a target you can't type (e.g. en→Arabic), in a lesson with type-the-target questions:
- [ ] A **⌨️ keyboard button** sits next to the 🔊 mute button in the question's bottom row;
      hovering shows "press this if you don't have the right keyboard for this language…".
- [ ] Press it (button highlights). A **type-the-target** question (listen-and-type, type the
      plural, type the conjugation) becomes a **letter-ordering** exercise: tap the target's
      letters into order, like sentence ordering but per-glyph. Correct order → ✅, wrong → ✗.
- [ ] **Arabic diacritics stay attached**: قِطَّة offers letters like قِ / طَّ / ة as single tiles
      (a consonant with its harakat is one tile), not bare vowel marks.
- [ ] **Japanese furigana stripped**: a JA type-the-target like 猫[ねこ]が好[す]き offers tiles
      猫 / が / 好 / き — the kanji/kana base only, never bracket characters or the reading kana
      (which would reveal the pronunciation).
- [ ] Toggling it **mid-question** (before answering) swaps a typing question to/from ordering.
- [ ] It **persists** across reloads (stored locally). MCQ / word-order / listen-MCQ questions are
      unaffected — only type-the-target questions change.
- [ ] Muted **and** no-keyboard together: a muted listen-and-type question shows **letter ordering**
      (not the type-by-translation fallback).

### 36. Bug fixes — QC button coverage + hidden lessons in static mode
**QC button on more lesson types** (live, needs Ollama):
- [ ] The per-lesson 🔍 QC button now appears on **word_forms** and **synonyms** lessons (not just
      vocab/sentences). It does NOT appear on intro_script (human-QC) or math. Still hidden when
      there's no backend (static).

**Hidden lessons in static (non-teacher) mode** (browser-only — build the static docs and open
without a backend):
- [ ] A lesson hidden (🫥) in teacher mode does **not appear** in the learner's path in static mode.
- [ ] It does **not block progress**: the lesson after a hidden one is reachable once the real
      previous (visible) lesson is done — the hidden lesson no longer locks it.
- [ ] Progress bar can reach **100%** and the **story unlocks** with a hidden lesson present
      (hidden lessons don't count toward the total).
- [ ] In **teacher/live** mode the hidden lesson still shows (greyed 👁/🫥 toggle) and can be unhidden.
- [ ] Normal locking still works: a non-hidden undone lesson still locks the next one in static mode.

### 37. Batch fixes (v47.x) — mixed-as-progression, hidden-leak, script audio, static storyline read
- [ ] **BUG: hidden vocab no longer leaks (B).** In a topic with a hidden vocab lesson and a visible
      one, playing the visible lesson must NOT show review questions drawn from the hidden lesson's
      vocab. (Was: the cross-lesson review pool ignored hidden lessons.)
- [ ] **Mixed-as-progression (B).** In a set that contains a `mixed` lesson, non-teacher mode shows
      ONLY the mixed lesson(s); all other lessons are hidden, and the mixed lesson pools its
      questions from them. Progress/100%/story-unlock is driven by the mixed lesson. Teacher mode
      still shows every lesson.
- [ ] **Script audio says the letter, not the romanization (B).** In an Arabic script lesson, the
      feedback after a glyph→sound question speaks the Arabic letter (in the Arabic voice), not the
      transliteration read letter-by-letter ("d-h"/"g-h").
- [ ] **Static storyline "read the full story" works (B).** On the storyline screen in a static
      build (no server), expanding "read the full story" shows the chapters' text (pulled from the
      static bundle), instead of "⚠ Could not load".
- [ ] **Always-on speech test button (B).** The main form shows a 🔊 voice-test button below the
      language selectors at all times (not only when a voice problem is detected); it tests the
      currently-selected target language.

### 38. Hindi / Devanagari script lessons (browser-only)
- [ ] **en→hi** offers a 🔡 script lesson. It quizzes Devanagari glyphs (44: 11 vowels + 33
      consonants), consonants shown with the inherent vowel (क = "ka"). Recognition only — it does
      NOT teach matras (vowel signs) or conjuncts. The IAST romanizations want a native check.

### 39. ui.json cleanup + read-story SyntaxError fix
- [ ] **ui.json sanity (no wrong scripts).** The shipped ui.json has no cross-language contamination
      (e.g. no Chinese in the Korean block, no Cyrillic in Arabic). Corrupted values were removed and
      fall back to English. The dropped values are listed in `build_history/ui_translation_flags.txt`
      for re-translation (TranslateGemma).
- [ ] **Read-story no longer throws (B).** On the storyline page, clicking "read story" on a chapter
      whose title contains an apostrophe / quote / special character now works every time — no
      `Uncaught SyntaxError: missing ) after argument list` in the console, no dead clicks.
- [ ] **Continue-story button** on such chapters also works (same escaping fix).

### 40. Error-hunt RTL (B)
- [ ] **Arabic error-hunt renders RTL.** Play an Arabic 🔍 Error Hunt lesson: the corrupted story
      reads right-to-left (first word on the right), tokens flow correctly, marking still works.
      Same for an Arabic 🔎 AI Error Hunt. In the editor, the error-hunt diff preview is also RTL.

### 41. v49 (B) — order-exercise RTL keyed to the opened lesson
Root cause fixed: `html.tgt-rtl` was keyed off the **generation-form** target (`APP.lang`),
so an en→ar topic opened from the library while the form sat on another target rendered its
word banks LTR. `goLessonSet` now syncs the target render context to the opened lesson and
refreshes the direction flags; `_restoreFormLang` restores them on the way back.
Use **en→ar** topics **without changing the form's target language first** (this is the case
the old code got wrong — pick Arabic topics straight from the library/globe view).

- [ ] **Sentence-ordering (Arabic), sound + keyboard ON.** Open an en→ar topic (e.g. the
      "Yusuf laughed when he found Lulu." sentence-ordering lesson in
      `tp_17825603173750001401`). Tokens flow **right-to-left** (first word on the right) and
      each token's text is right-aligned. The interface chrome stays LTR.
- [ ] **Word-ordering (Arabic), sound + keyboard OFF** (the glyph-ordering variant that
      appears in that mode). Same RTL flow — first glyph group on the right.
- [ ] **No form contamination.** After returning to the landing page from that Arabic lesson,
      the generation form's target selector and the direction of the form itself are **back to
      whatever they were** (open a de→en or en→es lesson next and confirm it renders LTR — the
      Arabic override did not stick).
- [ ] **Regression:** an en→ar lesson opened *after* explicitly selecting Arabic in the form
      still renders RTL (the primary `tgt-rtl` switch still wins).

### 42. v49 (B) — word_forms + synonyms Arabic alignment
The cloze sentence and the synonyms context/gloss/tiles were built outside the v48
content-aware model and left-aligned for Arabic. They now carry `dir="auto"` + `text-align:start`.

- [ ] **word_forms (Arabic).** Open the word-forms lesson in `tp_17825482570940000685`. The
      sentence with the `___` blank is **right-aligned** and reads RTL; the blank sits in the
      correct position within the Arabic sentence (not forced to the left edge).
- [ ] **synonyms (Arabic).** Open the synonyms lesson in the same topic. The context sentence
      and its gloss are right-aligned; the selectable synonym **tiles** each show their Arabic
      text right-aligned. An English gloss/hint in the same card stays left-aligned.
- [ ] **Mixed card sanity:** where a word_forms/synonyms card pairs an English prompt with
      Arabic content, the English part stays LTR and the Arabic part is RTL (per-element, same card).

### 43. v49 (B) — always-on compact sound-test row
Replaces the old warning box that only appeared when the voice heuristic judged voices bad.
On the **generation form**, with a **concrete target language selected** (not the globe/"all"):

- [ ] A single compact row is **always** shown on **one line**, positioned **under the
      "I learn" (target) column** on the right (not spanning full width). It reads:
      **"Test"** + the tested language's **flag** (no language name, no "sound" words) ·
      the **🔊 1, 2, 3** test button · **"Bad? Mute:"** · the **mute** button.
- [ ] The long "Does your browser support nice speech synthesis?" question is **gone**; the row
      no longer depends on the voice-quality heuristic (shows even when voices look fine, and
      even before voices finish loading).
- [ ] **Test** speaks the numbers ("1, 2, 3") in the selected target language.
- [ ] **Changing the target** language updates the flag shown in the row (it always
      reflects the currently-selected "I learn" language).
- [ ] **Hovering the 🔊 1, 2, 3 button** shows a tooltip explaining what the test is for
      ("Does your browser support nice speech synthesis?…", the reused `tts.voice_warn_q`),
      localized to the UI language.
- [ ] **Hovering the mute button** shows "If the sound is bad, you can mute it:" (the reused
      `tts.voice_mute_hint`), localized — and this tooltip **persists** after toggling mute
      (it isn't overwritten by the generic Mute/Unmute label that other mute buttons show).
- [ ] The row's **mute button** toggles global mute and stays in sync with every other mute
      button (toggle mute elsewhere → this icon flips too, and vice-versa).
- [ ] With the target selector on the **globe ("all")**, the row is **hidden** (nothing to test).
- [ ] No **second** stray "1, 2, 3" button appears anywhere on the form (the old standalone
      button was removed).

### 44. v49 (B) — lowercase title + "we are the world" motto
- [ ] The landing header reads **"dreizunge"** (lowercase), and the **browser tab title** is
      lowercase too.
- [ ] Below the title, instead of the version number, the localized motto **"we are the world"**
      (`app.motto`) shows, slightly larger than the old version text. In non-English UI it appears
      in the UI language once the TranslateGemma pass fills `app.motto` (English fallback until then).
- [ ] The running **version** is still reachable: hover the motto → its tooltip shows the build
      (e.g. `v48` in the static build, the server's version when running against the server).

### 45. v49 (B) — QC skips already-checked, unedited lessons
Bulk QC (storyline 🔍 and topic 🔍) now skips lessons that passed a clean full QC pass and
haven't been edited since (`ls.qcAt` stamp). Explicit single-lesson QC and flagged-only runs
always re-check. Needs Ollama (translation model).

- [ ] **First storyline QC** on a fresh multi-chapter book: watch the server console — every
      lesson is checked; the result toast shows `… checked` with **0 skipped**.
- [ ] **Immediately QC the same storyline again**: console shows `⏭ skip …` for each clean
      lesson; the toast shows a **"N skipped (already checked)"** segment and `0 checked`
      (or only newly-added/edited lessons checked). Much faster.
- [ ] **Edit a lesson's content** (change a vocab source or a sentence, via the lesson editor)
      then re-run storyline QC: **that lesson is re-checked** (console shows a stamp-cleared
      line on save, and it's no longer skipped); its untouched siblings are still skipped.
- [ ] **Pure flag/star with no content change**: flag an item (⚑) or star it, save, then re-run
      storyline QC — the lesson is **still skipped** (flag/rating changes don't invalidate the
      QC pass; only content does).
- [ ] **Edit the story text** on a topic that has an Error Hunt / AI Error Hunt lesson, then
      re-run QC — those story-derived lessons are re-checked (stamp cleared on story save);
      other lessons stay skipped.
- [ ] **Single-lesson 🔍** (the per-lesson button in the editor) always re-checks, even a
      skipped/clean lesson (never counts as skipped).
- [ ] **A lesson that gets flagged** during a pass is **not** marked clean — re-running QC
      checks it again (it never gets the skip stamp until it comes back clean).
- [ ] **New generated book**: the automatic post-generation QC still runs a full pass and
      stamps the fresh lessons (so the *next* manual QC on that storyline skips them).
- [ ] **Force re-check (shift-click).** Hold **Shift** and click a storyline/topic 🔍 button:
      every lesson is re-checked regardless of its stamp (console shows no `⏭ skip` lines),
      and the toast includes a **"forced full re-check"** segment. A plain click still skips
      clean lessons. The two bulk 🔍 buttons' tooltips mention the shift-click affordance.
      (Useful after tuning the QC prompt, which doesn't change lesson content.)
