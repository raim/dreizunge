# Dreizunge v42 — summary

**v42 adds:** a synonyms/antonyms/homophones lesson type and a standalone
Markdown/HTML export script (`export-lessons.js`) for storylines and topics as
chapters. It also carries all v41 work (topic-id migration + the follow-up
fixes/features below).

## v41 → v42 changes
- **Lesson generation accepts sparse output (>=1 item).** Minimum-count gates that rejected
  whole lessons (and forced retries/failures like "Only 3 vocab items") are relaxed across
  all types: standard vocab now needs only >=1 item with sentences optional (the too-short /
  min-sentence rejections removed); grammar >=1; synonyms >=1; the vocab-table parser >=1 with
  sentences optional. Conjugation already accepted >=1; error-hunt is quality-gated (story
  length/changes), not count-gated, so it is unchanged. Empty output (0 items) is still
  rejected. The source==target "model ignored source language" check is kept (it is a
  correctness signal, not a count).
- **Synonyms prompt now in `prompts.json`** (`synonyms` section, same shape as `grammar`:
  `system`/`user`/`storyHint`/`dialectNote`/`writingStyleNote`). `generateSynonyms` uses it via
  `fillPrompt`, with the previous inline prompt kept as a fallback for deployments whose
  `prompts.json` lacks the section.
- **Synonyms in the + (add-lesson) pipeline:** added to both add-lesson format selectors
  (lesson-card / lessonset and the per-storyline saved-item panel), so a synonyms lesson can
  be added to an existing topic from the storyline and lessonset screens. `doAddLesson` sends
  `lessonFormat:'synonyms'` to `/api/lessons/add-lesson`, which already has the branch.
- **Synonyms lesson type** (`lessonFormat: 'synonyms'`, 🔁 in the selector). The LLM
  picks key words from the story and returns better in-context synonyms, antonyms, and
  homophones in the target language (glossed in the source language). These are flattened
  into a standard **vocab** lesson, so the existing flashcard/MCQ player, checker, and
  editor handle it with no new lesson type. Wired into generate, generate-book, and
  add-lesson. (`generateSynonyms` in server.js.)
- **`export-lessons.js`** — standalone script: exports selected storylines (`sl_…`) and
  topics (`tp_…`) as a Markdown (default) or HTML "book", topics as chapters, with stories
  and lessons; furigana stripped. `--list`, `--no-lessons`, `--html`, `--out`. Default
  (no ids) exports all storylines.
- **Own-story input "✕ Clear" button**; **server logs lesson deletion**; story-length
  slider min lowered to 50 (see note below on the server word-count floor).

---

# Dreizunge v41 — Session Summary

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~6767 | Main app (live + static) |
| `server.js` | ~2165 | Node.js backend |
| `build-static.js` | ~741 | Static docs builder |
| `llm.js` | ~200 | Backend-agnostic LLM interface |
| `prompts.json` | ~15 keys | All LLM prompt templates (hot-reloaded) |
| `ui.json` | 243 keys | UI strings, English only for new keys |
| `lessons.json` | user-provided | All lesson/storyline data (schema v29) |
| `docs/index.html` | pre-built | Static deployment (GitHub Pages) |

---

## What Changed in v41 (vs v40) — Topic-ID Migration

**Goal:** chains, lesson loading, and storyline references now use the stable
`tp_` ID instead of the mutable `topic` name, so LLM renames / user edits no
longer break chains or cause collisions. `_topicId()` is **unchanged** (existing
stored IDs remain valid). Done in five steps + two client slices; each step was
verified against the real 123-topic / 50-storyline `lessons.json`.

### Step 1 — Boot-time migration (`server.js`, `migrateTopicRefs` IIFE)
Idempotent, runs every boot for schema ≥ 29. Assigns `_topicId(name)` to any
topic lacking an `id` (once, never recomputed); resolves each topic's
`continuedFrom` **name** to the parent's **stored** `.id`, written to a new
`continuedFromId` field; orphans → `continuedFromId = null` + warn. Never edits
`storylines[]`. **Critical:** resolves to the parent's stored id, NOT
`_topicId(name)` — 16 existing chains point at renamed parents whose stored id
differs from the hash of their current name. Verified: 75/75 resolved, 0 orphans,
16/16 rename-cases correct, storylines + topic-ids byte-identical, idempotent
(second run writes nothing).

### Step 2 — Id-based chain logic (`server.js`)
`collectChainVocab(startRef)` and `_syncStorylineForTopic()` walk by
`continuedFromId` via `findSavedById`; `generate()` resolves and stores
`continuedFromId`; the forward-walk fork filter matches on id. Fixed a latent bug:
`_syncStorylineForTopic` used `tid = _topicId(topicName)` (wrong for renamed
topics) — now uses the stored id. Verified **0/123** behavioural difference vs the
old name-walk on current data.

### Step 3 — Endpoints (`server.js`)
`/api/lessons/load?id=` and `/api/lessons/delete?id=` added alongside `?topic=`
(kept for back-compat). `continuedFromId` added to the `/api/lessons` list
payload. Delete now matches by **reference identity** (a name collision can't
delete the wrong topic) and is idempotent. Verified live via curl.

### Slice A — Client identity / navigation (`index.html` + `build-static.js`)
- `loadSaved(ref)` / `deleteSaved(ref)` / `continueFromLesson(ref)` accept a
  `tp_` id (preferred) or a name (back-compat, detected via `/^tp_\d+$/`).
- Saved-item click, delete, and continue buttons pass `s.id`.
- Lesson-detail `← parent` / `→ child` links navigate by `continuedFromId`; the
  parent label resolves its **current** name from the id (survives renames).
- `continue-select` option values are ids; the `/api/generate` handler normalizes
  an incoming id-or-name to the canonical topic name (`findSavedById || findSaved`).
- Mirrored in `build-static.js`: its own `loadSaved`, `repopulateContinueSelect`,
  and `itemHtml` (three separate pitfall-7 copies).

### Slice B — Chain assembly id-keyed (`index.html` + `build-static.js`)
`loadSavedList` builds chains as arrays of **ids** (via the existing `byId`
index); the legacy `continuedFrom`-name reconstruction now uses `continuedFromId`;
`matchSl` compares chapter ids directly (collision-safe). The name-keyed `byTopic`
map is removed from both `loadSavedList` implementations. The storyline-deck
payload is still names (resolved from ids at the boundary) — see Deferred below.
Verified: id-based assembly yields **identical** chains (29) to the old name-based
one on current data; static rebuilds clean.

### Step 7 — Rename cascade removed (`server.js`)
The `save-meta` handler no longer rewrites `continuedFrom` name pointers across all
topics. Chains reference the parent's stable id, which a rename leaves unchanged.
**End-to-end regression proven:** renaming a chain parent keeps the parent id
stable, the child's `continuedFromId` valid, and the storyline chapters unchanged
(the child's `continuedFrom` name goes stale but is display-only and resolved live
from the id).


### Post-release fixes (same session)
- **Storyline screen stale-after-rename:** `_renderStorylineScreen` now re-resolves
  chapter names from the storyline's id chapters every render, so a renamed chapter
  shows immediately (no page refresh). Inherited by the static build.
