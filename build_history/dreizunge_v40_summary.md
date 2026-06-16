# Dreizunge v40 — Session Summary

## Working Files

| File | Lines | Purpose |
|---|---|---|
| `index.html` | ~6750 | Main app (live + static) |
| `server.js` | ~2175 | Node.js backend |
| `build-static.js` | ~707 | Static docs builder |
| `prompts.json` | ~15 keys | All LLM prompt templates (hot-reloaded) |
| `ui.json` | 243 keys | UI strings, English only for new keys |
| `lessons.json` | user-provided | All lesson/storyline data |
| `docs/index.html` | pre-built | Static deployment (GitHub Pages) |

---

## What Changed in v40 (vs v39)

### Furigana — Core Infrastructure (`index.html`)

Three new helper functions added near `escHtml`:

**`furiHtml(text)`** — converts `kanji[よみ]` bracket notation to `<ruby>/<rt>` HTML and HTML-escapes all plain text segments. Use this anywhere unescaped text goes into `innerHTML`. Pre-strips any `[...]` following non-kanji characters (defensive against model over-annotation).

**`stripFuri(text)`** — strips all `kanji[よみ]` annotations down to bare kanji. Use for TTS. Also strips non-kanji annotations. Called automatically in `_ttsChunks` so no annotation ever reaches the speech synthesiser.

**`applyFurigana(text)`** — existing function, updated to also pre-strip non-kanji annotations before converting/stripping kanji ones.

**Key rule**: `furiHtml` is for `innerHTML` contexts where the input is raw (unescaped) text. `applyFurigana` is for contexts where the input is already going into a template literal that itself becomes innerHTML without prior escaping (e.g. `tMcqIE`, `tRead`). Never use `escHtml` then `applyFurigana` — escaping first breaks the bracket regex.

### Furigana — All Render Sites Fixed (`index.html`)

Every place where Japanese text reaches the DOM or TTS now goes through the right function:

- **`lBlock`** (blue "Tap to listen" field) — `furiHtml(it)` for display; TTS via `esc(it)` passes raw to `speak()` → stripped in `_ttsChunks`
- **`tOrder` word bank tokens** — `furiHtml(w)` replaces `applyFurigana(escHtml(w))` (escaping before furigana was breaking the regex)
- **`updateSbox` placed tokens** — same fix
- **`cGrid` choice buttons** — `furiHtml(c)` so answer options show ruby
- **`check()` correct-answer feedback** — `furiHtml(ex.target||ex.correct)` and `furiHtml(ex.correct)` for wrong-answer display; all `speakOk`/`speakBad` values go through `stripFuri()`
- **Correct-button highlight after wrong answer** — compares `b.textContent.trim()` against `stripFuri(ex.correct)` since `textContent` strips HTML tags
- **`tMcqIE` question word** — `applyFurigana(ex.target)` (was already correct)
- **`tMcqEI` question word** — `furiHtml(ex.source)` (source language furigana)
- **`tOrder` question sentence** — `furiHtml(ex.source)` passed into `t()` interpolation
- **`tMcqArticle`, `tMcqPlural`, `tTypePlural`** — `furiHtml(ex.source)` for source hint line
- **`tMcqConjugation`, `tTypeConjugation`** — `furiHtml(ex.source)` for pronoun/source hint line
- **Complete screen vocab chips** — `furiHtml(v.target)` and `furiHtml(v.source)`
- **`revealBody` source part** — `furiHtml(ex.source)` (the `— source` after correct answer)
- **`renderStoryText()`** — `furiHtml(d.story)` for lesson-set screen story panel; vocab highlight regex uses `stripF()` on vocab words to match rendered text
- **`toggleSavedStory()`** — same for landing library story panels
- **`_renderChainStory()`** — same for "Read full story" on storyline screen
- **`speakStory()`** — `stripFuri(d.story)` before `speak()`
- **`speakBodyText()`** — `stripFuri()` applied to all text paths before TTS; `preText` also stripped

### Furigana — Word Order Token Re-derivation (`index.html`)

`mkOrder()` now ignores stored `s.words` for Japanese and re-derives tokens live from `s.target` using the furigana-aware regex. This fixes all existing lessons where `deriveSentenceWords` on the server had fragmented kanji+annotation groups into broken 2-character pairs (e.g. `は免`, `許証`). The stored `s.words` data in `lessons.json` is now ignored for Japanese — harmless to leave.

Token merging logic (>14 tokens → merge pairs) mirrors the server logic.

