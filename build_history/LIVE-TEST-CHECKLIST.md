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

### 46. v49 — QC coverage: grammar + conjugation lessons
These two types were previously getting no QC at all. They're now checked (translation pair) and
flags render in their editor branches. Needs Ollama.

- [ ] **Grammar lesson QC.** Run QC on a topic containing a 🏷️ grammar lesson (e.g. a German
      noun list). The translation pair (target ↔ source) is checked; a bad gloss produces a flag
      that shows as an orange "suggests…" note under that grammar row in the editor, with a ✕ to
      dismiss. The lesson's flag badge count includes it.
- [ ] **Conjugation lesson QC.** Same for a 🔤 conjugation lesson: the infinitive ↔ source
      translation is checked; a flag renders under the conjugation entry and dismisses cleanly.
- [ ] **Article/plural and per-form NOT auto-flagged.** Confirm the QC doesn't (yet) flag purely
      grammatical issues (wrong article/plural, wrong conjugated form) — that's future work, and a
      weak model shouldn't be inventing such flags here. Watch for false positives on the
      translation check itself and thumbs-down / tune the prompt if needed.
- [ ] **Skip + edit-invalidation still hold for these types.** After a clean QC pass, a grammar/
      conjugation lesson is skipped on the next bulk run; editing its target/source/article/plural
      (grammar) or infinitive/source (conjugation) makes the next bulk run re-check it.

### 47. v50 Commit B — coverage-based progression (mixed-driven sets)
Only affects a **mixed-driven set** (non-teacher, a visible 🔀 mixed lesson present). Uses the
Commit A solved store. Locked-path sets and teacher mode are unchanged. Browser-only.

- [ ] **Coverage bar replaces lesson-count bar.** Open a topic that has a visible mixed lesson
      (as a learner, not teacher). The set progress bar/text shows **"N of M solved · P%"**
      (questions), not "x/y lessons". It starts low and climbs as you answer questions correctly.
- [ ] **Per-lesson coverage chip.** The mixed lesson node shows a **📊 N/M** chip (questions
      solved / total in the set). It goes up as you solve new questions.
- [ ] **Unsolved-first rounds.** Play the mixed lesson repeatedly. Early rounds are dominated by
      questions you haven't solved yet (~70%); once most are solved, rounds shift toward review.
      A short round doesn't keep re-asking the same already-solved items while unsolved ones wait.
- [ ] **Solving is durable across reshuffles.** Answer some questions correctly, leave, come back:
      the coverage count/percentage persists (it's per-question, not per-play), and the same
      underlying question counts as solved even though the round is reshuffled.
- [ ] **Story unlocks by coverage, not one pass.** In a mixed-driven set the story now unlocks
      when coverage reaches the target (default 100%), NOT after a single once-through of the mixed
      lesson. Confirm the story stays locked at partial coverage and unlocks at full.
- [ ] **Flagged questions don't block 100%.** If some source items are flagged (⚑ or QC), they're
      excluded from the denominator — you can still reach 100% coverage without them.
- [ ] **Editing content updates the denominator.** As a teacher/editor, add or edit items in a
      sibling lesson, then return to the path: the set's M (total) reflects the change (the
      coverage universe is recomputed after an edit).
- [ ] **Clear progress resets coverage.** Clearing progress for the topic/storyline resets the
      solved count to 0 and re-locks the story.
- [ ] **Locked-path sets unaffected.** A topic with NO mixed lesson still shows the classic
      lesson-count progress and per-lesson completion — no coverage bar or chip.

### 48. v50 — mixed lesson hides only the lessons it reviews (not later ones / error hunts)
Refines the mixed-driven visibility rule. A mixed lesson pools from and hides only the lessons
that come BEFORE it; the mixed lesson, error-hunt "final test" lessons, and any lessons placed
AFTER the mixed lesson stay visible and playable. Browser-only (learner / non-teacher mode).

- [ ] **Earlier lessons are hidden, mixed shows.** Open a set authored as: vocab / grammar /
      … → 🔀 mixed → 🔍 error hunt. As a learner, the earlier vocab/grammar nodes are gone
      (folded into the mixed lesson), and the mixed lesson node shows.
- [ ] **Error hunt stays as a final test — in ANY position.** A 🔍 error hunt or 🔎 AI error hunt
      is visible and playable whether it was generated AFTER **or BEFORE** the mixed lesson. The
      mixed lesson never draws its questions from an error hunt, so it never hides one. (Regression
      check: an AI error hunt generated *before* the mixed review must still show.)
- [ ] **A lesson added AFTER the mixed lesson stays visible.** Add any lesson (e.g. a new vocab
      or grammar lesson) after the mixed lesson; as a learner it appears as its own node and is
      playable — it is not pooled into the mixed lesson and not hidden.
- [ ] **Mixed round doesn't quiz later content.** Playing the mixed lesson only asks questions
      from the lessons BEFORE it — never from a lesson placed after it (those are separate).
- [ ] **Story unlock needs both.** In such a set the story unlocks only when the mixed practice
      reaches coverage AND the surviving follow-on lessons (error hunt + any later lessons) are
      completed — not on coverage alone, and not after a single mixed pass.
- [ ] **Teacher mode unchanged.** In teacher/edit mode every lesson (earlier, mixed, later, error
      hunt) is visible and playable as before.
- [ ] **No mixed lesson → classic path.** A set with no mixed lesson behaves exactly as before
      (all lessons visible, lesson-count progress).

### 49. v50 — learned-vocabulary ledger + "my story" option (foundation)
The app now accumulates learned words across lessons (foundation for user-specific generation).
The generator isn't wired to it yet — this checks the plumbing and the selector option.

- [ ] **New-story label localized.** In the generation form, the "continue story from" selector's
      first option reads the localized "— new story —" (from `form.new_story`) — same text as
      before, now translatable.
- [ ] **"My story" appears after learning.** With a fresh profile, the ✨ "my story" option is
      NOT shown. Complete a few lessons (≥8 distinct words for the current target/source pair),
      return to the form: a `✨ my story (from what I've learned)` option now appears in the
      selector.
- [ ] **"My story" is honest (not yet wired).** Selecting ✨ my story and pressing Generate shows
      a "coming soon" toast and does not start a broken generation. (Normal "new story" and
      "continue from <saved>" still work.)
- [ ] **Per-language.** The learned count is per target+source pair — switching the form to a
      different language pair you haven't studied hides the ✨ option again.
- [ ] **Result card unchanged.** The lesson result card still shows the learned words as before
      (the ledger capture is silent/background).

### 50. v50 — "my story" generation (hybrid option i): story-seed + reinforce-as-context
Needs Ollama. Generates a story from the learner's cumulated vocabulary; the story reuses those
words and the lessons reinforce them. **Prompt/story QUALITY needs live tuning — expect to iterate
on the wording in server.js (`storyUserMsg` fromLearned branch).**

- [ ] **Option → generation.** After learning ≥8 words for a pair, select ✨ "my story" in the
      "continue story from" selector and press Generate (no topic needed). It starts a real
      generation job (not a "coming soon" toast).
- [ ] **Story reuses known words.** The generated story visibly reuses words the learner has
      already studied for this pair (not random new vocabulary). It reads at an easy level.
- [ ] **Wrong words emphasized.** Words the learner previously got WRONG are favoured — both in
      the story and reinforced through the lesson sentences (reinforce-as-context: woven into
      sentences, per the existing reinforce mode). Verify a couple of known-hard words appear.
- [ ] **Synthesized topic.** The saved set gets an auto title like "My review — <Language> (date)"
      (no crash from the missing topic). Generating again the same day makes a fresh one (force-
      regenerate, not a cache hit).
- [ ] **Lessons build normally.** The result is a normal lesson set (vocab/sentences/etc.) — the
      whole downstream pipeline is unchanged; only the story seed + reinforce vocab differ.
