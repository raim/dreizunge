# Dreizunge — roadmap v45

State at start of this roadmap: app is **v44** (server `APP_VERSION`, `/api/info`
+ visible label, live + static). Single `server.js` + `index.html`;
`build-static.js` bakes `docs/index.html`; data in `lessons.json`, strings in
`ui.json` (new English-only keys go in the `en` block), prompts in `prompts.json`.

## Standing workflow (unchanged)
Per change: new UI strings → `ui.json` `en` only, rendered via `t()`; after each
change run `node --check server.js`, syntax-check the inline script
(`node test/check-inline.js index.html`), rebuild docs if the client changed
(`node build-static.js lessons.json docs`), run `node test/run.js`, commit. Be
explicit about what's headless-verified vs needs a live browser/Ollama. The
headless suite lives in `test/` (see `test/README.md`); live-only checks are in
`LIVE-TEST-CHECKLIST.md`.

---

## v45 session 2 (this batch) — refactor + minors, all suite-green

**Blocker (RESOLVED this session):** the word_forms spec was provided, so the new
**word_forms lesson type is now shipped** (server generation + validation, client
play + editor, add-lesson option, tests). See "word_forms" below. The synonyms lesson now uses MULTI-SELECT 'select all' questions (syn_select): all
synonyms/antonyms are correct, mixed with distractors, base word shown in its context
sentence. (An interim single-select syn_context version was reverted per request.)

**word_forms lesson type (NEW — fill-the-blank from story sentences):**
- Server: `PROMPTS.wordForms`, `generateWordForms()` (3-attempt parse, qwen-friendly),
  pure `validateWordFormsItems()` enforcing the spec (exactly 4 distinct choices,
  valid correctIndex, a `___` blank, the correct answer must be the original story
  word, sentence must be derived from the story). Wired into the main dispatch +
  add-lesson. (`unit-word-forms`, `e2e-word-forms`; fake-Ollama branch added.)
- Client: `LESSON_TYPE_META`/`LESSON_DESC_KEY` (🧩); `buildWordFormsExercises()` +
  `tWordForm()` (reuses the choice grid + default checker); editor branch with a
  `wf` read-back in `_syncEditorFromDOM` + delete support; add-lesson option in both
  selects; `ui.json` keys. (`unit-word-forms-client`, wf case in `unit-editor-sync`.)
  Browser/Ollama checks owed — see LIVE-TEST-CHECKLIST §12.
- Migration note: word_forms now **supersedes** grammar/conjugation in the live UI —
  they're removed from the lesson-type pickers (#format-select + both add-lesson
  selects) and `all_types` generates word_forms + synonyms + error_hunt. Existing
  grammar/conjugation lessons still play/edit/regenerate (generators + META kept);
  only NEW generation of those two is hidden. The arc-mode "Grammar + conjugation"
  reinforcement toggle is intentionally left (separate axis; part of learning-arcs).
- Each item also carries a short source-language `explanation` (why the form fits),
  shown with 💡 in the play feedback and editable in the editor.

**Item 8 cheap-half refactor (the prerequisite for a new lesson type):**
- `LESSON_TYPE_META` table + `lessonTypeMeta/Emoji/Label` — collapsed 4 duplicated
  `{type→emoji}/{type→key}` maps. (`unit-lesson-type-meta`)
- `splitWords`/`wordCount` — one tokenizer; replaced 4 `wc` regex locals + 2 inline
  word-array splits. (`unit-word-count`; `pdf-selection`/`editor-sync` extractors now
  inject the shared helper.)
- `makeParentResolver(byId, byTopic)` — unified all 4 forward parent-resolvers; the
  inverse next-chapter finder is unchanged. (`unit-resolvers` exercises the real factory.)
- Folded `saveLessonEdits`' ~70-line DOM-read loop into `_syncEditorFromDOM(li,{persist})`
  (persist consumes the icon pick, clears `_editedCorrect`, fires `/api/save-story`).
  (`unit-editor-sync` covers the persist flag.)

**Minors (server, headless-verified):**
- Math LLM exercise count → `difficulty * 5` (`server.js` `generateMathLLM`; the TODO
  said index.html but the live line is server-side).
- `ui.json` hot-reload via `fs.watch` (non-destructive on parse error; self-write
  guard). `UI_FILE` is now env-overridable; `boot()` seeds a temp copy. (`e2e-ui-reload`)
