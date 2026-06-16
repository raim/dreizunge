# Dreizunge v35 — Session Summary

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~5920 | Main app (live + static) |
| `server.js` | ~2174 | Node.js backend |
| `build-static.js` | ~697 | Static docs builder |
| `ui.json` | — | UI string translations (207 keys × 29 langs) |
| `lessons.json` | — | All lesson/storyline data (schema v29) |

Latest release: `dreizunge_v35.zip`

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

## Key Architecture Notes

- `APP._slScreen = { chainId, encodedChain, topics }` — set by all navigation to storyline screen
- `APP.info.canGenerate` — controls all live-only UI; false in static build
- `APP.muted` — global mute flag; suppresses all TTS when true
- `APP.storylines` — cached storyline array from `/api/storylines`, used for tag filtering
- `collectChainVocab(continuedFromTopic)` — walks `continuedFrom` chain for prior vocab; returns `{ words, nouns, verbs }`
- `collectChainStories(continuedFromTopic, maxChars)` — walks full chain collecting all prior stories in order; trims from front if total exceeds maxChars (default 8000)
- `reinforcePrior` — boolean sent in API body; gates `collectChainVocab` call
- `useFullChain` — boolean sent in API body; gates `collectChainStories` call for full narrative context
- `speakBodyText(bodyId, langCode, preText)` — unified speak entry point; auto-unmutes if muted; preText bypasses DOM
- `_speakAndAdvance(text)` — speaks in target lang then auto-advances exercise; respects `APP.muted`
- `_doSpeakLangThen(text, langCode, cb)` — speaks in specific lang, fires callback on completion
- `data-speak`, `data-lang`, `data-topic`, `data-chain` — data attributes throughout to avoid quote nesting in onclick strings
- `ehComputeDiff(correct, corrupted)` — LCS-based word diff used for error hunt exercise
- `storyDiff(original, edited)` — sentence-level diff for `ai_error_hunt` lessons
- `aiEhSplitSentences(text)` — clause splitter on `.!?,;:"` and paragraph breaks; returns mixed string/`{para:true}` array
- `aiEhLcsAlign(aArr, bArr)` — LCS alignment of clause arrays
- `aiEhGetSentences(lesson)` — reconstructs full aligned pairs from `aiStory`+`story`, rehydrates reasons from sparse `sentences[]`
- `aehSetReason(input, hunt)` — writes reason back to sparse `sentences[]` via `data-ai` attribute

---

## Lesson Types

| Type | Description |
|---|---|
| `standard` (vocab) | Vocabulary MCQ, ordering, typing exercises from story |
| `grammar` | Grammar correction exercises |
| `conjugation` | Verb conjugation exercises |
| `error_hunt` | Tap words with spelling/grammar errors in corrupted story |
| `ai_error_hunt` | Tap clauses changed by human when correcting AI story |
| `math` | Number ordering and arithmetic MCQ from story context |

**Current lesson counts in lessons.json:** 115 topics, 49 storylines, ~301 lessons total (standard: 251, error_hunt: 15, grammar: 12, math: 5, ai_error_hunt: 2, conjugation: 8)

---

## What Changed in v33

### AI Error Hunt (`ai_error_hunt`) — new lesson type

**Concept:** Student sees the original AI-generated story and taps clauses that were changed by a human editor. Mirrors the error hunt flow but at clause level, not word level.

**Data model per topic (sparse — only changed clauses stored):**
```json
{
  "story": "human-corrected version",
  "aiStory": "original AI text (immutable, set on first save)",
  "lessons": [{
    "type": "ai_error_hunt",
    "aiStory": "original AI text (copy)",
    "sentences": [
      { "ai": "original clause", "corrected": "human clause", "reason": "" }
    ]
  }]
}
```

**Splitting:** Clauses split on `.!?,;:"«»„''` plus paragraph breaks (`\n\n`). `{para:true}` sentinels preserve paragraph structure in the rendered view. Unchanged clauses not stored — reconstructed at runtime via LCS alignment.

**Workflow:** Edit story in lesson-set screen → check "🔎 AI hunt" → 💾 Save → lesson created/updated. The AI error hunt diff panel appears below the story while in edit mode, showing changed clauses with inline reason inputs. Reasons are saved with the lesson and shown in the post-exercise reveal.

**Exercise flow:** Same `ehToggle`/`ehCheck` pattern as error hunt but at clause level. Correct: ✅ feedback + speaks correct clause in target lang + auto-advances. Wrong: ❌ feedback + speaks correct clause, manual continue.

### index.html

