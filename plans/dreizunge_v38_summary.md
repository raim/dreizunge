# Dreizunge v38 — Session Summary

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~6500 | Main app (live + static) |
| `server.js` | ~2124 | Node.js backend |
| `build-static.js` | ~707 | Static docs builder |
| `prompts.json` | 15 keys | All LLM prompt templates (hot-reloaded) |
| `ui.json` | 213 keys × 29 langs | UI string translations |
| `lessons.json` | 118 topics, 50 storylines | All lesson/storyline data |

Latest release: `dreizunge_v38.zip` / `dreizunge_v39.zip` (identical content)

---

## ⚠ Features Requiring Testing (v38/v39)

All features from v37 plus:

- **Math LLM backend** — instruction field in add-lesson panel; topic field used as instruction in main form
- **`math_latex` exercise type** — KaTeX rendering, MCQ answer
- **Operation selector in math editor** — +, −, ×, ÷, ^ checkboxes
- **Math exercises no longer shuffled** — order preserved from generation
- **Story locking** — lessons locked in sequence (live and static); stories locked until all lessons done
- **"Story unlocked!" card** on complete screen with 🔊 speaker button
- **Teacher mode** (static only) — 🔓 button at bottom of landing unlocks all stories/chapters
- **Chapter locking in storyline screen** — previous chapter must be complete (static/teacher-mode-off)
- **Chapter reordering** — ↑/↓ buttons on each chapter in storyline screen (live mode)
- **Lesson reordering** — ↑/↓ buttons on each lesson node in lesson set screen (live mode)
- **↑/↓ in lesson editor** — reorder vocab, sentence, grammar entries
- **Complete screen nav buttons** — permanent 📚 lesson-set and 📖 storyline buttons always shown
- **Localized language names** in exercise questions
- **vocabMode** three-way selector (🔁 reinforce / ○ neutral / ➕ extend)
- **User story in continuation** — previous chapter prepended as context when userStory + continuedFrom
- **Story styles moved to `prompts.json`**

---

## What Changed in v38

### prompts.json

Two new keys added:
- **`storyStyles`** — the 14 writing style descriptions moved from `STORY_STYLES` const in server.js. `getStoryStyle(key)` reads from `PROMPTS.storyStyles`. Hot-reloaded like all other prompts.
- **`math`** — LLM math exercise generator prompt. Describes all three exercise types (`math_calc`, `math_order`, `math_latex`) and instructs the model to mix them appropriately. `{instruction}` placeholder carries the user's free-form request.

### server.js (~2124 lines)

- **`STORY_STYLES` const removed** — replaced by `getStoryStyle(key)` reading from `PROMPTS.storyStyles`
- **`generateMathLLM(lang, srcLang, difficulty, instruction, jobId)`** — new function; sends instruction to `callLLMLesson`, validates exercise types, ensures `correct` is in `choices`, shuffles choices (model always puts correct first), retries up to 3 times
- **`mathInstruction`** wired through: `/api/generate` body → `userOpts` → `generate()` → dispatched to `generateMathLLM` when non-null
- **`mathInstruction`** in add-lesson endpoint — `generateMath` vs `generateMathLLM` dispatch
- **`mathOps`** param added to `generateMath()` — stored on lesson, passed through add-lesson endpoint
- **`^` (exponentiation)** in `generateMath` — base capped at 20, exponent at 4
- **`chapters` patch** in `POST /api/storylines` — allows reordering chapters via API
- **`moveLessonNode`** saves via `POST /api/lessons/edit` (same as delete)

### index.html (~6500 lines)

#### Math

- **`math_latex` exercise type** — `tMathLatex(ex)` renders KaTeX expression + plain question + MCQ choices. `_loadKatex(cb)` lazy-loads KaTeX 0.16.9 + stylesheet from cdnjs on first `math_latex` exercise
- **`math_latex` wired** into `buildExercises` dispatch, `check()`, `speakOk`/`speakBad`/`revealBody` ternaries
- **Math instruction UI** — text input `sial-math-instr-{sid}` appears in add-lesson panel when math format selected; `onFormatSelect` and format change listener show/hide it; main form uses topic field directly
- **Operation checkboxes** in math editor: +, −, ×, ÷, ^ — stored as `ls.mathOps`, read by `mathRegenerateExercises` and `saveLessonEdits`
- **`generateMathExercisesClient`** accepts `customOps` param and handles `^`
- **`buildMathExercises`** no longer shuffles — exercises keep generation order

#### Story locking & teacher mode

- **Lesson locking** — `isLocked = i>0 && !done[d.lessons[i-1].id] && !APP._teacherMode` (was static-only; now applies in live mode too)
- **Chapter locking** in `_renderStorylineScreen` — `_isChapterLocked` checks previous chapter completion; locked chapters shown at 45% opacity with 🔒 overlay and `pointer-events:none`; bypassed by `APP._teacherMode`
- **"Story unlocked!" card** (`#comp-story-unlocked`) on complete screen — shows when all lessons done (static) or always (live); 🔊 reads story via `speakBodyText`
- **Teacher mode** — `#teacher-mode-bar` with `🔓 Teacher mode` button; hidden by default, shown in static via `build-static.js`; `toggleTeacherMode()` sets `APP._teacherMode`, re-renders current screen
- **`build-static.js`** — shows teacher mode bar, initialises `APP._teacherMode = false`

