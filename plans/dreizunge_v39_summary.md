# Dreizunge v39 — Session Summary

## Overview

v39 is a stabilisation and polish release on top of v38. All generation features are the same; the changes are UI fixes, teacher mode improvements, story/lesson locking refinements, and a ui.json expansion.

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~6515 | Main app (live + static) |
| `server.js` | ~2124 | Node.js backend |
| `build-static.js` | ~707 | Static docs builder |
| `prompts.json` | 15 keys | All LLM prompt templates (hot-reloaded) |
| `ui.json` | 237 keys × 29 langs | UI string translations |
| `lessons.json` | 118 topics, 50 storylines | All lesson/storyline data |
| `docs/index.html` | pre-built | Static deployment (GitHub Pages) |

Latest release: `dreizunge_v39.zip`

---

## What Changed in v39 (vs v38)

### Story / Locking

- **Story-section close tag fixed** — `#lesson-editor` and `#lesson-actions` were inside `#story-section` (missing `</div>`), causing the lang-footer and mute button to render inside the story area
- **`story-hdr` button → div** — `<button class="story-hdr">` contained `<div>` children (invalid HTML); changed to `<div role="button" tabindex="0">` so browser no longer ejects inner elements
- **`story-arrow` ▼ removed then re-added** — stray ▼ removed; re-added inside the now-valid `<div>` header, placed left of 🔊/✏️ buttons to match other collapsible headers
- **`story-lang-lbl` (flag) removed** from story header — redundant
- **Speaker moved to header only** — `speakstory-btn` (🔊) restored to `story-hdr`; duplicate injected into story body by `renderStoryText` removed
- **"Read full story" locked** on storyline page — shows as 🔒 at 50% opacity until all chapters complete (static/teacher-mode-off); always accessible in live mode and teacher mode

### Teacher Mode

- **Shown in live mode** — `#teacher-mode-bar` now displayed after `/api/info` fetch; `APP._teacherMode = true` by default in live (everything unlocked)
- **`updateTeacherModeBtn()` helper** extracted — keeps button label/colour in sync in both modes
- **Static**: `APP._teacherMode = false`, bar shown via `build-static.js`; toggle to unlock
- **Live**: `APP._teacherMode = true` by default; toggle to lock (for demos)

### Layout Fixes

- **`lang-footer` moved inside containers** — `lang-footer-lessonset` moved inside `ls-inner`; `lang-footer-storyline` moved inside `sl-screen`; both now correctly constrained to max-width and centered
- **Lang-footer selectors compact** — `flex:1` removed from `lang-select-wrap` in footers; `width:auto` added to wrapper and `<select>`; `justify-content:center` on `.lang-footer`

### Exercise Fixes

- **`type_conjugation` TTS fixed** — `speakOk`/`speakBad` now reads `ex.pronoun + ' ' + ex.correct` ("she loves") instead of just `ex.correct` ("loves"); `mcq_conjugation` was already correct

### ui.json

- **237 keys** (was 213 in v37, 237 in v39 after additions)
- **24 new English keys added**: teacher mode labels, story-unlocked card, vocab mode selector, story language selector, math instruction placeholders, toast strings, complete screen nav labels, math order labels
- **6 keys still English-only** (PDF): `pdf.extracting`, `pdf.no_text`, `pdf.encrypted`, `pdf.generate_all`, `pdf.chapters`, `pdf.words`
- New keys added in English only — awaiting translation for all 29 languages

---

## ⚠ Features Requiring Testing

### From v38 (not yet confirmed working)
1. **Math LLM backend** — LLM instruction generates valid exercises
2. **`math_latex` KaTeX rendering** — on iOS/Android browsers
3. **vocabMode extend** — avoidance list steers toward fresh vocabulary
4. **PDF storyline fix** — multi-chunk PDFs form single storyline
5. **User story continuation** — previous chapter prepended as context
6. **Chapter/lesson/editor reordering** — save + re-render without glitches
7. **Complete screen nav buttons** — storyline titles appear correctly

### From v39 (new)
8. **Teacher mode in live** — defaults to unlocked; toggle locks correctly
9. **Teacher mode in static** — toggle unlocks stories and chapters
10. **"Read full story" locking** — locked until all chapters done in static
11. **Story header layout** — ▼ 🔊 ✏️ all inside div, no stray elements
12. **Lang-footer** — centered, compact width on all screens
13. **`type_conjugation` TTS** — reads "she loves" not "loves"

---

## ui.json Status

- **237 keys** in English across 29 languages
- New keys (English only, need translation):
  - `teacher.mode_off/on/unlock_tooltip`
  - `complete.story_unlocked`
  - `gen.vocab_mode_reinforce/neutral/extend`
  - `gen.story_lang_label/target/source/other`
  - `gen.math_instr_placeholder/sial`
  - `toast.lesson_added/summary_generated/summary_saved/progress_cleared/math_need_number/exercises_regenerated/saved/lesson_deleted/export_preparing`
  - `complete.nav_lessonset/nav_storyline`
  - `ex.math_order.asc/desc`

---

## Known Issues

- **Math instruction in main form** — uses topic field, which gets renamed by `sysMeta`; the instruction is applied but the displayed topic may differ
- **`math_latex` choices** — plain text only; can't render LaTeX in MCQ choice buttons
- **Static docs** must be rebuilt manually after `index.html` changes
- **"All languages" filter** broken in live landing
- **`setGenStatus` null error** — intermittent

---

## TODO

### 🔢 Math / LaTeX
- LaTeX in MCQ choices (requires replacing `cGrid` for `math_latex` type)
- "LaTeX only" toggle in instruction UI
- Story-number extraction option

### 📝 Lessons
- German noun capitalisation in vocab prompts
- Furigana for Japanese source language
- `ai_error_hunt` desc: translate to 28 languages
- Translate 24 new ui.json keys to all 29 languages

### 🌍 Quality & Scale
- Quality scan: auto-generate same topic across all language pairs
- MULTIZUNGE: auto-generate all language pair combinations
- Phylogenetic language map UI
- Static: filter source languages by existing lessons
- Number words in target language below math operands