- **Clause diff engine:** `aiEhSplitSentences`, `aiEhLcsAlign`, `aiEhGetSentences`, `aiEhAlignWithParas`
- **Word-level diff for reveal:** `aiEhWordDiff`, `aiEhDiffHtml` — inline red struck-through / green replacement
- **`renderAiErrorHunt`:** sentence-level tapping; `aiEhToggle`, `aiEhCheck`, `aiEhSuspect` Set
- **`renderAehDiffPanel`:** shows in story edit mode only; live updates with 600ms debounce while typing (if AI hunt checkbox checked); reason inputs write back to sparse `sentences[]` via `aehSetReason`
- **`openLessonEditor` ai_error_hunt block:** shows only changed clauses with word-diff and reason input
- **`aehSetReason(input, hunt)`:** safe upsert into sparse `sentences[]` using `data-ai` attribute
- **All type label/emoji maps** updated to include `ai_error_hunt`
- **`lesson.type.math`** added to all type maps (typeLabel, typeKey, typeEmoji, tk, em)
- **📋 → ✏️** on lesson editor buttons for consistency

### server.js

- **`storyDiffSentences(aiStory, corrected, existing)`:** sentence-level diff producing sparse `sentences[]` with reason preservation
- **`splitSentences(text)`:** clause splitter mirroring client; returns mixed string/sentinel array
- **`/api/save-story`:** accepts `generateAiHunt` flag; sets `aiStory` on first save (immutable); calls `storyDiffSentences` to create/update `ai_error_hunt` lesson

### ui.json (v33 additions, English-only)

`lesson.type.ai_error_hunt`, `lesson.ai_error_hunt.desc`, `lesson.ai_error_hunt.no_ai_story`, `lesson.ai_error_hunt.editor_hint`, `lesson.ai_error_hunt.changed_count`, `ex.error_hunt.result`, `ex.error_hunt.reason_placeholder`

---

## What Changed in v34

### Math Lesson Type (`math`) — new lesson type

**Concept:** Arithmetic exercises generated algorithmically (no LLM). Numbers drawn from difficulty-appropriate random pools, not story content.

**Number pools:**
- Beginner (1): 6 random integers from 1–9; ops +, −
- Intermediate (2): 8 random integers from 1–1000; ops +, −, ×
- Advanced (3): 8 random integers from 1–1000 + decimals; ops +, −, ×, ÷

**Exercise sub-types:**
- `math_order` — sort a shuffled subset of numbers ascending or descending (tap-to-place, like sentence order)
- `math_calc` — arithmetic MCQ: `a OP b = ?`, 4 choices with magnitude-scaled near-miss wrong answers

**Data model:**
```json
{
  "type": "math",
  "icon": "🔢",
  "title": "① ② ③",
  "desc": "＋ － × ÷",
  "numbers": [3, 7, 42, ...],
  "difficulty": 2,
  "exercises": [
    { "type": "math_order", "direction": "asc", "numbers": [...], "correct": ["3","7","42"] },
    { "type": "math_calc", "a": "7", "op": "+", "b": "42", "correct": "49", "choices": ["49","44","54","39"] }
  ]
}
```

**TTS:** Tapping operands in `math_calc` speaks them in the target language. After answering, the correct result is spoken via `_speakAndAdvance` (target lang, auto-advances on correct).

**Difficulty selector** added to the add-lesson UI on both lesson-set screen and landing card, pre-filled from topic's current difficulty.

### server.js

- **`generateMath(story, difficulty)`:** `extractNumbers` → `shuffle` pool → build `math_order` + `math_calc` exercises → return `{ lesson, tokens }`
- **`mathNearMiss(correct, nums, difficulty)`:** magnitude-scaled plausible wrong answers
- **`/api/jobs/cancel`:** POST endpoint; sets `job.status='cancelled'`, calls `job.abort()` if defined
- **`collectChainStories(continuedFromTopic, maxChars)`:** walks full `continuedFrom` chain collecting all prior stories; trims from front to stay within `maxChars`
- **`useFullChain`** in `generate()`: when true, passes all chain stories as structured context (`Chapter N — topic:\nstory`) instead of just the last 800-char tail

### index.html

- **`buildMathExercises(lesson)`:** dispatched from `buildExercises`; falls back to `generateMathExercisesClient` if `exercises[]` missing
- **`tMathOrder`, `tMathCalc`:** renderers; order uses tap-to-place pattern; calc shows tappable operands that speak on tap
- **`mathOrderPick`, `mathOrderRemove`, `updateMathPlaced`:** ordering interaction
- **`check()`:** `math_order` and `math_calc` added to `speakOk`, `speakBad`, `revealBody` ternary chains — same flow as vocab
- **`flagKey()`:** handles array `ex.correct` (math_order) via join
- **`pickChoice()`:** guarded against firing during TTS-disabled button state
- **Mute toggle:** `APP.muted` flag; `toggleMute()`, `updateMuteButtons()` — three 🔊/🔇 buttons (landing, lesson-set, storyline); all speech functions guard on `APP.muted`; tapping any speaker auto-unmutes
- **Stop generation:** `stopGeneration()`, `updateStopBtn()` — three 🛑 buttons next to mute; shown only when `APP.activeJob` is set
- **Storyline tags:** `renderSlTagsRow`, `openSlTagEditor`, `saveSlTags`, `setTagFilter`, `_renderTagFilterBar`; tag filter bar on landing; tags stored in storyline object via `POST /api/storylines`
- **`useFullChain` checkbox:** shown alongside `reinforcePrior` when continuation is selected
- **`doAddLesson` fix:** always reads `APP.lessonData.topic` for `lesson-card` sid to prevent wrong-topic adds

