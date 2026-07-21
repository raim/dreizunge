# Roadmap v58

> **STATE AT HANDOFF (2026-07-20): CUT AS `v58`; suite 106 green; check-inline 0 on both builds.**
> v58 is one feature session on top of v57: **provenance fields** (the merged item 2 + "text
> provenance" spec) — structured `topic.source {author, licence, url, note}`, `topic.createdBy`
> (backfilled `'admin'` corpus-wide), the `by <user> · from: <source>` one-liner on landing rows /
> storyline screen / chapter page, and a live teacher-gated ✎ source editor. Schema write-stamp is
> now **30** (readers accept ≥29; both new fields optional).
> **i18n owed:** the pending translate pass now covers **10 en-only keys** (`storyboard.locked_resume`
> + nine `prov.*`) × 29 languages — one `translate-ui.js` run clears it.

**v57 shipped** (clickable storyboard panels — see `v57_session1_notes.md`). This file supersedes
`roadmap_v57.md` (now historical) and carries the session protocol plus every still-open item forward.

## ✅ v58 — provenance fields: sources + generating user (SHIPPED; was item 2)
Full details in `v58_session1_notes.md`. Highlights against the spec: structured source (the
free-text-in-description convention was rejected per the original analysis); `createdBy` stamped at
the ONE upsert() choke point (all creation routes flow through it) + explicit backfill
(`backfill-createdby.js`, dry-run default, idempotent) so the stored data is explicit; storylines
deliberately have NO createdBy — their line is DERIVED from chapters (stays truthful post-login);
`/api/topic-source` resolves by stable id only and stores only what `sanitizeTopicSource` (pure,
unit-tested) admits — URLs must parse http(s) or read as DOIs (linked via doi.org), else dropped;
`/api/lessons` projection ships `createdBy`/`source`/`sourceFile` (the v55_s live-vs-static lesson);
ONE formatter `provLineHtml` shared by BOTH landing renderers (build-static calls it — the v55_p
duplication killed at the formatting level), the storyline screen (aggregate, capped at 3 sources),
and the chapter page (above #gen-stats, note shown, ✎ live-only + teacher-gated). The `<user>` part
ships INERT until login. Guarded by `unit-provenance-fields` (behavioral sanitizer table, backfill
run against a fixture, route/projection/render contracts).

## ▶ NEXT BUILD — the 2026-07-14 TODO list (user), largest first

### 3. OPEN — token usage must be CUMULATIVE across all LLM calls (MEDIUM)
`generationStats.totalPromptTokens/totalCompletionTokens` currently count only the initial
story+lessons generation. They must also accumulate **summary generation, title generation, QC runs,
and storyboard generation** — cumulatively, per story/chapter: e.g. re-generating a title with a new
LLM call ADDS to that chapter's existing totals rather than being invisible.
- Every generator already returns `promptTokens`/`completionTokens` and stamps `buildGenMeta`, so the
  data exists at each call site; what's missing is an accumulate-into-the-topic step.
- Watch the v55_s projection: `/api/lessons` ships a 4-field `generationStats` projection for the
  storyline screen — if the totals move or gain fields, that projection and
  `unit-static-landing-parity`'s field list must follow.
- Decide explicitly whether storyline-level artefacts (summary, storyboard) accumulate onto the
  storyline, onto chapter 1, or spread across chapters — they are not per-chapter work.

### 4. ~~OPEN — speech synthesis: no approximation~~ — ✅ SHIPPED (v55_x → v55_z)
Final shape after two live-found corrections — read this, not the v55_x description:
- **One resolver** (`_ttsPickVoice`) used by ALL THREE speak paths. v55_x de-duplicated two and
  MISSED a third (`_speakAndAdvance`, the listening path) because the grep looked for a remembered
  expression rather than the capability — the user hit it immediately ("Mtu" spelled out as "M t u").
  `unit-tts-no-approximation` now enforces this STRUCTURALLY: exactly two `new SpeechSynthesisUtterance`
  may exist in the client (the shared builder + the silent iOS-unlock utterance), so a 4th copy fails
  automatically wherever it hides.
- **No matching voice → refuse to speak** (independent of mute, which is what makes auto-mute safe).
- **Auto-mute IS set** (`APP.muted` + `updateMuteButtons()`), reversing v55_x's "mute is the user's
  choice, don't touch it". The objection (unmute would resurrect the approximation) is void because
  the refusal ignores mute. Mute = visible state, refusal = guarantee, 🗣 pill = the REASON.
- **Listen exercises are DROPPED** on a no-voice device in all three builders (standard/mixed/script)
  — `buildStandardExercises` had NO voice check at all, which is why Swahili vocab lessons still
  served "tap to listen". Both `listen_mcq` AND `listen_type` go (the script builder dropped only the
  former). Guards are `typeof`-checked because the unit harnesses extract these builders with stubs.
- Proactive: `refreshTtsVoiceState()` on selector rebuild + `voiceschanged`, so pill/mute land on
  lesson open rather than after a silent tap. Conservative during the async voice-load window.
**Still open:** (a) the 🗣 pill could host the tts language/voice selects the way the backend pill
hosts the model picker (v55_o) — deliberately not bundled; (b) `toast.no_voice` ("⚠ No {lang} voice —
using approximation") is now unused but still in ui.json translated into 26 langs — delete on the next
translate pass; (c) the 3 new `tts.*` keys are en-only until then.

### 5. OPEN — more word-game lesson types (see also the labyrinth item below)
Beyond the labyrinth/maze idea already recorded: **generate a crossword from the lesson's words**,
a **wordle-like lesson**, and other word-play games. All are client-side games over an existing
vocab set, so they need no new model calls — the vocab is already stored per lesson.

## ▶ OPEN — three items the user asked about (2026-07-14) — NONE were in the roadmap
Checked: none of these appear in roadmap_v55, so they are recorded here for the first time.
- **Latin script lesson reads out BOTH cases.** Showing upper+lower case is fine, but it *speaks*
  both — one read is enough. (Look at the script-lesson speak path, not the render.)
- ~~**⚠ Difficulty of an added lesson may not be stored/displayed.**~~ ✅ **FIXED in v56.** It was a
  storage gap, not a display bug: the add-lesson route derived `diff` (request → topic → 2), used it
  for the prompt, and never wrote it to the lesson. The list already renders
  `L.difficulty || topicDiff`, so it correctly fell back to the topic's "beginner". Only math /
  intro_script lessons stored a difficulty (they need it at play time), which is why the gap went
  unnoticed. Fix: `{ difficulty: diff, ...result.lesson, id }` — written BEFORE the spread so a
  generator that sets its own difficulty still wins. No backfill needed: the display's fallback
  already covers the 711 existing lessons without one. Guarded by `unit-lesson-difficulty`.
- **Beginner mode should restrict lesson TYPES.** In beginner mode, don't add lessons that require
  already knowing the word — only ones where you pick a word from 4 options. And if listening mode is
  OFF, avoid lessons that require already knowing the translation. Lessons with sound where you type
  the word you hear ARE fine. (This is a lesson-selection policy, so it likely belongs wherever the
  lesson mix is chosen for a difficulty.)

## ✅ Script lessons in BOTH directions (SHIPPED in v53)
User-reported: "arabic->english focusses on the arabic script, but doesn't have exercises for the
latin alphabet." Root cause: `_langScript` mapped only non-Latin languages, so `scriptsForLang('en')`
was `[]` and `needsIntroScript` returned false for every Latin target — an Arabic reader learning
English was offered the *Arabic* course. Deeper: every table's answer side is a Latin `translit`, so
a naive `latin` table would have quizzed "show `A a`, pick `a`" — circular for a non-Latin reader.

Shipped:
- **`latin` table** (26 letters). `letters[].sounds` maps a SOURCE script → the letter's *name* in
  that script, for `arabic, cyrillic, greek, hebrew, devanagari, hangul, katakana, thai`. The NAME
  (not the phonetic value) is used deliberately: phonetic values collide (`c`/`k`/`q` → `ك`), which
  would give an MCQ several correct answers. Every column is asserted complete, collision-free and
  free of Latin characters.
- **`scriptTeachable(name, srcScripts)` + `latin.soundsFor`** — a table with no `soundsFor` (all
  legacy tables) stays teachable exactly as before; `latin` is only teachable to a source script it
  has a `sounds` column for. `needsIntroScript` uses it → symmetric.
- **`opts.srcScripts`** in `introScriptExercises` / `introScriptExercisesFrom`, resolved by an
  **inline** `localSound()` (the parity test builds the server fn with `new Function(body)()`, so it
  must stay self-contained). The Latin `(name)` hint is suppressed once localized;
  `listen_mcq.pron` uses the localized text. Threaded through `generateIntroScript({srcLang})`,
  `buildArcIntroLessons`, and the `intro_script` registry adapter.
- **`scriptsUsedInLessonSet`** filters by teachability, so Latin readers are never offered Latin.
- **`han` stub + `zh → han`**, so every language is mapped. An unmapped code read as "no script" and
  would have got a circular Latin course. A test asserts every `languages.json` code is mapped.

Purely additive — `en→ar` output is asserted `deepStrictEqual` to pre-v53. Tests: `unit-intro-script`
(new v53 block), `unit-add-lesson-registry`. **Owed: LIVE-TEST §68 + native review of the eight
`latin.sounds.*` columns.** No new `ui.json` keys (script labels are data, like `Cyrillic`).

## ✅ `translate-ui.js` language discovery (SHIPPED in v53)
`allLangs` was `Object.keys(ui).filter(l => l !== 'en')` — derived from the languages *already in*
`ui.json`. A language entirely absent from it was therefore invisible to the pass meant to fill it:
never listed, never translated, and `--check` would eventually print "✅ All translations complete!"
with Swahili at 0/426 keys. Since the source language IS the UI language (`uiLang = APP.srcLang`),
`sw` users silently got an English interface. Now derived from `languages.json` (union `ui.json`, so
a stray ui-only entry is still maintained; an unreadable `languages.json` degrades to the old
behaviour). Guarded by **`unit-translate-ui-langs`**. No `sw` entry was seeded on purpose —
`translate-ui.js` keys off *missing* keys and cannot detect English fallbacks, so placeholders would
permanently mask all 426 keys (protocol rule 3).

## ✅ Add-lesson gate followed the global srcLang, not the set's (SHIPPED in v53_b)
The v53 Latin course generated correctly but the **+ menu never offered it**: `scriptsUsedInLessonSet(d)`
reads `d.srcLang`, while both option gates read the global `APP.srcLang` (the UI language of whoever is
browsing). An `en|ar` set viewed with an English UI evaluated `scriptLessonAvailable('en','en')` → false.
Pre-existing, but only exposed by v53 — a non-Latin *target* made the option appear for any srcLang.
Fixed via `scriptLessonAvailableForSet(d)`. Also: the authoring path baked `exercises` with no
`srcScripts`, so the stored array (what the **editor, QC and export** read) answered in Latin translit
even though play-time rebuilt it correctly. Guarded + mutation-tested in `unit-intro-script`.
**Owed: LIVE-TEST §70.**
Follow-up worth a deliberate look: the arc gates (`index.html:1857`, `:3264`) also call
`needsIntroScript(APP.lang, APP.srcLang)`. There the globals ARE the form's selects for a set being
created, so it is probably correct — but confirm rather than assume.

## ✅ v53_c — three quick fixes from the user's TODO triage (SHIPPED)
1. **`translate-ui.js` didn't exit** — the bug was in `llm.js`, not `translate-ui.js`. `_callOllama`
   guarded its request with `Promise.race([call, new Promise((_,rej)=>setTimeout(rej, OLLAMA_TIMEOUT))])`
   and never cleared the losing timer. An un-cleared `setTimeout` holds the libuv loop open, so **every**
   CLI script (`translate-ui`, `generate-lessons`, `translate-lessons`, `qc-lessons`) sat idle for the
   remainder of `OLLAMA_TIMEOUT` — **720000 ms = 12 minutes by default** — after its last call resolved.
   Fixed: capture the handle, `clearTimeout` in `.finally()`, `.unref()` as a second line of defence.
   Guarded by `unit-llm-timeout-handle` (which had to spy on `setTimeout` to avoid hanging itself).
2. **Storyline summary now names its model and is stamped.** `── Storyline summary generation ──`
   printed Chapters + Lang but not the model, and the summary was persisted as a bare string. Storyline
   *title* generation and the chapter-title post-pass already logged theirs. Now logs `Model:` and
   returns `{text, meta}` with `buildGenMeta({type:'storyline_summary', model: OLLAMA_MODEL})`;
   both call sites persist `sl.summaryMeta`. Note `buildGenMeta` defaults to `OLLAMA_LESSON_MODEL`,
   so the story model must be passed explicitly. `/api/storyline-retitle` still returns a plain string.
   Guarded by `unit-storyline-summary-stamp`.
3. **`de↔nl` added to `CLOSE_LANG_PAIRS`.** See the heuristic item below for what this does and does not fix.

## ✅ identical-source/target heuristic — ratio, not count (SHIPPED in v53_g)
**Resolved.** Rule is now `≥3 identical items AND ≥60% of the lesson`. Derived from the corpus, not
chosen: the ratio distribution is bimodal with **nothing between 40% and 75%**. The old `>2` count rule
caught all 5 real failures but also rejected 4 legitimate loanword lessons. The sentence rule (`>1`) is
unchanged — zero identical sentences exist in a non-close pair. Guarded by `unit-identical-ratio`, which
replays the shipped corpus and fails if a lesson ever lands in the 40–75% gap. Owed: LIVE-TEST §75.
Still open below: whether `CLOSE_LANG_PAIRS` should move into `languages.json`.

### (original analysis, kept)
**Where similarity lives:** `server.js` → `CLOSE_LANG_PAIRS` (a hardcoded, order-independent array) plus
`lang === srcLang` for dialects. **There is no similarity field in `languages.json`.** Comparison is
case-insensitive + trimmed; a lesson is rejected at **>2 identical vocab items** or **>1 identical sentence**.

Measured across all 255 topics in `lessons.json`, the count threshold conflates two different things:

| pair | lessons that would block | what the identical items actually are |
|---|---|---|
| `lb→en` | 5 | *mixed* — "History of Luxembourg" is **8/8 (100%)** English words in the lb field (real model failure); "Crémant/Prosecco/Aroma" (38%) are loanwords |
| `it→en` | 3 | "Grandmas Doughs" **8/8 (100%)** English in the it field (failure); "pasta, tagliatelle, risotto" (38%) are loanwords |
| `fr→en` | 1 | "café, fans, notes" (38%) — loanwords + proper nouns |
| `en→nl` | 0 | 10 identical, never >2 in one lesson |

- **100% / 80% identical → genuine model failure.** Blocking is correct.
- **~38% identical → loanwords and proper nouns**, which occur in **every** pair regardless of closeness
  ("Champagne", "Terroir", "Machine Learning", "DJ", "Montmartre", "zombie").

So **closeness is the wrong lever** for the false positives, and `de↔nl` (added in v53_c) only fixes the
narrow West-Germanic-cognate case the user asked about — no `de|nl` topic exists in the corpus yet, but
lowercased `arm/hand/winter/warm` would trip the >2 rule immediately. **Proposed:** switch to a **ratio**
threshold (identical ÷ total items) with a small absolute floor — e.g. block at `≥60%` and `≥3` items.
Against the current corpus that blocks every 100%/80% failure and passes every 38% loanword lesson.
Needs a headless test over the real corpus (the numbers above are reproducible) and a decision on the
cutoff. Also worth deciding whether `CLOSE_LANG_PAIRS` should move into `languages.json` as a `close: []`
field — several current entries (`nds, bar, af, nb, nn, be, ms, gl, sk`) are for languages the app does
not even offer.

## OPEN — model↔language capability matrix + auto-selection (user, big)
**Ask:** fill out every language in `languages.json`/`ui.json`, record which installed models can
serve which language, and auto-select the best model per (source, target) pair. Also flag which
models can do **math** lessons (TranslateGemma cannot).

**Research (done, v53_c).** No vendor publishes per-language *quality*; they publish per-language
*support* (a binary list). Quality per language only exists in benchmarks:
- **Belebele** — reading comprehension, **122 languages**, built on FLORES-200. The best per-language
  signal for "does this model actually read this language".
- **Global-MMLU** (42 languages, with culturally-sensitive vs culturally-agnostic tags) and
  **Global-MMLU-Lite** (15) — knowledge/reasoning, has public leaderboards.
- **MMLU-ProX** — 29 typologically diverse languages, 11,829 *identical* questions per language, so
  cross-language comparison is direct. Its headline finding is exactly our problem: performance
  "declines markedly in low-resource languages, with gaps of up to **24.3%**".
- **MMMLU** (OpenAI, 14 languages incl. Swahili) — public leaderboard.

Concrete published numbers for models we actually run:
- Belebele: `Qwen2.5-7B-Instruct` scores **93.1 en / 90.3 fr / 89.4 es** but **77.7 sr / 70.3 hu / 67.7 bn**.
- Belebele (28 European variants): `Qwen2.5-14B-Instruct` avg **61.7** vs `Qwen2.5-7B-Instruct` avg **54.4**;
  on Polish, **58.9 vs 52.2**. → *size matters most exactly where the language is lower-resource*, which is
  the strongest argument for per-language model selection rather than one global default.
- **TranslateGemma** (4B/12B/27B, Gemma-3-based): trained + evaluated on **55 languages** (plus ~500 further
  pairs, unevaluated). Explicitly *translation-specialised*: only ~30% general instruction data is retained.
  A 12B TranslateGemma can match a 27B base Gemma 3 **on translation**. This is precisely why it is bad at
  math: it was distilled for translation, not reasoning. Also documented: Japanese→English regressed on
  proper names in human eval.

**Recommended shape (not yet built):**
- Capability lives on the **model**, not the language. `languages.json` says what a language *is*;
  a new `models.json` (or a `capabilities` block in `prompts.json`) says what each model *can do*:
  `{ "translategemma:12b": { langs: [...55], tasks: ["story","translation"], notTasks: ["math","conjugation"] } }`.
  Adding a `math: true` flag to `languages.json` (the user's suggestion) puts a *model* property on a
  *language* record and will not survive a second model.
- Auto-selection = `pick(task, lang, srcLang)` → the highest-ranked installed model whose `langs` covers
  both and whose `tasks` includes the task; fall back to the configured default. Deterministic, headless,
  unit-testable — the existing `OLLAMA_*_MODEL` role split (story / lessons / translation / qc) is already
  the right seam.
- The per-language *ranking* must be sourced (Belebele/Global-MMLU per-language tables), not guessed.
  Store the source and date next to each number, like `_sounds_comment` does for the script tables.
- **Do not** silently swap models per language until `_genMeta` stamping is complete (below) — otherwise
  nobody can tell which model produced which lesson.

## ✅ Generation provenance — story stamped, `buildGenMeta.model` required (SHIPPED in v53_d)
**The v53_c audit of this was WRONG and is corrected here.** It claimed the chapter story "neither
logs a model nor is stamped". Both were false; the grep looked for the word `Model` and missed the
`[${OLLAMA_MODEL}] Story (...)` prefix. Verified against the 267-topic corpus:
- The story **does** log its model, and **does** record it in `generationStats.models.story`.
- That field is recent: **16 of 267** topics have it; **249** have `generationStats` without it; **2**
  have no `generationStats` at all (the "save story early" upsert, which runs before lesson
  generation so a crash cannot lose the story). **v53_e: these WERE backfilled** — see below. The
  earlier claim that backfill was impossible was wrong: the older topics carry
  `generationStats.model`, a label whose first element is provably the story model.
- `models.story === null` is **correct**, not a bug: all 11 such topics are `userStory: true`.
  But null was indistinguishable from "unknown" for a future "sort by models used".

The real gaps, now fixed:
- **No per-artefact stamp for the story** — no `ms`, tokens, or `at`, unlike every lesson's `_genMeta`
  and the storyline's `summaryMeta`. Added `topic.storyMeta`, written on **both** upserts (the
  early-save path matters most: those are the topics whose lesson generation crashed).
- **A pasted story is now stamped `'(user-provided)'`** rather than left null, alongside the existing
  `'(procedural)'` sentinel used by math/intro_script. New sentinel `'(unknown)'` for the add-lesson
  `_genMeta` fallback, which previously claimed the *lesson model* for a lesson it had not generated.
- **`buildGenMeta({model})` is now REQUIRED** and throws otherwise. It used to default to
  `OLLAMA_LESSON_MODEL`. Cross-checking every stamp against the model actually called showed **no
  live mis-stamp** — every real site matched the default — but the trap was one copy-paste from
  writing permanently wrong provenance into `lessons.json`. All 13 call sites now name a model.

Guarded by `unit-story-stamp` (mutation-tested) + updated `unit-genmeta`, `unit-storyline-summary-stamp`.
**Translation stamp SHIPPED v55_f** (was: "still open"): `topic.translationMeta` mirrors `storyMeta`,
stamped live in 4 states (generated / failed / user-provided / skipped-same-model) and backfilled on
all 267 topics, additive to `generationStats.models.translation`. Guarded by `unit-translation-stamp`.
The provenance arc — story, translation, storyboard — is now complete.
**v53_e: `storyMeta` is now on all 267 topics** (backfilled), so consumers can rely on it — but they
must handle the `'(user-provided)'` and `'(unknown)'` sentinels, and should treat `storyMeta.backfilled`
as "inferred, not recorded". The same contract applies to `translationMeta` (sentinels
`'(none)'`/`'(user-provided)'`/`'(unknown)'`).

## ✅ Provenance backfill (SHIPPED in v53_e) — `backfill-provenance.js`
The 249 topics without `generationStats.models` **do** carry `generationStats.model`, a label built as
`[...new Set([OLLAMA_MODEL, OLLAMA_TRANSLATION_MODEL, OLLAMA_LESSON_MODEL])].join(' / ')`. A Set keeps
first-insertion order and the STORY model is inserted first, so **`label.split(' / ')[0]` is always the
story model**. Verified empirically, not assumed: on the 16 topics carrying both fields it agrees 5/5
(the other 11 are user-provided, `story: null`), and the lessons model appears in the label 16/16.
`node backfill-provenance.js --verify` re-runs that check.

The migration is **dry-run by default**, idempotent, writes a `.bak`, and **refuses to write** while any
topic is unstamped or any model name is untagged. It never invents a value:
- A **single-element label** proves all three roles used one model → `generationStats.models` backfilled
  (243 topics). A **two-element label** pins only the story; which of translation/lessons is the other
  model is unrecoverable, so `models` is **left absent** for those 6 rather than guessed.
- `userStory` → `'(user-provided)'`. **122 of 267 topics** are user-pasted stories; attributing a model
  to them would have been a fabrication. (The user's recollection was "all non-annotated were
  qwen2.5:7b" — the record says otherwise for 122 of them.)
- A story with no stats *and* no `storyPrompt` (the seeded `osttirol-glossary`) → `'(unknown)'`.
  `--assume` deliberately does **not** cover it.
- Values from user memory are marked `source: 'user-asserted'` (5 rows: the 4 untagged
  `translategemma` → `:4b`, and 1 `--assume`). They can never be mistaken for recorded provenance.

Run as: `node backfill-provenance.js --assume qwen2.5:7b --resolve translategemma=translategemma:4b --write`
Guarded by `unit-story-stamp` (corpus invariants: sentinel ↔ `userStory` both ways, every model tagged,
`'(unknown)'` only where the record is silent, `models` backfilled only for single-model labels).

## ✅ SHIPPED v55_o — collapsible model selection on the home page
Live mode shows the model pickers inline on the home page. Make them collapse into the **Backend status
pill** (click → popover). Client-only (`index.html`), no server change. Browser-only verification, so it
needs a LIVE-TEST section and there is little the headless suite can assert beyond "the pill exists and
carries the popover markup". Small, but not *free* — the pill currently only renders backend state, and
the pickers are wired to `/api/models`. Do it after the model-selection work above settles, or the popover
gets rebuilt twice.

## OPEN — QC for generated texts (stories, summaries) → corrected text + auto error-hunt (user)
**STORY QC SHIPPED v55_g** — 🔍 on the story: `generateStoryQc` (QC model, think:false, `storyQc`
prompt) returns a correction PROPOSAL (`topic.storyQcProposal`, never overwrites `topic.story`); the
"too many changes" guard rejects a rewrite at changedRatio > 0.6 OR wordEditRatio > 0.5 (thresholds
set from the spike: corrected band ≤0.21/0.033, the one rewrite 0.938/0.844). Accept applies the
correction, pins `aiStory` to the original, stamps `storyQcBy`/`storyQcAt`, and rebuilds the
ai_error_hunt from the real diff. Routes `/api/story-qc` (+`/accept`, `/discard`); guarded by
`unit-qc-correct` (+ an llm.js import-completeness guard, v55_h); LIVE-TEST §80. **Bulk story QC SHIPPED v55_k** — the storyline 🔍 sweep proofreads each chapter's story too, accumulating one proposal per chapter (green 📝 badge; reviewed per story screen; skip-stamped; staleness-guarded; NOT in the auto post-book pass); LIVE-TEST §81. **SUMMARY QC SHIPPED v55_n** — 🔍 on the storyline summary; reuses classifyStoryQc + the shared renderer/reconstruction, no error-hunt; routes `/api/summary-qc` (+/accept, /discard); LIVE-TEST §82. **The QC arc is COMPLETE** (story + bulk + per-sentence + summary; one classifier, one renderer, one reconstruction). Original spec (kept):
A second model reviews a generated story/summary and returns a **corrected** text the user can accept as the
new default; the diff then seeds an **error-hunt** lesson automatically — the same lesson type, but with the
errors made by a model rather than a human. This is a genuinely good fit: the QC role model already exists
(`OLLAMA_QC_MODEL`, v52_e), the per-model collect-and-compare UI exists (v52_g), and `generateErrorHunt`
already builds a lesson from an original/corrupted pair — it currently *asks* a model to introduce errors,
and would instead be handed a real (original, corrected) pair.
Design notes: store the correction as a proposal (never overwrite `topic.story` without user acceptance);
reuse `qc.by`/`qcByModel` stamping so the corrector is recorded; guard against the corrector rewriting
rather than correcting (`generateErrorHunt` already throws on "identical story with no changes" — the
inverse guard, "too many changes", is needed). Error-hunt from a real diff also fixes a known weakness:
model-invented errors are often not the errors learners actually make.

## OPEN — dynamic classification + sortable library (user)
Classify existing storylines/lessons (story style, vocabulary count, glyphs trained, generation date,
difficulty, models used) and let the main page **sort and filter** by those properties. Most of the data
already exists: `_genMeta.at/model`, `storyStyle`, `lessons[].vocab.length`, `intro_script.letters`,
`generatedAt`/`updatedAt`, and (since v53_d/v53_e) `topic.storyMeta` on **all 267 topics**. Two pieces
are missing: a derived per-topic index (computed once, cached) and the UI. Provenance after the v53_e
backfill: `qwen2.5:7b` ×130, `(user-provided)` ×122, `translategemma:12b` ×10, `translategemma:4b` ×4,
`(unknown)` ×1. So "sort by model" is now viable — but the UI must render the two **sentinels**
(`(user-provided)`, `(unknown)`) as first-class values rather than as missing data, and should
distinguish `storyMeta.backfilled` (inferred) from live stamps (recorded).

## OPEN — export: printable language test (user)
Generate a printable test (PDF/HTML) from a whole storyline or a single lesson set. `/api/export` and the
`.md`/`.html` export path already exist (`index.html:10458` asserts the downloaded file matches the live
endpoint), so this is a new *renderer* over existing data plus an answer-key toggle. Zero-dependency
constraint means HTML + `@media print`, not a PDF library.

## OPEN — labyrinth / maze word lessons (user)
**See also "more word-game lesson types" at the top of this file (2026-07-14): crossword from the
lesson's words, a wordle-like lesson, other word-play games — same family, all client-side over the
stored vocab (no model calls).**
Reference: <https://christophsturm.com/jakobs-labyrinth/> (code: <https://github.com/christophsturm/jakobs-labyrinth>).
Trace a target-language word through a maze, replacing the typing step of a listen/type question. Two options:
1. **Build it in.** A maze generator is deterministic and offline — a good fit for the LLM-free exercise family
   (like `intro_script` and `math`). Needs: a new exercise `type`, a client renderer, a registry entry, a
   `unit-*-registry` update, and `qid()` stability. The same generator would serve a **math** variant
   (trace an increasing / decreasing / Fibonacci series), which is the more novel idea of the two.
2. **Link out.** Construct a URL and open a popup:
   `https://christophsturm.com/jakobs-labyrinth/?kind=maze&word=DRACHE&size=10&difficulty=medium&letters=normal&seed=863264842`
   Cheap, but breaks the app's core promises: it needs the network (the app works fully offline and ships as a
   single static `docs/index.html`), it cannot record a result, the `qid()`/solved store never sees it, and it
   sends the learner's vocabulary to a third-party site. **Recommend option 1**; use option 2 only as a
   throwaway prototype to test whether the exercise is fun before building it. Check the repo's licence first.

## OPEN — glossary-driven generation is not recorded (v53_f finding)
`osttirol-glossary` carries `_dialect` / `aiGenerated` / `storyGloss`; `Essen an Luxembourg` — generated
the same way, from an uploaded glossary — carries none of them, only `generationStats`. So the v53_f
`origin` classifier reads the first as `dialect-rewrite` and the second as plain `generated`, and there
is no way to tell from the data that a glossary informed either. If "this story was generated from an
uploaded glossary/source text" should be a first-class fact, it needs a recorded field at generation
time (e.g. `storyMeta.derivedFrom = { kind: 'glossary'|'file', name }`). The classifier was deliberately
NOT bent to match a recollection — `origin` must mean "what the data says", not "what we remember".
Ties directly into the item below.

## OPEN — text provenance: author, licence, source URL (user)
**SUPERSEDED/EXTENDED by "provenance fields: sources + generating user" at the top of this file
(2026-07-14) — same work: user-editable URLs/DOIs, a generating-user field defaulting to "admin",
provenance shown above the gen stats, and a `by <user> · from: <source>` one-liner on the landing
card and above the storyboard. Treat that block as the spec and this one as background.**
**v53_f laid the first stone:** `storyMeta.origin` now distinguishes `file-upload` (50 topics) from
`user-pasted` (72), and a file-upload chapter carries `storyMeta.sourceFile`. What is still missing is
everything a licence needs. When a text is uploaded or pasted ("I have my own story"), record **author**,
**licence**, **source URL**, and an optional description. The user suggests folding this into the topic description field. **Recommend against**
a free-text convention: it cannot be validated, exported, or filtered, and it will be silently mangled by the
retitle/summary passes. A structured optional `source: { author, licence, url, note }` on the topic is barely
more work, survives `export-lessons.js`, and can be surfaced in the printable test above and in the library
classification. A one-line rendered attribution can still be *derived* into the description for display. Needs
a `schemaVersion` bump + a migration that leaves existing topics untouched (`source` simply absent).

**Version note:** v56 is a MINOR/feature cut. Post-v56 point releases are numbered v56_b, v56_c, …
(per user). At the next MINOR/feature cut, resume vNN numbering (v57) and write `roadmap_v57.md`.

## ⚠️ Session protocol — READ FIRST, applies to every change

This block is the standing "definition of done." A fresh session is expected to follow it without
being re-told; several of these were missed in past sessions (LIVE-TEST updates, i18n listing,
version bump) and only caught because the user noticed. Treat it as a checklist.

**How to start a session:** read THIS file (the highest-numbered `build_history/roadmap_v*.md` is
the current one), then `build_history/LIVE-TEST-CHECKLIST.md`, then the most recent
`build_history/v*_session*_notes.md`. Establish the green baseline (`node test/run.js` +
`node test/check-inline.js`) before touching anything.

**Working rules (per change):**
- One change at a time. Pure refactors stay byte-identical. After each change: full suite green
  (`node test/run.js`) and `check-inline` at 0. Re-run before moving on.
- Add or update a **unit test** for any new behavior. When adding a lesson type, exercise type,
  generator, or registry entry, update the matching registry test (`unit-*-registry`).

**Definition of Done — before calling any change finished, check ALL that apply:**
1. **Tests** — suite green + `check-inline` 0; new/changed behavior has a guarding test.
2. **Browser-only behavior → session notes** *(amended 2026-07-20; the former
   LIVE-TEST-CHECKLIST.md is a closed archive — do NOT add sections to it)*. If the change is
   browser-only or Ollama-only (UI, RTL, TTS, rendering, anything not exercisable headlessly),
   the session notes MUST contain a short "how to see it work" description — what to click and
   what to expect — so the user can verify it in normal use. Keep it terse; the burden of proof
   shifted from a formal checklist run to the user's routine usage, but the DESCRIPTION of intended
   behavior is still owed.
3. **i18n** — new user-facing strings go in `ui.json` **`en` only** (never add English text to other
   languages — the user's `translate-ui.js` fills *missing* keys and can't detect English
   fallbacks). List every new key in the session notes + roadmap so the offline translate pass is
   run. Changed English values won't be re-translated automatically (script keys off *missing*, not
   *changed*) — call those out explicitly or hand-edit if language-neutral.
4. **Static build** — if client (`index.html`) or baked data (`lessons.json`, `languages.json`,
   `scripts.json`, `ui.json`) changed, re-run `node build-static.js` so `docs/index.html` is current.
5. **Data parity** — if a generator exists on both server and client (math, intro_script, furigana
   tokenizer), keep them identical and assert parity in a test.

**Definition of Done — at a release / packaging point:**
6. **Version** — bump `APP_VERSION` in `server.js` if it's a new release. NOTE (v49): the static
   build now DERIVES the version from `server.js`'s `APP_VERSION` at build time (see
   `unit-version-derivation`), so a single bump in `server.js` + a `build-static.js` re-run is
   enough — no more hand-editing `build-static.js`.
7. **Roadmap** — mark shipped items ✅, carry every open TODO/idea forward, and at a version bump
   write the next `build_history/roadmap_v{N+1}.md` (carrying this protocol block forward).
8. **Session notes** — write/update `build_history/v{ver}_session{n}_notes.md`.
9. **Package** — sync the release dir, regenerate `docs/`, zip, and call out which deliverables are
   still owed (browser pass, i18n, native-speaker content checks).

(If you add a new standing rule, append it here so the next session inherits it.)

---

## OPEN — near-term (do these next)

### 0. Browser / Ollama verification pass — ✅ CLOSED 2026-07-20 (bulk, user)
All tracked functionality was exercised by the user and broadly works and/or is superseded by
planned changes; `LIVE-TEST-CHECKLIST.md` is now an archive and the procedure is retired (see
protocol rule 2). Original section text kept below for the record:
The interactive checklist (`LIVE-TEST-CHECKLIST.md`) is the gate. Browser-only sections need only
the static build; the Ollama sections need a local model. **Expect to tune the QC prompts** —
qwen2.5:7b (and similar small models) are unreliable on "is this distractor also valid?" and
synonym/antonym judgments. **New in v49 to verify:** §§41–45 (order RTL, word_forms/synonyms RTL,
sound-test row incl. tooltips + flag-follow, motto, QC-skip incl. shift-click force). Also verify
the v49 **QC coverage expansion** live: grammar + conjugation lessons now get flagged, and the
flags render/dismiss in their editor branches — watch for false positives from a weak model.

### 1. UI translation re-pass with TranslateGemma — OWED (user), now TINY
**Figure corrected 2026-07-20:** `node translate-ui.js --check` reports **29 missing keys** —
`storyboard.locked_resume` (new in v57) × 29 languages, nothing else. The "1630 missing" claim
below was stale (a pass evidently ran, `sw` included at 466/467, without this file being updated).
One `translate-ui.js` run clears the debt. Historical text kept for the record:
- **43 en-only keys on every one of the 28 present languages** — `models.*` (×11),
  `dialect.*` (×23), `qc.editor.suggests_by`, `form.use_dialect`, `tts.approx_dialect`, and the
  three `*_nolang` keys (`ex.mcq_source_target.q_nolang`, `ex.badge.mcq_source_target_nolang`,
  `ex.type_translate.q_nolang`).
- **All 426 keys for `sw` (Swahili)**, which had NO `ui.json` entry at all. It was invisible to
  `translate-ui.js` until the v53 fix (see "✅ translate-ui.js language discovery" above); the
  v48-b claim of "0 missing across 29 langs" never counted it. `node translate-ui.js sw` does it
  alone. **Do not hand-seed English placeholders** — the script keys off *missing* keys and cannot
  detect an English fallback, so placeholders would mask all 426 permanently (protocol rule 3).

The script-bleed sanity check (Chinese into Korean/Hebrew, Cyrillic into Arabic under the old qwen
model) is in the v48-b/v49 notes if it needs re-running on the next ui.json. Note the `sw` pass is
the first time a language is translated from scratch rather than topped up — worth a closer read of
the output. Changed English values are NOT re-translated automatically (the script keys off
*missing*, not *changed*).

### 2. Library tag/language filter persistence — CLOSED (not a bug)
Investigated in v51. Not reproducible as a defect; **closed by decision (user)**. Findings, kept so a
future session doesn't re-open it: the filter *logic* (`libFilter`/`libSrcFilter`/`libTagFilter`,
`setLibFilter`, `_renderTagFilterBar`) is consistent between the server build and the static build,
and `_restoreFormLang()` does NOT touch the lib filters. The only filter reset that actually fires is
the static build's `init()` (build-static.js): on page LOAD it deliberately forces `libFilter='all'`
/`libSrcFilter='all'` and presets `libTagFilter` to `'manually curated'` if that tag exists. So any
"lost filter" after a **reload** of `docs/index.html` is intentional static-init behavior, not a bug;
in-session Home/back keeps the in-memory filters. If a future need arises to persist filters across
static reloads, the fix is localStorage in the static `init()` — but this is not currently wanted.

