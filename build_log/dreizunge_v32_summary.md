# Dreizunge v32 — Session Summary

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~4900 | Main app (live + static) |
| `server.js` | ~1970 | Node.js backend |
| `build-static.js` | ~680 | Static docs builder |
| `ui.json` | — | UI string translations (~190 keys × 29 langs) |
| `lessons.json` | — | All lesson/storyline data (schema v29) |

Latest release: `dreizunge_v32.zip`

---

## Screen Naming Convention

| Screen | DOM id |
|---|---|
| Main / saved lessons | `#landing` |
| Storyline screen | `#storyline-screen` |
| Lesson set screen | `#lesson-set` |
| Exercise screen | `#lesson-screen` |
| Complete screen | `#complete-screen` |

---

## What Changed in v32

### Data / lessons.json
- **`srcLang` backfilled** to `"en"` on all 66 topics that had `null`
- **Duplicate storyline removed**: `sl_1834202256` ("Das kleine Ich bin ich", 1 chapter) deleted; `sl_887116336` retained and extended to 5 chapters after new continuations
- **"Gratitude in Alto Adige" (`sl_320941528`)**: stem chapters (`tp_1704125569`, `tp_598353466`) prepended — now shows all 4 chapters including the shared Dolomites fork root
- **Russian `form.format.standard`** fixed (was `"Стандарт —lexical units & sentences"`)

### ui.json
- **3 new `lesson.type.*` keys** per language, derived from existing `form.format.*` translations: `vocab`, `grammar`, `conjugation`, `error_hunt` — emojis (📚 🏷️ 🔤 🔍) moved to code
- **Emoji stripped** from 13 keys where they duplicated hardcoded emoji in HTML: flag buttons (`⚐ ⚑`), import/export arrows, `lib.title`, `lesson.btn_continue_story`, etc.
- **`form.i_speak` / `form.i_learn`**: emoji moved outside `data-i18n` label so `textContent` override doesn't clobber it
- **`static.ai_warning`** added in all 29 languages — used in static overlay
- **Dead/duplicate keys removed**: 20 keys × 29 langs (repair, rating, rewrite, fix-flagged features; duplicate `lesson.btn_*` aliases)
- **`form.format.standard`** restored for all 28 non-English languages after accidental deletion
- **3 keys removed** (`confirm.delete_chapters`, `toast.chapters_deleted`, `toast.chapters_deleted_plural`) — replaced with hardcoded `🗑️ {n}` emoji

### server.js
- **`collectChainVocab(continuedFromTopic)`**: new helper — walks `continuedFrom` chain, collects all vocab/grammar/conjugation targets from prior chapters
- **`reinforcePrior` feature**: when checked, prior vocab is passed to all lesson generators to reinforce previously learned words in new lessons. Gated by checkbox on main form and ➕ add-lesson panels
- **Storyline continuation fix** (`_syncStorylineForTopic`): added `predecessorMatch` — when a new topic extends an existing storyline, the storyline is updated in place instead of creating a duplicate
- **`/api/build-static`**: new POST endpoint — runs `node build-static.js` via `child_process.execFile`, enables the 🏗 Static button
- **`/api/storylines` POST**: now accepts `summary` field for partial patch (title/icon/chapters unchanged)
- **`save-meta` robustness**: if `oldTopic` not found but `newTopic` already exists, returns 200 no-op instead of 404

