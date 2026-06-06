# Dreizunge v32 — Session Summary

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~5400 | Main app (live + static) |
| `server.js` | ~2000 | Node.js backend |
| `build-static.js` | ~680 | Static docs builder |
| `ui.json` | — | UI string translations (~195 keys × 29 langs) |
| `lessons.json` | — | All lesson/storyline data (schema v29) |
| `lesson-editor.html` | — | Standalone manual lesson editor (no server needed) |

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

## Key Architecture Notes

- `APP._slScreen = { chainId, encodedChain, topics }` — set by all navigation to storyline screen
- `APP.info.canGenerate` — controls all live-only UI; false in static build
- `collectChainVocab(continuedFromTopic)` — walks `continuedFrom` chain for prior vocab; returns `{ words, nouns, verbs }`
- `reinforcePrior` — boolean sent in API body; gates `collectChainVocab` call
- `speakBodyText(bodyId, langCode, preText)` — unified speak entry point; preText bypasses DOM
- `data-speak`, `data-lang`, `data-topic`, `data-chain` — data attributes throughout to avoid quote nesting in onclick strings
- `ehComputeDiff(correct, corrupted)` — LCS-based word diff used for error hunt exercise; `edits[]` not stored, computed at exercise start
- `storyDiff(original, edited)` — token-level diff with context anchoring for `ai_error_hunt` lessons
- `ehClassify(a, b)` — prefix check first (suffix add/remove → grammar), then Levenshtein ≤2 → spelling, else grammar

---

## What Changed in v32

### Data / lessons.json

- **`srcLang` backfilled** to `"en"` on all 66 topics that had `null`
- **Duplicate storyline removed**: `sl_1834202256` deleted; `sl_887116336` extended to 5 chapters
- **"Gratitude in Alto Adige" (`sl_320941528`)**: stem chapters prepended — now 4 chapters including shared Dolomites fork root
- **Russian `form.format.standard`** fixed
- **`edits[]` removed** from all 15 error hunt lessons — now derived from `ehComputeDiff(story, corruptedStory)` at runtime
- **"Disaster Rescue"** corrupted story regenerated with 7 scheme-compliant errors
- All 15 error hunt corrupted stories cleaned (double dots, stray punctuation removed)

### ui.json

- **`lesson.type.*` keys**: `vocab`, `grammar`, `conjugation`, `error_hunt` — emojis moved to code
- **`lesson.type.ai_error_hunt`** → `"AI Error Hunt"` (29 langs, English only — translate later)
- **`lesson.ai_error_hunt.desc`** → `"Find AI errors that were corrected by a human tutor."`
- **`static.ai_warning`** added in all 29 languages
- **3 keys removed** (`confirm.delete_chapters`, `toast.chapters_deleted`, `toast.chapters_deleted_plural`) — replaced with hardcoded `🗑️ {n}`
- Various dead/duplicate keys removed; emoji moved out of translated strings

### server.js

- **`collectChainVocab(continuedFromTopic)`**: walks `continuedFrom` chain for prior vocab
- **`reinforcePrior`**: checkbox gates prior vocab in all lesson generators
- **`/api/build-static`**: POST endpoint — runs `node build-static.js`
- **`/api/storylines` POST**: accepts `summary` field for partial patch
- **`/api/save-story`**: now accepts `generateAiHunt` flag; sets `aiStory` on first save (immutable); calls `storyDiff()` to create/update `ai_error_hunt` lesson
- **`storyDiff(original, edited)`**: token-level LCS diff with 40-char context anchoring — produces `{find, replace, context_before, context_after, reason}` edits
- **Error hunt prompt overhaul**: `sysErrorHunt` now asks for corrupted story TEXT only (no JSON). Explicit rules: spelling = interior letter change (no prefix relation); grammar = suffix add/remove (shorter word is prefix of longer)
- **`generateErrorHunt`**: returns `corruptedStory` text only, `edits[]` empty (derived client-side)

### index.html — New Features

**AI Error Hunt lesson type (`ai_error_hunt`)**:
- Generated when user edits a story and checks "🔎 AI hunt" in the story toolbar
- Displays original `aiStory` with corrections highlighted; student taps changed words
- `aiStory` stored once (first save), never overwritten
- `buildEhEditMap` uses `context_before` for unambiguous token location
- In `renderAiErrorHunt`: find/replace swapped so `buildEhEditMap` searches `aiStory` for the AI's original text
- `openLessonEditor` shows diff with reason annotation fields for each correction

**Error hunt diff engine**:
- `ehTokenize`, `ehLevenshtein`, `ehLcsOps`, `ehComputeDiff`, `ehBuildDiffHtml`, `ehClassify`, `ehUpdateDiff`, `ehRenderErrors`
- `ehClassify(a, b)`: prefix check first → grammar; Levenshtein ≤2 → spelling; else grammar
- `edits[]` never stored — computed fresh at exercise start from `ehComputeDiff(story, corruptedStory)`
- `buildEhEditMap` uses `context_before` for unambiguous edit location

