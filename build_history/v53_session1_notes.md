# v53 — session 1 notes: script lessons in both directions

Released as **v53** (`APP_VERSION='v53'`). Suite green (92 checks), `check-inline` 0 on both
builds, static rebuilt (version derived from `server.js`).

## Baseline finding (before any change)
The suite arrived **red**: `unit-version-derivation` failed because `docs/index.html` was built at
**v52_f** while `server.js` said **v52_g** — the v52_g client code (`qcSuggestRows`/`qcByModel`,
9 hits in `index.html`) was absent from the static build (0 hits), and `qc.editor.suggests_by` was
not baked. The previous session bumped the version and edited the client but skipped protocol
step 4 (`node build-static.js`). Fixed by rebuilding; the rebuild is idempotent (byte-identical on
a second run). No source change, so nothing else was owed for it.

## The bug (user-reported)
> "script lesson in both directions: currently arabic->english focusses on the arabic script, but
> doesn't have exercises for the latin alphabet."

Confirmed and traced. `scripts.json._langScript` mapped only NON-Latin languages, so
`scriptsForLang('en') === []` and `needsIntroScript` bailed on its first line:

```js
const tgt = scriptsForLang(targetLang);
if (!tgt.length) return false;   // target is Latin (or unlisted) → no intro
```

| pair | scriptsForLang(target) | needsIntroScript | script offered |
|---|---|---|---|
| learn ar from en | `[arabic]` | true | Arabic ✅ |
| learn en from ar | `[]` | **false** | **Arabic** ❌ |

`scriptLessonAvailable('en','ar')` returned true only because `needsIntroScript('ar','en')` fired,
and `scriptsUsedInLessonSet` unions `scriptsForLang(lang) ∪ scriptsForLang(srcLang)` = `['arabic']`.
So the Arabic speaker was offered a course in the script they already read.

## The deeper problem — the answer side assumed a Latin-reading learner
`introScriptExercises` quizzes `glyph ↔ sound` where `sound(L) = L.translit || L.name`, and every
table's `translit` is **Latin**. That works one way only. A naive `latin` table run through the real
builder produced:

```
glyph_sound  prompt: "A a"     answer: "a"     choices: ["a","v","s","j"]
sound_glyph  prompt: "b (bee)" answer: "B b"
```

The answer is the prompt lowercased, and reading the choices requires already reading Latin.
Adding a `latin` table alone would have shipped two degenerate exercise types out of three.

## Change (user chose the fullest option: plumbing + sounds for all non-Latin source scripts)

**Data (`scripts.json`)**
- New **`latin`** table: 26 letters `{ch, lower, name, translit, ipa, sounds}`, `rtl:false`,
  `label:"Latin alphabet"`.
- **`letters[].sounds`** maps a SOURCE script → the letter's name written in that script.
  Eight columns: `arabic, cyrillic, greek, hebrew, devanagari, hangul, katakana, thai`
  (e.g. `B → بي / би / μπι / בי / बी / 비 / ビー / บี`).
  The letter **name** was chosen over the phonetic value deliberately: phonetic values collide
  (`c`/`k`/`q` → `ك`), which would give an MCQ several correct answers; names are unique per column
  and match what TTS speaks for a lone glyph. Every column is asserted complete + collision-free +
  free of Latin characters.
- **`latin.soundsFor`** declares which source scripts the table can be taught to — the gate that
  keeps the circular case unreachable.
- New **`han`** stub + `zh → han`. Without it `scriptsForLang('zh') === []`, and a Chinese speaker
  would have been handed a Latin course falling back to Latin `translit` answers. **Every language
  is now mapped**; a test asserts it (an unmapped code silently reads as "no script").
- Latin languages mapped: `en it fr de es pt nl pl sv tr sw lb vi id cs ro fi hu da ca → latin`.

**Code (server.js + index.html, kept in parity)**
- New **`scriptTeachable(name, srcScripts)`**: a table with no `soundsFor` (all legacy tables) stays
  teachable as before; `latin` is teachable only to a source script it has a `sounds` column for.
- **`needsIntroScript`** now uses `scriptTeachable` instead of `scriptHasTable` → symmetric.
  `needsIntroScript('en','ar')` flipped `false → true`. This was previously *asserted as intended*
  (`unit-intro-script:85`), so the assertion moved with the design.
- **`introScriptExercises` / `introScriptExercisesFrom`** take `opts.srcScripts` and resolve the
  answer via an **inline** `localSound()` (no free variables — the parity test builds the server
  function with `new Function(body)()`, so it must stay self-contained). The Latin `(name)` hint is
  suppressed once the sound is localized, and `listen_mcq.pron` uses the same localized text.
- Callers thread it through: `generateIntroScript({srcLang})` (also filters out scripts the learner
  already reads when auto-picking), `buildArcIntroLessons`, and the `intro_script` registry adapter.
- **`scriptsUsedInLessonSet`** now filters by `scriptTeachable(name, srcScripts)` rather than
  `scriptHasTable`. Without this, `latin` would enter the union for *every* pair and offer a Latin
  course to English speakers learning German. Purely additive: legacy tables declare no `soundsFor`,
  so every script offered before is still offered.

Result — `ar` reader, English target:
```
glyph_sound  prompt: "A a"  answer: "إيه"  choices: ["أوه","إس","واي","إيه"]
sound_glyph  prompt: "بي"   answer: "B b"  choices: ["N n","G g","B b","T t"]
listen_glyph speaks: "b"    pron-fallback: "بي" → "B b"
```

