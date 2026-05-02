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

**B2. In-lesson repair reload path**
After `repairFromLesson` completes, `APP.cur.exercises` holds stale objects. Current in-place patch by `it.slice(0,20)` match is fragile. Fix: after repair, rebuild exercise list via `buildExercises` for current lesson and find closest matching exercise index to resume at.

---

## TODO — Minor

**M1. Tighten story↔lesson coherence**
After generating the story, extract key named entities (characters, locations, objects) and include them as a bullet list in each lesson prompt. Either regex or a small fast LLM call.

**M2. Seed lessons as generation context (user-selected)**
Collapsible multi-select in generation form. Ticked lessons inject vocab/character names into meta/story prompts. No extra LLM call. Server receives optional `seedTopics: string[]`.

**M3. Generate story directly in target language (see patch #4 above)**
Already planned and triaged — implement as next session patch #4. The `storyLang` field tracks which language the story is in.

**M4. Rename `"it"` field to `"tl"` (target language) throughout**
The JSON field `"it"` for target-language words/sentences causes LLMs to default to Italian for non-Italian languages (confirmed with Lëtzebuergesch). Rename to `"tl"` everywhere:
- `sysLesson` JSON schema in prompt
- `SYS_REPAIR` prompt schema
- `lessons.json` stored data (migration needed for old lessons)
- `deriveSentenceWords`, `mergeRepaired`, `flagKey`, `repairLesson` in server.js
- All exercise builders and renderers in index.html (`mkMcqIE`, `mkMcqEI`, `mkLMcq`, `mkLType`, `mkOrder`, `mkRead`, `check()`, etc.)
Dedicated session — careful search-and-replace throughout.

**M5. Static build: remove flag/comment UI; future GitHub redirect**
In `build-static.js` `staticOverrides`, stub out `pushFlagToServer` and the flag button rendering so flagging is silently disabled in static mode. Longer term: redirect flag submissions to a GitHub issue URL pre-filled with the exercise content.

**M6. Store story prompt in lessons.json + UI to view/edit it**
(a) Save the exact prompt string sent to the LLM as `storyPrompt` in `lessons.json` on generation and repair. (b) Add a small "view prompt" button (📝) in the story header that opens a modal showing the stored prompt text, with an edit field and "Regenerate with this prompt" action.

**M7. Dynamic language list from running model**
On server startup (or on demand via `/api/languages`), query the LLM for languages it knows vocabulary for. Merge with hardcoded list. Show extended list in dropdown. Keep hardcoded list as fallback. Note: LLMs hallucinate, so validate responses.

**M8. Extended hardcoded language list**
Add more languages to the hardcoded `LANGS` / `LANG_NAMES`: candidates include Welsh (cy), Catalan (ca), Basque (eu), Croatian (hr), Czech (cs), Romanian (ro), Greek (el), Vietnamese (vi), Thai (th), Bengali (bn), Swahili (sw), Esperanto (eo). Add in batches after testing LLM quality per language.

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