---

## OPEN — waiting on user material

### Dialect lessons (East-Tyrolean pilot) — M1 + M2 SHIPPED in v51
Historical detail retained below for reference. Only remaining "waiting on material" item: the
broader **mein-osttirol.rocks** dictionary (1165 entries, Region/Gemeinde columns) — pending a
permission email to its operators (info@mein-osttirol.rocks); NOT to be imported until permission is
on file. Everything else here shipped (see the v51 summary at the top + the evaluated-ideas section
at the bottom).
Full spec + parsing rules + data model in **`build_history/spec_dialect_lessons_m1.md`**. Decisions
locked: glossary-table-first; East-Tyrolean pilot; dialect = target / High German = source; 3-col
table `dialect | de | note`; one row = one verbatim vocab item; approximate `de` voice toggle.
Safety spine: **user is the source of truth, the model is a packager/aligner, never an author.**
**Material received:** Bernd Kranebitter's "Dialekt Wörterbuch Osttirol" (CC BY-NC, used with
explicit permission — see `ATTRIBUTIONS.md`). A broader online source (mein-osttirol.rocks, 1165
entries) is pending a permission request to its operators (NOT to be scraped/imported until
permission is on file).
**SHIPPED this step (headless core + data model):** `dialect-glossary.js` — a deterministic,
no-LLM importer: `parseDialectGlossary` detects delimiter (tab/pipe/**equals**/comma/2-space),
skips title/CC-license/header lines, parses rows verbatim (no split/normalize beyond trim), keeps
duplicates but reports them, and SURFACES a suspicious "glued" row (the real PDF collided
`Mangale…MannFock` artifact) as an anomaly for the human to fix rather than auto-splitting it.
`dialectVocabItems()` → `{target, source, note?, _dialect:true}`. **`buildDialectTopic(rows, meta,
opts)`** turns parsed rows into a complete, playable dialect TOPIC (lang===srcLang===de, the
dialect as a variety of German; rows chunked into `standard` vocab lessons in author order; every
item + lesson marked `_dialect:true`; attribution + a `_dialect` metadata block on the topic, never
sent to a model). All tested against the real Osttirol material (`unit-dialect-glossary`,
`test/fixtures/osttirol-glossary.txt` — now corrected to 86 clean rows; the collided-row guarantee
kept via a synthetic input).
**M1 COMPLETE.** All pieces shipped:
- `sourceOnly` QC direction — `qcCheckDialectPair` verifies only the gloss and can only ever return a
  `field:'source'` fix; `_runQc` routes any `_dialect` lesson/item to it, so QC never rewrites a
  dialect token (`unit-qc-dispatch`).
