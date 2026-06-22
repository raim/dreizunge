# Dreizunge — roadmap v46

State at start of this roadmap: app is **v45** (server `APP_VERSION = 'v45'`,
exposed via `/api/info` + a visible label, in both the live and static builds). All
v45 majors are shipped and the headless suite is green (29 test files). This roadmap
is written to hand the project to a **fresh session or a different code-LLM tool**, so
it front-loads orientation, then the v46 work, then the carried-over open items.

Read `build_history/roadmap_v45.md` for the full history of what already exists; this
file does not repeat it. `build_history/LIVE-TEST-CHECKLIST.md` lists everything that
still needs a real browser / real Ollama to verify (the headless suite cannot).

**v46 majors at a glance** (detailed below): (A) per-target-language prompt examples;
(B) unify lesson types into a registry — a cleanup that also enables (C); (C) mixed-type
review lessons assembled with NO LLM from a chapter's existing questions. B-phase-1 (the
client builder registry) is the prerequisite for C. A is independent. (D) storyline-wide vocabulary learning arc builds on the existing arc pipeline; its ambitious forward-pre-seeding phase is gated by lemmatization. (E) batch-generate a simple topic across all languages (with generation stats) + QC the output via a stronger local model or a manual export-to-frontier round-trip; its E0 stats-capture is a cheap enabler also useful on its own. (F) user-uploaded dictionaries to ground/replace generation for dialects & low-resource languages; (G) a world-map + language-tree first page (prototype in uploaded map.html) where src→tgt paths are coloured by existing lessons and by batch-gen QC health — G(b) depends on E. D also gains a progress-dependent review dimension (repeat words the user got wrong).

---

## Orientation (read before touching anything)

**The app.** A self-hosted, zero-dependency Node language-learning app. Node v22, no
npm runtime deps. One backend file and one client file:

- `server.js` (~3k lines) — HTTP server, routes, all LLM lesson generators + their
  pure validators. Talks to a local Ollama. Runs the show in the **live** build.
- `index.html` (~8k lines) — the entire client app in one inline `<script>`. The play
  UI, the lesson editor, storyline screens, generation forms.
- `build-static.js` — bakes `docs/index.html`, a **server-less** GitHub-Pages build.
  It slices the client engine out of `index.html`, drops the server/LLM parts, bakes
  lessons into a `STATIC_LESSONS` global, and appends static-specific overrides.
- `prompts.json` — every LLM prompt, keyed (`vocab`, `grammar`, `conjugation`,
  `wordForms`, `synonyms`, `story`, `math`, …). Hot-reloaded by the server on change.
- `ui.json` — UI strings, 29 locales. **New strings go in the `en` block only**, are
  rendered via `t()`, and are translated later by a separate flow. Hot-reloaded.
- `lessons.json` — the data store (topics, storylines, flags).
- `test/` — the headless harness (`node test/run.js`). Unit tests extract a function
  out of `server.js`/`index.html` by brace-matching and run it in a `new Function(...)`
  sandbox; e2e tests boot the server against `test/fake-ollama.js`. See `test/README.md`.

**Two big mental models you must hold:**

1. **`{L}` = target language (being learned), `{S}` = source language (the learner
   already speaks).** Prompts and examples use these placeholders. Generators pass the
   real codes in. Almost every lesson is bilingual: target content + a source-language
   translation/gloss.

2. **The static build is a *slice*, not a copy.** `build-static.js` takes
   `part1 = lines[0 .. "async function init()")` and
   `part2 = lines["function buildPath(" .. "init();")`. Everything **between**
   `async function init()` and `function buildPath(` (server/LLM functions) is
   **excluded** from `docs`. *Any client helper that `buildPath` (or anything reachable
   in static) calls at render time MUST be defined at or after `function buildPath(`*,
   or it is silently dropped from `docs` and the static page throws a `ReferenceError`
   (this exact bug blanked the static lessonset page in v45 — `_canEdit` /
   `_chapterNeighbors` had landed in the excluded gap). `test/unit-static-teacher.js`
   guards their placement; respect it. When adding a client helper used in static,
   define it **after** `buildPath`, and rebuild + smoke-check `docs`.

