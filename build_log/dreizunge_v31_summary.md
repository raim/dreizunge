# Dreizunge v31 — Session Summary

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | 4812 | Main app (live + static) |
| `server.js` | 1884 | Node.js backend |
| `build-static.js` | 669 | Static docs builder |
| `ui.json` | — | UI string translations |
| `translate-ui.js` | — | Translation helper script |
| `migrate-v29.js` | — | One-time v28→v29 migration |

Latest release: `dreizunge_v31.zip`

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

## Data Model (lessons.json, schemaVersion 29)

```json
{
  "schemaVersion": 29,
  "topics": [ { ...topic } ],
  "storylines": [ { ...storyline } ],
  "flags": { "topicSlug:type:contentSlug": { ...entry } }
}
```

### Topic fields
- `id`: `"tp_NNNN"` (stable string id)
- `topic`, `lang`, `srcLang`, `storyLang`, `difficulty`, `storyLen`
- `story`: the original generated story text (correct version)
- `storyTranslation`, `storyStyle`, `userDialect`
- `lessons[]`: array of lesson objects

### Lesson fields
- `id`: `"ls_NNNN"` (string) — **required** for edit buttons to show
- `type`: `"standard"` | `"grammar"` | `"conjugation"` | `"error_hunt"`
- `title`, `desc`, `icon`
- `_checked`: ISO timestamp — set when lesson editor is closed/saved (user reviewed it)
- `_storyEdits[]`: ISO timestamp array — appended when topic story is edited

### Vocab/sentence/grammar item fields
- `target`, `source`
- `_manualEdits[]`: ISO timestamp array — appended when item is edited and saved
  - Migration: old `"_manualEdit": true` → replace with `"_manualEdits": ["2025-01-15T..."]`

### Error hunt lesson fields
- `corruptedStory`: the story with deliberate errors inserted
- `edits[]`: `{ type, find, replace, reason }`
  - `find` = **correct** word/phrase
  - `replace` = **wrong/corrupted** text in the story
- `correctStory`: user-edited correct version (saved via `/api/save-story`)

---

## Server Endpoints (server.js)

### Lesson generation
- `POST /api/generate` — generate full lesson set from topic
- `POST /api/lessons/add-lesson` — add one lesson to existing topic
  - `{ topic, lessonFormat: "standard"|"grammar"|"conjugation"|"error_hunt" }`
  - New lessons get `id: "ls_" + Date.now()`
- `POST /api/save-story` — save edited story text to `topic.story`
  - `{ topic, story }`

### Data management
- `GET /api/lessons/load?topic=...` — load topic data
- `POST /api/lessons/edit` — save lesson edits (vocab/sentences/grammar/conjugations/edits/title/icon/correctStory)
- `DELETE /api/lessons/delete?topic=...`
- `GET /api/info` — backend status, `canGenerate` flag
- `GET/POST /api/flags` — flag management
- `POST /api/storylines` — save storyline
- `POST /api/storyline-title` / `POST /api/storyline-summary`

### Removed endpoints (v31)
- `/api/repair`, `/api/repair-all`, `/api/repair-story` — LLM repair removed

### Startup routines (server.js)
1. `fixNullLessonIds()` — assigns `ls_` ids to any null-id lessons
2. `cleanOrphanedFlags()` — removes flags whose topic or content no longer exists
3. `topicSlug()` — trims and collapses whitespace before slugifying

---

## Lesson-Set Screen Header Structure

Two stacked `sl-screen-hdr` blocks:

**1. Storyline context** (`#ls-storyline-hdr`) — always shown
- `←` back to landing · storyline icon · storyline title (clickable → storyline screen) · `🔗`
- 5px green progress bar + `done/total` text
- Auto-detected from `APP.storylines` matching `APP.lessonData.topic`
- Falls back to `🏠 ← Lessons` if no storyline found

**2. Lesson set** (`#ls-hdr`)
- `📚` emoji · topic title · `✏️` (live only) · `✨` (live only) · `🔗`
- Edit row (hidden until ✏️): icon picker + title input + Save/✕
- Chapter nav strip (`#home-hdr-storyline`) — prev/next chapter links
- 5px blue progress bar + `done/total · %` text

**Storyline screen header** (`sl-screen-hdr`) — same style
- `←` → landing · storyline title · `✏️ ✨ 📝` (live only) · `🔗 🗑️`
- 5px green progress bar + text

---

## Lesson Editor (📋 button on each lesson node)

- Button shows on each lesson node (live mode only, requires `L.id`)
- Green `✓` on button if `L._checked` or any item has `_manualEdits?.length`
- `openLessonEditor(lessonIdx)` — opens inline below lesson path
- `closeLessonEditor()` — sets `_checked` timestamp, refreshes buildPath
- `renderLessonEditor(flaggedOnly, focusLessonIdx)` — type-specific editors:
  - **Vocab/sentences**: Target + Source fields, `data-orig` for change detection
  - **Grammar**: Target + Source + Article + Gender + Plural
  - **Conjugation**: Infinitive + Source + Tense + 2-col pronoun→form grid
  - **Error Hunt**: Corrupted/Correct tabs, editable story, edits list