- **Delete a fork branch:** the delete handler now re-merges a collapsed fork. When a
  deleted topic's parent is left with a single remaining child, the parent's storyline
  and that child's storyline are merged into one chain (parent storyline id/title/icon
  preserved); dangling `continuedFromId` on the deleted topic's children is cleared.
  Verified: fork-collapse merges to one storyline with no collateral change to other
  storylines; tail/orphan deletes unaffected. KNOWN LIMITATION (pre-existing, not
  addressed): deleting a *middle* chapter of a linear chain still leaves the two
  surrounding chapters grouped in one storyline object until regeneration.

### ⚠ Deferred (intentional, documented — not done in v41)
- ~~Storyline-deck / screen rendering + TTS name-keying~~ ✅ **DONE (identity level):**
  `_renderStorylineScreen` derives canonical **`chapterIds`** from the storyline's id
  chapters and stores them on `APP._slScreen.chapterIds`. Progress/stats loops iterate
  by id; the global `byTopic` map is **overridden** so this deck's chapters resolve to
  the correct objects even if another storyline has a same-named topic; chapter cards
  already load by id (Slice A). Both read-aloud/TTS paths (inline deck 🔊 and
  `speakBodyText`) prefer `chapterIds` and load stories by `?id=`. Verified against a
  seeded cross-storyline name collision: the deck resolves the correct chapter by id
  where the old name lookup was ambiguous.
  REMAINING name-based (documented, lower-risk): the recursive `_renderChain`/`_succMap`
  branch detection still walks by name (but the overridden `byTopic` makes the deck's
  own chapters resolve correctly; only cross-storyline *branch stubs* — greyed,
  non-interactive — use global name lookup). The `data-chain` attribute payload stays
  name-encoded for history/back-compat (TTS prefers `chapterIds` over it). The
  **progress data structure** (`APP.progress.completed[topicName]`) remains name-keyed;
  the deck reads it via the current resolved name. Converting that structure is a
  separate migration.
- ~~Rename endpoint name-keyed~~ ✅ **DONE (rename-by-id):** `save-meta` resolves by
  `id` (name fallback) and updates the topics array by **reference**, not by name —
  fixing a data-loss bug where an emoji-only change or rename-to-existing-name would
  delete a same-named sibling. Same-name topics are now legal (distinct ids). Client
  rename callers (`saveSavedItemTitle`, `clearSavedItemTitle`, `saveLessonTitleEdit`,
  lesson-set gen-title) send `id`. Verified: renaming one of two same-named topics by
  id leaves the sibling intact; 123 topics preserved through emoji-only change.
- ~~Add-lesson / edit helpers name-keyed~~ ✅ **DONE:** `/api/lessons/add-lesson` and
  `/api/lessons/edit` resolve by `id` (name fallback); clients (`doAddLesson` and the
  four lesson-editor `edit` callers) send `id` (`s.id` / `APP.lessonData.id`). Verified:
  edit-by-id changes the target and leaves a same-named sibling untouched; add-lesson
  resolves the right topic by id.

### ⚠ Deploy order for the static build (important)
`build-static.js` bakes whatever is in `lessons.json` into `STATIC_LESSONS`.
`continuedFromId` is written by the **server boot migration**, so the order is:
**(1)** boot `server.js` once (migrates `lessons.json` in place, adding
`continuedFromId`), **(2)** then `node build-static.js`. Topic `id`s are already
present, so load-by-id and continue-by-id work in the static build even before
migration; only the chain-nav `continuedFromId` fallback needs the migration.

---

## What Changed in v40 (vs v39)

### Furigana — Core Infrastructure (`index.html`)

Three new helper functions added near `escHtml`:

**`furiHtml(text)`** — converts `kanji[よみ]` bracket notation to `<ruby>/<rt>` HTML and HTML-escapes all plain text segments. Use this anywhere unescaped text goes into `innerHTML`. Pre-strips any `[...]` following non-kanji characters (defensive against model over-annotation).

**`stripFuri(text)`** — strips all `kanji[よみ]` annotations down to bare kanji. Use for TTS. Also strips non-kanji annotations. Called automatically in `_ttsChunks` so no annotation ever reaches the speech synthesiser.

**`applyFurigana(text)`** — existing function, updated to also pre-strip non-kanji annotations before converting/stripping kanji ones.

**Key rule**: `furiHtml` is for `innerHTML` contexts where the input is raw (unescaped) text. `applyFurigana` is for contexts where the input is already going into a template literal that itself becomes innerHTML without prior escaping (e.g. `tMcqIE`, `tRead`). Never use `escHtml` then `applyFurigana` — escaping first breaks the bracket regex.

### Furigana — All Render Sites Fixed (`index.html`)

Every place where Japanese text reaches the DOM or TTS now goes through the right function:

- **`lBlock`** (blue "Tap to listen" field) — `furiHtml(it)` for display; TTS via `esc(it)` passes raw to `speak()` → stripped in `_ttsChunks`
- **`tOrder` word bank tokens** — `furiHtml(w)` replaces `applyFurigana(escHtml(w))` (escaping before furigana was breaking the regex)
- **`updateSbox` placed tokens** — same fix
- **`cGrid` choice buttons** — `furiHtml(c)` so answer options show ruby
- **`check()` correct-answer feedback** — `furiHtml(ex.target||ex.correct)` and `furiHtml(ex.correct)` for wrong-answer display; all `speakOk`/`speakBad` values go through `stripFuri()`
- **Correct-button highlight after wrong answer** — compares `b.textContent.trim()` against `stripFuri(ex.correct)` since `textContent` strips HTML tags
- **`tMcqIE` question word** — `applyFurigana(ex.target)` (was already correct)
- **`tMcqEI` question word** — `furiHtml(ex.source)` (source language furigana)
- **`tOrder` question sentence** — `furiHtml(ex.source)` passed into `t()` interpolation
- **`tMcqArticle`, `tMcqPlural`, `tTypePlural`** — `furiHtml(ex.source)` for source hint line
- **`tMcqConjugation`, `tTypeConjugation`** — `furiHtml(ex.source)` for pronoun/source hint line
- **Complete screen vocab chips** — `furiHtml(v.target)` and `furiHtml(v.source)`
- **`revealBody` source part** — `furiHtml(ex.source)` (the `— source` after correct answer)
- **`renderStoryText()`** — `furiHtml(d.story)` for lesson-set screen story panel; vocab highlight regex uses `stripF()` on vocab words to match rendered text
- **`toggleSavedStory()`** — same for landing library story panels
- **`_renderChainStory()`** — same for "Read full story" on storyline screen
- **`speakStory()`** — `stripFuri(d.story)` before `speak()`
- **`speakBodyText()`** — `stripFuri()` applied to all text paths before TTS; `preText` also stripped

### Furigana — Word Order Token Re-derivation (`index.html`)

