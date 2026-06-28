# v47 session 1 — UX polish, i18n correctness, Japanese furigana

Five small, self-contained changes, one at a time, suite green + `check-inline` at 0 after
each. New guard `unit-furigana`; updated `unit-import-merge` wiring assertion. Full plan +
the new "intro script course" design integrated into `roadmap_v47.md`.

## 1 — Import popup: Merge / Replace buttons
- Native `confirm()` can't relabel OK/Cancel, so added `showChoiceDialog(opts)` — a reusable
  Promise-returning modal on the existing `.modal-*` CSS. Returns the chosen value or `null`.
- Import of a flag/edit submission now offers **Merge** (flags/ratings/deletes only) vs
  **Replace** (overwrite matching topics), each with a hint line, + Cancel.
- Behaviour improvement: dismiss/Cancel now **aborts** the import (old `confirm()` Cancel
  meant full-replace — a stray Esc could clobber content).
- Strings: `import.choice.*`, `dialog.cancel` in `ui.json` (English; others offline).
  `toast.import_merge_confirm` left in place but unused.

## 2 — Cosmetics: lesson-type icons (storyline page)
- `_lessonTypesDropdownHtml` body changed from a collapsible `<details>` chip list to a
  plain inline row of registry **emoji only**; label kept as `title` tooltip. Name unchanged
  so the wiring assertion in `unit-storyline-screen-extras` still holds.

## 3 — Arabic-as-target RTL fix
- `updateDocDir()` keyed document `dir` off the **target** language → whole UI flipped for any
  →Arabic lesson. Now: document `dir` follows the **UI** language (`APP.srcLang`); a new
  `.tgt-rtl` class on `<html>` (set when **target** is RTL) right-aligns only the target-text
  fields (`.qtext`,`.target-box-text`,`.it-word`,`.tok`,`.placed-tok`,`.sbox-ph`). UI chrome
  (`.saved-meta`,`.fb-*`) follows the document dir. CSS split accordingly.

## 4 — Japanese: parse pasted furigana, keep in display
- `rubyToBracket(text)` normalizes `<ruby>…<rt>…</rt></ruby>` (incl. `aria-hidden`, `<rp>`
  paren fallbacks) → internal `kanji[reading]` bracket form, at paste-read time for
  `userStory` + `userTranslation`. Bracket / non-Japanese text passes through unchanged.
- `applyFurigana`/`stripFuri`/`furiHtml` base class widened to include **katakana**
  (`\u30a0-\u30ff`) so loanword readings like `ボール[ぼーる]` are kept; a `[reading]` after a
  lone hiragana/punctuation is still treated as a mistake and stripped.

## 5 — Japanese: sentence-order tokenizer keeps groups intact
- Old single-alternation regex merged a katakana group after a hiragana run
  (`大好[だいす]きなボール[ぼーる]` → split the reading off). New `jaTokenize()` uses
  **protect-and-restore** (PUA sentinels around each `BASE[reading]` group, BASE = kanji or
  katakana) before splitting. Mirrored verbatim in `server.js` (`deriveSentenceWords`) and
  client (`mkOrder`); `unit-furigana` asserts they agree.
- Fixes "works only for JA-as-source": JA-as-target ordering re-derives from `s.target`
  correctly regardless of a mis-split stored `s.words`.

## Verification (headless)
`node --check server.js` · `node test/check-inline.js` → 0 failures · `node test/run.js`
→ ALL CHECKS PASSED (46 test files). `node build-static.js` → OK.

## Owed (browser / live)
- Visual pass on all four ✅ UI items (modal, icon row, en→ar alignment, JA paste + ordering
  with real Ollama-generated and hand-pasted stories).
- i18n for `import.choice.*` / `dialog.cancel` (English shipped; others generated offline).

## Next (see roadmap_v48 "Updated suggested sequence")
P1 examples.json batch-gen → browser pass + import.choice i18n → minor #2 (QC expansion,
needs Ollama) → intro `intro_script` course phase 2 (kana/greek/hangul) → P2 map-tree UI.

---

## 6 — Intro "learn the script" course — phase 1 (Cyrillic), LLM-free
New beginner lesson type `intro_script` that teaches a target language's alphabet, no LLM.
Follows the `math` precedent (procedural generator + client builder + registry row).

- **`scripts.json`** (new, sibling of `languages.json`): `_langScript` maps lang→script(s)
  (`ru`/`uk`→cyrillic, `ja`→[hiragana,katakana], `el`/`ko`/`ar`/`he`/`th`→their scripts);
  per-script tables of `{ch, lower, name, translit, ipa}`. **Cyrillic** is filled (33
  letters); the rest are empty phase-2 stubs. Baked into the static build
  (`window.SCRIPTS_DATA`) and served at **`GET /api/scripts`**; client `loadScripts()`
  mirrors `loadLanguages()`.
- **Generator** `generateIntroScript(lang, {script})` (server) + shared
  `introScriptExercises(letters)` / client `introScriptExercisesFrom(letters)` — produce one
  glyph→sound MCQ + one sound→glyph MCQ per letter, plus ≤5 listen→glyph items, all reusing
  existing renderers (`mcq_source_target`, `mcq_target_source`, `listen_mcq`). Client/server
  parity asserted in `unit-intro-script`.
- **Registry:** `intro_script` row in `LESSON_TYPE_META` (🔡, builder
  `buildIntroScriptExercises`, editor → standard branch) and in `ADD_LESSON_GENERATORS`.
- **UX:** appears in the "➕ add lesson" dropdown (card + storyline panel) **only** when
  `needsIntroScript(targetLang, srcLang)` — target uses a script the learner doesn't read
  AND we have a non-empty table (so phase-2 stubs stay hidden). Built **client-side** like
  `mixed` (works on the static build, no server round-trip), with the server add-lesson path
  also wired (procedural, no story / no LLM-backend requirement). For ja it adds one lesson
  per script once those tables are filled.
- **Listen gating:** listen→glyph items dropped when the target has no TTS voice.
- **Guard:** `test/unit-intro-script.test.js` — table integrity, gating, client/server
  parity, renderer reuse, registry/route/static-bake wiring. Updated `unit-add-lesson-registry`
  for the new fmt.
- **Owed (phase 2+):** fill kana/greek/hangul/arabic/hebrew/thai tables; Arabic positional
  `forms`; an editor view that shows the letter table rather than the standard vocab editor;
  optional "Chapter 0" auto-prepend for a brand-new script pair.