**Teacher mode & editing gates.** `APP.info.canGenerate` is true only when the LLM
backend is present (false in static). `APP._teacherMode` toggles editing. Non-LLM edit
affordances are gated by `_canEdit()` (= `canGenerate || _teacherMode`); LLM-only
affordances stay gated by `canGenerate` alone. Lesson-edit persistence routes through
`_postLessonEdit()`, which POSTs in live and no-ops locally in static (edits ride the
JSON export because `APP.lessonData` references the same objects `STATIC_LESSONS` /
`exportTopics` serialize).

## Standing workflow (unchanged from v45 — follow it every change)

Per change: new UI strings → `ui.json` `en` only, via `t()`. Then run, in order:
`node --check server.js`; `node test/check-inline.js index.html` (must report 0
failures); if the client changed, `node build-static.js lessons.json docs`; then
`node test/run.js` (must print `ALL CHECKS PASSED`); then commit, focused. Be explicit
in the commit/notes about what is **headless-verified** vs what needs a **live
browser/Ollama** (the latter goes in `LIVE-TEST-CHECKLIST.md`). When delivering, copy
the tree (excluding `.git`) into `dreizunge_v45/` (or `_v46/`), re-verify the suite
*inside the copy*, `zip` it, copy to the outputs dir, and present the zip.

**Validator philosophy (important for v46).** The lesson validators are now
**salvage-oriented**, not reject-on-first-flaw — small local models (qwen2.5:7b etc.)
produce malformed-but-fixable output. `validateWordFormsItems` (server.js) dedupes
choices, auto-inserts a missing `___` blank when the answer is present, trims over-long
choice sets, and does **not** hard-reject on story-grounding (it is a prompt preference
now). It still rejects genuinely broken items. Keep this stance: prefer salvage +
prompt nudges over strict gates.

---

## v46 major — per-target-language prompt examples

**Motivation.** Prompts currently carry a single *worked example* written in English
(as `{L}`). Strong models infer the format fine, but **small self-hosted models lean
heavily on the example's language**, and morphologically distant / non-Latin targets
(German/Russian/Finnish cases, Japanese/Arabic scripts) suffer most. A same-language
example should measurably improve weak-model output for the morphology-heavy lessons.
This is a *targeted* improvement, not a global rework.

**Scope — which prompts.** Only prompts whose worked example's *language* matters:
`wordForms` first (it has GOOD/BAD worked examples and just caused repeated weak-model
failures), then optionally `conjugation`, `grammar`, `synonyms`. **Do not** localize
`math` (language-neutral) or `vocab`/`story`/`translation` (the example conveys format,
not language).

**Key caveat — it is a 2-D matrix; localize only one axis.** Worked examples use both
languages (e.g. the word_forms example is an English sentence **plus** a German
translation). Fully localizing both is target × source ≈ 29×29 ≈ 800 combos —
infeasible. **Localize only the `{L}` (target) half** (the morphology demonstration);
keep the `{S}` (learner) half abstract ("…translated into {S}…") or a single
representative. "Target-language examples" means the `{L}` half only.

**Recommended architecture — do NOT split prompts.json into per-language files** (that
fragments the single source of truth and complicates hot-reload). Instead keep one
file and add an optional per-prompt `examples` map with a `default`, injected via an
`{EXAMPLE}` placeholder in the `system` string:

```jsonc
"wordForms": {
  "system": "…rules… {EXAMPLE} …",
  "examples": { "default": "<EN worked example>", "de": "<DE>", "ru": "<RU>" }
}
```

The prompt builder substitutes `examples[targetLang] || examples.default` for
`{EXAMPLE}`. This is additive and backward-compatible: a prompt with no `examples`
block, or a target with no entry, falls back cleanly. Only the in-scope prompts get an
`examples` block. (Find the existing prompt-loading/substitution code in `server.js` —
search where `{L}`/`{S}` are replaced — and add the `{EXAMPLE}` substitution there.)

