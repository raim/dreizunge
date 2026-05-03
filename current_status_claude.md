# Dreizunge — Project Status

## What it is
A Duolingo-style language learning app. Node.js server (`server.js`) + single-page
frontend (`index.html`) + static site builder (`build-static.js`).

**Run:** `OLLAMA_MODEL=qwen2.5:7b node server.js` or `ANTHROPIC_API_KEY=sk-... node server.js`

Supported languages: Italian, French, German, Spanish, Portuguese, Dutch, Polish,
Swedish, Japanese, Mandarin, Arabic, Russian, Korean, Turkish, Hindi, Lëtzebuergesch.

---

## Uploaded file state: v11 (fully patched — start coding directly)

All patches have been applied and syntax-checked. The uploaded files ARE the current
working state. Read each file before touching it; syntax-check after every edit group.

```bash
sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/chk.js && node --check /tmp/chk.js
node --check server.js
node build-static.js lessons.json /tmp/test && \
  sed -n '/<script>/,/<\/script>/p' /tmp/test/index.html | sed '1d;$d' | node --check /dev/stdin
```

---

## What is working in v11

### Generation & server
- **Backends:** Anthropic Claude (`claude-sonnet-4-20250514`), Ollama (any model), offline
- **Ollama timeout:** 720 000 ms (12 min) — doubled to handle continuation stories
- **Story always in target language** — `sysStory(lang, isContinuation)` — no EN option
- **Story prompt:** 3-4 paragraphs, under 300 words, no padding/repeating, quality over length
- **Continuation:** `generate(..., continuedFrom, jobId)` — looks up prior story via
  `findSaved(continuedFrom)`, injects as context with continuation instruction
- **`continuedFrom`** stored in `lessons.json` and exposed by `/api/lessons`
- **`callAnthropicRaw`** accepts string or `[{role,content}]` array (multi-turn)

### Frontend — landing page
- Language selector + difficulty dropdown (1/2/3), both persisted in localStorage
- **"Continue story from"** dropdown directly below difficulty — populated from saved
  lessons list; sends `continuedFrom` in POST body; preserves selection across refreshes
- **No "Try:" chips** — removed
- **No story-language checkbox** — removed

### Frontend — home screen (lesson overview)
- Topic name + emoji + language flag, **"↩ continued from: X"** badge when applicable
- **Story below Start button** (moved from above)
- **Story collapsed by default** — auto-opens when all three lessons are completed
- **Vocab highlighting** in story: words from completed lessons wrapped in
  `<mark class="story-vocab-hl">` (yellow highlight), longest-first greedy match
- 🔊 Speak button in story header
- Story repair panel (✏️) still present but gated on `canGenerate`
- **Story flag row** below story body: `⚐ Flag story` button + comment textarea
  (`toggleStoryFlag`, `saveStoryComment`, `_updateStoryFlagUI`)
- **Model console** (`🤖`) — collapsible, only shown when `canGenerate`; full
  conversation history sent; Anthropic multi-turn, Ollama flattened
- **Share button** (🔗) — copies `#topic=…` URL to clipboard with toast

### Frontend — lesson flow
- **Lesson complete screen skipped** — `showComplete()` records XP + completion then
  calls `goHome()` directly
- Flag + comment on individual exercises (unchanged)
- Rating panel after all lessons complete (unchanged)

### Frontend — library (saved lessons list)
- **Storyline grouping:** DFS chain builder (`buildChains`) reconstructs chains from
  `continuedFrom` links; chains of 2+ shown as grouped `📖 Story line · N lessons`
  cards with `↩` connectors; orphan (non-chained) lessons shown below under
  `📚 Individual lessons`
- **Temporal sort:** chains sorted by newest `updatedAt` among members; orphans
  sorted newest-first
- Difficulty badge + ratings emoji in each lesson card
- Language filter buttons (when multiple languages present)

### Static build (`build-static.js`)
- **No localStorage** for lesson catalogue — reads directly from `STATIC_LESSONS`
- Lessons sorted newest-first (`updatedAt` desc) before any processing
- Storyline grouping (same algorithm as live version, embedded in staticFunctions)
- Difficulty badge + ratings in lesson cards
- Hash deep-linking (`#topic=…`) in static `init()`
- Clean `staticOverrides`: stubs for all server-dependent functions
  (`doGenerate`, `submitRating`, `sendChat`, `toggleChat`, `clearChat`,
  `toggleStoryFlag`, `saveStoryComment`, `_updateStoryFlagUI`, `deleteSaved`,
  `regenSaved`, `regenCurrent`, `syncFlagsFromServer`, `pushFlagToServer`)

---

## Known minor issues in v11 (not worth fixing immediately)

- **Dead repair functions:** `repairLesson`, `repairFromLesson`, `repairAll` remain in
  `index.html` (from v10 upload) with no UI entry points — harmless, but should be
  cleaned up in a future session
- **`autoResizeTopic` defined twice** in `index.html` (lines ~541 and ~613) — second
  definition wins; harmless but untidy

---

## Architecture reference