#### Reordering

- **`moveLessonNode(i, dir)`** — swaps lessons in `APP.lessonData.lessons`, saves via `POST /api/lessons/edit`, calls `buildPath()`; ↑/↓ buttons on each lesson node (live only, disabled at boundaries)
- **`moveChapter(slId, i, dir)`** — swaps entries in `sl.chapters`, POSTs updated array to `POST /api/storylines`, re-renders storyline screen; ↑/↓ buttons above each chapter card (live only)
- **`moveEditorItem(li, type, idx, dir)`** — swaps items in vocab/sentence/grammar arrays, re-renders editor; ↑/↓ buttons on each editor entry alongside 🗑

#### Complete screen

- **`#comp-nav-btns`** — permanent secondary nav row always shown below `comp-next`; `📚 <topic>` always present; `📖 <sl.title>` shown when lesson belongs to a storyline; uses actual storyline title

#### Language names

- **`localizedLessonLangName(langCode)`** — looks up `LANGS[code].names[uiLang]`, falls back to English name; applied to `tMcqEI`, `tLMcq`, `tLType`, `tRead` so questions show e.g. "Italienisch" not "Italian" in German UI

#### vocabMode / user story continuation (from v37, included in v38 base)

- **`vocabMode`** three-way select replacing `reinforcePrior` checkbox everywhere
- **Combined story context** — when `userStory` + `continuedFrom` both set, previous chapter's story prepended as `"Previous chapter:\n{story}\n\n---\n\nCurrent chapter:\n{userStory}"`
- **`contFrom` vs `contFromForStory`** split — storyline tracking vs LLM context are now separate

---

## Architecture Notes

### Math LLM flow
```
Main form: topic field → mathInstruction (when format=math)
Add-lesson panel: sial-math-instr-{sid} input → mathInstruction

/api/generate: mathInstruction → userOpts
generate(): mathInstruction → dispatch to generateMathLLM() or generateMath()
generateMathLLM(): callLLMLesson → parse → validate types → shuffle choices → return
```

### Locking hierarchy (static, teacher-mode-off)
```
Landing: tag filter defaults to 'manually curated'
Storyline screen: chapters locked if previous chapter not 100% complete
Lesson set screen: lessons locked if previous lesson not done
Complete screen: story-unlocked card shown only when all lessons done
```

### Teacher mode
```
build-static.js init: APP._teacherMode = false; show #teacher-mode-bar
toggleTeacherMode(): APP._teacherMode = !; rebuild screens
Effects: isLocked ignores, _isChapterLocked ignores, comp-story-unlocked always shows
```

### KaTeX loading
```
First math_latex exercise rendered → _loadKatex(cb) called
→ lazy-load katex.min.css + katex.min.js from cdnjs
→ katex.render(ex.latex, el, {displayMode:true})
→ subsequent calls fire immediately via _katexLoaded flag
```

---

## prompts.json Keys (15 total)

| Key | Purpose |
|---|---|
| `vocab` | Standard vocab lesson (sysLesson) |
| `vocabFromText` | Vocab extracted from user story + translation |
| `vocabTable` | Markdown table format vocab lesson |
| `grammar` | Noun gender/article/plural lesson |
| `conjugation` | Verb conjugation lesson |
| `errorHunt` | Corrupted story generation |
| `translation` | Story translation |
| `meta` | Topic title/emoji generation |
| `metaTranslation` | Topic title translation |
| `story` | Story generation |
| `storylineTitle` | Storyline series title |
| `storylineSummary` | Storyline summary |
| `srcRepair` | Exercise repair (fix/deep-clean) |
| `storyStyles` | Writing style descriptions (14 styles) |
| `math` | LLM math exercise generation |

---

## Known Issues / Deferred

- **`math_latex` choices** — plain text only; answers must be values/names, not formulas. Rendering LaTeX in choice buttons requires a different UI component.
- **`math_latex` instruction** — model reliably produces LaTeX only when explicitly told "use only math_latex type". A dedicated "LaTeX mode" toggle would help.
- **Static docs** must be rebuilt manually after `index.html` changes
- **"All languages" filter button** broken in live `index.html`
- **`setGenStatus` null error** — intermittent
- **Grammar/conjugation source-language bleed** — improved but not eliminated

---

## TODO

### 🔢 Math
- **LaTeX in choices** — render KaTeX in MCQ choice buttons (requires replacing `cGrid` for math_latex)
- **"LaTeX only" mode** — toggle in instruction UI to force all exercises to `math_latex` type
- **Math instruction in main form** — consider a dedicated visible field (currently uses topic, which gets renamed by meta)
- **Story-number extraction** — option to seed number pool from story content

### 📝 Lessons
- **Vocab prompt** — German noun capitalisation, ground forms
- **Conjugation** — Danish/German bleed
- **Furigana** for Japanese source language
- **Typing lessons** — remove word suggestions

### 🏗️ Lesson Types
- **ai_error_hunt desc** — 28 languages still English fallback
- **Error hunt from full chain** — generate from all prior chapters

### 🌍 Language
- **Static filter** — filter source languages by existing lessons
- **Number words** — show target-language number words below math operands

### 🗺️ Major
- **Phylogenetic language map**
- **MULTIZUNGE** — auto-generate all language pairs
- **Quality scan** — auto-generate same topic in all language pairs using `prompts.json` externally