**Quality gate (use the validators we already own).** A *wrong* localized example
(fake word, wrong gender) is worse than a clean English one. Add a unit test that runs
every localized `wordForms` example through `validateWordFormsItems` so a structurally
malformed example fails the suite. This checks **form**, not native correctness —
native/pedagogical quality still needs human review for the seed languages, so
hand-seed those, don't auto-generate them blindly.

**Phasing (don't boil the 29-language ocean):**
1. Add the `{EXAMPLE}` placeholder + builder substitution + `examples.default` for
   `wordForms` only, with the current English example as `default`. Suite stays green,
   zero behavior change. Ship this first — it's the safe refactor.
2. Add a small **seed set** of high-value targets the user actually uses (at least
   `de`; add one non-Latin if relevant). Each seed example is hand-written and
   validator-gated.
3. Measure (live, with the small model) whether the seed helps. Only then expand to
   `conjugation`/`grammar` and more languages.

**Alternative worth keeping in mind:** a *generate-once-validate-cache* path — have the
model draft an example for a new target, run it through the validator, cache it. It
bootstraps coverage cheaply but only guarantees *valid*, not *good*; still hand-seed the
languages that matter.

---

## v46 major — unify lesson types into a registry

**Motivation.** Cleanup, more flexibility for LLM-based generation, and the **enabler
for mixed lessons** (next section). Today each lesson type is a near-independent
vertical smeared across the codebase:
- `server.js`: a `generateX()` + (often) a `validateX()` per type
  (`generateGrammar`, `generateConjugation`, `generateWordForms`, `generateSynonyms`,
  `generateMath`/`generateMathLLM`, `generateErrorHunt`, …), plus the add-lesson route
  switching on `fmt`.
- `index.html`: a client builder per type (`buildVocab…`, `buildGrammarExercises`,
  `buildConjugationExercises`, `buildMathExercises`, `buildSynonymsExercises`,
  `buildWordFormsExercises`) dispatched by an if-chain in **`buildExercises(lessonIdx)`
  (~line 6139)**; a **19-branch `else if(ex.type===…)` chain in `renderEx`**; a
  **9-branch `} else if (ls.type === …)` chain** across `renderLessonEditor` /
  `saveLessonEdits`; plus picker / add-lesson wiring.
- A partial registry already exists: **`LESSON_TYPE_META` (~line 1053)** +
  `lessonTypeMeta()` (1064) — extend this, don't invent a parallel one.

**Target.** One registry entry per type declaring all its hooks, e.g.
`{ label, icon, needsLLM, pickerVisible, server:{generate,validate}, client:{build,
renderEx, editorBranch} }`. The four dispatchers (`buildExercises`, `renderEx`,
`renderLessonEditor`, server add-lesson) become registry lookups instead of hand-kept
chains, so **adding or composing a type touches one entry**, and the "I added a type
but forgot the editor / static slice" failure mode disappears.

**Phasing (refactor — behavior must stay identical, suite green after each step):**
1. **Client `build` registry** — replace the `buildExercises` if-chain (6139) with
   `lessonTypeMeta(type).build(lesson, …)`. This is the *minimum slice that unblocks
   mixed lessons*, so do it first.
2. **`renderEx` registry** — fold the 19-branch `ex.type` chain into per-type
   `renderEx` hooks.
3. **Editor registry** — fold the 9-branch `ls.type` chain (and `saveLessonEdits`)
   into per-type `editorBranch` hooks.
4. **Server `generate`/`validate` registry** — route the add-lesson handler through it.

**Caveats.** Honour the **static-slice rule** (registry + any builder reachable in
static must be defined *after* `function buildPath(` — see Orientation). Keep it a pure
refactor: no behavior change, `node test/run.js` green and `check-inline` at 0 after
every step. Do one dispatcher at a time; don't big-bang all four.

## v46 major — mixed-type review lessons (NO LLM)

**Motivation.** More variety and review from content already generated, with **zero
model calls** — works offline and in the static build. This is composition, not
generation.

**What it is.** A new `mixed` lesson type. At **play time** it gathers the **sibling
lessons in the same chapter/lessonset** (`APP.lessonData.lessons`), skips itself and
any `_hidden` ones, runs **each sibling's existing exercise builder** (via the #1
registry, or the `buildExercises` dispatch at 6139 in the interim), pools the
exercises, samples a **balanced** set (round-robin or N-per-type), shuffles, and
presents them as one lesson. It invents nothing — it reuses the questions already
associated with the chapter, one (or a few) from each lesson type.

