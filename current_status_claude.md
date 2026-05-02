# Dreizunge — Project Status

## What it is
A Duolingo-style language learning app. Node.js server (`server.js`) + single-page frontend (`index.html`) + static site builder (`build-static.js`). Supports Italian, French, German, Spanish, Portuguese, Dutch, Polish, Swedish, Japanese, Mandarin, Arabic, Russian, Korean, Turkish, Hindi, Lëtzebuergesch.

**Run:** `OLLAMA_MODEL=qwen2.5:7b node server.js` or `ANTHROPIC_API_KEY=sk-... node server.js`

---

## Current code state

The uploaded files are **v8** — all patches below are applied. Start next session directly against these files.

### Patches applied in v8 (this release)

**1. Story prompt: "Avoid repetitive structures"**
Already present in v6 `sysStory()` — no change needed.

**2. Share button** ✅
- 🔗 button in home header calls `shareLesson()` → copies `#topic=…` URL to clipboard
- `showToast()` helper + `.toast` CSS for brief "Link copied!" notification

**3. Listening+type: hide word in button** ✅
- `lBlock(it, pron, hideWord)` — third param suppresses `<div class="listen-word">` display
- `mkLType` now stores `en` field on the exercise object
- `tLType` calls `lBlock(..., true)` so only 🔊 is shown, word hidden until answered
- Correct feedback for `listen_type` reveals: `"bongiorno — good morning"`

**4. Story language checkbox** ✅
- Checkbox `#story-lang-check` replaces old `native-check`: "Generate story in [language] (experimental)"
- `sysStory(lang, inTargetLang)` handles both EN and target-language story generation
- `sysStoryNative()` removed
- `storyLang: 'en'|lang` stored in lesson data; `storyNative` field gone
- Story header shows a small language badge (`EN` or flag emoji)
- `renderStoryText`, `speakStory` simplified — single story, no EN/native toggle
- `/api/repair-story` respects existing `storyLang` when rewriting

**5. LANG_NAMES/LANGS alignment**
Already in sync in v6 — no change needed.

**6. Static build localStorage fix** ✅
- `build-static.js` no longer uses localStorage for the lesson catalogue
- `loadSavedList()` reads directly from `STATIC_LESSONS` (baked-in constant)
- `seedBuiltins` IIFE and all static localStorage helpers removed
- Hash deep-linking (`#topic=…`) added to static `init()`
- Stale `onDiffSlider`/`restoreDiffSlider`/`toggleStoryTranslation` stubs removed
- Chat console stubbed out for static mode

**7. Model console** ✅
- `🤖 Model console` collapsible panel at bottom of home screen (below Start button)
- Only visible when `canGenerate` is true (hidden in offline/static mode)
- Full conversation history sent per turn; Anthropic gets native multi-turn array, Ollama gets flattened string
- Context injection: topic, language, difficulty, story excerpt, all vocab+sentences sent as system prompt
- Chat history cleared automatically when switching to a different topic
- `POST /api/chat` endpoint on server; `callAnthropicRaw` updated to accept string or `[{role,content}]` array
- Stubbed out in static build (alert on attempt)

---

## Architecture

**Server (`server.js`):**
- Backends: Anthropic Claude, Ollama (any model), offline mode
- Endpoints: `/api/generate`, `/api/repair`, `/api/repair-story`, `/api/rate`, `/api/flags`, `/api/lessons`, `/api/lessons/load`, `/api/lessons/delete`, `/api/job/:id`, `/api/info`, `/api/chat`
- All generation via background jobs; browser polls `/api/job/:id`

**Generation flow:**
1. `POST /api/generate` → `{jobId}`
2. Background: meta → story (EN or target lang) → lesson 1 → lesson 2 → lesson 3
3. Browser polls every 2s

**LLM conventions:**
- `callAnthropicRaw(system, userMsgOrArray, maxTokens)` — accepts string or `[{role,content}]`
- `callOllamaRaw` / `callLLM` / `callLLMText` unchanged
- `/api/chat` uses multi-turn for Anthropic, flattened string for Ollama

**Difficulty (1/2/3):** dropdown, `localStorage`, POST body, `lessons.json`, badge on node 1 + library

**Story:** single story in EN or target language; collapsible on home screen with 🔊 speak + ✏️ repair; language shown as badge

**Repair:** full vocab+sentence reference in prompt; deep-clone; cumulative `repairStats`