- Original upload filename stored on the storyline (`sourceFile`): client →
  `/api/generate-book` → `base` → `_titleStorylinePostPass`. (`e2e-bookfile`)

**Cosmetics (browser-verify owed — see LIVE-TEST-CHECKLIST §11):**
- Library saved-list grouped/sorted by **source** language (was target).
- 8 icon-only `ui.json` strings hard-coded and removed from all 29 langs (232 keys).
- Zero-dependency inline-SVG **globe favicon** (tab icon).
- Lesson-row subtitle → `lessonSubtitle(L, topicDiff)`: vocab mode + difficulty,
  per-type description as fallback. (`unit-lesson-subtitle`)

**synonyms in-context rework (NEW — replaces the multi-select synonyms lesson):**
- The base word is now shown inside a story sentence (mirrors word_forms): single-
  select MCQ, pick the word similar/opposite to it (reuses the existing
  `ex.syn.q_*`/`ex.badge.syn_*` strings). `tWordForm` + `tSynContext` share a new
  `sentenceMcqCard`; both use the default checker.
- Server: `generateSynonyms` attaches a context sentence per group from the current
  story (extend) or also chain/storyline sentences (reinforce). `collectChainVocab`
  now returns `sentences`; new `_synSplitSentences`/`findContextSentence`. Schema
  (`words[]`) unchanged + a `sentence` per group.
- Editor: 🗑 delete-whole-entry, ＋ add-row per category, and an editable context
  Sentence. (`synEditorDeleteEntry`/`synEditorAddRow`.)
- Tests: `unit-synonyms`, `unit-syn-context`, syn case in `unit-editor-sync`,
  `e2e-synonyms`. Browser checks owed — see LIVE-TEST-CHECKLIST §13.
- Follow-up cleanup: the old multi-select `syn_select` render/check machinery is now
  unused (the builder emits `syn_context`) but left in place — it's woven through
  `check()` at ~7 sites, so removing it is its own small refactor.

**major: learning arcs (DONE this session):**
- Fused the two arc-setting label keys (`form.pdf_arc` + `form.gen_arc_lbl`) into one
  `form.arc_lbl` used by both the PDF and LLM-story book flows.
- New `POST /api/storyline/recreate-lessons` + `_runRecreateJob`: for each chapter
  in a storyline (in order) it hides the existing lessons (kept via the existing
  `_hidden` flag, already honored in play) and appends fresh arc lessons from the
  chapter's stored story — a standard vocab gate + reinforcement from chapter 2 (a
  whole-storyline vocab review by default, or word_forms + synonyms when
  arcMode='grammar'; the superseding types, not grammar/conjugation). (`e2e-recreate`.)
- Storyline screen now has a bottom action row (Continue / Download / Clear progress
  / Delete) with the headline "🔁 Re-create all lessons" replacing per-chapter
  add-lesson at the storyline level. (`unit-recreate-ui`; browser/Ollama checks in §14.)
- DONE: re-create now opens an arc-mode picker (vocab/grammar); was: a UI toggle to pick
  vocab-vs-word_forms/synonyms reinforcement could be exposed later.

**minors (DONE this session):**
- QC/flag count moved from the QC button to the edit ✏️ pencil (red badge; counts
  QC tags + user flags).
- Editors close on navigation: `show()` silently closes the open lesson editor when
  leaving the lesson-set screen, and the storyline title editor when leaving the
  storyline screen.
- Firefox TTS warning: `ttsHasNiceVoice` is browser-aware — Firefox local voices are
  treated as low quality (warn unless a cloud voice exists); wider robotic-name
  regex. Firefox behavior is live-verify-owed (§15).

**cleanups (DONE):** book-generation grammar arc now reinforces with word_forms +
synonyms (aligned with re-create + the lesson-type migration; legacy generators kept
only as a fallback); relabelled the arc grammar mode "Word forms + synonyms"; removed
unused ui keys (sl.recreate_confirm/recreating) and the dead _findNextChapterTopic.

**major: user flagging — DONE (both increments):**
- Editor side: item.userFlag = {comment, correct, at}; flag box has a "correct version"
  field + an apply row that writes it to target like a QC fix (userFlagApplyFix).