**Storage.** Keep it a **lightweight reference**, e.g.
`{ type:'mixed', title, perType:N }` (optionally explicit source ids), and resolve the
exercises **dynamically at play time** so a mixed lesson always reflects the current
sibling content. **Do not** bake the exercises into the stored lesson — they'd go stale
when a source lesson is edited.

**Surfaces.**
- Add-lesson: a "Mixed review (this chapter)" option — instant, no LLM, available even
  in static teacher mode (gate via `_canEdit()` like other editing, but generation
  itself needs no backend).
- Play: `buildMixedExercises(lesson)` → resolve siblings → build per type → balanced
  sample → shuffle. (Define it *after* `buildPath` for the static slice.)
- Editor: a mixed lesson owns no content, so show it **read-only** — which types/counts
  it draws from — with delete + flag.

**Flagging synergy + the one gotcha.** `_exFlagTarget(ex)` already maps a played
exercise back to its source item by content — but it currently only searches the
**active** lesson (`APP.cur.lessonIdx`). For a mixed lesson the active lesson owns no
items, so flags would fall to `_miscFlags`. Fix: tag each pooled exercise with its
**source lesson index** when building the mix, and have `_exFlagTarget` honour that ref
(falling back to the content scan) so a flag on a mixed exercise lands on the real
source lesson's item.

**Dependency.** Needs only **phase 1 of the unify work** (the client `build`
registry). It *can* be built against the existing `buildExercises` dispatch first and
retrofitted to the registry — but doing unify-phase-1 first is cleaner.

**Caveats.** Exclude hidden lessons; de-dupe pooled exercises; degrade gracefully when
a chapter has only one lesson type (mix == that type); keep it working in static (it
must, since it's LLM-free).

## v46 major — storyline-wide vocabulary learning arc (LLM + analysis)

**Motivation.** Today reinforcement is **chapter-local and backward-only**:
`collectChainVocab(startRef)` (server.js ~228) gathers the *immediately prior*
chapters' vocab, and the generators (`generateGrammar`/`generateSynonyms`/
`generateConjugation`, via `opts.chainVocab.{nouns,verbs,words,sentences}`) sprinkle a
few of those earlier words into the next chapter. There is **no plan over the whole
storyline**. The ask is to reason across the *entire* storyline and build a real
**vocabulary curriculum**: (a) **pre-seed** a word that first appears naturally in a
later chapter into an *earlier* chapter's vocab **where it fits the content**, then
(b) **deeply reinforce** it later — at/after its natural appearance — with
synonyms/word_forms lessons, with **spaced** review in between.

**What's missing vs. what exists.** Plumbing that exists and should be reused: the arc
job pipeline (`_runRecreateJob`/`_runBookJob`, `arcMode`), `chainVocab` threading, and
`findContextSentence`. Genuinely new pieces:
1. a **whole-storyline corpus map** (a word→chapters index: where each lemma appears,
   frequency, first/peak chapter, difficulty);
2. a **scheduling policy** (introduce-early + spaced/expanding-interval review + deep
   reinforcement near natural appearance);
3. **forward** placement (current chaining is backward only);
4. a **content-fit gate** for pre-seeding (may a later word plausibly appear in this
   earlier chapter?) — an LLM or embedding judgment;
5. **lemmatization** so "the word appears later" survives inflection (German cases,
   conjugations, etc.).

**Architecture sketch (three passes, server-side; it's an LLM/analysis feature, not
static).**
- **Pass 1 — corpus map.** Over the storyline's ordered chapters
  (`storylines[].chapters`), collect each chapter's `{story, vocab}` and build the
  lemma→chapter index + frequencies. Group per (target,source) language for
  mixed-language storylines.
- **Pass 2 — plan (the arc).** For each *key* word choose: an introduce-chapter
  (≤ first natural appearance, only moved earlier if content-fit passes), a spaced
  review schedule (expanding intervals), and a deep-reinforce chapter (synonyms/
  word_forms) near its natural/peak appearance. Emit a per-chapter plan:
  `{chapter → {introduce:[…], review:[…], deepReinforce:[…]}}`.