### index.html — UI features
- **Lesson type labels** wired to `t('lesson.type.*')` in all 7 locations (lesson path card, editor header, confirm dialog, complete screen, all add-lesson selects)
- **`updateUI()`**: retranslates all `.addlesson-select` elements on language switch; updates stat box titles; shows/hides export-static button
- **`selectSrcLang()`**: after loading UI strings, re-renders active sub-screen (`buildPath()` or `_renderStorylineScreen()`) so dynamic content retranslates without reload
- **`goLessonSet()` / `openStorylineScreen()`**: now `async`, await `loadUIStrings()` before rendering to switch UI language without reload
- **"Reinforce prior vocabulary" checkbox**: appears below "continue story from" selector (main form) and in ➕ add-lesson panels when topic has a prior chain
- **Summary edit (✏️)**: inline textarea editor for storyline summaries, accessible from storyline screen header, summary section header, and landing card — saves via `POST /api/storylines`
- **`saveSummaryEdit` / `saveSlScreenTitle` / `genStorylineSummary`**: all now call `loadSavedList()` to refresh landing page immediately after saving
- **Language footer**: `🗣 [src lang select] [🔇]` strip at bottom of lesson-set and storyline screens — switches UI language and re-renders active screen; 🔇 stops speech
- **AI warning overlay** (`static-gen-overlay`): updated in `applyUIStrings()` so it retranslates on language switch without reload
- **`saveSummaryEdit` / `genStorylineSummary`**: call `loadSavedList()` to refresh landing cards without reload

### index.html — Emoji picker
- **`STORYLINE_ICONS` (90 emoji) replaced** with `EMOJI_CATEGORIES` (1100+ emoji, 8 categories)
- **Category tabs** + **search box** added to picker
- **Missing emoji added**: 📖 📚 🔍 🚨 🏴 🍕 🧈 🥐 ➕ ➖ ✖️ ➗ 🟰 ♾️ + others from lessons.json scan

### index.html — TTS / Speech
- **`_ttsChunks(text)`**: splits long text at sentence boundaries (max 200 chars/chunk) to avoid Chrome's silent 32KB drop
- **`_speakChunks(chunks, langCode, rate, idx)`**: chains chunks via `u.onend` callback
- **`_doSpeakLang(text, langCode)`**: language-specific speak, uses chunking, skips 50ms cancel delay when engine was idle
- **`speakBodyText(bodyId, langCode, preText)`**: optional `preText` bypasses DOM lookup; falls back to `data-topic` → `STATIC_LESSONS`/`APP.savedList` → `APP._slScreen` when body is collapsed/empty; for chain story bodies fetches from `/api/lessons/load` if story not in savedList
- **`_unlockTts()`**: handles `langCode` in pending speak after iOS unlock
- **Summary speaker**: uses `APP.srcLang` (source language); story/chain speakers use topic's `lang` (target language)
- **"Read full story" chain speaker**: reads directly from `APP._slScreen.topics` + `APP.savedList`, with async fetch fallback — works when story is collapsed

### index.html — Layout fixes
- **Nested `<button>` inside `<button>` fixed** throughout: outer → `<div role="button">`, inner speaker → `<span>` (affects saved-item story headers, read-full-story header)
- **Speaker order**: arrow (▼) always before 🔊 in all header rows
- **`form-lbl`**: `display:inline` so emoji + label text appear on same line as select
- **Generation stats** moved below lang-footer in both screens
- **`lesson-actions`** (edit buttons): centered, larger, fused with continue story button and flag story button
- **TTS selector** hidden (`height:0;overflow:hidden`)
- **`story-flag-btn`** moved from static HTML into `lesson-actions` (built in `buildPath`)
- **🏗 Static button**: in library header (live mode only) — calls `/api/build-static`
- **`static.ai_warning`** overlay: compact amber style, translated, updates on language switch

### build-static.js
- **`selectSrcLang` override**: now re-renders active sub-screen after language load
- **`speakBodyText` fallback**: item story bodies have `data-topic` + `data-lang` attributes for collapsed-body speak
- **Summary strip**: 🔊 added with `data-speak`/`APP.srcLang` pattern; ✏️ edit button (live mode)
- **"Read story" header**: speaker moved outside clickable div (sibling flex pattern)
- **AI warning**: `t('static.ai_warning')` replaces hardcoded English block

---

## Key Architecture Notes