- Play side: a ⚐/⚑ flag button under each exercise opens a comment + correct-version
  form; saving writes userFlag onto the matched lesson object (vocab/sentence by
  target, word_forms item by sentence, synonyms word by base; unmatched →
  per-lesson _miscFlags). Persisted via /api/lessons/edit best-effort (static keeps it
  in memory for export). Play and editor flags are unified (same item.userFlag).
- Cleanup: removed the exercise half of the legacy APP.flagged system; story flagging
  still uses APP.flagged + the server flag endpoint (separate feature, left intact).
- Tests: unit-user-flag-editor, unit-play-flag.
- Editor flag UI now also covers word_forms + synonyms items (shared _flagBtnHtml/
  _flagBoxHtml helpers). Remaining follow-ups owed:
  flags on word_forms/synonyms items are now editable in the editor too; only
  _miscFlags (truly unmatched exercises) and static JSON export carrying the
  flags needs a live check.

**Still open from `todos_v45.md`:** none — all majors complete.

**major: static teacher-mode editing — DONE:** _canEdit() = canGenerate || _teacherMode
gates non-LLM edit affordances (lesson edit row, play-time flag UI) so they show in
static teacher mode and hide in static non-teacher mode; the QC 🔍 button and other LLM
features stay canGenerate-gated (stripped in static). All lesson-edit persistence routes
through _postLessonEdit() (server in live, in-memory no-op in static). Edits + QC/user
flags ride the JSON export because the static open-topic path sets APP.lessonData to a
reference into STATIC_LESSONS, which exportTopics serializes. (`unit-static-teacher`.)


---

## Done in this session (do not redo)
**TODO item 2 — store the full user input (`userPrompt`).** Committed.
- Investigation finding: the model was **never** shortchanged. `generate()` sets
  `userTopic = topic` (full) and builds the story prompt from it; only the saved
  *display* `topic` is a short LLM-generated title. Verified against real
  `lessons.json` (`userTopic` full; `storyPrompt` contains it verbatim).
- Change: persist one explicit field `userPrompt` = full topic + any pasted
  story + translation, added to both the early story-save and the final return in
  `generate()` (`server.js` ~1347, ~1467, ~1565). Additive; only `server.js`
  changed (no client/docs rebuild).
- Headless: `test/e2e-userprompt.test.js` (in `test/run.js`) asserts the full
  input is stored in topic mode and story mode, and that `storyPrompt` carries the
  full topic. Suite green.

**Fix — multi-chapter book truncated the topic to 80 chars.** Committed.
- This was the *real* shortening the user saw (the single-chapter path never
  truncated). `/api/generate-book` did `baseTopic = topic.trim().slice(0, 80)`, and
  for a generated batch `baseTopic` is chapter 1's story-prompt theme + the stored
  `userTopic`/`userPrompt` — so a long topic was cut before reaching the model.
