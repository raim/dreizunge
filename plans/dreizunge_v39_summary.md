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

