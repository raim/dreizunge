# Dreizunge v37 — Session Summary

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~6205 | Main app (live + static) |
| `server.js` | ~2065 | Node.js backend |
| `build-static.js` | ~703 | Static docs builder |
| `prompts.json` | — | All LLM prompt templates (13 keys, hot-reloaded) |
| `ui.json` | — | UI string translations (213 keys × 29 langs) |
| `lessons.json` | — | All lesson/storyline data (118 topics, 50 storylines) |

Latest release: `dreizunge_v37.zip`

---

## ⚠ Features Requiring Testing

The following were implemented in v37 and have not yet been tested in a live environment:

### PDF-to-Storyline pipeline
- Upload PDF → extract text (pdfjs-dist, client-side) → split into chunks at paragraph boundaries
- Preview/edit chunks (merge ↓, delete ✕, tap to expand)
- Sequential generation: each chunk becomes a lesson set with `continuedFrom` chaining
- **Bug fix (untested):** each chunk was creating a separate storyline because `contFrom` was forced to `null` when `userStory` was provided. Fixed by splitting into `contFrom` (for storyline tracking) and `contFromForStory` (for LLM story context).
- S/M/L chunk size selector (300/600/1000 words per chunk)
- `useFullChain: true` from chunk 2 onward (was chapter 3 — fixed)

### Vocabulary mode (reinforce / neutral / extend)
- Replaces the binary `reinforcePrior` checkbox with a three-way `<select>`:
  - 🔁 **reinforce** — prior chapter words woven into new sentences as anchors
  - ○ **neutral** — no prior vocab context passed
  - ➕ **extend** — prior words passed as explicit avoid-list; model steered toward fresh vocabulary
- Applies to vocab, grammar, and conjugation lessons
- Available in main generation form and all add-lesson panels
- Backward compatible: `reinforcePrior=true` still treated as `'reinforce'`

### Story language selector
- `<select id="user-story-lang">` in the user-story panel: 🎯 Target / 🏠 My language / 🌐 Other
- Three matching story hint templates in `prompts.json` (`storyHint_target`, `storyHint_source`, `storyHint_other`)
- Fixes the Italian story → German→Italian lesson failure where the model ignored source language

### Single-chapter storylines now shown
- `chapters.length >= 1` filter (was `> 1`) — single-chapter entries appear in the library

### prompts.json refactor
- All LLM system prompts extracted from `server.js` into `prompts.json`
- `fillPrompt(template, vars)` replaces `{L}`, `{S}`, `{diff}` etc.
- `fs.watch` hot-reload — edit prompts without restarting server
- 13 prompt keys: `vocab`, `vocabFromText`, `vocabTable`, `grammar`, `conjugation`, `errorHunt`, `translation`, `meta`, `metaTranslation`, `story`, `storylineTitle`, `storylineSummary`, `srcRepair`

