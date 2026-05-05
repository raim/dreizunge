# Dreizunge — Project Status

## What it is
A Duolingo-style language learning app. Node.js server (`server.js`) + single-page
frontend (`index.html`) + static site builder (`build-static.js`).

**Run:** `OLLAMA_MODEL=qwen2.5:7b node server.js` or `ANTHROPIC_API_KEY=sk-... node server.js`

Supported languages: Italian, French, German, Spanish, Portuguese, Dutch, Polish,
Swedish, Japanese, Mandarin, Arabic, Russian, Korean, Turkish, Hindi, Lëtzebuergesch.

---

## Uploaded file state: v14 (fully patched — start coding directly)

Read every file before touching it. Syntax-check after every edit group:

```bash
sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/chk.js && node --check /tmp/chk.js
node --check server.js
node build-static.js lessons.json /tmp/test && \
  sed -n '/<script>/,/<\/script>/p' /tmp/test/index.html | sed '1d;$d' | node --check /dev/stdin
```

Final deliverable of next session: `dreizunge_v15.zip`.

---

## What is working in v14

### Server (`server.js`)
- **Backends:** Anthropic Claude (`claude-sonnet-4-20250514`), Ollama, offline
- **Ollama timeout:** 720 000 ms (12 min)
- **Story always in target language** — `sysStory(lang, isContinuation, wordCount)`
- **Story prompt:** parameterised length (`wordCount`, 100–1000), no padding/repeating;
  paragraph count derived as `floor(wordCount/100)` to `floor(wordCount/100)+1`
- **`max_tokens` for story** scales with wordCount: `min(2048, ceil(wordCount*1.5)+200)`
- **Continuation:** `generate(..., continuedFrom, storyLen, jobId)` — injects prior story
- **`userTopic`** stored alongside `topic` (original user entry before meta may shorten it)
- **`SYS_META`** instructs LLM to shorten topic display title to ≤40 chars
- **`storyLen`** stored in lesson JSON
- **`continuedFrom`** stored and exposed by `/api/lessons`
- **`storyPrompt`** stored on generation and repair
- **`callAnthropicRaw`** accepts string or `[{role,content}]` array

### Server endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/info` | GET | Backend status, canGenerate |
| `/api/generate` | POST | Start generation job → `{jobId}` |
| `/api/job/:id` | GET | Poll job status/result |
| `/api/lessons` | GET | List all topics (with `continuedFrom`) sorted by `updatedAt` desc |
| `/api/lessons/load` | GET | Full lesson data for a topic |
| `/api/lessons/delete` | DELETE | Remove a topic |
| `/api/lessons/import` | POST | Merge-import a lessons JSON file (upsert by topic) |
| `/api/flags` | GET/POST | Get/set exercise and story flags |
| `/api/rate` | POST | Store user ratings |
| `/api/repair` | POST | LLM repair endpoint (exists, no UI) |
| `/api/repair-story` | POST | LLM rewrite of story (with optional `instruction`) |
| `/api/chat` | POST | Model console — proxies to active LLM with lesson context |

### Frontend — landing page
- Language selector, difficulty dropdown (1/2/3), story length slider (100–1000 words)
  — all persisted in localStorage; all three sent on generate
- **"Continue story from"** dropdown below difficulty — populated from saved list,
  sends `continuedFrom` in POST body
- **No "Try:" chips** — removed
- **No story-language checkbox** — story always in target language
- **⬆ Import** button in library header — reads a `.json` file, POSTs to
  `/api/lessons/import`, shows toast with count; session-only in static mode

### Frontend — home screen
- **"↩ continued from: X"** badge — clickable, navigates to ancestor lesson
- **"→ continued by: [topic]"** green badge row — lists all lessons branching from here,
  clickable; populated from `APP.savedList` cache (updated after each library fetch)