`mkOrder()` now ignores stored `s.words` for Japanese and re-derives tokens live from `s.target` using the furigana-aware regex. This fixes all existing lessons where `deriveSentenceWords` on the server had fragmented kanji+annotation groups into broken 2-character pairs (e.g. `は免`, `許証`). The stored `s.words` data in `lessons.json` is now ignored for Japanese — harmless to leave.

Token merging logic (>14 tokens → merge pairs) mirrors the server logic.

`ex.correct` is also rebuilt from the clean canonical tokens, so the answer check still works.

### Furigana — Prompts (`prompts.json`)

**Story prompt** (`story.furiganaNote`) changed from HTML `<ruby>` tags to bracket notation `漢字[よみ]` — the old instruction was causing raw `<ruby>` tags to be stored in `lessons.json` and display literally.

**Difficulty-aware annotation** — three levels for each note type:

| Key suffix | Behaviour |
|---|---|
| `1` (beginner) | Annotate EVERY kanji without exception — "learner cannot read any kanji yet" |
| `2` (intermediate) | Annotate each kanji (standard behaviour) |
| `3` (advanced) | Annotate only less common/complex kanji; skip common N4/N5 kanji |

Applies to: `vocab.cjkNote1/2/3`, `vocab.srcCjkNote1/2/3`, `vocabFromText.cjkNote1/2/3`, `vocabFromText.srcCjkNote1/2/3`, `vocabTable.cjkNote1/2/3`, `vocabTable.srcCjkNote1/2/3`, `story.furiganaNote1/2/3`.

The flat `cjkNote` / `srcCjkNote` / `furiganaNote` keys remain as fallbacks (`|| P.cjkNote`).

**Kana-only annotation prevention** — all notes now explicitly say "Only annotate kanji (CJK characters) — do NOT annotate hiragana, katakana, or punctuation." This prevents the model from producing e.g. `おげんきですか？[おげんきですか？]`.

**Source language furigana** — new `srcCjkNote1/2/3` keys instruct the model to annotate kanji in `source` fields when the translation/source language is Japanese.

**Story styles** — canonical values for `funny` and `philosophical` (use these in all future edits):
- `funny`: `"You are a comedian, tell jokes, use wordplay, absurdist situations, punchlines."`
- `philosophical`: `"Be philosophical: contemplative, questioning, discuss abstract ideas."`

### Furigana — Server (`server.js`)

`sysLesson`, `sysLessonFromText`, `sysLessonTable` — all now select the difficulty-appropriate note:
```js
if (lang === 'ja')    sys += P['cjkNote'+d]    || P.cjkNote;
if (srcLang === 'ja') sys += P['srcCjkNote'+d] || P.srcCjkNote;
```

`sysStory` — new `difficulty` parameter added; selects `furiganaNote1/2/3`. Call site in `generate()` updated to pass `difficulty`.

### TTS Regression Fix (`index.html`)

The v39 Firefox fix had removed `setTimeout` delays after `speechSynthesis.cancel()`, breaking Chrome — utterances were silently dropped because `cancel()` is asynchronous. Restored:

- **`_speakAndAdvance`** — `setTimeout(() => speechSynthesis.speak(u), 50)` restored after `cancel()`. Critical: without this the `onend` callback never fires and the lesson never advances to the next question.
- **`_doSpeak`** and **`_doSpeakLang`** — `wasSpeaking` detection restored. 50ms delay applied only when something was already playing; direct call when idle (preserves Firefox user-gesture context while protecting against cancel-race when interrupting ongoing speech).

---

## ⚠ Furigana Known Limitations

**Existing lessons without furigana**: 5 of 6 Japanese topics in the sample `lessons.json` have no furigana on vocab/sentences (the model ignored the instruction at generation time). These need regeneration — no client-side fix possible. The `words` arrays in those lessons are also broken (character-pair fragmentation from the server), but this is now harmless since `mkOrder` re-derives tokens from `s.target`.

**Japanese UI strings**: `ui.json` Japanese translations have no furigana (164 kanji-containing strings). Not worth adding — UI strings go through `textContent` not `innerHTML`, would require switching to `innerHTML` with security implications, and the kanji in UI labels are common enough for any Japanese-UI user.

**Chinese**: No pinyin annotation system exists. `CJK_LANGS` includes `zh`, the furigana checkbox already shows for `zh`, and `furiHtml` regex already matches CJK. Adding it would mean new `cjkNote` variants for `zh` in `prompts.json` and extending the `lang === 'ja'` checks in `server.js`. Deferred — pinyin accuracy from small models needs testing first.

---

## ⚠ Pitfalls for Future Claude Sessions

### 1. UI translation strings: t() in static HTML vs JS template literals
`${t('some.key')}` only works inside JavaScript backtick template literals. In static HTML it renders literally. Always use `_setText('element-id', t('key'))` in `applyUIStrings()`.

### 2. New ui.json keys: English only, no empty strings
Add only to `en` entry. Empty strings `""` in other languages look like existing translations and are skipped by the offline translation script.

### 3. updateTeacherModeBtn timing
Always call from `applyUIStrings()` (after strings load), not from `init()` directly.

### 4. DOM structure side effects
When a layout breaks after a feature addition, check parent/sibling relationships in the DOM tree, not just CSS.

### 5. `<button>` cannot contain `<div>` children
Use `<div role="button" tabindex="0">` for complex collapsible headers with nested action buttons.

### 6. `useFullChain` vs `OLLAMA_MAX_PREV_STORY`
Always verify new feature flags are actually wired, not just destructured.

### 7. build-static.js completely overrides several functions
`importLessons`, `init`, `loadSavedList` in `build-static.js` are hardcoded overrides — changes to those in `index.html` have NO effect on the static build. Always check `build-static.js` when a feature works in live but not in static.

### 8. build-static.js code injection format
Each logical line must be its own `'...',` entry. Embedded `\n` in a string literal breaks the outer JS.

### 9. furiHtml vs applyFurigana vs escHtml
- `furiHtml(text)` — raw unescaped text → safe HTML with ruby tags. Use in template literals going to `innerHTML`.
- `applyFurigana(text)` — already-safe text (will be interpolated into innerHTML without further escaping). Use in `tMcqIE`, `tRead` style functions.
- NEVER `escHtml(text)` then `applyFurigana()` — escaping brackets first breaks the regex.
- `stripFuri(text)` — for TTS only. Also called automatically in `_ttsChunks`.

### 10. speechSynthesis.cancel() is asynchronous
Always use `setTimeout(() => speak(u), 50)` after `cancel()` in `_speakAndAdvance`. In `_doSpeak`/`_doSpeakLang`, use the `wasSpeaking` pattern: 50ms delay only if something was playing, direct call if idle. Removing all delays breaks Chrome (utterances silently dropped); removing the `wasSpeaking` check and always delaying breaks Firefox user-gesture context.

### 11. speakBodyText data-lang rule
`speakBodyText(id)` without explicit langCode reads `data-lang` from the element. This is the correct pattern. Only pass explicit langCode to override (lesson exercises use target language). `APP.srcLang` must never be passed directly — it can be `'all'`.