## Tests
- `unit-intro-script`: new **v53 block** — latin table integrity; per-column completeness,
  uniqueness and no-Latin-leak; localized answers for arabic / hangul / ja (hiragana→katakana
  fall-through); no `(bee)` hint leak; client↔server parity *with* a sounds column; `scriptTeachable`
  matrix; and a **regression guard** asserting `serverEx(arabic)` is `deepStrictEqual` with and
  without `srcScripts:['latin']` — i.e. **en→ar is byte-identical to pre-v53**.
- Updated gating assertions (`it → ['latin']`, `zh → ['han']`, every language mapped, symmetric
  `needsIntroScript`, `zh→en` gated off), the `ar→en` detection fixture (now `['latin','arabic']` —
  the bug, now guarded), and a new `de→en → []` case.
- `unit-add-lesson-registry`: `intro_script` arg shape gained `srcLang` (per the "update the matching
  registry test" rule).
- Test harnesses gained `scriptTeachable` / `scriptsForLang` injections.

## Notes
- **No new `ui.json` keys.** Script labels ("Latin alphabet", "Han (Chinese characters)") live in
  `scripts.json` like `Cyrillic`/`Arabic`. Nothing owed to the TranslateGemma pass from this change.
- Static rebuilt (`scripts.json` is baked); `docs/index.html` carries the latin table.

## Second change — `translate-ui.js` could not see Swahili (user-reported)
> "ui.json: are swahili entries missing?"

Yes — **entirely**. `sw` was the only one of the 30 languages in `languages.json` with no `ui.json`
entry at all (0/426 keys). Not a target-only language either: `sw` is in both `<select>` lists, and
the source language IS the UI language (`index.html`: `const uiLang = APP.srcLang || 'en'`), so a
Swahili user silently got an English interface via the `Object.assign({}, enStrings, strings)`
fallback. `languages.json` already assumed it was a UI language — every entry carries a `names.sw`.

**Why it would never have fixed itself.** `translate-ui.js:55` derived its work list from the
languages *already present* in ui.json:
```js
const allLangs = Object.keys(ui).filter(l => l !== 'en');   // ← self-concealing
```
A language absent from ui.json is therefore never listed, never translated, and `--check` reports
`Total missing: 1204 across 28 language(s)` — Swahili nowhere in it. Once those 1204 land the tool
prints "✅ All translations complete!" with `sw` at zero. That is presumably how it survived the
v48-b pass that reported "0 missing across 29 langs". (`node translate-ui.js sw` did work, if you
knew to name it.)

**Fix.** `allLangs` is now derived from `languages.json` (the source of truth for what the app
offers), unioned with ui.json's keys so a stray ui-only entry is still maintained; an unreadable
`languages.json` degrades to the old behaviour rather than crashing. `--check` now reports
`1630 across 29 language(s)`, with Swahili visible at 426 missing.

Guarded by **`unit-translate-ui-langs`** (new, registered in `test/run.js`): the old derivation is
gone, the list is read from `languages.json`, every offered language is discoverable (`sw`
explicitly), union semantics keep ui-only entries, the no-languages.json fallback is non-empty, and
no non-`en` language holds a key absent from `en`.

**Deliberately NOT done:** no `sw` entry was seeded. Protocol rule 3 — `translate-ui.js` keys off
*missing* keys and "can't detect English fallbacks" — so English placeholders under `sw` would have
permanently masked all 426 keys from the pass meant to fill them, turning a visible hole into an
invisible one. Filling it needs the user's Ollama.

## Owed
- **LIVE-TEST §68** — browser pass (Latin course appears, Arabic-script choices, RTL sanity,
  regressions for de→en / en→ar, zh gated off, arc auto-generation).
- **Native review of every `latin.sounds.*` column** — especially Hebrew (niqqud), Greek digraphs
  (`μπι`/`ντι`), Thai. Flagged in `scripts.json._sounds_comment`.
- **TranslateGemma pass, now 1630 keys across 29 langs**: the 43 en-only keys owed on every language
  (`models.*`, `dialect.*`, `qc.editor.suggests_by`, `form.use_dialect`, `tts.approx_dialect`, the
  three `*_nolang` keys) **plus all 426 keys for `sw`**, which the pass can finally see. Run
  `node translate-ui.js --check` first; `node translate-ui.js sw` for Swahili alone.
- A `sounds.han` column would un-gate the Latin course for Chinese speakers (needs a decision:
  bopomofo vs Han transcription — several common Han transcriptions are unfortunate, e.g. P → 屁).

## Addendum — `sounds` / `soundsFor` invariants generalized to every table (test-only)
The v53 column checks (completeness, uniqueness, no-Latin-leak) only ran over `latin.soundsFor`.
Generalized in `unit-intro-script` to run over **every** table that declares `sounds`, so the next
column added — see the "sounds extension" under OPEN — scripts in `roadmap_v54.md` — cannot quietly
break the two properties that make a column usable.

Enforced per table:
1. **The gate rule, derived from the data:** *declare `soundsFor` iff the translit fallback is written
   in the table's own script* (i.e. is circular). Only `latin` qualifies. This encodes the invariant
   that `sounds` (an optional answer upgrade, falls back to `translit`) and `soundsFor` (a teachability
   gate) are different things. Putting `soundsFor` on `arabic` narrows its teachability and breaks
   `en→ar` — confirmed by mutation: the assertion that fires first is literally
   `en→ar: arabic table filled → offered`.
2. **Per column:** complete (a hole silently falls back to translit), collision-free (a repeat gives
   sound→glyph two correct answers), never written in the script being taught, and actually written
   in the reader's script.

Comparison is by Unicode **script property** (`\p{Script=…}`), not by the table's own glyph list: the
hangul table stores jamo (`ㄱ`) while its answers are composed syllables (`에이`), which share no
codepoints — a charset comparison wrongly reported "not written in hangul" (caught while writing the
check). The property also catches non-ASCII Latin (`ā`, `ṣ`) that an `A–Z` charset would miss. A new
table must be added to `SCRIPT_PROP` or the test fails.

**Mutation-tested** — all six failure modes fire: `soundsFor` on a legacy table; a hole in a column;
a duplicate value; an answer in the taught script; an answer in the wrong reader script; a new table
with no script property.

Test-only change: `server.js`, `index.html`, `scripts.json` and `docs/index.html` are byte-identical
to the v53 cut, so **no version bump and no static rebuild** — nothing user-visible changed. Suite
92 checks green.

## Release
`APP_VERSION = 'v53'` in `server.js`; `docs/index.html` rebuilt and derives `v53` in both spots
(`unit-version-derivation`). `roadmap_v54.md` written, carrying the session protocol and every open
item forward. This change added **no new `ui.json` keys**.

---

# v53_b — the Latin course was generated but never offered (user-reported)

> "so now we should be able to generate script lessons e.g. for an arabic->english lessons, right?
> i don't see that in the selection of the add lessons + button."

Correct, and the v53 work was only half-wired. Two defects, both in `index.html`.

## 1. The gate read the wrong srcLang (the reported symptom)
`scriptsUsedInLessonSet(d)` — the **generator** — reads `d.srcLang`, the set's own source language.
But the two places that decide whether to *show* the 🔡 option read the **global** `APP.srcLang`:

```js
index.html:3596   ${scriptLessonAvailable(s.lang, APP.srcLang) ? `<option value="intro_script">…` : ''}
index.html:4999   const show = !!lang && scriptLessonAvailable(lang, APP.srcLang);
```

`APP.srcLang` is the source/UI language of whoever is browsing, not the pair the set was authored
for. Browsing with an English UI and opening an `en|ar` set evaluated `scriptLessonAvailable('en','en')`
→ **false** → option hidden, while the generator would happily have built `['latin','arabic']`.

**Pre-existing bug, exposed by v53.** Before, a script course only existed for a non-Latin *target*,
and `scriptLessonAvailable('ar', anything-but-arabic)` is true — so the option showed regardless of
what the global was. A *Latin* target only needs the course when the SET's source is non-Latin, so
the mismatch finally bit. Verified against real data: all 255 topics in `lessons.json` carry
`srcLang`, 13 of them `en|ar`.

Fixed with a small pure helper next to `scriptLessonAvailable`, used at both sites:
```js
function scriptLessonAvailableForSet(d) {
  if (!d || !d.lang) return false;
  return scriptLessonAvailable(d.lang, d.srcLang || APP.srcLang);   // legacy sets fall back
}
```

## 2. The authoring path baked un-localized answers
`index.html:5114` called `introScriptExercisesFrom(letters, { distractorPool: full })` — **no
`srcScripts`** — so the persisted `exercises` array answered in Latin translit (`A a → a`). Play-time
papered over it (`buildIntroScriptExercises` rebuilds from `lesson.letters` and *does* pass
`srcScripts`), but the **lesson editor, QC, and export** all read the stored array. Now computes
`scriptsForLang(d.srcLang || APP.srcLang)` and threads it through. Baked output is now
`A a → إيه`.

## Tests
New **v53_b block** in `unit-intro-script`: the gate helper against `en|ar` / `en|ja` / `ar|en` /
`en|de` / legacy-no-srcLang / null / no-lang, all evaluated with `APP.srcLang='en'` so the reported
bug is the assertion; source-level checks that no call site passes `APP.srcLang` beside a set's lang,
that all three `scriptLessonAvailableForSet` references exist, and that **every**
`introScriptExercisesFrom` call site passes `srcScripts` (definition excluded via lookbehind).
**Mutation-tested:** reverting either fix fails the suite.

## Release
`APP_VERSION = 'v53_b'` (user-visible bug fix → point release per the roadmap's numbering).
Static rebuilt; `docs/index.html` derives `v53_b`. Suite 92 green, `check-inline` 0 on both builds.
**LIVE-TEST §70** added. No new `ui.json` keys.

## Note for the next session
The gate and the generator disagreeing is the kind of bug the suite could not have caught, because
the gate lived inline inside a DOM-rendering function. Extracting `scriptLessonAvailableForSet` made
it testable. Worth checking whether the arc-generation gates (`index.html:1857`, `:3264`, both
`needsIntroScript(APP.lang, APP.srcLang)`) have the same shape — there they are reading the *form's*
selects while a new set is being created, which is correct, but it is worth a deliberate look rather
than an assumption.

---

# v53_c — TODO triage: three fixed, eight roadmapped

Suite 94 green, `check-inline` 0 both builds, `APP_VERSION='v53_c'`, static rebuilt. LIVE-TEST §71.

## Fixed

**1. `translate-ui.js` doesn't end when finished.** The bug is in **`llm.js`**, not `translate-ui.js`.
`_callOllama` wrapped its request in
`Promise.race([call, new Promise((_,rej)=>setTimeout(rej, OLLAMA_TIMEOUT))])` and never cleared the
losing timer. An un-cleared `setTimeout` holds the libuv loop open, so after the last successful call
the process idles for the remainder of `OLLAMA_TIMEOUT` — **720000 ms = 12 minutes** by default. Every
CLI script was affected (`generate-lessons`, `translate-lessons`, `qc-lessons`), not just `translate-ui`.
Whoever wrote `--check` added an explicit `process.exit(0)` on those paths, which is why only the main
path hung. Fixed by capturing the handle, `clearTimeout` in `.finally()`, plus `.unref()`.
Guarded by `unit-llm-timeout-handle` — which itself hung on first run, because it creates a 10-minute
timer to *prove* the leak. It now spies on `setTimeout` and clears the captured handles. Exits in 91 ms.

**2. Storyline summary: model logged + stamped.** `── Storyline summary generation ──` printed
Chapters + Lang but not the model, and the summary was persisted as a bare string. Title generation and
the chapter-title post-pass already logged theirs. Now returns `{text, meta}` with
`buildGenMeta({type:'storyline_summary', model: OLLAMA_MODEL})`; both call sites destructure and persist
`sl.summaryMeta`; `/api/storyline-retitle` still returns a plain string. **Trap found:** `buildGenMeta`
defaults `model` to `OLLAMA_LESSON_MODEL`, so a story-model caller that omits `model:` is silently
mis-stamped. Asserted in the test; flagged in the roadmap as a reason to make `model` required.

**3. `de↔nl` added to `CLOSE_LANG_PAIRS`.** Extended the existing `unit-close-lang-pairs` rather than
adding a duplicate test file.

## The close-pair finding (more interesting than the fix)
Similarity lives **only** in `server.js → CLOSE_LANG_PAIRS` (hardcoded, order-independent) + `lang === srcLang`.
Nothing in `languages.json`. Measuring all 255 topics showed the `>2 identical items` COUNT threshold
conflates two things:
- **100%/80% identical → real model failure** (`lb→en` "History of Luxembourg" 8/8 English words in the
  lb field; `it→en` "Grandmas Doughs" 8/8). Blocking is correct.
- **~38% identical → loanwords / proper nouns**, present in EVERY pair regardless of closeness
  ("pasta, tagliatelle, risotto"; "café, fans, notes"; "Champagne, Terroir").

So closeness is the wrong lever for the false positives, and adding `de↔nl` only covers the narrow
cognate case asked about (no `de|nl` topic exists yet, but lowercased `arm/hand/winter/warm` would trip
it at once). A **ratio** threshold (`≥60%` and `≥3` items) separates the two cleanly against the current
corpus. Roadmapped, not done — it changes generation behaviour and deserves its own change.

## Research done (for the model/language item)
No vendor publishes per-language *quality*, only per-language *support*. Quality lives in benchmarks:
**Belebele** (122 langs, best "can it read this language" signal), **Global-MMLU** (42) / **-Lite** (15),
**MMLU-ProX** (29 langs, identical questions per language, reports gaps up to **24.3%** for low-resource),
**MMMLU** (14, incl. Swahili). Published numbers for models we run: Belebele `Qwen2.5-7B-Instruct`
93.1 en / 90.3 fr / 89.4 es but 77.7 sr / 70.3 hu / 67.7 bn; on 28 European variants
`Qwen2.5-14B` avg 61.7 vs `7B` 54.4 (Polish 58.9 vs 52.2). **TranslateGemma**: Gemma-3-based, trained and
evaluated on 55 languages (+~500 unevaluated pairs), *translation-specialised* with only ~30% general
instruction data retained — which is exactly why it is weak at math. All cited in `roadmap_v54.md`.

## Roadmapped (8 items, in roadmap_v54.md)
identical-source/target ratio threshold · model↔language capability matrix + auto-selection ·
model stamps for every generation step (story is the last unstamped artefact) · collapsible model picker ·
QC-for-generated-texts → corrected text → auto error-hunt · dynamic classification + sortable library ·
printable test export · labyrinth lessons · text provenance (author/licence/source).

Two recommendations recorded there that push back on the phrasing of the TODO:
- **`math: true` does not belong in `languages.json`.** It is a property of a *model*, not a language;
  put capability in a model registry keyed by model name, or it breaks with the second model.
- **Text provenance should be structured, not a convention inside the description field.** A free-text
  convention cannot be validated, exported or filtered, and the retitle/summary passes will mangle it.
Also: the labyrinth **link-out** option would break offline mode, the static `docs/index.html` build,
`qid()`/solved tracking, and would send learner vocabulary to a third-party site — recommend building it in.

---

# v53_d — data merge + story provenance (the corrected "#1")

Suite **95 green**, `check-inline` 0 both builds, `APP_VERSION='v53_d'`, static rebuilt. LIVE-TEST §72.

## Data merged from the user's tree
`ui.json` and `lessons.json` replaced with the user's current versions (theirs were ahead of the zip):
- **ui.json**: 29 → **30 languages, all complete**, 0 orphan keys. Swahili is translated — the v53
  `translate-ui.js` discovery fix paid for itself immediately. The 43-key debt is gone.
- **lessons.json**: 255 → **267 topics**, 72 → 74 storylines. New: 12 topics, incl. an `nl|de` pair and
  ten `en|sw` Swahili chapters.
- Confirms v53/v53_b in production: `en|ar → latin × 1` and `en|ar → arabic × 1` (the user's two
  lessons — intended, additive), and the baked Latin lesson answers in Arabic: `V v → ڤي`.
- `unit-translate-ui-langs` had an assertion message that was now a lie ("sw has no ui.json entry").
  Rewritten to assert discoverability **from languages.json**, independent of whether sw is translated —
  which is the invariant that actually matters for the *next* language added.
- Honest note: the new `nl|de` topic has only **1** identical item (`lachen`), under the `>2` threshold.
  The v53_c `de↔nl` addition is right, but it did not fire here.

## I was wrong about #1, and the data said so
The v53_c audit claimed the chapter story "neither logs a model nor is stamped". **Both false.**
- It logs: `` console.log(`[${OLLAMA_MODEL}] Story (…)`) `` — my grep looked for the word `Model` and
  missed the bracket prefix.
- It records: `generationStats.models.story`.
- I then hypothesised the 11 topics with `models.story === null` were a stamping bug, because they all
  had a `storyPrompt`. Wrong again: `storyPrompt` is *also* set on the user-provided branch
  (`'User-provided story'`). All 11 are `userStory: true`. **`null` was correct.**

Two checks, both cheap, both contradicted me. Worth remembering that the audit was a grep and the
correction was reading the data.

## What was actually wrong, and is now fixed
1. **No per-artefact story stamp.** `generationStats.models.story` says *which* model but not `ms`,
   tokens, or `at` — unlike every lesson's `_genMeta` and the storyline's `summaryMeta`. Added
   `topic.storyMeta`, written on **both** upserts. The early-save upsert ("save story early, before
   lesson generation, so story is never lost") matters most: those are the topics whose lesson
   generation crashed, i.e. exactly the ones you want provenance for.
2. **`null` was overloaded.** A pasted story is now `model: '(user-provided)'`, matching the existing
   `'(procedural)'` sentinel. "No model" and "unknown" no longer look alike.
3. **`buildGenMeta` defaulted `model` to `OLLAMA_LESSON_MODEL`.** I cross-checked all 13 stamps against
   the model each function actually calls: **no live mis-stamp** — every real site matched the default.
   But the add-lesson fallback (`if (!newLesson._genMeta)`) would have stamped *any* type, including
   procedural ones, with the lesson model. `model` is now **required** (throws), the fallback uses
   `'(unknown)'`, and all 13 sites name their model explicitly.

Coverage reality for the future "sort by models used": **16/267** topics carry `generationStats.models`,
**249** have `generationStats` without it, **2** have none. Backfill is impossible; the UI must render
"unknown" gracefully rather than hide those topics. Recorded in the roadmap.

## Still open (same shape, small)
The **translation** post-pass has no per-artefact stamp, and `generationStats.models.translation === null`
conflates "not run" (translation model == story model → no translation happens) with "unknown".

---

# v53_e — provenance backfill

Suite **95 green**, `check-inline` 0 both builds, `APP_VERSION='v53_e'`, static rebuilt. LIVE-TEST §73.
New file: **`backfill-provenance.js`** (zero-dep, dry-run by default, idempotent, `--verify`, `.bak`).

## It was mostly derivable — I was wrong to say backfill was impossible
The 249 topics lacking `generationStats.models` **do** carry `generationStats.model`:
```js
const uniqueModels = [...new Set([OLLAMA_MODEL, OLLAMA_TRANSLATION_MODEL, OLLAMA_LESSON_MODEL]);
const modelLabel = uniqueModels.join(' / ');
```
A Set preserves first-insertion order and the STORY model goes in first ⇒ `label.split(' / ')[0]` **is**
the story model. Not assumed — **validated** against the 16 topics that carry both fields: 5/5 agree
(the other 11 are user-provided, `story: null`), and the lessons model appears in the label 16/16.
`--verify` re-runs that check on demand.

## Where the record beat the user's memory
> "all non-annotated models were qwen2.5:7b, except for some letzebuergesch and an un-annotated
> swahili lessons which were translategemma4b"

- **122 of 267 topics are `userStory: true`** — pasted stories. No model wrote them. Stamping them
  `qwen2.5:7b` would have written a fabrication into `lessons.json` permanently. They are
  `'(user-provided)'`.
- The Lëtzebuergesch topics are **not** uniformly translategemma:4b: 5 record
  `translategemma:12b / qwen2.5:7b` (story = **12b**), 3 are plain `qwen2.5:7b`, and only 2 are the bare
  untagged `translategemma`.
- An **it|en** topic ("Brewery Owner Explains Wine…") also used bare `translategemma` — not mentioned.
- `osttirol-glossary` has a story but **no `generationStats` and an empty `storyPrompt`** — no evidence
  it was ever generated in-app. `--assume` deliberately does not cover it; it is `'(unknown)'`.

Memory was needed for exactly two things, both marked `source: 'user-asserted'` (5 rows total):
resolving the untagged `translategemma` → `translategemma:4b`, and one `--assume qwen2.5:7b` for the
topic that has a real LLM `storyPrompt` but no stats.

## Result
`qwen2.5:7b ×130 · (user-provided) ×122 · translategemma:12b ×10 · translategemma:4b ×4 · (unknown) ×1`
`generationStats.models` backfilled for the **243** single-model labels only (all three roles provably
equal). The **6** two-element labels pin the story but leave translation-vs-lessons unrecoverable, so
`models` is left **absent** there rather than guessed.

## The distinction that mattered
Every backfilled row carries `backfilled: true` and a `source` string
(`generationStats.model[0]` / `generationStats.models.story` / `userStory flag` / `user-asserted (--assume)` /
`no record`). Live stamps written by `server.js` carry neither. **Inferred data must never be able to
pass for recorded data** — the same reason `null` was split into `'(user-provided)'` vs `'(unknown)'`.
`unit-story-stamp` enforces it: sentinel ↔ `userStory` in both directions, every real model name tagged,
`'(unknown)'` only where the record is silent, `models` backfilled only for single-model labels.

### Post-fix: `--verify` was checking its own output
The release gate caught it. After the backfill, `--verify` compared the raw label (`translategemma`) to
the value the script had just written (`translategemma:4b`, via `--resolve`) and reported **4 false
mismatches**, exiting 1 — exactly where LIVE-TEST §73 promises "0 mismatched". `--verify` now ignores
rows carrying `generationStats.modelsSource` (its own output is not evidence for its own premise) and
reports how many it ignored. Guarded in `unit-story-stamp` along with the other rails: dry-run default,
`.bak` before write, refuse-to-write while unstamped or untagged, never re-stamp.

---

# v53_f — story `origin` (uploaded vs pasted vs generated)

Suite **95 green**, `check-inline` 0 both builds, `APP_VERSION='v53_f'`, static rebuilt. LIVE-TEST §74.

## The distinction that was missing
`'(user-provided)'` was doing two jobs. Splitting `storyMeta` into two orthogonal facts fixes it:
- **`model`** — WHO wrote the text (`qwen2.5:7b`, `translategemma:4b`, or `'(user-provided)'`: nobody).
- **`origin`** — WHERE it came from: `generated` · `dialect-rewrite` · `file-upload` · `user-pasted`.

Of the 122 `'(user-provided)'` topics, **50 are chapters of uploaded books** (`book-3.pdf`,
`kalila_and_dimna.md`, `كليلة_ودِمنة.pdf`) and **72 were pasted**. An uploaded chapter has an author and
a licence; a pasted one does not. `storyMeta.sourceFile` now names the file on each chapter, so a topic
is self-describing instead of requiring a walk up to its storyline.

`sourceFile` lives on the **storyline**, not the topic — which is why the server refines
`user-provided → file-upload` in the existing `sourceFile` post-pass, after the chapters are saved.
**Bug caught while writing it:** the post-pass has `chapterIds`, and I first wrote `findSaved(cid)` —
but `findSaved()` takes a topic *name*; ids need `findSavedById()`. It would have silently refined
nothing.

The **server** stamps `origin` on both live paths, so the migration does not become load-bearing.
A test asserts that, mutation-tested by deleting the refinement.

## osttirol-glossary
User: *"here i uploaded a glossary, and then the story was generated with translategemma:4b."*
It is a different shape from every other topic — `_dialect`, `storyGloss`, `aiGenerated`, `aiStory`,
no `userStory`, no `storyPrompt`, no `generationStats`. Now `translategemma:4b` / `dialect-rewrite`,
via the new `--set-model osttirol-glossary=translategemma:4b`, marked
`source: 'user-asserted (--set-model)'`.

## Where I did not follow the instruction
The user said *"same for Essen an Luxembourg"*. It classifies as **`generated`**, not
`dialect-rewrite` — it has `generationStats` but none of the `_dialect`/`aiGenerated` flags. The
**model** is right (`translategemma:4b`, derived from its label). But nothing in the corpus records
that a glossary informed it, and bending the classifier to match a recollection would make `origin`
mean "whatever we remember" instead of "what the data says". If glossary-driven generation should be
distinguishable, it needs a recorded field — noted in the roadmap.

## Migration
`--set-model <topic-or-id>=<model>` added (per-topic user assertion, always marked). Idempotent for the
model; a re-run still backfills a missing `origin`/`sourceFile` onto already-stamped rows, and a
genuine no-op now prints "nothing to do" instead of rewriting the file.
Final: `qwen2.5:7b ×130 · (user-provided) ×122 · translategemma:12b ×10 · translategemma:4b ×5`,
**6 user-asserted, 0 unknown**, everything else derived from the record.

---

# v53_g — identical source/target: ratio, not count

Suite **96 green**, `check-inline` 0 both builds, `APP_VERSION='v53_g'`, static rebuilt. LIVE-TEST §75.

## Derived, not guessed
Replaying all 267 topics: 98 lessons in non-close pairs contain ≥1 identical source/target vocab item.
Sorted by ratio, the distribution is **bimodal with an empty gap**:

| ratio | lessons | what they are |
|---|---|---|
| 100% (8/8) ×2, 80% (4/5), 75% (6/8) ×2 | 5 | **real model failures** — the source language written into both fields |
| *(40% … 75%)* | **0** | *nothing lands here* |
| 40% and below | 93 | loanwords / proper nouns: `pasta, tagliatelle, risotto` · `café, fans, notes` · `performance, DJ` · `Champagne, Terroir` |

Any cut in the gap separates them. **0.6** sits mid-gap. Rule: block when `≥3 items AND ratio ≥0.6`.
The old `> 2` rule caught all 5 failures **and wrongly rejected 4 good loanword lessons**, each then
regenerated for nothing on the user's own hardware.

**Sentences deliberately unchanged.** The corpus contains *zero* identical sentences in a non-close
pair, so there is no evidence to relax the `>1` rule — and a whole identical sentence is a much
stronger failure signal than a shared word. Changing it would have been a guess wearing a fix's
clothes.

## The test calibrates against the corpus
`unit-identical-ratio` pulls `IDENTICAL_MIN_ITEMS` / `IDENTICAL_MIN_RATIO` out of `server.js` (never
its own copy), replays the shipped 267 topics, and asserts: all 5 failures block, all 93 loanword
lessons are kept, **the 40–75% gap is still empty**, and the old count rule really did over-block 4.
If a future lesson lands in the gap the test fails — which is the correct response, because the
threshold's justification would no longer hold.

Mutation-tested in **both** directions: loosening to 0.9 (failures slip through), tightening to 0.3
(good lessons discarded), reverting to the bare count, and dropping the item floor all fail the suite.
`unit-close-lang-pairs` updated: it asserted the old `vocabSame.length > 2` wiring.

## Console
Now prints `k/n (pct%)` and one of three verdicts: `— close pair, allowed`,
`— below ratio threshold (loanwords?), allowed`, `— blocking, will retry`.

---

# v54 — drill lessons ("review my mistakes")

Suite **97 green**, `check-inline` 0 both builds, `APP_VERSION='v54'`, static rebuilt. LIVE-TEST §76.
The loop the ledger has been half of since v50 is finally closed: it recorded a per-word `wrong`
count, and **nothing read it**.

## Core (pure, headless)
- `drillCandidates(lang, srcLang, size)` — wrong words first (most-wrong, then most-seen), padded with
  known words (most-seen first). Deterministic: ties break on `target`, so the same ledger always
  yields the same round — which also makes the qids stable across repeated drills.
- `buildDrillLesson(...)` → `{id:'drill', type:'standard', _drill:true, vocab:[{target,source}]}`
  or **null**. Refuses when fewer than `DRILL_MIN=4` usable words (an MCQ needs 3 distractors) or when
  nothing is actually wrong — a drill is not a re-run of vocabulary the learner already has.
  Words with no gloss are skipped: they can't be quizzed in either direction.
- `drillAvailable()` drives the button; `startDrill()` / `endDrill()` swap an ephemeral `lessonData`.

## Both roadmap design calls honoured
1. **Ephemeral.** The drill never enters `lessons.json`. `showComplete` and `confirmQuit` are gated on
   `lesson._drill` so it writes no topic completion — otherwise a phantom `__drill__` topic would sit
   in progress forever. The real topic is stashed in `APP._drillPrev` and restored on both exits.
   Re-drilling from a drill's own result card stashes the *original* topic, not the drill.
2. **Normal qid path.** Exercises come from the real `buildStandardExercises`, so `markSolved()` and
   the solved store work unchanged. Re-learning decrements: answering a drilled word correctly walks
   its `wrong` count down (floored at 0). **Gated on `_drill`** — a normal lesson must not decay the
   counts the drill depends on, or one lucky answer erases the record of a struggle.

## The test proves it PLAYS, not just that it type-checks
`unit-drill` runs the synthesized lesson through the real `buildStandardExercises` and asserts: 11
exercises from 6 words, every MCQ answerable (correct ∈ choices), no duplicate choices, the wrong
words are actually **quizzed**, and every exercise yields a stable `drill:`-namespaced qid.

**Mutation-tested (5 guards).** One of them was fake and I only found it by mutating: the assertion
`showC.indexOf('recordLearnedFromLesson') < showC.indexOf('drillAvailable')` was matching the function
name inside a **comment I had just written**, not the call — so moving the availability check above the
ledger update passed. Re-anchored on the call text; it now catches. A guard that passes its own
mutation is worse than no guard.

## Notes
- **4 new en-only `ui.json` keys**: `drill.title`, `drill.desc`, `drill.cta`, `drill.empty`. This
  re-opens a translation debt (4 × 29 languages) that the user had just cleared. Owed to TranslateGemma.
- Entry point is the **result card** (the smaller surface, per the roadmap). The path/mixed-round
  entry points remain open.
- Additive: no existing progression behaviour changed. Verified by mutation (a normal lesson decaying
  `wrong` counts fails the suite).

---

# v54_b — two user-reported drill bugs

Suite **97 green**, `check-inline` 0 both builds, `APP_VERSION='v54_b'`, static rebuilt. LIVE-TEST §77.

## (a) "more words are tested, not just my mistakes"
Correct. `drillCandidates` padded to `DRILL_SIZE=8`, and `buildDrillLesson` put the whole padded list
into `lesson.vocab` — so with one mistake the round quizzed 1 mistake and 7 known words. Padding is
needed (an MCQ wants 3 wrong options) but it belongs in the **distractor pool**, not the quiz.

Fix: `buildStandardExercises` now reads `const allV = lesson._distractors || lesson.vocab || []`
(additive — absent on every normal lesson). `buildDrillLesson` sets `vocab` = the mistakes and
`_distractors` = mistakes + padding, padded only up to `max(DRILL_MIN, wrongCount)`.

| mistakes | quizzed | pool | padding |
|---|---|---|---|
| 1 | 1 | 4 | 3 |
| 3 | 3 | 4 | 1 |
| 6 | 6 | 6 | 0 |

The recap ("words from this lesson") and the ledger update both read `lesson.vocab`, so padding is
never shown, never recorded, and never decrements a `wrong` count it didn't earn.

## (b) the `__drill__` fake lesson set
`showComplete` **reassigns** `compNext.onclick` (lines 9789/9792/9795). The inline
`onclick="afterComplete()"` in the HTML therefore never fires after a lesson completes — so my
`endDrill()` inside `afterComplete` was **dead code on the finish path**. It only ever ran via ✕.

Consequences: `APP.lessonData` stayed the ephemeral drill; the completion nav button takes its title
from `APP.lessonData.topic` and rendered `📚 __drill__`, whose `goLessonSet()` opened the drill as a
fake lesson set — with the drill lesson replayable inside it.

Fix: `endDrill()` moved into **`goLessonSet()`**, the single choke point every exit funnels through
(Continue, the nav buttons, confirmQuit), placed before it reads `APP.lessonData`. The nav buttons are
hidden entirely for a drill (it has no lesson set and no storyline). `nextLessonIdx` was already safe
(`i !== C.lessonIdx` excludes the drill's only lesson).

## Both guards for this were FAKE
`unit-drill` asserted `afterComplete` *contains* `endDrill()` — true, and worthless, because nothing
calls it. That is the **second** fake guard in two sessions (the first matched a function name inside a
comment). Both passed their mutations. Replaced with assertions on the real invariant: `goLessonSet`
calls `endDrill()`, and does so *before* reading `APP.lessonData`.

Lesson worth carrying forward: **asserting that a function contains a call proves nothing about whether
that function runs.** Mutation-testing found (1) only because I mutated the call site rather than the
callee. Five mutations now cover both fixes.

---

# v54_c — `_wrongTargets` leaked across lessons

Suite **97 green**, `check-inline` 0 both builds, `APP_VERSION='v54_c'`, static rebuilt. LIVE-TEST §78.

## The user's question
> "the drill lesson does not only include mistakes i made, but also words that are part of the vocab
> lessons but were not asked in the mixed lesson. is that possible?"

Two of the three things they saw are **by design**, one was a real and fairly bad bug.

**By design:** (a) the drill reads the *cumulative* ledger for the language pair, not the lesson just
played — a mistake made in any earlier lesson or topic is eligible; (b) words that appear as MCQ
*choices* but are never *asked* are the `_distractors` pool (v54_b): a one-mistake round still needs
three wrong options.

## The bug
`C._wrongTargets` is created lazily on the first wrong answer (`(C._wrongTargets||(C._wrongTargets=new Set())).add(...)`)
and **`startLesson` never cleared it**. It accumulated across every lesson in the session.

`recordLearnedFromLesson` does:
```js
if(wrong.has(tk)) rec.wrong++;
else if(lesson._drill) rec.wrong = Math.max(0, rec.wrong - 1);
```
The `has()` test **wins over the drill's decrement**. So a word missed in lesson A, then drilled and
answered *correctly*, went `wrong: 1 → 2`. Demonstrated:

| round | Hund.wrong |
|---|---|
| lesson A, Hund wrong | 1 |
| mixed B, all correct | 1 |
| **drill, all correct** | **2** ← should be 0 |

**The drill could never retire a mistake within a session, and inflated the count on every attempt.**
Words answered correctly in a later lesson were also re-marked wrong, provided they had been missed
earlier in the same session.

Fix: `delete C._wrongTargets;` at the top of `startLesson`, beside the other per-round resets.

## Why the suite missed it
Every existing test called `recordLearnedFromLesson` **once**, with a freshly-constructed set. The bug
only exists in a *sequence* of rounds sharing one `APP.cur`. The new guard plays four rounds in order
(mistake → clean mixed → drill correct → drill wrong) and asserts the ledger after each. Note the
load-bearing assertion is the source-level `delete C._wrongTargets` check: `startLesson` is DOM-bound,
so the sequence test stubs the reset rather than calling it.

Third user-found bug in the drill in two releases; the suite was green for all three. The pattern is
consistent: **state that lives on a long-lived object, and code paths that only exist when the UI wires
them together.** Neither is reachable from a unit test that constructs its own inputs.

---

# v54_c addendum — storyboard SPIKE script (no product change)

Built the roadmap's "first spike" for the v55 SVG chapter storyboard: **`spike-storyboard.js`**
(root, throwaway, imported by nothing — deleting it is always safe). No product file changed;
suite still 97 green, check-inline 0 on both builds, no version bump (nothing shipped).

**What it does.** Picks a real ≥2-chapter storyline from `lessons.json` (`--list` / `[slId]`),
gathers chapters exactly like `/api/storyline-summary`, prompts the model for a **strict JSON
array of 2–5 panels** from a whitelisted primitive vocabulary (rect/circle/ellipse/line/
polyline/polygon/constrained-`d` path/text, named palette, 0–100 viewBox), parses via the
`llm.js` chain (`JSON.parse(stripRaw)` → `extractArray` → `salvageArray`), then **composes the
SVG itself** from the validated JSON and dumps `raw_attemptN.txt` / `panels.json` /
`storyboard.svg` / `.html` to `spike_storyboard_out/`. Prints a `buildGenMeta`-shaped stamp
preview (`type:'storyline_storyboard'`, the STORY model).

**The composer is written to the roadmap's safety spec so it can be lifted into `server.js`
as-is:** unknown shape types dropped (never rendered raw); every coord/size clamped into the
panel viewBox; colors resolved through the named palette only; path `d` charset-whitelisted +
length-capped; all text `escXml`'d; panels rendered as nested `<svg>` (clips overflow); caps
≤5 panels / ≤25 shapes; **<2 valid panels → null**. No `<script>`, `<foreignObject>`, or
`href` can be emitted.

**Verified headlessly (no Ollama in the build sandbox):** `--fixture` mode composes a 2-panel
sample whose input deliberately contains a `script` shape, a `<foreignObject>` inside a path
`d`, and a y=900 text — the first two are DROPPED, the third clamped; a grep of the output for
`<script`/`foreignObject`/`href`/`onload`/`javascript:` is clean; the rasterized SVG looks as
intended. The no-backend failure path (ECONNREFUSED → 2 attempts → exit 2 with raw-dump advice)
was also exercised.

**Owed / next (user):** the actual live-model verdict — run e.g.
`OLLAMA_MODEL=qwen3.6:35b-a3b node spike-storyboard.js --list` then a run against a real
storyline, and judge `spike_storyboard_out/storyboard.svg` by eye. Crude-but-recognisable →
proceed with the v55 build (prompt → `prompts.json`, composer → `server.js`, `unit-storyboard`,
LIVE-TEST §79). Garbage / schema not held → stop and report, per the roadmap. No ui.json keys,
no LIVE-TEST section yet — both belong to the real feature, not the spike.

## Spike run 1 (user, 2026-07-12): TIMEOUT — not a verdict
`qwen3.6:35b-a3b` on `sl_1848224281` timed out twice at the llm.js default. Root cause read from
`_callOllama`: `req.setTimeout(OLLAMA_TIMEOUT)` is a socket-**inactivity** timeout and requests
are `stream:false`, so the socket is silent for the ENTIRE model-load + generation — 12 minutes
of silence kills a run that may be generating fine, and attempt 1 additionally pays the full
cold-load of a 35B model inside the same window. Spike hardened: `--timeout <ms>` flag
(defaults to the `setRequestTimeout` 60-min clamp max), a `warmup(MODEL)` call before the timed
attempts, per-attempt elapsed + tok/s reporting, and timeout-specific advice on failure
(distinct from the schema-failure stop-and-report advice).

**Carry-forward for the v55 build:** the real `/api/storyline-storyboard` route inherits this
ceiling. Either the route bumps the request timeout for the storyboard call, the client warns
that big models can take >12 min, or generation moves to the job/polling pattern the lesson
generator uses. Decide during the build; the spike's tok/s line gives the data.