- `APP._slScreen = { chainId, encodedChain, topics }` — set by all navigation to storyline screen
- `APP.info.canGenerate` — controls all live-only UI
- `collectChainVocab(continuedFromTopic)` — walks `continuedFrom` chain for prior vocab; returns `{ words, nouns, verbs }`
- `reinforcePrior` — boolean sent in API body; gates `collectChainVocab` call
- `topicSlug(s)` — `s.trim().replace(/\s+/g,'_').slice(0,30)`
- `speakBodyText(bodyId, langCode, preText)` — unified speak entry point; preText bypasses DOM
- `data-speak`, `data-lang`, `data-topic`, `data-chain` — data attributes used throughout to avoid quote nesting in onclick strings

---

## Forked Storylines

"Dolomites Disaster" and "Gratitude in Alto Adige" share stem chapters (`climbing in the dolomites`, `Helping Injured Hikers`). Both storylines now include the full chain — shared chapters appear in both. This is intentional and supported: the storyline header shows multiple badge links, `reinforcePrior` correctly walks the full `continuedFrom` chain regardless of `chapters[]`.

---

## Known Issues / Deferred

- **Error hunt phrase diff**: LCS bridge-merging still imperfect for some multi-word phrases
- **Static docs must be rebuilt manually** after each `index.html` change (`node build-static.js` or 🏗 Static button)
- **`topic.srcLang` is now backfilled** but older exports may still have `null`
- **`rating.*` keys** (`rating.boring` etc.) still called in HTML but missing from ui.json — fall back to key string as tooltip (pre-existing, not introduced in v32)

---

## TODO List

### 🔇 UI / UX
- **Speaker toggle**: replace each 🔊 with a toggle — shows 🔇 while speaking, reverts to 🔊 when done. Deferred: complex to track multiple simultaneous speakers; `speechSynthesis.onend` unreliable across browsers when chunking.
- **Remove large target language flag** from individual lesson set cards on the main landing page.
- **"All languages" filter button** in Saved Lessons of live `index.html` doesn't work anymore — investigate.
- **UI during generation**: keep English text visible instead of showing key placeholders while translating.
- **Static `docs/index.html`**: source languages should be filtered by existing lessons (like target languages already are).
- **Furigana annotation** in lessons where Japanese is the source language — show for correct answers.
- **Typing lessons**: currently show a word selection — there should be no suggestions shown.
- **`setGenStatus` null error**: `Uncaught TypeError: Cannot set properties of null (setting 'textContent') at setGenStatus` — investigate.
- **"While generating UI"**: keep English instead of displaying code placeholders; don't break the previous fix.

### 📝 Lesson Generation / Prompts
- **TTS delay**: speech output in lessons — longer sentences are aborted; improve chunking or sentence splitting.
- **Vocab lesson prompt**: instruct model to use ground forms of verbs and nouns; enforce correct capitalisation (e.g. German "prozesse" → "Prozess", singular, capitalised).
- **Conjugation language bleed**: in a danish→german lesson, Danish words appeared as German conjugation forms. Strengthen prompt or add posterior validation (e.g. detect if `form` field is in source language instead of target).
- **"I have my own story" interface**: rework to allow source language story only (model translates), target language story only, or both. Currently requires target language text. Useful for languages the model doesn't handle well.
- **Save story immediately** after story generation (not after all lessons complete).
- **Save each lesson** as it's generated (incremental save, not batch at end).
- **Story style selector** (`creative`, `neutral`, `scientific`, `journalism`, `essay`, `funny`, `philosophical`) — store chosen style in `lessons.json`.
- **"Boost vocabulary"** option: increase words directly relevant to a topic.
- **Re-generating a story**: use the previously used lesson type setting, not the current generation menu state.
- **`translate-ui.js`**: add option to remove keys no longer used in `index.html` (requires HTML parsing — defer if risky). Provide a short `README_ui.md` explaining usage.
- **Generation stats**: add complete model setup (story model, translation model, lesson model) to `generationStats` in `lessons.json`. Document any key renaming with a `sed` command.
- **`translate-ui.js` console**: prefix batch messages with `"UI [{lang}]"` and align indentation with other messages.