`ex.correct` is also rebuilt from the clean canonical tokens, so the answer check still works.

### Furigana — Prompts (`prompts.json`)

**Story prompt** (`story.furiganaNote`) changed from HTML `<ruby>` tags to bracket notation `漢字[よみ]` — the old instruction was causing raw `<ruby>` tags to be stored in `lessons.json` and display literally.

**Difficulty-aware annotation** — three levels for each note type:

| Key suffix | Behaviour |
|---|---|
| `1` (beginner) | Annotate EVERY kanji without exception — "learner cannot read any kanji yet" |
| `2` (intermediate) | Annotate each kanji (standard behaviour) |
| `3` (advanced) | Annotate only less common/complex kanji; skip common N4/N5 kanji |

Applies to: `vocab.cjkNote1/2/3`, `vocab.srcCjkNote1/2/3`, `vocabFromText.cjkNote1/2/3`, `vocabFromText.srcCjkNote1/2/3`, `vocabTable.cjkNote1/2/3`, `vocabTable.srcCjkNote1/2/3`, `story.furiganaNote1/2/3`.

The flat `cjkNote` / `srcCjkNote` / `furiganaNote` keys remain as fallbacks (`|| P.cjkNote`).

**Kana-only annotation prevention** — all notes now explicitly say "Only annotate kanji (CJK characters) — do NOT annotate hiragana, katakana, or punctuation." This prevents the model from producing e.g. `おげんきですか？[おげんきですか？]`.

**Source language furigana** — new `srcCjkNote1/2/3` keys instruct the model to annotate kanji in `source` fields when the translation/source language is Japanese.

**Story styles** — canonical values for `funny` and `philosophical` (use these in all future edits):
- `funny`: `"You are a comedian, tell jokes, use wordplay, absurdist situations, punchlines."`
- `philosophical`: `"Be philosophical: contemplative, questioning, discuss abstract ideas."`

### Furigana — Server (`server.js`)

`sysLesson`, `sysLessonFromText`, `sysLessonTable` — all now select the difficulty-appropriate note:
```js
if (lang === 'ja')    sys += P['cjkNote'+d]    || P.cjkNote;
if (srcLang === 'ja') sys += P['srcCjkNote'+d] || P.srcCjkNote;
```

`sysStory` — new `difficulty` parameter added; selects `furiganaNote1/2/3`. Call site in `generate()` updated to pass `difficulty`.

### TTS Regression Fix (`index.html`)

The v39 Firefox fix had removed `setTimeout` delays after `speechSynthesis.cancel()`, breaking Chrome — utterances were silently dropped because `cancel()` is asynchronous. Restored:

- **`_speakAndAdvance`** — `setTimeout(() => speechSynthesis.speak(u), 50)` restored after `cancel()`. Critical: without this the `onend` callback never fires and the lesson never advances to the next question.
- **`_doSpeak`** and **`_doSpeakLang`** — `wasSpeaking` detection restored. 50ms delay applied only when something was already playing; direct call when idle (preserves Firefox user-gesture context while protecting against cancel-race when interrupting ongoing speech).

---

## ⚠ Furigana Known Limitations

**Existing lessons without furigana**: 5 of 6 Japanese topics in the sample `lessons.json` have no furigana on vocab/sentences (the model ignored the instruction at generation time). These need regeneration — no client-side fix possible. The `words` arrays in those lessons are also broken (character-pair fragmentation from the server), but this is now harmless since `mkOrder` re-derives tokens from `s.target`.

**Japanese UI strings**: `ui.json` Japanese translations have no furigana (164 kanji-containing strings). Not worth adding — UI strings go through `textContent` not `innerHTML`, would require switching to `innerHTML` with security implications, and the kanji in UI labels are common enough for any Japanese-UI user.

**Chinese**: No pinyin annotation system exists. `CJK_LANGS` includes `zh`, the furigana checkbox already shows for `zh`, and `furiHtml` regex already matches CJK. Adding it would mean new `cjkNote` variants for `zh` in `prompts.json` and extending the `lang === 'ja'` checks in `server.js`. Deferred — pinyin accuracy from small models needs testing first.

---

## ⚠ Pitfalls for Future Claude Sessions

### 1. UI translation strings: t() in static HTML vs JS template literals
`${t('some.key')}` only works inside JavaScript backtick template literals. In static HTML it renders literally. Always use `_setText('element-id', t('key'))` in `applyUIStrings()`.