### 12. build-static.js has its own summary rendering
Around line 490, separate from `index.html`'s `storylines_renderChain`. Always check both when modifying summary speech or story rendering behaviour.

### 13. build-static.js also has its OWN `itemHtml`/`savedItemHtml`, `loadSaved`, and `repopulateContinueSelect`
Beyond `loadSavedList`/`init`/`importLessons` (pitfall 7), `build-static.js` injects a separate static `itemHtml` (saved-item card, ~line 316) and a static `loadSaved` (~line 524) and `repopulateContinueSelect` (~line 180). Editing the saved-item card, the continue dropdown, or `loadSaved` in `index.html` does NOT propagate — you must edit the build-static copies too. Verify by building (`node build-static.js lessons.json docs`) and grepping `docs/index.html`.

### 14. A renamed topic's stored id ≠ `_topicId(currentName)`
`_topicId` hashes the name, but ids are assigned once and never recomputed, so after a rename the stored id and the hash of the current name diverge. Anywhere you need a topic's id, read the **stored** `.id` (via `findSaved(...)?.id` / `findSavedById`), never recompute `_topicId(name)`. In the real data, 21/123 topics are in this state and 16 chains depend on it. This is why the boot migration resolves `continuedFrom` to the parent's stored id, and why `_syncStorylineForTopic` was fixed.

### 15. `continuedFrom` (name) is now display-only; `continuedFromId` is canonical
After v41 the rename cascade is gone, so a child's stored `continuedFrom` **name** can be stale. Do not use it for identity or chain walking — use `continuedFromId`. For display (e.g. the `← parent` link) resolve the current name from `continuedFromId`. The name field is kept only as a human-readable label / import fallback.

---

## TODO (Next Session)

### Suggested priority order
1. **Topic ID migration** — critical correctness fix; topic names are mutable, IDs must be the stable reference everywhere. Full plan in Architecture Notes below.
2. **"Message to LLM" input field** — fully specced, low risk, clear UX win
3. **Translate new ui.json keys** — no code needed, just run `translate-ui.js`
4. **Template lesson export (Option C)** — additive, natural next step for batch pipeline
5. **German noun capitalisation** — one-line prompt fix
6. Everything else below deserves its own dedicated session

### 🔤 Prompt Engineering
- "Message to LLM" input field (additional instructions, high priority override) — see v39 summary for full spec
- Move topic info (sysMeta) to after story generation
- Extend vocab mode items still remaining: story-keyword positive anchors (`extractKeywords` in `generateOneLesson`), `extendNote` in system prompt

### 🔢 Math / LaTeX
- LaTeX in MCQ choices (requires replacing `cGrid` for `math_latex`)
- "LaTeX only" toggle in instruction UI

### 🌏 Japanese / CJK
- German noun capitalisation in vocab prompts
- Consider Chinese pinyin annotation (infrastructure already in place — needs model quality testing)
- Existing Japanese lessons without furigana need regeneration

### 🌍 Scale / Quality Assessment
- **`generate-lessons.js` quality pipeline**: add `assess-quality.py` (Python) that reads JSONL output, runs an LLM judge on lesson content, writes `quality` field back. Rubric to be defined.
- **Translate new ui.json keys** to all 29 languages (teacher mode, vocab mode, story lang, toasts, lesson type desc) — use `translate-ui.js` with `--exclude` to skip already-complete languages
- MULTIZUNGE: auto-generate all language pair combinations for a set of intro topics
- Phylogenetic language map UI

### 🔊 TTS
- Google Cloud TTS fallback for Firefox/Linux — see v39 summary for full spec

---

## Carry-forward Architecture Notes

### Extend Vocab Mode (items 1 & 3 still remaining)
Items 2 and 4 were done in v39. Still needed:
- Item 1: `extractKeywords` positive anchors in `generateOneLesson` for extend mode
- Item 3: `extendNote` fragment in `prompts.json` appended to system prompt

### Story DAGs — Architecture Plan
Unchanged from v39. Phase 1 (branching display) already implemented in `_renderStorylineScreen`. Phase 2+ (branch generation, merge/fusion, DAG model) still future work — see v39 summary for full plan.

### Google Cloud TTS Proxy
Unchanged from v39 — see v39 summary for full server/client plan.

### generate-lessons.js — Standalone Option (Future)

Currently requires `server.js` to be running (calls `/api/generate` over HTTP). Two approaches to make it server-independent:

**Option A — Full extraction (major refactor)**
Extract `generate()` and its ~20 dependent functions (`sysLesson`, `sysStory`, `generateOneLesson`, `generateGrammar`, `deriveSentenceWords`, store functions, `PROMPTS` loading, etc.) into a shared `generate.js` module. Both `server.js` and `generate-lessons.js` require it. Risk: the store singleton, `PROMPTS` hot-reload, and `jobStep` coupling all need careful untangling. Estimated effort: half-day. Worth doing once the codebase stabilises.

**Option B — Slim standalone pipeline (simpler)**
Write a `generate-simple.js` that implements only the minimal fixed pipeline needed for batch generation — no grammar/conjugation/error-hunt/math, no dialect, no continuation, no repair. Just: story → vocab lesson → save JSONL. Uses `llm.js` directly, reads `prompts.json` directly, writes its own output file. No store, no job system. Much less code to maintain but diverges from the server pipeline over time.

**Option C — Template lesson export/import (new idea)**
Generate a "template lesson" in one language pair via the normal server/index.html UI, then export it with a new extended format that includes the prompts and generation parameters used. A standalone script reads this template export and regenerates the same lesson in other language pairs using `llm.js` directly — no server needed. The export format would add a `_generationTemplate` field to the topic object.

**Recommendation**: Option C is the most elegant and unique to Dreizunge's architecture. Option A is the right long-term engineering choice. Option B is quick but creates maintenance debt. Pursue C first as it adds user-facing value (shareable templates), then A when the codebase is ready.

---

### ✅ COMPLETED in v41: Migrate topic references from names to IDs

**Status: DONE** (server + client identity/navigation + chain assembly + rename).
See "What Changed in v41" above for the per-step breakdown, verification, and the
intentionally-deferred items (storyline-deck/TTS display layer, rename-by-id). The
original audit and plan are kept below for reference.

**Problem (original):** The entire chain navigation, lesson loading, and storyline system referenced topics by their mutable `topic` name string rather than their stable `tp_` ID. Topic names can change (LLM renames during generation, user edits `lessons.json`). This caused: wrong cache hits, chain navigation breaks after rename, batch generation collision (multiple lang pairs share same topic name), `byTopic` maps losing entries on collision.

**Full audit of name-based references (as of v40):**

*Server (`server.js`):*
- `continuedFrom` field — stored as topic name string in every topic object. Used by `collectChainVocab()`, `_syncStorylineForTopic()`, `generate()`, the rename handler (line 1561), and `topicIdOf()`.
- `findSaved(topicName)` — 10+ call sites for chain walking. Should be `findSavedById(id)` wherever a stable reference is needed.
- `_syncStorylineForTopic(topicName, continuedFromTopic)` — walks chain by topic name. Should walk by ID.
- `/api/lessons/load?topic=` — load endpoint uses topic name. Should accept `?id=` too.
- `/api/lessons/delete?topic=` — same.
- `collectChainVocab(continuedFromTopic)` — walks by name via `t.continuedFrom`.
- `candidates = store.topics.filter(t => t.continuedFrom === cur)` — line 1378, matches by topic name string.