- Fix (`server.js` ~2446): keep `baseTopic` full; shorten only the transient
  placeholder label (`baseTopic.slice(0,40)` at the `newBookJob` label and
  `_runBookJob`'s `placeholderTopic`), which the title post-pass overwrites anyway.
- Headless: `test/e2e-booktopic.test.js` (146-char topic) asserts chapter 1's
  `userTopic`/`userPrompt` are full, the display topic stays short, and the model's
  chapter-1 story prompt contains text past char 80.

**TODO item 6 — book gen: source-language storyline summary.** Committed.
- Added step 3 to `_titleStorylinePostPass` (`server.js` ~1898): build chain vocab
  from the chapters' lessons and call the existing
  `generateStorylineSummary(names, stories, vocab, base.srcLang)`, store via
  `upsertStoryline`. Best-effort (try/catch like the title steps).
- Headless: `fake-ollama.js` gained a summary route; `e2e-bookjob.test.js` asserts
  the storyline carries the generated summary.

**TODO item 7 — book gen: auto-QC the finished storyline.** Committed.
- After the title+summary post-pass, `_runBookJob` runs `_runQc` over all chapters
  (`onlyFlagged:false`) on a fresh job id, tagging items chain-wide; transient
  `bj.status = 'qc'`; best-effort.
- Headless: `fake-ollama.js` gained a QC verdict route; `e2e-bookjob.test.js`
  asserts items carry `.qc` tags after the book finishes.
- Note: this adds many translation-model calls per book (intended, per request).
  `bj.status='qc'` is a new transient status the client treats as "still running".

**TODO item 4 — conjugation: only canonical pronoun grouping.** Committed.
- The client merged ANY forms sharing a conjugated form (right for English, but
  over-fuses German: `ihr` with `er/sie/es`, `wir` with plural `sie`). Replaced the
  inline merge with `mergeConjugationForms(forms, lang)` (`index.html` ~5974): for a
  language with a defined paradigm it expands the model's rows to single pronouns and
  regroups only those sharing a form AND within one allowed cluster — German
  `{er,sie,es}`; English `{I,you,we,they}`/`{he,she,it}` — which also splits model
  OVER-grouping. Unknown languages keep the model's grouping untouched.
  `buildConjugationExercises(lesson, lang)` now takes the target lang.
- Prompt nudge (`prompts.json` conjugation): group only as the conventional paradigm,
  never coincidental; explicit German keep-separate rule.
- Headless: `test/unit-conjugation-grouping.test.js` (German only-er/sie/es, model
  over-grouping correction, English two clusters, unknown-lang pass-through). Docs
  rebuilt. **Live-LLM check owed**: confirm qwen now emits canonical rows (the client
  guard enforces correctness regardless).

**TODO item 5 — grammar reinforce: normalize injected words to a base singular noun.** Committed.
- Reinforce-mode grammar lessons inject prior-chapter words as gender/plural drill
  candidates, but inflected/plural/derived/verb forms don't fit and get rejected
  (many fails). Extracted the prior-nouns hint into
  `grammarPriorNounsNote(nounTargets, vocabMode)` (`server.js` ~1023); reinforce mode
  now tells the model to FIRST reduce each word to its base singular noun
  (`verbesserten`→`Verbesserung`, `Häuser`→`Haus`) and SKIP words with no related
  noun (never force a verb/adjective in). Extend mode keeps the prior AVOID hint.
- Headless: `test/unit-grammar-reinforce.test.js` asserts the reinforce note carries
  the normalization + skip instruction and lists the words, and extend is unchanged.
  Only `server.js` changed. **Live-LLM check owed** (does qwen actually normalize?).
- **Hard TODO (unsolved):** German adjectival/participial nouns have
  article-dependent gender (`ein Begeisterter` vs `der/die Begeisterte`); the drill
  can't present these cleanly — better to exclude nominalized adjectives/participles
  from gender drills than to try to handle them. Left for a future pass.

**TODO item 3 — lesson editor: preserve unsaved edits on delete/move.** Committed.
- `deleteEditorItem`/`moveEditorItem`/`mathDeleteExercise` mutated the in-memory
  lesson and re-rendered WITHOUT first reading current input values back, discarding
  unsaved edits to other entries. Added `_syncEditorFromDOM(li)` (`index.html` ~5146)
  — the same DOM→memory field routing as `saveLessonEdits`, but in-memory only (no
  server fetch) — and call it before every in-place re-render. A real save is still
  required to persist. Replaced the synonyms-only `_syncSynFromDOM` with the generic
  one (so title/icon edits survive a synonym-row delete too).
- Headless: `test/unit-editor-sync.test.js` (stub DOM) verifies vocab/sentence/grammar
  edits are pulled into memory and survive a subsequent delete. Docs rebuilt.
- Note for item 8: `saveLessonEdits` still has its own near-identical DOM-read loop;
  `_syncEditorFromDOM` should become the single source (saveLessonEdits would call it
  with a persist flag for the `eh-story` server save) during the refactor.

**TODO item 1 — TTS voice-quality warning.** Committed.
- When the chosen target language has no non-robotic voice (Firefox/Linux espeak-only,
  or no matching voice), a warning (styled like the static AI notice) appears under the
  language selector: the question, a **Test, 1, 2, 3** button that speaks in the target
  language, and an **Ecosia** link `speech output with <browser> in <OS>` from the UA.
- Pure helpers (`index.html` ~7281): `detectBrowser`, `detectOS`, `buildEcosiaQuery`,
  `ttsVoiceIsRobotic`, `ttsHasNiceVoice`. `updateTtsVoiceNote` lazily wires
  `voiceschanged` + a 1.5 s settle fallback (async `getVoices()`); refreshed from
  `applyUIStrings` + `selectLang`. New strings in `ui.json` `en` only. Lives in
  `lang-box`, so it works in live + static.
- Headless: `test/unit-tts-voice.test.js` (browser/OS detection, link, nice-voice
  heuristic across Firefox-Linux/Chrome/macOS/no-voice). Docs rebuilt.
- **Browser-only & owed:** the actual voice enumeration, the spoken test, and the
  rendering. "Nice voice" is a conservative heuristic — it flags clearly-bad cases
  (espeak/mbrola/none) and trusts everything else; tune the robotic-name list or the
  match logic if it mis-fires on a given setup.

---

## Triage of the remaining TODO items

Legend: **[H]** headless-doable now · **[L]** needs live Ollama to verify quality ·
**[B]** browser-only to verify · **[XL]** large / multi-session.

| # | Item | Class | Notes |
|---|------|-------|-------|
| 1 | TTS-quality warning + test button + Ecosia link | ✅ DONE | shipped this session (heuristic; browser-only parts owed) |
| 3 | Lesson editors: keep unsaved edits when deleting a row | ✅ DONE | shipped this session (`_syncEditorFromDOM`) |
| 4 | Conjugation: only fuse `er/sie/es`, not `ich/wir`, `du/euch` | ✅ DONE | shipped this session (client guard + prompt; live check owed) |
| 5 | Grammar reinforce: normalize injected words to singular noun, reject verbs w/o close noun | ✅ DONE | shipped this session (prompt instruction; live check owed) |
| 6 | Book gen: generate a source-language summary after titles | ✅ DONE | shipped this session (see Done section) |
| 7 | Book gen: run QC on the whole storyline after finishing | ✅ DONE | shipped this session (see Done section) |
| 8 | Cleanup / refactor / dir structure / drop migration code | [XL] | roadmap-only; suggestions below |

Recommended order for the next session: **8** is all that's left (the large
refactor). Items 1 and 3–7 are done; the live-LLM/browser verification owed for
1, 4, 5 is captured in `LIVE-TEST-CHECKLIST.md`.