### 2. New ui.json keys: English only, no empty strings
Add only to `en` entry. Empty strings `""` in other languages look like existing translations and are skipped by the offline translation script.

### 3. updateTeacherModeBtn timing
Always call from `applyUIStrings()` (after strings load), not from `init()` directly.

### 4. DOM structure side effects
When a layout breaks after a feature addition, check parent/sibling relationships in the DOM tree, not just CSS.

### 5. `<button>` cannot contain `<div>` children
Use `<div role="button" tabindex="0">` for complex collapsible headers with nested action buttons.

### 6. `useFullChain` vs `OLLAMA_MAX_PREV_STORY`
Always verify new feature flags are actually wired, not just destructured.

### 7. build-static.js completely overrides several functions
`importLessons`, `init`, `loadSavedList` in `build-static.js` are hardcoded overrides — changes to those in `index.html` have NO effect on the static build. Always check `build-static.js` when a feature works in live but not in static.

### 8. build-static.js code injection format
Each logical line must be its own `'...',` entry. Embedded `\n` in a string literal breaks the outer JS.

### 9. furiHtml vs applyFurigana vs escHtml
- `furiHtml(text)` — raw unescaped text → safe HTML with ruby tags. Use in template literals going to `innerHTML`.
- `applyFurigana(text)` — already-safe text (will be interpolated into innerHTML without further escaping). Use in `tMcqIE`, `tRead` style functions.
- NEVER `escHtml(text)` then `applyFurigana()` — escaping brackets first breaks the regex.
- `stripFuri(text)` — for TTS only. Also called automatically in `_ttsChunks`.

### 10. speechSynthesis.cancel() is asynchronous
Always use `setTimeout(() => speak(u), 50)` after `cancel()` in `_speakAndAdvance`. In `_doSpeak`/`_doSpeakLang`, use the `wasSpeaking` pattern: 50ms delay only if something was playing, direct call if idle. Removing all delays breaks Chrome (utterances silently dropped); removing the `wasSpeaking` check and always delaying breaks Firefox user-gesture context.

### 11. speakBodyText data-lang rule
`speakBodyText(id)` without explicit langCode reads `data-lang` from the element. This is the correct pattern. Only pass explicit langCode to override (lesson exercises use target language). `APP.srcLang` must never be passed directly — it can be `'all'`.

### 12. build-static.js has its own summary rendering
Around line 490, separate from `index.html`'s `storylines_renderChain`. Always check both when modifying summary speech or story rendering behaviour.

---

## TODO (Next Session)

### Suggested priority order
1. **Topic ID migration** — critical correctness fix; topic names are mutable, IDs must be the stable reference everywhere. Full plan in Architecture Notes below.
2. **"Message to LLM" input field** — fully specced, low risk, clear UX win
3. **Translate new ui.json keys** — no code needed, just run `translate-ui.js`
4. **Template lesson export (Option C)** — additive, natural next step for batch pipeline
5. **German noun capitalisation** — one-line prompt fix
6. Everything else below deserves its own dedicated session

### 🔤 Prompt Engineering
- "Message to LLM" input field (additional instructions, high priority override) — see v39 summary for full spec
- Move topic info (sysMeta) to after story generation
- Extend vocab mode items still remaining: story-keyword positive anchors (`extractKeywords` in `generateOneLesson`), `extendNote` in system prompt

### 🔢 Math / LaTeX
- LaTeX in MCQ choices (requires replacing `cGrid` for `math_latex`)
- "LaTeX only" toggle in instruction UI

### 🌏 Japanese / CJK
- German noun capitalisation in vocab prompts
- Consider Chinese pinyin annotation (infrastructure already in place — needs model quality testing)
- Existing Japanese lessons without furigana need regeneration

### 🌍 Scale / Quality Assessment
- **`generate-lessons.js` quality pipeline**: add `assess-quality.py` (Python) that reads JSONL output, runs an LLM judge on lesson content, writes `quality` field back. Rubric to be defined.
- **Translate new ui.json keys** to all 29 languages (teacher mode, vocab mode, story lang, toasts, lesson type desc) — use `translate-ui.js` with `--exclude` to skip already-complete languages
- MULTIZUNGE: auto-generate all language pair combinations for a set of intro topics
- Phylogenetic language map UI

### 🔊 TTS
- Google Cloud TTS fallback for Firefox/Linux — see v39 summary for full spec

---

## Carry-forward Architecture Notes