- **Story below Start button** (moved from above)
- **Story collapsed by default** — auto-opens when all three lessons complete
- **Vocab highlighting** in story: `<mark class="story-vocab-hl">` on words from
  completed lessons; greedy longest-first match; `renderStoryText(d)` handles it
- **Story flag row** below story body: `⚐ Flag story` + comment textarea
- **Story prompt modal** (📝 button, visible when canGenerate): shows/edits
  `storyPrompt`; "↻ Regenerate" uses `/api/repair-story` + job polling
- **Model console** (🤖): collapsible, only when canGenerate; Anthropic multi-turn,
  Ollama flattened; history cleared on topic change
- **Share button** (🔗): copies `#topic=…` URL; hidden in static (clipboard unreliable)

### Frontend — lesson flow
- **Lesson complete screen skipped** — `showComplete()` records XP + completion
  then calls `goHome()` directly
- Flag + comment on individual exercises
- Rating panel after all lessons complete

### Frontend — library
- **Storyline grouping:** DFS `buildChains()` from `continuedFrom` links;
  chains ≥2 shown as `📖 Story line · N lessons` with `↩` connectors;
  orphans below under `📚 Individual lessons`; newest-first sort
- **⬇ export button** on every lesson card AND on every storyline header
- Difficulty badge + ratings emoji on each card
- Language filter buttons (multi-language collections)

### Export / Import
- **`exportTopics(topics)`** — fetches full lesson data, merges `APP.flagged`
  into `exportedFlags`, downloads as JSON
- Export works in **static mode** too (uses `STATIC_LESSONS` directly)
- Exported file is directly re-importable via `⬆ Import`
- Format: `{ lessons: [...], exportedAt, exportedBy }` — each lesson has
  `exportedFlags: { flagKey: flagEntry }` merged in

### `showToast` / `shareLesson` placement
- Both functions are defined at line ~565, **before** `async function init()`,
  so they land in `part1` and are available in both live and static builds.
  **Do not move them back below `init()`** — the static build drops everything
  between `init()` and `buildPath()`.

### Static build (`build-static.js`)
- **No localStorage** for lesson catalogue — `STATIC_LESSONS` baked in directly
- **Flagged exercises stripped at build time** — exercises whose flag key appears
  in `lessonsData.flags` are removed from `STATIC_LESSONS` before serialisation;
  build report shows count: `Flagged: N exercises stripped`
- **Story length slider + difficulty dropdown grayed out** in static (`renderPill`
  sets `opacity: 0.4` and `disabled`; tooltip explains they have no effect)
- **Share button hidden** in static (`renderPill` sets `display:none`)
- **Import works** in static — merges into `STATIC_LESSONS` in memory (session-only)
- **Export works** in static — uses `STATIC_LESSONS` + `APP.flagged`
- Storyline grouping + difficulty/ratings display matches live version
- Temporal sort (newest-first), hash deep-linking (`#topic=…`)
- Clean `staticOverrides`: stubs for all server-dependent functions

---

## `lessons.json` shape per topic

```json
{
  "topic": "cooking",           // display title (≤40 chars, may differ from userTopic)
  "userTopic": "cooking & recipes in italy",  // original user entry
  "topicEmoji": "🍳",
  "lang": "it",
  "difficulty": 2,
  "storyLen": 300,
  "continuedFrom": "restaurant dining",   // optional
  "story": "target-language prose…",
  "storyLang": "it",
  "storyPrompt": "system + user message used to generate story",
  "generatedAt": "…", "updatedAt": "…",
  "generationStats": { "totalMs": 0, "backend": "ollama", "model": "…",
    "totalPromptTokens": 0, "totalCompletionTokens": 0 },
  "ratings": { "difficulty": 2, "fun": 3, "coherence": 2 },
  "lessons": [ { "id": 1, "title": "…", "desc": "…", "icon": "…",
    "vocab": [{ "it": "…", "en": "…", "pron": "…" }],
    "sentences": [{ "it": "…", "en": "…", "words": ["…"] }] } ]
}
```