- **Wiring + UI panel** — `/api/dialect-import` (server: parse → `buildDialectTopic` → `upsert`,
  returns the parse report), and the "🗣 Dialect" panel on the generation screen (name, paste/upload
  glossary, attribution, Build; shows suspicious/duplicate rows to fix; the new topic appears in the
  saved list and plays as normal vocab lessons). E2E-tested (`e2e-dialect-import`) + against the real
  Osttirol glossary (86 rows → 8 lessons).
- **Approximate voice** — dialect content is spoken with the base-language (German) voice and
  labelled "≈ {lang} voice (approximate)" via the existing approximate-badge path; `ttsIsApproximate`
  now returns true for `_dialect` content regardless of any TTS override, and the badge names the
  base voice (`unit-dialect-tts`). No native dialect voice exists, so this is inherently approximate
  and always labelled.
New en-only i18n keys owed to the translate pass: `form.use_dialect`, `dialect.*` (11), and
`tts.approx_dialect`. Browser checks owed: LIVE-TEST §51.

**Toward M1.5 → M2 (generation, with a native-review gate):**
- **M1.5 — assisted example sentences (SHIPPED, safe bridge):** opt-in (off by default) AI example
  sentences for a dialect topic's words. `generateDialectExample` (server) uses a tightly
  constrained, glossary-few-shot-grounded prompt (mimic the uploaded orthography, use only glossary
  words + small function words), returns one `D:/G:` pair, and a guardrail REJECTS any sentence that
  doesn't contain the target word. `/api/dialect-examples` (job-based) adds them as a review-gated
  `_aiExamples` lesson; every sentence is `aiGenerated:true` + `needsReview:true` and titled
  "🤖 … AI example sentences (review)". Crucially, QC treats `aiGenerated` dialect items with FULL
  pair QC (both sides), NOT sourceOnly — because the model authored them, so the dialect side is no
  longer ground truth. Client: an opt-in checkbox in the dialect panel chains generation after
  import and polls the job. Tested end-to-end (`e2e-dialect-import` extended; fake-ollama gained a
  dialect-example branch) + unit (`unit-dialect-examples`). **Quality still needs live tuning** —
  the fluent-but-wrong hazard is real; that's why it's opt-in, marked, and review-gated.
