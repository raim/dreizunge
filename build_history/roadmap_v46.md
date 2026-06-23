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
client builder registry) is the prerequisite for C. A is independent. (D) storyline-wide vocabulary learning arc builds on the existing arc pipeline; its ambitious forward-pre-seeding phase is gated by lemmatization. (E) batch-generate a simple topic across all languages (with generation stats) + QC the output via a stronger local model or a manual export-to-frontier round-trip; its E0 stats-capture is a cheap enabler also useful on its own. (F) user-uploaded dictionaries to ground/replace generation for dialects & low-resource languages; (G) a world-map + language-tree first page (prototype in uploaded map.html) where src→tgt paths are coloured by existing lessons and by batch-gen QC health — G(b) depends on E. D also gains a progress-dependent review dimension (repeat words the user got wrong). (H) mathematics as a pseudo-language (math-only lessons rendered in the source language); (I) LLM auto-fix of flagged lessons into the flag comment/correct fields; (J) per-task model selection + a prompt preview/edit popup; (K) a cross-storyline personal learning history toward a “learning buddy” (generalises D's per-item progress); (L) storyline visuals from uploaded character assets. **Before the big features, see “Code-structure readiness” below:** do B-phase-1, add static-build markers, and land E0 first; avoid any bundler (keep the zero-dep, single-file ethos).

---

## Priority & sequencing

**Done (the enabler groundwork — landed before the big features):**
- ✅ **B-phase-1** — exercise building dispatches through the `LESSON_TYPE_META[type].build`
  registry (`unit-build-registry`). Unblocks C and simplifies H/I.
- ✅ **Static-build markers** — `build-static.js` slices on `@static-exclude-start` /
  `@static-exclude-end` / `@static-engine-end`, not coincidental code lines, and fails
  loudly on a mis-slice (`unit-static-markers`). Kills the silently-dropped-helper bug
  class.
- ✅ **E0** — every generated lesson carries `_genMeta` (type, model, attempts, valid,
  rejected, `rejectReasons` histogram, tokens, ms, at). Stamped **inside every generator**
  via shared `buildGenMeta()`/`genReasonHist()`, so ALL flows — add-lesson, initial topic
  gen, book import, storyline recreate — carry it (`unit-genmeta`; `e2e-word-forms`
  asserts it end-to-end).

**Suggested order for the rest** (effort S/M/L/XL; "depends on" lists hard prerequisites):

| Major | Effort | Depends on | When / why |
|------|--------|-----------|-----------|
| **A** per-target-language examples | M | — | **Next** — independent; biggest win for weak local models |
| ~~**C** mixed-type lessons (no LLM)~~ ✅ DONE | M | B-phase-1 ✅ | Shipped — `buildMixedExercises` pools siblings via the registry; flags resolve to source via `_srcLessonIdx` (`unit-mixed-lessons`) |
| **B** full unify (renderEx / editor / server dispatch) | L | B-phase-1 ✅ | Soon — removes per-type duplication; simplifies H, I |
| **E** batch-gen + QC (E-i then E-ii) | L | E0 ✅ | Soon — content-seeding + quality; feeds G(b) |
| **H** mathematics as a pseudo-language | M | B (eases) | Mid |
| **J** per-task models + prompt preview/edit | M | E0 ✅ | Mid — preview also helps author A |
| **I** auto-fix flagged lessons | M | E0 ✅; better with J | Mid — reuses flag apply machinery |
| **F** user-uploaded dictionaries | M | — | Mid — import-as-vocab phase is no-LLM/quick |
| **G** map + tree landing | L | G(a): — · G(b): E | G(a) mid (existing-lesson coverage) · G(b) after E (QC health) |
| **D** storyline vocab arc + progress-review | XL | lemmatization (phase 3) | Later — research-y; phases 0–2 deterministic |
| **K** personal history → learning buddy | XL | D's per-item progress store | Later — most ambitious; build on D |
| **L** storyline visuals | L | upload pipeline | Later — asset-composition first; image-gen is out-of-ethos/optional |

Rule of thumb: do **A and C next** (high value, unblocked), then **B and E** (structural + content leverage), then the **mid** cluster, leaving **D / K / L** — the research-heavy, multi-phase work — for last.

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
1. ✅ **Client `build` registry** — DONE. `buildExercises` is now
   `lessonTypeMeta(lesson.type).build(lesson, lessonIdx)`; the default vocab/sentence
   body is `buildStandardExercises`. Guarded by `unit-build-registry`. (This is the slice
   that unblocked C, which is also shipped.) **Start B-full here at step 2.**
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

> ✅ **DONE.** New `mixed` type + `buildMixedExercises(lesson, lessonIdx)` (pools each
> sibling's registry builder, `perType` per source, tags `_srcLessonIdx`, skips self/
> hidden/nested-mixed/no-exercise types). `_exFlagTarget` resolves pooled exercises to
> their source lesson. No-LLM "Mixed review" add option creates it client-side (with a
> stable `id`); read-only editor branch; empty-pool shows a "nothing to pool" message.
> **Round-trip fix:** the lesson is created via `_postLessonEdit` → `/api/lessons/edit`,
> whose merge previously cherry-picked only content fields and dropped `type`/`perType`
> for a newly appended lesson — so on reload (live navigate or static export) the mixed
> lesson read as "Vocabulary" and crashed in `buildStandardExercises`. The edit handler
> now returns a new lesson's full shape (and carries `type`/`perType` for existing ones);
> `buildStandardExercises` defaults `vocab`/`sentences` to `[]`. Tests: `unit-mixed-lessons`,
> `e2e-mixed-lesson-edit`. Next up per sequencing: **A**.

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

## v46 major — mathematics as a pseudo-language (math-only lessons in the source language)

**Idea.** Add **"Mathematics"** as an entry in the *target*-language selector. When
chosen, generate **math-only** lessons rendered **inside the source language** — the
model is still told `{S}` so any wording (instructions, word problems) is in the
learner's language. Opens a path to **language-specific math word problems** later.

**Integration.** The math producers already exist and already take both languages:
`generateMath` (procedural, server.js ~856) and `generateMathLLM` (LLM/LaTeX, ~936,
`(lang, srcLang, difficulty, instruction, jobId)`); lessons are type `'math'`. Add a
pseudo-language entry to `LANGS` (index.html ~1027) flagged e.g. `isMath:true` (parallel
to the `RTL_LANGS`/`CJK_LANGS` sets). When the target is the math pseudo-language, route
add-lesson/generation straight to the math producers, pass `{S}` so textual parts render
in the source language, and **gate every natural-language-only path** (vocab/story/
grammar/conjugation/synonyms/word_forms, TTS, `updateDocDir`/RTL, CJK fonts) behind an
`isPseudoLang` check so the UI never offers "generate a story" for mathematics.

**Phasing.** (1) pseudo-language entry + UI gating + reuse the math producers with `{S}`
wording; (2) make sure every textual field (`math_latex` question/translation,
instructions) is in `{S}` and the model is told `{S}`; (3) future: richer
language-specific word problems and math terminology in `{S}`.

**Caveats.** Much code assumes the target is a natural language — the `isPseudoLang`
guard must be thorough. The map/tree landing (G) and batch-gen (E) must treat math as a
**special node**, not part of the phylogenetic tree or normal language-pair grouping.
Synergy with **unify (B)**: once types are a registry, math is just another producer and
the pseudo-language only decides which producers are offered.

## v46 major — auto-fix flagged lessons via LLM

**Idea.** Pass flagged lessons (QC-flagged, user-flagged, or all) to an LLM and ask it to
**suggest corrections**, written into the existing flag fields for the user to review and
apply.

**Integration — reuses everything already built.** User flags are
`item.userFlag = { comment, correct, at }` (set at index.html ~5444); the editor already
**applies** a flag's `correct` via `userFlagApplyFix` (~5451) and QC suggestions via
`qcApplyFix` (~5377). So auto-fix = send the flagged item + the user's `comment` (and/or
the QC finding) to the model, ask for a corrected version, and write it into
`userFlag.correct` (with a note in `comment`). The existing apply buttons accept it. No
new apply path needed.

