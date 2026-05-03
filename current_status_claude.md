# Dreizunge — Project Status

## What it is
A Duolingo-style language learning app. Node.js server (`server.js`) + single-page frontend (`index.html`) + static site builder (`build-static.js`). Supports Italian, French, German, Spanish, Portuguese, Dutch, Polish, Swedish, Japanese, Mandarin, Arabic, Russian, Korean, Turkish, Hindi, Lëtzebuergesch.

**Run:** `OLLAMA_MODEL=qwen2.5:7b node server.js` or `ANTHROPIC_API_KEY=sk-... node server.js`

---

## Current code state

The uploaded files (`server.js`, `index.html`) are **v6 originals** — the last fully delivered and tested zip was `dreizunge_v6.zip`. The patches below were planned and triaged in the last session but NOT yet applied to the uploaded files. The next session should start by applying all patches from scratch against the uploaded originals.

### Patches applied in v6 (already in uploaded files)
- Job timeout fix (rolling 30-min watchdog)
- `saveStore` EACCES hint
- `callAnthropicRaw`/`callOllamaRaw` return `{text, promptTokens, completionTokens}`
- `callLLM` async + `callLLMText` wrapper
- `sysLesson`: difficulty-aware sentence length + language enforcement
- `repairLesson`: deep-clone, vocab+sentence reference context in repair prompt, `repairStats`
- `upsert`: preserves `generatedAt`, adds `updatedAt`
- `/api/lessons`: sorts by `updatedAt` desc, exposes `difficulty` + `ratings`
- `/api/generate`: accepts `difficulty`
- `/api/repair-story` + `/api/rate` endpoints
- `sysStory` prompt + story generation in `generate()`
- Story section on home screen (collapsible, speak, repair panel)
- Gen stats + repair stats on home screen
- Difficulty dropdown (replacing slider)
- Difficulty badge on lesson node 1 and in library list
- Library language filter buttons
- `loadSaved` sets URL hash; `init()` reads hash for deep linking
- `goHome` wraps `buildPath` in try-catch
- "All done" → `goLandingClean()` (goes to topics list, clears hash)
- Rating panel after all lessons complete; `/api/rate` stores ratings
- Lëtzebuergesch (`lb`) in `LANGS` and lang select in `index.html`
- `lb: 'Lëtzebuergesch'` in `LANG_NAMES` in `server.js`
- Distractor tokens visually neutral (no yellow)
- Topic `<textarea>` with auto-resize

### Patches NOT YET applied (planned in last session, implement next)

**1. Story prompt: "Avoid repetitive structures"** (trivial)
In `sysStory()` in `server.js`, append to the return string:
`"Avoid repetitive sentence structures — vary the rhythm and length of paragraphs."`

**2. Share button** (small, frontend only)
Add a 🔗 button in the home screen header (next to the regen button). On click:
```js
const url = location.origin + location.pathname + '#topic=' + encodeURIComponent(APP.lessonData.topic);
navigator.clipboard.writeText(url).then(() => showToast('Link copied!'));
```
Use `encodeURIComponent` (standard, handles spaces as `%20`). Add a small `.toast` CSS class for the brief "Link copied!" notification.

**3. Listening+type: hide word in button** (small, frontend only)
In `mkLType` (exercise builder) and `tLType` (renderer) in `index.html`:
- The "Tap to listen" button currently shows the target word as its label — remove the word, show only `"🔊 Tap to listen"` 
- In the result reveal (correct/wrong feedback), show both target word and English meaning:
  `"✓ ${ex.word} — ${ex.wordEn}"`
Check that `ex.wordEn` is populated in `mkLType`; if not, add it from `v.en`.

**4. Story language checkbox** (small, server + frontend)
Add a checkbox above the Generate button: `"Generate story in [language] (experimental)"`.
- Sends `storyInTargetLang: bool` in the POST body
- `sysStory(lang, inTargetLang)` switches between:
  - `"Write a short, engaging story in English..."` (current, default)
  - `"Write a short, engaging story in ${L}..."` (when checked)
- Store which language the story was written in as `storyLang: 'en'|lang` in `lessons.json`
- This replaces the previously removed `generateNative` checkbox

**5. `LANG_NAMES` / `LANGS` alignment** (trivial, server)
`LANG_NAMES` in `server.js` already has `lb: 'Lëtzebuergesch'` from v6 patches.
Verify it matches `LANGS` in `index.html` for all 16 languages. If not, sync them.

---

## Architecture

**Server (`server.js`):**
- Backends: Anthropic Claude, Ollama (any model), offline mode
- Endpoints: `/api/generate`, `/api/repair`, `/api/repair-story`, `/api/rate`, `/api/flags`, `/api/lessons`, `/api/lessons/load`, `/api/lessons/delete`, `/api/job/:id`, `/api/info`
- All generation via background jobs; browser polls `/api/job/:id`

**Generation flow:**
1. `POST /api/generate` → `{jobId}`
2. Background: meta → story (EN or target lang) → lesson 1 → lesson 2 → lesson 3
3. Browser polls every 2s