Top-level `lessons.json` also has a `"flags"` key (separate from lessons array):
```json
{
  "lessons": [...],
  "flags": {
    "topicSlug:exerciseType:contentSlug": { "topic": "…", "type": "…", "comment": "…" },
    "topicSlug:story": { "topic": "…", "type": "story", "comment": "…" }
  }
}
```

---

## File structure

```
dreizunge/
├── server.js              — v14
├── index.html             — v14
├── build-static.js        — v14
├── lessons.json           — auto-created by server; bundled by build-static.js
├── current_status_claude.md — this file
└── docs/index.html        — run: node build-static.js
```

---

## Known minor issues

- **`APP.savedList`** is populated after `loadSavedList()` completes. If the user
  navigates directly to a lesson via URL hash before the library loads, `continuedBy`
  links may be empty on first render. Refreshing the home screen fixes it.
- **Dead `/api/repair` endpoint** still exists in server.js — functional but no UI.
  Keep for now; useful if repair UI is ever re-added (see M1 below).

---

## TODO

### Immediate / easy

**M1. Lesson-level repair**
All LLM repair removed from UI. Two future modes:
- **Manual:** Edit form per exercise — target text, translation, pronunciation, choices
- **LLM-assisted:** Per-exercise fetch using flag comment as instruction; clear flag on save

**M2. Use story-length slider + difficulty as library filters (static + live)**
Currently these controls are grayed out in static mode. Future: use them to filter
the displayed lesson list by difficulty level, or to show estimated reading time
based on `storyLen`. Relatively straightforward — add filter state to `APP`,
wire to `loadSavedList()`.

**M3. Tighten story↔lesson coherence**
After generating story, extract named entities (characters, locations) and inject
as bullet list into each lesson prompt. Regex or small LLM call.

**M4. Continuation navigation — "continued by" needs server scan**
Currently scans `APP.savedList` (summary only) for `continuedFrom` matches.
Works for items already in the cached list. Could expose a dedicated
`/api/continuations?topic=…` endpoint for more reliable lookup.

**M5. Story lineage DAG visualisation**
Client-side d3/canvas. Nodes: topic + emoji + flag. Edges: `continuedFrom`.
Button on library page. Export as Graphviz `.dot`.

**M6. Rename `"it"` field to `"tl"` (target language)**
The field `"it"` in vocab/sentences causes LLMs to default to Italian.
Full rename across server.js, index.html, lessons.json (migration script needed).
Dedicated session.

**M7. Cancel button during generation**
`AbortController` on the fetch in `doGenerate`; server detects abandoned job and
stops polling/generating. Doable but needs care — Ollama supports abort, Anthropic
requires closing the connection.

**M8. Generate lessons from pasted text**
Paste target-language text → LLM extracts vocab + generates exercises from it.
No story needed. New tab/panel in the generate form.

**M9. Extended language list**
Welsh (cy), Catalan (ca), Basque (eu), Croatian (hr), Czech (cs), Romanian (ro),
Greek (el), Vietnamese (vi), Thai (th), Bengali (bn), Swahili (sw), Esperanto (eo).

**M10. TTS improvements**
- Split utterances at sentence boundaries in `speak()`
- Voice selection UI + warning if no matching voice
- Optional Piper TTS via `/api/tts` (offline neural quality)

**M11. User-supplied API keys**
Settings modal: Anthropic, OpenAI, Groq. Keys in localStorage, forwarded in POST body.

### Major

**M12. Community features**
Phase 1: curated static library on GitHub Pages.
Phase 2: anonymous submissions (Cloudflare Worker + D1).
Phase 3: GitHub OAuth, upvoting, ranked feed.

**M13. Cross-topic vocabulary reuse**
Scan existing lessons for recurring vocab + named characters before generating.
Distil into ~200-char "shared world" summary injected into meta + story prompts.