**Phasing.** (1) single-item "suggest a fix" button (LLM fills `correct`); (2) batch over
all flagged items in a lessonset; (3) optional auto-apply for high-confidence fixes (off
by default).

**Caveats.** Never auto-apply silently — keep review-then-apply. Use a capable model
(ties to per-task model selection below) and record which model produced the fix in
`_genMeta`. In-ethos (local Ollama, or the manual export round-trip from the QC major).

## v46 major — per-task model selection + prompt preview/edit

**Idea.** Use **different Ollama models for different tasks**, choose the model
dynamically (a selector on the main page, or a popup on every LLM-calling button), and —
in that popup — **review and edit the full, model-specific prompt** before it is sent.

**Integration — partly there already.** The server already reads task-specific model env
vars: `OLLAMA_MODEL`, `OLLAMA_LESSON_MODEL`, `OLLAMA_TRANSLATION_MODEL` (server.js
~1075–1641). This major makes them **UI-selectable** and adds QC/auto-fix slots
(`OLLAMA_QC_MODEL` from the QC major). List installed models via Ollama's `/api/tags`.
The prompt-preview needs a "build prompt but don't send" path: generators assemble the
prompt from `prompts.json` + context (`{L}`/`{S}`/story/`chainVocab`/the `{EXAMPLE}` from
A) — expose that assembled prompt to the popup, let the user edit it, and accept the
edited prompt to send verbatim.