**LLM conventions:**
- `callAnthropicRaw`/`callOllamaRaw` → `{text, promptTokens, completionTokens}`
- `callLLM` passes through; `callLLMText` returns only `text`

**Difficulty (1/2/3):** dropdown, `localStorage`, POST body, `lessons.json`, badge on node 1 + library

**Story:** English ~400 words; collapsible on home screen with 🔊 speak + ✏️ repair

**Repair:** full vocab+sentence reference in prompt; deep-clone; cumulative `repairStats`

**Storage:** `generatedAt` preserved; `updatedAt` refreshed on every write; library sorted by `updatedAt` desc

**URL routing:** `#topic=<encodeURIComponent(name)>` — shareable, deep-linkable

---

## `lessons.json` shape (per topic)

```json
{
  "topic": "cooking", "topicEmoji": "🍳", "lang": "it", "difficulty": 2,
  "story": "English prose...", "storyLang": "en",
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
├── server.js                  — Node.js server (v6)
├── index.html                 — Single-page frontend (v6)
├── build-static.js            — Static build (significantly stale — see TODO)
├── current_status_claude.md   — This file
├── lessons.json               — Auto-created
└── docs/index.html            — Static build output (stale)
```

---

## Bugs

*(none current)*

---

## TODO — Minor

**M1. Lesson-level repair** *(formerly B2 + repair feature)*
All LLM-based repair has been removed. Flagging and commenting are kept. Future repair should work at the individual exercise level, with two possible modes:
- **Manual repair:** Allow the user to directly edit the target-language text, English translation, pronunciation, and choices for any exercise via an edit form on the lesson node or in-lesson screen
- **LLM-assisted repair:** Re-introduce a targeted per-exercise LLM call that rewrites only the flagged item, using the flag comment as instruction. Keep it simple — no batch processing, no job system — just a single inline fetch per exercise
In both cases, flag is cleared on save.

**M2. Tighten story↔lesson coherence**
After generating the story, extract key named entities (characters, locations, objects) and include them as a bullet list in each lesson prompt. Either regex or a small fast LLM call.

**M3. Seed lessons as generation context (user-selected)**
Collapsible multi-select in generation form. Ticked lessons inject vocab/character names into meta/story prompts. No extra LLM call. Server receives optional `seedTopics: string[]`.

**M4. Continuation navigation links**
In the home screen for a loaded lesson, show:
- (a) A "↩ based on: [topic]" link — clicking loads that ancestor lesson directly
- (b) A "→ continued by: [topic1]…" section listing all lessons with `continuedFrom === this.topic`

**M5. Story lineage DAG visualisation**
Client-side render using d3 or plain canvas, fetching lesson list from `/api/lessons`. Nodes: topic + emoji + flag. Edges: `continuedFrom` links. Entry point: button on library page. Also: export as Graphviz `.dot`.

**M6. Rename `"it"` field to `"tl"` (target language) throughout**
The JSON field `"it"` causes LLMs to default to Italian for non-Italian languages. Rename to `"tl"` everywhere — dedicated session, careful search-and-replace in server.js, index.html, lessons.json.

**M7. Store story prompt in lessons.json + UI to view/edit it**
Save exact prompt as `storyPrompt` in lessons.json. Add 📝 button in story header opening a modal with the prompt and "Regenerate with this prompt" action.

**M8. Dynamic language list from running model**
On server startup or on demand via `/api/languages`, query the LLM for languages it knows vocabulary for. Merge with hardcoded list.

**M9. Extended hardcoded language list**
Add Welsh (cy), Catalan (ca), Basque (eu), Croatian (hr), Czech (cs), Romanian (ro), Greek (el), Vietnamese (vi), Thai (th), Bengali (bn), Swahili (sw), Esperanto (eo).

---

## TODO — Major

**M9. Cross-topic vocabulary reuse (automatic)**
Scan existing lessons for recurring vocab and named characters before generating. Distil into ~200-char "shared world" summary injected into meta and story prompts.

**M10. Browser TTS — Firefox/Linux**
`getVoices()` returns empty in Firefox on test system. `speech-dispatcher` running and socket active, but D-Bus activation not working.
- **(a)** Split utterances at sentence boundaries in `speak()` — prevents mid-sentence voice switching
- **(b)** Voice selection + warning UI if no language-matched voice found
- **(c)** Piper TTS via optional `/api/tts` endpoint — free, offline, neural quality, has Italian and other voices
- **(d)** sproochmaschinn.lu — Lëtzebuergesch-specific web synthesiser; no public API documented, may need scraping or contact with maintainers
- **(e)** Local LLM audio: some Ollama-compatible models can generate audio tokens; complex but possible for languages with no other TTS option

**M11. User-supplied API keys**
Settings modal: own key for Anthropic, OpenAI, Groq (free, OpenAI-compatible — best first target), Google AI Studio. Keys in `localStorage`, forwarded in POST body. Removes Ollama dependency.

**M12. Community features**
- Phase 1: curated static library on GitHub Pages
- Phase 2: anonymous submissions (Cloudflare Worker + D1 or Supabase)
- Phase 3: GitHub OAuth, upvoting, ranked feed by language/difficulty