### Extend Vocab Mode (items 1 & 3 still remaining)
Items 2 and 4 were done in v39. Still needed:
- Item 1: `extractKeywords` positive anchors in `generateOneLesson` for extend mode
- Item 3: `extendNote` fragment in `prompts.json` appended to system prompt

### Story DAGs — Architecture Plan
Unchanged from v39. Phase 1 (branching display) already implemented in `_renderStorylineScreen`. Phase 2+ (branch generation, merge/fusion, DAG model) still future work — see v39 summary for full plan.

### Google Cloud TTS Proxy
Unchanged from v39 — see v39 summary for full server/client plan.

### generate-lessons.js — Standalone Option (Future)

Currently requires `server.js` to be running (calls `/api/generate` over HTTP). Two approaches to make it server-independent:

**Option A — Full extraction (major refactor)**
Extract `generate()` and its ~20 dependent functions (`sysLesson`, `sysStory`, `generateOneLesson`, `generateGrammar`, `deriveSentenceWords`, store functions, `PROMPTS` loading, etc.) into a shared `generate.js` module. Both `server.js` and `generate-lessons.js` require it. Risk: the store singleton, `PROMPTS` hot-reload, and `jobStep` coupling all need careful untangling. Estimated effort: half-day. Worth doing once the codebase stabilises.

**Option B — Slim standalone pipeline (simpler)**
Write a `generate-simple.js` that implements only the minimal fixed pipeline needed for batch generation — no grammar/conjugation/error-hunt/math, no dialect, no continuation, no repair. Just: story → vocab lesson → save JSONL. Uses `llm.js` directly, reads `prompts.json` directly, writes its own output file. No store, no job system. Much less code to maintain but diverges from the server pipeline over time.

**Option C — Template lesson export/import (new idea)**
Generate a "template lesson" in one language pair via the normal server/index.html UI, then export it with a new extended format that includes the prompts and generation parameters used. A standalone script reads this template export and regenerates the same lesson in other language pairs using `llm.js` directly — no server needed. The export format would add a `_generationTemplate` field to the topic object.

**Recommendation**: Option C is the most elegant and unique to Dreizunge's architecture. Option A is the right long-term engineering choice. Option B is quick but creates maintenance debt. Pursue C first as it adds user-facing value (shareable templates), then A when the codebase is ready.

---

### ⚠ PRIORITY REFACTOR: Migrate topic references from names to IDs

**Problem:** The entire chain navigation, lesson loading, and storyline system references topics by their mutable `topic` name string rather than their stable `tp_` ID. Topic names can change (LLM renames during generation, user edits `lessons.json`). This causes: wrong cache hits, chain navigation breaks after rename, batch generation collision (multiple lang pairs share same topic name), `byTopic` maps losing entries on collision.

**Full audit of name-based references (as of v40):**

*Server (`server.js`):*
- `continuedFrom` field — stored as topic name string in every topic object. Used by `collectChainVocab()`, `_syncStorylineForTopic()`, `generate()`, the rename handler (line 1561), and `topicIdOf()`.
- `findSaved(topicName)` — 10+ call sites for chain walking. Should be `findSavedById(id)` wherever a stable reference is needed.
- `_syncStorylineForTopic(topicName, continuedFromTopic)` — walks chain by topic name. Should walk by ID.
- `/api/lessons/load?topic=` — load endpoint uses topic name. Should accept `?id=` too.
- `/api/lessons/delete?topic=` — same.
- `collectChainVocab(continuedFromTopic)` — walks by name via `t.continuedFrom`.
- `candidates = store.topics.filter(t => t.continuedFrom === cur)` — line 1378, matches by topic name string.

*Client (`index.html`):*
- `loadSaved(topic)` — takes topic name, calls `/api/lessons/load?topic=`.
- `deleteSaved(topic)` — same.
- `continueFromLesson(topic, ...)` — uses topic name.
- `continue-select` option values — topic names.
- `byTopic` maps — `Object.fromEntries(filtered.map(l => [l.topic, l]))` — collides on same name.
- `.find(l => l.topic === x)` — ~12 call sites.
- `data-topic` attributes in rendered HTML — topic names baked into onclick strings.
- `APP.lessonData.topic` used as identifier for current lesson.