*Client (`index.html`):*
- `loadSaved(topic)` — takes topic name, calls `/api/lessons/load?topic=`.
- `deleteSaved(topic)` — same.
- `continueFromLesson(topic, ...)` — uses topic name.
- `continue-select` option values — topic names.
- `byTopic` maps — `Object.fromEntries(filtered.map(l => [l.topic, l]))` — collides on same name.
- `.find(l => l.topic === x)` — ~12 call sites.
- `data-topic` attributes in rendered HTML — topic names baked into onclick strings.
- `APP.lessonData.topic` used as identifier for current lesson.

**Boot-time migration edge cases:**
- If a topic has no `id`, assign `_topicId(topic.topic)` — idempotent, safe to run on every boot
- If `continuedFrom` is a string that matches a known topic name, replace with that topic's `tp_` ID
- If `continuedFrom` is a string that matches no known topic (deleted or renamed before migration), set to `null` — do not crash, log a warning
- If `continuedFrom` already looks like a `tp_` ID (starts with `'tp_'`), leave it untouched
- Write back to store after migration only if any changes were made

2. **`continuedFrom` → ID** — change `generate()` to store `continuedFrom` as `tp_` ID. Change `collectChainVocab` and `_syncStorylineForTopic` to walk by ID using `findSavedById`. Change `candidates` filter (line 1378) to match `t.continuedFromId` (or keep `continuedFrom` field name but store ID value).

3. **New endpoints** — add `/api/lessons/load?id=` and `/api/lessons/delete?id=` alongside existing name-based ones (keep name-based for backward compat temporarily).

4. **`loadSaved(id)`** — change to use ID. All `onclick="loadSaved('${enc}')"` → use `s.id`. All `continueFromLesson(topic)` → `continueFromLesson(id)`.

5. **`continue-select` values** → topic IDs not names. `continueFromLesson` sends ID to `/api/generate` as `continuedFrom`.

6. **`byTopic` → `byId`** — replace all `byTopic` maps with `byId` (already have `_byId` in loadSavedList). Update all `.find(l => l.topic === x)` to `.find(l => l.id === x)`.

7. **Rename handler** — no longer needs to update `continuedFrom` refs across all topics. Just update the single topic's `topic` field.

**Key risk:** `_topicId(topicName)` derives ID from topic name hash — so if a topic is renamed, its hash changes and it gets a new ID, breaking existing storyline chapter references. Fix: once an ID is assigned, it must never be recalculated from the name. IDs are assigned once (on first `upsert` or boot migration) and stored permanently.

**Suggested approach for the implementation session:**
- Start with the boot-time migration (safest — purely additive)
- Then fix `upsert` to assign ID on creation (already done for lang+srcLang key, not yet for ID assignment)
- Then fix `continuedFrom` storage and chain walking on the server
- Then update client endpoints and `loadSaved`
- Finally replace `byTopic` maps

Do NOT change `_topicId` hash function — existing IDs in stored data must remain valid.


**Option A — Full extraction (major refactor)**
Extract `generate()` and its ~20 dependent functions (`sysLesson`, `sysStory`, `generateOneLesson`, `generateGrammar`, `deriveSentenceWords`, store functions, `PROMPTS` loading, etc.) into a shared `generate.js` module. Both `server.js` and `generate-lessons.js` require it. Risk: the store singleton, `PROMPTS` hot-reload, and `jobStep` coupling all need careful untangling. Estimated effort: half-day. Worth doing once the codebase stabilises.

**Option B — Slim standalone pipeline (simpler)**
Write a `generate-simple.js` that implements only the minimal fixed pipeline needed for batch generation — no grammar/conjugation/error-hunt/math, no dialect, no continuation, no repair. Just: story → vocab lesson → save JSONL. Uses `llm.js` directly, reads `prompts.json` directly, writes its own output file. No store, no job system. Much less code to maintain but diverges from the server pipeline over time.

**Option C — Template lesson export/import (new idea)**
Generate a "template lesson" in one language pair via the normal server/index.html UI, then export it with a new extended format that includes the prompts and generation parameters used. A standalone script reads this template export and regenerates the same lesson in other language pairs using `llm.js` directly — no server needed. The export format would add a `_generationTemplate` field to the topic object:
```json
{
  "topic": "Greetings and Introductions",
  "lang": "de", "srcLang": "en",
  "_generationTemplate": {
    "userTopic": "greetings and introductions",
    "difficulty": 1,
    "storyLen": 200,
    "storyStyle": "neutral",
    "lessonFormat": "standard",
    "prompts": { ... }   // snapshot of the prompts.json keys used
  },
  "lessons": [ ... ]
}
```
The standalone script strips `lang`/`srcLang`/`topic`, re-runs generation for each target pair, and produces an importable file. Advantages: reproducible (same prompts snapshot), server-independent, and the template can be shared — others can regenerate it in their language without needing the original setup. Requires: a new export option in `index.html`/`server.js` that bundles the `_generationTemplate` field, and a `generate-from-template.js` script.

**Recommendation**: Option C is the most elegant and unique to Dreizunge's architecture. Option A is the right long-term engineering choice. Option B is quick but creates maintenance debt. Pursue C first as it adds user-facing value (shareable templates), then A when the codebase is ready.

### Post-release fixes (import / export / display)
- **Import duplicate storylines:** importing a v29 file whose storyline ids don't equal
  the `continuedFrom`-derived `_chainId` caused step-2 sync to create a parallel copy of
  the same chain (e.g. one storyline shown 2–3×). Import now **dedups storylines with an
  identical chapter sequence**, keeping the curated title. (The shared-stem *overlap* of a
  fork stored as two storylines is inherent to such files; connected-component export
  prevents producing them.)
- **Connected-component export:** `exportTopics` now expands the selection to the full
  fork via `continuedFromId` (walk to root + down all branches), fetches each chapter by
  `?id=` (collision-safe), and includes every storyline referencing a component topic — so
  a fork exports as one complete, re-importable unit. (Filename scheme unchanged — deferred.)
- **`>= 1` chain filter in live:** `loadSavedList`'s v29 path now uses `>= 1` to match the
  static build, so single-chapter storylines render as storylines. Consequence: with the
  current data every topic belongs to a storyline object, so the orphan/"individual
  lessons" section is empty. (Legacy `continuedFromId` reconstruction path kept at `> 1`
  so standalone lessons don't each become a 1-item storyline.)

### Boot migration extracted to a script
- The per-boot `migrateTopicRefs` IIFE in server.js was replaced by a lightweight
  warning. New topics get their `tp_` id at generate time (inline + `_syncStorylineForTopic`),
  and imported topics via `_syncStorylineForTopic`, so no per-boot migration is needed.
