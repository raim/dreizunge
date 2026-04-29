# Dreizunge — Project Status

## What it is
A Duolingo-style language learning app. Node.js server (`server.js`) + single-page frontend (`index.html`) + static site builder (`build-static.js`). Supports Italian, French, German, Spanish, Portuguese, Dutch, Polish, Swedish, Japanese, Mandarin, Arabic, Russian, Korean, Turkish, Hindi.

**Run:** `OLLAMA_MODEL=qwen2.5:7b node server.js` or `ANTHROPIC_API_KEY=sk-... node server.js`

---

## Architecture

**Server (`server.js`):**
- Backends: Anthropic Claude, Ollama (any model), offline mode
- Auto-detects backend on startup; warms up Ollama model before serving
- All generation runs as background jobs (`/api/job/:id` polling) — browser never times out
- Job cleanup: rolling 30-min watchdog reset on each `jobStep`; 5-min window after completion
- Stores everything in `lessons.json`: lessons, flags, generation stats, repair stats, story, story translation
- Endpoints: `/api/generate`, `/api/repair`, `/api/repair-story`, `/api/translate-story`, `/api/flags`, `/api/lessons`, `/api/lessons/load`, `/api/lessons/delete`, `/api/job/:id`, `/api/info`

**Generation flow (per topic):**
1. `POST /api/generate` → returns `{jobId}` immediately
2. Background: meta call → story → lesson 1 → lesson 2 → lesson 3
3. Each lesson: one LLM call returning `{title, desc, icon, vocab[8], sentences[5]}`
4. `words[]` derived server-side from sentence text — LLM never generates `words[]`
5. Browser polls `/api/job/:id` every 2s, showing live step label