---

## Per-item detail & pointers

### 1. TTS-quality warning (below the language selector; live + static) — ✅ DONE (this session)
Shipped: `updateTtsVoiceNote` + the pure helpers. Details in the Done section above.
(Original plan, for reference:)
Goal: detect whether a modern (non-robotic) speech-synthesis voice is available;
show a warning styled like the static-version AI warning, with a "Test, 1, 2, 3"
button that speaks in the chosen target language, plus an Ecosia link
`https://www.ecosia.org/search?q=speech+output+with+<browser>+in+<OS>` with
`<browser>`/`<OS>` detected.
- The AI warning to mirror in style: search `index.html` for the static AI-notice
  (shown when no tag filter is used) and copy its markup/placement.
- TTS plumbing already exists: `speakBodyText`, `ttsIsApproximate()`,
  `tts.approx` (search `index.html` for `speechSynthesis` / `ttsApproxBadge`).
  Reuse `ttsIsApproximate()` as the heuristic seed.
- **[H] extractable pure helpers** (unit-testable): `detectBrowser(ua)`,
  `detectOS(ua/platform)`, `buildEcosiaQuery(browser, os)`, and a
  `isLikelyNiceVoice(voices, langPrefix)` predicate (e.g. presence of a non-`localService`
  voice, or a known-good voice name list). Keep heuristics conservative and
  documented — "nice" is inherently fuzzy; prefer "we couldn't detect a high-quality
  voice" wording over false certainty.
- **[B]** actual voice enumeration (`speechSynthesis.getVoices()` is async/lazy),
  the spoken test, and rendering. New strings → `ui.json` `en`.
- Loose end to decide: voice list is empty until `voiceschanged` fires; the warning
  must re-evaluate on that event.

### 3. Lesson editors: preserve unsaved edits on row-delete — ✅ DONE (this session)
Shipped: `_syncEditorFromDOM(li)` called before delete/move re-renders. Details in
the Done section above. (Original plan, for reference:)
The complaint: deleting one entry in an editor drops other in-progress (unsaved)
edits. Fix = keep edits in an in-memory working buffer; delete mutates the buffer,
not a re-read from stored data; a save is still required to persist.
- TODO(next): locate the editors. Search `index.html` for the vocab/sentence/
  grammar/conjugation edit handlers (the edit UI opened from a lesson). The grep in
  this session for `deleteVocab|removeEntry|_editBuf` found nothing, so the editor
  likely uses different names — start from the edit-open entry point and the Save
  handler, identify the working-copy variable, and make delete operate on it.