- The one-time upgrade for **pre-v41 data** (topics lacking ids / unresolved `continuedFrom`)
  now lives in standalone **`migrate-v41.js`** (idempotent, writes `.bak`).
- **Deploy order changed:** run `node migrate-v41.js <lessons.json>` once, THEN
  `node build-static.js`. The server prints a warning naming the script if it loads
  pre-v41 data. (The bundled `lessons.json` has been migrated; `.bak` kept.)
- Client/static keep only cheap no-id *guards* (`s.id || enc`, `byId` built from
  `filter(l=>l.id)`); these aren't a migration and were left in place.

### upsert id-based identity
- `upsert()` now matches an existing topic by **stable id when the entry has one**
  (updates, imports) and only falls back to **name+lang** for an id-less entry (fresh
  generation / legacy import). id and name+lang are mutually exclusive — an id with no
  match is a NEW topic and is never merged into a same-named one, so **same-name topics
  (distinct ids) coexist on write**. The import exists-check matches the same way.
- `upsert` also **preserves the existing stable id on update** when new data omits it,
  so a regenerate keeps a (possibly renamed) topic's original id instead of resetting it
  to the hash of the current name.
- Verified: updating one of two same-name topics by id leaves the sibling intact;
  importing a new id with an existing name coexists (no merge); legacy no-id import still
  dedups in place and keeps ids.

### Storyline-extension with own story / globe nav / export filename
- **Own story can now extend a storyline:** `onUseStoryCb` no longer hides the
  continuation selector, and `doGenerate` sends `continuedFrom` even with own-story on.
  Server side, `generate()` was passed `continuedFrom=null` whenever a user story was
  supplied (`contFromForStory`), so the chain link was never written. Fixed by deriving
  a `chainParent` (`continuedFrom || prevStoryTopic`) used for `continuedFromId`, the
  stored `continuedFrom`, and chain-vocab — while the *story-context* else-branch still
  keys on the original `continuedFrom` (suppressed for own stories). Now an own-story
  continuation carries `continuedFromId` and `_syncStorylineForTopic` links it.
- **Globe home button:** the `←` back buttons in the storyline header and the
  topic/lessonset header are replaced by the 🌍 globe (class `sl-screen-home`, 24px,
  borderless), still calling `goLandingClean()`. Propagated to the static build.
- **Export filename:** now `dreizunge_<name>_<ID>_<timestamp>.json` — storyline/fork
  exports use the largest storyline's title + `sl_` id; single-topic exports use the
  topic name + `tp_` id.