**Phasing.** (1) surface the existing per-task model config; (2) a main-page **default
model selector** (from `/api/tags`); (3) a **per-button popup** to pick the model for one
call; (4) **prompt preview + edit** in the popup.

**Caveats.** An edited prompt can break the JSON-output contract the validators expect —
parse defensively and show validation feedback. Keep optional (defaults work untouched).
Big synergy: the preview is the best tool for authoring the **per-language examples (A)**
and debugging weak-model failures; `_genMeta` (E0) should record the model used per call.

## v46 major — personal learning history → "learning buddy"

**Idea.** Build a **persistent, cross-storyline personal history** — everything the user
has *generated*, and everything they've *solved* — and feed that whole personal arc into
generation of new lessons (toward a personalized "learning buddy").

**Relationship to the arc (D).** D's progress-dependent review adds a per-item
`progress[itemKey] = {seen, wrong, lastAt, ease}` **within** a storyline. This major
**generalizes it to a global profile** across all storylines/lesson sets, distinguishing
*merely solved* (any exposure) from *generated **and** solved* (deliberate study). New
generation then considers the global profile: skip mastered vocabulary, globally
reinforce struggled words, pace by overall history.

**Phasing.** (0) a global personal-history store aggregating per-item progress across all
content (client/localStorage; per target language); (1) a "my learning" dashboard; (2)
feed it into generation; (3) the "buddy" — a persistent personalized arc shaping every
new lessonset.

**Caveats.** Keep it **local/private** (personal data — client-side, not posted). History
grows unbounded — summarize/age it. Track per (target,source) so languages don't bleed.
Most ambitious of the personalization items; depends on D's per-item store existing first.

## v46 major — storyline visuals (uploaded assets + per-chapter graphics)

**Idea.** Give each storyline a **visualization**, optionally from **user-uploaded
character graphics** — e.g. the "the little i" stories across languages: upload the
characters once, generate a simple graphic per chapter.