### ui.json (v34 additions, English-only)

`lesson.type.math`, `ex.badge.math_order`, `ex.badge.math_calc`, `form.format.math`

---

## What Changed in v35

### Base files
- **Uploaded `ui.json`** and **`lessons.json`** used as authoritative base (translated values preserved)

### ui.json
- **6 new English-only keys** for v34 features that had hardcoded strings (tags separated by `;`):

| Key | Value |
|---|---|
| `gen.use_full_chain` | `use full storyline as context` |
| `sl.tags_placeholder` | `+ tags` |
| `sl.tags_input_placeholder` | `Tags, semicolon-separated…` |
| `toast.gen_stopped` | `⛔ Generation stopped` |
| `ex.math_order.asc` | `Smallest → largest` |
| `ex.math_order.desc` | `Largest → smallest` |

### index.html (~5920 lines)
- All 6 hardcoded strings replaced with `t()` calls
- **Tag filter dropdown** (`<select id="tag-filter-select">`) in library header row next to 📚 title; hidden when no tags exist; empty option = show all
- **`_renderTagFilterBar()`** populates the dropdown and calls `_toggleStaticAiWarning(show)` — warning shown when no tag active (untagged = AI-generated), hidden when a curated tag is selected
- **`_toggleStaticAiWarning(show)`** shows/hides `#static-gen-overlay`; works in both live and static builds
- **Tags use semicolons** as separator throughout (`saveSlTags`, `openSlTagEditor`, placeholder)
- **`use-full-chain-row`** checkbox HTML added (was missing from v35 base)
- **Stop generation button** (🛑) added to landing page next to gen-btn in a flex row
- **Cancelled job** handled in poll loop — clears interval, hides pill, re-enables gen button
- **`#lib-filter` and `#tag-filter-bar` divs** added to landing page HTML above `#saved-list`
- **Tag→topic matching** fixed to use `sl.chapters` (topic IDs) instead of `s.chainId` (which is not stored on topic objects)

### server.js (~2174 lines)
- **`_syncStorylineForTopic`:** storyline ID no longer changes when a new chapter is added — `partialMatch` and `predecessorMatch` branches update `chapters` only, preserving the existing `id` (and therefore tags, title, icon, summary)
- **`callOllamaRaw`:** accepts optional `signal` (AbortController); `req.destroy()` called on abort; `signal.aborted` checked at entry and on response
- **`generate()`:** creates `AbortController`, sets `job.abort = () => _ac.abort()`; local `callLLM`/`callLLMLesson` wrappers forward signal so story and meta calls are abortable
- **`/api/jobs/cancel`:** also cancels `'pending'` jobs (not just `'running'`)

### build-static.js (~697 lines)
- **Static defaults on load:** `libFilter='all'`, `libSrcFilter='all'`, `libTagFilter='manually curated'`; `selectLang(APP.lang)` call removed from init (was overwriting globes with Italian)
- **`presentLangs` guard:** `sel.value==='all'` no longer overridden by first available language
- **Tag filter in static `loadSavedList`:** builds `_topicTags` map from `STATIC_STORYLINES`, filters by `APP.libTagFilter`, calls `_renderTagFilterBar()`
- **`setTagFilter` in staticOverrides:** sets `APP.libTagFilter` and calls `loadSavedList`

---

## ui.json Status

- **207 keys** in English
- **29 languages**
- **6 keys English-only** (awaiting translation): `gen.use_full_chain`, `sl.tags_placeholder`, `sl.tags_input_placeholder`, `toast.gen_stopped`, `ex.math_order.asc`, `ex.math_order.desc`
- `static.ai_warning` translated in all 29 languages
- `lesson.ai_error_hunt.desc` translated in all 29 languages

## Storyline ID Stability

Storyline IDs (`sl_NNNN`) are now stable across chapter additions. `_chainId()` hash is only used when creating a brand-new storyline. Extending an existing storyline (both `partialMatch` and `predecessorMatch` paths) updates `chapters[]` only — `id`, `title`, `icon`, `summary`, and `tags` are preserved.

---

## Forked Storylines

"Dolomites Disaster" (`sl_1191899409`) and "Gratitude in Alto Adige" (`sl_320941528`) share stem chapters. Both include the full 4-chapter chain — intentional and supported.

