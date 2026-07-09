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