- [ ] **Empty-ledger guard.** If somehow selected with too little learned vocab, it shows the
      "coming soon" toast instead of sending a broken request. (Normal "new story" / "continue
      from <saved>" still work unchanged.)
- [ ] **Quality pass (owed).** Judge whether the story is coherent and the reused words feel
      natural; if the weak model ignores the word list or produces stilted prose, tune the
      `fromLearned` prompt in server.js and re-test.
- [ ] **Vocab-mode selector controls my-story.** With ✨ my story selected, the 🔁 reinforce /
      ○ neutral / ➕ extend selector is shown and NOW takes effect (v50.x):
      - **🔁 reinforce** (default): the story reuses learned words and the lessons weave them into
        sentences (context).
      - **➕ extend**: the story uses learned words as a base but introduces NEW vocabulary, and
        the lessons focus on fresh words rather than re-listing the known ones.
      - **○ neutral**: the story is still seeded from learned words, but the lessons are built
        purely from the generated story (no forced weaving of the known words).
      Confirm switching the selector visibly changes the generated result accordingly.

### 51. post-v50 — Dialect glossary import (M1): the "🗣 Dialect" panel
Needs the local backend (import is a backend op; the panel is inert in the static build). Turns a
pasted/uploaded glossary into faithful vocab lessons, no AI.

- [ ] **Toggle reveals the panel.** On the generation screen, ticking "🗣 I have a dialect glossary"
      hides the normal topic/generate form and shows the dialect panel (name, paste box, upload,
      attribution, "Build dialect lessons"). Unticking restores the normal form.
- [ ] **Paste + build.** Paste a glossary as `dialect = standard` lines (e.g. `Gitsche = Mädchen`),
      give it a name (e.g. "Osttirol"), press Build. A success toast appears and the new dialect
      topic shows up in the saved lessons list.
- [ ] **Upload works.** The 📎 Upload button loads a .txt/.csv glossary into the paste box and
      prefills the name from the filename.
- [ ] **Plays as normal vocab lessons.** Open the new dialect topic — it plays as ordinary vocab
      lessons (dialect word → standard word). The dialect words appear EXACTLY as typed (nothing
      auto-corrected).
- [ ] **Parse report surfaces problems.** If the glossary has a glued/malformed row (e.g. a PDF
      artifact like `Mangale = Männchen, kleiner MannFock = Schwein`), the report lists it as
      suspicious with its line number — and it is NOT auto-split (you fix the source and re-import).
- [ ] **Attribution kept.** The attribution/source text entered is stored with the topic (surfaces
      per ATTRIBUTIONS.md; verify it rides along on export).
- [ ] **QC respects the dialect (needs Ollama).** Running QC on a dialect lesson never suggests
      changing the dialect word — only the standard-word gloss can be flagged (sourceOnly).
- [ ] **Validation.** Building with no name, or no glossary text, shows a helpful toast rather than
      erroring.

### 52. post-v50 — Dialect approximate voice (M1 final)
Dialect words have no native voice, so they're spoken with the base-language (German) voice and
labelled approximate.

- [ ] **Approximate label on dialect audio.** In a dialect lesson's listen exercises (🔊 listen-MCQ,
      listen-and-type), the badge reads "≈ German voice (approximate)" — making clear the audio is a
      German approximation of the dialect, not an authentic dialect voice.
- [ ] **Dialect words are actually spoken (German voice).** Pressing 🔊 on a dialect word reads it
      aloud using the German TTS voice (best-effort pronunciation).
- [ ] **Non-dialect German unaffected.** A normal (non-dialect) German lesson does NOT show the
      approximate label when using the native German voice — only dialect content does.

### 53. post-v50 — Dialect AI example sentences (M1.5, opt-in, review-gated)
Needs Ollama. Off by default; the model's first authored dialect content, so it's marked and
review-gated. **Quality needs live tuning — expect to iterate on the prompt in server.js
(generateDialectExample).**

- [ ] **Opt-in only.** In the "🗣 Dialect" panel, the "🤖 Also suggest AI example sentences" box is
      UNCHECKED by default. Importing without it produces NO AI sentences.
- [ ] **Generates on import when ticked.** Tick the box, import a glossary → after the vocab import,
      a job runs and adds a "🤖 … AI example sentences (review)" lesson to the topic.
- [ ] **Uses the glossary words.** The generated sentences reuse the imported dialect words and
      mimic their spelling (few-shot grounded). Each sentence contains the word it was made for
      (off-target ones are dropped).
- [ ] **Clearly marked for review.** The lesson title says "(review)" and the sentences are AI-
      suggested — verify they read as unverified suggestions, not authoritative content.
- [ ] **QC checks BOTH sides (needs Ollama).** Running QC on the AI-examples lesson can flag the
      dialect side too (full pair QC), unlike the imported vocab (sourceOnly) — because the model
      authored these, so the dialect text is not ground truth.
- [ ] **Quality judgement (owed).** Read the generated sentences with a native/near-native eye:
      are they plausible dialect, or fluent hallucinations? If poor, tune the prompt and re-run.
      Do NOT promote to trusted content without review.

### 54. post-v50 — Dialect story generation (M2, GATED behind human curation)
Needs Ollama. Highest-risk piece: the model authoring dialect prose. Gated so it's impossible until
a human approves the dialect. **Approving is a deliberate review act — read the sample first.**

- [ ] **Studio appears on dialect topics.** Opening a dialect topic's lesson set shows the amber
      "🗣 dialect studio" strip (suggest examples / approve / generate story). It does NOT appear on
      normal topics.
- [ ] **Story is blocked before approval.** With a freshly imported dialect (not approved), the
      "📖 Generate dialect story" button is disabled; forcing it returns a 403 / "not approved" msg.
- [ ] **Approval requires reviewed samples.** "✅ Approve for story generation" is disabled until AI
      example sentences exist. Generate examples, review them, THEN approve — approval without any
      sample output is refused.
- [ ] **After approval, story generates.** Once approved, "Generate dialect story" produces a short
      dialect story (few-shot grounded in the glossary), stored on the topic and shown in the story
      area — marked AI-generated / needs review.
- [ ] **Generated story is not trusted.** The story is flagged aiGenerated + needsReview; verify it
      reads as a draft for review, not authoritative content. QC on it checks both sides.
- [ ] **Revoke works.** "↩ Revoke approval" flips curated off; the story button disables again.
- [ ] **Quality/native review (owed).** Judge the generated story with a native/near-native eye —
      it will contain invented grammar/forms. Only treat as usable after real review; tune the
      prompt in server.js (generateDialectStory) as needed.

### 55. post-v50 — Dialect is muted + no {lang} in dialect prompts
- [ ] **No audio in dialect lessons.** Playing a dialect vocab lesson shows NO listen-and-pick or
      listen-and-type exercises, and no 🔊 buttons read dialect words aloud (dialect has no real
      voice — treated as muted).
- [ ] **Source→target MCQ reads naturally.** The "how do you say X" question in a dialect lesson does
      NOT say "…in German" (the answer is the dialect word). It reads "How do you say \"fest\"?"
      (localized), without the language name.
- [ ] **Non-dialect lessons unchanged.** Normal (non-dialect) lessons still have listen exercises,
      🔊 buttons, and the usual "…in {language}?" phrasing.

### 56. post-v51 — Dialect story: A/B the two generation methods (direct vs rewrite)
Needs Ollama. The dialect studio now has TWO generate buttons so you can compare approaches on your
own model. **This is an evaluation task — the goal is to judge which method your model does better.**

- [ ] **Direct method** ("📖 Generate (direct)"): the model authors a dialect story directly from
      the topic + glossary (the original v51 approach).
- [ ] **Rewrite method** ("🔁 Generate (rewrite)"): the model first writes a Standard-German story,
      then rewrites it into dialect using the glossary (two model calls, slower).
- [ ] **Compare on the same topic.** Generate the same topic both ways. For each, read the dialect
      story in the review area and judge: which is more coherent? Which uses more real glossary words
      and fewer invented forms?