**Two routes (prefer the in-ethos one first).**
- **Asset composition (in-ethos, no image model).** Let the user **upload image assets**
  (characters, props), attach them to a storyline, and show them on storyline/chapter
  screens. Then have the **text LLM pick which characters/props appear per chapter** (from
  the chapter's story text) and compose a simple scene (SVG/DOM, zero-dep). No
  image-generation backend.
- **Generated imagery (out-of-ethos, optional).** True AI image generation needs a local
  image model — a real dependency the project otherwise avoids. Optional/last.

**Integration.** Reuse the existing upload pipeline (PDF/text + `sourceFile`), extended to
image assets scoped to a storyline. **Do not** inline base64 into `lessons.json` — store
assets as files and reference them; mind the static build (baked `docs` must copy assets).

**Phasing.** (1) upload + attach + display static assets per storyline/chapter; (2) LLM
chooses per-chapter characters → simple composition; (3) optional generated imagery behind
a local image backend.

**Caveats.** Image storage/size (files, not inlined); static-build asset handling;
uploaded-graphic licensing is the user's responsibility; gate any image-model path behind
an explicit opt-in to keep the core zero-dependency.

## Code-structure readiness (assessment — are we ready for A–L?)

**Short answer:** the codebase is coherent and well-tested (29 test files, salvage
validators), and most majors are *additive* — but two existing structural facts will bite
as these land, and both are already roadmap items. Do the targeted refactors; **do not**
big-bang rewrite.

**The two real risk areas:**
1. **Per-type vertical duplication.** Every lesson type is smeared across `server.js` +
   `index.html` + the editor + pickers. Several majors (C mixed, H math-pseudo-language,
   I auto-fix, any new type) are markedly easier *after* the **unify registry (B)**. B is
   the highest-leverage refactor and a soft prerequisite for the type-heavy work —
   sequence it early.
2. **The fragile static build.** `build-static.js` slices the client by **line ranges**
   (`init()` → `buildPath(`); a helper in the wrong region is silently dropped and the
   static page throws at runtime. This has already caused real bugs (`_canEdit`,
   `_chapterNeighbors`, the attribute-escaping class). As the client grows (G map, L
   visuals, J popups) it gets more dangerous. **Recommended low-risk, high-value fix:**
   replace the line-range slice with **explicit marker comments**
   (`// @static-include-start/end` or per-function tags) so placement stops being a
   landmine — kills a whole recurring bug class with no change to the zero-dep,
   single-file, no-build ethos.

**What I would NOT do.** No external bundler / module system / framework — the
single-file, zero-dependency, no-build design is a core value, and a bundler is exactly
the dependency the project avoids. If the client eventually outgrows one inline script
(G + L + J together might), prefer a **trivial zero-dep concatenation build** (cat ordered
source files) over any npm bundler, so the ethos survives.

**Recommended sequencing of structural/enabler work, before the big features:**
1. ✅ **B-phase-1** (client builder registry) — DONE; unblocks C, simplifies H/I.
2. ✅ **Static-build markers** — DONE; killed the slice-fragility bug class.
3. ✅ **E0** (`_genMeta`) — DONE for every flow (stamped inside all 8 generators via
   buildGenMeta; add-lesson / topic gen / book / recreate all carry it).
Everything else is genuinely additive and can proceed without further refactoring.

## Carried-over open items (lower priority)

- **word_forms multi-correct (deferred, not recommended yet).** Allowing several correct
  forms per blank was floated. It does **not** fix the current failure modes (those were
  malformed items, now salvaged) and adds multi-select play-UI + schema complexity.
  Revisit only if genuine ambiguity (two forms both fit) becomes the dominant failure.
- **German adjectival/participial nouns (hard, unsolved).** In grammar-reinforce, nouns
  like *der Angestellte* have ambiguous gender/inflection the normalizer can't resolve
  reliably. Documented in roadmap_v45; still open. Needs a real morphology approach, not
  a quick patch.
- **Export logic is duplicated (server vs client twin) — dedup candidate.** The chapter
  export exists twice: `export-lessons.js` (`buildExport`/`chapterParts`/`renderHtml`,
  used by the live `/api/export`) and a hand-maintained client port in `index.html`
  (`_clientBuildExport`/`_ceChapterParts`/`_ceRenderHtml`, used by the static build since
  it has no server). A fix to one silently misses the other — this bit twice (error-hunt
  rendering had to be applied to both; the second miss shipped as an empty-list bug in
  static). Worth collapsing: have the static build *bake* the server module's pure
  functions into the page instead of keeping a parallel copy. Until then, **any export
  change must touch both** `export-lessons.js` and the `_ce*` functions.
- **`/api/lessons/edit` merge silently drops unlisted fields (gotcha).** The edit handler
  rebuilds each lesson by spreading the stored `orig` and then copying a *fixed allow-list*
  of fields from the edited copy (title/icon/vocab/sentences/grammar/conjugations/
  corruptedStory/_hidden/edits/type/perType). For an **existing** lesson, anything not in
  that list survives only because it rides `...orig`; for a **newly appended** lesson
  there is no `orig`, so it's now returned whole (`{...edited}`). Any future lesson type
  with its own top-level fields must either be added to the allow-list **or** rely on the
  new-lesson whole-spread. This is the bug that made mixed lessons lose their `type`.
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
  `fetch('/api/lessons/edit')`. A **new lesson type** with its own top-level fields must
  also be preserved by the `/api/lessons/edit` merge (allow-list) — see the gotcha above.
- Export changes must touch **both** `export-lessons.js` (server) and the `_ce*` client
  twin in `index.html` (static), until they're deduplicated.
- Prefer **salvage + prompt nudges** over strict validator rejects.
- Every behavior change gets a test; register it in `test/run.js`. Keep
  `node test/run.js` green and `node test/check-inline.js index.html` at 0 failures.
- Rebuild `docs` whenever the client changes, and smoke-check it (the static slice is
  the easiest place to silently break things).