## TODO / known issues (carried forward)
- ~~`_topicId(name)` hash → id-collision on rename+recreate~~ ✅ **DONE:** new topic ids
  are now minted by `_newTopicId()` = `tp_` + timestamp + counter + random (numeric, to
  preserve the client's `/^tp_\d+$/` detection), collision-checked against the store.
  The name-hash `_topicId` is removed; all three mint sites (generate completion,
  `_syncStorylineForTopic` backward/forward walk) and `migrate-v41.js` use the random
  minter. Existing ids are never recomputed. Verified: 5000 rapid ids unique+numeric;
  two same-named old topics now get distinct ids (hash would have collided); a freshly
  generated topic gets a random id and still links its storyline; already-migrated data
  is a no-op.
- **Progress data is name-keyed** (`APP.progress.completed[topicName]`). A rename keeps
  the id stable but progress stays under the old name → looks reset. NOTE: in the live
  editor this is minor, but progress matters more in the **static build (docs/index.html)**,
  so prioritise re-keying there (re-key by tp_ id, with a one-time backfill). Lower urgency
  overall but the static-build case is the one that counts.
- **Flags are name-slug-keyed** (`topicSlug:` prefix) — same class of issue, lower stakes.
- **Display residuals (safe):** deck recursive `_renderChain`/`_succMap` branch detection
  walks by name (deck's own chapters are corrected via the `byTopic` override; only greyed
  branch stubs use global name lookup); the `data-chain` attribute payload stays
  name-encoded (TTS prefers `chapterIds`).
- **By-design name use (not debt):** `continuedFrom` display name; `?topic=` API
  back-compat; the id-or-name fallbacks in endpoints.
- **Library fork cohesion (option B, not done):** a fork stored as two storyline objects
  shows as two same-titled groups rather than one merged fork. Connected-component export
  now exports it as one unit; merging them in the *display* is the remaining piece.
- ~~Middle-of-chain delete leaves a stale grouping~~ ✅ **DONE (splice):** deleting a
  topic now re-points its children to the deleted topic's *parent* (grandparent) instead
  of orphaning them. Deleting Beta from Alpha→Beta→Gamma reconnects Gamma→Alpha, so the
  storyline stays `[Alpha, Gamma]` and the chapter list agrees with the `continuedFromId`
  graph (nav works). Verified: middle splice reconnects correctly; tail/root deletes and
  the fork-branch-collapse merge are unaffected.

### Math ordering: wrong answer now shows + reads the correct one
- In `check()`, the wrong-answer branch rendered the correct answer with
  `furiHtml(ex.correct)`, but for `math_order` (and `math_calc`/`math_latex`)
  `ex.correct` is an **array**. `furiHtml` calls `.replace` on it → TypeError, which
  aborted the branch *before* `speak()` — so the correct answer was neither shown nor
  read out. Fixed by special-casing math types in the wrong branch (join the array,
  `escHtml`) exactly as the correct-answer branch already did. Propagated to static.

### Server-side multi-chapter "book" generation (survives refresh)
PDF multi-chapter generation used to be a **client-side** loop (`pdfGenerateAll` looped,
POSTing `/api/generate` per chapter and polling). A page refresh killed the loop, so
generation stopped after the in-flight chapter. It is now **server-driven**:
- `server.js` (module scope, before the request handler): a `bookJobs` map, `newBookJob`,
  `_persistGenerated` (shared upsert + stable id + `_syncStorylineForTopic`), and an async
  `_runBookJob` that generates chapters sequentially, chaining `continuedFrom` to each
  saved chapter's id. Fire-and-forget — runs independently of any client.
- Endpoints: `POST /api/generate-book` (submit all chunks, returns `bookId`),
  `GET /api/book-job/:id` (progress), `GET /api/book-job` (most-recent running, for
  reconnect), `POST /api/book-job/cancel`.
- `index.html`: `pdfGenerateAll` now POSTs once and polls `/api/book-job/:id` purely as an
  observer; `_reconnectBookJob()` runs on load (`init`) and re-attaches to a running book;
  unchecking PDF mode cancels via `/api/book-job/cancel`.
- Verified end-to-end (stub-LLM, math path): a 3-chapter book POSTed with **no client
  polling** still generated all chapters server-side and chained them into one storyline;
  reconnect endpoint returns the running job and null when idle.
- CAVEAT: `jobs`/`bookJobs` are **in-memory**, so a *server restart* drops an in-progress
  book (a client refresh is fine). Persisting book-job state to disk would close that gap.

### Round of fixes (PDF chunk slider, editor, result card, math, server TDZ)
- **Story-length slider repurposed for PDF chunk size.** Removed the S/M/L dropdown next
  to the PDF upload; in PDF mode the existing story-length slider sets the chunk target
  (`APP.storyLen`). The full extracted text is kept in `_pdfRawText`, so moving the slider
  **re-splits** the loaded PDF (debounced 250ms; skipped while a book is generating). The
  slider label switches to "PDF chunk size" in PDF mode.
- **Lesson editor stayed open on single-question delete.** `mathDeleteExercise` called
  `openLessonEditor(li)`, which *toggles* and therefore closed the open editor. Now it
  re-renders in place via `renderLessonEditor`, matching the other delete paths.
- **PDF book generation shows the standard bottom pill.** `_applyBookProgress`/`_pollBookJob`
  drive `setGenStatus` (`📖 done/total · current chapter`, then done/error), and a pill
  appears immediately on start.
- **Result-card → storyline link crashed** (`SyntaxError ... 1:202`). The inline `onclick`
  interpolated `encodeURIComponent(...)`, which does **not** escape apostrophes, so a topic
  like "Grandpa's Dough" injected a `'` that closed the JS string. Now the apostrophe is
  escaped to `%27` for the attribute (decodes back correctly).
- **Math ordering wrong-answer crash** (`stripFuri ... text.replace is not a function`). The
  `.choice` highlight in `check()` called `stripFuri(ex.correct)` on the math array. Now it
  joins the array first (`_corrStr`), so the correct answer shows and is read out.
- **Server TDZ on generate without source language** (`Cannot access 'resolvedSrcLang'
  before initialization`). `resolvedSrcLang` was used in the cache check before its `const`
  declaration. Moved the declaration above the cache check; verified a cache hit now returns
  cleanly.

### Story-length slider minimum lowered to 50 (user change)
`story-len-slider` `min` is now 50 (was 100). Works fully for PDF chunk size (client-side
split honours it). NOTE: the server still floors the generation word-count target at 100
(server.js ~550, ~1599, ~1898), so for *generated* (non-PDF) stories a 50–99 value is
raised to 100. Lower those three `Math.max(100, …)` clamps to 50 if the floor should apply
to generated stories too.

### Batch tooling updated/added (v42)
- **generate-lessons.js** updated to v42: compatible with id-based topics/storylines
  (verified all endpoints it uses — /api/info, /api/generate, /api/job, /api/lessons,
  /api/storylines — are unchanged); `--format` now documents `synonyms` and `math`.
- **translate-lessons.js** (new): reproduces a template export in other language pairs.
  Translates each chapter's story with a translation model (default `translategemma`) via
  Ollama, then feeds the translated story to the server as `userStory` so lessons are
  rebuilt correctly for the new target language; preserves storyline order/chains; emits a
  rebuilt `.import.json`.
- **qc-lessons.js** (new): checks every vocab/sentence pair with `translategemma` (OK /
  corrected-text protocol, no JSON), flags mismatches, `--fix` rewrites bad glosses,
  `--check-stories` screens stories. Writes a JSON report.
- All three verified headlessly (syntax + dry-runs + a stubbed-Ollama qc run that flagged a
  planted bad pair and applied the fix). Live LLM/translation quality needs the real models.

### TODO / next
- **Custom store file (switch instead of import):** let the user point Dreizunge at a
  different lessons file at runtime rather than merging an import into the current one.
  Cleanest path: make `STORAGE_FILE` a mutable `let`, add `POST /api/store/switch {path}`
  that validates the path, flushes any in-flight save, reloads `store`, and returns the new
  counts; surface it in the import dialog as "Open as store" vs "Import into current".
  Deferred (runtime store-switching is stateful — wants its own focused change + tests).

### i18n: all UI text goes through ui.json (standing rule)
New UI strings must use a `ui.json` key via `t()`. English-only entries are added here;
all other languages are translated offline by the maintainer.
- Synonyms labels now resolve from ui.json: `form.format.synonyms` (generation form) and
  `lesson.type.synonyms` (the + add-lesson selectors). No literals.
- Retrofitted two literals I had introduced to keys (English values added to ui.json):
  `form.pdf_chunk_size` ("PDF chunk size", the story-length slider label in PDF mode) and
  `form.clear_text` ("Clear", the own-story clear button). `form.story_len_lbl` already
  existed and is used for the non-PDF label.
- **Needs translation (en added):** `form.pdf_chunk_size`, `form.clear_text`.
- The static build bakes ui.json (UI_STRINGS_ALL), so these resolve in docs/ too.

### Synonyms redesigned as a grouped study lesson (type:'synonyms')
The old flatten-to-vocab approach produced forced/garbage homophones and crammed the
base word + relationship into the gloss. Replaced with a real grouped lesson type.
- **Data:** `{type:'synonyms', title, desc, icon, words:[{base, gloss, synonyms:[{w,g}],
  antonyms:[{w,g}], homophones:[{w,g}]}]}`. synonyms required (>=1); antonyms/homophones
  variable and may be empty. Server validates: drops groups with no synonyms or no base,
  strips self-references, dedupes, caps 4/3/2.
- **Prompt** (prompts.json `synonyms`): grouped schema, prefer story words + reinforce
  list (chainVocab), homophones only when real (else []), never invent, strict L/S
  directionality. Homophones are now OPTIONAL because they're used only as quiz distractors.
- **Quiz** (`syn_select`, ordering-style tiles but multi-select, order-independent): per
  word a "choose all synonyms" exercise and, if antonyms exist, a "choose all antonyms"
  one. Distractors = the word's other categories + its homophones (traps) + cross-word
  words. check() = selected set equals correct set (case-insensitive).
- **Editor:** grouped editor with editable base/gloss + per-related-word w/g inputs and a
  per-word delete (✕); save persists `.words`; delete preserves in-progress text edits.
- **Labels:** synonyms added to all 4 lesson-type label maps (🔁 / lesson.type.synonyms).
- **Verified headlessly:** server validation (self-ref strip, dedupe, caps, drop-empty,
  legacy "word" key); client build (5 exercises from 3 groups, all-correct-present,
  base absent, homophones used as distractors, no dup choices); check set-equality
  (exact/partial/extra/empty). Static build inherits the new functions.
- **NEEDS TRANSLATION (en added):** ex.syn.q_synonyms, ex.syn.q_antonyms,
  ex.badge.syn_synonyms, ex.badge.syn_antonyms, ex.syn.hint.
- **Needs your browser click-through:** tile select/check highlighting, the grouped editor,
  and a real generation (LLM quality of the chosen words/synonyms).

### translate-lessons.js — storyline grouping fix + progress
- **Bug:** the `/api/generate` job response does not carry the new topic's stable id
  (`upsert` stores a copy `{...data}`; the id is assigned to the stored copy, not the
  returned `data`). The script chained on `saved.id`, which was always undefined, so
  `continuedFrom` was never sent and `_syncStorylineForTopic` never grouped the chapters.
- **Fix:** after each chapter, resolve its real id from `/api/lessons`
  (`resolveTopicId`): match by lang+srcLang, preferring the one chained to the parent
  (chapters 2+) else the newest (server unshifts new topics). Name matching was dropped
  because the server's meta step renames topics and translates the name into the source
  language, so the saved name never equals the title the script sent. Chain the next
  chapter to the resolved id. The storyline then forms automatically and incrementally
  on the server — chapters associate as they generate.
- **Progress:** per-chapter and per-storyline console messages with an overall tally
  (`[fr←en] La Storia: chapter 2/3 "…" ✓ (overall 5/6)` and `✓ storyline "…" complete`).
- **Verified** against a stub Dreizunge server (mimicking the id-less job response and
  chain-derived storylines) + stub Ollama: 2 pairs × 3-chapter template → 2 storylines,
  each 3 chapters in correct order, no cross-language mixing.

### In-app QC (translation quality check) — qc-lessons.js wired into the app
- **Server:** `POST /api/qc` (async job). Scope: `{storylineId}` | `{topicId}` | `{topicId,lessonIdx}`,
  optional `onlyFlagged` (restrict to legacy user-flagged lessons). For each vocab/sentence
  pair it asks the translation model (`callLLMTranslation`, OK/corrected-text protocol) and
  writes `qc:{sug,at}` directly onto flagged items; clears `qc` on items now OK; persists;
  job returns `{checked,flagged,cleared,topics,affected}`. Verified end-to-end against a
  mock LLM: flags a bad pair, scopes by lessonIdx, and clears a flag after a fix.
- **Client:** `qcRun(scope,btn)` posts, polls the job (progress in the button tooltip), then
  refreshes. QC buttons (🔍) at three levels: per-lesson node (chapter page), per-topic
  (`savedItemHtml`), per-storyline (library header).
- **Editor:** flagged vocab/sentence items show the QC suggestion inline with **✓ fix**
  (apply suggestion → source, persist) and **✕** (dismiss). `.editor-entry.flagged` styling.
  The lesson-node badge now counts `item.qc` flags.
- **Legacy flags retired from the UI:** the in-play flag button, the story-flag button, and
  the editor's old `isFlagged` are removed/neutralized. `store.flags` data is kept (ignored
  in the UI) and reused only as the optional `onlyFlagged` QC filter.