- `saveLessonEdits(li)` — marks changed items with `_manualEdits` timestamps, saves via `/api/lessons/edit`, clears all flags for topic
- `deleteLessonNode(li)` — confirm + splice + save
- `deleteEditorItem(li, type, idx)` — splice item + re-render
- Editor is full viewport width (breaks out of `ls-inner` 520px constraint)

### Error Hunt Editor specifics
- **❌ Corrupted tab**: story with errors highlighted yellow+strikethrough (`e.replace` = wrong text)
- **✅ Correct tab**: plain editable text (light green bg), reconstructed from `topic.story` or `ls.corruptedStory + edits`
- **🔍 Find errors**: LCS diff with bridge-merging for multi-word phrases; skips known error pairs; updates edits list in place without re-rendering
- **💾 Save**: saves text only, closes editor (does NOT diff)
- `escAttr()` used for title attributes to prevent HTML injection
- Text read via temp div to strip `<mark>` tags before saving
- **Deferred**: phrase-level diff still imperfect in some edge cases

---

## Conjugation Display Fix

`stripPronoun(pronoun, form)` strips redundant pronoun prefix at exercise render time:
- `"ich lache"` → `"lache"` (pronoun already shown in question)
- Handles compound pronouns: `"er/sie/es"` prefix stripped
- Existing lessons.json unchanged — fix applied at runtime

Conjugation prompt updated: `"form" MUST be ONLY the conjugated verb form — do NOT include the pronoun`.

---

## Story Editor (inline, live mode only)

- ✏️ button in story section header makes `#story-body` directly `contenteditable`
- Blue outline + toolbar appears below: `💾 Save · ✕ Cancel · status`
- `saveStoryEdit()` → `POST /api/save-story` → re-renders with vocab highlights
- Editing story for error_hunt lessons sets `ls._storyEdits` timestamp and clears `ls._checked`

---

## LLM Lesson Generation (server.js)

### Prompt functions
- `sysLesson(lang, srcLang, ...)` — standard vocab+sentences lesson
  - Has concrete examples: `{"target":"laufen","source":"correre"}`
  - CRITICAL rules: source = translation not synonym
  - userMsg: explicit `Target language: X. Source language: Y.` + REMINDER after story
- `sysLessonFromText(lang, srcLang, ...)` — extract from story + translation
- `sysGrammar(lang, srcLang, ...)` — noun gender/article/plural
- `sysConjugation(lang, srcLang, ...)` — verb conjugation tables
  - Rule: form must NOT include pronoun
- `sysLessonTable(lang, srcLang, ...)` — markdown table format (Ollama)

### Add-lesson from existing story
- `styleHint: null` (story already in userMsg, avoid duplication)
- `storyLang` passed via `opts` to `generateOneLesson`
- Story labeled in userMsg: `"Context story (for themes/vocabulary inspiration ONLY — ignore what language it is written in)"`

### Validation (generateOneLesson)
- Retries up to 3× on: too few vocab/sentences, identical source/target fields, too-short sentences

---

## Static Build (build-static.js)

- `node build-static.js` → regenerates `docs/index.html`
- AI warning overlay replaces `#gen-area`
- German tutor banner: hardcoded HTML (not via `t()`)
- `#sl=` deep link routing in static `init()`

---

## Pending / Known Issues

1. **Error hunt phrase diff** — LCS bridge-merging works for common cases but can still split multi-word phrases involving longer bridging tokens (>3 chars, >2 tokens). No fix scheduled.

2. **One storyline per lesson set enforcement** — discussed, not implemented. `APP._slScreen` is used as a hint but topics can technically belong to multiple storylines.

3. **Static docs rebuild** — must run `node build-static.js` manually after deploying new `index.html` to update `docs/index.html`.

4. **`topic.srcLang` is null** on all existing topics — defaults to `'en'` correctly everywhere, but could be backfilled.

---

## Key Architecture Notes

- `APP._slScreen = { chainId, encodedChain, topics }` — set by all navigation paths to storyline screen; used by lesson-set header to auto-detect parent storyline
- `APP.info.canGenerate` — controls visibility of all live-only UI (edit buttons, generate buttons, etc.)
- `topicSlug(s)` — `s.trim().replace(/\s+/g,'_').slice(0,30)` — used for flag keys
- Flag keys: `"topicId:exerciseType:contentSlug"` or `"topicSlug:exerciseType:contentSlug"`
- `escHtml(s)` — escapes `& < >` for HTML content
- `escAttr(s)` — escapes `& < > " '` for HTML attribute values
- `escRe(s)` — escapes regex special characters
- `stripPronoun(pronoun, form)` — strips pronoun prefix from conjugation forms