**Error hunt editor in `openLessonEditor`**:
- Two textareas (correct / corrupted) + live diff display + auto-classified error table
- Correct story textarea is **read-only** (edit story in lesson-set screen story editor)
- Corrupted story textarea triggers `ehUpdateDiff` on input
- `APP._ehSessionEdits` caches session edits so `ehSyncCorrupted` can re-apply them when correct story changes

**Story editing**:
- `saveStoryEdit` sets `aiStory` on first save; passes `generateAiHunt` flag to server
- Story edit toolbar now inline in header row next to ✏️ button (💾, ✕, 🔎 AI hunt checkbox, status)
- `ehSyncCorrupted(li)` re-applies session edits on correct story changes during editing session

**Manual lesson editor (`lesson-editor.html`)**:
- Standalone HTML, no server needed
- Four lesson types: vocab, grammar, conjugation, error hunt
- Error hunt tab: two textareas + live LCS diff + auto-classified error table
- Emoji picker (same `EMOJI_CATEGORIES` as app, 1100+ emoji, 8 tabs + search)
- Export as schema v29 JSON importable via Dreizunge Import button
- Load existing `lessons.json` for editing
- Open panels preserved across add/remove row operations

### index.html — TTS / Speech

- **`_ttsChunks(text)`**: splits at sentence boundaries (max 200 chars/chunk)
- **`_speakChunks(chunks, langCode, rate, idx)`**: chains chunks via `u.onend`
- **`_doSpeak` / `_doSpeakLang`**: skip 50ms cancel delay when engine was idle
- **`speakBodyText(bodyId, langCode, preText)`**: preText bypasses DOM; falls back to `data-topic` → savedList → `APP._slScreen` → async fetch; chain story speaker reads from `APP._slScreen.topics` with per-topic API fetch fallback
- **Summary speakers** use `APP.srcLang`; story/chain speakers use topic's `lang`
- **`_unlockTts()`** called at top of `speakBodyText` for early engine init
- **🔇 stop buttons** on landing page, lesson-set footer, storyline footer — only cancel if `speaking||pending`

### index.html — Layout / UX

- **Lesson locking disabled in live mode**: `isLocked = !APP.info.canGenerate && i>0 && !done[...]` — all lessons freely clickable in live mode
- **Nested button fix**: all `<button>` inside `<button>` replaced with `<div role="button">` + `<span>` (saved-item story header, read-full-story header)
- **Speaker order**: arrow ▼ always before 🔊; speakers outside clickable divs (sibling flex)
- **`form-lbl`**: `display:inline` so emoji + label on same line as select
- **Language footer**: `🗣 [src lang select] [🔇]` at bottom of lesson-set and storyline screens
- **Static AI warning overlay**: `t('static.ai_warning')`, amber style, updates on language switch
- **Storyline screen summary**: inline ✏️ pencil in summary header row; saves via `POST /api/storylines`; calls `loadSavedList()` after save
- **`saveSlScreenTitle` / `genStorylineSummary` / `saveSummaryEdit`**: all call `loadSavedList()` so landing cards refresh without reload
- **Emoji picker**: 1100+ emoji, 8 categories, tabs + search; missing emoji added from `lessons.json` scan

### build-static.js

- Speaker outside clickable div (sibling flex pattern)
- `data-topic` + `data-lang` on `sis-body` divs for collapsed-body speak
- `t('static.ai_warning')` replaces hardcoded English block
- Summary strip: 🔊 + ✏️ buttons

---

## Forked Storylines

"Dolomites Disaster" (`sl_1191899409`) and "Gratitude in Alto Adige" (`sl_320941528`) share stem chapters (`tp_1704125569` "climbing in the dolomites", `tp_598353466` "Helping Injured Hikers"). Both storylines include the full 4-chapter chain. Shared chapters appear in both — intentional and supported.

---

## Error Hunt Scheme

**Spelling errors** — interior letter change, no prefix relation:
- Swap one letter (e→i, ei→ie, b→d)
- Omit/double interior letter
- Wrong vowel, missing accent/diacritic

**Grammar errors** — suffix add/remove, shorter word is prefix of longer:
- Verb suffix (`explore` → `explores`, `oscillated` → `oscillate`)
- Plural/singular (`cell` → `cells`)
- Article gender (only when prefix relation holds)

**Classifier** (`ehClassify(a, b)`):
1. If `hi.startsWith(lo)` → grammar
2. Levenshtein ≤2 → spelling
3. Otherwise → grammar

**`edits[]` not stored** — always derived from `ehComputeDiff(story, corruptedStory)` at exercise start. Context anchoring (`context_before` 40 chars) used in `buildEhEditMap` to locate edits unambiguously even when the same word appears multiple times.

---

## AI Error Hunt (`ai_error_hunt`)

New lesson type where the student finds corrections a human made to an AI-generated story.

**Data model per topic**:
```json
{
  "story": "human-corrected version",
  "aiStory": "original AI text (immutable, set on first save)",
  "lessons": [
    {
      "type": "ai_error_hunt",
      "aiStory": "original AI text (copy)",
      "edits": [
        {
          "find": "AI's original text",
          "replace": "human correction",
          "context_before": "up to 40 chars before",
          "context_after": "up to 40 chars after",
          "reason": "optional annotation"
        }
      ]
    }
  ]
}
```