**Boot-time migration edge cases:**
- If a topic has no `id`, assign `_topicId(topic.topic)` — idempotent, safe to run on every boot
- If `continuedFrom` is a string that matches a known topic name, replace with that topic's `tp_` ID
- If `continuedFrom` is a string that matches no known topic (deleted or renamed before migration), set to `null` — do not crash, log a warning
- If `continuedFrom` already looks like a `tp_` ID (starts with `'tp_'`), leave it untouched
- Write back to store after migration only if any changes were made

2. **`continuedFrom` → ID** — change `generate()` to store `continuedFrom` as `tp_` ID. Change `collectChainVocab` and `_syncStorylineForTopic` to walk by ID using `findSavedById`. Change `candidates` filter (line 1378) to match `t.continuedFromId` (or keep `continuedFrom` field name but store ID value).

3. **New endpoints** — add `/api/lessons/load?id=` and `/api/lessons/delete?id=` alongside existing name-based ones (keep name-based for backward compat temporarily).

4. **`loadSaved(id)`** — change to use ID. All `onclick="loadSaved('${enc}')"` → use `s.id`. All `continueFromLesson(topic)` → `continueFromLesson(id)`.

5. **`continue-select` values** → topic IDs not names. `continueFromLesson` sends ID to `/api/generate` as `continuedFrom`.

6. **`byTopic` → `byId`** — replace all `byTopic` maps with `byId` (already have `_byId` in loadSavedList). Update all `.find(l => l.topic === x)` to `.find(l => l.id === x)`.

7. **Rename handler** — no longer needs to update `continuedFrom` refs across all topics. Just update the single topic's `topic` field.

**Key risk:** `_topicId(topicName)` derives ID from topic name hash — so if a topic is renamed, its hash changes and it gets a new ID, breaking existing storyline chapter references. Fix: once an ID is assigned, it must never be recalculated from the name. IDs are assigned once (on first `upsert` or boot migration) and stored permanently.

**Suggested approach for the implementation session:**
- Start with the boot-time migration (safest — purely additive)
- Then fix `upsert` to assign ID on creation (already done for lang+srcLang key, not yet for ID assignment)
- Then fix `continuedFrom` storage and chain walking on the server
- Then update client endpoints and `loadSaved`
- Finally replace `byTopic` maps

Do NOT change `_topicId` hash function — existing IDs in stored data must remain valid.


**Option A — Full extraction (major refactor)**
Extract `generate()` and its ~20 dependent functions (`sysLesson`, `sysStory`, `generateOneLesson`, `generateGrammar`, `deriveSentenceWords`, store functions, `PROMPTS` loading, etc.) into a shared `generate.js` module. Both `server.js` and `generate-lessons.js` require it. Risk: the store singleton, `PROMPTS` hot-reload, and `jobStep` coupling all need careful untangling. Estimated effort: half-day. Worth doing once the codebase stabilises.

**Option B — Slim standalone pipeline (simpler)**
Write a `generate-simple.js` that implements only the minimal fixed pipeline needed for batch generation — no grammar/conjugation/error-hunt/math, no dialect, no continuation, no repair. Just: story → vocab lesson → save JSONL. Uses `llm.js` directly, reads `prompts.json` directly, writes its own output file. No store, no job system. Much less code to maintain but diverges from the server pipeline over time.

**Option C — Template lesson export/import (new idea)**
Generate a "template lesson" in one language pair via the normal server/index.html UI, then export it with a new extended format that includes the prompts and generation parameters used. A standalone script reads this template export and regenerates the same lesson in other language pairs using `llm.js` directly — no server needed. The export format would add a `_generationTemplate` field to the topic object:
```json
{
  "topic": "Greetings and Introductions",
  "lang": "de", "srcLang": "en",
  "_generationTemplate": {
    "userTopic": "greetings and introductions",
    "difficulty": 1,
    "storyLen": 200,
    "storyStyle": "neutral",
    "lessonFormat": "standard",
    "prompts": { ... }   // snapshot of the prompts.json keys used
  },
  "lessons": [ ... ]
}
```
The standalone script strips `lang`/`srcLang`/`topic`, re-runs generation for each target pair, and produces an importable file. Advantages: reproducible (same prompts snapshot), server-independent, and the template can be shared — others can regenerate it in their language without needing the original setup. Requires: a new export option in `index.html`/`server.js` that bundles the `_generationTemplate` field, and a `generate-from-template.js` script.

**Recommendation**: Option C is the most elegant and unique to Dreizunge's architecture. Option A is the right long-term engineering choice. Option B is quick but creates maintenance debt. Pursue C first as it adds user-facing value (shareable templates), then A when the codebase is ready.