- **Pass 3 — generate.** Drive the existing generators from the plan (vocab seeded with
  planned words; word_forms/synonyms targeting the deep-reinforce set), reusing the
  recreate/arc job machinery rather than a new generation path.

**Phasing (de-risk; most value is in the deterministic middle).**
0. **Plan preview (non-destructive).** Build the corpus map + a proposed schedule and
   just *display* it ("vocabulary arc preview") — no lesson changes. Makes the whole
   idea inspectable and tunable before it touches data. Low risk, high insight; do first.
1. **Spaced backward review (deterministic).** Generalize `chainVocab` from
   "immediately-prior" to an expanding-interval review schedule across the storyline.
   No content-fit LLM, no lemmatization gymnastics for the easy (surface-match) cases —
   high value, low risk.
2. **Deep-reinforcement placement (deterministic).** Use the corpus map to place
   word_forms/synonyms lessons for a word near its peak appearance.
3. **Forward pre-seeding with content-fit (ambitious, opt-in, LAST).** Introduce later
   words early where an LLM/embedding check says they fit. Highest risk and cost.

**Risks / hard dependencies.**
- **Lemmatization** is the cross-cutting blocker (shared with the German
  adjectival-nouns problem) — surface-form matching misses inflected reappearances.
  Phases 0–2 can lean on surface + simple stemming; phase 3 needs real lemma grouping.
- **Content-fit is fuzzy and costly** — naive scoring is O(words × chapters) LLM calls;
  bound it (key words only, nearby chapters only), and be conservative (a bad pre-seed
  feels random — better to skip than to force).
- **Stability/idempotence** — re-running the planner must not reshuffle the whole
  storyline each time.
- **"Key vocabulary" selection** — needs a heuristic (content words, frequency,
  difficulty), not every token.

**Progress-dependent review (the arc adapts to the learner).** Beyond the static,
corpus-derived schedule, the arc should weight reinforcement by the learner's **own
history**: words the user has answered **incorrectly** are repeated sooner and more
often (classic spaced repetition with a per-item ease that drops on a wrong answer).
Prerequisite: a **per-item attempt/correctness store** — the app currently tracks
lesson-level progress, not per-item right/wrong over time. Add a lightweight
`progress[itemKey] = { seen, wrong, lastAt, ease }` (client/localStorage in live,
in-memory in static), keyed the same way `_exFlagTarget` maps an exercise to its source
item. This same store also powers a **"review my mistakes" mixed lesson** — pure
client-side, no LLM (synergy with the mixed-type lessons major). Order: land the
deterministic corpus schedule (phases 1–2) first, then layer the progress signal on top
once per-item history exists.

**Opinion.** Worth it as a real differentiator, but it's research-y and multi-phase.
Phases 0–2 (a previewable plan + deterministic spacing + reinforcement placement)
deliver most of the pedagogical value with low risk and no fuzzy judgments; phase 3
(forward pre-seeding) is the ambitious, least-reliable part — gate it behind
lemmatization and an explicit opt-in, and ship it last. Build on the existing arc job
pipeline; this is a superset of, not a replacement for, today's chapter-local arc.

## v46 major — batch generation across languages + QC of generated lessons

Three linked pieces; the stats foundation (E0) unblocks the other two.

**E0 — persist generation metadata (foundational; my answer to "should we?" is yes).**
Generators already *compute* token counts (`tokens:{promptTokens,completionTokens}`,
returned to the job) and *know* the valid/rejected split (`rejected.length`, currently
only `console.log`ged in `generateGrammar`/`generateWordForms`/… ). None of it is
**stored**. Capture it per lesson as a small structured blob, e.g.
`lesson._genMeta = { model, attempts, valid, rejected, rejectReasons:{reason→count},
promptTokens, completionTokens, ms, at }`. It rides the JSON export for free (same as
`userFlag`/`qc`), costs almost nothing, and pays off three ways: a stats table for
batch runs (E-i), triage for QC (E-ii), and diagnosing weak-model failures (exactly the
qwen `word_forms` case — we'd see "5 rejected: duplicate choices×4" in the data, not
just the console). Do this first; it's the cheap enabler.