**Workflow**: edit story in lesson-set screen → check "🔎 AI hunt" → 💾 Save → lesson created/updated automatically. Subsequent saves add new edits, preserving existing `reason` annotations.

**Exercise**: shows `aiStory`; student taps words that were changed; uses same `ehToggle`/`ehCheck` flow as regular error hunt.

---

## Known Issues / Deferred

- **Static docs** must be rebuilt manually after `index.html` changes (`node build-static.js` or 🏗 Static button)
- **"All languages" filter button** in live landing page doesn't work — investigate
- **`rating.*` keys** called in HTML but missing from ui.json — fall back to key string (pre-existing)
- **`setGenStatus` null error** — intermittent, investigate
- **Error hunt JSON parse error** — `Error-hunt lesson failed: Unexpected string in JSON` — now moot (text-only output) but worth monitoring

---

## TODO List

### 🔇 UI / UX

- **Speaker toggle**: replace 🔊 with toggle showing 🔇 while speaking, reverts when done. Deferred: unreliable `speechSynthesis.onend` with chunking; multiple simultaneous speakers.
- **Remove large target language flag** from individual lesson set cards on landing page
- **"All languages" filter button** broken in live `index.html`
- **Static**: filter source languages by existing lessons
- **Furigana annotation** for Japanese source language lessons
- **Typing lessons**: remove word suggestions
- **`setGenStatus` null error** — investigate
- **UI during generation**: keep English instead of showing key placeholders

### 📝 Lesson Generation / Prompts

- **TTS in lessons**: longer sentences aborted — improve chunking
- **Vocab prompt**: ground forms, correct capitalisation (German nouns)
- **Conjugation language bleed**: Danish words in German conjugation — strengthen prompt or add posterior validation
- **"I have my own story"**: allow source-only (model translates), target-only, or both
- **Incremental save**: story after generation; each lesson as generated
- **Story style** (`creative`, `neutral`, `scientific`, `journalism`, `essay`, `funny`, `philosophical`) — store in `lessons.json`
- **"Boost vocabulary"** option
- **Re-generating**: use previous lesson type setting
- **`translate-ui.js`**: README + option to prune unused keys
- **Generation stats**: full model setup in `generationStats`; document key renaming with `sed` command
- **`translate-ui.js` console**: prefix with `"UI [{lang}]"`

### 🐛 Bugs

- **Grammar lessons**: whole wrong sentence rendered word-by-word — should be one error, user marks whole sentence
- **`Meta failed` terminal error** — JSON parse issue after `Generating topic info…`
- **When starting lesson**: switch UI to lesson's source language
- **src==tgt loanwords**: filter in generation validation
- **English conjugation triviality**: skip or retry

### 🌍 Language-Specific

- **Arabic→Hebrew**: build English intermediate bridge; warn for Arabic, Swahili, Lëtzebuergesch
- **Lëtzebuergesch**: generate in German then translate (not reverse)
- **`translategemma`**: avoid for Italian/Spanish/Portuguese/Vietnamese; use qwen
- **Old Japanese lessons**: kanji split repair
- **Other-than-English source language**: Italian→English struggles; strengthen language reminders in prompts

### 🏗️ Lesson Types

- **Grammar — German adjectival nouns**: `ein Angestellter` vs `der Angestellte`
- **Grammar — gender forms**: fuse female/male forms into one structure
- **Error hunt — use existing storyline**: checkbox to generate from full continuation chain
- **Lesson type checkboxes**: any combination of types (vocab, grammar, conjugation, error hunt)
- **Error hunt words**: only use words from prior vocab/sentence lessons

### 📐 Multi-lingual Storylines

- **Multi-lingual** don't work well — mixed-language output
- **Cross-language continuation**: translate previous story before continuing in new language
- **Storyline flags**: show ALL from/to language flags for all lessons

### 🗺️ Major / Exploratory

- **Phylogenetic language map UI**: 3D world map + language tree/DAG. See `plans/map.md`, `plans/map.html`, `plans/tree.md`
- **Phylogeny-based lesson generation**: use language distance for smarter prompts
- **Auto-generate starter lessons** per language pair
- **MULTIZUNGE**: auto-generate + qualify all language pairs; indicate on map/tree UI
- **Storyline-level lesson editor**: full generation/editing at individual lesson set level

---

## Style Overrides in server.js

```js
funny: 'You are a comedian, tell jokes, use wordplay, absurdist situations, punchlines.',
philosophical: 'Be philosophical: contemplative, questioning, discuss abstract ideas.',
```

---

## Static Build Notes

- Run `node build-static.js` (or click 🏗 Static in live UI) after any `index.html` change
- `build-static.js` must be in same directory as `server.js`, `lessons.json`, `ui.json`, `languages.json`
- `UI_STRINGS_ALL` is baked into the static page at build time — all 29 languages available client-side