- Verification is [B], but if the buffer is a plain array transform it can get a
  small [H] unit test like the pdf-selection helpers.

### 4. Conjugation grouping — only fuse `er/sie/es` — ✅ DONE (this session)
Shipped: `mergeConjugationForms(forms, lang)` + prompt nudge. Details in the Done
section above. (Original plan, for reference:)
Two places fuse pronouns:
- **Prompt** `prompts.json` → `conjugation.system` / `conjugation.user`: instruct
  "GROUP pronouns sharing an identical form … German `er/sie/es` → one entry".
- **Client** `buildConjugationExercises` (`index.html` ~5974, merge loop ~5981–5997):
  merges **any** forms sharing an identical conjugated form. This is the over-fusion:
  in German present tense it also fuses `ihr` with `er/sie/es` (both `geht`) and
  `wir` with `sie`-plural (both `gehen`).
- Subtlety (why this isn't trivially safe): the identical-form merge is **correct
  and desirable for English** (`I/you/we/they → watch`, `he/she/it → watches`).
  Removing it wholesale would make English verbose. Proposed approach: a small
  language-aware "allowed syncretism" map keyed by lesson target lang, e.g.
  `de: only {er, sie, es} may co-group`; `en: {i,you,we,they} and {he,she,it}`;
  unknown langs → trust the model's grouping (don't re-merge). Then the client merge
  only combines pronouns that stay within one allowed cluster.
- **[H]**: `buildConjugationExercises` (or an extracted `mergeConjugationForms`)
  is pure → unit-test the German case (ich/du/wir/ihr stay separate; only er/sie/es
  merge) and the English case (two clusters preserved).
- **[L]**: confirm the prompt change makes qwen emit the canonical paradigm.

### 5. Grammar reinforce: noun-form normalization — ✅ DONE (this session)
Shipped: `grammarPriorNounsNote` reinforce instruction. Details in the Done section
above; the ambiguous adjectival-noun gender case remains an open hard TODO.
(Original plan, for reference:)
Reinforce injects prior words (verbs, plurals) that don't fit a noun-gender drill,
causing excess fails. Instruct the model (in the grammar/reinforce prompt) to:
(a) reduce each injected word to its base **singular noun** (e.g. `verbesserten`
→ `Verbesserung`); (b) **reject** an injected word if no close noun exists (e.g. a
pure verb with no nominalization). Pointers: `prompts.json` grammar prompt; server
grammar generation around `_gNouns`/`chainVocab` (`server.js` ~1027) and
`generateGrammar`. **[L]** only — quality must be checked with a real model; add a
checklist entry. **TODO (hard, document-only):** German adjectival nouns have
article-dependent gender endings (`ein Begeisterter` vs `der/die Begeisterte`); the
reinforce drill can't reliably present these — consider excluding nominalized
adjectives/participles from gender drills rather than trying to handle them.

### 6. Book gen: source-language summary after titles — ✅ DONE (this session)
Shipped: step 3 of `_titleStorylinePostPass`. Details in the Done section above.
(Original plan, for reference:)
The single-storyline summary already exists:
- `generateStorylineSummary(topics, stories, vocab, srcLang)` (`server.js`:708),
  exposed at `POST /api/storyline-summary` (2703) and stored via
  `sl.summary = …; upsertStoryline(sl)` (2722).
- Add a **step 3** to `_titleStorylinePostPass` (`server.js`:1879, right after the
  storyline title at ~1896, where `sl` is already resolved): collect
  `topics`/`stories`/chain vocab, call `generateStorylineSummary(..., base.srcLang)`,
  set `sl.summary`, `upsertStoryline(sl)`. Best-effort/try-catch like the title steps.
- **[H]** verify with the fake-Ollama harness (add a summary route to the fake):
  after a generated arc book, the storyline has a non-empty `summary`. Extend
  `test/e2e-bookjob.test.js`.