- **M2 — generated dialect stories (SHIPPED, gated):** the model may author a dialect story ONLY
  for a dialect a human has approved. Implemented as a hard gate: `topic._dialect.curated` (default
  false) must be true or `/api/dialect-story` returns 403. `/api/dialect-curate` sets it, and
  REFUSES to curate a dialect that has no reviewable AI sample output (the M1.5 example lesson) —
  you can't approve what you haven't seen the model generate. `generateDialectStory` uses a
  constrained, glossary-few-shot prompt (STORY/GERMAN blocks); the result is stored on the topic as
  `aiGenerated:true` + `_dialect.aiStory.needsReview:true` (not trusted). A "🗣 dialect studio" strip
  on the dialect topic's lesson-set page exposes: suggest examples → approve (enabled only once
  examples exist) → generate story (enabled only once curated). Full gate tested end-to-end
  (`e2e-dialect-import`: 403 before curation, curation requires sample, gated generation) + unit
  (`unit-dialect-examples` M2 section). fake-ollama gained a dialect-story branch.
  **The value over "just ask Qwen" is exactly this gate** — the model can't publish dialect prose for
  a dialect nobody vetted, and everything it writes is marked for review. **Story QUALITY still needs
  the human review the gate is built around** — approving is a deliberate human act, not automatic.
  Remaining/future: a richer review UI (accept/reject individual generated items, promote reviewed
  stories to a trusted state), and native-reviewer workflow. The Qwen output stays the north-star
  reference.