**E-i — batch generation of a simple topic across languages.** A driver that takes one
simple topic ("greetings and introductions", numbers, colours…), a source language, and
a set of target languages (all locales, or a chosen subset), loops the existing
generators, and aggregates the per-language outcome from `_genMeta` into a **stats
report** (per language: ok/failed, item count, rejected count, tokens, time, model).
Likely cleanest as a **CLI script** (`node batch-generate.js …`) for offline
content-seeding rather than an in-app job — it's an authoring task, and a script keeps
the app server simple. Must be **idempotent / resumable** (re-run only the languages
that failed), handle per-language failure gracefully (skip + record, don't abort the
batch), and write results either merged into `lessons.json` or — preferably — a separate
**seed bundle** so the main store doesn't bloat. Sequential throughput across ~29
languages is slow but acceptable for an authoring run.

**E-ii — QC of generated lessons.** Reuse the existing QC plumbing
(`qcRun`→`/api/qc`→`qcCheckPair` (server.js ~508); suggestions stored as `it.qc` and
already rendered + appliable in the editor via `qcApplyFix`). Two modes, both
respecting the **zero-dependency / self-hosted ethos** (no mandatory external API):
- **Automated, stronger local model.** Make the QC model **configurable and separate**
  from the generation model (e.g. `OLLAMA_QC_MODEL`), so a bigger/better local model
  reviews what a small model generated. Writes `it.qc` as today.
- **External / manual round-trip (no API integration).** An **export** mode that emits
  the generated lessons in a clean, model-friendly format (JSON + a readable review
  prompt) to **upload to Claude/ChatGPT by hand**, and a matching **import** that reads
  the returned review back as `it.qc` (and/or `userFlag`) so corrections show in the
  editor with apply buttons. This leans entirely on the existing
  "flags/QC ride the JSON export, apply in the editor" machinery — no network code.

**Relationship & phasing.**
0. `_genMeta` capture (enabler).
1. Batch generate a simple topic across languages, with the aggregated stats report
   (CLI script + seed bundle).
2. Automated QC with a configurable separate local QC model.
3. External-QC round-trip: export-for-frontier-review + import-results-as-qc.

**Caveats.** Keep external-model QC **optional** — an API dependency would break the
self-hosted, zero-runtime-dep design; the export/manual-upload path is the in-ethos way
to use a frontier model. The export/import format must round-trip cleanly into `it.qc`
/`userFlag`. Don't bloat `lessons.json` — `_genMeta` is tiny, but a multi-language seed
**library** should be its own file. Lemmatization/quality limits of small models still
apply; QC surfaces them, it doesn't fix generation.

## v46 major — user-uploaded dictionaries (dialects / low-resource languages)

**Motivation.** The LLM is weak or simply wrong for some **dialects** (Swiss German,
regional variants) and **low-resource languages**. Let the user upload a dictionary /
glossary to **ground or replace** generation with a trusted source the model lacks.

**What.** Upload a word list of **target↔source pairs** (CSV/TSV/JSON, optionally with
part-of-speech / notes). Three uses, increasing in ambition:
- **(a) Import as vocab — NO LLM.** Turn the pairs directly into a vocab lesson (reuses
  the existing vocab data shape). Immediate value, zero model risk — the obvious win for
  a dialect the model can't handle at all.
- **(b) Grounding for generation.** Feed relevant dictionary entries to the generators
  as authoritative context ("use these translations; do not invent"), so LLM-generated
  lessons for that language/dialect stay consistent with the user's source.
- **(c) Post-gen validation.** Check generated vocab against the dictionary and
  flag/replace mismatches (reuse the `it.qc`/`userFlag` apply machinery).

**Integration.** Reuse the existing upload pipeline (the PDF/text upload path +
`sourceFile` naming). Store each dictionary as a named resource scoped to a
(target, source[, dialect]) label. For dialects, the dictionary is the trust anchor.

**Phasing.** (1) import-as-vocab (no LLM); (2) generation grounding; (3) post-gen
validation against the dictionary.