### Server endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/info` | GET | Backend status, model name, canGenerate |
| `/api/generate` | POST | Start generation job → `{jobId}` |
| `/api/job/:id` | GET | Poll job status/result |
| `/api/lessons` | GET | List all topics (with `continuedFrom`) sorted by `updatedAt` desc |
| `/api/lessons/load` | GET | Load full lesson data for a topic |
| `/api/lessons/delete` | DELETE | Remove a topic |
| `/api/flags` | GET/POST | Get/set exercise + story flags |
| `/api/rate` | POST | Store user ratings |
| `/api/repair` | POST | LLM repair of flagged exercises (endpoint exists, UI removed) |
| `/api/repair-story` | POST | LLM rewrite of story |
| `/api/chat` | POST | Model console — proxies to active LLM with lesson context |

### Generation flow
1. `POST /api/generate {topic, lang, difficulty, continuedFrom}` → `{jobId}`
2. Background: meta → story (target lang, optionally continues prior story) → lesson 1 → lesson 2 → lesson 3
3. Browser polls `/api/job/:id` every 2s

### `lessons.json` shape per topic
```json
{
  "topic": "cooking",
  "topicEmoji": "🍳",
  "lang": "it",
  "difficulty": 2,
  "continuedFrom": "restaurant dining",
  "story": "target-language prose…",
  "storyLang": "it",
  "generatedAt": "2026-05-03T…",
  "updatedAt": "2026-05-03T…",
  "generationStats": {
    "totalMs": 47200, "backend": "ollama", "model": "qwen2.5:7b",
    "totalPromptTokens": 2100, "totalCompletionTokens": 1505,
    "lessons": []
  },
  "ratings": { "difficulty": 2, "fun": 3, "coherence": 2 },
  "lessons": [
    {
      "id": 1, "title": "…", "desc": "…", "icon": "…",
      "vocab": [{ "it": "…", "en": "…", "pron": "…" }],
      "sentences": [{ "it": "…", "en": "…", "words": ["…"] }]
    }
  ]
}
```

Flags are stored separately in `store.flags` (same `lessons.json` top level):
```json
{
  "lessons": [...],
  "flags": {
    "cooking:1:parola_it": { "topic": "cooking", "type": "mcq_it_en", "comment": "…" },
    "cooking:story":       { "topic": "cooking", "type": "story",     "comment": "…" }
  }
}
```

### File structure
```
dreizunge/
├── server.js              — v11
├── index.html             — v11
├── build-static.js        — v11
├── lessons.json           — auto-created / bundled into static build
├── current_status_claude.md — this file
└── docs/index.html        — generated by: node build-static.js
```

---

## TODO (future sessions)

### Minor

**M1. Lesson-level repair**
All LLM repair removed from UI. Two future modes:
- **Manual:** Edit form per exercise — target text, translation, pronunciation, choices;
  clear flag on save; no LLM call
- **LLM-assisted:** Per-exercise inline fetch using flag comment as instruction;
  single call, no job system; clear flag on save

**M2. Tighten story↔lesson coherence**
After generating story, extract key named entities (characters, locations) via regex
or small LLM call; inject as bullet list into each lesson prompt.

**M3. Continuation navigation links**
On home screen for loaded lesson:
- (a) "↩ based on: [topic]" clickable badge — loads ancestor lesson (topic already
  in `d.continuedFrom`)
- (b) "→ continued by: [topic1]…" — requires scanning all lessons; expose via
  `/api/lessons` metadata or new `/api/continuations?topic=…` endpoint

**M4. Story lineage DAG visualisation**
Client-side d3/canvas render. Nodes: topic + emoji + flag. Edges: `continuedFrom`.
Entry: button on library page. Export as Graphviz `.dot`. Possibly `/api/dag` endpoint.

**M5. Rename `"it"` field to `"tl"` (target language)**
The field `"it"` in vocab/sentences causes LLMs to default to Italian.
Full rename across server.js, index.html, lessons.json (needs migration script).
Dedicated session — careful search-and-replace.

**M6. Store story prompt + UI to view/edit**
Save exact prompt as `storyPrompt` in lessons.json on generation and repair.
📝 button in story header opens modal: view prompt, edit, "Regenerate with this prompt".

**M7. Extended language list**
Welsh (cy), Catalan (ca), Basque (eu), Croatian (hr), Czech (cs), Romanian (ro),
Greek (el), Vietnamese (vi), Thai (th), Bengali (bn), Swahili (sw), Esperanto (eo).

**M8. TTS improvements**
- Split at sentence boundaries in `speak()`
- Voice selection UI + warning if no matching voice found
- Optional Piper TTS via `/api/tts` (offline, neural quality)
- sproochmaschinn.lu for Lëtzebuergesch

**M9. User-supplied API keys**
Settings modal: Anthropic, OpenAI, Groq. Keys in localStorage, forwarded in POST body.

### Major

**M10. Community features**
- Phase 1: curated static library on GitHub Pages
- Phase 2: anonymous submissions via Cloudflare Worker + D1
- Phase 3: GitHub OAuth, upvoting, ranked feed by language/difficulty

**M11. Cross-topic vocabulary reuse**
Scan existing lessons for recurring vocab and named characters before generating.
Distil into ~200-char "shared world" summary injected into meta + story prompts.

**M12. Clean up dead repair code**
Remove `repairLesson`, `repairFromLesson`, `repairAll` functions from `index.html`
(they have no UI entry points since v10 but were carried over). Also deduplicate
the double `autoResizeTopic` definition.