---

## OPEN — discussed, not started

### Generalize language similarity from a curated list to phylolinguistic relations
Right now closeness is a hand-curated flat table: `CLOSE_LANG_PAIRS` + `isCloseLangPair(lang, srcLang)`
in server.js (used to relax the "identical source/target" check for close pairs, v52_b), and a
separate `LOW_RESOURCE_TARGET_LANGS` set (the generate-time model-suitability warning, v52_c). Both
are ad-hoc and only as complete as we remember to make them. We want to **derive** language
similarity from phylolinguistic (genealogical/typological) relations instead — e.g. a language-family
tree (Indo-European → Germanic → West Germanic → German/Lëtzebuergesch/Low German …) plus optional
typological distance, so "how close are lang A and B" is computed from where they sit in the tree
rather than enumerated by hand. Sketch:
- Add family/branch metadata per language (natural home: `languages.json`, e.g. a `family` path or an
  ISO-based genus code), or import an existing dataset of genealogical relations.
- Replace `isCloseLangPair` with a distance function over that tree (same genus / same sub-family /
  same family → graded closeness); keep an override list only for known exceptions (contact
  languages, scripts, etc.).
- Fold `LOW_RESOURCE_TARGET_LANGS` into the same metadata so the identical-field relaxation AND the
  model-suitability warning read one consolidated language-relations source.