### 7. Book gen: QC the whole storyline after finishing — ✅ DONE (this session)
Shipped: auto-QC step in `_runBookJob` after the post-pass. Details in the Done
section above. (Original plan, for reference:)
The QC the user triggers from the saved list:
- `_runQc(jobId, topics, opts)` (`server.js`:534); `qcCheckPair` (488);
  `POST /api/qc` (2197); client trigger posts to `/api/qc` (`index.html` ~2924).
- At the end of `_runBookJob` (after `_titleStorylinePostPass`), run `_runQc` over
  the chapter topics so the whole storyline is tagged automatically. Decide scope
  (all items vs only-flagged — the manual QC supports `onlyFlagged`; book QC should
  be all items). Run it as its own job id, or inline, and surface progress in the
  book stepper. Best-effort; don't fail the book if QC errors.
- **[H]** with the fake harness: after the book finishes, the chapter lessons carry
  QC tags. (QC is LLM-driven; the fake returns canned pair-checks, so this verifies
  wiring/tagging, not QC quality.)

### 8. Cleanup / refactoring — [XL] (document-only; suggestions)
Concrete candidates observed while working in the code:
- **Split `server.js`** (~2.8k lines) into modules: `llm/` (generate, prompts I/O,
  parsing/repair), `store.js` (load/save/upsert/storylines/chain walking), `qc.js`,
  `book.js` (`_runBookJob` + post-pass), `http.js` (route table). Keep zero-dep.
- **Split `index.html`'s inline script** into source files concatenated at build
  time (the suite already extracts functions by brace-matching, so a real module
  boundary would help). Today everything is one ~350 KB `<script>`.
- **Drop old migration code**: `migrate-v41.js`, `merge-collapsed-forks.js`, and any
  in-`server.js` schema-upgrade branches for pre-v29 stores (search for
  `schemaVersion <`/migration). Gate removal on confirming no users remain on old
  schemas, or move them to a one-shot `tools/` script.
- **De-duplicate the type→emoji/`lesson.type.*` maps**: the
  `{grammar:'🏷️',conjugation:'🔤',…}` + matching key map is repeated ~5×
  (`index.html` ~1260/3460/4853/5310/7004). Extract one `LESSON_TYPE_META` table +
  a `lessonTypeLabel(type)` helper.
- **Unify word-count helpers**: `s.split(/\s+/).filter(Boolean).length` is inlined
  in many places (PDF split/merge, selection, arc). One `wordCount()`.
- **Centralize parent resolution**: the id-first/same-language-guard resolver was
  hand-written at 4 sites in v44 (`_slResolveParent`, `_resolveParentB`,
  `_delResolveParent`, the next-chapter finder). Extract one shared resolver.
- **Directory structure**: move CLI tools (`generate-lessons.js`, `qc-lessons.js`,
  `translate-lessons.js`, `export-lessons.js`, `merge-collapsed-forks.js`,
  `migrate-v41.js`) into `tools/`, docs into `docs-src/` (keep generated `docs/`),
  and the many `*.md`/`*.dot`/`*.svg` design notes into `notes/`.

---

## Should the next session refactor first, or build features? (guidance)

**Verdict: the code is fine for another round of feature work — do NOT front-load
the full item-8 refactor.** The architecture that matters for features is intact:
lesson types dispatch through one seam (`buildExercises` → `build<Type>Exercises`),
generation is centralized (`generate()` + `prompts.json`), persistence goes through
`upsert`/`upsertStoryline`, UI strings flow through `ui.json` + `t()`. The cruft is
*editing friction* (two big files), not architectural rot, and the `test/` suite +
`check-inline.js` + `LIVE-TEST-CHECKLIST.md` are a real safety net for both features
and the eventual refactor. So there's no "refactor before it's too late" urgency.

Decision rule for the next session:
- **UI cosmetics, new/!changed prompts, tweaks to existing lesson types, small
  server features** → just build them. No cleanup prerequisite.