**Caveats.** Parsing arbitrary dictionary formats is fiddly (delimiter / encoding /
column order — reuse the CSV/text handling, don't hand-roll). Dictionaries can be large
— **don't inline a whole dictionary into every prompt**; look up only the relevant
entries. Licensing of uploaded dictionaries is the user's responsibility.

## v46 major — world-map + language-tree first page (see `build_history/map_prototype.html`)

**Prototype.** `build_history/map_prototype.html` is a **self-contained, zero-dependency** mockup
of a new landing page (title "Language Lesson Generator | Map + Phylogenetic Tree"): a
togglable **world map** (🗺️) and **phylogenetic language tree**, DOM-based (absolutely
positioned `map-dot`/`tree-dot` divs), with hardcoded node coordinates (`treeNodes` +
`edges`), languages **coloured by family**, and "click dots to select". It has **no
lesson/QC wiring yet** — it's purely the UI.

**What.** Integrate it as the (optional) **first page** for choosing a source→target
pair visually. Clicking a from-dot + a to-dot sets `APP.srcLang`/`APP.lang` and drops
into that pair's library / generation flow.

**Path highlighting — the core ask.** Colour/badge each (src→tgt) pairing by:
- **(a) existing lessons** — which pairs already have content (derive from
  `APP.savedList` grouped by `srcLang`+`lang`); needs only existing data.
- **(b) QC health for batch-generated lessons** — green/amber/red from the batch-gen
  QC results (`qcFlags` + `_genMeta` from the batch-generation + QC major). The map then
  doubles as a **coverage / quality dashboard** for the all-languages batch runs.

**Integration notes.** Map the prototype's language names to the app's codes
(English→`en`, German→`de`, MandarinChinese→`zh`, …) — a small lookup table. Keep it
**zero-dependency** (the prototype already is). It's a client/landing feature: works
live; in static it can show coverage of the baked `STATIC_LESSONS`. Make it
**toggleable with the current landing** at first, not a forced replacement.

**Dependency.** (a) needs only existing lessons — ship it first. (b) needs the
**batch-generation + QC major** for the QC/`_genMeta` data.

## Carried-over open items (lower priority)

- **word_forms multi-correct (deferred, not recommended yet).** Allowing several correct
  forms per blank was floated. It does **not** fix the current failure modes (those were
  malformed items, now salvaged) and adds multi-select play-UI + schema complexity.
  Revisit only if genuine ambiguity (two forms both fit) becomes the dominant failure.
- **German adjectival/participial nouns (hard, unsolved).** In grammar-reinforce, nouns
  like *der Angestellte* have ambiguous gender/inflection the normalizer can't resolve
  reliably. Documented in roadmap_v45; still open. Needs a real morphology approach, not
  a quick patch.
- **`build-static.js` version string.** It hardcodes `version: 'v44'` in the static
  `APP.info` even though `APP_VERSION` is `'v45'`, so the static build reports the old
  version. Trivial fix (read it from a single source). Cosmetic but real.
- **Live-verification backlog.** `LIVE-TEST-CHECKLIST.md` §§11–23 list browser/Ollama
  checks the headless suite cannot cover (word_forms generation quality, the static
  teacher-mode edit/export round-trip, synonym select-all scoring, the continue-story
  dual-language filter, TTS voice enumeration, etc.). A real device pass is owed; start
  with §21 (static build) and §23 (word_forms on a weak model), the most recently
  touched areas.

## Conventions checklist (so a fresh tool doesn't regress)

- New client helpers used in static → define **after** `function buildPath(`.
- New UI strings → `ui.json` `en` only, via `t()`; never hardcode user-facing text.
- New lesson-edit persistence → through `_postLessonEdit()`, never a raw
  `fetch('/api/lessons/edit')`.
- Prefer **salvage + prompt nudges** over strict validator rejects.
- Every behavior change gets a test; register it in `test/run.js`. Keep
  `node test/run.js` green and `node test/check-inline.js index.html` at 0 failures.
- Rebuild `docs` whenever the client changes, and smoke-check it (the static slice is
  the easiest place to silently break things).