- Bonus payoff: a principled similarity signal could also inform bridge-language choices, difficulty
  estimates, and which cognates to surface. Keep it advisory where model behaviour depends on it.

### Story-style themes — manual/LLM theme selection (v1 shipped in v52_d: auto gradients)
Shipped (v52_d): the storyline screen gets a subtle top-down background gradient themed by the FIRST
chapter's writing style (`storylineThemeKey`/`applyStorylineTheme`/`STORY_THEME_GRADIENTS`); uploaded
stories (no style) get their own "existing" theme; an explicit `topic._theme` override is honoured.
Still OPEN (deferred from the original ask):
- A **theme-picker button** next to the storyline title/summary buttons to set `_theme` manually
  (and persist it on the topic), overriding the style-derived default.
- An **LLM classification pass** — a prompt that reads a whole storyline and suggests a theme
  (mirror the `genStorylineSummary` button/endpoint pattern), wired to the same button.
- Richer per-theme styling beyond the background gradient (accent colours, question-card layout
  variants per style — funny vs philosophical, etc.).

### Varied answer-feedback visuals
v52_d replaced the wrong-answer shake with directional motion (correct → rise-up, wrong → fall-down).
The old `.shake` class/keyframes are deliberately KEPT in the CSS as a still-available option. We may
want a small library of feedback animations to choose from (shake, rise/fall, pulse, glow, flip, etc.)
— e.g. a user preference, or tied to the story-style theme (a "funny" story could use a bouncier
correct animation than a "philosophical" one). Low priority / polish; the building blocks (multiple
keyframe classes toggled in `check()`) are already there.

