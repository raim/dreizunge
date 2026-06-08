# Dreizunge v39 — Session Summary

## Overview

v39 is identical to v38 in code — it is a version-number bump only. All features, architecture, and known issues are the same as v38. Refer to `dreizunge_v38_summary.md` for full details.

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~6500 | Main app (live + static) |
| `server.js` | ~2124 | Node.js backend |
| `build-static.js` | ~707 | Static docs builder |
| `prompts.json` | 15 keys | All LLM prompt templates (hot-reloaded) |
| `ui.json` | 213 keys × 29 langs | UI string translations |
| `lessons.json` | 118 topics, 50 storylines | All lesson/storyline data |

Latest release: `dreizunge_v39.zip`

---

## What Changed Since v37

### prompts.json
- `storyStyles` — 14 writing style descriptions moved from `STORY_STYLES` const
- `math` — new LLM math exercise generator prompt (3 exercise types: `math_calc`, `math_order`, `math_latex`)

### server.js
- `STORY_STYLES` const → `getStoryStyle(key)` reading from `PROMPTS.storyStyles`
- `generateMathLLM()` — LLM-backed math lesson generator; validates, deduplicates, shuffles choices
- `mathInstruction` wired through generate pipeline and add-lesson endpoint
- `mathOps` param in `generateMath()` + `^` (exponentiation) support
- `chapters` patch in `POST /api/storylines` — enables chapter reordering
- `POST /api/lessons/edit` used by new `moveLessonNode`

### index.html
- **`math_latex` exercise type** — KaTeX lazy-loaded from CDN; displays equation + plain-text question + MCQ
- **Math operation checkboxes** (+, −, ×, ÷, ^) in math editor; stored as `ls.mathOps`
- **Math exercises no longer shuffled** — `buildMathExercises` preserves order
- **Math instruction UI** — input in add-lesson panel; topic used as instruction in main form
- **Story locking** — lessons now locked sequentially in live mode too (`!APP._teacherMode`)
- **Chapter locking** in storyline screen — previous chapter must be 100% complete (static/no teacher mode)
- **"Story unlocked!" card** on complete screen with 🔊 TTS button
- **Teacher mode** — `🔓` button (static only); unlocks all stories and chapters instantly
- **Chapter reordering** — ↑/↓ above each chapter card in storyline screen (live mode)
- **Lesson reordering** — ↑/↓ on each lesson node in lesson set screen (live mode); saves immediately
- **Editor item reordering** — ↑/↓ on vocab/sentence/grammar entries in lesson editor
- **Complete screen nav** — permanent 📚 lesson-set and 📖 storyline buttons (with actual titles)
- **Localized language names** — `localizedLessonLangName()` uses `LANGS[code].names[uiLang]`
- **vocabMode** three-way select (🔁/○/➕) replacing reinforcePrior checkbox
- **User story continuation context** — previous chapter prepended when `userStory` + `continuedFrom`
- **`contFrom` vs `contFromForStory`** split for correct PDF storyline tracking

### build-static.js
- Teacher mode bar shown (`#teacher-mode-bar`)
- `APP._teacherMode = false` initialised

---

## ⚠ Features Requiring Testing

All of the above. Priority items:

1. **Math LLM** — does the model reliably produce valid exercises from a free-form instruction?
2. **`math_latex`** — KaTeX rendering on iOS/Android browsers
3. **Story locking in live mode** — does the sequential lock feel right, or is it too restrictive?
4. **Teacher mode** — does unlocking all stories work correctly in the rebuilt static page?
5. **Chapter + lesson reordering** — do the ↑/↓ buttons save correctly and re-render without glitches?
6. **Complete screen nav buttons** — do storyline titles appear correctly?
7. **Localized language names** — correct in German UI for Italian lessons?
8. **vocabMode extend** — does the avoid-list actually steer the model toward fresh vocabulary?
9. **PDF storyline fix** — do multi-chunk PDFs now correctly form a single storyline?
10. **User story continuation** — does the previous chapter appear as context in lesson generation?

---

## ui.json Status

- **213 keys** in English
- **29 languages**
- **6 keys English-only** (awaiting translation): `pdf.extracting`, `pdf.no_text`, `pdf.encrypted`, `pdf.generate_all`, `pdf.chapters`, `pdf.words`
- `vocab-mode` UI strings (`gen.use_full_chain`, `sl.tags_placeholder`, etc.) — 6 keys from v35 still English-only

---

## Known Issues

- **`math_latex` choices** — plain text only; can't render LaTeX in MCQ buttons
- **Math instruction in main form** — uses topic field which gets renamed by `sysMeta`; the instruction is applied to generation but the displayed topic will be the AI-renamed version
- **Static docs** must be rebuilt manually
- **"All languages" filter** broken in live landing
- **`setGenStatus` null error** — intermittent
- **Grammar/conjugation source-language bleed** — improved, not eliminated

---

## TODO

### 🔢 Math / LaTeX
- LaTeX in MCQ choices (requires replacing `cGrid` for `math_latex` type)
- "LaTeX only" toggle in instruction UI
- Story-number extraction option

### 📝 Lessons
- German noun capitalisation in vocab prompts
- Furigana for Japanese source language
- Remove word suggestions from typing lessons
- `ai_error_hunt` desc: translate to 28 languages

### 🏗️ Architecture
- Quality scan: auto-generate same topic across all language pairs using `prompts.json` externally
- Phylogenetic language map UI
- MULTIZUNGE: auto-generate all language pair combinations
- Static: filter source languages by existing lessons
- Number words in target language below math operands