### 🐛 Bugs
- **Grammar lessons**: a whole wrong sentence is rendered word-by-word — should be ONE error; user should mark the whole sentence.
- **Error hunt**: punctuation errors and spelling errors in names should be avoided (e.g. "Duesseldorf" → "Dusseldorf" with reason "Swap 'u' for 'u'").
- **Error hunt JSON error**: `Error-hunt lesson failed: Unexpected string in JSON at position 531` — intermittent.
- **`Meta failed` terminal error**: `"Meta failed, using fallback: Unexpected token : in JSON at position 37"` after `[qwen2.5:7b] Generating topic info…` — investigate JSON parsing of topic meta response.
- **When starting a specific lesson**: switch UI to the source language of that lesson (similar to what we do for `goLessonSet`/`openStorylineScreen`).

### 🌍 Language-Specific
- **Conjugation language bleed** (see above).
- **Other-than-English source language problems**: e.g. Italian→English struggles; model generates in wrong language for lessons. Strengthen source/target language reminders in prompts.
- **Arabic→Hebrew**: chokes — build a bridge via English intermediate + best translation model. Show a warning for poorly supported languages: Arabic, Swahili, Lëtzebuergesch.
- **Lëtzebuergesch with translategemma**: story should be generated in German (which qwen speaks) then translated to Lëtzebuergesch (which translategemma speaks) — not the other way around. Same for Swahili as target language.
- **Old Japanese lessons**: sentence order lessons need kanji split — investigate repair approach.
- **`translategemma` note**: works for rarer languages (Lëtzebuergesch, Swahili) but not well for Italian/Spanish/Portuguese/Vietnamese — use qwen for those.

### 🏗️ Lesson Types
- **Grammar — German adjectival nouns**: special handling for e.g. `ein Angestellter` vs `der Angestellte`.
- **Grammar — gender forms**: fuse female/male forms into one structure with explicit gender variants, instead of two separate entries (e.g. Ingenieur / Ingenieurin → one entry with `forms: [{gender:'m',...},{gender:'f',...}]`).
- **Error hunt — use existing story line**: add checkbox ("use existing story line") next to "show other languages" — generates error hunt from the full existing continuation chain rather than a new story. Evaluate for all lesson types.
- **Lesson type checkboxes**: instead of fixed 3-lessons-or-error-hunt structure, allow selecting any combination of lesson types (vocab, grammar, conjugation, error hunt) for new or existing story.
- **Error hunt words**: only use words that appeared in previous vocab/sentence lessons of the same story line.

### 📐 Multi-lingual Storylines
- **Multi-lingual storylines** don't work well — model produces mixed-language sentences (e.g. Spanish→Italian then Spanish→French). Needs investigation.
- **Cross-language continuation**: when continuing in a different target language, first translate the previous story from old target to new target language.
- **Storyline language display**: show ALL from/to language flags for all lessons in a storyline, not just the first.

### 🗺️ Major / Exploratory Ideas
- **Phylogenetic language map UI**: animated/3D world map coloured by language families with temporal language tree/DAG in z-axis. See `plans/map.md` and `plans/map.html`.
- **Phylogeny-based lesson generation**: use language distance/path for smarter prompt adaptation and model selection.
- **Auto-generate starter lessons** for each language pair based on culturally relevant topics.
- **Language tree UI**: see `plans/tree.md`.
- **MULTIZUNGE**: auto-generate lessons for all language pairs, auto-test sanity, qualify — results in recommended lesson pairs indicated on map/tree UI.
- **Storyline-level lesson generator/editor**: allow the full lesson generation/editing workflow also at the individual lesson set level (currently only available at the top level).

---

## Style Overrides in server.js (manual, applied in v32)
```js
funny: 'You are a comedian, tell jokes, use wordplay, absurdist situations, punchlines.',
philosophical: 'Be philosophical: contemplative, questioning, discuss abstract ideas.',
```

---

## Static Build Notes
- Run `node build-static.js` (or click 🏗 Static in live UI) after any `index.html` change to regenerate `docs/index.html`
- `build-static.js` must be in the same directory as `server.js`, `lessons.json`, `ui.json`, `languages.json`
- `UI_STRINGS_ALL` is baked into the static page at build time — all 29 languages available client-side
