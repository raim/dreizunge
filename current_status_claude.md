# Dreizunge — Project Status

## Uploaded file state: v18a (clean — start coding directly)

Read every file before touching it. Syntax-check after every edit group:

```bash
sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/chk.js && node --check /tmp/chk.js
node --check server.js
node build-static.js lessons.json /tmp/test && \
  sed -n '/<script>/,/<\/script>/p' /tmp/test/index.html | sed '1d;$d' > /tmp/schk.js && node --check /tmp/schk.js
```

Final deliverable of next session: `dreizunge_v19.zip`.

---

## What is working (v18 — fully verified)

### Changes in v18
- **`build-static.js` `itemHtml` refactored** — now wraps each card in `.saved-item-wrap`
  and appends a `.saved-item-story` collapsible panel with `toggleSavedStory()` hook.
  The `sid` generation matches `savedItemHtml()` in `index.html` exactly:
  `'si-' + t.replace(/[^a-z0-9]/gi,'').slice(0,20) + Math.abs(hash)`
- **`renderPill` verified** — both `index.html` and `build-static.js` are correct:
  live shows `Story: X · Lessons: Y` (Ollama), static shows "Static — built-in lessons only"
- **Background badge click verified** — `onGenStatusClick` correctly reads
  `APP.activeJob.topic` (set at job completion via server-confirmed `j.data.topic`);
  calls `loadSaved(encodeURIComponent(t))` when badge is green

### All v17g features carry forward
See v17g notes. Everything listed there is still working and unchanged.

---

## Known issues / TODO

### Next session priorities

**M1. Manual lesson editing**
Edit form per exercise — target text, translation, pronunciation, choices, ordered sentence.
Per-exercise fetch using flag comment as instruction; clear flag on save.

**M4. Non-LLM lesson extraction**
Pure extraction from story+translation pairs — defer, but keep as fast offline fallback.

**M7. Cancel button during generation**
`AbortController` on the fetch in `doGenerate`; server marks job as cancelled.

**M9. Extended language list**
Esperanto, Welsh, Catalan, Basque, Croatian, Czech, Romanian, Greek, Vietnamese, Thai,
Bengali, Swahili. Consider a `languages.json` as single source of truth.

**M10. TTS improvements**
- Voice selection shows available browser voices for current language
- Warning if no matching voice found (currently console-only)
- Optional Piper TTS via `/api/tts`

**M11. User-supplied API keys (re-add external API support)**
Settings modal: Anthropic, OpenAI, Groq. Keys in localStorage, forwarded in POST body.

**M12. Community features**
Phase 1: curated static library on GitHub Pages.
Phase 2: anonymous submissions (Cloudflare Worker + D1).

**M13. Dictionary/dialect loading**
Load a word table (CSV/HTML) as dialect context injected into story/lesson prompts.

### Static build split — important constraint
- **`part1`**: everything before `async function init()`
- **`part2`**: from `function buildPath()` to `init();` call
- **Dead zone**: between `init()` and `buildPath()` — functions here are DROPPED in static
  builds and must be stubbed in `staticOverrides` or moved into part2.

**Functions that MUST be in part2** (not the dead zone):
`buildPath`, `startNextLesson`, `encTopic`, `toggleSavedStory`, `toggleChainStory`,
`_renderChainStory`, `toggleStoryFlag`, `saveStoryComment`, `_updateStoryFlagUI`,
all exercise renderers, `speak`, `buildTtsSelector`, `ttsIsApproximate`, etc.