- [ ] **Coverage metric (rewrite).** The rewrite result shows "glossary words used: N of M" — a
      rough faithfulness signal. Higher generally means more real dialect vocabulary, less drift.
      (The direct method doesn't show this.)
- [ ] **Standard-German source (rewrite).** Expand "show the Standard-German source it was rewritten
      from" to see the scaffold the dialect was produced from — useful for judging whether the
      rewrite preserved meaning.
- [ ] **Verdict (owed).** Decide which method your local model handles better. If rewrite wins on
      faithfulness/coherence, it becomes the default; if not, keep direct. Note that the rewrite
      approach makes the output more checkable (coverage now, back-translation later).

### 57. post-v51 — Dialect topics: LLM-authoring add-lesson types gated off (Option A)
On a dialect topic, lesson types whose generators run in the base language (and would produce
non-dialect / mis-judged content) are hidden. Editing the dialect story text is still allowed.

- [ ] **Add-lesson menu is limited for dialect.** On a dialect topic, the "➕ Add lesson" dropdown
      shows only Standard, Math, and Mixed review (+ Learn-the-script if applicable). Synonyms,
      Word Forms, and Error Hunt are NOT offered.
- [ ] **Normal topics unchanged.** On a non-dialect topic, all the usual add-lesson types still
      appear.
- [ ] **AI error-hunt WORKS for dialect (it's a human-edit diff, no LLM).** Generate a dialect
      story in the studio, then open the story editor (✏️) with "🔎 AI hunt" ticked, fix some of the
      AI's dialect slop, and save. An "AI Error Hunt" lesson appears whose "errors" are exactly your
      corrections (original AI dialect → your fixed dialect). This is the intended dialect review
      tool — the human is the corrector, the model judges nothing.
- [ ] **Server refuses anyway (defense in depth).** Even if forced, the server rejects
      synonyms/word_forms/error_hunt/grammar/conjugation add-lesson requests for a dialect topic with
      a clear message.

### 58. post-v51 — Reasoning-model hardening (stripThink) — Ollama-verify owed
The transport (`llm.js`) now strips any reasoning-model chain-of-thought from every response, so a
`<think>…</think>` block can never leak into a story, a translation, or the JSON the validators
parse. The logic is fully unit-tested (`unit-strip-think`); this checks it end-to-end against a
REAL reasoning model, which the headless suite (fake-ollama emits no think tags) can't cover.
Needs Ollama with a reasoning model pulled (e.g. `ollama pull qwen3:8b` or `qwq`).

- [ ] **Reasoning model → clean story.** Start the server with a reasoning model as the story model
      (`OLLAMA_MODEL=qwen3:8b node server.js`), generate a normal topic (de→en). The saved story is
      clean prose — **no** `<think>`/`</think>` tags and no visible reasoning text at the top.
- [ ] **Reasoning model → parseable lessons.** With the same model as the lesson model
      (`OLLAMA_LESSON_MODEL=qwen3:8b`), the vocab/sentence lessons still build (the reasoning block
      didn't corrupt the JSON). Watch the server console for parse errors.
- [ ] **Truncated-reasoning failure is clean, not garbage.** If a reasoning model with too small a
      budget returns only an unclosed think block, generation FAILS with a clear message ("only a
      reasoning block…") rather than saving a story/lesson full of reasoning text. (Raising
      `num_predict`, i.e. a longer story length, or using a non-reasoning model, fixes it.)
- [ ] **Non-reasoning model unchanged.** With the default `qwen2.5:7b` (no thinking), stories and
      lessons are byte-for-byte as before — the strip is a no-op on tag-free output.

### 59. post-v51 — Runtime model picker (per-role dropdowns) — browser-verify owed
The backend row now shows three model dropdowns (Story / Lessons / Translation) populated from
Ollama's installed models (`/api/models`), so a model can be switched without restarting. Fully
wired + unit/e2e tested headlessly (`unit-model-picker`, `e2e-models`); this is the browser pass.
Needs Ollama with ≥2 models pulled (e.g. `qwen2.5:7b` + `translategemma`).

- [ ] **Dropdowns appear (Ollama only).** With the server running against Ollama, the backend row
      shows three labelled selects — Story, Lessons, Translation — each listing the installed models,
      preselected to the currently active model for that role. (In the offline/static build there is
      NO backend, so the dropdowns do not appear at all.)
- [ ] **Switching a role sticks + updates the label.** Change the Story dropdown to another model:
      a "Model updated" toast appears, and the Ollama pill label updates to the new story model. The
      choice persists for subsequent generations this session.
- [ ] **translategemma on Lessons → table format.** Set the Lessons dropdown to a `translategemma`
      model; the pill's "Lessons: …" now shows `[table]`. Generate a topic — lessons still build
      (from the markdown-table path). Set Lessons back to a JSON-capable model; `[table]` disappears.
- [ ] **Split story vs lessons works end-to-end.** Set Story = `translategemma`, Lessons =
      `qwen2.5:7b`, generate a topic (e.g. a dialect/Lëtzebuergesch story): the story is authored by
      translategemma (prose, so no JSON issue) and the lessons by qwen (JSON). The result-card
      "Generated in …" line reflects the run.
- [ ] **Unknown/uninstalled rejected.** (Only reachable via API, but worth noting.) POSTing a model
      name that isn't installed returns a 400 and does not change the active model.
- [ ] **Provenance recorded.** After a split-model generation, the saved topic's `generationStats`
      carries `models: {story, translation, lessons}` reflecting the actual models used (translation
      is null when it didn't run). Check via the saved lessons.json entry.

### 60. v52 fix — table-format header no longer leaks as a vocab entry
`parseTableLesson` was keyword-matching the header row with ASCII `\w+`, so a target language whose
name has non-ASCII letters (Lëtzebuergesch → the ë) leaked the header in as the first vocab item
("Lëtzebuergesch word" / "German meaning"), dropped a real word (8-row cap), and could lose the
sentence table. Now structure-anchored (header = the row before the `|---|` separator), language-
independent. Headlessly covered (`unit-table-lesson`, `e2e-models` with a non-ASCII fixture); this
confirms it against real translategemma output.

- [ ] **lb lesson has no header row.** With Story+Lessons = translategemma, generate a Lëtzebuergesch
      (target) ← German (source) topic. The first vocab card is a REAL word — not
      "Lëtzebuergesch word" / "German meaning".
- [ ] **Full word count + sentences present.** The lesson has its full vocab set (no missing 8th
      word) and its example sentences (the sentence table wasn't swallowed).

### 61. v52 — synonym/antonym solution reveal shows the exact translation
The reveal for a `syn_select` (synonyms / antonyms select-all) now shows each correct word followed
by its EXACT translation (the gloss authored in the lesson data), on both a correct and a wrong
answer. (`unit-synonyms` covers the wiring + gloss pairing; this is the visual check.)

- [ ] **Correct answer reveal.** Play a Synonyms lesson, select all the right words. The green
      feedback lists each correct word with its translation, e.g. "Gebäude — building" / "Heim — home"
      (one per line), matching the glosses in the lesson.
- [ ] **Wrong answer reveal.** Deliberately miss one. The "correct answer" line likewise shows each
      word with its exact translation, not just the bare words.
- [ ] **Antonyms too.** The same holds for an antonyms select-all exercise.
- [ ] **Older data without glosses.** If a lesson entry has no gloss, the word still shows plainly
      (no dangling "—"). (Regenerated lessons include glosses.)

### 62. v52_b — identical source/target: log items + allow close pairs
The "N vocab items have identical source/target fields — model ignored source language" check now
logs each offending item ("target = source") to the server console, and skips blocking for CLOSE
language pairs (dialects `lang===srcLang`, or curated pairs like de↔lb). Unit-covered
(`unit-close-lang-pairs`); this is the live confirmation.

- [ ] **Close pair not blocked.** Generate a Lëtzebuergesch ← German lesson whose vocab contains
      cognates spelled identically (Haus=Haus, Buch=Buch). The lesson is accepted (no retry loop on
      this), and the server console shows the identical items tagged "close pair, allowed".
- [ ] **Distant pair still guarded.** A normal target ← English lesson where the model wrongly copied
      the target into the source field still fails the attempt and retries — and the console now lists
      exactly which items were identical.

### 63. v52_c — five live-testing fixes
Bundled follow-ups from live testing. Headless coverage: `unit-static-teacher` (QC-icon exclusion),
`unit-model-picker` (timeout input + suitability warning), `e2e-models` (timeout endpoint),
`unit-prompt-strictness` (dialect + synonyms prompts). Browser/Ollama confirmations:

- [ ] **AI error hunt: no QC looking-glass.** Open a topic that has an AI Error Hunt lesson. Its
      lesson card shows NO 🔍 QC button (other lesson types with vocab/sentences still do).
- [ ] **Model timeout input.** Next to the model dropdowns there's a "Timeout … s" number field
      (default 720). Raise it (e.g. 1800), see a "Timeout updated" toast. A large/slow model that
      previously timed out on Swahili word_forms/synonyms now completes.
- [ ] **Suitability warning at generate time.** With a Lëtzebuergesch target and qwen still set for
      Story/Lessons, clicking Generate shows a non-blocking toast suggesting translategemma. Switching
      those roles to translategemma makes the warning stop. No warning for a German/English target.
- [ ] **Dialect story uses several glossary words.** Generate a dialect story (rewrite method) from a
      glossary. The result uses MORE than one glossary word; the console prints the coverage
      (`[coverage used/total]`), and a too-low first attempt triggers a logged retry.
- [ ] **Synonyms are substitutable.** In a Synonyms lesson, the offered synonyms genuinely fit the
      context sentence — each could replace the base word without breaking the sentence.

### 64. v52_d — three UI changes (feedback motion, mixed icons, story themes)
Headless coverage: `unit-ui-feedback-mixed-icons`, `unit-storyline-theme`. Browser confirmations:

- [ ] **Positive-feedback motion.** In a lesson, a CORRECT answer makes the question card lift UP
      (rise), a WRONG answer makes it drop DOWN (fall) — no more sideways shake.
- [ ] **Mixed lesson previews its sources.** On a chapter/lesson-set page, a "🔀 Mixed review" card
      now shows the icons of the lessons it pools from (e.g. 🔀 🍎 📖 🔁) instead of the generic
      label. An empty chapter's mixed card falls back to the "Mixed review" text.
- [ ] **Storyline theme by style.** Open a storyline whose first chapter was generated with a
      distinctive style (e.g. Funny, Philosophical, Horror): the screen has a subtle top-down
      background gradient matching that style. A storyline built from an uploaded/"existing" story
      (no style) shows the neutral "existing" theme. Different first-chapter styles → different tints.

### 65. v52_e — dedicated QC model role
QC no longer shares the translation model. New independent "QC" dropdown (4th role); defaults to the
translation model. Headless: `e2e-models` (independent switch), `unit-model-picker` (4th selector).

- [ ] **Four dropdowns.** The model picker shows Story / Lessons / Translation / QC, each preset to
      the active model. QC defaults to whatever Translation is.
- [ ] **QC is independent.** Set Translation = qwen and QC = translategemma. Run a QC pass on a
      Lëtzebuergesch topic: the check runs on translategemma (better lb judgement) while any
      story-translation panel still uses qwen. Switching Translation does not change QC and vice versa.
- [ ] **QC only affects QC.** Setting QC = translategemma does NOT flip the lesson format to table
      (only the Lessons role does that).

### 66. v52_f — QC results stamped with the model that produced them
Each QC flag now carries `qc.by` (the active QC model), and a clean lesson pass stamps `qcBy`
alongside `qcAt`. QC console/job logs now show the QC model (not the translation model). Headless:
`unit-qc-dispatch` asserts `qc.by`.

- [ ] **Stamp present.** Run a QC pass (ideally with QC set to a distinct model, e.g. translategemma).
      A flagged item's saved data has `qc.by` = that model; a cleanly-passed lesson has `qcBy`. The
      QC job log shows the QC model in its `[…]` prefix.

### 67. v52_g — QC collect-and-compare (multiple models per item)
QC verdicts are collected per model (`item.qcByModel`); the editor shows one "<model> suggests:" row
per model. Headless: `unit-qc-collect`, `unit-qc-editor-label`.

- [ ] **Two models, both shown.** QC a lesson with QC=qwen, then switch QC=translategemma and QC the
      same lesson again. An item both flag shows TWO rows in the editor — "qwen suggests: …" and
      "translategemma suggests: …" — so you can compare.
- [ ] **Second model actually runs.** The translategemma pass isn't skipped by qwen's earlier clean
      pass (per-model skip). Watch the job log — it re-checks rather than skipping everything.
- [ ] **Selective clear.** If one model later says a previously-flagged item is OK, only that model's
      row disappears; the other model's suggestion remains.
- [ ] **Fix/dismiss still work.** Applying the fix or dismissing clears all QC rows for that item.

### 68. v53 — script lessons in BOTH directions (Latin alphabet for non-Latin readers)  
_✅ Confirmed fully tested by user (2026-07-11, v54_c)._
Before v53 a script course only ever taught the TARGET's script, and only when the target was
non-Latin — so a learner whose source language is Arabic/Russian/Japanese/… learning English was
offered the *Arabic* course (a script they already read) and never the Latin alphabet. `latin` is
now a real table in `scripts.json`, every language is mapped in `_langScript`, and the answer side
of a Latin course is rendered in the learner's own script via `letters[].sounds` (`B → بي`).
Headless: `unit-intro-script` (v53 block), `unit-add-lesson-registry`.

- [x] **Latin course appears (the fix).** Start a set with **target = English, source = Arabic**
      (or Russian / Japanese / Korean / Hebrew / Hindi / Greek / Thai). The "add a script lesson"
      menu now offers **Latin alphabet**. Pick it and play.
- [x] **Answers are readable.** In the glyph→sound questions the prompt is `A a` and the four
      choices are in **Arabic script** (`إيه`, `بي`, …) — *not* `a`, `b`, `c`. Reverse questions show
      an Arabic prompt (`بي`) and Latin glyph choices (`B b`). Nothing shows a `(bee)` hint.
- [x] **Listen items.** "Tap to listen" speaks the letter with the **English** voice; when the device
      is muted the fallback text under it is the Arabic name, not a Latin letter.
- [x] **RTL sanity.** With an Arabic source, the Arabic choice buttons render right-to-left and are
      not mangled; the Latin glyph choices stay left-to-right (content-aware direction, §30).
- [x] **Other reader scripts.** Repeat with source = Russian (choices `эй`, `би`…), Japanese
      (katakana `エー`, `ビー`…), Korean (`에이`, `비`…). Each answers in that learner's script.
- [x] **No Latin course for Latin readers (regression).** A German→English or English→Italian set
      offers **no** script lesson at all, exactly as before. Nothing new appeared.
- [x] **Chinese is gated off.** A Chinese→English set offers **no** Latin course (no `sounds.han`
      column authored yet) rather than a circular one with Latin answers.
- [x] **Existing direction unchanged (regression).** English→Arabic still teaches the Arabic script
      with Latin transliteration answers (`ا` → `ā`), exactly as before v53. Same for en→ru, en→ja.
- [x] **Arc auto-generation.** With source = Arabic, generating a multi-chapter English storyline
      auto-adds a per-chapter Latin "extend" script lesson (new letters that chapter).

**Native review owed** (`scripts.json` `_sounds_comment`): every `latin.sounds.*` column is the
Latin letter's *name* transcribed into that script (chosen over the phonetic value because
`c`/`k`/`q` all collapse to one grapheme phonetically, which would give MCQs several correct
answers). A native speaker should confirm each column — especially Hebrew (niqqud), Greek
(`μπι`/`ντι` digraphs) and Thai.

### 69. v53 — translate-ui.js sees every offered language (Ollama-verify owed)  
_✅ Confirmed fully tested by user (2026-07-11, v54_c)._
`translate-ui.js` derived its work list from `Object.keys(ui.json)`, so Swahili — offered as a source
(= UI) language but entirely absent from `ui.json` — was never listed and never translated, while
`--check` reported all languages complete. Now derived from `languages.json`. Headless:
`unit-translate-ui-langs`.

- [x] **Swahili is visible.** `node translate-ui.js --check` lists `✗ sw Swahili 426 missing` and
      reports `1630 across 29 language(s)` (not 1204 across 28).
- [x] **Swahili translates.** With Ollama up: `node translate-ui.js sw` fills all 426 keys.
      Re-running `--check` then shows `✓ sw Swahili complete`. **Read the output** — this is the
      first language translated from scratch rather than topped up; watch for script bleed and for
      `{placeholder}` tokens being mangled.
- [x] **UI actually renders.** Pick Swahili as the SOURCE language in the app. The interface is in
      Swahili, not English. (Before this fix it silently fell back to English.)
- [x] **No regression.** `node translate-ui.js de --check` still reports only the 43 owed keys;
      naming languages explicitly and `--exclude` still behave as before.

### 70. v53_b — "add lesson +" offers the script lesson for the SET's language pair  
_✅ Confirmed fully tested by user (2026-07-11, v54_c)._
The v53 Latin course was generated correctly but the **+ menu never showed it**. The gate read the
global `APP.srcLang` (the UI language of whoever is browsing) while the generator read the set's own
`d.srcLang`. With the UI in English, opening an `en|ar` set evaluated
`scriptLessonAvailable('en','en')` → false → option hidden. Pre-v53 this never bit, because a
non-Latin *target* made the option appear for any srcLang. Fixed via `scriptLessonAvailableForSet(d)`.
Also fixed: the authoring path baked `exercises` with no `srcScripts`, so the persisted array (what
the editor and QC see) answered in Latin translit even though play-time rebuilt it correctly.
Headless: `unit-intro-script` (v53_b block, mutation-tested).

- [x] **The reported bug.** Keep the UI/source language set to **English**. Open a saved set whose
      pair is **target=English, source=Arabic** (13 exist in `lessons.json`). Click **+ add lesson** →
      the format dropdown now lists **🔡 Learn the script**. Before v53_b it was absent.
- [x] **It generates both.** Choosing it adds **two** lessons: 🔡 Latin alphabet *and* 🔡 Arabic —
      Latin because the Arabic-reading learner needs it, Arabic because the set's source text uses it.
- [x] **Baked answers are localized.** Open the new Latin lesson in the **lesson editor** (not just
      play mode). The stored exercises show Arabic answers (`A a → إيه`), not `A a → a`. This is the
      part that play-time used to paper over.
- [x] **Play it.** The lesson plays with Arabic choices, as in §68.
- [x] **Regression — global UI language is irrelevant.** Switch the UI/source language to German, then
      Arabic, and reopen the same `en|ar` set. The option appears in all three cases, because the gate
      now follows the set, not the UI.
- [x] **Regression — Latin pairs still offer nothing.** An `en|de` or `it|en` set shows no
      "Learn the script" option in the + menu, at any UI language.
- [x] **Regression — legacy sets.** A set saved without a `srcLang` field falls back to the global
      `APP.srcLang` and behaves as before.

### 71. v53_c — CLI scripts exit; storyline summary names its model; de↔nl  
_✅ Confirmed fully tested by user (2026-07-11, v54_c)._
Three fixes from the TODO triage. Headless: `unit-llm-timeout-handle`, `unit-storyline-summary-stamp`,
`unit-close-lang-pairs`.

**A. CLI scripts terminate (the `translate-ui.js` hang).** The leak was in `llm.js`, not
`translate-ui.js`: the `Promise.race` timeout guard was never cleared, so the process idled for the
rest of `OLLAMA_TIMEOUT` (default **12 minutes**) after the last LLM call.
- [x] With Ollama up: `time node translate-ui.js de` — it prints `💾 Saved…` and **returns to the shell
      immediately**, not 12 minutes later. (Before: the last line printed, then it sat there.)
- [x] Same for `node generate-lessons.js`, `node translate-lessons.js`, `node qc-lessons.js`.
- [x] `OLLAMA_TIMEOUT=30000 node translate-ui.js de` with Ollama **stopped** still fails fast with
      `Ollama timeout` — the guard still fires, it is only cleared on success.
- [x] The server (`node server.js`) is unaffected: generate a lesson, confirm no new stall.

**B. Storyline summary console + stamp.**
- [x] Regenerate a storyline summary (`/api/storyline-retitle`, scope `all`). The console block now reads
      `Chapters : N, Lang: X, Model: <model>` — previously the model was missing.
- [x] The storyline JSON now carries `summaryMeta` `{type:'storyline_summary', model, ms, at, …}`.
      **Check the model is the STORY model**, not the lesson model (`buildGenMeta` defaults to the lesson
      model, so a missing `model:` would mis-stamp silently).
- [x] The summary still renders as text in the UI — **not** `[object Object]`. (The function now returns
      `{text, meta}`; both call sites destructure, but this is the failure mode to watch for.)
- [x] Switch the story model at runtime, regenerate, confirm `summaryMeta.model` follows.

**C. `de↔nl` is a close pair.**
- [x] Generate a German→Dutch (or nl→de) vocab lesson containing cognates (`arm, hand, winter, warm`).
      The console logs `— close pair, allowed` and the lesson is **kept**, not retried.
- [x] Regression: an `it→en` or `lb→en` lesson where the model writes English into the target field is
      **still rejected** (`— blocking, will retry`). Relaxing closeness must not silence that.

### 72. v53_d — story provenance stamp + `buildGenMeta` requires a model
`topic.storyMeta` is new (per-artefact: model, ms, tokens, at), written on **both** upserts.
`buildGenMeta({model})` now throws if omitted — it used to default to the lesson model.
Headless: `unit-story-stamp` (mutation-tested), `unit-genmeta`, `unit-storyline-summary-stamp`.

- [ ] **Generated story.** Create a new topic (no pasted story). The new topic JSON has
      `storyMeta: {type:'story', model:<story model>, ms, promptTokens, completionTokens, at}`.
      Confirm `model` is the **story** model, not the lesson model — switch them at runtime to be sure.
- [ ] **Pasted story.** Create a topic via "I have my own story". `storyMeta.model` is
      `'(user-provided)'`, and `generationStats.models.story` stays `null` as before.
- [ ] **Early-save path (the one that matters).** Start a generation, then kill the server *after* the
      story is written but *before* lessons finish. The saved topic still carries `storyMeta`.
      (A stamp only on the final upsert would be missing on exactly the topics you most want to debug.)
- [ ] **No crash from the required model.** Generate one of every lesson type — standard, synonyms,
      word_forms, error_hunt, grammar, conjugation, math, intro_script. None throws
      "`model` is required". (A missed call site would now be a hard failure, not a silent mis-stamp.)
- [ ] **Old topics still load.** The library renders topics that have no `storyMeta` and no
      `generationStats.models` (249 of them) without errors or blank cards.

### 73. v53_e — provenance backfill (`backfill-provenance.js`)
All 267 topics now carry `storyMeta`. 262 values were **derived** from `generationStats.model`
(whose first element is provably the story model); 5 are **user-asserted** and marked as such; 1 is
`(unknown)`. Headless: `unit-story-stamp` (corpus invariants).

- [ ] **The assumption still holds on your data:** `node backfill-provenance.js --verify` prints
      `label[0] === models.story → 5 ok, 0 mismatched`. If it ever prints a mismatch, the backfill's
      premise is broken and the stamped values must be re-derived.
- [ ] **Idempotent:** re-running the migration reports `storyMeta written: 0, already had: 267`.
- [ ] **Safety rails:** running it with no flags refuses to write and names what it needs. Running it
      with `--write` creates `lessons.json.bak` first.
- [ ] **Library still loads.** Open the app: all 267 topics render. Nothing regressed from the extra
      `storyMeta` / `generationStats.models` fields.
- [ ] **Spot-check three topics against your own memory** — this is the part only you can do:
      `osttirol-glossary` (de|de) is `(unknown)`; `Essen an Luxembourg` (lb|lb) is `translategemma:4b`;
      any Swahili chapter you pasted yourself is `(user-provided)`.
- [ ] **New generations are NOT flagged as backfilled.** Generate a fresh topic; its `storyMeta` has
      no `backfilled` field and no `source` — those mark inferred rows only.

### 74. v53_f — story `origin`: generated vs dialect-rewrite vs file-upload vs user-pasted
`storyMeta.model` says WHO wrote the text; `storyMeta.origin` says WHERE it came from. Before this,
`'(user-provided)'` collapsed **72 pasted** texts and **50 uploaded book chapters** into one bucket —
and an uploaded chapter has an author and a licence, unlike a pasted one. Corpus after backfill:
generated 144 · user-pasted 72 · file-upload 50 · dialect-rewrite 1.
Headless: `unit-story-stamp` (mutation-tested).

- [ ] **Generated story** → `storyMeta.origin === 'generated'`, `model` = the story model.
- [ ] **Pasted story** ("I have my own story") → `origin === 'user-pasted'`, `model === '(user-provided)'`,
      **no** `sourceFile`.
- [ ] **Uploaded book** (the path that sets `storyline.sourceFile`) → every chapter gets
      `origin === 'file-upload'` **and** `storyMeta.sourceFile` matching the storyline's filename.
      This is the one to actually exercise: it runs in a post-pass, after the chapters are saved.
- [ ] **`osttirol-glossary`** now reads `translategemma:4b` / `dialect-rewrite`, marked
      `source: 'user-asserted (--set-model)'` — your memory, not the record.
- [ ] **`Essen an Luxembourg`** reads `translategemma:4b` / **`generated`**, not `dialect-rewrite`.
      It has `generationStats` but none of the `_dialect`/`aiGenerated` flags `osttirol` carries, so
      nothing records that a glossary informed it. **If that matters, we need a field for it** —
      the classifier is not being fudged to match a recollection.
- [ ] **Nothing is fabricated.** No topic with `origin` `file-upload`/`user-pasted` names a model.

### 75. v53_g — identical source/target is now a RATIO, not a count
The blocker rejected a lesson with more than 2 identical source/target vocab items. Measured across
all 267 topics (98 non-close lessons contain ≥1 identical item), that conflated real model failures
(100%, 100%, 80%, 75%, 75%) with legitimate loanwords (≤40%: "pasta, tagliatelle, risotto";
"café, fans, notes"; "performance, DJ"). The distribution is bimodal with **nothing between 40% and
75%**. New rule: block when `≥3 items AND ≥60% of the lesson` is identical. The SENTENCE rule is
unchanged — the corpus has zero identical sentences in a non-close pair.
Headless: `unit-identical-ratio` (replays the shipped corpus; mutation-tested both directions).

- [ ] **Loanword lessons survive.** Generate an `it→en` food/wine topic (pasta, risotto, bar, aroma).
      The console logs `3/8 vocab (38%) … — below ratio threshold (loanwords?), allowed` and the lesson
      is **kept**. Before v53_g it was rejected and silently regenerated — pure wasted model time.
- [ ] **Real failures still blocked.** Force a failure (e.g. a tiny/quantised model on `lb→en`) until
      the model writes English into both fields. Console shows `8/8 vocab (100%) … — blocking, will
      retry` and it retries. **This is the safety property — verify it before trusting the change.**
- [ ] **Close pairs unaffected.** `de↔nl`, `de↔lb`, `ru↔uk`, and any dialect (`de|de`) still log
      `— close pair, allowed` and never block, at any ratio.
- [ ] **Sentences unchanged.** Two identical sentences still block, whatever the vocab ratio.
- [ ] **Watch the new console line.** It now prints `k/n (pct%)` and one of three verdicts. If you see
      a lesson land between 40% and 75%, tell me — the threshold was derived from a gap that was
      empty, and a lesson in the gap means it needs re-deriving.

### 76. v54 — drill lessons: "🎯 Review my mistakes"
The learned ledger has tracked a per-word `wrong` count since v50 and **nothing read it**. A drill
pulls those words straight into the existing `standard` exercise builder: no model call, no latency,
works offline and in the static (no-backend) build. The lesson is **ephemeral** — synthesized in
memory, never saved. Headless: `unit-drill` (selection, padding, refusals, real-builder integration,
qid stability, ephemerality; all mutation-tested).

- [ ] **The button appears.** Finish any lesson getting ≥1 word wrong. The result card shows
      **🎯 Review my mistakes** below Continue. Tap it: a round plays, built from your wrong words.
- [ ] **It quizzes the wrong words** (not just weaves them in, like "my story"). The words you missed
      appear as MCQ / listen / type questions, padded with words you know so the MCQs have distractors.
- [ ] **It hides when there's nothing to review.** On a fresh pair, or after clearing every mistake,
      the button is absent. (A drill is not a re-run of vocabulary you already know.)
- [ ] **Re-learning walks the count down.** Drill a word, answer it right, drill again — eventually
      it stops appearing. Answer it wrong and it comes back harder (`wrong` increments).
- [ ] **A normal lesson never decays the counts.** Play a normal lesson getting everything right;
      previously-wrong words must still show up in the next drill.
- [ ] **Ephemeral — the key regression.** Before drilling, note a topic's completion %. Drill, finish,
      press Continue. You land back on **the same topic**, its completion % **unchanged**, and no
      phantom "__drill__" topic exists in the library.
- [ ] **Quit mid-drill** (the ✕): you return to the real topic, not a blank screen, and its progress
      is untouched.
- [ ] **Re-drill from a drill's own result card**: finishing a drill and tapping 🎯 again must still
      return you to the *original* topic on Continue, not to the previous drill.
- [ ] **Static build.** Open `docs/index.html` with no server. The drill works — it needs no backend.
- [ ] **i18n.** Labels come from `ui.json` `drill.*`, currently **English only** (4 new keys), so a
      non-English UI shows English until the TranslateGemma pass. Expected, not a bug.

### 77. v54_b — drill fixes: quiz only mistakes; the "__drill__" leak
Two user-reported bugs in the v54 drill.
**(a)** Padding widened the *quiz*, so one mistake was buried among seven known words — "review my
mistakes" mostly tested words the learner had never got wrong. Padding now fills only the MCQ
**distractor pool** (`lesson._distractors`, new, additive); `lesson.vocab` holds the mistakes alone.
**(b)** `showComplete` **reassigns** `compNext.onclick`, so the inline `onclick="afterComplete()"`
never fired on the finish path — `endDrill()` there was dead code. The ephemeral drill stayed loaded,
and the completion nav button (titled from `APP.lessonData.topic`) rendered a **`__drill__`** button
that opened the drill as a fake lesson set. `endDrill()` now runs in `goLessonSet()`, the single choke
point every exit funnels through; the nav buttons are hidden for a drill.
Headless: `unit-drill` (mutation-tested; the two guards that missed this were themselves fake).

- [ ] **Only mistakes are asked.** Get exactly **one** word wrong, finish, tap 🎯. The round asks about
      **that word only** (≈3 questions). The MCQ still has 3 wrong options — drawn from words you know,
      which are never themselves asked.
- [ ] **The recap is honest.** "Words from this lesson" on the drill's result card lists only the
      mistakes, not the padding.
- [ ] **No `__drill__` button.** Finishing a drill shows **Continue** and *no* extra nav button.
      Before v54_b there was a `📚 __drill__` button opening a fake lesson set.
- [ ] **Continue returns you home.** Press Continue after a drill → you land on **the real topic's**
      lesson set, completion % unchanged. (This is the path that was broken: `afterComplete` was never
      called.)
- [ ] **Re-drill still works.** 🎯 on a drill's own result card starts a fresh drill; Continue from
      *that* still returns to the original topic, not to a previous drill.
- [ ] **Quit mid-drill** (✕) still returns to the real topic.
- [ ] **Many mistakes → no padding.** With ≥4 wrong words the round asks all of them and pulls no
      known words in at all.

### 78. v54_c — `_wrongTargets` was per-session, not per-round
User-reported via the drill. `C._wrongTargets` was created lazily on the first wrong answer and
**never cleared** — it accumulated across every lesson played in a session. `recordLearnedFromLesson`
tests `wrongTargets.has(target)`, and that test **wins over the drill's decrement** (`else if(lesson._drill)`).
Consequences: a word answered correctly in a later lesson was still marked wrong, and drilling a word
you had missed earlier in the session **incremented** its count instead of clearing it — so the drill
could never retire a mistake, and every attempt inflated it. `startLesson` now clears the set.
Headless: `unit-drill` (a multi-round SEQUENCE test; single-call tests all passed).

- [ ] **The drill can now clear a mistake.** Get one word wrong. Drill it, answer correctly, finish.
      Drill again → that word is gone (or the button is hidden if it was the only mistake).
      Before v54_c it came back, and came back *harder*.
- [ ] **A clean round doesn't re-mark old mistakes.** Get word A wrong in lesson 1. Play lesson 2
      perfectly (a lesson that also contains A). A's wrong count must not rise.
- [ ] **Mixed rounds.** Play a vocab lesson with mistakes, then a mixed round with none. The drill's
      contents must not grow because of the mixed round.
- [ ] **Counts don't inflate.** Drill the same word right three times in a row: after the first, it's
      cleared. It must not take three drills to remove one mistake.
- [ ] **Static mode.** All of the above in `docs/index.html` with no server — this is where it was found.

**Expected, not a bug:** the drill draws on the **cumulative ledger for the language pair**, not the
lesson you just played. Mistakes from *any* earlier lesson or topic in that pair are eligible. And the
words you see as MCQ *choices* but are never *asked* are the distractor pool (`_distractors`) — a
one-mistake round needs three wrong options from somewhere.

### 79. v55 — storyline SVG storyboard 🎬 (captions are HOVER tooltips as of v55_d)
**✅ VERIFIED in live browser 2026-07-13 (user) — all §79–§79e functions.**

Server composes the SVG from model JSON (composeStoryboardSVG is the security boundary);
the client only injects the finished string. Uses the STORY model; the call is synchronous
and can run ~30 min on qwen3.6:35b-a3b (spike-measured 2.2 tok/s) — the ⏳ just waits.

- [x] Open a storyline with ≥2 chapters → 🎬 appears in the title row NEXT TO 📝 (both
      gated on canGenerate). Open a 1-chapter storyline → 🎬 does NOT appear.
- [x] Click 🎬 → button shows ⏳ disabled; server console prints
      `── Storyline storyboard generation ──` with `Model: <story model>`.
- [x] On success: panels appear in the storyline screen ABOVE the summary section; back on
      the landing page the storyline card shows them above the summary strip; toast fires.
- [x] Reload → storyboard persists (stored on the storyline as `sl.storyboard`).
- [x] `sl.storyboardMeta` in lessons.json records `type:'storyline_storyboard'` and the
      STORY model (not the lesson model), with tokens + ms (v53_d contract).
- [x] Re-generate (click 🎬 again) → new panels REPLACE the old ones cleanly in both places.
- [x] `node build-static.js` → open docs/index.html OFFLINE → the storyboard renders on the
      storyline card (no 🎬 button in static — canGenerate is false, display-only is correct).
- [x] INJECTION (explicit): create a storyline whose chapter text / user story contains
      `<script>alert(1)</script>` and SVG markup, generate a storyboard → captions may show
      the text escaped, but nothing executes and no foreign markup renders (check DOM: only
      svg/rect/circle/ellipse/line/polyline/polygon/path/text elements inside the panel).
- [x] Model can't produce ≥2 valid panels → toast shows the storyboard.empty message; button
      returns to 🎬 enabled; nothing is stored.
- [x] Timeout behaviour: the request survives >12 min (per-call 60-min LLM timeout); if the
      browser tab is closed mid-generation the server still finishes and stores the result
      (re-open the storyline to see it).

### 79b. v55_b — storyboard failures leave a server-side corpse
- [x] Force a failure (e.g. stop Ollama mid-generation, or point OLLAMA_URL at nothing and
      click 🎬) → the server console prints `✗ Storyline storyboard FAILED after Ns: <msg>`
      (plus, if the model responded with garbage, `Raw starts: …`). No more silent deaths —
      the toast is no longer the only witness.
- [x] On a SUCCESSFUL run, the console now also prints `Response : after Ns (N tok, N tok/s)`
      between the header and the panel count — the tok/s number is the data for the
      job-vs-sync decision carried in roadmap_v55.

### 79c. v55_c — storyboard requests think:false
- [x] 🎬 on a thinking story model (qwen3.6:*): the `Response :` line appears in MINUTES
      (single-digit tok count of pure JSON), not after 20+ min, and no
      "returned empty response" / "only a reasoning block" failure.
- [x] 🎬 with a NON-thinking story model (qwen2.5:7b): still works — if this Ollama version
      rejects `think:false` for it, the automatic parameter-less retry kicks in invisibly
      (at worst the console shows one failed+retried call, never a user-facing error).

### 79d. v55_d — captions are hover tooltips, not a text band
- [x] Generated panels have NO caption text under them; hovering a panel (desktop) shows the
      caption as a native browser tooltip. Panels are the same size as before, the strip is just
      shorter by the old caption band.
- [x] Touch device: no caption is shown (accepted tradeoff — the caption lives only in the
      hover title / accessibility tree).

### 79e. v55_e — storyboard delete (🎬 toggle menu)
- [x] With NO storyboard: 🎬 generates directly (unchanged).
- [x] With a storyboard present: 🎬 opens a menu with Regenerate / Delete (+ Cancel).
      Button tooltip reads "Storyboard options" instead of "Generate storyboard".
- [x] Delete → panels vanish from the storyline screen AND the landing card; toast
      "Storyboard deleted"; reload confirms it's gone from lessons.json (`sl.storyboard`
      and `sl.storyboardMeta` both removed).
- [x] Delete works even with Ollama stopped (the DELETE route needs no backend).
- [x] Regenerate → same as a fresh generate (⏳ → new panels replace the old).
- [x] Cancel / Esc / overlay-click → nothing changes.
- [x] Static build (docs/): no 🎬 button at all (canGenerate false) — baked storyboards are
      read-only there; deletion is a server-build action. (Expected, not a bug.)

### 80. ✅ VERIFIED 2026-07-14 — v55_g QC for generated texts (🔍 proofread → correction proposal + auto error-hunt)
Server proofreads a story with the QC model; the correction is a PROPOSAL (never auto-applied).
Accepting it updates the story AND rebuilds the ai_error_hunt from the original↔corrected diff.
- [x] Open a topic with a story (server build) → 🔍 appears next to the ✏️ edit toggle. Static
      build (docs/): no 🔍 (canGenerate false).
- [x] Click 🔍 → ⏳ while the QC model runs (server console prints `── Story QC ──` with the QC
      model + a `Verdict :` line). On return, a review panel opens under the story.
- [x] A story with real errors → verdict 'corrected': panel shows a word-level diff (red del /
      green ins) with Accept / Discard. A clean story → "no errors found", no accept button.
- [x] Accept → story updates in place; toast; an 🔎 AI Error Hunt lesson appears/updates in the
      lesson path built from exactly the corrections; reload shows the new story persisted and
      `storyQcBy`/`storyQcAt` on the topic in lessons.json.
- [x] The ai_error_hunt is playable and its items ARE the QC corrections (not model-invented).
- [x] Discard → panel closes, story unchanged, no lesson built, proposal gone (reload confirms).
- [x] Proposal persists across reload if neither accepted nor discarded (re-open the story → panel
      reappears).
- [x] REWRITE guard: QC a badly-broken story (e.g. the garbled-Luxembourgish kind) → verdict
      'rewrite': panel shows an amber "rewrote rather than corrected" warning and ONLY a Discard
      button (Accept withheld). Forcing accept via API returns 409.
- [x] Accept works with Ollama STOPPED after the proposal exists (accept route needs no backend).

### 80b. v55_i — QC rejects mechanically-corrupted corrections
- [x] If the QC model returns text with run-together words (spaces collapsed, e.g. inside quotes —
      a qwen2.5:7b failure mode), the review panel shows the amber "mangled the text" warning and
      ONLY a Discard button; Accept is withheld and a forced accept returns 409.
- [x] A legitimate correction with a normal long word is NOT flagged as corrupt.

### 80c. v55_j — QC display + immediate error-hunt
- [x] QC a story where a QUOTED sentence has a corrected word → the review panel shows the whole
      old sentence (red) above the whole new sentence (green), WITH spaces intact (no run-together).
- [x] Accept → the 🔎 AI Error Hunt appears in the lesson path IMMEDIATELY, no page reload needed.

### 81. v55_k — bulk story QC (proposal-accumulation in the storyline sweep)
- [x] Storyline 🔍 sweep: server console shows a "Proofreading story: <chapter>…" step PER chapter
      (in addition to lesson checks); the toast reports "N story proposal(s)".
- [x] After the sweep, the storyline 🔍 button shows a green 📝<count> for chapters with a pending
      story proposal (next to the red lesson-flag count). Per-topic 🔍 shows 📝 similarly.
- [x] Open a chapter that has a 📝 → its story screen auto-shows the QC review panel (accept/discard
      as in §80). Accepting builds the ai_error_hunt (§80c) and drops that chapter's 📝.
- [x] Re-run the sweep → already-checked, unedited stories are SKIPPED (console "⏭ skip story …");
      only edited/new chapters are re-proofread. Force re-checks all.
- [x] Edit a chapter's story while a proposal is pending → the pending proposal is dropped; the next
      sweep re-proofreads it. Accepting a now-stale proposal (story changed underneath) returns 409.
- [x] Book GENERATION's automatic QC does NOT run story QC (no per-chapter proofread step, no 📝
      appears just from generating) — story QC is opt-in via the sweep only.

### 80d. v55_m — accept individual corrections (per-sentence checkboxes)
- [x] A proposal with ≥2 fixes shows a checkbox per changed sentence (all checked) + a
      "select all / none" toggle.
- [x] Untick one fix, Accept → the story gets ONLY the ticked fixes; the unticked sentence keeps
      its original wording (verify by eye); spacing intact everywhere.
- [x] The resulting ai_error_hunt contains only the accepted corrections.
- [x] Untick everything + Accept → toast "no corrections selected" (nothing applied). Or if the
      server sees an empty selection, it discards (proposal gone, story unchanged).
- [x] Accept with all ticked → identical to the old whole-text accept.
- [x] Especially: a proposal that includes a corrected QUOTED sentence — unticking a DIFFERENT
      fix must not disturb the quoted one, and vice-versa (index alignment).

### 82. v55_n — summary QC (🔍 on the storyline summary)
- [ ] Open a storyline WITH a summary → a 🔍 appears in the summary strip header (next to ✏️).
      No summary, or static build → no 🔍.
- [ ] Click 🔍 → ⏳ while the QC model runs (console `── Summary QC ──` + verdict line); a review
      panel opens below the summary with per-sentence checkboxes (same UI as story QC §80d).
- [ ] Accept (all or a subset) → the summary text updates in place; toast; reload shows the new
      summary persisted on the storyline + summaryQcBy/summaryQcAt. NO ai_error_hunt is created.
- [ ] Discard → panel closes, summary unchanged, proposal gone.
- [ ] Clean summary → "no errors found", no accept button. Rewrite/corrupt → warning + discard only.
- [ ] Accept works with Ollama stopped after the proposal exists (accept route needs no backend).

### 83. v55_o — collapsible model selection (pickers in a pill popover)
- [ ] Home page (Ollama up): the backend row shows ONLY the pill (+ the model summary text) —
      the four selectors are gone from the row. The pill shows a ▾ caret and a "click to choose
      models" tooltip.
- [ ] Click the pill → a popover opens under it with Story / Lessons / Translation / QC selectors
      + the timeout field, stacked vertically. Click the pill again → closes.
- [ ] Click anywhere outside the popover → closes. Esc → closes. (Clicking INSIDE it — e.g. on a
      select — must NOT close it.)
- [ ] Switch a role in the popover → the toast fires, the pill label updates, and the popover
      STAYS OPEN (you can change several roles in one visit).
- [ ] Change the timeout in the popover → works as before (toast).
- [ ] Narrow window (<520px): the popover is usable (fixed, spans the viewport) and doesn't
      overflow off-screen.
- [ ] Ollama stopped / static build (docs/): the pill renders plainly — no caret, no tooltip,
      not clickable, no popover.

### 79f. v55_p — storyboard renders in the STATIC build's landing card
- [ ] With a storyline that has a storyboard: `node build-static.js`, open docs/index.html OFFLINE →
      the storyline card on the main page shows the storyboard panels ABOVE the summary strip
      (display-only; no 🎬 button, since canGenerate is false there).
- [ ] The live app still shows it identically (no regression).

### 84. v55_q — header lockup (globe left of title/tagline)
- [ ] Main page: the rotating globe sits to the LEFT of "dreizunge" + "we are the world" (title
      above tagline), the group centered as a whole. The globe still spins/bobs.
- [ ] Narrow window / mobile: the lockup stays on one row and doesn't overflow or wrap oddly.
- [ ] Static build (docs/): identical header.

### 85. v55_r — storyboard style + colour schemes
- [ ] Generate a storyboard for a storyline whose chapters use a distinctive style (e.g. "children"
      or "horror"): the server console's generation header now prints `style: <name>`, and the art
      should read accordingly (playful vs foreboding). A storyline with no styles prints
      `style: (default)`.
- [ ] 🎬 on a storyline WITH a storyboard → the menu now offers 🎨 Colour scheme (first), Regenerate,
      Delete.
- [ ] 🎨 → pick a scheme (Classic / Pastel / Vivid / Night / Monochrome; the current one is ticked)
      → the panels re-colour INSTANTLY (no model call, no ⏳ — the console logs
      "Storyboard re-coloured"). The landing card updates too.
- [ ] Night scheme: the art stays legible on the dark ground (ink inverts to a light stroke).
- [ ] Re-colour works with Ollama STOPPED (the route needs no backend).
- [ ] A storyboard generated BEFORE v55_r → 🎨 reports "predates colour schemes — regenerate it";
      after one regenerate, re-colouring works.
- [ ] Delete a storyboard, then check lessons.json: storyboard, storyboardPanels, storyboardMeta and
      storyboardScheme are ALL gone (no orphaned panel JSON).

### 86. v55_s — storyline generation stats in LIVE mode
- [ ] Live app → open a storyline screen: the per-chapter generation stats line(s) now appear at the
      bottom ("<chapter>: N.Ns · <model> · N tokens"), as they always did in the static build.
- [ ] The numbers match the static build's for the same storyline.
- [ ] A storyline whose chapters have no generationStats (very old topics) → the stats block stays
      hidden (no empty bar).

### 87. v55_t — storyboard fixed canvas + centred panels
- [ ] A 2-panel and a 5-panel storyboard side by side (different storylines): the panels are the
      SAME size, and both boards are the same height. (Before: the 2-panel board's art was ~2.5×
      bigger.)
- [ ] A board with fewer than 5 panels shows the panels CENTRED, with equal empty space either side.
- [ ] An EXISTING storyboard still shows the old sizing until re-composed → 🎬 → 🎨 → pick any
      scheme (even the current one) → it re-composes instantly with the new layout.
- [ ] Narrow/mobile: boards scale down but panels stay equal-sized across boards.

### 88. v55_u — QC review granularity + whitespace
- [ ] QC a story where the proofreader adds/removes a COMMA: the review shows ONE row for that
      sentence with just the comma marked — the following sentence is NOT merged into it, and there
      is no phantom "deleted sentence" row. (Was the Luxembourgish bug.)
- [ ] Any row with a multi-word insertion keeps its SPACES (no "moienhunnecheSpaziergaang").
- [ ] Untick one fix, accept → only the ticked fixes land, and the untouched sentences are
      byte-identical to before (spacing included).
- [ ] The header count matches the number of checkbox rows.
- [ ] The AI error-hunt built on accept still has its usual short clause-sized items (unchanged).
- [ ] A heavily-corrected story (fixes in most sentences) still reads as 'corrected', NOT 'rewrite'.