---

## AI Error Hunt Scheme

**Splitting:** on `.!?,;:"«»„''` plus `\n\n` paragraph breaks. Smallest tappable unit is a clause fragment.

**Scoring:** correct clause tapped = ✅ (+10pts), false tap = ❌ (−3pts), missed = ⚠️ (−5pts)

**`sentences[]` is sparse** — only changed entries stored. Runtime always reconstructs full aligned list from `aiStory` + `story` diff, then rehydrates reasons from sparse array by matching `ai` text.

---

## Math Lesson Details

**`generateMath` / `generateMathExercisesClient`:** pure difficulty pools, story content not used. Each generation randomises fresh numbers, so re-adding a math lesson gives variety.

**Near-miss deltas** scale with answer magnitude: `[1, ceil(mag×0.1), ceil(mag×0.2), 10]` for intermediate — so `100+256=356` gives wrong choices like `320`, `392`, `300` rather than `355`, `357`.

**`math_order` correct answer** is a string array joined with `", "` for TTS (prevents "three hundred and twelve" misread) and display.

---

## Known Issues / Deferred

- **Static docs** must be rebuilt manually after `index.html` changes
- **"All languages" filter button** in live landing page doesn't work — investigate
- **`rating.*` keys** called in HTML but missing from ui.json — fall back to key string (pre-existing)
- **`setGenStatus` null error** — intermittent, investigate
- **`/api/jobs/cancel`:** abort is wired into story/meta LLM calls via ; sub-generator calls ( etc.) still use outer wrappers but fail fast on next call once aborted

---

## TODO List

### 🔇 UI / UX

- **Speaker toggle**: replace 🔊 with toggle showing 🔇 while speaking, reverts when done
- **Remove large target language flag** from individual lesson set cards on landing page
- **"All languages" filter button** broken in live `index.html`
- **Static**: filter source languages by existing lessons
- **Furigana annotation** for Japanese source language lessons
- **Typing lessons**: remove word suggestions
- **`setGenStatus` null error** — investigate
- **Number words in target language** below math operands — deferred (needs lookup table or Intl support)

### 📝 Lesson Generation / Prompts

- **TTS in lessons**: longer sentences aborted — improve chunking
- **Vocab prompt**: ground forms, correct capitalisation (German nouns)
- **Conjugation language bleed**: Danish words in German conjugation
- **"I have my own story"**: allow source-only, target-only, or both
- **Incremental save**: story after generation; each lesson as generated
- **Story style** (`creative`, `neutral`, `scientific`, `journalism`, `essay`, `funny`, `philosophical`) — store in `lessons.json`
- **"Boost vocabulary"** option
- **Re-generating**: use previous lesson type setting
- **`/api/jobs/cancel`**: wire `job.abort()` into LLM stream to actually stop generation mid-flight

### 🐛 Bugs

- **Grammar lessons**: whole wrong sentence rendered word-by-word
- **`Meta failed` terminal error** — JSON parse issue after `Generating topic info…`
- **When starting lesson**: switch UI to lesson's source language
- **src==tgt loanwords**: filter in generation validation
- **English conjugation triviality**: skip or retry

### 🌍 Language-Specific

- **Arabic→Hebrew**: build English intermediate bridge
- **Lëtzebuergesch**: generate in German then translate
- **Old Japanese lessons**: kanji split repair
- **Other-than-English source language**: strengthen language reminders in prompts

### 🏗️ Lesson Types

- **Math — number translation**: show number words in target language below operands
- **Math — story numbers**: option to use numbers extracted from story text instead of random pool
- **Grammar — German adjectival nouns**: `ein Angestellter` vs `der Angestellte`
- **Error hunt — use existing storyline**: checkbox to generate from full continuation chain
- **Lesson type checkboxes**: any combination of types
- **ai_error_hunt — translate desc**: 28 other languages still using English fallback

### 📐 Storyline Tags

- **Predefined tag suggestions**: autocomplete from existing tags in editor input
- **Tag filter on storyline screen**: show only chapters matching current tag
- **Tag display on landing cards**: small badge on storyline cards

### 🗺️ Major / Exploratory

- **Phylogenetic language map UI**: 3D world map + language tree/DAG
- **Phylogeny-based lesson generation**: use language distance for smarter prompts
- **Auto-generate starter lessons** per language pair
- **MULTIZUNGE**: auto-generate + qualify all language pairs
- **Storyline-level lesson editor**: full generation/editing at individual lesson set level

---

## Static Build Notes

- Run `node build-static.js` (or click 🏗 Static in live UI) after any `index.html` change
- `UI_STRINGS_ALL` is baked into the static page at build time — all 29 languages available client-side
- `build-static.js` must be in same directory as `server.js`, `lessons.json`, `ui.json`, `languages.json`