- **NEEDS TRANSLATION (en added):** qc.btn.lesson, qc.btn.topic, qc.btn.storyline,
  qc.toast.no_backend, qc.toast.failed, qc.toast.error, qc.toast.result, qc.toast.cleared,
  qc.toast.fix_applied, qc.toast.dismissed, qc.toast.save_failed, qc.editor.suggests,
  qc.editor.fix, qc.editor.fix_title, qc.editor.dismiss_title.
- **Needs browser testing:** the three QC buttons, polling/progress, and the editor fix/dismiss
  flow (server engine verified headlessly; live UI cannot be tested here).

### QC flag counts shown on the icons
Each 🔍 QC icon now shows the number of flagged items in red (number only, no words),
hidden when zero. Server adds a `qcFlags` count per topic to `/api/lessons`; the chapter
page uses the per-lesson `item.qc` count, the topic card uses `s.qcFlags`, and the storyline
header sums `qcFlags` across its chapters. Verified `/api/lessons` returns the count.

### QC refinements
- **Flag counts on icons** (sum of contained flags): lesson uses per-lesson item.qc count,
  topic uses server `qcFlags`, storyline sums `qcFlags` across chapters; number in red, hidden at 0.
- **Target proofreading:** the QC check now verifies BOTH the target text (spelling/grammar/
  **capitalization** — e.g. German noun caps) and the source translation, in one call via a
  T:/S:/OK protocol. Flags carry `field:'target'|'source'`; the editor shows which side and
  **✓ fix** applies the correction to that field. So case errors like "…grundlegenden prozesse"
  → "…grundlegenden Prozesse" are now caught (field=target).
- **✕ dismiss** clears the flag (deletes item.qc, persists) — confirmed.
- **Console logging:** logs "QC requested" immediately on request, then a `⚑ flag [field]` line
  per flagged item in real time, and an accurate final count (previously progress lagged and
  the summary undercounted because target case errors weren't checked at all).
- **NEEDS TRANSLATION (en added):** qc.editor.in_target, qc.editor.in_source.

### QC fix: parse model replies robustly
The model sometimes echoes the whole "<target> => <source>" pair (or replies without a
T:/S: label) instead of just the corrected side, so clicking ✓ fix dumped the whole string
into a field. The server parser now: strips an optional T:/S: label; if the reply contains
"=>", re-derives which side actually changed and uses only that value; if unlabeled, assigns
the fix to the target or source by similarity (a case-only correction matches that side).
Comparisons are case-SENSITIVE so capitalization fixes (e.g. prozesse→Prozesse) register.
The client apply-fix has the same "=>" guard so pre-existing mis-formatted flags also apply
to the right field. Verified across echoed-pair, labeled, and bare-reply shapes.

### Vocabulary lessons: base-form words only
prompts.json `vocab` and `vocabFromText` now instruct the model to give every vocab word in
its dictionary/citation form — infinitive for verbs, singular for nouns (with article where
the language uses one), base form for adjectives/adverbs — never conjugated/declined/plural/
inflected. For extraction, words are lemmatized even when the story uses an inflected form
(sentences stay verbatim). Rationale: derivative/inflected forms are covered in the dedicated
grammar/conjugation lessons. Server-side prompt only; no client/static change.

### Grammar/conjugation lessons: focus on story-derived forms
Complementing the vocab base-form rule, prompts.json `grammar` and `conjugation` now prefer
words whose DERIVED forms appear in the story — nouns whose plurals/inflected forms occur in
the text (grammar), and verbs the story actually conjugates (conjugation) — so these lessons
cover the derivations the learner encountered, while vocab lessons teach the base/citation
form. Server-side prompt only.

### add-lesson grammar/conjugation now receive the story
generateGrammar/generateConjugation in the add-lesson path are now passed `saved.story`
(like the main generate() path), so their prompts include the story-keyword hint and the
"focus on story-derived forms" steer actually applies. Verified headlessly: the grammar
prompt gains a "Context nouns/themes from the story (prefer these…)" line. Previously these
two were the only add-lesson generators that ignored the topic's story. Detailed generation
reference written to docs-graph/lesson-generation-paths.md.

### Simple learning-arc mode for PDF/book generation
POST /api/generate-book now accepts `arc:true` + `arcReinforce:[...]` (default ['grammar']).
Per chapter it generates a vocab "gate" lesson (this chapter's words) plus one reinforcement
lesson per arcReinforce type (grammar/conjugation/synonyms) in `reinforce` mode, drilling the
forms of prior + current words. Chapters stay separate and chained, preserving the
unlock-by-mastery model. The PDF dialog has a "Build a learning arc" checkbox (sends
arc:true + ['grammar','conjugation']). Non-arc path unchanged. Verified end-to-end: 3 chapters,
each ['standard','grammar','conjugation'], correctly chained. NEEDS TRANSLATION (en added):
form.pdf_arc. Fuller goal-oriented arc (PDF syllabus + coverage tracking) captured as TODO in
storyline-learning-arc-guide.md.