**LLM call conventions:**
- `callAnthropicRaw` / `callOllamaRaw` both return `{text, promptTokens, completionTokens}`
- `callLLM` passes this through
- `callLLMText` is a convenience wrapper returning only `text` (used where token tracking isn't needed)

**Difficulty levels (1 / 2 / 3):**
- Sent from client in the `/api/generate` POST body; clamped server-side to 1–3, defaults to 2
- Stored as `difficulty` on the lesson set in `lessons.json`
- Affects `sysLesson` prompt: sentence length target is 3–6 words (beginner), 6–10 (intermediate), 10–16 with complex grammar (advanced)
- Short-sentence validation threshold scales with difficulty
- Shown as a colour-coded badge (green/yellow/red) on lesson node 1 and in the library list
- NOTE: old lessons in `lessons.json` that predate this feature have `difficulty: undefined` — all reads must default to 2

**Story:**
- Generated after meta call, before lesson calls; plain English prose ~400 words
- First 800 chars passed as context into each lesson call via `storyHint`
- Stored as `story` in `lessons.json`; `storyTranslation` cached after first translate request
- Home screen: collapsible "Read the story" section with speak, translate toggle, and repair panel
- Story generation failure is non-fatal; generation continues without it

**Generation stats:**
- Per-call timing + token counts tracked for meta, story, and all 3 lesson calls
- Stored as `generationStats: {totalMs, backend, model, totalPromptTokens, totalCompletionTokens, lessons[...]}`
- Shown on home screen: `"Generated in 47s · model · 3,605 tokens"`

**Repair stats:**
- Cumulative across all repairs: `repairStats: {repairCount, totalMs, promptTokens, completionTokens}`
- `repairLesson` deep-clones the lesson before mutating, so a rejected repair never corrupts in-memory state
- Shown on home screen as a second line: `"3 repairs · 12s · 1,204 tokens"`

**Exercise types:** listening MCQ, listening+type, EN→TL translate, TL→EN translate, word order (with distractors), read & translate

**Flags/repair:** users flag bad exercises → stored in `lessons.json` → repair sends flagged exercises to LLM in batches of 4 → clears flags on success

---

## Frontend (`index.html`)

- Topic input is a `<textarea>` (auto-resize, Enter submits, Shift+Enter adds newline, 400 char limit)
- Difficulty slider (Beginner / Intermediate / Advanced) between topic input and Generate button; persisted to `localStorage`
- Home screen shows: story section, gen stats + repair stats, difficulty badge on first lesson node
- Library list shows difficulty badge and language flag per topic; language filter buttons appear when >1 language present
- Distractor tokens in word-order exercises are visually neutral (no yellow pre-highlight)
- `DIFF_SHORT = {1:'Beginner', 2:'Intermediate', 3:'Advanced'}` used throughout for badge labels

---

## Static build (`build-static.js`)

Generates `docs/index.html` for GitHub Pages — no server required.

- Slices `index.html` at `function buildPath(` to get `part2`; story+stats rendering and difficulty badge included automatically
- `staticOverrides` block provides stubs: `autoResizeTopic`, `onDiffSlider`, `restoreDiffSlider`, `toggleStory`, `toggleStoryRepair`, `renderStoryText`, `speakStory` all work fully; `toggleStoryTranslation` works if translation is baked in; `doRepairStory` alerts
- `init()` calls `restoreDiffSlider()` after `selectLang()`
- Run `node build-static.js` after any change to `index.html` or `lessons.json`

---

## `lessons.json` shape (per topic entry)

```json
{
  "topic": "cooking",
  "topicEmoji": "🍳",
  "lang": "it",
  "difficulty": 2,
  "story": "English prose story...",
  "storyTranslation": "Italian translation (cached)...",
  "generatedAt": "2026-04-29T...",
  "generationStats": {
    "totalMs": 47200, "backend": "ollama", "model": "qwen2.5:7b",
    "totalPromptTokens": 2100, "totalCompletionTokens": 1505,
    "lessons": [
      {"lessonNum": 1, "ms": 8400, "promptTokens": 600, "completionTokens": 480},
      {"lessonNum": 2, "ms": 9100, "promptTokens": 750, "completionTokens": 510},
      {"lessonNum": 3, "ms": 9800, "promptTokens": 750, "completionTokens": 515}
    ]
  },
  "repairStats": {"repairCount": 2, "totalMs": 18400, "promptTokens": 840, "completionTokens": 620},
  "lessons": ["..."]
}
```

---

## File structure

```
dreizunge/
├── server.js                  — Node.js server, all backends, job system
├── index.html                 — Single-page frontend, all exercise logic
├── build-static.js            — Generates docs/index.html for GitHub Pages
├── current_status_claude.md   — This file; upload at start of each session
├── lessons.json               — All saved lessons, flags, stats (auto-created)
└── docs/
    └── index.html             — Static GitHub Pages version (rebuild after changes)
```

---

## Bugs

**B1. Difficulty badge undefined on old lessons**
Lessons generated before the difficulty feature was added have `difficulty: undefined` in `lessons.json`. Wherever `d.difficulty` is read in `buildPath()` and `loadSavedList()`, it must be defaulted to `2`: `const diff = d.difficulty || 2`. The badge then shows "Intermediate" rather than blank/undefined. Also check the `diff-val` element in the generation form — it should initialise from `APP.difficulty` (which does default to 2 via `loadDifficulty()`), so the slider label should already be correct on page load. Fix is a one-liner in `buildPath` and `loadSavedList`.

**B2. In-lesson repair sometimes does not persist**
`repairFromLesson` patches exercises in the current in-memory session but the deep-clone fix in `repairLesson` may have introduced a disconnect: the clone is written back to `saved.lessons[lessonIdx]` and `upsert`-ed, but the currently running lesson in `APP.cur` still holds the old object. After repair the lesson screen should reload its exercise list from `APP.lessonData`, not from the stale `APP.cur` copy. Verify and fix the in-lesson reload path.

---

## TODO — Minor

Small, self-contained changes. Each can be done in one session.

**M1. Tighten story↔lesson coherence**
The story is already passed as an 800-char excerpt into each lesson call. Go further: after generating the story, extract key named entities (characters, locations, objects) — either with a small regex or a single fast LLM call — and include them as an explicit short list in the lesson prompt ("use these names/places from the story where natural: ..."). This makes vocab and sentence examples feel like they belong in the same world as the story, without significant extra token cost.

**M2. Seed lessons as generation context (user-selected)**
Add a multi-select UI to the generation form — a collapsible panel listing saved lessons with checkboxes. When the user ticks one or more, the server extracts key vocabulary and character names from those lessons and injects them into the meta and story prompts for the new generation ("reuse these names/themes where natural: ..."). This is user-controlled, explicit, and cheap — no extra LLM call needed since the vocab is already in `lessons.json`. On the server, `/api/generate` receives an optional `seedTopics: string[]` field in the POST body. This partially addresses the cross-topic continuity major TODO (M4) in a lightweight, immediate way.

**M3. Replace on-demand translation with native-language story at generation time**
The on-demand translate button calls the LLM for a full ~400-word translation after the fact, which is slow on Ollama and surprising to the user. Remove `/api/translate-story` and the translate button. Instead, add a checkbox in the generation form: "Also generate story in [target language]". If checked, a second story call is made during generation (right after the English story) asking the model to write the same story directly in the target language. Store as `storyNative` alongside `story`. Show both as a toggle ("English / [Language]") in the collapsible story section.

**M4. Post-completion lesson rating**
After a user finishes all three lessons for a topic, show a compact rating panel on the home screen. Three axes: **Difficulty** (too easy / just right / too hard), **Fun** (was the topic enjoyable?), **Coherence** (did the story, vocab, and sentences feel connected?). Use simple emoji buttons or 1–3 stars per axis. Store as `ratings: {difficulty, fun, coherence}` in `lessons.json`. Show a compact summary in the library list. Ratings are local-only for now; community aggregation is Major TODO M6.

---

## TODO — Major

Larger efforts, likely spanning multiple sessions each.

**M5. Browser TTS — Firefox/Linux voice quality and mid-sentence voice switching**
On Firefox with Linux system TTS (typically espeak-ng), Italian and many other languages have poor or missing voices, and punctuation within a sentence (particularly commas) causes the browser to restart the utterance with a different voice engine or pitch, creating an audible break or voice change mid-sentence.

Approaches in order of implementation complexity:
- **(a) Split on sentence boundaries before speaking** — instead of passing the full story or full sentence to `speak()`, split at `.`, `!`, `?` and queue utterances sequentially using the `onend` callback. This prevents the mid-sentence restart and gives each clause its own clean utterance. Implement in the `speak()` helper in `index.html`. This is the most impactful change with least effort.
- **(b) Voice selection and quality warning** — on `init()`, enumerate `speechSynthesis.getVoices()`, find the best available voice for the target language (prefer voices whose `lang` starts with the BCP-47 code, prefer `localService: false` network voices on Firefox if available). If no language-matched voice is found, show a visible warning banner below the lesson path ("⚠ No [Language] voice available — TTS may sound incorrect"). Log the selected voice to console.
- **(c) Server-side TTS (longer term)** — add an optional `/api/tts` endpoint that accepts text and language and returns an MP3, using a free API (Google Cloud TTS free tier: 4M chars/month for standard voices; or Microsoft Azure TTS free tier: 500k chars/month). Client falls back to browser TTS if the endpoint is not configured. This is the only reliable fix for poor Linux voice quality.

**M6. Cross-topic vocabulary reuse and character continuity (automatic)**
Before generating a new topic, automatically scan the user's existing `lessons.json` for recurring high-frequency vocabulary and named characters/locations. Distil these into a short "shared world" summary (hard cap ~200 chars to avoid token inflation) and inject it into the meta and story prompts. This goes beyond M2 (user-selected seeds) by operating automatically across all lessons, building an implicit shared universe over time. Main challenge: deciding which vocabulary is "recurring enough" to include — a simple frequency count across `vocab[].it` fields across all lessons is a good starting heuristic.

**M7. User-supplied API keys — no local model required**
Add a settings modal (gear icon) where users enter their own key for Anthropic, OpenAI (GPT-4o), Google AI Studio (Gemini 2.0 Flash, free tier), or Groq (free, OpenAI-compatible — best first target: fast and zero cost). Keys stored in `localStorage`, sent in POST body to the server, which forwards them. Makes the app usable without a local Ollama instance. Longer term, if generation moves fully browser-side (direct API calls without a server), the static GitHub Pages build becomes fully functional end-to-end. Document clearly that localStorage keys are accessible to JS.

**M8. Community features: shared lessons, voting, user accounts**
Suggested phased approach:

- **Phase 1 — Curated shared library (no accounts):** Deploy the static build to GitHub Pages with a hand-curated `lessons.json`. Anyone can browse and study. Zero infrastructure.
- **Phase 2 — Anonymous submissions:** "Submit this lesson set" button POSTs lesson data to a lightweight backend (Cloudflare Worker + D1, or Supabase edge function). Submissions go into a moderation queue. A topic content-hash prevents exact duplicates. No accounts needed.
- **Phase 3 — Accounts and voting:** GitHub OAuth (no email/password to manage; developers already have accounts). Each user gets a profile with their submissions and ratings received. Upvotes stored in a small DB (Supabase free tier). Frontend fetches a ranked community feed alongside the local library, filtered by language and difficulty.

The key architectural decision for Phase 3: keep the Node.js server (good for self-hosted/LAN/Ollama) or move to serverless (better for community scale). Both can coexist — keep `server.js` for local use, add a thin serverless layer for community features.
