# Dreizunge — Project Status

## What it is
A Duolingo-style language learning app. Node.js server (`server.js`) + single-page frontend (`index.html`) + static site builder (`build-static.js`). Supports Italian, French, German, Spanish, Portuguese, Dutch, Polish, Swedish, Japanese, Mandarin, Arabic, Russian, Korean, Turkish, Hindi, Lëtzebuergesch.

**Run:** `OLLAMA_MODEL=qwen2.5:7b node server.js` or `ANTHROPIC_API_KEY=sk-... node server.js`

---

## Architecture

**Server (`server.js`):**
- Backends: Anthropic Claude, Ollama (any model), offline mode
- Auto-detects backend on startup; warms up Ollama model before serving
- All generation runs as background jobs (`/api/job/:id` polling) — browser never times out
- Job cleanup: rolling 30-min watchdog on each `jobStep`; 5-min window after completion
- Stores everything in `lessons.json`: lessons, flags, generation stats, repair stats, story, storyNative, ratings
- Endpoints: `/api/generate`, `/api/repair`, `/api/repair-story`, `/api/rate`, `/api/flags`, `/api/lessons`, `/api/lessons/load`, `/api/lessons/delete`, `/api/job/:id`, `/api/info`

**Generation flow:**
1. `POST /api/generate` → `{jobId}` immediately
2. Background: meta → story (EN) → [storyNative if checkbox checked] → lesson 1 → lesson 2 → lesson 3
3. Each lesson: one LLM call returning `{title, desc, icon, vocab[8], sentences[5]}`
4. `words[]` derived server-side; LLM never generates it
5. Browser polls `/api/job/:id` every 2s

**LLM call conventions:**
- `callAnthropicRaw` / `callOllamaRaw` return `{text, promptTokens, completionTokens}`
- `callLLM` passes through; `callLLMText` returns only `text`

**Difficulty (1/2/3):**
- Dropdown in generation form; stored in `localStorage` and sent in POST body
- Stored as `difficulty` on lesson set; defaults to 2 for old lessons
- Sentence length: 3–6 words (1), 6–10 (2), 10–16 with complex grammar (3)
- Shown as colour-coded badge on lesson node 1 and in library list

**Story:**
- `story` (EN): always generated after meta call; ~400 words plain prose
- `storyNative`: optional; generated if "Also generate story in [language]" checkbox is checked — model writes fresh version directly in target language from English story as plot context (not a translation)
- Rewriting story via repair invalidates `storyNative`
- Home screen: collapsible section with EN/[flag] toggle (hidden if no native version), 🔊 speak, ✏️ repair panel

**Repair (bug fix):**
- Repair prompt now includes full lesson vocab and sentences as reference context, so the model corrects exercises using the actual lesson content rather than guessing
- `repairLesson` deep-clones lesson before mutating; writes back to `saved.lessons[idx]`
- Cumulative `repairStats: {repairCount, totalMs, promptTokens, completionTokens}` stored per topic

**Stats:**
- `generationStats` and `repairStats` both shown on home screen
- `upsert` preserves original `generatedAt`, adds/updates `updatedAt`
- `/api/lessons` sorts by `updatedAt` descending (most recently touched first)

**Ratings:**
- After all lessons complete, rating panel appears on home screen
- Three axes: Difficulty, Fun, Coherence (1–3 each)
- Stored as `ratings: {difficulty, fun, coherence}` via `/api/rate`
- Summary shown in library list

**URL routing:**
- `loadSaved` sets `location.hash = #topic=<encoded>` so the URL is shareable/bookmarkable
- On `init()`, if hash contains `topic=`, that topic is auto-loaded
- `goHome` and `goLandingClean` maintain hash state correctly

---

## Frontend (`index.html`)

- Topic: `<textarea>` (auto-resize, Enter submits, Shift+Enter newlines, 400 chars)
- Difficulty: `<select>` dropdown replacing the old slider; persisted to `localStorage`
- "Also generate story in [language]" checkbox below difficulty
- "All done" button now goes to the topics landing page (`goLandingClean`)
- Library sorted by `updatedAt` desc (server-side); lang filter + diff badge + rating summary per entry
- Distractor tokens neutral (no yellow pre-highlight)
- `DIFF_SHORT = {1:'Beginner', 2:'Intermediate', 3:'Advanced'}`
- `goHome` wraps `buildPath()` in try-catch so errors don't silently block `show('home')`
- `← Topics` button clears hash and goes to landing

