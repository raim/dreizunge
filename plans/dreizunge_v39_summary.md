# Dreizunge v39 — Session Summary

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~6530 | Main app (live + static) |
| `server.js` | ~2124 | Node.js backend |
| `build-static.js` | ~707 | Static docs builder |
| `prompts.json` | 15 keys | All LLM prompt templates (hot-reloaded) |
| `ui.json` | 243 keys | UI strings, English only for new keys |
| `lessons.json` | user-provided | All lesson/storyline data |
| `docs/index.html` | pre-built | Static deployment (GitHub Pages) |

---

## What Changed in v39 (vs v38)

### Story / Locking
- `story-hdr` changed from `<button>` to `<div role="button">` — browsers eject `<div>` children from `<button>`, making inner elements appear stray
- `story-arrow` ▼ re-added inside the div, placed left of action buttons
- `story-lang-lbl` (flag) and body speaker removed; header speaker kept
- "Read full story" on storyline page locked until all chapters complete (static/teacher-mode-off)
- Missing `</div>` on `#story-section` fixed — was causing `lang-footer` and edit buttons to leak out

### Teacher Mode
- Shown in live mode after `/api/info` fetch
- `updateTeacherModeBtn()` called from `applyUIStrings()` (after strings loaded), not from `init()` (before strings loaded) — this was the key fix for label updating on language change
- `APP._teacherMode = true` default in live (everything unlocked)
- `APP._teacherMode = false` default in static (stories locked); `build-static.js` sets this

### Lang-footer Layout
- Both `lang-footer` divs moved inside their containers (`ls-inner`, `sl-screen`)
- Source lang selector: `flex:1` removed, `width:auto` added — compact, centered

### Exercise / Complete Screen
- `type_conjugation` TTS now reads `pronoun + ' ' + correct` ("she loves" not "loves")
- Vocab box on complete screen: hidden for `error_hunt`/`ai_error_hunt`; for `math` shows operators used
- Math exercises not shuffled (order preserved)
- AI hunt checkbox (`gen-ai-hunt-cb`) default checked

### Lesson Hiding (ai_error_hunt)
- Delete button replaced with 🫥/👁 hide toggle for `ai_error_hunt` lesson type
- Hidden lessons: invisible in non-teacher mode; greyed out (`.hidden-node`) in teacher mode
- `startLesson()` skips hidden lessons when teacher mode is off
- `_hidden` flag saved to `lessons.json` via `POST /api/lessons/edit`

### useFullChain
- **Was broken**: `useFullChain` was destructured but never used — story always used `OLLAMA_MAX_PREV_STORY=800` chars
- **Fixed**: when `useFullChain=true`, full prior story passed (no slice); console log updated to reflect
- Console now shows `"using full X chars"` vs `"using last 800/X chars"`

### ui.json (243 keys, en only for new)
- 24 new keys from v38 session (teacher mode, vocab mode, story lang, toasts, etc.)
- 6 new lesson type description keys: `lesson.type.desc.vocab/grammar/conjugation/error_hunt/ai_error_hunt/math`
- Lesson node `node-desc` uses `t('lesson.type.desc.*')` with fallback to `L.desc`
- **English only** — translation script picks up absent keys automatically

---

## ⚠ Deferred (Describe for Next Session)

### "Message to LLM" extra input field
An additional collapsible input below the topic field. Text is NOT part of the topic — it's appended to the prompt with high priority instructions (e.g. "Also: use formal register", "Avoid the word X"). Server-side: append to all lesson-type prompts as a high-priority override block after the main system prompt. Suggested prompt framing: `"ADDITIONAL INSTRUCTIONS (high priority, override other instructions if needed): {msg}"`. Store as `additionalInstruction` in userOpts.

### Move "Generating topic info" after story
Currently: meta (topic rename) → story → lessons. Request: story → meta → lessons, so meta can consider the generated story. This requires restructuring `generate()` — the `userTopic` display name is currently used as the key before story generation. Needs care to not break `continuedFrom` chain tracking which relies on the topic key being stable.

---

## ⚠ Pitfalls for Future Claude Sessions