### Dynamic mixed lessons as the DEFAULT progression model
Shift from "complete each lesson in a locked path" to "play variable-length mixed rounds from the
whole set until a target fraction of ALL questions is solved," with per-lesson coverage indicators.
**Interim shipped in v48:** (a) a `mixed` lesson present → non-teacher plays only it, once-through
unlocks the story; (b) script lessons cap play-time questions to a difficulty-scaled random subset.
The full model still needs the keystone: **stable per-question IDs** (exercises re-derive/reshuffle
today, so "solved" has nothing durable to attach to) + a per-question solved store + coverage UI +
weighted round assembly + a set-level completion fraction. **Commit A (landed, v50 wip):** `qid()` +
`_qidCanonical`/`_qidHash` give every exercise a stable `<lesson>:<type>:<hash>` id (content-derived,
shuffle-independent, skill-distinct), plus `APP.progress.solved[topic]` (monotonic, flag-excluded)
recorded on correct answers — purely additive, nothing consumes it yet, proven stable by
`unit-qid-stability` (real builder × 50 shuffles → one bounded id universe). **Commit B (landed,
v50 wip):** coverage model consumes the solved store — `_lessonQidUniverse` (monotonic, cached,
convergence-derived denominator with zero builder drift), `lessonCoverage`/`topicCoverage`/
`coverageComplete`, and `assembleCoverageRound` (~70/30 unsolved/review, unsolved-first) wired into
`buildMixedExercises`. `setComplete` uses coverage for a mixed-driven set (story-unlock + 100% now
mean "solved ≥ target of the question universe", not "played once"); path bar shows "N of M solved ·
P%" and the mixed node a 📊 N/M chip. Guarded by `unit-coverage`; browser checks in §47. **Commit C
(next, optional):** coverage-aware sampling *inside* a single script/intro lesson's play-cap (still
plain random — a short one-lesson round can miss letters), and any teacher/opt-in toggle if coverage
should apply outside the mixed-driven case. Open design Qs — resolved as defaults this cycle:
what counts as "solved" (**one correct = coverage model**, chosen); default vs opt-in vs teacher
path (**opt-in / additive via the existing mixed flow**); round weighting (**≈70/30 unsolved/
review**); **coverage-aware sampling** (the v48 script play-cap is plain random — a short round can
miss letters); flagged questions excluded from the denominator (**done in Commit A's markSolved**).
Builds on existing `buildMixedExercises` + `_srcLessonIdx`.

#### Design note — two identity concepts (instance qid vs content qid)
When the future **user-management / long-term progress** layer lands (cross-storyline "repeat
questions the user has seen before" / SRS), it needs a *different* id from the one Commit A built —
plan for both now so the seam is understood:
- **Instance qid** (Commit A, shipped): `"<lessonId>:<type>:<hash(canonical)>"`. Lesson-scoped on
  purpose. Answers "have you finished *this* lesson / this set" → coverage bars, story-unlock,
  Commit B round assembly. The lesson prefix means the *same* word in two storylines is two
  different ids (correct within a storyline; prevents collisions).
- **Content qid** (future, NOT built yet): `"<lang>:<srcLang>:<type>:<hash(canonical)>"` — drop the
  lesson prefix, add the language pair. This makes the same skill on the same pair **collide on
  purpose across storylines**, which is exactly what "you've seen this before" / SRS keys off.
  It's a small additive function that reuses the SAME `_qidCanonical` + `_qidHash`; don't build it
  until a consumer exists (avoid unused abstraction / drift).
- The language pair MUST be in the content qid (the instance qid gets it for free via the lesson
  prefix) — else the same English gloss across different target languages would wrongly merge.
- **Edit-stability caveat:** both ids are content-derived, so editing a question's text changes its
  id and breaks the "seen before" link for that item (fine for SRS = re-learn). If edits must ever
  preserve cross-storyline history, that needs a real STORED stable id on the source item in
  `lessons.json` (a genuine future decision + data migration — not needed for Commit A/B).

---

## OPEN — user progress & user-specific content (NEW, v50)

### Learned-vocabulary ledger — FOUNDATION SHIPPED (v50)
`APP.progress.learned["<lang>|<srcLang>"] = { vocab:{ target:{source,seen,wrong} }, sentences:{…} }`
accumulates every word/sentence the learner is taught across ALL lessons and topics (via
`recordLearnedFromLesson`, called from `showComplete`), tracks wrong-answered words for future
focus, excludes flagged items, and is per-language-pair (NOT cleared by a per-topic progress reset —
it's a lifetime record). `learnedSummary()` gates UI. **Nothing consumes it for generation yet** —
that's the plan below. Guarded by `unit-learned-vocab`.

### "My story" — generate from what the learner has learned (FIRST VERSION SHIPPED, v50)
Goal: a story/lesson generated from the learner's cumulated vocabulary & sentences, to RETRAIN what
they've learned, focusing on words they got wrong. **Shipped (hybrid, option i — story-seed +
reinforce-as-context):** selecting `✨ my story` (the `__my__` sentinel, shown when ≥8 words learned
for the pair) now runs a real generation. Client `myStoryPayload()` sends the learned slice
(`fromLearned:{vocab:[{target,source,wrong}]}`, wrong-first, capped 60) instead of `continuedFrom`;
server `generate()` (a) seeds the STORY prompt from the known words with extra attention to
wrong-answered ones, and (b) routes the same slice into the existing `chainVocab`/`vocabMode:
'reinforce'` channel so the LESSONS weave those words into sentences. Topic-less: the server
synthesizes a "My review — <lang> (date)" topic and force-regenerates (no same-day cache hit). The
whole downstream pipeline (translation, vocab extraction, lessons) is unchanged. Plumbing guarded by
`unit-my-story`; **story/prompt QUALITY needs live-model tuning (checklist §50).**
**Future upgrade — reinforce-as-drill (option ii):** currently the wrong words are woven into
sentences as *context* (reinforce mode = "do not list as vocab items"). A stronger retraining mode
would inject the wrong words as the lesson's *quizzed* vocab items (MCQs etc.), not just context —
needs a small new injection in `generateOneLesson` + live tuning. Also open: whether "my story" can
optionally produce a pure review lesson-set (skip the story) — deferred (the story route reuses the
most and is the more rewarding framing).

### LLM-free progress-dependent drill lessons (MID/LONG-TERM)
Distinct from "my story" (which is LLM-generated): generate **review/drill lessons directly from
the learner's failed questions — with NO LLM step at all**. The data is already on hand: the
learned-vocabulary ledger (`APP.progress.learned["lang|srcLang"]`) tracks a per-word `wrong` count,
and the solved store tracks per-question `qid`s. A drill lesson would be assembled purely
client-side by pulling the high-`wrong` words (and/or unsolved qids) straight into the existing
exercise BUILDERS (`buildStandardExercises` etc.), which already turn `{target,source}` pairs into
MCQs / type-answer / order exercises without any model call. So this is fast, offline, free, and
deterministic — the natural complement to the coverage model.
Why it's compelling: unlike reinforce/extend (which weave words as *context*), this DRILLS the
exact words the learner got wrong as *quizzed* items, and needs no generation latency or model
tuning. It works even in the static (no-backend) build.
Sketch: a "review my mistakes" action that (a) collects the current pair's wrong words from the
ledger (weighted by `wrong`, padded with related known words so a short list still makes a full
round), (b) synthesizes an in-memory lesson `{type:'standard', vocab:[…]}`, (c) runs it through the
normal play UI. Could also become a coverage-aware "weak spots" round inside the mixed flow. Open
Qs: how many words per round + padding strategy; whether it persists as a saved lesson or is
ephemeral; how solving there feeds the solved store / clears the `wrong` flag once re-learned;
presentation (a button on the result card or the path). Depends only on shipped pieces (learned
ledger + solved store + builders) — no server work, no LLM. Good candidate for an early, low-risk
win when the user-progress track resumes.

### Milestone stories — "unlock" curated reading based on learned vocabulary (LONG-TERM)
As the learner's ledger grows, unlock hidden, human-authored (or curated existing) content in the
target language that they should now be able to read: short stories, essays, real short-form
literature, or pieces that summarize what they've learned / explain target-language concepts they can
now understand. Framed as LEARNING MILESTONES (a reward + a comprehension check at the edge of their
vocabulary). Data model sketch: a pool of curated pieces each tagged with a required-vocabulary set
(or a difficulty/known-word threshold); a piece unlocks when the learner's ledger covers ≥ X% of its
required words. Distinct from generated stories — these are vetted, `curated:true`, native-authored.
Open Qs: authoring/ingestion pipeline for the pieces + their vocab tags; unlock threshold; whether
unlocked pieces feed back into the ledger; presentation (a "library"/"bookshelf" of unlocked reading).
Depends on the learned-vocabulary ledger (shipped) and benefits from the cross-storyline content-qid
identity (see the design note under mixed lessons).

---

## OPEN — scripts

- **Hindi matras/conjuncts.** Basic Devanagari table shipped (44 letters, recognition only). Matras
  (positional vowel signs) and conjuncts (क्ष) need a different lesson type — larger effort, only if
  demand warrants.
- **Thai** — still the only empty stub in `scripts.json`. Fill the table (like the others) when
  wanted; same posture (native review of romanizations). Bounded, headlessly testable — a good
  small win.
- **Native review of romanizations** — Hangul, Hebrew, Arabic, Devanagari translits are
  high-confidence but worth a native pass. **NEW (v53): the eight `latin.sounds.*` columns**
  (arabic, cyrillic, greek, hebrew, devanagari, hangul, katakana, thai) need the same pass —
  especially Hebrew (niqqud), Greek digraphs (`μπι`/`ντι`) and Thai. See LIVE-TEST §68.
- **`sounds.han` column (v53 follow-up) — deliberately NOT authored.** `zh → han` is mapped but
  `latin.soundsFor` has no `han` column, so Chinese speakers are offered **no** Latin course rather
  than a circular one. Chinese is uniquely awkward: the phonetic system its readers already know
  (**pinyin**) is *itself written in Latin letters*, so the obvious answer key is circular. Options:
  (a) pinyin — dead on arrival, `B → b`; (b) **bopomofo/zhuyin** (`ㄅ` ≈ b) — a real non-Latin
  phonetic script, but standard in **Taiwan** while most `zh` users are PRC-schooled, and
  `languages.json` has a single `zh` entry (`tts: zh-CN`) with no `zh-CN`/`zh-TW` split to hang it on;
  (c) **Han transcription of the letter names** (`A → 诶`, `B → 比`) — consistent with the other eight
  columns, but there is no single standard, Han characters carry meaning so a purely phonetic reading
  is unnatural, and common lists include unfortunate choices (one renders **P as 屁**, "fart").
  Deeper point: a PRC-schooled reader **already recognises the letterforms** from pinyin — what they
  lack is the English letter *names* ("double-u"). That is a different lesson from "learn a new
  alphabet", and glyph→sound MCQ is the wrong shape for it. Gating it off is therefore a pedagogical
  choice, not just missing data. (Caveat: ja/ko readers also learn romanisation and we gave them
  columns anyway — romaji is a *secondary* system for Japanese, pinyin is *the* system for Mandarin
  and is Latin. Worth a native speaker's opinion before reversing.) Adding `"han"` to
  `latin.soundsFor` + a `sounds.han` column un-gates it automatically, no code change; the invariants
  above will enforce completeness/uniqueness/script.
- **Plan A — extend `letters[].sounds` to the OTHER tables (the "sounds extension").** Today only
  `latin` has `sounds`; every other table answers with its Latin `translit` (`ا → ā`), which
  implicitly assumes a Latin-reading learner. A Chinese speaker learning Arabic, or a Russian one,
  gets Latin answers. Fixing that is **pure data** — the builder's `localSound()` already resolves any
  column via `opts.srcScripts`, and callers already thread it. Adding `arabic.sounds.cyrillic` makes
  `ا → алиф` for a Russian reader with **zero code change** (verified).
  - **INVARIANT — `sounds` vs `soundsFor` are different things. Do not fuse them.**
    `sounds` is an *optional upgrade* (localize the answer, else fall back to `translit`).
    `soundsFor` is a *teachability gate* ("this table may ONLY be taught to these reader scripts").
    `latin` needs the gate because its fallback is circular (`A a → a`). Legacy tables must **never**
    declare `soundsFor` — doing so narrows their teachability and instantly breaks `en→ar`
    (demonstrated: the mutation makes `needsIntroScript('ar','en')` return false). `unit-intro-script`
    now derives the expectation from the data — *declare `soundsFor` iff the translit fallback is
    written in the table's own script* — so a future table gets the right treatment automatically.
  - **Enforced for every table** (`unit-intro-script`, "sounds/soundsFor invariants"): each column is
    complete (a hole silently falls back to translit), collision-free, never written in the script
    being taught, and actually written in the reader's script. Compared by Unicode **script property**
    (`\p{Script=…}`), not by the table's glyph list — hangul stores jamo (`ㄱ`) while its answers are
    composed syllables (`에이`), which share no codepoints. A new table must be added to `SCRIPT_PROP`
    or the test fails. All six failure modes are mutation-tested.
  - **OPEN DESIGN Q — names vs sounds.** The answer key must be letter **names**, not phonetic values.
    Arabic's `translit` stays unique only via diacritics (`s/ṣ`, `t/ṭ`, `h/ḥ`, `d/ḍ`, `z/ẓ`); render the
    *sound* into a script without them and **10 of 28 letters collapse into 5 ambiguous pairs** (the
    uniqueness assertion would reject it). Arabic letter *names* are unique 28/28 (`alif, bāʼ, …`), so
    `алиф / ба / та` works. But that changes the quizzed skill: an English reader is asked for the
    sound (`ā`, hinted `ā (alif)`), a Russian reader would be asked for the name. Resolve this — and
    whether a localized *name* hint column is also wanted — before authoring more columns. (Note the
    builder currently suppresses the `(name)` hint whenever the answer is localized.)
  - **Cost/value.** 8 teachable tables × 8 reader scripts × 22–46 letters ≈ 1,900 cells, each needing
    native review. Value is thin where the reader is Latin-literate anyway (most ru/el/ko/ja readers),
    and highest for readers with no Latin schooling. Unlike `latin`'s columns — which fixed something
    outright broken — this fixes something merely inelegant. **Scope a single pair first**
    (e.g. `arabic.sounds.cyrillic` or `arabic.sounds.hebrew`); the invariants above are already live.
  - Original framing (kept): a per-(script, letter, UI-lang) pronunciation matrix sourced from
    CLDR/ICU + LLM + native review, so the letter can also be *spoken* accurately per UI language.

---

## OPEN — larger tracks (carried, not scheduled)

- **`examples.json` stock via batch-gen + QC** ("greetings and introductions" seed) — Priority 1 in
  the v48 roadmap. Generate a stock set offline, QC-gate it, measure `_genMeta` quality on a weak
  model. (Partly gated on §0 — batch-gen quality wants a live weak model.)
- **Map-tree UI on the main page** — Priority 2 (visual topic tree).
- **Platform track** — Priority 3, large; see `platform_plan.md`. Keep client↔server coupling from
  deepening so a future clean API boundary stays feasible.
- **QC coverage — remaining work.** v49 added grammar + conjugation (translation pair). Still open:
  a dedicated **article/plural** correctness check for grammar and a **per-form conjugation**
  correctness check (both need new prompts, best tuned against a live model). `math` and the two
  error-hunt types stay intentionally out of scope.
- **Static-build flag handling — content-merge review UI.** Beyond flags-only merge, support merging
  a re-import with a review UI (TODO later).

---

## Tech debt
- ~~**Version drift in `build-static.js`.**~~ ✅ Fixed in v49 — the static build parses `APP_VERSION`
  out of `server.js` at build time and interpolates it into both spots. Guarded by
  `unit-version-derivation`. A single `server.js` bump + `build-static.js` re-run now suffices.
- **Three "set done"/visibility checks were duplicated** → consolidated into `lessonCountsFor` /
  `countedLessons` / `setComplete` in v48. If a new visibility rule is added, change it there only.
- **Orphaned `ui.json` keys (general cleanup).** As of v49, `tts.voice_search` ("How to get better
  speech output") is the one remaining unreferenced key — kept for potential reuse. (Its siblings
  `tts.voice_warn_q` and `tts.voice_mute_hint` were reused as the sound-test Test/Mute tooltips.)
  When doing a general ui.json clean, sweep for any other keys not referenced in `index.html` /
  `server.js` / `build-static.js` and drop them across all languages in one pass.

---

## Reference docs (build_history/)

## OPEN — dialect: evaluated ideas from dialects.md (not yet scheduled)
Reviewed the alternative architecture in `build_history/dialects.md` (GPT-5.3: "symbolic conversion
should dominate, LLM creativity secondary"). Not adopted wholesale — its clean deterministic
standard→dialect swap assumes a lexicon-only dialect + grammar transform rules we don't have (East
Tyrolean has Slavic vocabulary and divergent morphology; only a glossary exists). Worth trying/
considering:
- **Standard→dialect REWRITE prompt (middle path):** generate a Standard-German story on the topic,
  then have the model REWRITE it into dialect using the glossary as a hard substitution reference,
  changing as little else as possible (LLM as constrained post-processor, not free author). More
  constrained than the current direct dialect authoring; worth a live A/B vs the current M2 output.
- **Deterministic "convert standard → dialect" exercise (zero-LLM):** the glossary already has both
  sides — a pedagogically strong, hallucination-proof exercise type built purely from the table.
- **Layered item storage `{dialect, standard, english}`** (vs the current 2-way `{target, source}`):
  keeps the English pivot for cross-referencing. Cheap, future-useful.
- **Glossary for distractors / difficulty / SRS grouping:** use the table for wrong-answer MCQ
  options, difficulty estimation, spaced-repetition grouping — not just vocab items.
- **Variant modeling `{standard, dialectVariants:[]}`:** relevant once the mein-osttirol.rocks data
  (Region/Gemeinde columns, 1165 entries) arrives — pending a permission email to its operators
  (info@mein-osttirol.rocks). Do NOT import until permission is on file.
- **Derive trusted lessons from an APPROVED dialect story** (optional, once story quality is good).