### extractKeywords fix
- Removed hardcoded English+Italian stopword list
- Minimum word length 5 chars (filters most function words across European languages)
- CJK languages (`ja`, `zh`, `ko`) return a 80-char raw excerpt instead (regex-based extraction doesn't work for CJK)
- `lang` parameter passed through to extraction call sites

### Story slicing improvements
- `styleHint` (story excerpt in system prompt) removed entirely — story context only in user message
- Story excerpt capped at 1200 chars in user message
- Language-aware framing: `storyHint_target` / `storyHint_source` / `storyHint_other`

---

## Architecture Notes

### prompts.json structure
```
{
  "vocab": { "system": "...", "dialectNote": "...", "storyHint_target": "...", "storyHint_source": "...", "storyHint_other": "...", "prevHint": "...", "chainHint": "...", "user": "...", "suffix": "..." },
  "grammar": { "system": "...", "dialectNote": "...", "writingStyleNote": "...", "user": "...", "storyHint": "...", "priorHint": "..." },
  "conjugation": { ... same as grammar ... },
  "vocabTable": { "system": "...", "dialectNote": "...", "cjkNote": "..." },
  "vocabFromText": { ... },
  "errorHunt": { "system": "..." },
  "translation": { "system": "..." },
  "meta": { "system": "..." },
  "metaTranslation": { "system": "..." },
  "story": { "system": "...", "dialectNote": "...", "furiganaNote": "...", "writingStyleNote": "...", "continuationNote": "..." },
  "storylineTitle": { "system": "...", "user": "..." },
  "storylineSummary": { "system": "...", "user": "..." },
  "srcRepair": { "system_fix": "...", "system_deep": "..." }
}
```

### vocabMode flow
```
UI select (vocab-mode-select)
  → doGenerate() sends vocabMode: 'reinforce'|'neutral'|'extend'
  → /api/generate endpoint → generate()
  → _vocabMode = vocabMode || (reinforcePrior ? 'reinforce' : 'neutral')
  → chainVocab = collectChainVocab() if _vocabMode !== 'neutral'
  → chainOpts/lessonOpts carry vocabMode
  → generateOneLesson() builds chainHint:
      reinforce: "REINFORCE — weave these words..."
      extend:    "EXTEND vocabulary — do NOT use these words..."
  → generateGrammar() builds priorNouns:
      reinforce: "PRIOR NOUNS... reinforce where topic-relevant"
      extend:    "AVOID these nouns already covered"
  → generateConjugation(): same pattern for priorVerbs
```

### PDF pipeline flow
```
User selects PDF + chunk size (S/M/L = 300/600/1000w)
  → pdfjs-dist (CDN, lazy-loaded) extracts text page by page
  → _cleanPdfText(): dehyphenate, strip page numbers, normalise whitespace
  → _splitIntoChunks(text, targetWords): split at paragraph boundaries
  → Preview: chunk list with auto-titles, word counts, merge/delete controls
  → pdfGenerateAll():
      for each chunk i:
        POST /api/generate {
          topic: chunk.title,
          userStory: chunk.text,
          storyLen: chunk.wordCount,
          continuedFrom: prevTopic (server-confirmed from j.data.topic),
          useFullChain: i >= 1,
          userStoryLang: from selector
        }
        poll until done → prevTopic = j.data.topic
      → loadSavedList() → _openStorylineForTopic(lastTopic)
```

### contFrom vs contFromForStory (v37 bug fix)
```js
// contFrom: used for storyline tracking — set even when userStory is provided
const contFrom = (continuedFrom && findSaved(continuedFrom)) ? continuedFrom : null;
// contFromForStory: passed to generate() for LLM context — NOT set for user stories
const contFromForStory = (!userStory && contFrom) ? contFrom : null;

generate(..., contFromForStory, ...);         // LLM doesn't get prior story context
_syncStorylineForTopic(data.topic, contFrom); // chain tracking uses full contFrom
```

---

## Known Issues / Deferred

- **Static docs** must be rebuilt manually after `index.html` changes
- **"All languages" filter button** broken in live `index.html`
- **`setGenStatus` null error** — intermittent
- **PDF: split-at-cursor** not implemented (Phase 4)
- **PDF: complex layout** (columns, tables) — text order may be wrong; user edits in preview
- **`/api/jobs/cancel`:** abort is wired into story/meta LLM calls; sub-generators still use outer wrappers but fail fast on next call
- **Grammar/conjugation source-language bleed** — improved by adding L/S reminder in user message and story keyword hints, but not fully eliminated for difficult language pairs

---

## TODO

### 🔇 UI / UX
- **Number words in target language** below math operands
- **Furigana** for Japanese source language lessons
- **Typing lessons**: remove word suggestions
- **Static**: filter source languages by existing lessons

### 📝 Lesson Generation
- **Vocab prompt**: German noun capitalisation, ground forms
- **Conjugation**: Danish words bleeding into German — strengthen prompt or posterior validation
- **"Boost vocabulary"** option
- **Story style stored** in `lessons.json`

### 🏗️ Lesson Types
- **Math**: story-number extraction option (currently pure random pools)
- **Error hunt**: generate from full continuation chain
- **ai_error_hunt desc**: 28 languages still using English fallback

### 📐 Storylines
- **Tag suggestions**: autocomplete from existing tags
- **Tag filter on storyline screen**
- **PDF Phase 4**: page range selector, split-at-cursor, export chunk list

### 🗺️ Major
- **Phylogenetic language map UI**
- **MULTIZUNGE**: auto-generate all language pairs