**Storage:** `generatedAt` preserved; `updatedAt` refreshed on every write; library sorted by `updatedAt` desc

**URL routing:** `#topic=<encodeURIComponent(name)>` — shareable, deep-linkable (works in both live and static)

---

## `lessons.json` shape (per topic)

```json
{
  "topic": "cooking", "topicEmoji": "🍳", "lang": "it", "difficulty": 2,
  "story": "English or target-language prose…", "storyLang": "en",
  "generatedAt": "2026-04-29T…", "updatedAt": "2026-04-30T…",
  "generationStats": { "totalMs": 47200, "backend": "ollama", "model": "qwen2.5:7b",
    "totalPromptTokens": 2100, "totalCompletionTokens": 1505, "lessons": […] },
  "repairStats": { "repairCount": 2, "totalMs": 18400, "promptTokens": 840, "completionTokens": 620 },
  "ratings": { "difficulty": 2, "fun": 3, "coherence": 2 },
  "lessons": […]
}
```

---

## File structure

```
dreizunge/
├── server.js                  — Node.js server (v8)
├── index.html                 — Single-page frontend (v8)
├── build-static.js            — Static build (v8)
├── lessons.json               — Auto-created / bundled
├── current_status_claude.md   — This file
└── docs/index.html            — Static build output (run: node build-static.js)
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

**M4. Rename `"it"` field to `"tl"` (target language) throughout**
The JSON field `"it"` for target-language words/sentences causes LLMs to default to Italian for non-Italian languages (confirmed with Lëtzebuergesch). Rename to `"tl"` everywhere:
- `sysLesson` JSON schema in prompt
- `SYS_REPAIR` prompt schema
- `lessons.json` stored data (migration needed for old lessons)
- `deriveSentenceWords`, `mergeRepaired`, `flagKey`, `repairLesson` in server.js
- All exercise builders and renderers in index.html (`mkMcqIE`, `mkMcqEI`, `mkLMcq`, `mkLType`, `mkOrder`, `mkRead`, `check()`, etc.)
Dedicated session — careful search-and-replace throughout.

**M5. Static build: flag/comment UI → GitHub issue redirect**
In `build-static.js` staticOverrides, stub out `pushFlagToServer` and the flag button rendering so flagging is silently disabled in static mode. Longer term: redirect flag submissions to a GitHub issue URL pre-filled with the exercise content.

**M6. Store story prompt in lessons.json + UI to view/edit it**
(a) Save the exact prompt string sent to the LLM as `storyPrompt` in `lessons.json` on generation and repair. (b) Add a small "view prompt" button (📝) in the story header that opens a modal showing the stored prompt text, with an edit field and "Regenerate with this prompt" action.

**M7. Dynamic language list from running model**
On server startup (or on demand via `/api/languages`), query the LLM for languages it knows vocabulary for. Merge with hardcoded list. Show extended list in dropdown.

**M8. Extended hardcoded language list**
Add more languages to `LANGS` / `LANG_NAMES`: Welsh (cy), Catalan (ca), Basque (eu), Croatian (hr), Czech (cs), Romanian (ro), Greek (el), Vietnamese (vi), Thai (th), Bengali (bn), Swahili (sw), Esperanto (eo).

---

## TODO — Major

**M9. Cross-topic vocabulary reuse (automatic)**
Scan existing lessons for recurring vocab and named characters before generating. Distil into ~200-char "shared world" summary injected into meta and story prompts.

**M10. Browser TTS — Firefox/Linux**
`getVoices()` returns empty in Firefox on test system. `speech-dispatcher` running and socket active, but D-Bus activation not working.
- **(a)** Split utterances at sentence boundaries in `speak()`
- **(b)** Voice selection + warning UI if no language-matched voice found
- **(c)** Piper TTS via optional `/api/tts` endpoint
- **(d)** sproochmaschinn.lu — Lëtzebuergesch-specific web synthesiser

**M11. User-supplied API keys**
Settings modal: own key for Anthropic, OpenAI, Groq (free, OpenAI-compatible). Keys in `localStorage`, forwarded in POST body.

**M12. Community features**
- Phase 1: curated static library on GitHub Pages
- Phase 2: anonymous submissions (Cloudflare Worker + D1 or Supabase)
- Phase 3: GitHub OAuth, upvoting, ranked feed