### 1. UI translation strings: t() in static HTML vs JS template literals
**Problem**: `${t('some.key')}` only works inside JavaScript backtick template literals. If placed in static HTML (between `<script>` tags is fine, but inside `<div>` tags it's a literal string), it renders as `${t('some.key')}`.

**Pattern that breaks**: replacing static HTML text with `${t('key')}` directly in the HTML.
```html
<!-- WRONG — renders literally -->
<span>Story unlocked!</span>  →  <span>${t('complete.story_unlocked')}</span>
```

**Correct approach**:
1. Give the element an `id`
2. Set text in `applyUIStrings()` via `_setText('element-id', t('key'))`

**Example**:
```js
// In applyUIStrings():
_setText('comp-story-unlocked-lbl', t('complete.story_unlocked'));
```

Check: search for `>${t(` in HTML outside script tags to find broken ones.

### 2. New ui.json keys: English only, no empty strings
When adding new UI string keys, add them **only to the `en` entry**. Do NOT add empty strings `""` to other languages — the offline translation script detects absent keys as needing translation. An empty string looks like an existing (blank) translation and is skipped.

```js
// WRONG
langs.forEach(lang => { ui[lang][newKey] = lang === 'en' ? value : ''; });
// CORRECT
ui['en'][newKey] = value;  // other langs: key simply absent
```

### 3. updateTeacherModeBtn timing
`updateTeacherModeBtn()` reads `t()` for translated labels. If called before `loadUIStrings()`, `t()` returns the raw key string. Always call it from `applyUIStrings()` (which runs after strings load), not from `init()` directly.

### 4. DOM structure side effects of seemingly unrelated changes
Moving or adding elements to fix one visual issue can break others:
- Adding `max-width` to `lang-footer` CSS made it left-align (wrong fix) — the real fix was moving the element inside its constrained container
- Showing `#teacher-mode-bar` in live mode caused the lang-footer to appear full-width because the bar was a sibling of `ls-inner` and the footer width was inherited

**Pattern**: when a layout breaks after a feature addition, first check if any elements changed position in the DOM tree (parent/sibling relationships), not just CSS.

### 5. `<button>` cannot contain `<div>` children
Browsers silently move `<div>` children out of `<button>` elements (invalid HTML per spec). This causes inner elements to render as stray siblings. Use `<div role="button" tabindex="0">` for complex collapsible headers with nested action buttons.

### 6. `useFullChain` vs `OLLAMA_MAX_PREV_STORY`
The `useFullChain` flag in `userOpts` must be explicitly checked in `generate()`. It's easy to add it to the destructure but forget to wire it to the actual slice logic. Always verify new feature flags are used, not just destructured.

---

## TODO (Next Session)

### 🔤 Prompt Engineering
- "Message to LLM" input field (additional instructions, high priority override)
- Move topic info (sysMeta) to after story generation

### 🔢 Math / LaTeX
- LaTeX in MCQ choices (requires replacing `cGrid` for `math_latex`)
- "LaTeX only" toggle in instruction UI
- Translate `teacher.mode_on/off`, `complete.story_unlocked`, vocab mode, story lang, toast, lesson type desc keys to all 29 languages

### 📝 Lessons
- German noun capitalisation in vocab prompts
- Furigana for Japanese source language
- `ai_error_hunt` desc already in ui.json; all other 28 languages still need translation

### 🌍 Scale
- Quality scan: auto-generate same topic across all language pairs
- MULTIZUNGE: auto-generate all language pair combinations
- Phylogenetic language map UI

---

## Extend Vocab Mode — Implementation Plan (Next Session)

### Current state
`vocabMode='extend'` collects all prior chapter vocabulary via `collectChainVocab` and appends an avoid-list to the **user message** only. Two problems: small models partially ignore long avoid-lists in user messages; and there's no positive guidance about what to teach instead.

### Planned improvements

**1. Story-keyword positive anchors in vocab lesson**
Call `extractKeywords(story, 8, lang)` (already exists, used in grammar/conjugation) in `generateOneLesson` and add a `storyKeywordsHint` fragment to the user message for extend mode:
```
Focus on these story-specific words: {keywords}
```
This gives the model clear positive direction rather than only "avoid these".

**2. Filter avoid-list against new story text**
Before building `chainHint`, filter `chainVocab.words` to only words absent from the new story:
```js
const storyText = story?.toLowerCase() || '';
const filtered = chainVocab.words.filter(v => !storyText.includes(v.target.toLowerCase()));
```
Shorter, more targeted avoid-lists work better with small models. Words that reappear in the new story are legitimately worth teaching in that new context anyway.

**3. Move avoid-list instruction to system prompt**
Add an `extendNote` fragment to `prompts.json` that is appended to the system prompt when `vocabMode='extend'`. System-prompt constraints are weighted more heavily than user-message trailing instructions:
```json
"extendNote": "\nIMPORTANT: This is a vocabulary EXTENSION lesson. You MUST choose words NOT already covered. The avoid-list in the user message is a hard constraint."
```

**4. Wire `addVocabMode` in add-lesson endpoint**
The `/api/lessons/add-lesson` endpoint currently uses binary `addReinforce` to decide whether to collect `chainVocab`. Replace with three-way `addVocabMode` logic matching the main generate pipeline.

**5. `prompts.json` additions**
- `vocab.storyKeywordsHint`: `"\n\nFocus on these words from the story: {keywords}"`
- `vocab.extendNote`: system-prompt hard constraint (see above)

### What is NOT changing
- `useFullChain` (story context length) and `collectChainVocab` (vocab collection) remain independent — they serve different purposes and are correctly orthogonal
- `extractKeywords` in grammar/conjugation stays as-is


---

## Additional Changes (Late v39 Session)

### Export/Import Fixes
- **Export now includes storylines** — `{ schemaVersion:29, topics:[...], storylines:[...] }` format; storylines filtered to those containing exported topics
- **Client `importLessons`** — fixed to handle `data.topics` (v29) in addition to `data.lessons` (legacy); passes full envelope to server so storylines arrive intact
- **Server import** — `_syncStorylineForTopic` was never called (condition always false after `upsert`); fixed to always rebuild chains from `continuedFrom` for old-format imports; new-format storylines always upserted (update if more chapters)
- **Static import** — `importLessons` in `build-static.js` is a completely separate hardcoded function (does NOT use the one from `index.html`) — fixed same v29 format handling there; storylines now update existing entries if imported version has more chapters
- **Story saved early** — `upsert()` called in `generate()` immediately after story is written (before lesson generation), so story is never lost if lessons fail

### build-static.js Pitfalls (add to pitfalls section)
- `build-static.js` **completely overrides** several functions from `index.html` (including `importLessons`, `init`, `loadSavedList`). Changes to those functions in `index.html` have NO effect on the static build. Always check `build-static.js` for hardcoded overrides when a feature works in live but not in static.
- Code injected via the string array in `build-static.js` must have each logical line as its own `'...',` entry. Embedded `\n` in a string literal breaks the outer JS. Comments must be on their own line entry.
- `byId` in static `loadSavedList` is built from `filtered` (language-filtered lessons). Chapter IDs from imported storylines may reference topics not in the current filter. Solution: use `byIdAll` (all saved) for ID resolution, `byTopic` (filtered) for rendering, and filter storyline chains to only chapters visible in the current language filter.


---

## Story DAGs — Architecture Plan (Future Major Feature)

### Current state
Storylines are **linear chains**: each topic has a single `continuedFrom` pointer, and `_syncStorylineForTopic` walks this linked list to build a flat `chapters[]` array. Multiple storylines can share initial chapters (e.g. "Energie aus Luft" and "Energie und Verlangen" both start with the same two topics), but these are stored as separate independent storylines with overlapping chapter IDs — not as a true branching structure.

### Desired state: DAG (Directed Acyclic Graph)
- A chapter can have **multiple successors** (branching) — one storyline forks into two narrative directions
- A chapter can have **multiple predecessors** (merging/fusing) — two storylines converge into one, with story generation receiving context from both parent stories
- The UI needs to show branching trees rather than flat lists of chapters

### Phase 1: Branching display (medium complexity)
The data model already supports branches implicitly — multiple topics can have the same `continuedFrom` value. The storyline screen just needs to:
- Detect when a chapter has multiple successors (build a successor map from `continuedFrom` links)
- Render branch points visually (a fork icon, indented sub-chains, or a tree layout)
- Allow selecting which branch to continue from when adding a new chapter

`_syncStorylineForTopic` would need to be replaced or extended — currently it assumes one linear chain. A new `buildStorylineTree(rootTopic)` function would return a tree structure rather than a flat array.

### Phase 2: Story fusion / multi-parent context (larger complexity)
When generating a new chapter that continues from **two parent stories**:
- The generation form needs a "merge from" selector (pick a second storyline as additional context)
- `generate()` receives `continuedFrom` (primary parent) and `mergedFrom` (secondary parent)
- The story prompt receives both parent stories as context: `"Story A (primary):\n{story_a}\n\nStory B (secondary context):\n{story_b}\n\nContinue the narrative merging both threads."`
- The topic object stores both `continuedFrom` and `mergedFrom` links
- `collectChainVocab` walks both parent chains for vocabulary context
- `useFullChain` applies to both chains

### Data model change
```json
{
  "topic": "Die Fusion",
  "continuedFrom": "Verlangen in der Dunkelheit",
  "mergedFrom": "Energie aus Luft",
  "story": "...",
  "lessons": [...]
}
```

The storylines array would change from `chapters: [id1, id2, ...]` to a DAG adjacency structure, or storylines could remain linear with branch/merge metadata on the topic objects themselves.

### UI implications
- Storyline screen: tree/graph layout instead of vertical list
- Branch point: show diverging paths side by side or collapsible
- Merge point: show converging arrows or a "sources" indicator
- The path progress bar becomes a tree progress indicator

### Implementation order
1. **Branching display only** (read-only, no new generation) — detect shared `continuedFrom` roots and render as a tree; no data model change needed
2. **Branch generation** — UI to select which chapter to continue from when the current last chapter has siblings
3. **Merge/fusion generation** — `mergedFrom` field, dual-parent story context
4. **DAG storyline model** — replace flat `chapters[]` with proper adjacency structure

This is a significant UI and data model change. Start with Phase 1 (branching display) which requires no data model changes and is purely a rendering improvement.

---

## Story Branching Renderer (Late v39)

### What was implemented
`_renderStorylineScreen` now uses a recursive `_renderChain()` function instead of a linear `topics.forEach()` loop. Changes are in `index.html` only — `build-static.js` does not override `_renderStorylineScreen`, so the same renderer is used in both live and static modes.

### How it works
A global successor map `_succMap` is built from all `APP.savedList` topics via their `continuedFrom` links. For each topic being rendered, successors are split into:
- **`ownKids`** — successors that belong to the current storyline's topic set → rendered fully and recursively
- **`otherKids`** — successors from other storylines → rendered as a greyed-out stub (1 chapter, non-interactive, `opacity:.5; pointer-events:none`)

Single successors render linearly (no visual change from before). Multiple successors trigger a `display:flex` column split with ⑂ A / ⑂ B branch labels and a vertical divider.

### Key design decisions
- Cross-storyline branches ARE shown as stubs — a storyline that forks into another shows the first chapter of the other branch, making the divergence visible
- Other-branch stubs are non-interactive (can't click into them from this storyline)
- Depth limit of 20 prevents infinite loops on malformed data
- Root detection: topics whose `continuedFrom` is not in the current storyline's topic set

### Import fix (same session)
Server-side `upsertStoryline` on import was unconditional — overwrote existing storylines even if the imported version had fewer chapters. Fixed in `server.js`: if the existing storyline has more chapters, only title/icon/summary are updated from the import; chapters are never shrunk. Same rule already applied in static import.

### Pitfall for next session
`_renderStorylineScreen` is shared between live and static (not overridden in `build-static.js`). Changes to it only need to go in `index.html`. But `loadSavedList` IS overridden in `build-static.js` and must be updated there separately for any landing-page changes.

---

## Extend Vocab Mode — Implemented (Late v39)

Items 2 and 4 from the plan above were implemented in `server.js` only:

**`addVocabMode` wired in add-lesson endpoint (item 4 — done)**
`/api/lessons/add-lesson` now derives `_addVocabMode = addVocabMode || (addReinforce ? 'reinforce' : 'neutral')` and uses it for chain vocab collection and for grammar/conjugation opts. The ✚ button's extend mode now actually works.

**Avoid-list filtered against new story (item 2 — done)**
In extend mode, prior words that appear in the new story text are removed from the avoid-list before sending to the model. Pool extended to 40 words before filtering (was 30), so after filtering a useful number remain. Only genuinely redundant words (absent from the current story) are on the list.

**Still remaining from the plan:**
- Item 1: Story-keyword positive anchors (`extractKeywords` in `generateOneLesson` for extend mode)
- Item 3: Move avoid-list instruction to system prompt (`extendNote` in `prompts.json`)

---

## TODO: Google Cloud TTS fallback (for Firefox/Linux)

Firefox on Linux uses speech-dispatcher which only provides espeak-ng voices — robotic quality. Chrome bundles neural voices. Code-side voice selection is already optimal; the system TTS is the bottleneck.

**Plan:** add a server-side TTS proxy endpoint in `server.js` using Google Cloud TTS (or OpenAI/ElevenLabs TTS as alternative). Client detects poor voice quality and falls back to the server endpoint.

### Server side
- `GET /api/tts?text=...&lang=de-DE` — proxy to Google Cloud TTS REST API, return audio/mpeg
- Cache responses in memory (Map keyed by `lang+text`) to avoid repeated API calls
- API key stored as env var `GOOGLE_TTS_KEY` (falls back to speechSynthesis if not set)
- Google Cloud TTS pricing: ~$4 per 1M characters (very cheap for personal use)

### Client side  
- Detect: if best available `speechSynthesis` voice is espeak (name contains 'espeak' or '+' indicating espeak-ng format), use server TTS instead
- Play response via `new Audio(url)` or `AudioContext` instead of `speechSynthesis`
- Static/GitHub Pages version: no server available, always falls back to speechSynthesis
- Cache URLs client-side for repeated playback

### Notes
- Only works in live mode (server running) — static always uses speechSynthesis
- OpenAI TTS (`tts-1` model) is a good alternative if OpenAI key already configured
- ElevenLabs has a free tier but rate-limited
- Chunking logic (`_ttsChunks`) can be reused; server endpoint handles one chunk at a time

---

## TTS / Voice Selection — Status & Notes

### What was implemented
- `_buildGlobalTtsSelectors()` — builds language + voice selectors in all footer rows (lesson-set, storyline screens); handles async `voiceschanged` and deferred LANGS loading
- Voice ranking: online/neural voices scored highest, espeak/mbrola scored lowest; named voice preference stored in `localStorage` per language
- All three speak paths (`_speakChunks`, `_speakAndAdvance`, `speakBodyText`) respect `APP._ttsVoiceName`
- Old `tts-row` hidden; new footer layout: Row 1 = UI + source lang; Row 2 = 🗣 + TTS lang + voice + 🔊 mute
- Firefox `setTimeout` fix: removed 50ms delay after `speechSynthesis.cancel()` which was breaking Firefox user-gesture context

### Chrome
Works well — Google's neural cloud voices are available, voice selector lets you choose between them.

### Firefox on Linux
All available voices are espeak-ng variants (e.g. "German+Steph2", "German+Quincy") — they all use the same synthesis engine and sound identical. Voice selector shows all 102 variants but none sound natural. This is a system-level limitation, not a code issue.

**Fix**: install Piper TTS manually (see earlier discussion), or implement the Google Cloud TTS proxy (see TODO section). No further code changes possible without a better TTS engine on the system.

### Pitfall: element ID aliases
The footer HTML uses short IDs (`ls`, `sl`) that match what all JS functions expect. When restructuring footer HTML, always use these short aliases — e.g. `id="src-lang-select-footer-ls"` not `id="src-lang-select-footer-lessonset"`.
