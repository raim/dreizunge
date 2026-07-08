# Roadmap v53

**v52 shipped.** This file supersedes `roadmap_v52.md` (now historical). It carries the session
protocol (unchanged) and every still-open item forward. Start a fresh session by reading this file,
then `LIVE-TEST-CHECKLIST.md`, then the latest `v*_session*_notes.md`.

**v52 (one session) shipped:** runtime **user-selectable LLM** — per-role model dropdowns
(Story / Lessons / Translation) populated from Ollama (`/api/models`), runtime-mutable model roles,
auto-derived lesson format, and structured per-artifact model provenance in `generationStats`; plus
**reasoning-model hardening** (`stripThink` strips `<think>` CoT at the transport layer, fail-clean
on truncated reasoning); plus first headless coverage of the previously-untested **table lesson
format** and **split-translation** paths. Details: `v52_session1_notes.md`. Browser/Ollama pass owed:
LIVE-TEST §§58–59. **Still owed:** TranslateGemma i18n pass on the new `models.*` keys, and v46
phases 3–4 (per-button model popup + prompt preview/edit) remain OPEN — see "Deferred" below.

> ## ▶ START HERE NEXT — LLM-free progress-dependent drill lessons ("review my mistakes")
> **Recommended next task (chosen with user).** Build the deterministic, no-LLM "drill the words you
> got wrong" feature. Full sketch is under **OPEN — user progress → "LLM-free progress-dependent
> drill lessons"** below; read that section in full before starting.
>
> **Why this one:** every dependency is already SHIPPED and tested — the learned-vocabulary ledger
> (`APP.progress.learned["lang|srcLang"]` with per-word `wrong` counts), the solved store + stable
> `qid()`s, and the exercise builders (`buildStandardExercises` turns `{target,source}` → MCQ / type /
> order with no model call). Nothing here is blocked on the live-model verification that gates almost
> everything else. It's deterministic, offline, works in the static build, and is fully
> headless-testable. It also closes a real loop: the ledger records wrong words but **nothing consumes
> them yet** — this is the payoff.
>
> **What it does:** a "review my mistakes" action collects the current pair's high-`wrong` words from
> the ledger (weighted, padded with related known words so a short list still fills a round),
> synthesizes an in-memory `{type:'standard', vocab:[…]}` lesson, and runs it through the normal play
> UI. Drills the exact wrong words as *quizzed* items (vs "my story", which only weaves them in as
> context).
>
> **Two design calls already made (start here, don't re-litigate):**
> 1. **Ephemeral, not saved** — build the lesson in memory (like a mixed round); avoids a
>    data-migration decision. (Persisting it can be a later choice.)
> 2. **Solving there feeds the existing solved store** — reuse the normal `qid()` path so a
>    drilled-and-solved word counts toward coverage like any other question, and re-learning a wrong
>    word can clear/decrement its `wrong` flag.
>
> **Definition of done (per the protocol below):** a unit test for the wrong-word collection +
> padding + in-memory lesson synthesis; wire the entry point (a "review my mistakes" button on the
> result card or path — pick the smaller surface first); full suite green + `check-inline` 0; en-only
> ui.json key(s) for any new button/label; rebuild static if client/baked data changed; a
> LIVE-TEST-CHECKLIST entry for the browser-only play-through. Keep it additive — it must not change
> existing progression behavior.
>
> **Alternative small win if you want something even more self-contained:** fill the **Thai** script
> table (the only empty stub in `scripts.json`) — bounded, headless, same posture as the other
> scripts.

> ### ℹ️ Note — the drill feature above is STILL the recommended next task (untouched).
> The v52 point releases (v52_b … v52_e) shipped model selection, reasoning hardening, a batch of
> live-testing fixes, three UI changes, and a dedicated QC model role — all user-chosen. The
> deterministic "review my mistakes" drill remains unbuilt and is the recommended next pickup.

## What shipped in v51 (summary)
The **East-Tyrolean dialect track**, built end-to-end on top of the v50 progression/personalization
release, plus follow-up fixes from live testing:
- **Faithful glossary import (M1):** `dialect-glossary.js` (deterministic, zero-LLM, isomorphic) —
  `parseDialectGlossary` (delimiter detection incl. `=`, license/header skip, verbatim rows,
  duplicate reporting, collided-row SURFACED-not-split) + `buildDialectTopic` (rows → a playable
  dialect topic; lang===srcLang===de; `_dialect` markers; attribution). `/api/dialect-import` +
  the "🗣 Dialect" panel (paste/upload → build → plays as normal vocab lessons). Osttirol material
  (Bernd Kranebitter, CC BY-NC, with permission — see `ATTRIBUTIONS.md`).
- **sourceOnly QC:** `qcCheckDialectPair` verifies only the German gloss and can never rewrite the
  dialect token; `_runQc` routes `_dialect` items to it. AI-generated dialect content instead gets
  full both-side QC.
- **Muted dialect audio:** dialect has no authentic voice, so listen exercises are dropped for
  dialect, `speak()`/`speakBodyText()`/`lBlock`/story buttons are silenced/hidden, and the
  source→target MCQ drops the "{lang}" (naming German is wrong when the answer is the dialect word).
- **Topic-driven gated stories (M2):** `generateDialectStory` takes a TOPIC + free-text
  INSTRUCTIONS (e.g. "Bavarian-style"), few-shot-grounded in the glossary. Story generation is the
  review sample (always `aiGenerated`+`needsReview`); `/api/dialect-curate` approves the story a
  human read; a new story resets approval. The "🗣 dialect studio" strip drives it. The per-word
  example generator (M1.5) was tried and RETIRED — incoherent; topic-driven stories read far better.
- Reviewed `dialects.md` (an alternative "generate-standard-then-transform" architecture): captured
  as evaluated ideas below, not adopted wholesale (East Tyrolean has Slavic vocab + morphology a
  glossary-only swap can't cover).
APP_VERSION = v51; docs rebuilt. New en-only i18n keys owed to the translate pass: `form.use_dialect`,
the `dialect.*` set, `tts.approx_dialect`, `ex.mcq_source_target.q_nolang`,
`ex.badge.mcq_source_target_nolang`, `ex.type_translate.q_nolang`. Browser checks owed: LIVE-TEST
§§51–55.

## ✅ Model selection + reasoning-model hardening (SHIPPED in v52)
The v46 "per-task model selection" major, phases 1–2, plus reasoning-model safety. Details in
`build_history/v52_session1_notes.md`. Browser/Ollama verification owed: LIVE-TEST §§58–59.

**v52_b (session-2 live-testing fixes, `v52_session2_notes.md`):**
- `parseTableLesson` was leaking the header row as the first vocab entry for non-ASCII target
  language names (Lëtzebuergesch → ë broke the ASCII `\w+` header match), also dropping a word and
  sometimes the sentence table. Rewrote it structure-anchored (header = row before the `|---|`
  separator). Covered by `unit-table-lesson` + a non-ASCII `e2e-models` fixture. LIVE-TEST §60.
- Synonym/antonym solution reveal now shows each correct word's exact translation (a `glossMap` on
  the exercise + `synRevealHtml`, both reveal sites). `unit-synonyms` extended. LIVE-TEST §61.
- Identical source/target check now logs the offending items to the console and no longer blocks
  CLOSE language pairs (`isCloseLangPair`: dialects `lang===srcLang` + a curated `CLOSE_LANG_PAIRS`
  list incl. de↔lb). `unit-close-lang-pairs`.

**Version note:** post-v52 point releases are numbered v52_b, v52_c, … (per user). Current: **v52_g**.
At the next MINOR/feature cut, resume vNN numbering (v53) and write `roadmap_v54.md`.

**v52_f/v52_g (QC model provenance + collect-and-compare):** QC results are stamped with the model
that produced them (`item.qc.by`, `ls.qcBy`; QC logs now show the QC model). The lesson editor shows
"<model> suggests:" per flag. v52_g adds **collect-and-compare**: verdicts are collected per model in
`item.qcByModel` so multiple QC models can be compared on the same item (a model overwrites only its
own entry; OK drops only its own flag; `item.qc` stays the primary; old flags migrate). The QC skip is
now per-model (`ls.qcBy === OLLAMA_QC_MODEL`) so a second model still runs; the editor renders one row
per model (`qcSuggestRows`). Tests: `unit-qc-dispatch`, `unit-qc-collect`, `unit-qc-editor-label`.
LIVE-TEST §66.

**v52_e (dedicated QC model role):** QC no longer shares the `OLLAMA_TRANSLATION_MODEL` knob with the
story-translation panel. New independent `OLLAMA_QC_MODEL` role (defaults to the translation model;
`callLLMQC`; the four `qcCheck*` functions repointed to it), a fourth "QC" dropdown in the model
picker, `POST /api/models {qc}` + `/api/info.ollamaQcModel`. This resolves the shared-knob limitation
(you can now run the story translation on qwen while QC-checking Lëtzebuergesch pairs on
translategemma). Tests: `e2e-models` (independent qc switch), `unit-model-picker` (4th selector +
`models.qc`). LIVE-TEST §65. Realises the `OLLAMA_QC_MODEL` idea sketched in roadmap_v46.

**v52_d (session-4 UI changes, `v52_session4_notes.md`):** answer-feedback motion (rise-up on correct /
fall-down on wrong, replacing the sideways shake); mixed-lesson cards preview the source lessons' icons
(`mixedSourceIcons`); story-style background themes v1 (`STORY_THEME_GRADIENTS`/`storylineThemeKey`/
`applyStorylineTheme` — auto from the first chapter's style; manual/LLM picker deferred, see above).
Tests: `unit-ui-feedback-mixed-icons`, `unit-storyline-theme`. LIVE-TEST §64.

**v52_c (session-3 live-testing fixes, `v52_session3_notes.md`):** removed the non-functional QC
looking-glass on AI error hunt; runtime request-timeout control (input next to the model dropdowns;
`setRequestTimeout`/`getRequestTimeout`, `POST /api/models {timeoutMs}`); generate-time
model-suitability warning (`modelSuitabilityWarning`, `LOW_RESOURCE_TARGET_LANGS`); dialect-from-
glossary now requires several glossary words (prompt + V2 coverage-gated retry); stricter
synonyms/antonyms substitutability (prompt). Tests: `unit-prompt-strictness` (new), `unit-model-picker`
+ `e2e-models` + `unit-static-teacher` extended. LIVE-TEST §63.
- **Reasoning-model hardening.** `llm.js` `stripThink()` strips a model's `<think>…</think>`
  chain-of-thought (closed pairs, orphan-close, orphan-open/truncated) at the transport layer, so it
  can never leak into a story/translation/JSON. Truncated-only-reasoning now fails clean instead of
  saving garbage. (`unit-strip-think`; LIVE-TEST §58, Ollama-only.)
- **Runtime model picker.** Model roles are now runtime-mutable (`const`→`let`, live-read;
  `setRuntimeModels`/`currentModels`), lesson format re-derived per switch. `GET/POST /api/models`
  (list + switch, validated against installed models). Three per-role dropdowns (Story/Lessons/
  Translation) in the backend row, ollama-only, live-only (inside `@static-exclude`).
  (`unit-model-picker`, `e2e-models`; LIVE-TEST §59.)
- **Structured provenance.** `generationStats.models = {story, translation, lessons}` records the
  model actually used per artifact (legacy collapsed `model` label kept).
- **Closed two never-tested gaps** (user-flagged): the table lesson format (`parseTableLesson`) and
  the split-translation path — both now covered by `e2e-models` (fake-ollama gained a table branch,
  a translation branch, and multi-model `/api/tags`).
- **New en-only i18n keys (owed to the TranslateGemma pass):** `models.story`, `models.lessons`,
  `models.translation`, `models.switched`, `models.switch_failed`.
- **Still OPEN (v46 phases 3–4, deferred):** a per-BUTTON model popup (pick the model for a single
  call) and prompt preview/edit before send. Optional refinements: `think:false` + reasoning-aware
  token budgets to make reasoning models first-class; persisting the model choice across restarts
  (currently in-memory); releasing the previous model from VRAM on switch. For dialect/Lëtzebuergesch
  splits, note the v32 guidance (generate in German, then translate → so Story=qwen(de) +
  Translation=translategemma may beat translategemma authoring directly).

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
2. **LIVE-TEST-CHECKLIST.md** — if the change is browser-only or Ollama-only (UI, RTL, TTS,
   rendering, anything not exercisable headlessly), ADD a numbered section describing exactly what
   to click and what to expect. *This is the one most often forgotten.* Anything you label
   "browser-verify owed" in notes MUST have a matching checklist entry.
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


---

## OPEN — near-term (do these next)

### 0. Browser / Ollama verification pass — IN PROGRESS (user)
The interactive checklist (`LIVE-TEST-CHECKLIST.md`) is the gate. Browser-only sections need only
the static build; the Ollama sections need a local model. **Expect to tune the QC prompts** —
qwen2.5:7b (and similar small models) are unreliable on "is this distractor also valid?" and
synonym/antonym judgments. **New in v49 to verify:** §§41–45 (order RTL, word_forms/synonyms RTL,
sound-test row incl. tooltips + flag-follow, motto, QC-skip incl. shift-click force). Also verify
the v49 **QC coverage expansion** live: grammar + conjugation lessons now get flagged, and the
flags render/dismiss in their editor branches — watch for false positives from a weak model.

### 1. UI translation re-pass with TranslateGemma — OWED (user)
The v48-b pass filled the missing keys (0 missing across 29 langs at v49 start). Still owed: run the
pass on the **six new v49 en-only keys** listed above. The script-bleed sanity check (Chinese into
Korean/Hebrew, Cyrillic into Arabic under the old qwen model) is in the v48-b/v49 notes if it needs
re-running on the next ui.json.

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
  high-confidence but worth a native pass.
- **Plan A — multi-language transliteration/sound matrix.** Speak an accurate *pronunciation* per
  (script, letter, UI-language) via a per-(script, letter, UI-lang) matrix in scripts.json, sourced
  from CLDR/ICU + LLM + native review. Big data effort; deferred.

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