---

## Static build (`build-static.js`)

Not updated for v6 changes (new story functions, rating panel, diff dropdown, hash routing). Low priority.

---

## `lessons.json` shape (per topic)

```json
{
  "topic": "cooking", "topicEmoji": "🍳", "lang": "it", "difficulty": 2,
  "story": "English prose...", "storyNative": "Italian prose...",
  "generatedAt": "2026-04-29T...", "updatedAt": "2026-04-30T...",
  "generationStats": { "totalMs": 47200, "backend": "ollama", "model": "qwen2.5:7b",
    "totalPromptTokens": 2100, "totalCompletionTokens": 1505, "lessons": [...] },
  "repairStats": { "repairCount": 2, "totalMs": 18400, "promptTokens": 840, "completionTokens": 620 },
  "ratings": { "difficulty": 2, "fun": 3, "coherence": 2 },
  "lessons": [...]
}
```

---

## File structure

```
dreizunge/
├── server.js                  — Node.js server
├── index.html                 — Single-page frontend
├── build-static.js            — Static build (needs update for v6)
├── current_status_claude.md   — This file
├── lessons.json               — Auto-created
└── docs/index.html            — Static build output (stale)
```

---

## Bugs

**B2. In-lesson repair reload path**
After `repairFromLesson` completes, `APP.lessonData` is refreshed from server but `APP.cur.exercises` still holds old exercise objects. The current code patches `curEx` in-place by matching on `it.slice(0,20)` — this is fragile if the repaired text changed significantly. A cleaner fix: after repair, rebuild the exercise list for the current lesson from scratch (re-call `buildExercises`) and find the closest matching exercise index to resume at.

---

## TODO — Minor

**M1. Tighten story↔lesson coherence**
After generating the story, extract key named entities (characters, locations, objects) and include them as an explicit bullet list in the lesson prompt. Either use a small regex on the story text or a fast LLM call. Makes vocab and sentences feel like they belong to the same world without significant token cost.

**M2. Seed lessons as generation context (user-selected)**
Collapsible multi-select panel in the generation form. Ticked lessons have their vocab and character names extracted and injected into the meta/story prompts ("reuse these names/themes where natural"). No extra LLM call — vocab already in `lessons.json`. Server receives optional `seedTopics: string[]` in POST body.

**M3. Native-language story — considerations**
Currently implemented: English story generated first, then `sysStoryNative` writes a fresh version in the target language using the English story as plot context. Adds one full LLM call. On Ollama this is slow. Consider: only offer checkbox when using Anthropic; or make it a post-generation option; or show time estimate before generation starts.

---

## TODO — Major

**M4. Cross-topic vocabulary reuse (automatic)**
Scan existing lessons for recurring vocab and named characters before generating. Distil into a ~200-char "shared world" summary injected into meta and story prompts. Complements M2 but fully automatic.

**M5. Browser TTS — Firefox/Linux**
Confirmed: `getVoices()` returns empty in Firefox on the test system. `speech-dispatcher` is running and socket is active, but D-Bus activation isn't working — Firefox likely doesn't have the D-Bus speech interface enabled in this build.

Approaches:
- **(a) Split utterances at sentence boundaries** — prevents mid-sentence voice switching. Quick win, implement in `speak()`.
- **(b) Voice selection + warning UI** — show banner if no language-matched voice found.
- **(c) Piper TTS server-side** — free, offline, neural quality. Optional `/api/tts` endpoint; client falls back to browser TTS. Proper fix.

**M6. User-supplied API keys**
Settings modal: enter own key for Anthropic, OpenAI, Groq (free, OpenAI-compatible — best first target), or Google AI Studio. Keys in `localStorage`, forwarded in POST body. Removes Ollama dependency.

**M7. Community features**
- Phase 1: curated static library on GitHub Pages
- Phase 2: anonymous submissions (Cloudflare Worker + D1 or Supabase)
- Phase 3: GitHub OAuth, upvoting, ranked feed by language/difficulty