- **A NEW lesson type** → first do ONLY the *cheap half* of item 8 (≈20 min, low-risk,
  suite-guarded), because a new type otherwise has to be wired into all the duplicated
  spots by hand (easy to miss one):
  1. Extract one `LESSON_TYPE_META` table + `lessonTypeLabel(type)` (replaces the
     ~5 copied `{grammar:'🏷️',…}` maps at `index.html` ~1260/3460/4853/5310/7004).
  2. One `wordCount(s)` helper (replaces the inlined `split(/\s+/).filter(Boolean).length`).
  3. One shared parent-resolver (replaces `_slResolveParent`/`_resolveParentB`/
     `_delResolveParent`/next-chapter finder).
  4. Fold `saveLessonEdits`' DOM-read loop into `_syncEditorFromDOM` (persist flag).
  Then add the lesson type as a single-table change. SKIP the *expensive half*
  (splitting `server.js`/the inline script, directory moves) until it actually hurts.

A new lesson type also touches, beyond the dispatch: the editor (`renderLessonEditor`
+ `_syncEditorFromDOM` routing), QC (`qcCheckPair`/`_runQc` if it has checkable
pairs), the type filter chips, and `prompts.json` (+ a generator like
`generateGrammar`). The cheap dedup above makes #1–#3 of those one-liners.

---

## Loose ends from my side (Claude)
- **Conjugation (item 4)** done via a language-aware grouping map (German `{er,sie,es}`;
  English's two clusters; unknown langs untouched), so English is not regressed. The
  prompt was also tightened; a live-LLM pass is still owed to confirm qwen emits
  canonical rows (the client guard already enforces it regardless).
- **`userPrompt` duplication**: for pasted-story mode, `userPrompt` now includes the
  story text, which also lives in `story` (intentional — one self-contained field —
  but it does duplicate large stories in `lessons.json`). If storage matters, switch
  `userPrompt` to topic-only and rely on `story` for the body.
- **Editor (item 3)** done: the editor is `openLessonEditor`/`renderLessonEditor`;
  `_syncEditorFromDOM` now guards delete/move/filter re-renders. Remaining tidy-up
  (item 8): fold `saveLessonEdits`' duplicate DOM-read loop into `_syncEditorFromDOM`.
- **Test harness** lives in `test/` and is committed. The fake Ollama
  (`test/fake-ollama.js`) now has routes for summary and QC pair-checks (added for
  items 6/7), plus the earlier title/story/vocab routes.
- **Book auto-QC cost & UX (item 7)**: QC now runs automatically after every book,
  adding many translation-model calls per book — fine for a self-hosted setup but
  noticeable on large books. Consider (a) a client toggle to opt out, (b) surfacing
  QC progress in the book stepper (it currently only sets `bj.status='qc'`; the
  per-item `jobStep` goes to a throwaway job id), and (c) limiting auto-QC to
  `onlyFlagged` or to a size cap. Same optionality question applies to the summary
  (item 6) if a user doesn't want it.
- **Live check owed for 6/7**: with a real model, confirm the summary reads well in
  the source language and that auto-QC tags are sensible (the fake only verifies
  wiring/tagging, not QC quality). Add entries to `LIVE-TEST-CHECKLIST.md`.
- **Repo location**: the canonical git repo now lives in the `dreizunge_v44/` folder
  (history carried over from the v43 work). The older `dreizunge_v43_final/`
  directory is stale.
- **Roadmap doc** `roadmap_v44.md` and `roadmap-v43.md` still describe earlier state
  in prose; this file (`roadmap_v45.md`) supersedes them.

## Still owed live verification (unchanged from v44)
See `LIVE-TEST-CHECKLIST.md`: item-4-class conjugation/grammar prompt quality, the
generated-continuation coherence, and all browser-only items (export, storyline
render, arc labels, rating labels, drag-to-highlight). Anything added for items
5/4/1 above will need new checklist entries.

## Post-v45 follow-up batch (this session)
- **word_forms prompt hardening (round 2):** the `translation` must be in the learner's
  language {S} (a full translation), never the {L} sentence or the blanked sentence with
  the answer filled in (the redundant-with-solution failure); validator rejects such
  echoes. `explanation` is now OPTIONAL (may be `""`) but the field is kept for manual
  editing / better future models. (`unit-word-forms`.)
- **Continue-story picker** filters by BOTH current target and source language unless
  "show other languages" is ticked. (`unit-continue-filter`.)
- **Math LaTeX (LLM) lessons** render read-only in the lesson editor with per-exercise
  flag + delete (no procedural regen controls); `buildMathExercises` keeps
  `lesson.exercises` so they persist.
